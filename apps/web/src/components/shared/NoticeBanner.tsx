import React from 'react';

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface NoticeBannerProps {
  notice: Notice;
  compact?: boolean;
  onDismiss?: () => void;
  onSilence?: () => void;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({ notice, compact, onDismiss, onSilence }) => {
  return (
    <div className={`notice-banner notice-${notice.tone} ${compact ? 'compact' : ''}`}>
      <div className="notice-content">
        <h4>{notice.title}</h4>
        <p>{notice.detail}</p>
      </div>
      <div className="notice-actions">
        {onSilence && (
          <button className="notice-silence" onClick={onSilence} type="button">
            Don&apos;t show again
          </button>
        )}
        {onDismiss && (
          <button className="notice-dismiss" onClick={onDismiss} type="button">
            ×
          </button>
        )}
      </div>
    </div>
  );
};
