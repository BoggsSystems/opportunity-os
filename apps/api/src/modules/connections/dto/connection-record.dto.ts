import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';

export enum ConnectionLevel {
  FIRST_DEGREE = 'first_degree',
  SECOND_DEGREE = 'second_degree',
  THIRD_PLUS = 'third_plus',
}

export class ConnectionRecordDto {
  @ApiProperty({
    description: 'Unique identifier for the connection record',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Import batch this connection belongs to',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  importBatchId: string;

  @ApiProperty({
    description: 'First name of the connection',
    example: 'John',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the connection',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    description: 'Email address of the connection',
    example: 'john.doe@company.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the connection',
    example: '+1-555-0123',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'LinkedIn profile URL',
    example: 'https://linkedin.com/in/johndoe',
  })
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional({
    description: 'Current company',
    example: 'Tech Corporation',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Current position/title',
    example: 'Senior Software Engineer',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({
    description: 'Industry/sector',
    example: 'Technology',
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Location',
    example: 'San Francisco, CA',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Connection level on LinkedIn',
    enum: ConnectionLevel,
    example: ConnectionLevel.FIRST_DEGREE,
  })
  @IsOptional()
  @IsEnum(ConnectionLevel)
  connectionLevel?: ConnectionLevel;

  @ApiPropertyOptional({
    description: 'Notes about the connection',
    example: 'Met at Tech Conference 2023',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    example: ['engineering', 'senior', 'bay-area'],
  })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Whether this connection is a duplicate',
    example: false,
  })
  isDuplicate: boolean;

  @ApiProperty({
    description: 'Original row number from import file',
    example: 42,
  })
  originalRow: number;

  @ApiProperty({
    description: 'When the record was created',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the record was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
}
