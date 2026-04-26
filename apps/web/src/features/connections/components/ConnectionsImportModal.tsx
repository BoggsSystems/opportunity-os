import React, { useState } from 'react';
import { X, Upload, Database } from 'lucide-react';
import { ConnectionImport } from './ConnectionImport';

interface ConnectionsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectionsImportModal: React.FC<ConnectionsImportModalProps> = ({ isOpen, onClose }) => {
  const [currentView, setCurrentView] = useState<'import' | 'dashboard'>('import');

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose} role="presentation">
      <section
        aria-label="Connections Import"
        className="settings-modal"
        style={{ maxWidth: '900px' }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <div>
            <p className="eyebrow">Connections</p>
            <h2>Import & Manage Connections</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close" type="button">
            <X size={18} />
          </button>
        </header>

        <div className="connections-nav" style={{ 
          display: 'flex', 
          gap: '1rem', 
          padding: '1rem',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <button
            className={`connections-nav-button ${currentView === 'import' ? 'active' : ''}`}
            onClick={() => setCurrentView('import')}
            type="button"
          >
            <Upload size={16} />
            Import Connections
          </button>
          <button
            className={`connections-nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
            type="button"
          >
            <Database size={16} />
            View All Connections
          </button>
        </div>

        <div style={{ padding: '1rem' }}>
          {currentView === 'import' && <ConnectionImport />}
          {currentView === 'dashboard' && (
            <div className="surface-card">
              <p className="label">Connections Dashboard</p>
              <h3>Your Professional Network</h3>
              <p>View and manage all your imported connections here.</p>
              <div style={{ marginTop: '1rem' }}>
                <p><strong>Coming soon:</strong> Full connections dashboard with search, filtering, and management capabilities.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
