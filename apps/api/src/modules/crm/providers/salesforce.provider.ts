import { Injectable, Logger } from '@nestjs/common';
import { Person, Opportunity, Activity } from '@opportunity-os/db';
import { CrmProvider } from '../interfaces/crm-provider.interface';

@Injectable()
export class SalesforceProvider implements CrmProvider {
  name = 'salesforce';
  private readonly logger = new Logger(SalesforceProvider.name);
  private readonly apiVersion = 'v60.0';

  /**
   * Upserts a contact in Salesforce.
   */
  async upsertContact(person: Person, credentials: any): Promise<string> {
    const { accessToken, instanceUrl } = credentials;
    if (!accessToken || !instanceUrl) throw new Error('Missing Salesforce credentials');

    this.logger.log(`Upserting contact in Salesforce: ${person.email}`);

    // 1. Search for existing contact by email
    const query = `SELECT Id FROM Contact WHERE Email = '${person.email}' LIMIT 1`;
    const searchResponse = await fetch(`${instanceUrl}/services/data/${this.apiVersion}/query?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Salesforce Search Error: ${searchResponse.status} - ${error}`);
    }

    const searchData = (await searchResponse.json()) as any;
    const existingContact = searchData.records?.[0];

    const body = {
      FirstName: person.firstName || person.fullName?.split(' ')[0] || '',
      LastName: person.lastName || person.fullName?.split(' ').slice(1).join(' ') || 'Unknown',
      Email: person.email,
      Title: person.title || '',
    };

    if (existingContact) {
      // Update
      const updateResponse = await fetch(`${instanceUrl}/services/data/${this.apiVersion}/sobjects/Contact/${existingContact.Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!updateResponse.ok) {
        throw new Error(`Salesforce Update Error: ${updateResponse.status}`);
      }

      return existingContact.Id;
    } else {
      // Create
      const createResponse = await fetch(`${instanceUrl}/services/data/${this.apiVersion}/sobjects/Contact`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Salesforce Create Error: ${createResponse.status} - ${error}`);
      }

      const createData = (await createResponse.json()) as any;
      return createData.id;
    }
  }

  /**
   * Creates an opportunity in Salesforce.
   */
  async createDeal(opportunity: Opportunity, credentials: any): Promise<string> {
    const { accessToken, instanceUrl } = credentials;
    if (!accessToken || !instanceUrl) throw new Error('Missing Salesforce credentials');

    this.logger.log(`Creating opportunity in Salesforce: ${opportunity.title}`);

    const body = {
      Name: opportunity.title,
      Amount: opportunity.value || 0,
      StageName: this.mapStageToSalesforce(opportunity.stage),
      CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 30 days from now
      Description: opportunity.summary || '',
    };

    const response = await fetch(`${instanceUrl}/services/data/${this.apiVersion}/sobjects/Opportunity`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce Opportunity Error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    return data.id;
  }

  /**
   * Pushes an activity as a Task in Salesforce.
   */
  async pushMessage(activity: Activity, credentials: any): Promise<void> {
    const { accessToken, instanceUrl } = credentials;
    if (!accessToken || !instanceUrl) throw new Error('Missing Salesforce credentials');

    this.logger.log(`Pushing activity to Salesforce Task: ${activity.activityType}`);

    const body = {
      Subject: activity.subject,
      Description: activity.bodySummary || '',
      Status: 'Completed',
      Priority: 'Normal',
      ActivityDate: activity.occurredAt.toISOString().split('T')[0],
      TaskSubtype: this.mapActivityToSubtype(activity.activityType),
    };

    const response = await fetch(`${instanceUrl}/services/data/${this.apiVersion}/sobjects/Task`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.error(`Salesforce Task Error: ${response.status}`);
    }
  }

  /**
   * Verifies the Salesforce connection.
   */
  async testConnection(credentials: any): Promise<boolean> {
    const { accessToken, instanceUrl } = credentials;
    if (!accessToken || !instanceUrl) return false;

    const response = await fetch(`${instanceUrl}/services/data/${this.apiVersion}/limits`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.ok;
  }

  /**
   * Maps Opportunity OS stages to Salesforce opportunity stages.
   */
  private mapStageToSalesforce(stage: string): string {
    const mapping: Record<string, string> = {
      new: 'Prospecting',
      targeted: 'Qualification',
      outreach_sent: 'Needs Analysis',
      conversation_started: 'Value Proposition',
      interviewing: 'Id. Decision Makers',
      awaiting_decision: 'Proposal/Price Quote',
      closed_won: 'Closed Won',
      closed_lost: 'Closed Lost',
    };

    return mapping[stage] || 'Prospecting';
  }

  /**
   * Maps activity types to Salesforce TaskSubtype.
   */
  private mapActivityToSubtype(type: string): string {
    if (type.includes('email')) return 'Email';
    if (type.includes('call')) return 'Call';
    return 'Task';
  }
}
