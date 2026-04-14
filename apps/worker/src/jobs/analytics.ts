// Analytics job definitions

export interface AnalyticsJob {
  id: string;
  type: 'rollup-metrics' | 'generate-report' | 'calculate-kpis';
  data: any;
}

export class AnalyticsJobProcessor {
  async process(job: AnalyticsJob): Promise<void> {
    console.log(`Processing analytics job: ${job.type}`);
  }
}
