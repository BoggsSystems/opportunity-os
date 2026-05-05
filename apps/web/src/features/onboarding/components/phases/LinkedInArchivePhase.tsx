import React from 'react';
import { ArrowRight, CheckCircle, Upload, Network, AlertCircle, Brain, Clock, Database, Layers } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const LinkedInArchivePhase: React.FC = () => {
  const {
    handleLinkedInArchiveUpload,
    nextStep,
    connectionCount,
    isLoading,
    intelligenceArtifacts,
    intelligenceJobs,
    intelligenceChunks,
  } = useOnboarding();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = React.useState('');
  const [message, setMessage] = React.useState('');

  const linkedinArtifacts = React.useMemo(() => {
    return intelligenceArtifacts
      .filter((artifact: any) => artifact.providerName === 'linkedin' || artifact.sourceKind === 'linkedin_archive_file')
      .slice(0, 8);
  }, [intelligenceArtifacts]);

  const linkedinJobCount = React.useMemo(() => {
    const artifactIds = new Set(linkedinArtifacts.map((artifact: any) => artifact.id));
    return intelligenceJobs.filter((job: any) => artifactIds.has(job.ingestionArtifactId)).length;
  }, [intelligenceJobs, linkedinArtifacts]);

  const linkedinChunkCount = React.useMemo(() => {
    const artifactIds = new Set(linkedinArtifacts.map((artifact: any) => artifact.id));
    return intelligenceChunks.filter((chunk: any) => artifactIds.has(chunk.ingestionArtifactId)).length;
  }, [intelligenceChunks, linkedinArtifacts]);

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('uploading');
    setMessage('Mapping your LinkedIn relationship graph...');

    try {
      await handleLinkedInArchiveUpload(file);
      setStatus('success');
      setMessage('Fast memory captured. Deep archive analysis is queued in the background.');
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
        <div className="ingestion-intelligence-panel animate-in">
          <div className="intelligence-summary-grid">
            <div className="intelligence-summary-card">
              <Database size={18} />
              <span>Captured</span>
              <strong>{connectionCount.toLocaleString()}</strong>
              <small>relationship records</small>
            </div>
            <div className="intelligence-summary-card">
              <Clock size={18} />
              <span>Queued</span>
              <strong>{linkedinJobCount.toLocaleString()}</strong>
              <small>background jobs</small>
            </div>
            <div className="intelligence-summary-card">
              <Brain size={18} />
              <span>Available</span>
              <strong>{linkedinChunkCount.toLocaleString()}</strong>
              <small>memory chunks</small>
            </div>
          </div>

          <div className="intelligence-section-list">
            <div className="intelligence-section-heading">
              <Layers size={16} />
              <span>Archive sections</span>
            </div>
            {linkedinArtifacts.length > 0 ? (
              linkedinArtifacts.map((artifact: any) => (
                <div className="intelligence-section-row" key={artifact.id}>
                  <div>
                    <strong>{formatArchiveName(artifact.sourceName || artifact.sourcePath)}</strong>
                    <span>{artifact.recordCount ? `${Number(artifact.recordCount).toLocaleString()} records` : artifact.sourcePath || 'LinkedIn export section'}</span>
                  </div>
                  <StatusPill status={artifact.status} />
                </div>
              ))
            ) : (
              <div className="intelligence-section-empty">
                The backend will expose archive sections here after the upload is processed.
              </div>
            )}
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

const formatArchiveName = (name?: string) => {
  if (!name) return 'LinkedIn archive section';
  return name.replace(/\.csv$/i, '').replace(/_/g, ' ');
};

const StatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const label = status === 'processed'
    ? 'Summarized'
    : status === 'processing'
      ? 'Processing'
      : status === 'failed'
        ? 'Needs review'
        : 'Queued';

  return <span className={`intelligence-status-pill ${status || 'queued'}`}>{label}</span>;
};
