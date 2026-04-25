import { ApiProperty } from '@nestjs/swagger';
import { ImportSource, ImportStatus } from './create-connection-import.dto';

export class ConnectionImportDto {
  @ApiProperty({
    description: 'Unique identifier for the import batch',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User who initiated the import',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiProperty({
    description: 'Import name for identification',
    example: 'LinkedIn Connections - Q1 2024',
  })
  name: string;

  @ApiProperty({
    description: 'Optional description of the import',
    example: 'Connections from LinkedIn export focusing on tech industry',
  })
  description?: string;

  @ApiProperty({
    description: 'Source of the import data',
    enum: ImportSource,
    example: ImportSource.LINKEDIN_EXPORT,
  })
  source: ImportSource;

  @ApiProperty({
    description: 'Current status of the import',
    enum: ImportStatus,
    example: ImportStatus.COMPLETED,
  })
  status: ImportStatus;

  @ApiProperty({
    description: 'Total number of records in the import file',
    example: 1250,
  })
  totalRecords: number;

  @ApiProperty({
    description: 'Number of successfully imported records',
    example: 1180,
  })
  importedRecords: number;

  @ApiProperty({
    description: 'Number of duplicate records found and skipped',
    example: 70,
  })
  duplicateRecords: number;

  @ApiProperty({
    description: 'Number of records that failed to import',
    example: 0,
  })
  failedRecords: number;

  @ApiProperty({
    description: 'Tags for categorizing imports',
    example: ['tech', 'senior-level', 'bay-area'],
  })
  tags?: string[];

  @ApiProperty({
    description: 'Processing errors encountered during import',
    example: [
      {
        row: 125,
        field: 'email',
        error: 'Invalid email format',
        data: 'john.doe@invalid',
      }
    ],
  })
  errors?: any[];

  @ApiProperty({
    description: 'When the import was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the import was last updated',
    example: '2024-01-15T10:45:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'When the import processing started',
    example: '2024-01-15T10:31:00Z',
  })
  startedAt?: Date;

  @ApiProperty({
    description: 'When the import processing completed',
    example: '2024-01-15T10:45:00Z',
  })
  completedAt?: Date;
}
