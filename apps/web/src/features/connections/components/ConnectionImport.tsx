import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Settings, CheckCircle } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { DataPreview } from './DataPreview';
import { ImportSettings } from './ImportSettings';
import { ImportProgress as ImportProgressComponent } from './ImportProgress';
import { connectionService } from '../services/connection.service';
import { 
  ConnectionImport, 
  CreateConnectionImportRequest, 
  ImportPreview,
  ImportProgress as ImportProgressType
} from '../types/connection.types';
import { ImportStatus } from '../types/connection.types';
import { importWebSocketService, ImportEvent } from '../services/importWebSocket.service';

type ImportStep = 'upload' | 'preview' | 'settings' | 'progress' | 'completed';

const ConnectionImportComponent: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressType | null>(null);
  const [currentImport, setCurrentImport] = useState<ConnectionImport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Subscribe to WebSocket updates when processing
  useEffect(() => {
    if (currentImport && (currentImport.status === ImportStatus.PROCESSING || currentStep === 'progress')) {
      console.log(`🔌 Subscribing to WebSocket for import: ${currentImport.id}`);
      
      const handleImportEvent = (event: ImportEvent) => {
        console.log('📡 Received WebSocket event:', event);
        
        if (event.type === 'progress') {
          setImportProgress({
            status: event.data.status as ImportStatus,
            totalRecords: event.data.totalRecords || 0,
            processedRecords: event.data.processedRecords || 0,
            percentage: event.data.percentage || 0,
            currentStep: event.data.message || 'Processing...',
            errors: []
          });
        } else if (event.type === 'completed') {
          setCurrentStep('completed');
          // Update current import with final stats
          setCurrentImport(prev => prev ? {
            ...prev,
            status: ImportStatus.COMPLETED,
            totalRecords: event.data.totalRecords,
            importedRecords: event.data.importedRecords,
            duplicateRecords: event.data.duplicateRecords,
            failedRecords: event.data.failedRecords
          } : null);
        } else if (event.type === 'error') {
          setError(event.data.message);
        }
      };

      importWebSocketService.subscribe(currentImport.id, handleImportEvent);
      
      return () => {
        console.log(`🔌 Unsubscribing from WebSocket for import: ${currentImport.id}`);
        importWebSocketService.unsubscribe(currentImport.id);
      };
    }
    return undefined;
  }, [currentImport, currentStep]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError('');
  };

  const handlePreview = (previewData: ImportPreview) => {
    setPreview(previewData);
    setCurrentStep('preview');
  };

  const handleSettingsSubmit = async (settings: CreateConnectionImportRequest) => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError('');

    try {
      // Create import
      const userId = 'current-user'; // TODO: Get from auth context
      const importData = await connectionService.createImport(settings, selectedFile, userId);
      
      setCurrentImport(importData);
      setCurrentStep('progress');
      
      // Start polling for progress
      const progress = await connectionService.pollImportProgress(importData.id);
      setImportProgress(progress);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create import');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset state
    setSelectedFile(null);
    setPreview(null);
    setImportProgress(null);
    setCurrentImport(null);
    setError('');
    setCurrentStep('upload');
  };

  const handleBackToUpload = () => {
    setSelectedFile(null);
    setPreview(null);
    setCurrentStep('upload');
  };

  const handleBackToPreview = () => {
    setCurrentStep('preview');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Import LinkedIn Connections
              </h2>
              <p className="text-gray-600">
                Upload your LinkedIn connection export to start building your prospecting database
              </p>
            </div>
            
            <FileUpload 
              onFileSelect={handleFileSelect}
              onPreview={handlePreview}
              disabled={isLoading}
            />
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800">{error}</p>
              </div>
            )}
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToUpload}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Upload</span>
              </button>
              <div className="flex items-center space-x-2 text-gray-400">
                <Upload className="h-4 w-4" />
                <span>File Uploaded</span>
              </div>
            </div>
            
            {preview && (
              <DataPreview
                preview={preview}
                onContinue={() => setCurrentStep('settings')}
                onCancel={handleBackToUpload}
              />
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToPreview}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Preview</span>
              </button>
              <div className="flex items-center space-x-2 text-gray-400">
                <Settings className="h-4 w-4" />
                <span>Import Settings</span>
              </div>
            </div>
            
            <ImportSettings
              onSubmit={handleSettingsSubmit}
              onCancel={handleBackToPreview}
              isLoading={isLoading}
            />
          </div>
        );

      case 'progress':
        return (
          <div className="space-y-6">
            {importProgress && (
              <ImportProgressComponent
                progress={importProgress}
                onCancel={handleCancel}
              />
            )}
          </div>
        );

      case 'completed':
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Import Completed Successfully!
              </h2>
              <p className="text-gray-600">
                Your connections have been imported and are ready to use.
              </p>
            </div>
            
            {currentImport && (
              <div className="bg-white border rounded-lg shadow-sm p-6 max-w-md mx-auto">
                <h3 className="font-medium text-gray-900 mb-4">Import Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Import Name:</span>
                    <span className="font-medium">{currentImport.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Records:</span>
                    <span className="font-medium">{currentImport.totalRecords}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Imported:</span>
                    <span className="font-medium text-green-600">{currentImport.importedRecords}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duplicates:</span>
                    <span className="font-medium text-yellow-600">{currentImport.duplicateRecords}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => window.location.href = '/connections'}
                className="px-6 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
              >
                View Connections
              </button>
              <button
                onClick={() => window.location.href = '/discovery'}
                className="px-6 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
              >
                Start Prospecting
              </button>
            </div>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {renderStep()}
      </div>
    </div>
  );
};

export { ConnectionImportComponent as ConnectionImport };
