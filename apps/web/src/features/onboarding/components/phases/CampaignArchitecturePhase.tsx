import React from 'react';
import { ArrowRight, CheckCircle, Edit3, Gauge, Info, MessageSquare, Radio, Target, Timer, Trophy, Users, X, type LucideIcon } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

type DimensionKey = 'objective' | 'audience' | 'hook' | 'channels' | 'duration' | 'cadence' | 'successMetric';

type CampaignDimensions = {
  objective: string;
  audience: string;
  hook: string;
  channels: string[];
  duration: string;
  cadence: string;
  successMetric: string;
};

type DimensionMeta = {
  key: DimensionKey;
  label: string;
  icon: LucideIcon;
  oneLine: string;
  guidance: string;
  why: string;
  recommended: string;
  options: Array<{ label: string; description: string }>;
};

const DEFAULT_DIMENSIONS: CampaignDimensions = {
  objective: 'Book qualified conversations',
  audience: 'Warm network and adjacent decision makers',
  hook: 'AI-native transformation insight',
  channels: ['LinkedIn DM', 'Email'],
  duration: '30 day campaign',
  cadence: 'Moderate daily push',
  successMetric: 'Qualified replies',
};

const DIMENSIONS: DimensionMeta[] = [
  {
    key: 'objective',
    label: 'Objective',
    icon: Target,
    oneLine: 'What the campaign is trying to produce.',
    guidance: 'Objective defines the outcome this campaign is designed to create. It keeps the campaign from becoming generic activity.',
    why: 'For a consulting or authority offer, the first campaign usually should create qualified conversations before trying to close revenue directly.',
    recommended: 'Book qualified conversations',
    options: [
      { label: 'Book qualified conversations', description: 'Best when you want replies that can become calls, proposals, or warm opportunity paths.' },
      { label: 'Validate the offer', description: 'Best when the message, buyer, or packaging still needs market feedback.' },
      { label: 'Promote authority content', description: 'Best when the offer is supported by a book, post series, webinar, or intellectual asset.' },
      { label: 'Generate warm introductions', description: 'Best when the buyer is easier to reach through trusted mutual relationships.' },
    ],
  },
  {
    key: 'audience',
    label: 'Audience',
    icon: Users,
    oneLine: 'Who the campaign is aimed at.',
    guidance: 'Audience defines the people this campaign will speak to. A tighter audience makes every message and action easier to personalize.',
    why: 'Starting with your warm and adjacent network lets the engine use relationship context while still leaving room to expand outward.',
    recommended: 'Warm network and adjacent decision makers',
    options: [
      { label: 'Warm network and adjacent decision makers', description: 'Use first when your LinkedIn archive contains useful relationship paths.' },
      { label: 'CTOs and software executives', description: 'Best for SDLC audit, transformation, and executive briefing offers.' },
      { label: 'Founders and operators', description: 'Best for product, MVP, and hands-on advisory offers.' },
      { label: 'Recruiters and talent leaders', description: 'Best for role-market, consulting pipeline, and book-led professional visibility.' },
    ],
  },
  {
    key: 'hook',
    label: 'Strategic Hook',
    icon: MessageSquare,
    oneLine: 'Why this audience should care now.',
    guidance: 'The hook becomes the spine of outreach, posts, comments, and follow-up. It is the angle the campaign repeats in different forms.',
    why: 'Your strongest current signal connects AI-native development, software velocity, and your book/thought leadership.',
    recommended: 'AI-native transformation insight',
    options: [
      { label: 'AI-native transformation insight', description: 'Best broad umbrella for connecting book, consulting, and software execution expertise.' },
      { label: 'Software velocity and cost compression', description: 'Best for executives who care about throughput, delivery economics, and AI leverage.' },
      { label: 'Team redesign and operating model', description: 'Best when the buyer is wrestling with org structure, process, or post-AI team shape.' },
      { label: 'Book-led thought leadership', description: 'Best when the campaign should lead with credibility, education, and authority.' },
    ],
  },
  {
    key: 'channels',
    label: 'Channels',
    icon: Radio,
    oneLine: 'Where the campaign will act.',
    guidance: 'Channels define the execution lanes the action engine can use. Multiple channels work best when they share the same campaign logic.',
    why: 'LinkedIn DM plus email gives you a high-trust manual path and a direct outbound path without overcomplicating the first campaign.',
    recommended: 'LinkedIn DM + Email',
    options: [
      { label: 'LinkedIn DM', description: 'Best for warm relationship paths and manually reviewed high-trust outreach.' },
      { label: 'Email', description: 'Best for direct outreach, follow-up, and longer-form positioning.' },
      { label: 'LinkedIn posts', description: 'Best for creating public authority and giving outreach a visible proof layer.' },
      { label: 'Warm intros', description: 'Best when mutual connections can improve trust and response rates.' },
      { label: 'Comments/replies', description: 'Best for engaging around existing conversations before direct outreach.' },
    ],
  },
  {
    key: 'duration',
    label: 'Campaign Length',
    icon: Timer,
    oneLine: 'How long the campaign runs.',
    guidance: 'Length defines the operating window. It determines how much time the engine has to execute, observe replies, learn, and recommend follow-ups.',
    why: 'A 30 day campaign is long enough to generate real signal without turning the first campaign into an indefinite project.',
    recommended: '30 day campaign',
    options: [
      { label: '1 week sprint', description: 'Best for testing a sharp message or promoting a time-sensitive asset.' },
      { label: '2 week campaign', description: 'Best for focused validation without committing to a full month.' },
      { label: '30 day campaign', description: 'Best default for outreach plus follow-up, content support, and reply learning.' },
      { label: '60 day campaign', description: 'Best for slower enterprise audiences or relationship-heavy motions.' },
      { label: 'Ongoing nurture', description: 'Best for low-pressure thought leadership and long-term relationship development.' },
    ],
  },
  {
    key: 'cadence',
    label: 'Cadence',
    icon: Gauge,
    oneLine: 'How much daily pressure to apply.',
    guidance: 'Cadence defines the action volume and follow-up pressure. It combines with campaign length to determine workload.',
    why: 'Moderate daily push gives enough momentum for 60-100 actions in a month while keeping manual review realistic.',
    recommended: 'Moderate daily push',
    options: [
      { label: 'Conservative daily touch', description: 'Best when quality and personalization matter more than speed.' },
      { label: 'Moderate daily push', description: 'Best default for building momentum without overwhelming the operator.' },
      { label: 'Aggressive launch sprint', description: 'Best when you want high action volume and are ready to review/send daily.' },
    ],
  },
  {
    key: 'successMetric',
    label: 'Success Metric',
    icon: Trophy,
    oneLine: 'How we know the campaign is working.',
    guidance: 'Success metric defines what the system should optimize for. It should measure outcome, not just activity.',
    why: 'Qualified replies are the clearest early signal that offer, audience, hook, and channel are resonating.',
    recommended: 'Qualified replies',
    options: [
      { label: 'Qualified replies', description: 'Best early signal for outreach campaigns.' },
      { label: 'Discovery calls booked', description: 'Best when the campaign is already validated and call conversion matters most.' },
      { label: 'Warm intro paths opened', description: 'Best when relationship routing is the main goal.' },
      { label: 'Content engagement', description: 'Best when posts, comments, and authority-building are the main campaign surface.' },
    ],
  },
];

