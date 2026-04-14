export interface BaseJob {
  id: string;
  userId: string;
  createdAt: Date;
}

export interface DiscoveryScanJob extends BaseJob {
  type: 'discovery-scan';
  data: {
    domain?: string;
    keywords?: string[];
    depth?: number;
  };
}

export interface AiTaskJob extends BaseJob {
  type: 'ai-task';
  data: {
    task: 'summarize' | 'analyze' | 'generate' | 'classify';
    input: any;
    options?: Record<string, any>;
  };
}

export interface ResumeGenerationJob extends BaseJob {
  type: 'resume-generation';
  data: {
    personId: string;
    template?: string;
    targetRole?: string;
  };
}

export interface RepoAnalysisJob extends BaseJob {
  type: 'repo-analysis';
  data: {
    repoUrl: string;
    analysisType: 'tech-stack' | 'contributors' | 'activity';
  };
}

export interface OutreachSequenceJob extends BaseJob {
  type: 'outreach-sequence';
  data: {
    sequenceId: string;
    personId: string;
    opportunityId?: string;
  };
}

export interface AnalyticsRollupJob extends BaseJob {
  type: 'analytics-rollup';
  data: {
    metric: string;
    period: 'hourly' | 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
  };
}

export type Job = 
  | DiscoveryScanJob
  | AiTaskJob
  | ResumeGenerationJob
  | RepoAnalysisJob
  | OutreachSequenceJob
  | AnalyticsRollupJob;
