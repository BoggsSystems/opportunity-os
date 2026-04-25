import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { ImportProgress as ImportProgressType, ImportStatus } from '../types/connection.types';

interface ImportProgressProps {
  progress: ImportProgressType;
  onCancel?: () => void;
}

export const ImportProgress: React.FC<ImportProgressProps> = ({ 
  progress, 
  onCancel 
}) => {
  const getStatusIcon = (status: ImportStatus) => {
    switch (status) {
      case ImportStatus.COMPLETED:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case ImportStatus.FAILED:
        return <XCircle className="h-5 w-5 text-red-500" />;
      case ImportStatus.CANCELLED:
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case ImportStatus.PROCESSING:
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ImportStatus) => {
    switch (status) {
      case ImportStatus.COMPLETED:
        return 'text-green-600 bg-green-50 border-green-200';
      case ImportStatus.FAILED:
        return 'text-red-600 bg-red-50 border-red-200';
      case ImportStatus.CANCELLED:
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case ImportStatus.PROCESSING:
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressBarColor = (status: ImportStatus) => {
    switch (status) {
      case ImportStatus.COMPLETED:
        return 'bg-green-500';
      case ImportStatus.FAILED:
        return 'bg-red-500';
      case ImportStatus.CANCELLED:
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white border rounded-lg shadow-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon(progress.status)}
            <div>
              <h3 className="font-medium text-gray-900">Importing Connections</h3>
              <p className="text-sm text-gray-500">{progress.currentStep}</p>
            </div>
          </div>
          
          {progress.status === ImportStatus.PROCESSING && onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(progress.status)}`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{progress.totalRecords}</div>
            <div className="text-xs text-gray-500">Total Records</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{progress.processedRecords}</div>
            <div className="text-xs text-gray-500">Processed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {progress.totalRecords - progress.processedRecords}
            </div>
            <div className="text-xs text-gray-500">Remaining</div>
          </div>
          <div className="text-center">
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(progress.status)}`}>
              {progress.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Errors */}
        {progress.errors && progress.errors.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h4 className="font-medium text-gray-900">
                {progress.errors.length} Error{progress.errors.length > 1 ? 's' : ''} Found
              </h4>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-2">
              {progress.errors.slice(0, 5).map((error, index) => (
                <div key={index} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <div className="text-sm text-yellow-800">
                    <span className="font-medium">Row {error.row}:</span> {error.error}
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">
                    Field: {error.field} | Data: {JSON.stringify(error.data)}
                  </div>
                </div>
              ))}
              {progress.errors.length > 5 && (
                <div className="text-sm text-gray-500 text-center">
                  ... and {progress.errors.length - 5} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completion Message */}
        {progress.status === ImportStatus.COMPLETED && (
          <div className="border-t pt-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <h4 className="font-medium text-green-900">Import Completed Successfully!</h4>
                  <p className="text-sm text-green-800 mt-1">
                    {progress.processedRecords} connections have been imported and are ready to use.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Failure Message */}
        {progress.status === ImportStatus.FAILED && (
          <div className="border-t pt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <h4 className="font-medium text-red-900">Import Failed</h4>
                  <p className="text-sm text-red-800 mt-1">
                    There was an error processing your import. Please check the errors above and try again.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
