export const MOCK_IP_ASSETS = [
  { name: 'resume_2024.pdf', type: 'resume' },
  { name: 'linkedin_archive.zip', type: 'archive' }
];

export const MOCK_SYNTHESIS = "Expert software architect with a focus on AI-led development cycles. Strong background in fintech and distributed systems. Unique leverage: 'The Physics of Velocity' framework.";

export const MOCK_OFFERINGS = [
  {
    id: 'off-1',
    title: 'AI-Native SDLC Consulting',
    description: 'Transform traditional dev teams into AI-augmented high-velocity units using the Physics of Velocity framework.',
    type: 'consulting'
  },
  {
    id: 'off-2',
    title: 'Fractional CTO Services',
    description: 'Strategic leadership for Series A/B startups looking to scale their technical foundation and AI strategy.',
    type: 'service'
  }
];

export const MOCK_CAMPAIGNS = [
  {
    id: 'camp-1',
    laneId: 'off-1',
    laneTitle: 'AI-Native SDLC Consulting',
    title: 'Accelerated SDLC Transformation Campaign',
    description: 'Engage CIOs and CTOs at financial institutions with targeted insights on how AI-driven methodologies can revolutionize their software development lifecycle.',
    targetSegment: 'CIOs/CTOs at Mid-market Fintech',
    duration: '90 days',
    channel: 'Email & LinkedIn',
    messagingHook: 'The Physics of Velocity Framework',
    goalMetric: '20 qualified conversations'
  },
  {
    id: 'camp-2',
    laneId: 'off-2',
    laneTitle: 'Fractional CTO Services',
    title: 'Strategic Startup Scaling Outreach',
    description: 'Proactive outreach to founders of recently funded startups needing strategic technical direction without a full-time hire.',
    targetSegment: 'Series A Founders',
    duration: '60 days',
    channel: 'Warm Intro & LinkedIn',
    messagingHook: 'Fractional Strategic Leverage',
    goalMetric: '10 discovery calls'
  }
];
