import React from 'react';
import { ArrowRight, CheckCircle, Upload, Network, AlertCircle } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const LinkedInArchivePhase: React.FC = () => {
  const { handleLinkedInArchiveUpload, nextStep, connectionCount, isLoading } = useOnboarding();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = React.useState('');
  const [message, setMessage] = React.useState('');

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('uploading');
    setMessage('Mapping your LinkedIn relationship graph...');

    try {
      await handleLinkedInArchiveUpload(file);
      setStatus('success');
      setMessage('LinkedIn archive ingested.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'LinkedIn archive ingestion failed.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 03: LinkedIn Archive</div>
        <h1>Upload your LinkedIn archive.</h1>
        <p>This is the high-signal relationship graph. I will use it to understand your network, profile, roles, skills, and warm opportunity paths.</p>
      </div>

      <div className={`drop-zone ingestion-drop-zone ${status === 'success' ? 'success' : ''} ${status === 'error' ? 'error' : ''}`}>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="visually-hidden-file"
          onChange={handleSelect}
        />
        <div className="drop-zone-content">
          <div className="upload-icon-wrapper">
            {status === 'success' ? <CheckCircle size={32} /> : status === 'error' ? <AlertCircle size={32} /> : <Network size={32} />}
          </div>
          <h3>{status === 'success' ? 'Relationship graph mapped' : 'LinkedIn data export ZIP'}</h3>
          <p>{fileName || 'Upload the ZIP from LinkedIn Settings > Data privacy > Get a copy of your data.'}</p>
          {message && <p className="ingestion-status-copy">{message}</p>}
          <button
            type="button"
            className="onboarding-btn-secondary"
            onClick={() => inputRef.current?.click()}
            disabled={status === 'uploading' || isLoading}
          >
            <Upload size={16} />
            {status === 'success' ? 'Upload Another ZIP' : status === 'uploading' ? 'Ingesting...' : 'Select LinkedIn ZIP'}
          </button>
        </div>
      </div>

      {status === 'success' && (
        <div className="asset-list animate-in">
          <div className="asset-item">
            <CheckCircle size={16} />
            <span>{connectionCount.toLocaleString()} relationship records captured</span>
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('relationships')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('manual-assets')}>
          Continue to Strategic Assets <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
