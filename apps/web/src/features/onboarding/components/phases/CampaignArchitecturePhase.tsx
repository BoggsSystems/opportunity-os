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

type SynthesizedDimension = {
  recommended?: string;
  guidance?: string;
  why?: string;
  options?: Array<{ label?: string; description?: string }>;
};

const AI_REQUIRED_DIMENSIONS = new Set<DimensionKey>(['objective', 'audience', 'hook', 'successMetric']);

const DEFAULT_DIMENSIONS: CampaignDimensions = {
  objective: '',
  audience: '',
  hook: '',
  channels: ['LinkedIn DM', 'Email'],
  duration: '30 day campaign',
  cadence: 'Moderate daily push',
  successMetric: '',
};

const DIMENSIONS: DimensionMeta[] = [
  {
    key: 'objective',
    label: 'Objective',
    icon: Target,
    oneLine: 'What the campaign is trying to produce.',
    guidance: 'Objective defines the outcome this campaign is designed to create. I need AI synthesis before proposing this because it must fit the selected offering and your current intelligence.',
    why: 'AI synthesis is required for this dimension.',
    recommended: 'AI synthesis required',
    options: [],
  },
  {
    key: 'audience',
    label: 'Audience',
    icon: Users,
    oneLine: 'Who the campaign is aimed at.',
    guidance: 'Audience defines the people this campaign will speak to. I need AI synthesis before proposing this because it should come from your offering, archive, assets, and relationship graph.',
    why: 'AI synthesis is required for this dimension.',
    recommended: 'AI synthesis required',
    options: [],
  },
  {
    key: 'hook',
    label: 'Strategic Hook',
    icon: MessageSquare,
    oneLine: 'Why this audience should care now.',
    guidance: 'The hook becomes the spine of outreach, posts, comments, and follow-up. It is the angle the campaign repeats in different forms.',
    why: 'AI synthesis is required for this dimension.',
    recommended: 'AI synthesis required',
    options: [],
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
    guidance: 'Success metric defines what the system should optimize for. I need AI synthesis before proposing this because the metric should match the offer, buyer, hook, and campaign motion.',
    why: 'AI synthesis is required for this dimension.',
    recommended: 'AI synthesis required',
    options: [],
  },
];

const splitRecommendedChannels = (value: string) => value
  .split(/\s*\+\s*|,\s*/g)
  .map(item => item.trim())
  .filter(Boolean);

const mergeSynthesizedDimensions = (synthesized: Record<string, SynthesizedDimension>): DimensionMeta[] => {
  return DIMENSIONS.map((base) => {
    const next = synthesized[base.key];
    if (!next) return base;

    const normalizedOptions = Array.isArray(next.options)
      ? next.options
          .filter(option => option?.label)
          .slice(0, 5)
          .map(option => ({
            label: String(option.label),
            description: String(option.description || ''),
          }))
      : [];

    const options = normalizedOptions.length > 0 ? normalizedOptions : base.options;
    const recommended = String(next.recommended || base.recommended);
    const includesRecommendation = options.some(option => option.label === recommended);

    return {
      ...base,
      guidance: String(next.guidance || base.guidance),
      why: String(next.why || base.why),
      recommended,
      options: includesRecommendation
        ? options
        : [{ label: recommended, description: next.why || base.why }, ...options].slice(0, 5),
    };
  });
};

const selectRecommendedDimensions = (meta: DimensionMeta[]): CampaignDimensions => {
  const next = meta.reduce((acc, dimension) => ({
    ...acc,
    [dimension.key]: dimension.recommended,
  }), {} as Record<DimensionKey, string>);

  return {
    objective: next.objective || DEFAULT_DIMENSIONS.objective,
    audience: next.audience || DEFAULT_DIMENSIONS.audience,
    hook: next.hook || DEFAULT_DIMENSIONS.hook,
    channels: splitRecommendedChannels(next.channels || DEFAULT_DIMENSIONS.channels.join(' + ')),
    duration: next.duration || DEFAULT_DIMENSIONS.duration,
    cadence: next.cadence || DEFAULT_DIMENSIONS.cadence,
    successMetric: next.successMetric || DEFAULT_DIMENSIONS.successMetric,
  };
};

