import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle, Download, HelpCircle } from 'lucide-react';
import { connectionService } from '../services/connection.service';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onPreview?: (preview: any) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  onPreview,
  disabled = false 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError('');

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    if (file) {
      await processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file) {
      await processFile(file);
    }
  }, []);

  const processFile = async (file: File) => {
    setError('');
    setIsValidating(true);

    try {
      // Validate file
      const validation = connectionService.validateFile(file);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file');
        setIsValidating(false);
        return;
      }

      // Generate preview for CSV files
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        try {
          const preview = await connectionService.previewCSVFile(file);
          onPreview?.(preview);
        } catch (previewError) {
          console.warn('Could not generate preview:', previewError);
        }
      }

      onFileSelect(file);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsValidating(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `First Name,Last Name,Email,Phone,LinkedIn URL,Company,Position,Industry,Location,Connection Level,Notes,Tags
John,Doe,john.doe@company.com,+1-555-0123,https://linkedin.com/in/johndoe,Tech Corporation,Senior Software Engineer,Technology,San Francisco,CA,first_degree,Met at Tech Conference 2023,"engineering, senior, bay-area"
Jane,Smith,jane.smith@startup.com,+1-555-0124,https://linkedin.com/in/janesmith,Startup Inc,Product Manager,Technology,New York,NY,first_degree,Product meetup,"product, management, nyc"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linkedin-connections-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${error ? 'border-red-500 bg-red-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFileSelect}
          disabled={disabled}
        />

        <div className="flex flex-col items-center space-y-4">
          {isValidating ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Validating file...</p>
            </>
          ) : (
            <>
              <Upload className={`h-12 w-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drop your LinkedIn export here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click to browse
                </p>
              </div>
              <div className="text-xs text-gray-400">
                Supported: CSV, JSON (max 10MB)
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={downloadTemplate}
          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          disabled={disabled}
        >
          <Download className="h-4 w-4" />
          <span>Download Template</span>
        </button>

        <button
          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          disabled={disabled}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help Guide</span>
        </button>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">LinkedIn Export Instructions</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to LinkedIn Settings → Privacy → Data privacy</li>
          <li>Click "Get a copy of your data"</li>
          <li>Select "Connections" and request download</li>
          <li>Download the CSV file when ready</li>
          <li>Upload the file above</li>
        </ol>
      </div>
    </div>
  );
};
