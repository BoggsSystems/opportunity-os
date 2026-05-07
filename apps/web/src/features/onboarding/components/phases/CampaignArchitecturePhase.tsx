import React from 'react';
import { ArrowRight, CheckCircle, Edit3, Info, MessageSquare, Radio, Target, Timer, Trophy, Users, X, type LucideIcon } from 'lucide-react';
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
    guidance: 'Channels define the channel actions the action engine can use. Multiple channels work best when they share the same campaign logic.',
    why: 'LinkedIn DM gives you a high-trust manual path for relationship building.',
    recommended: 'LinkedIn DM',
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
      { label: '14 day sprint', description: 'Aggressive test for immediate feedback.' },
      { label: '30 day campaign', description: 'Balanced window for relationship building.' },
      { label: '60 day sequence', description: 'Extended nurture for complex sales cycles.' },
    ],
  },
  {
    key: 'cadence',
    label: 'Cadence',
    icon: Timer,
    oneLine: 'How much pressure to apply.',
    guidance: 'Cadence determines the rhythm of the action cycles. Higher pressure increases volume but requires more review time.',
    why: 'A moderate daily push ensures steady progress without overwhelming your review queue.',
    recommended: 'Moderate daily push',
    options: [
      { label: 'Steady heartbeat', description: 'Consistent, low-volume background activity.' },
      { label: 'Moderate daily push', description: 'Balanced activity with daily engagement.' },
      { label: 'High-intensity blitz', description: 'Maximum volume for short-term objectives.' },
    ],
  },
  {
    key: 'successMetric',
    label: 'Success Metric',
    icon: Trophy,
    oneLine: 'How we know the campaign is working.',
    guidance: 'Success Metric defines the north star. The engine will observe this and adjust tactical recommendations to improve it.',
    why: 'AI synthesis is required for this dimension.',
    recommended: 'AI synthesis required',
    options: [],
  },
];

