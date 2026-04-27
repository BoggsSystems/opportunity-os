import { 
  ConnectionImport, 
  ConnectionRecord, 
  CreateConnectionImportRequest,
  ImportPreview,
  ImportProgress,
  ImportStatus
} from '../types/connection.types';
import { ApiClient } from '../../../lib/api';

class ConnectionService {
  private api: ApiClient;

  constructor() {
    console.log('🔍 DEBUG: ConnectionService constructor called');
    this.initializeApiClient();
  }

  private initializeApiClient() {
    console.log('🔍 AUTH DEBUG: Starting API client initialization');
    
    const session = localStorage.getItem('opportunity-os-session');
    console.log('🔍 AUTH DEBUG: Raw session from localStorage:', session ? 'EXISTS' : 'NULL');
    
    if (session) {
      try {
        const parsed = JSON.parse(session);
        console.log('🔍 AUTH DEBUG: Parsed session structure:', {
          hasAccessToken: !!parsed.accessToken,
          accessTokenLength: parsed.accessToken?.length || 0,
          accessTokenPrefix: parsed.accessToken?.substring(0, 20) + '...',
          hasRefreshToken: !!parsed.refreshToken,
          refreshTokenLength: parsed.refreshToken?.length || 0,
          hasUser: !!parsed.user,
          userId: parsed.user?.id,
          userEmail: parsed.user?.email,
          userRole: parsed.user?.role
        });
        
        const token = parsed.accessToken;
        
        if (!token) {
          console.log('🔍 AUTH DEBUG: No access token found in session');
          this.api = new ApiClient(null);
          return;
        }
        
        console.log('🔍 AUTH DEBUG: Creating ApiClient with existing token');
        this.api = new ApiClient(token);
      } catch (error) {
        console.error('🔍 AUTH DEBUG: Failed to parse session:', error);
        this.api = new ApiClient(null);
      }
    } else {
      console.log('🔍 AUTH DEBUG: No session found, creating ApiClient without token');
      this.api = new ApiClient(null);
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      console.log('🔍 AUTH DEBUG: Checking token expiration');
      
      // Check if token has proper JWT structure
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('🔍 AUTH DEBUG: Token does not have JWT structure (3 parts)');
        return true;
      }
      
      console.log('🔍 AUTH DEBUG: Token has JWT structure, decoding payload');
      
      // Simple JWT token expiration check
      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Date.now() / 1000;
      
      console.log('🔍 AUTH DEBUG: Token payload:', {
        exp: payload.exp,
        iat: payload.iat,
        currentTime: currentTime,
        timeUntilExpiry: payload.exp - currentTime,
        isExpired: payload.exp < currentTime,
        expiresAt: new Date(payload.exp * 1000).toISOString()
      });
      
      return payload.exp < currentTime;
    } catch (error) {
      console.error('🔍 AUTH DEBUG: Failed to check token expiration:', error);
      return true; // Assume expired if we can't check
    }
  }

  private async refreshToken(session: any): Promise<void> {
    console.log('🔍 DEBUG: Token refresh requested, but not fully implemented. Keeping session for now to avoid zombie state.');
    // We don't wipe the session here anymore. 
    // Instead, we let the ApiClient handle 401s if the token is truly dead.
    // This prevents the UI from becoming desynced from localStorage.
    this.api = new ApiClient(session.accessToken);
  }

  private ensureValidToken(): boolean {
    console.log('🔍 AUTH DEBUG: Starting token validation');
    
    const session = localStorage.getItem('opportunity-os-session');
    if (!session) {
      console.log('🔍 AUTH DEBUG: No session found in localStorage');
      return false;
    }

    try {
      const parsed = JSON.parse(session);
      const token = parsed.accessToken;
      
      console.log('🔍 AUTH DEBUG: Token validation check:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPrefix: token?.substring(0, 20) + '...'
      });
      
      if (!token) {
        console.log('🔍 AUTH DEBUG: No access token found in session');
        return false;
      }
      
      if (this.isTokenExpired(token)) {
        console.log('🔍 AUTH DEBUG: Token is expired');
        return false;
      }
      
      console.log('🔍 AUTH DEBUG: Token is VALID');
      return true;
    } catch (error) {
      console.error('🔍 AUTH DEBUG: Failed to validate token:', error);
      return false;
    }
  }

  async createImport(
    request: CreateConnectionImportRequest,
    file: File,
    _userId: string
  ): Promise<ConnectionImport> {
    console.log('🔍 DEBUG: createImport called with:', {
      request,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: _userId
    });

    // Check authentication before proceeding
    console.log('🔍 AUTH DEBUG: Checking authentication before import');
    
    const isTokenValid = this.ensureValidToken();
    console.log('🔍 AUTH DEBUG: Token validation result:', isTokenValid);
    
    if (!isTokenValid) {
      console.log('🔍 AUTH DEBUG: Authentication FAILED - token invalid or expired');
      throw new Error('Authentication failed: Access token expired or invalid. Please log in again.');
    }

    console.log('🔍 AUTH DEBUG: Authentication PASSED, re-initializing API client');
    // Re-initialize API client with fresh token
    this.initializeApiClient();
    
    console.log('🔍 AUTH DEBUG: API client re-initialized, proceeding with import');
    
    try {
      const apiData: any = {
        name: request.name,
        source: request.source.toString(),
      };
      
      if (request.description) {
        apiData.description = request.description;
      }
      
      if (request.tags) {
        apiData.tags = request.tags;
      }
      
      console.log('🔍 DEBUG: Prepared API data:', apiData);
      console.log('🔍 DEBUG: Calling api.importConnections');
      
      const result = await this.api.importConnections(file, apiData);
      console.log('🔍 DEBUG: API call result:', result);
      console.log('🔍 DEBUG: Response data structure:', {
        dataKeys: Object.keys(result.data || {}),
        data: result.data,
        successfulImports: result.data?.successfulImports,
        totalRecords: result.data?.totalRecords,
        duplicateRecords: result.data?.duplicateRecords,
        failedRecords: result.data?.failedRecords
      });
      
      // Map API response to ConnectionImport type
      const mappedResult = {
        id: result.data.id,
        name: result.data.name,
        ...(result.data.description && { description: result.data.description }),
        source: request.source,
        status: result.data.status as ImportStatus,
        totalRecords: result.data.totalRecords || 0,
        importedRecords: result.data.successfulImports || 0,
        duplicateRecords: result.data.duplicateRecords || 0,
        failedRecords: result.data.failedRecords || 0,
        userId: _userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errors: []
      };
      
      console.log('🔍 DEBUG: Mapped result:', mappedResult);
      return mappedResult as ConnectionImport;
    } catch (error) {
      throw new Error(`Failed to create import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async ingestZip(
    request: { name: string; source: ImportSource },
    file: File
  ): Promise<{ importId: string; strategicDraft: any }> {
    console.log('📦 ConnectionService.ingestZip START', { name: request.name, fileSize: file.size });
    const isTokenValid = this.ensureValidToken();
    console.log('📦 Token valid:', isTokenValid);
    if (!isTokenValid) {
      throw new Error('Authentication failed. Please log in again.');
    }
    this.initializeApiClient();

    try {
      console.log('📦 Calling API.ingestZip...');
      const result = await this.api.ingestZip(file, {
        name: request.name,
        source: request.source.toString(),
      });
      console.log('📦 API.ingestZip SUCCESS:', result);
      return result.data;
    } catch (error) {
      console.error('📦 ConnectionService.ingestZip ERROR:', error);
      throw new Error(`Failed to ingest ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getImports(_userId: string, status?: ImportStatus): Promise<ConnectionImport[]> {
    try {
      const result = await this.api.getConnectionImports(status);
      
      // Map API response to ConnectionImport type
      return result.data.map(item => ({
        id: item.id,
        name: item.name,
        ...(item.description && { description: item.description }),
        source: item.source as any,
        status: item.status as ImportStatus,
        totalRecords: item.totalRecords,
        importedRecords: item.successfulImports,
        duplicateRecords: item.duplicateRecords,
        failedRecords: item.failedRecords,
        userId: _userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        errors: []
      }) as ConnectionImport);
    } catch (error) {
      throw new Error(`Failed to fetch imports: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getImport(importId: string): Promise<ConnectionImport> {
    try {
      const result = await this.api.getConnectionImport(importId);
      
      // Map API response to ConnectionImport type
      return {
        id: result.data.id,
        name: result.data.name,
        ...(result.data.description && { description: result.data.description }),
        source: result.data.source as any,
        status: result.data.status as ImportStatus,
        totalRecords: result.data.totalRecords,
        importedRecords: result.data.successfulImports,
        duplicateRecords: result.data.duplicateRecords,
        failedRecords: result.data.failedRecords,
        userId: 'current-user', // TODO: Get from auth context
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
        startedAt: result.data.startedAt,
        completedAt: result.data.completedAt,
        errors: []
      } as ConnectionImport;
    } catch (error) {
      throw new Error(`Failed to fetch import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getImportConnections(importId: string): Promise<ConnectionRecord[]> {
    try {
      const result = await this.api.getConnectionImportConnections(importId);
      
      // Map API response to ConnectionRecord type
      return result.data.map(item => ({
        id: item.id,
        importBatchId: importId,
        firstName: item.firstName,
        lastName: item.lastName,
        ...(item.email && { email: item.email }),
        ...(item.phone && { phone: item.phone }),
        ...(item.linkedinUrl && { linkedinUrl: item.linkedinUrl }),
        ...(item.company && { company: item.company }),
        ...(item.position && { position: item.position }),
        ...(item.industry && { industry: item.industry }),
        ...(item.location && { location: item.location }),
        ...(item.connectionLevel && { connectionLevel: item.connectionLevel }),
        ...(item.notes && { notes: item.notes }),
        tags: item.tags || [],
        isDuplicate: item.isDuplicate,
        originalRow: item.originalRow,
        createdAt: item.createdAt,
        updatedAt: item.createdAt
      }) as ConnectionRecord);
    } catch (error) {
      throw new Error(`Failed to fetch connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async pollImportProgress(importId: string): Promise<ImportProgress> {
    const importData = await this.getImport(importId);
    
    const percentage = importData.totalRecords > 0 
      ? Math.round((importData.importedRecords + importData.duplicateRecords + importData.failedRecords) / importData.totalRecords * 100)
      : 0;

    const currentStep = this.getCurrentStep(importData.status);

    return {
      status: importData.status,
      totalRecords: importData.totalRecords,
      processedRecords: importData.importedRecords + importData.duplicateRecords + importData.failedRecords,
      percentage,
      currentStep,
      errors: importData.errors || [],
    };
  }

  private getCurrentStep(status: ImportStatus): string {
    switch (status) {
      case ImportStatus.PENDING:
        return 'Preparing import...';
      case ImportStatus.PROCESSING:
        return 'Processing connections...';
      case ImportStatus.COMPLETED:
        return 'Import completed successfully';
      case ImportStatus.FAILED:
        return 'Import failed';
      case ImportStatus.CANCELLED:
        return 'Import cancelled';
      default:
        return 'Unknown status';
    }
  }

  // Helper method to validate file before upload
  validateFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024; // Increased to 50MB for ZIPs
    const allowedTypes = ['text/csv', 'application/json', 'text/plain', 'application/zip', 'application/x-zip-compressed'];

    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 50MB' };
    }

    if (
      !allowedTypes.includes(file.type) && 
      !file.name.endsWith('.csv') && 
      !file.name.endsWith('.json') &&
      !file.name.endsWith('.zip')
    ) {
      return { isValid: false, error: 'Only CSV, JSON, and ZIP files are supported' };
    }

    return { isValid: true };
  }

  // Helper method to parse CSV for preview
  async previewCSVFile(file: File): Promise<ImportPreview> {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
    const previewData = [];

    // Parse first 10 rows for preview
    for (let i = 1; i < Math.min(11, lines.length); i++) {
      const values = lines[i]?.split(',').map(v => v.trim().replace(/"/g, '')) || [];
      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        previewData.push(row);
      }
    }

    // Simple duplicate detection for preview
    const seen = new Set();
    let duplicateCount = 0;

    previewData.forEach(row => {
      const key = `${row.firstName || row['First Name']}|${row.lastName || row['Last Name']}`;
      if (seen.has(key)) {
        duplicateCount++;
      } else {
        seen.add(key);
      }
    });

    return {
      previewData,
      totalRecords: lines.length - 1,
      importableRecords: previewData.length - duplicateCount,
      duplicateRecords: duplicateCount,
    };
  }
}

export const connectionService = new ConnectionService();
