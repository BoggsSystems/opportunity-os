import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Logger,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { ConnectionImportService } from './services/connection-import.service';
import { CreateConnectionImportDto } from './dto/create-connection-import.dto';
import { ConnectionImportDto } from './dto/connection-import.dto';
import { ConnectionRecordDto } from './dto/connection-record.dto';
import { AuthGuard } from '../auth/auth.guard';
import { UseGuards } from '@nestjs/common';

import { LinkedInIngestService } from './services/linkedin-ingest.service';

@ApiTags('Connection Import')
@UseGuards(AuthGuard)
@Controller('connections')
export class ConnectionImportController {
  private readonly logger = new Logger(ConnectionImportController.name);

  constructor(
    private readonly connectionImportService: ConnectionImportService,
    private readonly linkedInIngestService: LinkedInIngestService,
  ) {}

  @Post('ingest-zip')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Ingest a full LinkedIn data export ZIP' })
  @ApiResponse({ status: 201, description: 'ZIP ingested successfully, strategic draft returned' })
  async ingestZip(
    @Body() createImportDto: CreateConnectionImportDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    this.logger.log(`Ingesting LinkedIn ZIP for user: ${userId}`);

    if (!file || !file.originalname.endsWith('.zip')) {
      return {
        success: false,
        message: 'Invalid file',
        error: 'A LinkedIn data export ZIP file is required',
      };
    }

    // 1. Create a dummy import record for the connections part
    const importRecord = await this.connectionImportService.createImport(createImportDto, userId);

    // 2. Process the ZIP (Strategic Extraction + Connection Processing)
    const strategicDraft = await this.linkedInIngestService.processFullZip(file.buffer, userId, importRecord.id);

    return {
      success: true,
      message: 'LinkedIn ZIP ingested. Strategic draft generated.',
      data: {
        importId: importRecord.id,
        strategicDraft
      }
    };
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new connection import' })
  @ApiResponse({ status: 201, description: 'Connection import created successfully', type: ConnectionImportDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createImport(
    @Body() createImportDto: CreateConnectionImportDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    this.logger.log(`🔐 AUTHENTICATED USER: Creating connection import for user: ${userId}`);

    try {
      if (!file) {
        return {
          success: false,
          message: 'No file uploaded',
          error: 'File is required',
        };
      }

      // Validate file type
      if (!file.mimetype.includes('csv') && !file.mimetype.includes('json')) {
        return {
          success: false,
          message: 'Invalid file type',
          error: 'Only CSV and JSON files are supported',
        };
      }

      // Parse file data
      const fileData = await this.parseFile(file);
      
      // Create import record
      const importRecord = await this.connectionImportService.createImport(createImportDto, userId);
      
      // Process the file asynchronously
      this.connectionImportService.processImportFile(importRecord.id, fileData)
        .then(() => {
          this.logger.log(`Import processing completed: ${importRecord.id}`);
        })
        .catch((error) => {
          this.logger.error(`Import processing failed: ${importRecord.id}`, error);
        });

      return {
        success: true,
        data: importRecord,
        message: 'Connection import created and processing started',
      };

    } catch (error) {
      this.logger.error(`Failed to create connection import: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to create connection import',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('imports')
  @ApiOperation({ summary: 'Get connection imports for a user' })
  @ApiResponse({ status: 200, description: 'Connection imports retrieved successfully', type: [ConnectionImportDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getImports(
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    const userId = req.user?.sub || req.user?.id;
    this.logger.log(`🔐 AUTHENTICATED USER: Retrieving connection imports for user: ${userId}, status: ${status}`);

    try {
      const imports = await this.connectionImportService.getImports(
        userId, 
        status as any
      );
      
      return {
        success: true,
        data: imports,
      };

    } catch (error) {
      this.logger.error(`Failed to retrieve connection imports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to retrieve connection imports',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('imports/:importId')
  @ApiOperation({ summary: 'Get connection import by ID' })
  @ApiResponse({ status: 200, description: 'Connection import retrieved successfully', type: ConnectionImportDto })
  @ApiResponse({ status: 404, description: 'Connection import not found' })
  async getImport(@Param('importId') importId: string) {
    this.logger.log(`Retrieving connection import: ${importId}`);

    try {
      const importRecord = await this.connectionImportService.getImport(importId);
      
      return {
        success: true,
        data: importRecord,
      };

    } catch (error) {
      this.logger.error(`Failed to retrieve connection import: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to retrieve connection import',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('imports/:importId/connections')
  @ApiOperation({ summary: 'Get connections from a specific import' })
  @ApiResponse({ status: 200, description: 'Connections retrieved successfully', type: [ConnectionRecordDto] })
  async getImportConnections(@Param('importId') importId: string) {
    this.logger.log(`Retrieving connections for import: ${importId}`);

    try {
      // This would typically query the database for connections in this import
      const connections = await this.getConnectionsByImportId(importId);
      
      return {
        success: true,
        data: connections,
      };

    } catch (error) {
      this.logger.error(`Failed to retrieve connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to retrieve connections',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    console.log('🔧 ===== FILE PARSING START =====');
    console.log(`📄 File info:`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    const content = file.buffer.toString('utf-8');
    console.log(`📄 Content length: ${content.length} characters`);
    
    if (file.mimetype.includes('json')) {
      console.log('📄 Parsing as JSON');
      return JSON.parse(content);
    }
    
    if (file.mimetype.includes('csv')) {
      console.log('📄 Parsing as CSV');
      return this.parseCSV(content);
    }
    
    throw new Error('Unsupported file format');
  }

  private parseCSV(content: string): any[] {
    this.logger.log('🔧 ===== BACKEND CSV PARSING START =====');
    this.logger.log(`📄 File content length: ${content.length} characters`);
    
    const lines = content.split('\n').filter(line => line.trim());
    this.logger.log(`📄 Total lines found: ${lines.length}`);
    
    if (lines.length === 0) {
      this.logger.warn('⚠️ No content found in CSV file');
      return [];
    }

    // Log first few lines to debug
    this.logger.log('📄 First 5 lines:');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      this.logger.log(`  Line ${i + 1}: ${lines[i].substring(0, 100)}...`);
    }

    // Find the actual header row - skip descriptive text at the beginning
    let headerIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Count how many typical LinkedIn headers match
      const matches = [
        lowerLine.includes('first name'),
        lowerLine.includes('last name'),
        lowerLine.includes('email'),
        lowerLine.includes('company'),
        lowerLine.includes('position')
      ].filter(Boolean).length;

      // We need at least 2 matches to be confident it's the header row
      // Also ensure it doesn't start with a quote (which is common for the disclaimer)
      if (line.includes(',') && matches >= 2 && !line.trim().startsWith('"')) {
        headerIndex = i;
        this.logger.log(`✅ Found header at line ${headerIndex + 1}: ${line.substring(0, 50)}...`);
        break;
      }
    }

    this.logger.log(`📋 BACKEND FOUND HEADER AT LINE ${headerIndex + 1}: ${lines[headerIndex]}`);

    const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
    this.logger.log('📋 BACKEND HEADERS PARSED:', headers);
    this.logger.log(`📋 Header count: ${headers.length}`);
    
    const data = [];
    let parseErrors = 0;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      try {
        // Handle CSV with quoted fields that may contain commas
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
        values.push(currentValue.trim().replace(/"/g, '')); // Add last value
        
        if (values.length === headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
          
          // Log first few records for debugging
          if (i <= 3) {
            this.logger.log(`📝 BACKEND RECORD ${i}:`, {
              firstName: row['First Name'] || row['FirstName'] || '',
              lastName: row['Last Name'] || row['LastName'] || '',
              email: row['Email Address'] || row['Email'] || '',
              company: row['Company'] || '',
              position: row['Position'] || ''
            });
          }
        } else {
          parseErrors++;
          this.logger.warn(`⚠️ BACKEND PARSE ERROR - Field count mismatch on line ${i}: expected ${headers.length}, got ${values.length}`);
        }
      } catch (error) {
        parseErrors++;
        this.logger.warn(`⚠️ BACKEND PARSE ERROR on line ${i}:`, error);
      }
    }

    this.logger.log('✅ ===== BACKEND CSV PARSING COMPLETE =====');
    this.logger.log(`📊 BACKEND PARSING SUMMARY:`, {
      totalLines: lines.length - 1,
      successfullyParsed: data.length,
      parseErrors: parseErrors,
      successRate: `${((data.length / (lines.length - 1)) * 100).toFixed(1)}%`
    });

    return data;
  }

  private async getConnectionsByImportId(_importId: string): Promise<ConnectionRecordDto[]> {
    // Placeholder implementation - in real version, this would query the database
    return [];
  }
}
