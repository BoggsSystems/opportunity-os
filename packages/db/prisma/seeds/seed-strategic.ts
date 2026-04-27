import { PrismaClient, OfferingType, OfferingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const USER_ID = 'b7d60c45-0cd6-45db-bdc8-6fd4b1dc084d'; // Targeting the demo user found earlier

async function seedStrategicModel() {
  console.log('Seeding Strategic Model...');

  // 1. Ensure User Posture exists
  await prisma.userPosture.upsert({
    where: { userId: USER_ID },
    update: {
      postureText: 'I am a senior software architect and operator, focused on AI-native engineering and high-leverage product strategy. I value concrete next actions and strategic momentum.',
      objectives: [
        'Promote AI-Native SDLC Audit & Transformation',
        'Distribute "AI-Native Software Engineering" book',
        'Drive adoption of Opportunity OS',
        'Provide high-leverage product strategy advisory'
      ],
      preferredTone: 'Authoritative, strategic, technical, and execution-oriented'
    },
    create: {
      userId: USER_ID,
      postureText: 'I am a senior software architect and operator, focused on AI-native engineering and high-leverage product strategy. I value concrete next actions and strategic momentum.',
      objectives: [
        'Promote AI-Native SDLC Audit & Transformation',
        'Distribute "AI-Native Software Engineering" book',
        'Drive adoption of Opportunity OS',
        'Provide high-leverage product strategy advisory'
      ],
      preferredTone: 'Authoritative, strategic, technical, and execution-oriented'
    }
  });

  // 2. Define Theses (perspectives)
  const theses = [
    {
      title: 'AI-Native SDLC Evolution',
      content: 'Traditional SDLCs are built for manual execution. AI-native engineering shifts the bottleneck from code generation to system decomposition, architecture, and review. Organizations must redesign their team topology to optimize for this new physics.',
      relevanceTags: ['SDLC', 'CTO', 'Velocity', 'Architecture']
    },
    {
      title: 'The Economics of AI Velocity',
      content: 'AI dramatically reduces the marginal cost of software execution. This changes the "physics" of software velocity, making rapid iteration and high-leverage system design the primary competitive advantages.',
      relevanceTags: ['Economics', 'Velocity', 'Strategy', 'Product']
    },
    {
      title: 'Opportunity Creation via AI-Assisted Execution',
      content: 'The biggest gap in business is turning intent into structured action. Opportunity OS bridges this by automating the sensing of signals and generating ready-to-execute action cycles.',
      relevanceTags: ['Opportunity', 'Execution', 'Momentum', 'Platform']
    }
  ];

  const createdTheses = [];
  for (const thesis of theses) {
    const t = await prisma.strategicThesis.create({
      data: {
        userId: USER_ID,
        ...thesis
      }
    });
    createdTheses.push(t);
  }

  // 3. Define Offerings
  const offerings = [
    {
      title: 'AI-Native SDLC Audit & Transformation',
      description: 'Redesign your engineering organization and workflow for the AI-native era. Assess bottlenecks and create a transformation roadmap for 10x delivery velocity.',
      offeringType: OfferingType.consulting,
      thesisIndexes: [0, 1]
    },
    {
      title: 'AI-Native Software Engineering (The Book)',
      description: '“The New Physics of Software Velocity.” A deep dive into how AI changes the economics and physics of building software products.',
      offeringType: OfferingType.book,
      thesisIndexes: [0, 1]
    },
    {
      title: 'Opportunity OS Platform',
      description: 'The AI-assisted operating system for opportunity creation and execution. Turn your network and intent into momentum.',
      offeringType: OfferingType.platform,
      thesisIndexes: [2]
    },
    {
      title: 'High-Leverage Product Strategy Advisory',
      description: 'Fractional CTO/Product leadership for founders who need to build complex systems quickly using AI-native methods.',
      offeringType: OfferingType.advisory_program,
      thesisIndexes: [1]
    }
  ];

  for (const off of offerings) {
    const offering = await prisma.offering.create({
      data: {
        userId: USER_ID,
        title: off.title,
        description: off.description,
        offeringType: off.offeringType,
        status: OfferingStatus.active
      }
    });

    // Map to theses
    for (const idx of off.thesisIndexes) {
      await prisma.offeringThesisMapping.create({
        data: {
          offeringId: offering.id,
          thesisId: createdTheses[idx].id
        }
      });
    }
  }

  console.log('Strategic Model seeded successfully!');
}

seedStrategicModel()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
