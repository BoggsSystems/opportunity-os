import React, { useEffect, useState, useRef } from 'react';
import './IngestionProgressModal.css';

interface IngestionProgressModalProps {
  isOpen: boolean;
  batchId: string | null;
  onComplete: () => void;
  status: {
    assetName?: string;
    step: string;
    percentage: number;
    message?: string;
  } | null;
}

export const IngestionProgressModal: React.FC<IngestionProgressModalProps> = ({
  isOpen,
  batchId,
  onComplete,
  status,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status?.message) {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${status.message}`].slice(-10));
    }
  }, [status?.message]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="ingestion-modal-overlay">
      <div className="ingestion-modal-content">
        <div className="ingestion-modal-header">
          <div className="ingestion-scanner-line"></div>
          <h2>Strategic Ingestion Active</h2>
          <div className="ingestion-status-badge">COMMANDER ONLINE</div>
        </div>

        <div className="ingestion-modal-body">
          <div className="ingestion-progress-section">
            <div className="ingestion-progress-info">
              <span className="ingestion-current-step">{status?.step || 'Initializing...'}</span>
              <span className="ingestion-percentage">{status?.percentage || 0}%</span>
            </div>
            <div className="ingestion-progress-bar-container">
              <div 
                className="ingestion-progress-bar-fill" 
                style={{ width: `${status?.percentage || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="ingestion-active-asset">
            <div className="ingestion-asset-label">TARGET ASSET</div>
            <div className="ingestion-asset-name">{status?.assetName || 'Synchronizing with Vault...'}</div>
          </div>

          <div className="ingestion-telemetry">
            <div className="ingestion-telemetry-header">LIVE TELEMETRY</div>
            <div className="ingestion-telemetry-logs" ref={scrollRef}>
              {logs.map((log, i) => (
                <div key={i} className="ingestion-log-entry">{log}</div>
              ))}
              {status?.percentage === 100 && (
                <div className="ingestion-log-entry success">✅ MISSION COMPLETE: ALL CONCEPTS GROUNDED.</div>
              )}
            </div>
          </div>
        </div>

        {status?.percentage === 100 && (
          <div className="ingestion-modal-footer">
            <button className="ingestion-complete-btn" onClick={onComplete}>
              Finalize Calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
