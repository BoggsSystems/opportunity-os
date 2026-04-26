import React, { useState, useRef } from 'react';
import { Users, Database, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { connectionService } from '../services/connection.service';
import { ImportSource } from '../types/connection.types';
import './ConnectionsSettings.css';

interface ConnectionsSettingsProps {
  isWorking: boolean;
}

export const ConnectionsSettings: React.FC<ConnectionsSettingsProps> = ({ isWorking }) => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('Processing file...');
    setUploadedFileName(file.name);

    try {
      // Validate file
      const validation = connectionService.validateFile(file);
      if (!validation.isValid) {
        setUploadStatus('error');
        setUploadMessage(validation.error || 'Invalid file format');
        return;
      }

      // Create import
      const userId = 'current-user'; // TODO: Get from auth context
      const importData = await connectionService.createImport(
        {
          name: `Connections Import - ${new Date().toLocaleDateString()}`,
          source: ImportSource.LINKEDIN_EXPORT,
          description: `LinkedIn connections import from ${file.name}`
        },
        file,
        userId
      );

      setUploadStatus('success');
      setUploadMessage(`Successfully imported ${importData.importedRecords} connections. ${importData.duplicateRecords} duplicates found.`);

    } catch (error) {
      console.error('Import error:', error);
      setUploadStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to import connections';
      
      // Check for common issues
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setUploadMessage('Authentication required. Please log in and try again.');
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        setUploadMessage('You do not have permission to import connections.');
      } else if (errorMessage.includes('413') || errorMessage.includes('too large')) {
        setUploadMessage('File is too large. Please use a smaller file.');
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        setUploadMessage('Network error. Please check your connection and try again.');
      } else {
        setUploadMessage(errorMessage);
      }
    } finally {
      // Clear file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadMessage('');
    setUploadedFileName('');
  };

  return (
    <div className="settings-section">
      <div className="surface-card">
        <p className="label">LinkedIn Connections</p>
        <h3>Import and manage your professional network</h3>
        <p>
          Import your LinkedIn connections to build a comprehensive prospecting database. 
          The system handles LinkedIn's CSV export format and automatically detects duplicates.
        </p>
      </div>
      
      {uploadStatus !== 'idle' && (
        <div className={`surface-card ${uploadStatus === 'success' ? 'success' : uploadStatus === 'error' ? 'error' : 'info'}`} style={{ marginBottom: '1rem' }}>
          <div className="upload-status">
            {uploadStatus === 'uploading' && <Upload className="animate-spin" />}
            {uploadStatus === 'success' && <CheckCircle />}
            {uploadStatus === 'error' && <AlertCircle />}
            
            <div>
              <strong>{uploadedFileName}</strong>
              <p>{uploadMessage}</p>
            </div>
            
            {uploadStatus !== 'uploading' && (
              <button onClick={resetUpload} className="text-button">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="action-grid">
        <button
          className="primary-button"
          disabled={isWorking || uploadStatus === 'uploading'}
          onClick={handleImportClick}
          type="button"
        >
          <Users size={16} />
          Import Connections
        </button>
        <button
          className="secondary-button"
          disabled={isWorking}
          onClick={() => window.open('/connections', '_blank')}
          type="button"
        >
          <Database size={16} />
          View All Connections
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isWorking || uploadStatus === 'uploading'}
      />
      
      <div className="surface-card" style={{ marginTop: '1rem' }}>
        <p className="label">Import Features</p>
        <div className="settings-detail-list">
          <div>
            <span>LinkedIn CSV Support</span>
            <strong>✓ Handles LinkedIn export format</strong>
          </div>
          <div>
            <span>Smart Duplicate Detection</span>
            <strong>✓ 4-tier matching algorithm</strong>
          </div>
          <div>
            <span>Email Privacy Handling</span>
            <strong>✓ Accepts missing emails</strong>
          </div>
          <div>
            <span>Field Mapping</span>
            <strong>✓ Maps LinkedIn headers automatically</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
