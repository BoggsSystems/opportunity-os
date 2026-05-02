import React from 'react';
import { Upload, ArrowRight, CheckCircle } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const KnowledgePhase: React.FC = () => {
  const { uploadStatus, setUploadStatus, nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 05: Knowledge Grounding</div>
        <h1>What have you built?</h1>
        <p>Upload your book PDF, decks, resume, or portfolio. I'll extract your core frameworks to ground our outreach.</p>
      </div>

      <div className={`drop-zone ${uploadStatus === 'success' ? 'success' : ''}`}>
        <div className="drop-zone-content">
          <div className="upload-icon-wrapper">
            <Upload size={32} />
          </div>
          <h3>{uploadStatus === 'success' ? 'Assets Grounded' : 'Drag & Drop your strategic assets'}</h3>
          <p>Support for PDF, DOCX, and presentations.</p>
          <button 
            className="onboarding-btn-secondary"
            onClick={() => setUploadStatus('success')}
          >
            {uploadStatus === 'success' ? 'Upload More' : 'Select Files'}
          </button>
        </div>
      </div>

      {uploadStatus === 'success' && (
        <div className="asset-list animate-in">
          <div className="asset-item">
            <CheckCircle size={16} />
            <span>Strategic_Framework_v2.pdf</span>
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('discovery-synthesis')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('intent')}>
          Ground Expertise & Draft Intent <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
