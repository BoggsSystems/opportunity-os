import { Injectable } from '@nestjs/common';
import {
  StorageConnectorCredentials,
  StorageProvider,
  SyncedFile,
} from './storage-provider.interface';

@Injectable()
export class GoogleDriveProvider implements StorageProvider {
  readonly providerName = 'google_drive' as const;

  async listFiles(credentials: StorageConnectorCredentials, options?: { folderId?: string }): Promise<SyncedFile[]> {
    const accessToken = this.requireAccessToken(credentials);
    const query = options?.folderId 
      ? `'${options.folderId}' in parents and trashed = false` 
      : "'root' in parents and trashed = false";

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webViewLink,headRevisionId,modifiedTime)`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Google Drive list failed', response.status, payload));
    }

    return (payload?.files ?? []).map((file: any) => ({
      externalId: file.id,
      displayName: file.name,
      fileName: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.size ? Number(file.size) : undefined,
      webViewLink: file.webViewLink,
      versionToken: file.headRevisionId,
      modifiedAt: new Date(file.modifiedTime),
    }));
  }

  async searchFiles(credentials: StorageConnectorCredentials, query: string): Promise<SyncedFile[]> {
    const accessToken = this.requireAccessToken(credentials);
    const driveQuery = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,size,webViewLink,headRevisionId,modifiedTime)&pageSize=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Google Drive search failed', response.status, payload));
    }

    return (payload?.files ?? []).map((file: any) => ({
      externalId: file.id,
      displayName: file.name,
      fileName: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.size ? Number(file.size) : undefined,
      webViewLink: file.webViewLink,
      versionToken: file.headRevisionId,
      modifiedAt: new Date(file.modifiedTime),
    }));
  }

  async downloadFile(credentials: StorageConnectorCredentials, externalId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const accessToken = this.requireAccessToken(credentials);
    
    // First get metadata to know the filename and mimetype
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(externalId)}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const meta = await this.readJson(metaResponse);
    if (!metaResponse.ok) {
      throw new Error(this.errorMessage('Google Drive metadata fetch failed', metaResponse.status, meta));
    }

    // Now get the content
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(externalId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      const payload = await this.readJson(response);
      throw new Error(this.errorMessage('Google Drive download failed', response.status, payload));
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: meta.name,
      mimeType: meta.mimeType,
    };
  }

  async peekFile(credentials: StorageConnectorCredentials, externalId: string, rangeBytes: number = 1024): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const accessToken = this.requireAccessToken(credentials);
    
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(externalId)}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const meta = await this.readJson(metaResponse);
    if (!metaResponse.ok) return { buffer: Buffer.alloc(0), fileName: '', mimeType: '' };

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(externalId)}?alt=media`,
      { 
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          Range: `bytes=0-${rangeBytes}` 
        } 
      },
    );

    if (!response.ok) return { buffer: Buffer.alloc(0), fileName: meta.name, mimeType: meta.mimeType };

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: meta.name,
      mimeType: meta.mimeType,
    };
  }

  async test(credentials: StorageConnectorCredentials) {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Google Drive connector test failed', response.status, payload));
    }
    return { ok: true, rawResponse: payload };
  }

  private requireAccessToken(credentials: StorageConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('Google Drive connector is missing an access token');
    }
    return credentials.accessToken;
  }

  private async readJson(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private errorMessage(prefix: string, status: number, payload: any) {
    const detail = payload?.error?.message ?? payload?.error_description ?? JSON.stringify(payload);
    return `${prefix}: ${status}${detail ? ` ${detail}` : ''}`;
  }
}
