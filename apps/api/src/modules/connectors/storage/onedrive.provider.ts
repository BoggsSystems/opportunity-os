import { Injectable } from '@nestjs/common';
import {
  StorageConnectorCredentials,
  StorageProvider,
  SyncedFile,
} from './storage-provider.interface';

@Injectable()
export class OneDriveProvider implements StorageProvider {
  readonly providerName = 'onedrive' as const;

  async listFiles(credentials: StorageConnectorCredentials, options?: { folderId?: string }): Promise<SyncedFile[]> {
    const accessToken = this.requireAccessToken(credentials);
    const endpoint = options?.folderId 
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(options.folderId)}/children`
      : `https://graph.microsoft.com/v1.0/me/drive/root/children`;

    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('OneDrive list failed', response.status, payload));
    }

    return (payload?.value ?? [])
      .filter((item: any) => item.file) // Only include files, not folders
      .map((item: any) => ({
        externalId: item.id,
        displayName: item.name,
        fileName: item.name,
        mimeType: item.file.mimeType,
        sizeBytes: item.size,
        webViewLink: item.webUrl,
        versionToken: item.eTag,
        modifiedAt: new Date(item.lastModifiedDateTime),
      }));
  }

  async downloadFile(credentials: StorageConnectorCredentials, externalId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const accessToken = this.requireAccessToken(credentials);
    
    // Get metadata first
    const metaResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meta = await this.readJson(metaResponse);
    if (!metaResponse.ok) {
      throw new Error(this.errorMessage('OneDrive metadata fetch failed', metaResponse.status, meta));
    }

    // Get content
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(externalId)}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const payload = await this.readJson(response);
      throw new Error(this.errorMessage('OneDrive download failed', response.status, payload));
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: meta.name,
      mimeType: meta.file.mimeType,
    };
  }

  async peekFile(credentials: StorageConnectorCredentials, externalId: string, rangeBytes: number = 1024): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const accessToken = this.requireAccessToken(credentials);
    
    const metaResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meta = await this.readJson(metaResponse);
    if (!metaResponse.ok) return { buffer: Buffer.alloc(0), fileName: '', mimeType: '' };

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(externalId)}/content`, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        Range: `bytes=0-${rangeBytes}` 
      },
    });

    if (!response.ok) return { buffer: Buffer.alloc(0), fileName: meta.name, mimeType: meta.file.mimeType };

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: meta.name,
      mimeType: meta.file.mimeType,
    };
  }

  async test(credentials: StorageConnectorCredentials) {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('OneDrive connector test failed', response.status, payload));
    }
    return { ok: true, rawResponse: payload };
  }

  private requireAccessToken(credentials: StorageConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('OneDrive connector is missing an access token');
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
