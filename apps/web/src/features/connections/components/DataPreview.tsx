import React from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';
import { ImportPreview } from '../types/connection.types';

interface DataPreviewProps {
  preview: ImportPreview;
  onContinue: () => void;
  onCancel: () => void;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ 
  preview, 
  onContinue, 
  onCancel 
}) => {
  const getFieldStatus = (value: any) => {
    if (!value || value === '' || value === 'N/A') {
      return { status: 'missing', icon: X, color: 'text-gray-400' };
    }
    if (value.includes('@') && !value.includes(' ')) {
      return { status: 'valid', icon: CheckCircle, color: 'text-green-500' };
    }
    return { status: 'present', icon: CheckCircle, color: 'text-green-500' };
  };

  const renderPreviewTable = () => {
    if (preview.previewData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data to preview
        </div>
      );
    }

    const columns = Object.keys(preview.previewData[0]);
    const displayColumns = columns.slice(0, 6); // Show first 6 columns

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {displayColumns.map((column) => (
                <th
                  key={column}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {preview.previewData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {displayColumns.map((column) => {
                  const value = row[column];
                  const fieldStatus = getFieldStatus(value);
                  const Icon = fieldStatus.icon;

                  return (
                    <td key={column} className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <Icon className={`h-4 w-4 ${fieldStatus.color}`} />
                        <span className={fieldStatus.status === 'missing' ? 'text-gray-400 italic' : 'text-gray-900'}>
                          {value || 'Missing'}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {columns.length > 6 && (
          <div className="text-center py-2 text-sm text-gray-500 bg-gray-50">
            ... and {columns.length - 6} more columns
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white border rounded-lg shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Import Preview</h3>
          <p className="text-sm text-gray-500 mt-1">
            Review your data before importing
          </p>
        </div>

        {/* Summary Stats */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{preview.totalRecords}</div>
              <div className="text-xs text-gray-500">Total Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{preview.importableRecords}</div>
              <div className="text-xs text-gray-500">Ready to Import</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{preview.duplicateRecords}</div>
              <div className="text-xs text-gray-500">Duplicates Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((preview.importableRecords / preview.totalRecords) * 100)}%
              </div>
              <div className="text-xs text-gray-500">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Data Quality Alert */}
        {preview.duplicateRecords > 0 && (
          <div className="px-6 py-4 bg-yellow-50 border-b">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">Duplicates Detected</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  {preview.duplicateRecords} duplicate records will be automatically skipped during import.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Preview Table */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <h4 className="font-medium text-gray-900">Preview (First {preview.previewData.length} records)</h4>
            <p className="text-xs text-gray-500 mt-1">
              ✓ = Valid data, ✗ = Missing data
            </p>
          </div>
          {renderPreviewTable()}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t rounded-b-lg">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
            <div className="text-sm text-gray-600">
              {preview.importableRecords} records will be imported
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onContinue}
                className="px-4 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
                disabled={preview.importableRecords === 0}
              >
                Import {preview.importableRecords} Connections
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
