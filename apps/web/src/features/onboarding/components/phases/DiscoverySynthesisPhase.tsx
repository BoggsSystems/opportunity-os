import React from 'react';
import { Database, Zap, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const DiscoverySynthesisPhase: React.FC = () => {
  const { handleDiscoveryNext } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="discovery-synthesis-container animate-in">
        <div className="synthesis-header">
          <div className="phase-indicator">Phase 04: Discovery Synthesis</div>
          <div className="synthesis-badge">Ecosystem Synthesis Complete</div>
          <h1>Your Global Strategic Map</h1>
          <p>I have fused your professional identity, network topography, and relationship intensity into a unified posture.</p>
        </div>

        <div className="synthesis-grid">
          <div className="synthesis-card leverage-map">
            <h3><Database size={18} /> Network Leverage Density</h3>
            <div className="leverage-metrics">
              <div className="synthesis-metric">
                <span className="val">14,640</span>
                <span className="lab">Global Nodes</span>
              </div>
              <div className="synthesis-metric">
                <span className="val">42</span>
                <span className="lab">Warm Entry Points</span>
              </div>
            </div>
            <div className="synthesis-chart-placeholder">
              <div className="density-map">
                <div className="density-node primary"></div>
                <div className="density-node secondary"></div>
              </div>
              <span>Relationship Graph Mapping...</span>
            </div>
          </div>

          <div className="synthesis-card signal-saturation">
            <h3><Zap size={18} /> Signal Saturation</h3>
            <div className="saturation-list">
              {[
                { label: 'Strategic Influence', val: 88 },
                { label: 'Operational Depth', val: 62 },
                { label: 'Market Proximity', val: 94 }
              ].map(item => (
                <div key={item.label} className="saturation-item">
                  <div className="sat-label">{item.label}</div>
                  <div className="sat-bar">
                    <div className="fill" style={{ width: `${item.val}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="synthesis-conductor-note">
          <div className="conductor-avatar">
            <Zap size={32} />
          </div>
          <div className="note-content">
            <h4>Conductor Synthesis</h4>
            <p>Your network exhibits unusual density in early-stage technical founders and series B strategic investors. Your IP assets suggest a strong framework for scaling operational leadership. I am now ready to generate your first Revenue Lanes.</p>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-primary" onClick={handleDiscoveryNext}>
            Ground Expertise & Generate Strategy <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
