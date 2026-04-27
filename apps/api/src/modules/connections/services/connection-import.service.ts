import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma, ConnectionImportStatus } from '@opportunity-os/db';
import { CreateConnectionImportDto } from '../dto/create-connection-import.dto';
import { ConnectionImportDto } from '../dto/connection-import.dto';

@Injectable()
export class ConnectionImportService {
  private readonly logger = new Logger(ConnectionImportService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async createImport(createImportDto: CreateConnectionImportDto, userId: string): Promise<ConnectionImportDto> {
    this.logger.log(`Creating connection import for user: ${userId}`);

    const batch = await prisma.connectionImportBatch.create({
      data: {
        userId,
        name: createImportDto.name,
        source: createImportDto.source,
        status: ConnectionImportStatus.parsing,
      },
    });

    this.logger.log(`Connection import batch created: ${batch.id}`);

    return this.mapToDto(batch);
  }

  async getImport(importId: string): Promise<ConnectionImportDto> {
    const batch = await prisma.connectionImportBatch.findUnique({
      where: { id: importId },
    });
    
    if (!batch) {
      throw new NotFoundException(`Connection import not found: ${importId}`);
    }

    return this.mapToDto(batch);
  }

  async getImports(userId: string, status?: ConnectionImportStatus): Promise<ConnectionImportDto[]> {
    const batches = await prisma.connectionImportBatch.findMany({
      where: { 
        userId,
        status: status || undefined,
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches.map(batch => this.mapToDto(batch));
  }

  private async updateImportStatus(
    importId: string, 
    status: ConnectionImportStatus, 
    results?: {
      totalRecords?: number;
      importedRecords?: number;
      duplicateRecords?: number;
      failedRecords?: number;
      errors?: any[];
    }
  ): Promise<void> {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };

    if (status === ConnectionImportStatus.processing && !results) {
      updateData.processingStartedAt = new Date();
    }

    if (status === ConnectionImportStatus.completed || status === ConnectionImportStatus.failed) {
      updateData.processingCompletedAt = new Date();
    }

    if (results) {
      if (results.totalRecords !== undefined) updateData.totalRows = results.totalRecords;
      if (results.importedRecords !== undefined) updateData.createdPeopleCount = results.importedRecords;
      if (results.duplicateRecords !== undefined) updateData.duplicateCount = results.duplicateRecords;
      if (results.failedRecords !== undefined) updateData.errorCount = results.failedRecords;
      if (results.errors) updateData.errorMessage = JSON.stringify(results.errors);
    }

    await prisma.connectionImportBatch.update({
      where: { id: importId },
      data: updateData,
    });

    this.logger.log(`Connection import status updated: ${importId} -> ${status}`);
  }

  async processImportFile(importId: string, fileData: any[]): Promise<ConnectionImportDto> {
    this.logger.log(`Processing import file for: ${importId}`);

    const importData = await prisma.connectionImportBatch.findUnique({ where: { id: importId } });
    if (!importData) {
      throw new NotFoundException(`Connection import not found: ${importId}`);
    }

    try {
      // Update status to processing
      await this.updateImportStatus(importId, ConnectionImportStatus.processing);

      const recordsToCreate: any[] = [];
      let duplicateCount = 0;
      let failedCount = 0;
      const errors: any[] = [];

      // Optimize duplicate detection: Build lookup maps from DB
      const allExisting = await prisma.connectionRecord.findMany({
        where: { userId: importData.userId },
        select: { email: true, firstName: true, lastName: true, company: true, linkedinUrl: true }
      });
      
      const emailMap = new Set(allExisting.filter(c => c.email).map(c => c.email!.toLowerCase()));
      const nameCompanyMap = new Set(allExisting.filter(c => c.company).map(c => 
        `${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}|${c.company!.toLowerCase()}`
      ));
      const nameLinkedinMap = new Set(allExisting.filter(c => c.linkedinUrl).map(c => 
        `${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}|${c.linkedinUrl!.toLowerCase()}`
      ));
      const nameOnlyMap = new Set(allExisting.filter(c => !c.email).map(c => 
        `${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}`
      ));

      this.logger.log(`🔄 PROCESSING ${fileData.length} ROWS FOR LINKEDIN IMPORT`);
      
      for (let i = 0; i < fileData.length; i++) {
        // Yield to event loop every 100 records
        if (i > 0 && i % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }

        try {
          const row = fileData[i];
          const record = this.parseConnectionRow(row, importId, i + 1, importData.userId);
          
          if (!record.firstName || !record.lastName) {
            failedCount++;
            errors.push({ row: i + 1, error: 'Missing required name fields' });
            continue;
          }
          
          // Duplicate check
          let isDuplicate = false;
          const firstNameLower = record.firstName.toLowerCase();
          const lastNameLower = record.lastName.toLowerCase();

          if (record.email && emailMap.has(record.email.toLowerCase())) isDuplicate = true;
          else if (record.company && nameCompanyMap.has(`${firstNameLower}|${lastNameLower}|${record.company.toLowerCase()}`)) isDuplicate = true;
          else if (record.linkedinUrl && nameLinkedinMap.has(`${firstNameLower}|${lastNameLower}|${record.linkedinUrl.toLowerCase()}`)) isDuplicate = true;
          else if (!record.email && nameOnlyMap.has(`${firstNameLower}|${lastNameLower}`)) isDuplicate = true;

          if (isDuplicate) {
            duplicateCount++;
            // We still save duplicates but mark them (schema has isDuplicate? No, schema doesn't have isDuplicate. I'll just skip them for now or add them to the count)
          } else {
            // Update lookup maps to catch duplicates within the same file
            if (record.email) emailMap.add(record.email.toLowerCase());
            if (record.company) nameCompanyMap.add(`${firstNameLower}|${lastNameLower}|${record.company.toLowerCase()}`);
            if (record.linkedinUrl) nameLinkedinMap.add(`${firstNameLower}|${lastNameLower}|${record.linkedinUrl.toLowerCase()}`);
            if (!record.email) nameOnlyMap.add(`${firstNameLower}|${lastNameLower}`);
            
            recordsToCreate.push(record);
          }

          // Progress update
          const progressInterval = Math.max(100, Math.floor(fileData.length * 0.05));
          if ((i + 1) % progressInterval === 0 || i === fileData.length - 1) {
            this.eventEmitter.emit('import.progress', {
              importId,
              status: 'processing',
              totalRecords: fileData.length,
              processedRecords: i + 1,
              importedRecords: recordsToCreate.length,
              duplicateRecords: duplicateCount,
              failedRecords: failedCount,
              percentage: Math.round(((i + 1) / fileData.length) * 100)
            });
          }
          
          // Batch save to DB every 1000 records
          if (recordsToCreate.length >= 1000) {
            const batch = recordsToCreate.splice(0, 1000);
            await prisma.connectionRecord.createMany({ data: batch });
          }

        } catch (error) {
          failedCount++;
          errors.push({ row: i + 1, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      // Final batch save
      if (recordsToCreate.length > 0) {
        await prisma.connectionRecord.createMany({ data: recordsToCreate });
      }

      const finalCount = await prisma.connectionRecord.count({ where: { importBatchId: importId } });

      await this.updateImportStatus(importId, ConnectionImportStatus.completed, {
        totalRecords: fileData.length,
        importedRecords: finalCount,
        duplicateRecords: duplicateCount,
        failedRecords: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      });

      this.eventEmitter.emit('import.completed', {
        importId,
        status: 'completed',
        totalRecords: fileData.length,
        importedRecords: finalCount,
        duplicateRecords: duplicateCount,
        failedRecords: failedCount,
        duration: Date.now() - new Date(importData.createdAt).getTime(),
      });
      
      const updatedBatch = await prisma.connectionImportBatch.findUnique({ where: { id: importId } });
      return this.mapToDto(updatedBatch!);

    } catch (error) {
      this.eventEmitter.emit('import.error', { importId, message: error instanceof Error ? error.message : 'Unknown error' });
      await this.updateImportStatus(importId, ConnectionImportStatus.failed, {
        errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
      });
      throw error;
    }
  }

  private parseConnectionRow(row: any, importId: string, rowNum: number, userId: string): any {
    const firstName = (row['First Name'] || row['FirstName'] || row['First'] || '').trim();
    const lastName = (row['Last Name'] || row['LastName'] || row['Last'] || '').trim();
    const email = (row['Email Address'] || row['Email'] || row['email'] || '').trim();
    const linkedinUrl = (row['URL'] || row['LinkedIn URL'] || row['linkedinUrl'] || '').trim();
    const company = (row['Company'] || row['company'] || '').trim();
    const position = (row['Position'] || row['position'] || '').trim();
    const connectedOnStr = row['Connected On'] || row['ConnectedOn'] || '';
    
    let connectedOn: Date | null = null;
    if (connectedOnStr) {
      const parsedDate = new Date(connectedOnStr);
      if (!isNaN(parsedDate.getTime())) {
        connectedOn = parsedDate;
      }
    }

    return {
      importBatchId: importId,
      userId,
      firstName,
      lastName,
      email: email || null,
      company: company || null,
      title: position || null,
      linkedinUrl: linkedinUrl || null,
      connectedOn,
      importRowNumber: rowNum,
    };
  }

  private mapToDto(batch: any): ConnectionImportDto {
    return {
      id: batch.id,
      userId: batch.userId,
      name: batch.name || 'Import',
      source: batch.source as any,
      status: batch.status as any,
      totalRecords: batch.totalRows,
      importedRecords: batch.createdPeopleCount,
      duplicateRecords: batch.duplicateCount,
      failedRecords: batch.errorCount,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      startedAt: batch.processingStartedAt || undefined,
      completedAt: batch.processingCompletedAt || undefined,
    };
  }

  public parseCSV(content: string): any[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Find the actual header row - skip descriptive text at the beginning
    let headerIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      const matches = [
        lowerLine.includes('first name'),
        lowerLine.includes('last name'),
        lowerLine.includes('email'),
        lowerLine.includes('company'),
        lowerLine.includes('position')
      ].filter(Boolean).length;

      if (line.includes(',') && matches >= 2 && !line.trim().startsWith('"')) {
        headerIndex = i;
        break;
      }
    }

    const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      try {
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/"/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/"/g, ''));
        
        if (values.length === headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
      } catch (error) {
        // Skip malformed lines
      }
    }

    return data;
  }
}
