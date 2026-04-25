import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImportSource {
  LINKEDIN_EXPORT = 'linkedin_export',
  SALES_NAVIGATOR = 'sales_navigator',
  MANUAL_UPLOAD = 'manual_upload',
}

export enum ImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export class CreateConnectionImportDto {
  @ApiProperty({
    description: 'Import source type',
    enum: ImportSource,
    example: ImportSource.LINKEDIN_EXPORT,
  })
  @IsEnum(ImportSource)
  source: ImportSource;

  @ApiProperty({
    description: 'Import name for identification',
    example: 'LinkedIn Connections - Q1 2024',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description of the import',
    example: 'Connections from LinkedIn export focusing on tech industry',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorizing imports',
    example: ['tech', 'senior-level', 'bay-area'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Whether to automatically segment connections by industry',
    example: true,
  })
  @IsOptional()
  autoSegment?: boolean;

  @ApiPropertyOptional({
    description: 'Custom segment names',
    example: ['engineering', 'product', 'sales'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customSegments?: string[];
}

export class ConnectionImportPreviewDto {
  @ApiProperty({
    description: 'Preview of connection data before import',
    example: [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        company: 'Tech Corp',
        position: 'Software Engineer',
        industry: 'Technology',
      }
    ],
  })
  @IsArray()
  previewData: any[];

  @ApiProperty({
    description: 'Total number of records in preview',
    example: 5,
  })
  @IsNumber()
  totalRecords: number;

  @ApiProperty({
    description: 'Number of records that will be imported (duplicates removed)',
    example: 4,
  })
  @IsNumber()
  importableRecords: number;

  @ApiProperty({
    description: 'Number of duplicate records found',
    example: 1,
  })
  @IsNumber()
  duplicateRecords: number;
}
