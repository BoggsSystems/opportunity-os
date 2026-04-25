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

export enum ConnectionLevel {
  FIRST_DEGREE = 'first_degree',
  SECOND_DEGREE = 'second_degree',
  THIRD_PLUS = 'third_plus',
}

export interface ConnectionImport {
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
  errors?: ImportError[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ImportError {
  row: number;
  field: string;
  error: string;
  data: any;
}

export interface ConnectionRecord {
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
  connectionLevel?: ConnectionLevel;
  notes?: string;
  tags?: string[];
  isDuplicate: boolean;
  originalRow: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionImportRequest {
  source: ImportSource;
  name: string;
  description?: string;
  tags?: string[];
  autoSegment?: boolean;
  customSegments?: string[];
}

export interface ImportPreview {
  previewData: any[];
  totalRecords: number;
  importableRecords: number;
  duplicateRecords: number;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ImportProgress {
  status: ImportStatus;
  totalRecords: number;
  processedRecords: number;
  percentage: number;
  currentStep: string;
  errors?: ImportError[];
}