export const CampaignArchitecturePhase: React.FC = () => {
  const { 
    selectedLanes, proposedOfferings, proposedCampaigns, setProposedCampaigns,
    selectedCampaigns, setSelectedCampaigns, nextStep, isLoading,
    comprehensiveSynthesis, uploadedAssets, connectionCount,
    strategicDraft, setWizardMessages, api, user, designActionLanes
  } = useOnboarding();

  const [currentOfferingIndex, setCurrentOfferingIndex] = React.useState(0);
  const [dimensions, setDimensions] = React.useState<CampaignDimensions>(DEFAULT_DIMENSIONS);
  const [dimensionMeta, setDimensionMeta] = React.useState<DimensionMeta[]>(DIMENSIONS);
  const [isSynthesizingDimensions, setIsSynthesizingDimensions] = React.useState(false);
  const [isRefiningDimension, setIsRefiningDimension] = React.useState(false);
  const [dimensionSynthesisError, setDimensionSynthesisError] = React.useState<string | null>(null);
  const [editingKey, setEditingKey] = React.useState<DimensionKey | null>(null);
  const [dimensionRefinementText, setDimensionRefinementText] = React.useState('');
  const [dimensionRefinementError, setDimensionRefinementError] = React.useState<string | null>(null);
  
  // Dynamic Feedback Ticker
  const [thinkingIndex, setThinkingIndex] = React.useState(0);
  const thinkingMessages = [
    'Synthesizing strategic blueprint...',
    'Aligning objective with network signals...',
    'Calibrating audience segments...',
    'Drafting unique strategic hooks...',
    'Scoring success metrics against IP...',
    'Finalizing channel architecture...'
  ];

  React.useEffect(() => {
    if (!isSynthesizingDimensions) return undefined;
    const interval = setInterval(() => {
      setThinkingIndex(prev => (prev + 1) % thinkingMessages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isSynthesizingDimensions]);

  const rawSelectedOffering = selectedLanes[currentOfferingIndex] as any;
  const currentOffering = typeof rawSelectedOffering === 'string'
    ? proposedOfferings.find((offering: any) => offering.id === rawSelectedOffering)
    : rawSelectedOffering;
  const offeringKey = currentOffering?.id || `offering-${currentOfferingIndex}`;
  
  const currentCampaign = proposedCampaigns.find(c => 
    c.id === offeringKey || (c.configuration as any)?.offeringId === offeringKey
  );

  const aiDimensionsReady = (dimensionMeta.find(m => m.key === 'objective')?.recommended !== 'AI synthesis required');

  const narratedSynthesisSuccess = React.useRef(new Set<string>());
  const narratedSynthesisFailure = React.useRef(new Set<string>());

  const synthesizeDimensions = React.useCallback(async () => {
    if (!currentOffering) return;
    
    setIsSynthesizingDimensions(true);
    setDimensionSynthesisError(null);

    try {
      const response = await api.proposeCampaignDimensions({
        offering: currentOffering,
        networkCount: connectionCount || strategicDraft?.connectionCount || 0,
        frameworks: uploadedAssets.flatMap((asset: any) => asset.frameworks || []),
        interpretation: comprehensiveSynthesis || strategicDraft?.posture?.text || uploadedAssets.map((asset: any) => asset.interpretation || asset.summary || '').join('\n\n'),
        strategicDraft,
        uploadedAssets,
        comprehensiveSynthesis,
        existingDimensions: DEFAULT_DIMENSIONS,
      });

      if (!response.success || response.source !== 'ai_synthesized' || !response.dimensions) {
        setDimensionSynthesisError(response.message || 'I could not synthesize this campaign from your intelligence yet.');
        return;
      }

      const synthesizedDimensions = response.dimensions as Record<string, any>;

      // Merge and validate
      const nextMeta = DIMENSIONS.map(d => {
        const synthesized = synthesizedDimensions[d.key];
        if (!synthesized) return d;
        return {
          ...d,
          recommended: synthesized.recommended,
          why: synthesized.why,
          options: synthesized.options || d.options,
        };
      });

      setDimensionMeta(nextMeta);
      setDimensions(prev => {
        const next = { ...prev };
        nextMeta.forEach(m => {
          if (m.recommended && m.recommended !== 'AI synthesis required') {
            (next as any)[m.key] = m.key === 'channels' ? [m.recommended] : m.recommended;
          }
        });
        return next;
      });

      if (!narratedSynthesisSuccess.current.has(offeringKey)) {
        narratedSynthesisSuccess.current.add(offeringKey);
        setWizardMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `I've synthesized a custom campaign strategy for "${currentOffering.title}" based on your unique IP and relationship graph. Review the dimensions and tune them to your liking.`,
        }]);
      }
    } catch (err) {
      setDimensionSynthesisError('Synthesis failed due to a network error. Please try again.');
    } finally {
      setIsSynthesizingDimensions(false);
    }
  }, [currentOffering, connectionCount, strategicDraft, uploadedAssets, comprehensiveSynthesis, offeringKey, setWizardMessages, api]);

  React.useEffect(() => {
    if (currentOffering && !currentCampaign && !aiDimensionsReady && !isSynthesizingDimensions && !dimensionSynthesisError) {
      synthesizeDimensions();
    }
  }, [currentOffering, currentCampaign, aiDimensionsReady, isSynthesizingDimensions, dimensionSynthesisError, synthesizeDimensions]);

  const selectedValue = (key: DimensionKey) => {
    if (AI_REQUIRED_DIMENSIONS.has(key) && !aiDimensionsReady) {
      return (
        <span className="skeleton-container">
          <span className="skeleton-box medium" />
        </span>
      );
    }
    const val = dimensions[key];
    return Array.isArray(val) ? val.join(' + ') : val;
  };

  const applyDimensionUpdate = (key: DimensionKey, nextDimension: Record<string, any>) => {
    setDimensionMeta(prev => prev.map(d => {
      if (d.key !== key) return d;
      return {
        ...d,
        recommended: String(nextDimension['recommended'] || d.recommended),
        guidance: String(nextDimension['guidance'] || d.guidance),
        why: String(nextDimension['why'] || d.why),
        options: Array.isArray(nextDimension['options']) && nextDimension['options'].length > 0
          ? nextDimension['options']
          : d.options,
      };
    }));

    setDimensions(prev => {
      const recommended = String(nextDimension['recommended'] || '');
      if (!recommended) return prev;
      return {
        ...prev,
        [key]: key === 'channels' ? [recommended] : recommended,
      };
    });
  };

  const refineCurrentDimension = async () => {
    if (!currentOffering || !editingDimension || !dimensionRefinementText.trim()) return;

    setIsRefiningDimension(true);
    setDimensionRefinementError(null);
    try {
      const lockedDimensions = DIMENSIONS
        .map(d => d.key)
        .filter(key => key !== editingDimension.key);
      const response = await api.refineCampaignDimension({
        offering: currentOffering,
        targetDimension: editingDimension.key,
        userFeedback: dimensionRefinementText.trim(),
        currentDimensions: dimensions,
        currentDimensionMeta: editingDimension,
        lockedDimensions,
        networkCount: connectionCount || strategicDraft?.connectionCount || 0,
        frameworks: uploadedAssets.flatMap((asset: any) => asset.frameworks || []),
        interpretation: comprehensiveSynthesis || strategicDraft?.posture?.text || uploadedAssets.map((asset: any) => asset.interpretation || asset.summary || '').join('\n\n'),
        strategicDraft,
        uploadedAssets,
        comprehensiveSynthesis,
      });

      if (!response.success || response.source !== 'ai_synthesized' || !response.dimension) {
        setDimensionRefinementError(response.message || 'I could not refine this dimension in isolation.');
        return;
      }

      applyDimensionUpdate(editingDimension.key, response.dimension);
      setDimensionRefinementText('');
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `I updated only the ${editingDimension.label.toLowerCase()} dimension and preserved the rest of this campaign blueprint.`,
      }]);
    } catch (err) {
      setDimensionRefinementError('Dimension refinement failed due to a network error. Please try again.');
    } finally {
      setIsRefiningDimension(false);
    }
  };

  const handleGenerate = () => {
    const campaignId = offeringKey;
    const newCampaign = {
      id: campaignId,
      title: currentOffering.title,
      description: currentOffering.description,
      configuration: {
        ...dimensions,
        offeringId: currentOffering.id
      }
    };

    setProposedCampaigns(prev => {
      const filtered = prev.filter(c => c.id !== campaignId);
      return [...filtered, newCampaign];
    });
    setSelectedCampaigns(prev => [...new Set([...prev, campaignId])]);
  };

  const handleNext = () => {
    if (currentOfferingIndex < selectedLanes.length - 1) {
      setCurrentOfferingIndex(prev => prev + 1);
      setDimensionMeta(DIMENSIONS);
      setDimensions(DEFAULT_DIMENSIONS);
      setDimensionSynthesisError(null);
    } else {
      nextStep('analysis');
    }
  };

  const editingDimension = editingKey ? dimensionMeta.find(d => d.key === editingKey) : null;

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 07: Campaign Architecture</div>
        <h1>Architect the campaign blueprint.</h1>
        <p>I have mapped your intent to specific execution dimensions. Review and tune each dimension before we assemble the tactical arsenal.</p>
      </div>

      <div className="campaign-architecture-view">
        {currentCampaign && (
          <div className="architecture-complete-state animate-in">
            <div className="success-icon">✓</div>
            <h2>All Campaigns Drafted</h2>
            <p>Your strategic map has {proposedCampaigns.length} campaign drafts. Next we will turn the selected channels into execution plans.</p>
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
                  ? <span className="thinking-dots">{thinkingMessages[thinkingIndex]}</span>
                  : aiDimensionsReady
                    ? 'AI-synthesized campaign strategy loaded'
                    : 'AI campaign synthesis required'}
              </div>
            </div>

            {dimensionSynthesisError && (
              <div className="campaign-blueprint-blocked animate-in">
                <strong>Campaign strategy is not ready.</strong>
                <span>{dimensionSynthesisError}</span>
                <button type="button" className="onboarding-btn-secondary" onClick={() => { synthesizeDimensions(); }} disabled={isSynthesizingDimensions}>
                  Retry AI Synthesis
                </button>
              </div>
            )}

            <div className="campaign-blueprint-grid">
              {dimensionMeta.map(({ key, label, icon: Icon, oneLine }, idx) => {
                const isLocked = AI_REQUIRED_DIMENSIONS.has(key) && !aiDimensionsReady;
                return (
                  <button
                    type="button"
                    className={`campaign-blueprint-card ${isLocked ? 'locked' : 'stagger-in'} stagger-${idx + 1}`}
                    key={key}
                    onClick={() => {
                      if (isLocked) return;
                      setEditingKey(key);
                      setDimensionRefinementText('');
                      setDimensionRefinementError(null);
                    }}
                    disabled={isLocked}
                  >
                    <span className={`campaign-blueprint-icon ${isSynthesizingDimensions ? 'icon-pulse' : ''}`}>
                      <Icon size={17} />
                    </span>
                    <span className="campaign-blueprint-copy">
                      <strong>{label}</strong>
                      <small>{oneLine}</small>
                      <div className="selected-value-wrapper">
                        {selectedValue(key)}
                      </div>
                    </span>
                    <span className="campaign-blueprint-edit">
                      <Edit3 size={15} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="campaign-configuration-summary">
              <strong>Campaign draft input</strong>
              <div className="summary-text-wrapper">
                {aiDimensionsReady
                  ? (
                    <span className="animate-in">
                      {dimensions.duration} to {dimensions.objective.toLowerCase()} with {dimensions.audience} using {dimensions.channels.join(' + ')}, at a {dimensions.cadence.toLowerCase()}, measured by {dimensions.successMetric.toLowerCase()}.
                    </span>
                  )
                  : (
                    <div className="skeleton-summary">
                      <span className="skeleton-box medium" />
                      <span className="skeleton-box long" />
                    </div>
                  )
                }
              </div>
            </div>

            <button
              className="onboarding-btn-primary architecture-trigger"
              onClick={handleGenerate}
              disabled={isLoading || isSynthesizingDimensions || !aiDimensionsReady}
            >
              {isSynthesizingDimensions ? 'Synthesizing Strategy...' : 'Generate Campaign Draft'} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {currentCampaign && (
          <div className="onboarding-footer">
            <button className="onboarding-btn-secondary" onClick={() => {
              setProposedCampaigns(prev => prev.filter(c => c.id !== offeringKey));
              setSelectedCampaigns(prev => prev.filter(id => id !== offeringKey));
            }}>Reset Draft</button>
            <button className="onboarding-btn-primary" onClick={handleNext}>
              {currentOfferingIndex < selectedLanes.length - 1 ? 'Next Campaign' : 'Assemble Tactical Arsenal'} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {editingKey && editingDimension && (
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
              <button type="button" className="campaign-dimension-modal-close" onClick={() => setEditingKey(null)}>
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
                  : dimensions[editingDimension.key] === option.label;

                return (
                  <button
                    key={option.label}
                    type="button"
                    className={`campaign-dimension-modal-option ${selected ? 'selected' : ''}`}
                    onClick={() => {
                      if (editingDimension.key === 'channels') {
                        setDimensions(prev => ({
                          ...prev,
                          channels: prev.channels.includes(option.label)
                            ? prev.channels.filter(c => c !== option.label)
                            : [...prev.channels, option.label]
                        }));
                      } else {
                        setDimensions(prev => ({ ...prev, [editingDimension.key]: option.label }));
                      }
                    }}
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

            <div className="campaign-dimension-refine-panel">
              <label htmlFor="campaign-dimension-refine-input">
                Ask the Conductor to refine only this dimension
              </label>
              <textarea
                id="campaign-dimension-refine-input"
                value={dimensionRefinementText}
                onChange={(event) => setDimensionRefinementText(event.target.value)}
                placeholder={`Example: Use discovery calls booked as the ${editingDimension.label.toLowerCase()} for this campaign.`}
                rows={3}
                disabled={isRefiningDimension}
              />
              {dimensionRefinementError && (
                <p className="campaign-dimension-refine-error">{dimensionRefinementError}</p>
              )}
              <button
                type="button"
                className="onboarding-btn-secondary"
                onClick={() => void refineCurrentDimension()}
                disabled={isRefiningDimension || !dimensionRefinementText.trim()}
              >
                {isRefiningDimension ? 'Refining...' : 'Refine This Dimension'}
              </button>
            </div>

            <div className="campaign-dimension-modal-footer">
              <button type="button" className="onboarding-btn-secondary" onClick={() => setEditingKey(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