const hasAiRequiredDimensions = (meta: DimensionMeta[]) => {
  return Array.from(AI_REQUIRED_DIMENSIONS).every((key) => {
    const dimension = meta.find(item => item.key === key);
    return Boolean(
      dimension &&
      dimension.recommended !== 'AI synthesis required' &&
      dimension.options.length >= 2,
    );
  });
};

export const CampaignArchitecturePhase: React.FC = () => {
  const {
    api,
    proposedCampaigns,
    selectedCampaigns,
    setSelectedCampaigns,
    designActionLanes,
    nextStep,
    isLoading,
    connectionCount,
    uploadedAssets,
    comprehensiveSynthesis,
    strategicDraft,
    proposedOfferings,
    selectedLanes,
    currentOfferingIndex,
    generateNextCampaign,
    setWizardMessages,
  } = useOnboarding();

  const [dimensions, setDimensions] = React.useState<CampaignDimensions>(DEFAULT_DIMENSIONS);
  const [dimensionMeta, setDimensionMeta] = React.useState<DimensionMeta[]>(DIMENSIONS);
  const [editingKey, setEditingKey] = React.useState<DimensionKey | null>(null);
  const [isSynthesizingDimensions, setIsSynthesizingDimensions] = React.useState(false);
  const [dimensionSynthesisError, setDimensionSynthesisError] = React.useState<string | null>(null);
  const hasNarratedArchitectureEntry = React.useRef(false);
  const narratedSynthesisSuccess = React.useRef(new Set<string>());
  const narratedSynthesisFailure = React.useRef(new Set<string>());

  const currentOfferingId = selectedLanes[currentOfferingIndex];
  const currentOffering = proposedOfferings.find((offering: any) => offering.id === currentOfferingId);
  const currentCampaign = proposedCampaigns.find((campaign: any) => campaign.offeringId === currentOfferingId);
  const completedCampaigns = proposedCampaigns.filter((campaign: any) => selectedLanes.includes(campaign.offeringId));
  const editingDimension = dimensionMeta.find(dimension => dimension.key === editingKey);
  const aiDimensionsReady = hasAiRequiredDimensions(dimensionMeta);

  const synthesizeDimensions = React.useCallback(() => {
    if (!currentOffering) return;
    const offeringKey = currentOfferingId || currentOffering.id || currentOffering.title;

    let active = true;
    setIsSynthesizingDimensions(true);
    setDimensionSynthesisError(null);

    api.proposeCampaignDimensions({
      offering: currentOffering,
      networkCount: connectionCount || strategicDraft?.connectionCount || 0,
      frameworks: uploadedAssets.flatMap((asset: any) => asset.frameworks || []),
      interpretation: comprehensiveSynthesis || strategicDraft?.posture?.text || uploadedAssets.map((asset: any) => asset.interpretation || asset.summary || '').join('\n\n'),
      strategicDraft,
      uploadedAssets,
      comprehensiveSynthesis,
      existingDimensions: DEFAULT_DIMENSIONS,
    })
      .then((response) => {
        if (!active) return;

        if (!response.success || response.source !== 'ai_synthesized' || !response.dimensions) {
          setDimensionSynthesisError(response.message || 'I could not synthesize this campaign from your intelligence yet.');
          return;
        }

        const nextMeta = mergeSynthesizedDimensions(response.dimensions);
        if (!hasAiRequiredDimensions(nextMeta)) {
          setDimensionSynthesisError('The AI response did not include enough campaign strategy detail. Retry synthesis.');
          if (!narratedSynthesisFailure.current.has(offeringKey)) {
            narratedSynthesisFailure.current.add(offeringKey);
            setWizardMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: `I could not synthesize a complete campaign blueprint for "${currentOffering.title}" from your intelligence yet. Retry synthesis before we draft so we do not use generic strategy.`,
            }]);
          }
          return;
        }

        setDimensionMeta(nextMeta);
        setDimensions(selectRecommendedDimensions(nextMeta));
        if (!narratedSynthesisSuccess.current.has(offeringKey)) {
          narratedSynthesisSuccess.current.add(offeringKey);
          setWizardMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `I've prepared the campaign blueprint for "${currentOffering.title}". Review the objective, audience, strategic hook, timing, cadence, and success metric before I draft the campaign. If any dimension feels off, tell me what you want to change here and I'll regenerate the blueprint with your feedback.`,
          }]);
        }
      })
      .catch(() => {
        if (!active) return;
        setDimensionSynthesisError('I could not reach the AI campaign synthesis service. Retry synthesis before drafting this campaign.');
        if (!narratedSynthesisFailure.current.has(offeringKey)) {
          narratedSynthesisFailure.current.add(offeringKey);
          setWizardMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `I could not synthesize a campaign blueprint for "${currentOffering.title}" from your intelligence yet. Retry synthesis before we draft so we do not use generic strategy.`,
          }]);
        }
      })
      .finally(() => {
        if (active) setIsSynthesizingDimensions(false);
      });

    return () => {
      active = false;
    };
  }, [api, currentOffering, currentOfferingId, connectionCount, uploadedAssets, comprehensiveSynthesis, strategicDraft, setWizardMessages]);

  React.useEffect(() => {
    setDimensions(DEFAULT_DIMENSIONS);
    setDimensionMeta(DIMENSIONS);
    setEditingKey(null);
    setDimensionSynthesisError(null);
    if (currentOffering && !hasNarratedArchitectureEntry.current) {
      hasNarratedArchitectureEntry.current = true;
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'Now I will turn each selected Revenue Lane into a campaign. For each one, I will synthesize the objective, audience, strategic hook, and success metric from your intelligence before drafting.',
      }]);
    }
    return synthesizeDimensions();
  }, [currentOffering, currentOfferingId, synthesizeDimensions, setWizardMessages]);

  const selectedValue = (key: DimensionKey) => {
    if (key === 'channels') return dimensions.channels.join(' + ');
    return dimensions[key] || (AI_REQUIRED_DIMENSIONS.has(key) ? 'Waiting for AI synthesis' : '');
  };

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
    if (!aiDimensionsReady) return;
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
              <div className={`campaign-blueprint-status ${isSynthesizingDimensions ? 'loading' : aiDimensionsReady ? 'ready' : 'blocked'}`}>
                {isSynthesizingDimensions
                  ? 'Synthesizing campaign options from your intelligence memory...'
                  : aiDimensionsReady
                    ? 'AI-synthesized campaign strategy loaded'
                    : 'AI campaign synthesis required'}
              </div>
            </div>

            {dimensionSynthesisError && (
              <div className="campaign-blueprint-blocked">
                <strong>Campaign strategy is not ready.</strong>
                <span>{dimensionSynthesisError}</span>
                <button type="button" className="onboarding-btn-secondary" onClick={() => { synthesizeDimensions(); }} disabled={isSynthesizingDimensions}>
                  Retry AI Synthesis
                </button>
              </div>
            )}

            <div className="campaign-blueprint-grid">
              {dimensionMeta.map(({ key, label, icon: Icon, oneLine }) => (
                <button
                  type="button"
                  className={`campaign-blueprint-card ${AI_REQUIRED_DIMENSIONS.has(key) && !aiDimensionsReady ? 'locked' : ''}`}
                  key={key}
                  onClick={() => {
                    if (AI_REQUIRED_DIMENSIONS.has(key) && !aiDimensionsReady) return;
                    setEditingKey(key);
                  }}
                  disabled={AI_REQUIRED_DIMENSIONS.has(key) && !aiDimensionsReady}
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
              <span>
                {aiDimensionsReady
                  ? `${dimensions.duration} to ${dimensions.objective.toLowerCase()} with ${dimensions.audience} using ${dimensions.channels.join(' + ')}, at a ${dimensions.cadence.toLowerCase()}, measured by ${dimensions.successMetric.toLowerCase()}.`
                  : 'Waiting for AI to synthesize the campaign objective, audience, strategic hook, and success metric.'}
              </span>
            </div>

            <button
              className="onboarding-btn-primary architecture-trigger"
              onClick={handleGenerate}
              disabled={isLoading || isSynthesizingDimensions || !aiDimensionsReady}
            >
              {isLoading ? 'Drafting Campaign...' : isSynthesizingDimensions ? 'Synthesizing Strategy...' : 'Generate Campaign Draft'}
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
