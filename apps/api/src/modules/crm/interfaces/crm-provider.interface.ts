import { Person, Opportunity, Activity } from '@opportunity-os/db';

export interface CrmProvider {
  name: string;
  
  /**
   * Upserts a contact in the external CRM.
   * Returns the remote ID of the contact.
   */
  upsertContact(person: Person, credentials: any): Promise<string>;

  /**
   * Creates or updates a deal/opportunity in the external CRM.
   * Returns the remote ID of the deal.
   */
  createDeal(opportunity: Opportunity, credentials: any): Promise<string>;

  /**
   * Pushes an interaction (email, call, etc.) to the external CRM.
   */
  pushMessage(activity: Activity, credentials: any): Promise<void>;

  /**
   * Verifies if the connection to the external CRM is valid.
   */
  testConnection(credentials: any): Promise<boolean>;
}