export const CampaignArchitecturePhase: React.FC = () => {
  const {
    proposedCampaigns,
    selectedCampaigns,
    setSelectedCampaigns,
    designActionLanes,
    nextStep,
    isLoading,
    proposedOfferings,
    selectedLanes,
    currentOfferingIndex,
    generateNextCampaign,
  } = useOnboarding();

  const [dimensions, setDimensions] = React.useState<CampaignDimensions>(DEFAULT_DIMENSIONS);
  const [editingKey, setEditingKey] = React.useState<DimensionKey | null>(null);

  const currentOfferingId = selectedLanes[currentOfferingIndex];
  const currentOffering = proposedOfferings.find((offering: any) => offering.id === currentOfferingId);
  const currentCampaign = proposedCampaigns.find((campaign: any) => campaign.offeringId === currentOfferingId);
  const completedCampaigns = proposedCampaigns.filter((campaign: any) => selectedLanes.includes(campaign.offeringId));
  const editingDimension = DIMENSIONS.find(dimension => dimension.key === editingKey);

  React.useEffect(() => {
    setDimensions(DEFAULT_DIMENSIONS);
    setEditingKey(null);
  }, [currentOfferingId]);

  const selectedValue = (key: DimensionKey) => key === 'channels' ? dimensions.channels.join(' + ') : dimensions[key];

  const selectOption = (key: DimensionKey, option: string) => {
    if (key === 'channels') {
      setDimensions(prev => {
        const channels = prev.channels.includes(option)
          ? prev.channels.filter(item => item !== option)
          : [...prev.channels, option];
        return { ...prev, channels: channels.length > 0 ? channels : [option] };
      });
      return;
    }

    setDimensions(prev => ({ ...prev, [key]: option }));
  };

  const handleGenerate = () => {
    void generateNextCampaign(dimensions);
  };

  const handleToggle = (id: string) => {
    setSelectedCampaigns((prev: string[]) =>
      prev.includes(id) ? prev.filter((campaignId: string) => campaignId !== id) : [...prev, id],
    );
  };

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 07: Campaign Architecture</div>
        <h1>Shape each campaign before I draft it.</h1>
        <p>Configure the campaign blueprint. Open any dimension when you want more guidance or different options.</p>
      </div>

      <div className="sequential-architecture-hub">
        {completedCampaigns.length > 0 && (
          <div className="campaign-progress-strip">
            {completedCampaigns.map((campaign: any) => (
              <button
                key={campaign.id}
                type="button"
                className={`campaign-progress-chip ${selectedCampaigns.includes(campaign.id) ? 'selected' : ''}`}
                onClick={() => handleToggle(campaign.id)}
              >
                <CheckCircle size={14} />
                <span>{campaign.title}</span>
              </button>
            ))}
          </div>
        )}

        {currentOfferingIndex >= selectedLanes.length && proposedCampaigns.length > 0 && (
          <div className="architecture-complete-state">
            <div className="success-icon">✓</div>
            <h2>All Campaigns Drafted</h2>
            <p>Your strategic map has {proposedCampaigns.length} campaign drafts. Next we will choose the action lanes for execution.</p>
          </div>
        )}

        {!currentCampaign && currentOffering && (
          <div className="campaign-builder-panel">
            <div className="campaign-builder-context">
              <div className="offering-context-badge">Campaign {currentOfferingIndex + 1} of {selectedLanes.length}</div>
              <h2>{currentOffering.title}</h2>
              <p>{currentOffering.description}</p>
            </div>

            <div className="campaign-blueprint-grid">
              {DIMENSIONS.map(({ key, label, icon: Icon, oneLine }) => (
                <button
                  type="button"
                  className="campaign-blueprint-card"
                  key={key}
                  onClick={() => setEditingKey(key)}
                >
                  <span className="campaign-blueprint-icon"><Icon size={17} /></span>
                  <span className="campaign-blueprint-copy">
                    <strong>{label}</strong>
                    <small>{oneLine}</small>
                    <em>{selectedValue(key)}</em>
                  </span>
                  <span className="campaign-blueprint-edit">
                    <Edit3 size={15} />
                  </span>
                </button>
              ))}
            </div>

            <div className="campaign-configuration-summary">
              <strong>Campaign draft input</strong>
              <span>{dimensions.duration} to {dimensions.objective.toLowerCase()} with {dimensions.audience} using {dimensions.channels.join(' + ')}, at a {dimensions.cadence.toLowerCase()}, measured by {dimensions.successMetric.toLowerCase()}.</span>
            </div>

            <button
              className="onboarding-btn-primary architecture-trigger"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? 'Drafting Campaign...' : 'Generate Campaign Draft'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {currentCampaign && (
          <div className="campaign-preview-card active-mission animate-in">
            <div className="preview-header">
              <div className="mission-tag">CAMPAIGN DRAFT READY</div>
              <h3>{currentCampaign.title}</h3>
            </div>
            <p className="campaign-strategy">{currentCampaign.description}</p>

            <div className="preview-metrics">
              <div className="p-metric">
                <span className="label">Messaging Hook</span>
                <span className="value">{currentCampaign.messagingHook || currentCampaign.configuration?.hook || dimensions.hook}</span>
              </div>
              <div className="p-metric">
                <span className="label">Mission Goal</span>
                <span className="value">{currentCampaign.goalMetric || currentCampaign.configuration?.successMetric || dimensions.successMetric}</span>
              </div>
            </div>

            <div className="preview-footer">
              <p>This draft is selected for execution planning. Continue generating the remaining campaign drafts.</p>
            </div>
          </div>
        )}
      </div>

      {editingDimension && (
        <div className="campaign-dimension-modal-backdrop" role="presentation" onMouseDown={() => setEditingKey(null)}>
          <div
            className="campaign-dimension-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-dimension-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="campaign-dimension-modal-header">
              <div>
                <span className="campaign-dimension-modal-kicker">Configure dimension</span>
                <h2 id="campaign-dimension-modal-title">{editingDimension.label}</h2>
              </div>
              <button type="button" className="campaign-dimension-modal-close" onClick={() => setEditingKey(null)} aria-label="Close dimension editor">
                <X size={18} />
              </button>
            </div>

            <p className="campaign-dimension-modal-guidance">{editingDimension.guidance}</p>

            <div className="campaign-dimension-modal-recommendation">
              <Info size={17} />
              <div>
                <strong>Recommended: {editingDimension.recommended}</strong>
                <span>{editingDimension.why}</span>
              </div>
            </div>

            <div className="campaign-dimension-modal-options">
              {editingDimension.options.map(option => {
                const selected = editingDimension.key === 'channels'
                  ? dimensions.channels.includes(option.label)
                  : selectedValue(editingDimension.key) === option.label;

                return (
                  <button
                    key={option.label}
                    type="button"
                    className={`campaign-dimension-modal-option ${selected ? 'selected' : ''}`}
                    onClick={() => selectOption(editingDimension.key, option.label)}
                  >
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    {selected && <CheckCircle size={18} />}
                  </button>
                );
              })}
            </div>

            <div className="campaign-dimension-modal-footer">
              <button type="button" className="onboarding-btn-secondary" onClick={() => setEditingKey(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('intent')} disabled={isLoading}>Back</button>

        {currentOfferingIndex < selectedLanes.length ? (
          <div className="step-count">Campaign {currentOfferingIndex + 1} of {selectedLanes.length}</div>
        ) : (
          <button
            className="onboarding-btn-primary"
            onClick={() => void designActionLanes()}
            disabled={selectedCampaigns.length === 0 || isLoading}
          >
            {isLoading ? 'Designing Tactics...' : 'Choose Action Lanes'} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
