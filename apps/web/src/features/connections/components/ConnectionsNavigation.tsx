import React from 'react';
import { Users, Upload, X } from 'lucide-react';

interface ConnectionsNavigationProps {
  currentView: 'dashboard' | 'import';
  onViewChange: (view: 'dashboard' | 'import') => void;
  onClose: () => void;
}

export const ConnectionsNavigation: React.FC<ConnectionsNavigationProps> = ({
  currentView,
  onViewChange,
  onClose,
}) => {
  return (
    <div className="border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-6">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Manage Connections</h1>
              <p className="text-sm text-gray-500">Import and manage your LinkedIn connections</p>
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => onViewChange('dashboard')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentView === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onViewChange('import')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentView === 'import'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </div>
          </button>
        </nav>
      </div>
    </div>
  );
};
