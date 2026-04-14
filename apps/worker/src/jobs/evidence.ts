// Evidence collection job definitions

export interface EvidenceJob {
  id: string;
  type: 'collect-evidence' | 'analyze-evidence';
  data: any;
}

export class EvidenceJobProcessor {
  async process(job: EvidenceJob): Promise<void> {
    console.log(`Processing evidence job: ${job.type}`);
  }
}
