import { Injectable } from '@nestjs/common';
import {
  CalendarConnectorCredentials,
  CalendarProvider,
  SyncedCalendarEvent,
} from './calendar-provider.interface';
import { SystemDateService } from '../../../common/system-date.service';
import { SimCalendarProvider } from '../../simulation/providers/sim-calendar.provider';

@Injectable()
export class OutlookCalendarProvider implements CalendarProvider {
  readonly providerName = 'outlook' as const;

  constructor(
    private readonly systemDateService: SystemDateService,
    private readonly simCalendarProvider: SimCalendarProvider,
  ) {}

  async listEvents(credentials: CalendarConnectorCredentials, options?: { timeMin?: Date; timeMax?: Date }): Promise<SyncedCalendarEvent[]> {
    if (this.systemDateService.isSimulation()) {
      return this.simCalendarProvider.listEvents(credentials, options);
    }

    const accessToken = this.requireAccessToken(credentials);
    const start = options?.timeMin?.toISOString() ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = options?.timeMax?.toISOString() ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$top=50&$select=id,subject,bodyPreview,start,end,location,isAllDay,attendees,onlineMeeting,onlineMeetingUrl`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Outlook Calendar list failed', response.status, payload));
    }

    return (payload?.value ?? []).map((event: any) => this.parseEvent(event));
  }

  async test(credentials: CalendarConnectorCredentials) {
    if (this.systemDateService.isSimulation()) {
      return this.simCalendarProvider.test(credentials);
    }

    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Outlook Calendar connector test failed', response.status, payload));
    }
    return { ok: true, emailAddress: payload?.owner?.address ?? null, rawResponse: payload };
  }

  private parseEvent(event: any): SyncedCalendarEvent {
    return {
      externalId: event.id,
      title: event.subject ?? '(No Title)',
      description: event.bodyPreview,
      startAt: new Date(event.start?.dateTime + 'Z'), // Graph returns local-looking ISO, appending Z to force UTC interpretation if needed or rely on Graph's timezone
      endAt: new Date(event.end?.dateTime + 'Z'),
      timezone: event.start?.timeZone,
      location: event.location?.displayName,
      meetingUrl: event.onlineMeetingUrl ?? event.onlineMeeting?.joinUrl,
      status: event.showAs ?? 'busy',
      isAllDay: event.isAllDay ?? false,
      attendees: (event.attendees ?? []).map((a: any) => ({
        email: a.emailAddress?.address,
        name: a.emailAddress?.name,
        responseStatus: a.status?.response,
      })),
      rawResponse: event,
    };
  }

  private requireAccessToken(credentials: CalendarConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('Outlook Calendar connector is missing an access token');
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
