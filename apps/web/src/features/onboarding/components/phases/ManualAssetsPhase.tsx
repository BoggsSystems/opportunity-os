import React from 'react';
import { ArrowRight, CheckCircle, FileText, Upload, AlertCircle, Brain, Clock, Database } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const ManualAssetsPhase: React.FC = () => {
  const {
    handleManualAssetUpload,
    uploadedAssets,
    nextStep,
    isLoading,
    ingestionStatus,
    intelligenceArtifacts,
    intelligenceJobs,
    intelligenceChunks,
  } = useOnboarding();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  const assetArtifacts = React.useMemo(() => {
    return intelligenceArtifacts
      .filter((artifact: any) => ['google_drive_file', 'onedrive_file', 'manual_upload', 'knowledge_asset_asset', 'connector_asset_asset'].includes(artifact.sourceKind))
      .slice(0, 6);
  }, [intelligenceArtifacts]);

  const assetJobCount = React.useMemo(() => {
    const artifactIds = new Set(assetArtifacts.map((artifact: any) => artifact.id));
    return intelligenceJobs.filter((job: any) => artifactIds.has(job.ingestionArtifactId)).length;
  }, [assetArtifacts, intelligenceJobs]);

  const assetChunkCount = React.useMemo(() => {
    const artifactIds = new Set(assetArtifacts.map((artifact: any) => artifact.id));
    return intelligenceChunks.filter((chunk: any) => artifactIds.has(chunk.ingestionArtifactId)).length;
  }, [assetArtifacts, intelligenceChunks]);

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setMessage(`Interpreting ${file.name}...`);

    try {
      await handleManualAssetUpload(file);
      setStatus('success');
      setMessage(`${file.name} has been grounded as strategic proof.`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Asset ingestion failed.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 04: Strategic Assets</div>
        <h1>Ground the system in your proof.</h1>
        <p>Upload your resume, book PDF, deck, or portfolio. I will extract the frameworks, proof points, and positioning material that should shape your offerings.</p>
      </div>

      <div className={`drop-zone ingestion-drop-zone ${status === 'success' ? 'success' : ''} ${status === 'error' ? 'error' : ''}`}>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="visually-hidden-file"
          onChange={handleSelect}
        />
        <div className="drop-zone-content">
          <div className="upload-icon-wrapper">
            {status === 'success' ? <CheckCircle size={32} /> : status === 'error' ? <AlertCircle size={32} /> : <FileText size={32} />}
          </div>
          <h3>{uploadedAssets.length > 0 ? 'Strategic assets grounded' : 'Upload a strategic PDF'}</h3>
          <p>For this onboarding pass, PDF assets are supported.</p>
          {message && <p className="ingestion-status-copy">{message}</p>}
          <button
            type="button"
            className="onboarding-btn-secondary"
            onClick={() => inputRef.current?.click()}
            disabled={status === 'uploading' || isLoading}
          >
            <Upload size={16} />
            {status === 'uploading' ? 'Ingesting...' : uploadedAssets.length > 0 ? 'Upload Another Asset' : 'Select PDF Asset'}
          </button>
        </div>
      </div>

      {uploadedAssets.length > 0 && (
        <div className="asset-list animate-in">
          {uploadedAssets.map((asset: any, index: number) => (
            <div className="asset-item" key={`${asset.title}-${index}`}>
              <CheckCircle size={16} />
              <span>{asset.title}</span>
            </div>
          ))}
        </div>
      )}

      {(uploadedAssets.length > 0 || assetArtifacts.length > 0 || ingestionStatus) && (
        <div className="ingestion-intelligence-panel animate-in">
          <div className="intelligence-summary-grid">
            <div className="intelligence-summary-card">
              <Database size={18} />
              <span>Grounded</span>
              <strong>{Math.max(uploadedAssets.length, assetArtifacts.length).toLocaleString()}</strong>
              <small>strategic assets</small>
            </div>
            <div className="intelligence-summary-card">
              <Clock size={18} />
              <span>Queued</span>
              <strong>{assetJobCount.toLocaleString()}</strong>
              <small>analysis jobs</small>
            </div>
            <div className="intelligence-summary-card">
              <Brain size={18} />
              <span>Available</span>
              <strong>{assetChunkCount.toLocaleString()}</strong>
              <small>memory chunks</small>
            </div>
          </div>

          {ingestionStatus && (
            <div className="intelligence-progress-row">
              <div>
                <strong>{ingestionStatus.assetName || ingestionStatus.step}</strong>
                <span>{ingestionStatus.message || 'Background intelligence update'}</span>
              </div>
              <div className="intelligence-progress-track" aria-label="Ingestion progress">
                <span style={{ width: `${Math.max(0, Math.min(100, ingestionStatus.percentage))}%` }} />
              </div>
            </div>
          )}

          {assetArtifacts.length > 0 && (
            <div className="intelligence-section-list">
              {assetArtifacts.map((artifact: any) => (
                <div className="intelligence-section-row" key={artifact.id}>
                  <div>
                    <strong>{artifact.sourceName}</strong>
                    <span>{artifact.providerName || artifact.sourceKind}</span>
                  </div>
                  <span className={`intelligence-status-pill ${artifact.status}`}>{formatAssetStatus(artifact.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('linkedin-archive')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('intent')}>
          Generate Offerings <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

const formatAssetStatus = (status?: string) => {
  if (status === 'processed') return 'Summarized';
  if (status === 'processing') return 'Processing';
  if (status === 'failed') return 'Needs review';
  return 'Queued';
};
