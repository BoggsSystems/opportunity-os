import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Users, Upload } from 'lucide-react';

export const ConnectionDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DEBUG] File upload triggered');
    console.log('[DEBUG] Event:', event);
    console.log('[DEBUG] Files:', event.target.files);
    
    const file = event.target.files?.[0];
    if (file) {
      console.log('[DEBUG] Selected file:', file.name);
      console.log('[DEBUG] File size:', file.size);
      console.log('[DEBUG] File type:', file.type);
      alert(`File "${file.name}" selected. Upload functionality will be implemented next.`);
      // TODO: Implement actual file upload logic
    } else {
      console.log('[DEBUG] No file selected');
    }
  }, []);

  const handleImportClick = useCallback(() => {
    console.log('[DEBUG] Import button clicked');
    console.log('[DEBUG] fileInputRef.current:', fileInputRef.current);
    
    if (fileInputRef.current) {
      console.log('[DEBUG] Triggering file input click');
      fileInputRef.current.click();
    } else {
      console.log('[DEBUG] fileInputRef.current is null');
    }
  }, []);

  useEffect(() => {
    // Simulate loading for now since the API might not be ready
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Empty State */}
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No connections yet</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Import your LinkedIn connections to start building targeted outreach campaigns and finding new opportunities.
        </p>
        
        {/* Quick Start Guide */}
        <div className="max-w-lg mx-auto text-left bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">How to import connections:</h4>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="font-medium text-blue-600 mr-2">1.</span>
              Go to LinkedIn and export your connections (CSV format)
            </li>
            <li className="flex items-start">
              <span className="font-medium text-blue-600 mr-2">2.</span>
              Click the "Import" tab above
            </li>
            <li className="flex items-start">
              <span className="font-medium text-blue-600 mr-2">3.</span>
              Upload your CSV file and follow the prompts
            </li>
            <li className="flex items-start">
              <span className="font-medium text-blue-600 mr-2">4.</span>
              Review and confirm your imported connections
            </li>
          </ol>
        </div>
        
        {/* Test button to verify click events work */}
        <button 
          className="mb-4 px-4 py-2 bg-red-500 text-white rounded"
          onClick={() => console.log('[TEST] Red button clicked!')}
        >
          TEST BUTTON
        </button>
        
        <button 
          className="inline-flex items-center space-x-3 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-base shadow-sm cursor-pointer"
          onClick={handleImportClick}
        >
          <Upload className="h-5 w-5" />
          <span>Import Your First Connections</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};
