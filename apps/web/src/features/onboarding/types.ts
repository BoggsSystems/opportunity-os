export interface StrategicDraft {
  posture: {
    text: string;
    objectives: string[];
    preferredTone: string;
  };
  offerings: Array<{
    title: string;
    description: string;
    type: string;
  }>;
  theses: Array<{
    title: string;
    content: string;
    tags: string[];
  }>;
}

export interface IngestZipResult {
  importId: string;
  strategicDraft: StrategicDraft;
}
