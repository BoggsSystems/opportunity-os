// Discovery job definitions

export interface DiscoveryJob {
  id: string;
  type: 'domain-scan' | 'company-research' | 'opportunity-finding';
  data: any;
}

export class DiscoveryJobProcessor {
  async process(job: DiscoveryJob): Promise<void> {
    // Placeholder implementation
    console.log(`Processing discovery job: ${job.type}`);
  }
}
