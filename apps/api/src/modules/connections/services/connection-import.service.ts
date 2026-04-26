import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateConnectionImportDto, ImportSource, ImportStatus } from '../dto/create-connection-import.dto';
import { ConnectionImportDto } from '../dto/connection-import.dto';
import { ImportGateway } from '../../../websocket/import.gateway';
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

  constructor(private readonly importGateway: ImportGateway) {}

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

      // Process each row with LinkedIn-specific validation
      this.logger.log(`🔄 PROCESSING ${fileData.length} ROWS FOR LINKEDIN IMPORT`);
      
      for (let i = 0; i < fileData.length; i++) {
        try {
          const row = fileData[i];
          const connection = this.parseConnectionRow(row, importId, i + 1);
          
          // LinkedIn validation: require names but email is optional
          if (!connection.firstName || !connection.firstName.trim() || 
              !connection.lastName || !connection.lastName.trim()) {
            failedCount++;
            errors.push({
              row: i + 1,
              field: 'name',
              error: 'Missing required name fields (First Name and Last Name)',
              data: fileData[i],
            });
            continue;
          }
          
          // Check for duplicates (enhanced check)
          const isDuplicate = await this.checkForDuplicate(connection);
          if (isDuplicate) {
            duplicateCount++;
            connection.isDuplicate = true;
            this.logger.log(`🔄 DUPLICATE FOUND: ${connection.firstName} ${connection.lastName}`);
          }

          connections.push(connection);
          
          // Send WebSocket progress update every 50 records or 10% of total
          const progressInterval = Math.max(50, Math.floor(fileData.length * 0.1));
          if ((i + 1) % progressInterval === 0 || i === fileData.length - 1) {
            const percentage = ((i + 1) / fileData.length) * 100;
            this.importGateway.sendImportProgress(importId, {
              status: 'PROCESSING',
              totalRecords: fileData.length,
              processedRecords: i + 1,
              importedRecords: connections.length - duplicateCount,
              duplicateRecords: duplicateCount,
              failedRecords: failedCount,
              percentage: Math.round(percentage),
              message: `Processed ${i + 1} of ${fileData.length} records...`
            });
          }
          
          // Log progress for every 100 records
          if ((i + 1) % 100 === 0) {
            this.logger.log(`📈 PROCESSED ${i + 1}/${fileData.length} RECORDS`);
          }
          
        } catch (error) {
          failedCount++;
          errors.push({
            row: i + 1,
            field: 'general',
            error: error instanceof Error ? error.message : 'Unknown error',
            data: fileData[i],
          });
          this.logger.error(`❌ FAILED TO PROCESS ROW ${i + 1}:`, error);
        }
      }

      // Store connections
      this.connections.set(importId, connections);

      // Update import with results
      const finalImportData = await this.updateImportStatus(importId, ImportStatus.COMPLETED, {
        totalRecords: fileData.length,
        importedRecords: connections.length - duplicateCount,
        duplicateRecords: duplicateCount,
        failedRecords: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      });

      // Send WebSocket completion event
      this.importGateway.sendImportCompletion(importId, {
        status: 'COMPLETED',
        totalRecords: fileData.length,
        importedRecords: connections.length - duplicateCount,
        duplicateRecords: duplicateCount,
        failedRecords: failedCount,
        duration: Date.now() - new Date(finalImportData.startedAt!).getTime(),
      });

      this.logger.log(`Import processing completed: ${importId}`);
      return this.mapToDto(this.imports.get(importId)!);

    } catch (error) {
      this.logger.error(`Failed to process import ${importId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Send WebSocket error event
      this.importGateway.sendImportError(importId, {
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      });
      
      await this.updateImportStatus(importId, ImportStatus.FAILED, {
        errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
      });
      throw error;
    }
  }

  private parseConnectionRow(row: any, importId: string, rowNum: number): ConnectionRecordData {
    this.logger.log(`🔍 LINKEDIN ROW PARSING:`, { rowNum, rawRow: row });
    
    // LinkedIn-specific field mapping
    const firstName = row['First Name'] || row['FirstName'] || row['First'] || '';
    const lastName = row['Last Name'] || row['LastName'] || row['Last'] || '';
    const email = row['Email Address'] || row['Email'] || row['email'] || '';
    const linkedinUrl = row['URL'] || row['LinkedIn URL'] || row['linkedinUrl'] || '';
    const company = row['Company'] || row['company'] || '';
    const position = row['Position'] || row['position'] || '';
    const connectedOn = row['Connected On'] || row['ConnectedOn'] || '';
    
    const connection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      importBatchId: importId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: row['Phone'] || row['phone'] || '',
      linkedinUrl: linkedinUrl.trim(),
      company: company.trim(),
      position: position.trim(),
      industry: row['Industry'] || row['industry'] || '',
      location: row['Location'] || row['location'] || '',
      connectionLevel: row['Connection Level'] || row['connectionLevel'] || '',
      notes: connectedOn ? `Connected on ${connectedOn}` : '',
      tags: row['tags'] ? (Array.isArray(row['tags']) ? row['tags'] : row['tags'].split(',').map((t: string) => t.trim())) : [],
      isDuplicate: false,
      originalRow: rowNum,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Log parsing results for first few records
    if (rowNum <= 3) {
      this.logger.log(`✅ PARSED CONNECTION ${rowNum}:`, {
        firstName: connection.firstName,
        lastName: connection.lastName,
        email: connection.email,
        company: connection.company,
        position: connection.position,
        hasRequiredFields: !!(connection.firstName && connection.lastName)
      });
    }
    
    return connection;
  }

  private async checkForDuplicate(connection: ConnectionRecordData): Promise<boolean> {
    // Enhanced duplicate detection for LinkedIn connections
    const allConnections = Array.from(this.connections.values()).flat();
    
    // Primary check: Email match (most reliable)
    if (connection.email) {
      const emailMatch = allConnections.some(existing => 
        existing.email === connection.email
      );
      if (emailMatch) {
        this.logger.log(`🔄 DUPLICATE BY EMAIL: ${connection.email}`);
        return true;
      }
    }
    
    // Secondary check: Name + Company match
    const nameCompanyMatch = allConnections.some(existing => 
      existing.firstName.toLowerCase() === connection.firstName.toLowerCase() &&
      existing.lastName.toLowerCase() === connection.lastName.toLowerCase() &&
      existing.company && connection.company &&
      existing.company.toLowerCase() === connection.company.toLowerCase()
    );
    if (nameCompanyMatch) {
      this.logger.log(`🔄 DUPLICATE BY NAME+COMPANY: ${connection.firstName} ${connection.lastName} at ${connection.company}`);
      return true;
    }
    
    // Tertiary check: Name + LinkedIn URL match
    if (connection.linkedinUrl) {
      const linkedinMatch = allConnections.some(existing => 
        existing.firstName.toLowerCase() === connection.firstName.toLowerCase() &&
        existing.lastName.toLowerCase() === connection.lastName.toLowerCase() &&
        existing.linkedinUrl === connection.linkedinUrl
      );
      if (linkedinMatch) {
        this.logger.log(`🔄 DUPLICATE BY NAME+LINKEDIN: ${connection.firstName} ${connection.lastName}`);
        return true;
      }
    }
    
    // Final check: Name only (less reliable, but better than missing duplicates)
    const nameMatch = allConnections.some(existing => 
      existing.firstName.toLowerCase() === connection.firstName.toLowerCase() &&
      existing.lastName.toLowerCase() === connection.lastName.toLowerCase() &&
      !existing.email && !connection.email // Only match by name if both have no email
    );
    if (nameMatch) {
      this.logger.log(`🔄 DUPLICATE BY NAME ONLY: ${connection.firstName} ${connection.lastName}`);
      return true;
    }
    
    return false;
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
