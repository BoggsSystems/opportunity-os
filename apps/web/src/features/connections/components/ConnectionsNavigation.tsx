import React from 'react';
import { Users, Upload, ArrowLeft } from 'lucide-react';

interface ConnectionsNavigationProps {
  currentView: 'dashboard' | 'import';
  onViewChange: (view: 'dashboard' | 'import') => void;
}

export const ConnectionsNavigation: React.FC<ConnectionsNavigationProps> = ({
  currentView,
  onViewChange,
}) => {
  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            {/* Logo/Back */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Workspace</span>
              </button>
              
              <div className="h-6 w-px bg-gray-300" />
              
              <div className="flex items-center space-x-2">
                <Users className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900">Connections</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex space-x-8">
              <button
                onClick={() => onViewChange('dashboard')}
                className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                  currentView === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onViewChange('import')}
                className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
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

          {/* Quick Actions */}
          <div className="flex items-center space-x-4">
            {currentView === 'dashboard' && (
              <button
                onClick={() => onViewChange('import')}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>New Import</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
