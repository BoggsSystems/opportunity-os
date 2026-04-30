export interface CalendarConnectorCredentials {
  accessToken: string;
}

export interface SyncedCalendarEvent {
  externalId: string;
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone?: string;
  location?: string;
  meetingUrl?: string;
  status: string;
  isAllDay: boolean;
  attendees: Array<{
    email: string;
    name?: string;
    responseStatus?: string;
  }>;
  rawResponse?: any;
}

export interface CalendarProvider {
  readonly providerName: string;
  listEvents(credentials: CalendarConnectorCredentials, options?: { timeMin?: Date; timeMax?: Date }): Promise<SyncedCalendarEvent[]>;
  test(credentials: CalendarConnectorCredentials): Promise<{ ok: boolean; emailAddress?: string; rawResponse?: any }>;
}
