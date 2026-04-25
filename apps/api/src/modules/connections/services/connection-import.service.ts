import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateConnectionImportDto, ImportSource, ImportStatus } from '../dto/create-connection-import.dto';
import { ConnectionImportDto } from '../dto/connection-import.dto';
// import { ConnectionRecordDto } from '../dto/connection-record.dto'; // Not used yet

// Temporarily using in-memory storage until Prisma is integrated
interface ConnectionImportData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  source: ImportSource;
  status: ImportStatus;
  totalRecords: number;
  importedRecords: number;
  duplicateRecords: number;
  failedRecords: number;
  tags?: string[];
  errors?: any[];
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface ConnectionRecordData {
  id: string;
  importBatchId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  company?: string;
  position?: string;
  industry?: string;
  location?: string;
  connectionLevel?: string;
  notes?: string;
  tags?: string[];
  isDuplicate: boolean;
  originalRow: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConnectionImportService {
  private readonly logger = new Logger(ConnectionImportService.name);
  private readonly imports = new Map<string, ConnectionImportData>();
  private readonly connections = new Map<string, ConnectionRecordData[]>();

  async createImport(createImportDto: CreateConnectionImportDto, userId: string): Promise<ConnectionImportDto> {
    this.logger.log(`Creating connection import for user: ${userId}`);

    const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const importData: ConnectionImportData = {
      id: importId,
      userId,
      name: createImportDto.name,
      description: createImportDto.description,
      source: createImportDto.source,
      status: ImportStatus.PENDING,
      totalRecords: 0,
      importedRecords: 0,
      duplicateRecords: 0,
      failedRecords: 0,
      tags: createImportDto.tags,
      createdAt: now,
      updatedAt: now,
    };

    this.imports.set(importId, importData);
    this.logger.log(`Connection import created: ${importId}`);

    return this.mapToDto(importData);
  }

  async getImport(importId: string): Promise<ConnectionImportDto> {
    const importData = this.imports.get(importId);
    if (!importData) {
      throw new NotFoundException(`Connection import not found: ${importId}`);
    }

    return this.mapToDto(importData);
  }

  async getImports(userId: string, status?: ImportStatus): Promise<ConnectionImportDto[]> {
    const userImports = Array.from(this.imports.values())
      .filter(imp => imp.userId === userId)
      .filter(imp => !status || imp.status === status);

    return userImports.map(imp => this.mapToDto(imp));
  }

  async updateImportStatus(importId: string, status: ImportStatus, metadata?: any): Promise<ConnectionImportDto> {
    const importData = this.imports.get(importId);
    if (!importData) {
      throw new NotFoundException(`Connection import not found: ${importId}`);
    }

    importData.status = status;
    importData.updatedAt = new Date();

    if (status === ImportStatus.PROCESSING && !importData.startedAt) {
      importData.startedAt = new Date();
    }

    if (status === ImportStatus.COMPLETED && !importData.completedAt) {
      importData.completedAt = new Date();
    }

    if (metadata) {
      Object.assign(importData, metadata);
    }

    this.imports.set(importId, importData);
    this.logger.log(`Connection import status updated: ${importId} -> ${status}`);

    return this.mapToDto(importData);
  }

  async processImportFile(importId: string, fileData: any[]): Promise<ConnectionImportDto> {
    this.logger.log(`Processing import file for: ${importId}`);

    const importData = this.imports.get(importId);
    if (!importData) {
      throw new NotFoundException(`Connection import not found: ${importId}`);
    }

    try {
      // Update status to processing
      await this.updateImportStatus(importId, ImportStatus.PROCESSING);

      const connections: ConnectionRecordData[] = [];
      let duplicateCount = 0;
      let failedCount = 0;
      const errors: any[] = [];

      // Process each row
      for (let i = 0; i < fileData.length; i++) {
        try {
          const row = fileData[i];
          const connection = this.parseConnectionRow(row, importId, i + 1);
          
          // Check for duplicates (simplified check)
          const isDuplicate = await this.checkForDuplicate(connection);
          if (isDuplicate) {
            duplicateCount++;
            connection.isDuplicate = true;
          }

          connections.push(connection);
        } catch (error) {
          failedCount++;
          errors.push({
            row: i + 1,
            field: 'general',
            error: error instanceof Error ? error.message : 'Unknown error',
            data: fileData[i],
          });
        }
      }

      // Store connections
      this.connections.set(importId, connections);

      // Update import with results
      await this.updateImportStatus(importId, ImportStatus.COMPLETED, {
        totalRecords: fileData.length,
        importedRecords: connections.length - duplicateCount,
        duplicateRecords: duplicateCount,
        failedRecords: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      });

      this.logger.log(`Import processing completed: ${importId}`);
      return this.mapToDto(this.imports.get(importId)!);

    } catch (error) {
      this.logger.error(`Failed to process import ${importId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.updateImportStatus(importId, ImportStatus.FAILED, {
        errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
      });
      throw error;
    }
  }

  private parseConnectionRow(row: any, importId: string, rowNum: number): ConnectionRecordData {
    return {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      importBatchId: importId,
      firstName: row.firstName || row['First Name'] || '',
      lastName: row.lastName || row['Last Name'] || '',
      email: row.email || row.Email,
      phone: row.phone || row.Phone,
      linkedinUrl: row.linkedinUrl || row['LinkedIn URL'],
      company: row.company || row.Company,
      position: row.position || row.Position,
      industry: row.industry || row.Industry,
      location: row.location || row.Location,
      connectionLevel: row.connectionLevel || row['Connection Level'],
      notes: row.notes || row.Notes,
      tags: row.tags ? (Array.isArray(row.tags) ? row.tags : row.tags.split(',').map((t: string) => t.trim())) : [],
      isDuplicate: false,
      originalRow: rowNum,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async checkForDuplicate(connection: ConnectionRecordData): Promise<boolean> {
    // Simplified duplicate check - in real implementation, this would check against existing connections
    const allConnections = Array.from(this.connections.values()).flat();
    return allConnections.some(existing => 
      existing.email === connection.email && 
      existing.firstName.toLowerCase() === connection.firstName.toLowerCase() &&
      existing.lastName.toLowerCase() === connection.lastName.toLowerCase()
    );
  }

  private mapToDto(importData: ConnectionImportData): ConnectionImportDto {
    return {
      id: importData.id,
      userId: importData.userId,
      name: importData.name,
      description: importData.description,
      source: importData.source,
      status: importData.status,
      totalRecords: importData.totalRecords,
      importedRecords: importData.importedRecords,
      duplicateRecords: importData.duplicateRecords,
      failedRecords: importData.failedRecords,
      tags: importData.tags,
      errors: importData.errors,
      createdAt: importData.createdAt,
      updatedAt: importData.updatedAt,
      startedAt: importData.startedAt,
      completedAt: importData.completedAt,
    };
  }
}
