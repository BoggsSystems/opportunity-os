import React from 'react';
import type { WorkspaceSignalSummary } from '../../types';

interface SignalsPanelProps {
  signals: WorkspaceSignalSummary[];
  activeSignalId?: string;
  isWorking: boolean;
  onActivate: (signal: WorkspaceSignalSummary) => void;
  onDismiss: (signal: WorkspaceSignalSummary) => void;
}

export const SignalsPanel: React.FC<SignalsPanelProps> = (props) => {
  return (
    <div className="signals-panel">
      <h3>Signals</h3>
      {props.signals.length === 0 ? (
        <p>No signals available</p>
      ) : (
        <div className="signals-list">
          {props.signals.map((signal) => (
            <div
              key={signal.id}
              className={`signal-item ${props.activeSignalId === signal.id ? 'active' : ''}`}
            >
              <h4>{signal.title}</h4>
              <div className="signal-actions">
                <button
                  onClick={() => props.onActivate(signal)}
                  disabled={props.isWorking}
                  type="button"
                >
                  Activate
                </button>
                <button
                  onClick={() => props.onDismiss(signal)}
                  disabled={props.isWorking}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
