import { Injectable } from '@nestjs/common';
import { CalendarProvider, CalendarConnectorCredentials, SyncedCalendarEvent } from '../../connectors/calendar/calendar-provider.interface';
import { SystemDateService } from '../../../common/system-date.service';

@Injectable()
export class SimCalendarProvider implements CalendarProvider {
  readonly providerName = 'simulation';

  constructor(private readonly systemDateService: SystemDateService) {}

  async listEvents(
    _credentials: CalendarConnectorCredentials, 
    _options?: { timeMin?: Date; timeMax?: Date }
  ): Promise<SyncedCalendarEvent[]> {
    const now = this.systemDateService.now();
    
    // Generate a deterministic "Meeting" if we are in the morning of the simulated day
    const events: SyncedCalendarEvent[] = [];
    
    if (now.getUTCHours() < 12) {
      const startAt = new Date(now);
      startAt.setUTCHours(14, 0, 0, 0); // 2 PM
      
      const endAt = new Date(now);
      endAt.setUTCHours(15, 0, 0, 0); // 3 PM
      
      events.push({
        externalId: `sim_evt_${now.getTime()}`,
        title: 'Strategic Revenue Review',
        description: 'Simulated high-value sales meeting.',
        startAt,
        endAt,
        status: 'confirmed',
        isAllDay: false,
        attendees: [
          { email: 'prospect@example.com', name: 'Potential Client', responseStatus: 'accepted' }
        ]
      });
    }

    return events;
  }

  async test(_credentials: CalendarConnectorCredentials): Promise<{ ok: boolean; emailAddress?: string }> {
    return { ok: true, emailAddress: 'simulated@opportunity-os.com' };
  }
}
