// AI job definitions

export interface AiJob {
  id: string;
  type: 'text-generation' | 'analysis' | 'summarization';
  data: any;
}

export class AiJobProcessor {
  async process(job: AiJob): Promise<void> {
    console.log(`Processing AI job: ${job.type}`);
  }
}
