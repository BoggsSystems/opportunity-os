import { Injectable } from '@nestjs/common';
import {
  StorageConnectorCredentials,
  StorageProvider,
  SyncedFile,
} from './storage-provider.interface';

@Injectable()
export class DropboxProvider implements StorageProvider {
  readonly providerName = 'dropbox' as const;

  async listFiles(credentials: StorageConnectorCredentials, options?: { folderId?: string }): Promise<SyncedFile[]> {
    const accessToken = this.requireAccessToken(credentials);
    
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: options?.folderId || '',
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
      }),
    });

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Dropbox list failed', response.status, payload));
    }

    return (payload?.entries ?? [])
      .filter((entry: any) => entry['.tag'] === 'file')
      .map((entry: any) => ({
        externalId: entry.id,
        displayName: entry.name,
        fileName: entry.name,
        mimeType: this.getMimeType(entry.name),
        sizeBytes: entry.size,
        webViewLink: `https://www.dropbox.com/home${entry.path_display}`,
        versionToken: entry.rev,
        modifiedAt: new Date(entry.client_modified || entry.server_modified),
      }));
  }

  async searchFiles(credentials: StorageConnectorCredentials, query: string): Promise<SyncedFile[]> {
    const accessToken = this.requireAccessToken(credentials);
    
    const response = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        options: {
          max_results: 20,
          file_status: 'active',
          filename_only: true
        }
      }),
    });

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Dropbox search failed', response.status, payload));
    }

    return (payload?.matches ?? [])
      .filter((match: any) => match.metadata?.metadata?.['.tag'] === 'file')
      .map((match: any) => {
        const entry = match.metadata.metadata;
        return {
          externalId: entry.id,
          displayName: entry.name,
          fileName: entry.name,
          mimeType: this.getMimeType(entry.name),
          sizeBytes: entry.size,
          webViewLink: `https://www.dropbox.com/home${entry.path_display}`,
          versionToken: entry.rev,
          modifiedAt: new Date(entry.client_modified || entry.server_modified),
        };
      });
  }

  async downloadFile(credentials: StorageConnectorCredentials, externalId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const accessToken = this.requireAccessToken(credentials);
    
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: externalId }),
      },
    });

    if (!response.ok) {
      const payload = await this.readJson(response);
      throw new Error(this.errorMessage('Dropbox download failed', response.status, payload));
    }

    const metaHeader = response.headers.get('dropbox-api-result');
    const meta = metaHeader ? JSON.parse(metaHeader) : {};
    
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: meta.name || 'dropbox-file',
      mimeType: this.getMimeType(meta.name || ''),
    };
  }

  async peekFile(credentials: StorageConnectorCredentials, externalId: string, rangeBytes: number = 1024): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const accessToken = this.requireAccessToken(credentials);
    
    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: externalId }),
        Range: `bytes=0-${rangeBytes}`
      },
    });

    if (!response.ok && response.status !== 206) {
      return { buffer: Buffer.alloc(0), fileName: '', mimeType: 'application/octet-stream' };
    }

    const metaHeader = response.headers.get('dropbox-api-result');
    const meta = metaHeader ? JSON.parse(metaHeader) : {};
    
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      fileName: meta.name || 'dropbox-file',
      mimeType: this.getMimeType(meta.name || ''),
    };
  }

  async test(credentials: StorageConnectorCredentials) {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Dropbox connector test failed', response.status, payload));
    }
    return { ok: true, rawResponse: payload };
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt': return 'text/plain';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      default: return 'application/octet-stream';
    }
  }

  private requireAccessToken(credentials: StorageConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('Dropbox connector is missing an access token');
    }
    return credentials.accessToken;
  }

  private async readJson(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private errorMessage(prefix: string, status: number, payload: any) {
    const detail = payload?.error_summary ?? JSON.stringify(payload);
    return `${prefix}: ${status}${detail ? ` ${detail}` : ''}`;
  }
}
