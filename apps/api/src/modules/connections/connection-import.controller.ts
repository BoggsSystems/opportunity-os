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
      console.log('📄 Parsing as CSV via service');
      return this.connectionImportService.parseCSV(content);
    }
    
    throw new Error('Unsupported file format');
  }


  private async getConnectionsByImportId(_importId: string): Promise<ConnectionRecordDto[]> {
    // Placeholder implementation - in real version, this would query the database
    return [];
  }
}
