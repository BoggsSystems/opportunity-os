import React from 'react';
import { NetworkAnalysis } from '../components/NetworkAnalysis';

export const ConnectionsAnalysisApp: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ 
        background: 'white', 
        borderBottom: '1px solid #e5e7eb', 
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            onClick={() => window.history.back()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            ← Back to Settings
          </button>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
          Network Analysis
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Discover insights and opportunities in your professional network
        </p>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <NetworkAnalysis />
      </div>
    </div>
  );
};
