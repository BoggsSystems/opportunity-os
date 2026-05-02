export interface StorageConnectorCredentials {
  accessToken: string;
}

export interface SyncedFile {
  externalId: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink?: string;
  versionToken?: string;
  modifiedAt: Date;
}

export interface StorageProvider {
  readonly providerName: string;
  listFiles(credentials: StorageConnectorCredentials, options?: { folderId?: string }): Promise<SyncedFile[]>;
  downloadFile(credentials: StorageConnectorCredentials, externalId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }>;
  peekFile(credentials: StorageConnectorCredentials, externalId: string, rangeBytes?: number): Promise<{ buffer: Buffer; fileName: string; mimeType: string }>;
  test(credentials: StorageConnectorCredentials): Promise<{ ok: boolean; rawResponse?: any }>;
}
