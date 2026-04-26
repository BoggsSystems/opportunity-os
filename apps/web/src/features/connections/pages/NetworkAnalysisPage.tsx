import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { NetworkAnalysis } from '../components/NetworkAnalysis';

export const NetworkAnalysisPage: React.FC = () => {
  const handleBack = () => {
    window.history.back();
  };

  return (
    <div className="network-analysis-page">
      <div className="page-header">
        <button onClick={handleBack} className="back-button">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </button>
        <h1>Network Analysis</h1>
        <p>Discover insights and opportunities in your professional network</p>
      </div>

      <div className="page-content">
        <NetworkAnalysis />
      </div>
    </div>
  );
};
