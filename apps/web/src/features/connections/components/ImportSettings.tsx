import React, { useState } from 'react';
import { Tag, Settings, Users } from 'lucide-react';
import { CreateConnectionImportRequest, ImportSource } from '../types/connection.types';

interface ImportSettingsProps {
  onSubmit: (settings: CreateConnectionImportRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ImportSettings: React.FC<ImportSettingsProps> = ({ 
  onSubmit, 
  onCancel,
  isLoading = false 
}) => {
  const [settings, setSettings] = useState<CreateConnectionImportRequest>({
    source: ImportSource.LINKEDIN_EXPORT,
    name: '',
    description: '',
    tags: [],
    autoSegment: true,
    customSegments: [],
  });

  const [newTag, setNewTag] = useState('');
  const [newSegment, setNewSegment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.name.trim()) return;
    onSubmit(settings);
  };

  const addTag = () => {
    if (newTag.trim() && !settings.tags?.includes(newTag.trim())) {
      setSettings(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const addCustomSegment = () => {
    if (newSegment.trim() && !settings.customSegments?.includes(newSegment.trim())) {
      setSettings(prev => ({
        ...prev,
        customSegments: [...(prev.customSegments || []), newSegment.trim()]
      }));
      setNewSegment('');
    }
  };

  const removeCustomSegment = (segmentToRemove: string) => {
    setSettings(prev => ({
      ...prev,
      customSegments: prev.customSegments?.filter(segment => segment !== segmentToRemove) || []
    }));
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white border rounded-lg shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Import Settings</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure how your connections should be imported
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Import Name *
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., LinkedIn Connections Q1 2024"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={settings.description}
                onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Optional description of this import batch"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Import Source
              </label>
              <select
                value={settings.source}
                onChange={(e) => setSettings(prev => ({ ...prev, source: e.target.value as ImportSource }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={ImportSource.LINKEDIN_EXPORT}>LinkedIn Export</option>
                <option value={ImportSource.SALES_NAVIGATOR}>Sales Navigator</option>
                <option value={ImportSource.MANUAL_UPLOAD}>Manual Upload</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center space-x-1">
                <Tag className="h-4 w-4" />
                <span>Tags</span>
              </div>
            </label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add a tag..."
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                >
                  Add
                </button>
              </div>
              {settings.tags && settings.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {settings.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Segmentation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>Segmentation</span>
              </div>
            </label>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.autoSegment}
                  onChange={(e) => setSettings(prev => ({ ...prev, autoSegment: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Automatically segment connections by industry and company
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Segments
                </label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newSegment}
                      onChange={(e) => setNewSegment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSegment())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add custom segment name..."
                    />
                    <button
                      type="button"
                      onClick={addCustomSegment}
                      className="px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {settings.customSegments && settings.customSegments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {settings.customSegments.map((segment) => (
                        <span
                          key={segment}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                        >
                          {segment}
                          <button
                            type="button"
                            onClick={() => removeCustomSegment(segment)}
                            className="ml-2 text-green-600 hover:text-green-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!settings.name.trim() || isLoading}
            >
              {isLoading ? 'Creating Import...' : 'Start Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
