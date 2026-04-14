// Outreach job definitions

export interface OutreachJob {
  id: string;
  type: 'send-email' | 'schedule-followup' | 'update-sequence';
  data: any;
}

export class OutreachJobProcessor {
  async process(job: OutreachJob): Promise<void> {
    console.log(`Processing outreach job: ${job.type}`);
  }
}
