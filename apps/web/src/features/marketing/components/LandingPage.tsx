import React, { useEffect, useState } from 'react';
import { ArrowRight, Database, Target, Rocket, Zap, Activity } from 'lucide-react';
import '../css/LandingPage.css';

interface LandingPageProps {
  onStart: (mode?: 'login' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">
          <div className="logo-icon" />
          <span>OPPORTUNITY OS</span>
        </div>
        <div className="nav-links">
          <a href="#system">System</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#network">Network</a>
          <button className="nav-login" onClick={() => onStart('login')}>Log In</button>
          <button className="nav-cta" onClick={() => onStart('signup')}>Initialize</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="vortex-background">
          <div className="vortex-layer layer-1" />
          <div className="vortex-layer layer-2" />
          <div className="vortex-layer layer-3" />
          <div className="vortex-overlay" />
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} />
            <span>v1.0 Alpha Access</span>
          </div>
          <h1 className="hero-title">
            Increase and Improve <br />
            <span className="gradient-text">Your Outreach.</span>
          </h1>
          <p className="hero-subtitle">
            Opportunity OS combines your network with your unique expertise to generate high-quality conversations at scale. <br />
            Discover. Connect. Act. Optimize.
          </p>
          
          <div className="hero-actions">
            <button className="btn-initialize" onClick={() => onStart('signup')}>
              Initialize System <ArrowRight size={20} />
            </button>
            <button className="btn-secondary">
              View Documentation
            </button>
          </div>
        </div>

        {/* Opportunity Vortex Info */}
        <div className="vortex-info-container">
          <div className="info-node n-1">
            <div className="node-dot" />
            <div className="node-text">
              <strong>1. SIGNAL</strong>
              <span>Antenna, data points</span>
            </div>
          </div>
          <div className="info-node n-2">
            <div className="node-dot" />
            <div className="node-text">
              <strong>2. AGGREGATE</strong>
              <span>Data synthesis</span>
            </div>
          </div>
          <div className="info-node n-3">
            <div className="node-dot" />
            <div className="node-text">
              <strong>3. ANALYZE</strong>
              <span>Strategic insights</span>
            </div>
          </div>
          <div className="info-node n-4">
            <div className="node-dot" />
            <div className="node-text">
              <strong>4. ACTIVATE</strong>
              <span>Action, connection</span>
            </div>
          </div>
          <div className="info-node n-5">
            <div className="node-dot" />
            <div className="node-text">
              <strong>5. OPTIMIZE</strong>
              <span>Growth feedback</span>
            </div>
          </div>
          
          <div className="central-opportunity">
            <div className="opportunity-text">OPPORTUNITY</div>
            <div className="opportunity-rings">
              <div className="ring" />
              <div className="ring" />
              <div className="ring" />
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section id="system" className="pillars-section">
        <div className="section-header">
          <div className="chapter-label">Operating System</div>
          <h2>The Strategic Engine</h2>
          <p>The core orchestration layers of Opportunity OS</p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon blue">
              <Database size={32} />
            </div>
            <h3>Network Audit</h3>
            <p>Identify every high-value node in your existing network. We scan your history to find the hidden leverage you already have.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-icon purple">
              <Target size={32} />
            </div>
            <h3>Expertise Grounding</h3>
            <p>We digest your books, decks, and case studies to ensure every outreach sounds exactly like your best self.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-icon green">
              <Rocket size={32} />
            </div>
            <h3>Conversation Engine</h3>
            <p>Turn your data into action. Launch automated, high-signal outreach campaigns that actually get responses.</p>
          </div>
        </div>
      </section>

      {/* Objectives Section */}
      <section className="objectives-section">
        <div className="section-header">
          <div className="chapter-label">Applications</div>
          <h2>Select Your Objective</h2>
          <p>Opportunity OS adapts to your specific professional mission.</p>
        </div>

        <div className="objectives-grid">
          <div className="objective-card">
            <div className="objective-badge">Founders</div>
            <h3>Scale Outreach</h3>
            <p>Find your first 10 design partners or new clients without spending 20 hours a week on manual research.</p>
            <ul className="objective-list">
              <li><Activity size={14} /> Automated lead discovery</li>
              <li><Activity size={14} /> Strategic outreach drafts</li>
              <li><Activity size={14} /> Network leverage auditing</li>
            </ul>
          </div>

          <div className="objective-card featured">
            <div className="objective-badge">Job Seekers</div>
            <h3>Career Alpha</h3>
            <p>Leverage your hidden network to find senior roles that never hit the job boards.</p>
            <ul className="objective-list">
              <li><Activity size={14} /> Identify hiring clusters</li>
              <li><Activity size={14} /> Warm intro automation</li>
              <li><Activity size={14} /> Expertise gap analysis</li>
            </ul>
          </div>

          <div className="objective-card">
            <div className="objective-badge">Consultants</div>
            <h3>Growth Engine</h3>
            <p>Scale your practice by identifying high-probability leads already in your ecosystem.</p>
            <ul className="objective-list">
              <li><Activity size={14} /> Relationship monitoring</li>
              <li><Activity size={14} /> Market thesis generation</li>
              <li><Activity size={14} /> Pipeline orchestration</li>
            </ul>
          </div>
        </div>
        
        <div className="cta-container">
          <button className="btn-initialize large" onClick={() => onStart('signup')}>
            Initialize My Mission <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="nav-logo">
            <div className="logo-icon" />
            <span>OPPORTUNITY OS</span>
          </div>
          <p>© 2024 Connected Ventures. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
