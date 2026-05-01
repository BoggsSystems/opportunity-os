import { prisma, OfferingType, OfferingStatus } from '@opportunity-os/db';

async function seedJeffsOfferings() {
  const jeff = await prisma.user.findFirst({
    where: { email: { contains: 'jeff' } }
  });

  if (!jeff) {
    console.error('User Jeff not found. Run simulation first or sign up.');
    return;
  }

  const offerings = [
    {
      title: "AI-Native SDLC Audit",
      description: "A high-value consulting audit that evaluates a software organization's current delivery process and identifies how AI-native engineering can improve velocity, team structure, quality, and cost.",
      offeringType: OfferingType.service,
      status: OfferingStatus.active,
      metadataJson: {
        targetAudience: "CTOs, CIOs, VPs of Engineering, Heads of Product, PE operating partners, and enterprise software leaders.",
        positioning: "Find out where your software organization is leaking velocity — and how AI-native engineering can transform delivery.",
        priceRange: "$25,000–$150,000",
        assets: ["Audit overview PDF", "Executive briefing deck", "Velocity baseline worksheet", "Discovery call script", "Sample audit report"]
      }
    },
    {
      title: "AI-Native SDLC Transformation",
      description: "Redesign your delivery model around AI-native workflows, orchestration, decomposition, verification, and governance.",
      offeringType: OfferingType.service,
      status: OfferingStatus.active,
      metadataJson: {
        positioning: "Move from traditional software delivery to an AI-native operating model.",
        priceRange: "$150,000–$500,000+",
        assets: ["Transformation roadmap", "Executive proposal", "Before/after team model diagrams"]
      }
    },
    {
      title: "AI-Native Software Engineering Book",
      description: "The intellectual foundation for the broader platform, explaining the 'new physics' of software velocity.",
      offeringType: OfferingType.product,
      status: OfferingStatus.active,
      metadataJson: {
        positioning: "The book for leaders trying to understand what software engineering becomes when AI collapses execution cost.",
        assets: ["Amazon book link", "Chapter excerpts", "Executive briefing version"]
      }
    },
    {
      title: "Executive AI-Native Engineering Briefing",
      description: "A 60-90 minute workshop to bring leadership teams up to speed on AI-native engineering.",
      offeringType: OfferingType.service,
      status: OfferingStatus.active,
      metadataJson: {
        priceRange: "$2,500–$25,000",
        assets: ["Workshop landing page", "Briefing deck", "Agenda"]
      }
    },
    {
      title: "Opportunity OS / Opportunity Platform",
      description: "The product itself: an AI-powered revenue operating system for consultants, founders, and creators.",
      offeringType: OfferingType.product,
      status: OfferingStatus.active,
      metadataJson: {
        positioning: "Your AI-powered operating system for finding, shaping, and executing revenue opportunities.",
        priceRange: "$49–$299+/month"
      }
    },
    {
      title: "AI-First MVP App Development",
      description: "Rapidly build software products using AI-native engineering for startups and entrepreneurs.",
      offeringType: OfferingType.service,
      status: OfferingStatus.active,
      metadataJson: {
        positioning: "Get from idea to working software faster using an AI-native development process.",
        priceRange: "$2,500–$25,000+"
      }
    },
    {
      title: "Capital Markets Software Architecture",
      description: "AI-native software architecture for trading, risk, and capital markets systems.",
      offeringType: OfferingType.service,
      status: OfferingStatus.active,
      metadataJson: {
        positioning: "AI-native software architecture and development for trading, risk, and capital markets systems."
      }
    },
    {
      title: "Robot Fleet Platform",
      description: "Orchestrating fleets of robots, humanoids, and drones with digital twins and fleet management.",
      offeringType: OfferingType.product,
      status: OfferingStatus.active,
      metadataJson: {
        positioning: "Lower your labor costs with fleets of autonomous robots.",
        priceRange: "$25,000–$250,000+"
      }
    }
  ];

  for (const o of offerings) {
    const existing = await prisma.offering.findFirst({
      where: {
        userId: jeff.id,
        title: o.title
      }
    });

    if (existing) {
      await prisma.offering.update({
        where: { id: existing.id },
        data: {
          description: o.description,
          offeringType: o.offeringType,
          status: o.status,
          metadataJson: o.metadataJson as any
        }
      });
    } else {
      await prisma.offering.create({
        data: {
          ...o,
          userId: jeff.id
        }
      });
    }
  }

  console.log(`Seeded ${offerings.length} offerings for Jeff.`);
}

seedJeffsOfferings()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
