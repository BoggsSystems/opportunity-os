import React from 'react';
import { Zap } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import { StorageAssetPicker } from '../shared/StorageAssetPicker';

export const GoogleDriveProvider: React.FC = () => {
  const { 
    storageSuggestions, selectedAssetIds, setSelectedAssetIds,
    isSensingActive, handleStorageSearch, triggerStorageScan,
    allConnectors, onConnectGoogle, sensingLogs
  } = useOnboarding();

  const [breadcrumbs, setBreadcrumbs] = React.useState<{id: string, name: string}[]>([]);

  const isConnected = allConnectors.some(
    c => (c.providerName === 'google_drive' || c.capabilityProvider?.providerName === 'google_drive') && 
    c.status === 'connected'
  );

  const handleFolderClick = (folderId: string, folderName: string) => {
    // If clicking a breadcrumb that already exists, we need to slice
    const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
    if (existingIndex !== -1) {
      setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
    } else {
      setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
    }
    triggerStorageScan(folderId);
  };

  const handleBack = () => {
    const newBreadcrumbs = [...breadcrumbs];
    newBreadcrumbs.pop();
    setBreadcrumbs(newBreadcrumbs);
    const parent = newBreadcrumbs[newBreadcrumbs.length - 1];
    triggerStorageScan(parent ? parent.id : undefined);
  };

  const handleRootClick = () => {
    setBreadcrumbs([]);
    triggerStorageScan();
  };

  const toggleSelection = (id: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    const filesOnly = storageSuggestions.filter(a => a.mimeType !== 'application/vnd.google-apps.folder');
    const allSelected = filesOnly.length > 0 && filesOnly.every(a => selectedAssetIds.includes(a.id));
    
    if (allSelected) {
      setSelectedAssetIds(prev => prev.filter(id => !filesOnly.some(f => f.id === id)));
    } else {
      const newIds = [...selectedAssetIds];
      filesOnly.forEach(f => {
        if (!newIds.includes(f.id)) newIds.push(f.id);
      });
      setSelectedAssetIds(newIds);
    }
  };

  return (
    <div className="provider-calibration-content animate-in">
      <div className="spotlight-header">
        <div className="provider-icon google_drive">
          <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png" alt="Google Drive" width="24" height="24" />
        </div>
        <div className="header-meta">
          <div className="phase-indicator">Phase 03: Discovery Calibration</div>
          <h2>Google Drive</h2>
          {isSensingActive ? (
            <p className="status-badge sensing">Sensing Documents...</p>
          ) : (
            <p className="status-badge complete">{storageSuggestions.length > 0 ? 'Sensing Complete' : 'Ready to Scan'}</p>
          )}
        </div>
      </div>

      <div className="spotlight-body">
        {!isConnected ? (
          <div className="empty-assets-state">
            <p>I need your permission to access Google Drive for strategic analysis.</p>
            <button className="initiate-scan-btn grant-access" onClick={() => onConnectGoogle?.()}>
              <Zap size={16} /> Grant Drive Access
            </button>
          </div>
        ) : (
          <StorageAssetPicker 
            assets={storageSuggestions}
            selectedIds={selectedAssetIds}
            onToggleSelection={toggleSelection}
            onToggleAll={handleToggleAll}
            onFolderClick={handleFolderClick}
            onBack={handleBack}
            onRootClick={handleRootClick}
            onSearch={handleStorageSearch}
            onInitiateScan={() => triggerStorageScan()}
            breadcrumbs={breadcrumbs}
            isSensingActive={isSensingActive}
            sensingLogs={sensingLogs}
            emptyMessage="I'm ready to map your strategic topography in Google Drive. Let's find your decks and frameworks."
          />
        )}
      </div>
    </div>
  );
};
