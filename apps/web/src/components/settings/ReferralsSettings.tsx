import React, { useState } from 'react';
import { Copy, Check, Share2, Users, Trophy, ExternalLink } from 'lucide-react';
import type { CommercialState } from '../../types';

interface ReferralsSettingsProps {
  commercialState: CommercialState | null;
}

export const ReferralsSettings: React.FC<ReferralsSettingsProps> = ({ commercialState }) => {
  const [copied, setCopied] = useState(false);
  const referral = commercialState?.referral;

  const handleCopy = () => {
    if (!referral?.url) return;
    navigator.clipboard.writeText(referral.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(referral?.url || '');
    const text = encodeURIComponent("I'm using Opportunity OS to automate my revenue lanes. Check it out!");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  if (!referral) {
    return (
      <div className="referral-empty">
        <p>Referral program is not active for this account.</p>
      </div>
    );
  }

  return (
    <div className="referral-settings-container">
      <div className="referral-hero-card">
        <div className="hero-content">
          <div className="hero-badge">Earn AI Credits</div>
          <h2>Invite your network to Opportunity OS</h2>
          <p>
            Grow your professional impact. For every person you invite who upgrades to a paid plan, 
            you'll both receive <strong>100 bonus AI credits</strong>.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <Users size={20} />
            <div className="stat-value">0</div>
            <div className="stat-label">Invited</div>
          </div>
          <div className="stat-item highlight">
            <Trophy size={20} />
            <div className="stat-value">0</div>
            <div className="stat-label">Credits Earned</div>
          </div>
        </div>
      </div>

      <div className="referral-link-section">
        <h3>Your personal referral link</h3>
        <div className="copy-link-group">
          <input 
            type="text" 
            readOnly 
            value={referral.url} 
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button className={`copy-btn ${copied ? 'success' : ''}`} onClick={handleCopy}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="referral-actions-grid">
        <button className="social-action-btn linkedin" onClick={handleShareLinkedIn}>
          <Share2 size={18} />
          <span>Share on LinkedIn</span>
        </button>
        <div className="referral-info-card">
          <h4>How it works</h4>
          <ol>
            <li>Share your unique link with colleagues or on social media.</li>
            <li>They sign up and explore the platform for free.</li>
            <li>When they upgrade to any paid plan, you <strong>both</strong> get rewarded.</li>
          </ol>
        </div>
      </div>

      <div className="referral-history-section">
        <div className="section-header">
          <h3>Recent Activity</h3>
          <span className="status-label">Live Updates</span>
        </div>
        <div className="activity-placeholder">
          <p>No referrals yet. Start sharing to see activity here!</p>
        </div>
      </div>
    </div>
  );
};
