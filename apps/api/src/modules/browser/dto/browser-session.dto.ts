import { ApiProperty } from '@nestjs/swagger';

export class BrowserSessionDto {
  @ApiProperty({
    description: 'Browser session ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who owns the session',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  userId: string;

  @ApiProperty({
    description: 'Associated opportunity ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  opportunityId?: string;

  @ApiProperty({
    description: 'Associated task ID',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  taskId?: string;

  @ApiProperty({
    description: 'Current session status',
    example: 'active',
  })
  status: string;

  @ApiProperty({
    description: 'Session mode (observe, guide, assist, automate_partial)',
    example: 'observe',
  })
  mode: string;

  @ApiProperty({
    description: 'Type of target being interacted with',
    example: 'job_application',
  })
  targetType: string;

  @ApiProperty({
    description: 'Target URL',
    example: 'https://www.linkedin.com/jobs/view/123456789',
  })
  targetUrl: string;

  @ApiProperty({
    description: 'Current URL in the browser',
    example: 'https://www.linkedin.com/jobs/view/123456789',
  })
  currentUrl?: string;

  @ApiProperty({
    description: 'Current page title',
    example: 'Senior Software Engineer at Tech Company',
  })
  currentPageTitle?: string;

  @ApiProperty({
    description: 'Current step index in the workflow',
    example: 3,
  })
  stepIndex: number;

  @ApiProperty({
    description: 'Session configuration',
    example: {
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
      headless: false,
    },
  })
  sessionConfig?: Record<string, any>;

  @ApiProperty({
    description: 'AI analysis of the current page',
    example: {
      pageType: 'job_application',
      relevanceScore: 0.85,
      suggestedActions: ['fill_form', 'upload_resume'],
    },
  })
  aiAnalysis?: Record<string, any>;

  @ApiProperty({
    description: 'When the session was started',
    example: '2024-01-15T10:30:00Z',
  })
  startedAt?: string;

  @ApiProperty({
    description: 'When the session was completed',
    example: '2024-01-15T11:45:00Z',
  })
  completedAt?: string;

  @ApiProperty({
    description: 'When the session expires',
    example: '2024-01-15T12:30:00Z',
  })
  expiredAt?: string;

  @ApiProperty({
    description: 'When the session was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'When the session was last updated',
    example: '2024-01-15T11:45:00Z',
  })
  updatedAt: string;
}
