import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCapabilities() {
  console.log('Seeding capabilities and providers...');

  // 1. Core Capabilities
  const caps = [
    { type: 'email', name: 'Email', desc: 'Send and receive emails' },
    { type: 'calendar', name: 'Calendar', desc: 'Manage schedules' },
    { type: 'messaging', name: 'Messaging', desc: 'SMS and IM' },
    { type: 'calling', name: 'Voice Calling', desc: 'Calls and transcription' },
    { type: 'contacts', name: 'Contacts', desc: 'Contact management' },
    { type: 'storage', name: 'File Storage', desc: 'Cloud file storage' },
    { type: 'discovery', name: 'Content Discovery', desc: 'Ingest external content' },
    { type: 'crm', name: 'CRM', desc: 'CRM sync' },
  ];

  const capabilityMap: Record<string, any> = {};

  for (const cap of caps) {
    const record = await prisma.capability.upsert({
      where: { capabilityType: cap.type },
      update: { name: cap.name, description: cap.desc },
      create: {
        capabilityType: cap.type,
        name: cap.name,
        description: cap.desc,
        supportedFeaturesJson: [],
        defaultConfigJson: {},
      },
    });
    capabilityMap[cap.type] = record;
  }

  // 2. Providers
  const providers = [
    { capType: 'email', name: 'gmail', display: 'Gmail', scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'] },
    { capType: 'email', name: 'outlook', display: 'Outlook', scopes: ['https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/Mail.Send'] },
    { capType: 'calendar', name: 'google_calendar', display: 'Google Calendar', scopes: ['https://www.googleapis.com/auth/calendar.readonly'] },
    { capType: 'storage', name: 'google_drive', display: 'Google Drive', scopes: ['https://www.googleapis.com/auth/drive.readonly'] },
    { capType: 'discovery', name: 'firecrawl', display: 'Firecrawl', auth: 'api_key' },
    { capType: 'contacts', name: 'linkedin', display: 'LinkedIn', scopes: ['r_liteprofile', 'r_emailaddress'] },
  ];

  for (const prov of providers) {
    const cap = capabilityMap[prov.capType];
    if (!cap) continue;

    await prisma.capabilityProvider.upsert({
      where: { capabilityId_providerName: { capabilityId: cap.id, providerName: prov.name } },
      update: { 
        displayName: prov.display,
        requiredScopesJson: prov.scopes || []
      },
      create: {
        capabilityId: cap.id,
        providerName: prov.name,
        displayName: prov.display,
        description: `${prov.display} integration`,
        authType: prov.auth || 'oauth2',
        requiredScopesJson: prov.scopes || [],
        rateLimitConfigJson: {},
        providerConfigSchemaJson: {},
      },
    });
  }

  console.log('✅ Capability integration seeding completed!');
}

async function main() {
  try {
    await seedCapabilities();
  } catch (error) {
    console.error('Error seeding capabilities:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
