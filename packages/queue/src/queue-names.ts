export const QUEUE_NAMES = {
  DISCOVERY_SCAN: 'discovery-scan',
  AI_TASKS: 'ai-tasks',
  RESUME_GENERATION: 'resume-generation',
  REPO_ANALYSIS: 'repo-analysis',
  OUTREACH_SEQUENCE: 'outreach-sequence',
  ANALYTICS_ROLLUP: 'analytics-rollup',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
