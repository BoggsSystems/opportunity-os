import React, { useState } from 'react';
import { ConnectionsNavigation } from '../components/ConnectionsNavigation';
import { ConnectionDashboard } from '../components/ConnectionDashboard';
import { ConnectionImport } from '../components/ConnectionImport';

type ConnectionsView = 'dashboard' | 'import';

export const ConnectionsPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<ConnectionsView>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <ConnectionsNavigation
        currentView={currentView}
        onViewChange={setCurrentView}
        onClose={() => {}}
      />
      
      <div className="py-8">
        {currentView === 'dashboard' && <ConnectionDashboard />}
        {currentView === 'import' && <ConnectionImport />}
      </div>
    </div>
  );
};
