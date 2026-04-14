// Resume generation job definitions

export interface ResumeJob {
  id: string;
  type: 'generate-variant' | 'optimize-content';
  data: any;
}

export class ResumeJobProcessor {
  async process(job: ResumeJob): Promise<void> {
    console.log(`Processing resume job: ${job.type}`);
  }
}
