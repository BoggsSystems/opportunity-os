import { Injectable, Logger } from '@nestjs/common';
import { Person, Opportunity, Activity } from '@opportunity-os/db';
import { CrmProvider } from '../interfaces/crm-provider.interface';

@Injectable()
export class HubspotProvider implements CrmProvider {
  name = 'hubspot';
  private readonly logger = new Logger(HubspotProvider.name);
  private readonly baseUrl = 'https://api.hubapi.com';

  /**
   * Upserts a contact in HubSpot based on email address.
   */
  async upsertContact(person: Person, credentials: any): Promise<string> {
    const accessToken = credentials.accessToken;
    if (!accessToken) throw new Error('Missing HubSpot access token');

    this.logger.log(`Upserting contact in HubSpot: ${person.email}`);

    // 1. Check for existing contact
    const searchResponse = await fetch(`${this.baseUrl}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                property: 'email',
                operator: 'EQ',
                value: person.email,
              },
            ],
          },
        ],
      }),
    });

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`HubSpot Search Error: ${searchResponse.status} - ${error}`);
    }

    const searchData = (await searchResponse.json()) as any;
    const existingContact = searchData.results?.[0];

    const properties = {
      email: person.email,
      firstname: person.firstName || person.fullName?.split(' ')[0] || '',
      lastname: person.lastName || person.fullName?.split(' ').slice(1).join(' ') || '',
      jobtitle: person.title || '',
    };

    if (existingContact) {
      // Update existing contact
      const updateResponse = await fetch(`${this.baseUrl}/crm/v3/objects/contacts/${existingContact.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });

      if (!updateResponse.ok) {
        throw new Error(`HubSpot Update Error: ${updateResponse.status}`);
      }

      return existingContact.id;
    } else {
      // Create new contact
      const createResponse = await fetch(`${this.baseUrl}/crm/v3/objects/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`HubSpot Create Error: ${createResponse.status} - ${error}`);
      }

      const createData = (await createResponse.json()) as any;
      return createData.id;
    }
  }

  /**
   * Creates a deal in HubSpot.
   */
  async createDeal(opportunity: Opportunity, credentials: any): Promise<string> {
    const accessToken = credentials.accessToken;
    if (!accessToken) throw new Error('Missing HubSpot access token');

    this.logger.log(`Creating deal in HubSpot: ${opportunity.title}`);

    const properties = {
      dealname: opportunity.title,
      amount: opportunity.value?.toString() || '0',
      dealstage: this.mapStageToHubspot(opportunity.stage),
      description: opportunity.summary || '',
    };

    const response = await fetch(`${this.baseUrl}/crm/v3/objects/deals`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot Deal Error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    return data.id;
  }

  /**
   * Pushes an activity as a note/engagement in HubSpot.
   */
  async pushMessage(activity: Activity, credentials: any): Promise<void> {
    const accessToken = credentials.accessToken;
    if (!accessToken) throw new Error('Missing HubSpot access token');

    this.logger.log(`Pushing activity to HubSpot: ${activity.activityType}`);

    // Simplified: Push everything as a Note for now
    const properties = {
      hs_note_body: `${activity.subject}\n\n${activity.bodySummary || ''}`,
      hs_timestamp: activity.occurredAt.getTime().toString(),
    };

    const response = await fetch(`${this.baseUrl}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      this.logger.error(`HubSpot Note Error: ${response.status}`);
    }
  }

  /**
   * Verifies the HubSpot connection.
   */
  async testConnection(credentials: any): Promise<boolean> {
    const accessToken = credentials.accessToken;
    if (!accessToken) return false;

    const response = await fetch(`${this.baseUrl}/crm/v3/objects/contacts?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.ok;
  }

  /**
   * Maps Opportunity OS stages to HubSpot deal stages.
   */
  private mapStageToHubspot(stage: string): string {
    const mapping: Record<string, string> = {
      new: 'appointmentscheduled',
      targeted: 'appointmentscheduled',
      outreach_sent: 'qualifiedtobuy',
      conversation_started: 'presentationscheduled',
      interviewing: 'decisionmakerboughtin',
      awaiting_decision: 'contractsent',
      closed_won: 'closedwon',
      closed_lost: 'closedlost',
    };

    return mapping[stage] || 'appointmentscheduled';
  }
}
