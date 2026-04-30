import { Injectable } from "@nestjs/common";
import {
  CalendarConnectorCredentials,
  CalendarProvider,
  SyncedCalendarEvent,
} from "./calendar-provider.interface";

@Injectable()
export class ICloudCalendarProvider implements CalendarProvider {
  readonly providerName = "icloud" as const;

  async listEvents(
    credentials: CalendarConnectorCredentials,
    options?: { timeMin?: Date; timeMax?: Date },
  ): Promise<SyncedCalendarEvent[]> {
    const { accessToken, emailAddress } = credentials as any; // iCloud needs email as username
    if (!emailAddress)
      throw new Error("iCloud email address is required for CalDAV");

    const serverUrl = await this.discoverServerUrl(emailAddress, accessToken);
    const calendars = await this.listCalendars(
      serverUrl,
      emailAddress,
      accessToken,
    );

    const allEvents: SyncedCalendarEvent[] = [];
    for (const calendarUrl of calendars) {
      const events = await this.fetchCalendarEvents(
        calendarUrl,
        emailAddress,
        accessToken,
        options,
      );
      allEvents.push(...events);
    }

    return allEvents;
  }

  async test(credentials: CalendarConnectorCredentials) {
    const { accessToken, emailAddress } = credentials as any;
    if (!emailAddress) return { ok: false, reason: "Email address required" };

    try {
      await this.discoverServerUrl(emailAddress, accessToken);
      return { ok: true, emailAddress };
    } catch (error) {
      return {
        ok: false,
        rawResponse:
          error instanceof Error
            ? error.message
            : "iCloud calendar test failed",
      };
    }
  }

  private async discoverServerUrl(
    email: string,
    appSpecificPassword: string,
  ): Promise<string> {
    const auth = Buffer.from(`${email}:${appSpecificPassword}`).toString(
      "base64",
    );

    // Step 1: Get Principal
    const propfindPrincipal = `<?xml version="1.0" encoding="utf-8" ?>
      <D:propfind xmlns:D="DAV:">
        <D:prop>
          <D:current-user-principal/>
        </D:prop>
      </D:propfind>`;

    const resp1 = await fetch("https://caldav.icloud.com/", {
      method: "PROPFIND",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "text/xml" },
      body: propfindPrincipal,
    });

    const text1 = await resp1.text();
    if (!resp1.ok)
      throw new Error(
        `iCloud Discovery Step 1 failed: ${resp1.status} ${text1}`,
      );

    const principalPath = this.extractXmlValue(text1, "current-user-principal");
    if (!principalPath) throw new Error("Could not find iCloud principal path");

    // Step 2: Get Home Set
    const propfindHome = `<?xml version="1.0" encoding="utf-8" ?>
      <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
        <D:prop>
          <C:calendar-home-set/>
        </D:prop>
      </D:propfind>`;

