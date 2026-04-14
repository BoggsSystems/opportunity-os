// AI usage tracking and cost management

export interface UsageRecord {
  id: string;
  userId: string;
  model: string;
  tokensUsed: number;
  cost: number;
  timestamp: Date;
  type: string;
}

export class UsageTracker {
  private records: UsageRecord[] = [];

  track(record: Omit<UsageRecord, 'id' | 'timestamp'>): void {
    this.records.push({
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    });
  }

  getTotalCost(userId: string, period?: { start: Date; end: Date }): number {
    let filtered = this.records.filter(r => r.userId === userId);
    
    if (period) {
      filtered = filtered.filter(r => 
        r.timestamp >= period.start && r.timestamp <= period.end
      );
    }
    
    return filtered.reduce((sum, r) => sum + r.cost, 0);
  }

  getTotalTokens(userId: string, period?: { start: Date; end: Date }): number {
    let filtered = this.records.filter(r => r.userId === userId);
    
    if (period) {
      filtered = filtered.filter(r => 
        r.timestamp >= period.start && r.timestamp <= period.end
      );
    }
    
    return filtered.reduce((sum, r) => sum + r.tokensUsed, 0);
  }
}
