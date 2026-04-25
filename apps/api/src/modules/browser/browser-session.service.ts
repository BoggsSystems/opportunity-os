import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { BrowserRuntimeProvider, BrowserConfig } from './providers/browser-runtime.provider.minimal';
import { CreateBrowserSessionDto, BrowserSessionMode, BrowserTargetType } from './dto/create-browser-session.dto';
import { UpdateBrowserSessionDto, BrowserSessionStatus } from './dto/update-browser-session.dto';
import { BrowserSessionDto } from './dto/browser-session.dto';
// import { v4 as uuidv4 } from 'uuid'; // Temporarily using simple generator

// Temporarily using in-memory storage until Prisma is integrated
interface BrowserSessionData {
  id: string;
  userId: string;
  opportunityId?: string;
  taskId?: string;
  status: BrowserSessionStatus;
  mode: BrowserSessionMode;
  targetType: BrowserTargetType;
  targetUrl: string;
  currentUrl?: string;
  currentPageTitle?: string;
  stepIndex: number;
  sessionConfig?: Record<string, any>;
  aiAnalysis?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  expiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BrowserSessionService {
  private readonly logger = new Logger(BrowserSessionService.name);
  private readonly sessions = new Map<string, BrowserSessionData>();
  private readonly sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly browserRuntimeProvider: BrowserRuntimeProvider) {
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000); // Every 5 minutes
  }

  async createSession(createSessionDto: CreateBrowserSessionDto): Promise<BrowserSessionDto> {
    this.logger.log(`Creating browser session for user: ${createSessionDto.userId}`);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiredAt = new Date(now.getTime() + this.sessionTimeoutMs);

    // Validate target URL
    if (!this.isValidTargetUrl(createSessionDto.targetUrl, createSessionDto.targetType)) {
      throw new BadRequestException('Invalid target URL for the specified target type');
    }

    const sessionData: BrowserSessionData = {
      id: sessionId,
      userId: createSessionDto.userId,
      opportunityId: createSessionDto.opportunityId,
      taskId: createSessionDto.taskId,
      status: BrowserSessionStatus.CREATED,
      mode: createSessionDto.mode,
      targetType: createSessionDto.targetType,
      targetUrl: createSessionDto.targetUrl,
      stepIndex: 0,
      sessionConfig: createSessionDto.sessionConfig,
      createdAt: now,
      updatedAt: now,
      expiredAt,
    };

    this.sessions.set(sessionId, sessionData);
    this.logger.log(`Browser session created: ${sessionId}`);

    return this.mapToDto(sessionData);
  }

  async getSession(sessionId: string): Promise<BrowserSessionDto> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new NotFoundException(`Browser session not found: ${sessionId}`);
    }

    // Update current URL and title if session is active
    if (sessionData.status === BrowserSessionStatus.ACTIVE) {
      try {
        const currentUrl = await this.browserRuntimeProvider.getCurrentUrl(sessionId);
        const pageTitle = await this.browserRuntimeProvider.getPageTitle(sessionId);
        
        sessionData.currentUrl = currentUrl;
        sessionData.currentPageTitle = pageTitle;
        sessionData.updatedAt = new Date();
      } catch (error) {
        this.logger.warn(`Failed to get current page info for session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return this.mapToDto(sessionData);
  }

  async getSessions(userId: string, status?: string): Promise<BrowserSessionDto[]> {
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .filter(session => !status || session.status === status);

    return userSessions.map(session => this.mapToDto(session));
  }

  async updateSession(sessionId: string, updateSessionDto: UpdateBrowserSessionDto): Promise<BrowserSessionDto> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new NotFoundException(`Browser session not found: ${sessionId}`);
    }

    // Update fields
    if (updateSessionDto.status) {
      sessionData.status = updateSessionDto.status;
    }
    if (updateSessionDto.currentUrl) {
      sessionData.currentUrl = updateSessionDto.currentUrl;
    }
    if (updateSessionDto.currentPageTitle) {
      sessionData.currentPageTitle = updateSessionDto.currentPageTitle;
    }
    if (updateSessionDto.stepIndex !== undefined) {
      sessionData.stepIndex = updateSessionDto.stepIndex;
    }
    if (updateSessionDto.aiAnalysis) {
      sessionData.aiAnalysis = updateSessionDto.aiAnalysis;
    }

    sessionData.updatedAt = new Date();
    this.sessions.set(sessionId, sessionData);

    return this.mapToDto(sessionData);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new NotFoundException(`Browser session not found: ${sessionId}`);
    }

    // Close browser session if active
    if (sessionData.status === BrowserSessionStatus.ACTIVE) {
      await this.browserRuntimeProvider.closeSession(sessionId);
    }

    this.sessions.delete(sessionId);
    this.logger.log(`Browser session deleted: ${sessionId}`);
  }

  async startSession(sessionId: string): Promise<BrowserSessionDto> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new NotFoundException(`Browser session not found: ${sessionId}`);
    }

    if (sessionData.status !== BrowserSessionStatus.CREATED) {
      throw new BadRequestException(`Cannot start session in status: ${sessionData.status}`);
    }

    try {
      // Create browser instance
      const browserConfig: BrowserConfig = {
        viewport: sessionData.sessionConfig?.['viewport'],
        timeout: sessionData.sessionConfig?.['timeout'],
        headless: sessionData.sessionConfig?.['headless'] ?? false,
        userAgent: sessionData.sessionConfig?.['userAgent'],
      };

      await this.browserRuntimeProvider.createSession(sessionId, browserConfig);

      // Navigate to target URL
      await this.browserRuntimeProvider.navigate(sessionId, sessionData.targetUrl);

      // Update session status
      sessionData.status = BrowserSessionStatus.ACTIVE;
      sessionData.startedAt = new Date();
      sessionData.updatedAt = new Date();

      // Get initial page info
      sessionData.currentUrl = await this.browserRuntimeProvider.getCurrentUrl(sessionId);
      sessionData.currentPageTitle = await this.browserRuntimeProvider.getPageTitle(sessionId);

      this.sessions.set(sessionId, sessionData);
      this.logger.log(`Browser session started: ${sessionId}`);

      return this.mapToDto(sessionData);
    } catch (error) {
      this.logger.error(`Failed to start browser session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<BrowserSessionDto> {
    const sessionData = this.sessions.get(sessionId);
    if (!sessionData) {
      throw new NotFoundException(`Browser session not found: ${sessionId}`);
    }

    if (sessionData.status !== BrowserSessionStatus.ACTIVE) {
      throw new BadRequestException(`Cannot stop session in status: ${sessionData.status}`);
    }

    try {
      // Close browser session
      await this.browserRuntimeProvider.closeSession(sessionId);

      // Update session status
      sessionData.status = BrowserSessionStatus.COMPLETED;
      sessionData.completedAt = new Date();
      sessionData.updatedAt = new Date();

      this.sessions.set(sessionId, sessionData);
      this.logger.log(`Browser session stopped: ${sessionId}`);

      return this.mapToDto(sessionData);
    } catch (error) {
      sessionData.status = BrowserSessionStatus.FAILED;
      sessionData.updatedAt = new Date();
      this.logger.error(`Failed to stop browser session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private isValidTargetUrl(url: string, targetType: BrowserTargetType): boolean {
    try {
      const urlObj = new URL(url);
      
      // Basic URL validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // Target type specific validation
      switch (targetType) {
        case BrowserTargetType.LINKEDIN_PROFILE:
          return urlObj.hostname.includes('linkedin.com');
        case BrowserTargetType.JOB_APPLICATION:
          // Allow common job sites
          return urlObj.hostname.includes('linkedin.com') ||
                 urlObj.hostname.includes('indeed.com') ||
                 urlObj.hostname.includes('glassdoor.com') ||
                 urlObj.hostname.includes('monster.com');
        default:
          return true; // Allow any URL for other types
      }
    } catch {
      return false;
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, sessionData] of this.sessions) {
      const expiredTime = sessionData.expiredAt?.getTime() || 
                         sessionData.createdAt.getTime() + this.sessionTimeoutMs;
      
      if (now > expiredTime) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.logger.log(`Cleaning up expired session: ${sessionId}`);
      
      const sessionData = this.sessions.get(sessionId);
      if (sessionData?.status === BrowserSessionStatus.ACTIVE) {
        this.browserRuntimeProvider.closeSession(sessionId).catch(error => {
          this.logger.error(`Failed to close expired session ${sessionId}: ${error.message}`);
        });
      }
      
      sessionData.status = BrowserSessionStatus.EXPIRED;
      sessionData.updatedAt = new Date();
    }

    if (expiredSessions.length > 0) {
      this.logger.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  private mapToDto(sessionData: BrowserSessionData): BrowserSessionDto {
    return {
      id: sessionData.id,
      userId: sessionData.userId,
      opportunityId: sessionData.opportunityId,
      taskId: sessionData.taskId,
      status: sessionData.status,
      mode: sessionData.mode,
      targetType: sessionData.targetType,
      targetUrl: sessionData.targetUrl,
      currentUrl: sessionData.currentUrl,
      currentPageTitle: sessionData.currentPageTitle,
      stepIndex: sessionData.stepIndex,
      sessionConfig: sessionData.sessionConfig,
      aiAnalysis: sessionData.aiAnalysis,
      startedAt: sessionData.startedAt?.toISOString(),
      completedAt: sessionData.completedAt?.toISOString(),
      expiredAt: sessionData.expiredAt?.toISOString(),
      createdAt: sessionData.createdAt.toISOString(),
      updatedAt: sessionData.updatedAt.toISOString(),
    };
  }
}
