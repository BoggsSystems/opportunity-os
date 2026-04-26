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
    this.api = new ApiClient(localStorage.getItem('opportunity-os-token'));
  }

  async createImport(
    request: CreateConnectionImportRequest,
    file: File,
    _userId: string
  ): Promise<ConnectionImport> {
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
      
      const result = await this.api.importConnections(file, apiData);
      
      // Map API response to ConnectionImport type
      return {
        id: result.data.id,
        name: result.data.name,
        ...(result.data.description && { description: result.data.description }),
        source: request.source,
        status: result.data.status as ImportStatus,
        totalRecords: result.data.totalRecords,
        importedRecords: result.data.successfulImports,
        duplicateRecords: result.data.duplicateRecords,
        failedRecords: result.data.failedRecords,
        userId: _userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errors: []
      } as ConnectionImport;
    } catch (error) {
      throw new Error(`Failed to create import: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['text/csv', 'application/json', 'text/plain'];

    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 10MB' };
    }

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
      return { isValid: false, error: 'Only CSV and JSON files are supported' };
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
