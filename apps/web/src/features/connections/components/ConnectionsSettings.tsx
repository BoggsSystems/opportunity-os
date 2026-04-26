import React, { useState } from 'react';
import { Users, Database } from 'lucide-react';
import { ConnectionsImportModal } from './ConnectionsImportModal';

interface ConnectionsSettingsProps {
  isWorking: boolean;
}

export const ConnectionsSettings: React.FC<ConnectionsSettingsProps> = ({ isWorking }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openImportModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <div className="settings-section">
        <div className="surface-card">
          <p className="label">LinkedIn Connections</p>
          <h3>Import and manage your professional network</h3>
          <p>
            Import your LinkedIn connections to build a comprehensive prospecting database. 
            The system handles LinkedIn's CSV export format and automatically detects duplicates.
          </p>
        </div>
        <div className="action-grid">
          <button
            className="primary-button"
            disabled={isWorking}
            onClick={openImportModal}
            type="button"
          >
            <Users size={16} />
            Import Connections
          </button>
          <button
            className="secondary-button"
            disabled={isWorking}
            onClick={openImportModal}
            type="button"
          >
            <Database size={16} />
            View All Connections
          </button>
        </div>
        <div className="surface-card" style={{ marginTop: '1rem' }}>
          <p className="label">Import Features</p>
          <div className="settings-detail-list">
            <div>
              <span>LinkedIn CSV Support</span>
              <strong>✓ Handles LinkedIn export format</strong>
            </div>
            <div>
              <span>Smart Duplicate Detection</span>
              <strong>✓ 4-tier matching algorithm</strong>
            </div>
            <div>
              <span>Email Privacy Handling</span>
              <strong>✓ Accepts missing emails</strong>
            </div>
            <div>
              <span>Field Mapping</span>
              <strong>✓ Maps LinkedIn headers automatically</strong>
            </div>
          </div>
        </div>
      </div>
      
      <ConnectionsImportModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
};
