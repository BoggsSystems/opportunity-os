import React from 'react';
import { Search, Zap, CheckCircle, Folder, FileText, ChevronLeft, Inbox } from 'lucide-react';

export interface StorageAsset {
  id: string;
  name: string;
  mimeType: string;
  modifiedAt: Date;
  sizeBytes?: number;
  webViewLink?: string;
}

interface StorageAssetPickerProps {
  assets: StorageAsset[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onToggleAll?: () => void;
  onFolderClick: (folderId: string, folderName: string) => void;
  onBack: () => void;
  onRootClick: () => void;
  onSearch: (query: string) => void;
  onInitiateScan?: () => void;
  breadcrumbs: { id: string; name: string }[];
  isSensingActive: boolean;
  sensingLogs: { id: string; message: string; type: string }[];
  emptyMessage?: string;
}

export const StorageAssetPicker: React.FC<StorageAssetPickerProps> = ({
  assets,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  onFolderClick,
  onBack,
  onRootClick,
  onSearch,
  onInitiateScan,
  breadcrumbs,
  isSensingActive,
  sensingLogs,
  emptyMessage = "Ready to analyze your strategic topography."
}) => {
  const isRoot = breadcrumbs.length === 0;

  if (isSensingActive) {
    return (
      <div className="sensing-loader-container">
        <div className="sonar-wrapper">
          <div className="sonar-emitter">
            <Folder size={32} className="text-brand-primary" />
          </div>
          <div className="sonar-wave" />
        </div>
        <div className="sensing-log-window">
          {sensingLogs.filter(log => log.id.includes('storage') || log.id.includes('google_drive')).slice(-3).map(log => (
            <div key={log.id} className={`log-entry ${log.type}`}>
              <Zap size={10} /> <span>{log.message}</span>
            </div>
          ))}
          <div className="log-entry current">
            <div className="typing-dots"><span>.</span><span>.</span><span>.</span></div>
            <span>Mapping document topography...</span>
          </div>
        </div>
      </div>
    );
  }

  if (assets.length === 0 && isRoot && !isSensingActive) {
    return (
      <div className="empty-assets-state animate-in">
        <div className="empty-icon-wrapper">
          <Zap size={48} className="pulse-icon" />
        </div>
        <h3>Initialize Strategic Scan</h3>
        <p>{emptyMessage}</p>
        <button className="initiate-scan-btn" onClick={onInitiateScan}>
          <Zap size={16} /> Initiate Deep Scan
        </button>
      </div>
    );
  }

  return (
    <div className="assets-selection-area animate-in">
      <div className="assets-header">
        <div className="breadcrumbs">
          <span className="breadcrumb-item" onClick={onRootClick}>My Drive</span>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={b.id}>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-item" onClick={() => {
                onFolderClick(b.id, b.name);
              }}>{b.name}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="asset-search-area">
          <div className="asset-search">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="Filter assets..." 
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {assets.length > 0 && (
        <div className="assets-bulk-actions">
          <label className="select-all-label">
            <input 
              type="checkbox" 
              checked={assets.length > 0 && assets.filter(a => a.mimeType !== 'application/vnd.google-apps.folder').every(a => selectedIds.includes(a.id))}
              onChange={() => onToggleAll?.()}
            />
            <span>Select All Documents ({assets.filter(a => a.mimeType !== 'application/vnd.google-apps.folder').length})</span>
          </label>
        </div>
      )}
      
      <div className="assets-list">
        {!isRoot && (
          <div className="asset-item folder back-item" onClick={onBack}>
            <div className="asset-icon folder">
              <ChevronLeft size={18} />
            </div>
            <div className="asset-info">
              <span className="asset-name">.. (Go Back)</span>
            </div>
          </div>
        )}

        {assets.length === 0 ? (
          <div className="empty-folder-state">
            <Inbox size={32} />
            <p>This folder appears to be a tactical vacuum.</p>
            <span>No documents identified for ingestion.</span>
          </div>
        ) : (
          assets.map((asset) => {
            const isFolder = asset.mimeType === 'application/vnd.google-apps.folder';
            const isSelected = selectedIds.includes(asset.id);
            
            return (
              <div 
                key={asset.id} 
                className={`asset-item ${isFolder ? 'folder' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (isFolder) {
                    onFolderClick(asset.id, asset.name);
                  } else {
                    onToggleSelection(asset.id);
                  }
                }}
              >
                {!isFolder && (
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => {}} // Handled by parent div
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="asset-icon">
                  {isFolder ? <Folder size={18} /> : <FileText size={18} />}
                </div>
                <div className="asset-info">
                  <span className="asset-name">{asset.name}</span>
                  {!isFolder && (
                    <span className="asset-meta">{new Date(asset.modifiedAt).toLocaleDateString()}</span>
                  )}
                </div>
                {isSelected && !isFolder && <CheckCircle size={14} className="selected-icon" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
