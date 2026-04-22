export interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  burstSize?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface ProviderConfigSchema {
  type: 'object';
  properties: Record<string, any>;
  required: string[];
  additionalProperties?: boolean;
}

export interface ICapabilityProvider {
  // Core provider information
  readonly providerName: string;
  readonly displayName: string;
  readonly capabilityType: string;
  readonly authType: 'oauth2' | 'api_key' | 'basic' | 'custom';
  
  // Configuration
  readonly requiredScopes: string[];
  readonly rateLimits: RateLimitConfig;
  readonly configSchema: ProviderConfigSchema;
  
  // Core operations
  initialize(config: any): Promise<void>;
  validateCredentials(credentials: any): Promise<boolean>;
  execute(operation: string, parameters: any, context?: any): Promise<any>;
  
  // Lifecycle operations
  connect(credentials: any): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  
  // Sync operations
  sync(cursor?: string, options?: SyncOptions): Promise<SyncResult>;
  getSyncStatus(): Promise<SyncStatus>;
  
  // Rate limiting
  checkRateLimit(): Promise<RateLimitStatus>;
  waitForRateLimit(): Promise<void>;
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  details?: any;
  responseTime?: number;
}

export interface SyncOptions {
  fullSync?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  batchSize?: number;
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  nextCursor?: string;
  hasMore: boolean;
  errors?: string[];
  duration: number;
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error' | 'paused';
  lastSyncAt?: Date;
  lastSuccessfulSyncAt?: Date;
  nextSyncAt?: Date;
  itemsSynced: number;
  errorMessage?: string;
  progress?: number;
}

export interface RateLimitStatus {
  remaining: number;
  resetTime: Date;
  isLimited: boolean;
  retryAfter?: number;
}

export interface ExecutionContext {
  userId: string;
  connectorId: string;
  requestId?: string;
  correlationId?: string;
  startTime: Date;
  metadata?: Record<string, any>;
}
