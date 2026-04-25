import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Upload, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { connectionService } from '../services/connection.service';
import { ConnectionImport, ImportStatus, ImportSource } from '../types/connection.types';

interface DashboardStats {
  totalImports: number;
  totalConnections: number;
  processingImports: number;
  completedImports: number;
  failedImports: number;
}

export const ConnectionDashboard: React.FC = () => {
  const [imports, setImports] = useState<ConnectionImport[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalImports: 0,
    totalConnections: 0,
    processingImports: 0,
    completedImports: 0,
    failedImports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const userId = 'current-user'; // TODO: Get from auth context
      const userImports = await connectionService.getImports(userId);
      
      setImports(userImports);
      
      // Calculate stats
      const dashboardStats: DashboardStats = {
        totalImports: userImports.length,
        totalConnections: userImports.reduce((sum, imp) => sum + imp.importedRecords, 0),
        processingImports: userImports.filter(imp => imp.status === ImportStatus.PROCESSING).length,
        completedImports: userImports.filter(imp => imp.status === ImportStatus.COMPLETED).length,
        failedImports: userImports.filter(imp => imp.status === ImportStatus.FAILED).length,
      };
      
      setStats(dashboardStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ImportStatus) => {
    switch (status) {
      case ImportStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case ImportStatus.FAILED:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case ImportStatus.PROCESSING:
        return <div className="h-4 w-4 bg-blue-500 rounded-full animate-pulse" />;
      default:
        return <div className="h-4 w-4 bg-gray-300 rounded-full" />;
    }
  };

  const getSourceLabel = (source: ImportSource) => {
    switch (source) {
      case ImportSource.LINKEDIN_EXPORT:
        return 'LinkedIn Export';
      case ImportSource.SALES_NAVIGATOR:
        return 'Sales Navigator';
      case ImportSource.MANUAL_UPLOAD:
        return 'Manual Upload';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">LinkedIn Connections</h1>
              <p className="text-gray-600 mt-1">
                Manage your imported connections and create targeted campaigns
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/connections/import'}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>New Import</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Connections</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalConnections.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-green-600">Ready for prospecting</span>
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Imports</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalImports}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              Import batches created
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completedImports}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              Successful imports
            </div>
          </div>

          <div className="bg-white border rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.processingImports}</p>
              </div>
              <div className="h-8 w-8 bg-blue-500 rounded-full animate-pulse" />
            </div>
            <div className="mt-4 text-sm text-blue-600">
              Currently importing
            </div>
          </div>
        </div>

        {/* Recent Imports */}
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Recent Imports</h2>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Search className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Filter className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {imports.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No imports yet</h3>
                <p className="text-gray-600 mb-4">Start by importing your LinkedIn connections</p>
                <button
                  onClick={() => window.location.href = '/connections/import'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Import Connections
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Import Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Records
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {imports.map((importItem) => (
                    <tr key={importItem.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{importItem.name}</div>
                          {importItem.description && (
                            <div className="text-sm text-gray-500">{importItem.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getSourceLabel(importItem.source)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(importItem.status)}
                          <span className="text-sm text-gray-900">
                            {importItem.status.replace('_', ' ').toLowerCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {importItem.importedRecords} imported
                        </div>
                        {importItem.duplicateRecords > 0 && (
                          <div className="text-sm text-yellow-600">
                            {importItem.duplicateRecords} duplicates
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(importItem.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          View
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          Export
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