    const resp2 = await fetch(`https://caldav.icloud.com${principalPath}`, {
      method: "PROPFIND",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "text/xml" },
      body: propfindHome,
    });

    const text2 = await resp2.text();
    if (!resp2.ok)
      throw new Error(`iCloud Discovery Step 2 failed: ${resp2.status}`);

    const homeUrl = this.extractXmlValue(text2, "calendar-home-set");
    if (!homeUrl) throw new Error("Could not find iCloud calendar home set");

    return homeUrl.endsWith("/") ? homeUrl : homeUrl + "/";
  }

  private async listCalendars(
    homeUrl: string,
    email: string,
    password: string,
  ): Promise<string[]> {
    const auth = Buffer.from(`${email}:${password}`).toString("base64");
    const propfindCalendars = `<?xml version="1.0" encoding="utf-8" ?>
      <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
        <D:prop>
          <D:displayname/>
          <C:supported-calendar-component-set/>
        </D:prop>
      </D:propfind>`;

    const resp = await fetch(homeUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "text/xml",
        Depth: "1",
      },
      body: propfindCalendars,
    });

    const text = await resp.text();
    // Simplified: Find all <href> tags within <response> tags that aren't the homeUrl itself
    const hrefMatches = text.matchAll(/<href>(.*?)<\/href>/g);
    const calendars: string[] = [];
    for (const match of hrefMatches) {
      const href = match[1];
      if (href !== homeUrl && href.includes("/calendars/")) {
        calendars.push(
          href.startsWith("http") ? href : new URL(href, homeUrl).toString(),
        );
      }
    }
    return calendars.length > 0 ? calendars : [homeUrl];
  }

  private async fetchCalendarEvents(
    calendarUrl: string,
    email: string,
    password: string,
    options?: { timeMin?: Date; timeMax?: Date },
  ): Promise<SyncedCalendarEvent[]> {
    const auth = Buffer.from(`${email}:${password}`).toString("base64");
    const start =
      (options?.timeMin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0] + "Z";
    const end =
      (options?.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0] + "Z";

    const reportQuery = `<?xml version="1.0" encoding="utf-8" ?>
      <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
        <D:prop>
          <D:getetag/>
          <C:calendar-data/>
        </D:prop>
        <C:filter>
          <C:comp-filter name="VCALENDAR">
            <C:comp-filter name="VEVENT">
              <C:time-range start="${start}" end="${end}"/>
            </C:comp-filter>
          </C:comp-filter>
        </C:filter>
      </C:calendar-query>`;

    const resp = await fetch(calendarUrl, {
      method: "REPORT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "text/xml",
        Depth: "1",
      },
      body: reportQuery,
    });

    const text = await resp.text();
    const eventDataMatches = text.matchAll(
      /<C:calendar-data>(.*?)<\/C:calendar-data>/gs,
    );
    const events: SyncedCalendarEvent[] = [];

    for (const match of eventDataMatches) {
      const ics = match[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      const parsed = this.parseIcs(ics);
      if (parsed) events.push(parsed);
    }

    return events;
  }

  private parseIcs(ics: string): SyncedCalendarEvent | null {
    const summary = ics.match(/SUMMARY:(.*)/)?.[1]?.trim() || "(No Title)";
    const start = ics.match(/DTSTART(?:;VALUE=DATE)?:(.*)/)?.[1]?.trim();
    const end = ics.match(/DTEND(?:;VALUE=DATE)?:(.*)/)?.[1]?.trim();
    const description = ics.match(/DESCRIPTION:(.*)/)?.[1]?.trim();
    const location = ics.match(/LOCATION:(.*)/)?.[1]?.trim();
    const uid = ics.match(/UID:(.*)/)?.[1]?.trim();

    if (!start || !end) return null;

    return {
      externalId: uid || Math.random().toString(36).substring(7),
      title: summary,
      description,
      startAt: this.parseIcsDate(start),
      endAt: this.parseIcsDate(end),
      location,
      status: "busy",
      isAllDay: !start.includes("T"),
      attendees: [], // Complex to parse manually
      rawResponse: { ics },
    };
  }

  private parseIcsDate(dateStr: string): Date {
    // Basic format: 20230501T120000Z or 20230501
    const clean = dateStr.replace(/\r/g, "");
    if (clean.length === 8) {
      return new Date(
        `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`,
      );
    }
    const formatted = `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}T${clean.substring(9, 11)}:${clean.substring(11, 13)}:${clean.substring(13, 15)}Z`;
    return new Date(formatted);
  }

  private extractXmlValue(xml: string, tag: string): string | null {
    const regex = new RegExp(
      `<[^>]*${tag}[^>]*>(.*?)<\/[^>]*${tag}[^>]*>`,
      "i",
    );
    const match = xml.match(regex);
    if (!match) return null;
    // Handle nested href if present
    const hrefMatch = match[1].match(/<href>(.*?)<\/href>/i);
    return hrefMatch ? hrefMatch[1] : match[1];
  }
}
