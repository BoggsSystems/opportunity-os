import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BrowserSessionService } from './browser-session.service';
import { CreateBrowserSessionDto } from './dto/create-browser-session.dto';
// import { BrowserSessionDto } from './dto/browser-session.dto'; // Not used yet

@ApiTags('Browser Sessions')
@Controller('browser-sessions')
export class BrowserSessionController {
  private readonly logger = new Logger(BrowserSessionController.name);

  constructor(private readonly browserSessionService: BrowserSessionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new browser session' })
  @ApiResponse({ status: 201, description: 'Browser session created successfully' })
  async createSession(@Body() createSessionDto: CreateBrowserSessionDto) {
    this.logger.log(`Creating browser session for user: ${createSessionDto.userId}`);
    
    try {
      const session = await this.browserSessionService.createSession(createSessionDto);
      return {
        success: true,
        data: session,
        message: 'Browser session created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create browser session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to create browser session',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get browser session by ID' })
  @ApiResponse({ status: 200, description: 'Browser session retrieved successfully' })
  async getSession(@Param('sessionId') sessionId: string) {
    this.logger.log(`Retrieving browser session: ${sessionId}`);
    
    try {
      const session = await this.browserSessionService.getSession(sessionId);
      return {
        success: true,
        data: session,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve browser session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to retrieve browser session',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Post(':sessionId/start')
  @ApiOperation({ summary: 'Start a browser session' })
  @ApiResponse({ status: 200, description: 'Browser session started successfully' })
  async startSession(@Param('sessionId') sessionId: string) {
    this.logger.log(`Starting browser session: ${sessionId}`);
    
    try {
      const session = await this.browserSessionService.startSession(sessionId);
      return {
        success: true,
        data: session,
        message: 'Browser session started successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to start browser session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to start browser session',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Post(':sessionId/stop')
  @ApiOperation({ summary: 'Stop a browser session' })
  @ApiResponse({ status: 200, description: 'Browser session stopped successfully' })
  async stopSession(@Param('sessionId') sessionId: string) {
    this.logger.log(`Stopping browser session: ${sessionId}`);
    
    try {
      const session = await this.browserSessionService.stopSession(sessionId);
      return {
        success: true,
        data: session,
        message: 'Browser session stopped successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to stop browser session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: 'Failed to stop browser session',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
