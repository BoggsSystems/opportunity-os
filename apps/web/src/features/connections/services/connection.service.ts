import { 
  ConnectionImport, 
  ConnectionRecord, 
  CreateConnectionImportRequest,
  ImportPreview,
  ImportProgress,
  ImportStatus
} from '../types/connection.types';

const API_BASE = '/api/connections';

class ConnectionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env['NEXT_PUBLIC_API_URL'] || '';
  }

  async createImport(
    request: CreateConnectionImportRequest,
    file: File,
    userId: string
  ): Promise<ConnectionImport> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', request.source);
    formData.append('name', request.name);
    formData.append('userId', userId);

    if (request.description) {
      formData.append('description', request.description);
    }

    if (request.tags) {
      formData.append('tags', JSON.stringify(request.tags));
    }

    if (request.autoSegment !== undefined) {
      formData.append('autoSegment', request.autoSegment.toString());
    }

    if (request.customSegments) {
      formData.append('customSegments', JSON.stringify(request.customSegments));
    }

    const response = await fetch(`${this.baseUrl}${API_BASE}/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to create import: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getImports(userId: string, status?: ImportStatus): Promise<ConnectionImport[]> {
    const params = new URLSearchParams({ userId });
    if (status) {
      params.append('status', status);
    }

    const response = await fetch(`${this.baseUrl}${API_BASE}/imports?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch imports: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getImport(importId: string): Promise<ConnectionImport> {
    const response = await fetch(`${this.baseUrl}${API_BASE}/imports/${importId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch import: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getImportConnections(importId: string): Promise<ConnectionRecord[]> {
    const response = await fetch(`${this.baseUrl}${API_BASE}/imports/${importId}/connections`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch connections: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
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
