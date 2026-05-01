import { Injectable } from '@nestjs/common';
import {
  CalendarConnectorCredentials,
  CalendarProvider,
  SyncedCalendarEvent,
} from './calendar-provider.interface';

import { SystemDateService } from '../../../common/system-date.service';
import { SimCalendarProvider } from '../../simulation/providers/sim-calendar.provider';

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerName = 'google_calendar' as const;

  constructor(
    private readonly systemDateService: SystemDateService,
    private readonly simCalendarProvider: SimCalendarProvider,
  ) {}

  async listEvents(credentials: CalendarConnectorCredentials, options?: { timeMin?: Date; timeMax?: Date }): Promise<SyncedCalendarEvent[]> {
    if (this.systemDateService.isSimulation()) {
      return this.simCalendarProvider.listEvents(credentials, options);
    }

    const accessToken = this.requireAccessToken(credentials);
    const timeMin = options?.timeMin?.toISOString() ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = options?.timeMax?.toISOString() ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Google Calendar list failed', response.status, payload));
    }

    return (payload?.items ?? []).map((event: any) => this.parseEvent(event));
  }

  async test(credentials: CalendarConnectorCredentials) {
    if (this.systemDateService.isSimulation()) {
      return this.simCalendarProvider.test(credentials);
    }

    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Google Calendar connector test failed', response.status, payload));
    }
    return { ok: true, emailAddress: payload?.id ?? null, rawResponse: payload };
  }

  private parseEvent(event: any): SyncedCalendarEvent {
    return {
      externalId: event.id,
      title: event.summary ?? '(No Title)',
      description: event.description,
      startAt: new Date(event.start?.dateTime ?? event.start?.date),
      endAt: new Date(event.end?.dateTime ?? event.end?.date),
      timezone: event.start?.timeZone,
      location: event.location,
      meetingUrl: event.hangoutLink ?? event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
      status: event.status,
      isAllDay: !!event.start?.date,
      attendees: (event.attendees ?? []).map((a: any) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus,
      })),
      rawResponse: event,
    };
  }

  private requireAccessToken(credentials: CalendarConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('Google Calendar connector is missing an access token');
    }
    return credentials.accessToken;
  }

  private async readJson(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private errorMessage(prefix: string, status: number, payload: any) {
    const detail = payload?.error?.message ?? payload?.error_description ?? JSON.stringify(payload);
    return `${prefix}: ${status}${detail ? ` ${detail}` : ''}`;
  }
}
