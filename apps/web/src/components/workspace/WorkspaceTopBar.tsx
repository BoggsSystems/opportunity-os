import React from 'react';
import { Users, UserRound, RefreshCw, Loader2, RotateCcw, ChevronDown } from 'lucide-react';
import type { WorkspaceState, SubscriptionSummary, UsageSummary, EntitlementSummary, OfferingSummary, CampaignSummary } from '../../types';

interface WorkspaceTopBarProps {
  workspace: WorkspaceState | null;
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  mode: 'command' | 'map';
  offerings: OfferingSummary[];
  campaigns: CampaignSummary[];
  onModeChange: (mode: 'command' | 'map') => void;
  onSelectCampaign?: (campaignId: string) => void;
  onSelectOffering?: (offeringId: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onPurgeAndSignOut: () => void | Promise<void>;
}

const emptyVelocity = {
  activeGoalCount: 0,
  activeCampaignCount: 0,
  activeOpportunityCount: 0,
  openTaskCount: 0,
  overdueTaskCount: 0,
  outreachSentThisWeek: 0,
  opportunitiesAdvancedThisWeek: 0,
  pendingSignalCount: 0,
  activeCycleCount: 0,
};

// Temporary Metric component - this should be moved to a shared components folder
interface MetricProps {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'red';
}

const Metric: React.FC<MetricProps> = ({ label, value, tone }) => {
  return (
    <div className={`metric metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
};

// Temporary formatRemaining function - this should be moved to utils
function formatRemaining(usage: EntitlementSummary | null | undefined): string {
  if (!usage) return 'No limit';
  if (typeof usage.limit !== 'number') return 'Unlimited';
  const remaining = usage.limit - (usage.used ?? 0);
  return `${remaining}/${usage.limit}`;
}

export const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = (props) => {
  const [isOfferingOpen, setIsOfferingOpen] = React.useState(false);
  const [isCampaignOpen, setIsCampaignOpen] = React.useState(false);

  const velocity = props.workspace?.velocity ?? emptyVelocity;
  const aiUsage = props.usage?.usage?.find((item) => item.featureKey === 'ai_requests');

  const activeCampaignId = props.workspace?.activeCycle?.refs.campaignId;
  const activeCampaign = props.campaigns.find(c => c.id === activeCampaignId);
  const activeOffering = props.offerings.find(o => o.id === activeCampaign?.offeringId) || props.offerings[0];

  const campaignsForOffering = props.campaigns.filter(c => c.offeringId === activeOffering?.id);

  return (
    <header className="workspace-topbar tour-region-status">
      <div className="topbar-context-switcher">
        <div className="context-pills">
          <div className="context-pill-group">
            <span className="context-label">Offering</span>
            <button 
              className="context-value-pill"
              onClick={() => setIsOfferingOpen(!isOfferingOpen)}
            >
              {activeOffering?.title ?? 'No Offering'}
              <ChevronDown size={12} />
              
              {isOfferingOpen && (
                <div className="glass-dropdown">
                  {props.offerings.map(o => (
                    <button 
                      key={o.id} 
                      className={`dropdown-item ${o.id === activeOffering?.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onSelectOffering?.(o.id);
                        setIsOfferingOpen(false);
                      }}
                    >
                      <strong>{o.title}</strong>
                      <span>{o.offeringType}</span>
                    </button>
                  ))}
                </div>
              )}
            </button>
          </div>

          <div className="context-separator">/</div>

          <div className="context-pill-group">
            <span className="context-label">Campaign</span>
            <button 
              className="context-value-pill"
              onClick={() => setIsCampaignOpen(!isCampaignOpen)}
            >
              {activeCampaign?.title ?? 'No Campaign'}
              <ChevronDown size={12} />

              {isCampaignOpen && (
                <div className="glass-dropdown">
                  {campaignsForOffering.length > 0 ? (
                    campaignsForOffering.map(c => (
                      <button 
                        key={c.id} 
                        className={`dropdown-item ${c.id === activeCampaignId ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onSelectCampaign?.(c.id);
                          setIsCampaignOpen(false);
                        }}
                      >
                        <strong>{c.title}</strong>
                        <span>{c.targetSegment || 'Active context'}</span>
                      </button>
                    ))
                  ) : (
                    <div className="dropdown-item">
                      <span>No other campaigns found</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="workspace-mode-switch" role="tablist" aria-label="Workspace mode">
        <button
          type="button"
          role="tab"
          aria-selected={props.mode === 'command'}
          className={props.mode === 'command' ? 'workspace-mode-button active' : 'workspace-mode-button'}
          onClick={() => props.onModeChange('command')}
        >
          Command
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.mode === 'map'}
          className={props.mode === 'map' ? 'workspace-mode-button active' : 'workspace-mode-button'}
          onClick={() => props.onModeChange('map')}
        >
          Map
        </button>
      </div>
      <div className="topbar-actions">
        <button 
          className="connections-nav-button"
          onClick={() => window.location.href = '/connections'}
          title="Manage connections"
          type="button"
        >
          <Users size={18} />
          <span>Connections</span>
        </button>
        <Metric label="Signals" value={velocity.pendingSignalCount} tone="blue" />
        <Metric label="Outreach" value={velocity.outreachSentThisWeek} tone="green" />
        <Metric label="Open tasks" value={velocity.openTaskCount} tone="amber" />
        <div className="plan-pill">
          <span>{props.subscription?.plan.name ?? 'Plan'}</span>
          <strong>{formatRemaining(aiUsage)}</strong>
        </div>
        <button className="icon-button" onClick={props.onOpenSettings} title="Open settings" type="button">
          <UserRound size={18} />
        </button>
        <button className="icon-button" onClick={props.onRefresh} title="Refresh workspace" type="button">
          {props.isLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
        <button className="danger-icon-button" onClick={() => void props.onPurgeAndSignOut()} title="Scrub backend data and sign out" type="button">
          <RotateCcw size={18} />
        </button>
      </div>
    </header>
  );
};
