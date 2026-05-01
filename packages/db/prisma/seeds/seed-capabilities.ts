import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCapabilities() {
  console.log('Seeding capabilities and providers...');

  // Create core capabilities
  const capabilities = await Promise.all([
    prisma.capability.create({
      data: {
        capabilityType: 'email',
        name: 'Email',
        description: 'Send and receive emails through various providers',
        supportedFeaturesJson: ['send', 'receive', 'draft', 'sync', 'attachments'],
        defaultConfigJson: { autoSync: true, maxAttachments: 10 },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'calendar',
        name: 'Calendar',
        description: 'Manage calendar events and schedules',
        supportedFeaturesJson: ['create', 'update', 'delete', 'list', 'sync'],
        defaultConfigJson: { syncWindow: 30, defaultReminder: 15 },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'messaging',
        name: 'Messaging',
        description: 'Send SMS and instant messages',
        supportedFeaturesJson: ['send', 'receive', 'media', 'delivery_receipts'],
        defaultConfigJson: { maxRetries: 3, rateLimitPerMinute: 60 },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'calling',
        name: 'Voice Calling',
        description: 'Make and receive voice calls with transcription',
        supportedFeaturesJson: ['call', 'receive', 'transcribe', 'record'],
        defaultConfigJson: { recordCalls: false, autoTranscribe: true },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'contacts',
        name: 'Contacts',
        description: 'Sync and manage contact information',
        supportedFeaturesJson: ['sync', 'create', 'update', 'merge', 'deduplicate'],
        defaultConfigJson: { autoMerge: false, syncFrequency: 'daily' },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'storage',
        name: 'File Storage',
        description: 'Store and retrieve files in cloud storage',
        supportedFeaturesJson: ['upload', 'download', 'share', 'organize'],
        defaultConfigJson: { maxFileSize: '100MB', defaultFolder: '/opportunity-os' },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'discovery',
        name: 'Content Discovery',
        description: 'Discover and ingest external content',
        supportedFeaturesJson: ['crawl', 'extract', 'summarize', 'classify'],
        defaultConfigJson: { maxDepth: 3, respectRobots: true },
      },
    }),
    prisma.capability.create({
      data: {
        capabilityType: 'crm',
        name: 'CRM',
        description: 'Sync contacts, deals, and activities with external CRMs',
        supportedFeaturesJson: ['contact_sync', 'deal_sync', 'activity_sync', 'search'],
        defaultConfigJson: { autoSync: true },
      },
    }),
  ]);

  console.log('Created capabilities:', capabilities.map((c: any) => c.name));

  // Create capability providers
  const emailCapability = capabilities.find((c: any) => c.capabilityType === 'email')!;
  const calendarCapability = capabilities.find((c: any) => c.capabilityType === 'calendar')!;
  const messagingCapability = capabilities.find((c: any) => c.capabilityType === 'messaging')!;
  const discoveryCapability = capabilities.find((c: any) => c.capabilityType === 'discovery')!;
  const storageCapability = capabilities.find((c: any) => c.capabilityType === 'storage')!;
  const crmCapability = capabilities.find((c: any) => c.capabilityType === 'crm')!;

  const providers = await Promise.all([
    // Email providers
    prisma.capabilityProvider.create({
      data: {
        capabilityId: emailCapability.id,
        providerName: 'gmail',
        displayName: 'Gmail',
        description: 'Google Gmail integration',
        authType: 'oauth2',
        requiredScopesJson: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
        rateLimitConfigJson: { requestsPerSecond: 10, burstSize: 20 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            clientSecret: { type: 'string' },
            redirectUri: { type: 'string' },
          },
          required: ['clientId', 'clientSecret'],
        },
      },
    }),
    prisma.capabilityProvider.create({
      data: {
        capabilityId: emailCapability.id,
        providerName: 'outlook',
        displayName: 'Outlook',
        description: 'Microsoft Outlook integration',
        authType: 'oauth2',
        requiredScopesJson: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read'],
        rateLimitConfigJson: { requestsPerSecond: 5, burstSize: 10 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            clientSecret: { type: 'string' },
            tenantId: { type: 'string' },
          },
          required: ['clientId', 'clientSecret', 'tenantId'],
        },
      },
    }),

    // Calendar providers
    prisma.capabilityProvider.create({
      data: {
        capabilityId: calendarCapability.id,
        providerName: 'google_calendar',
        displayName: 'Google Calendar',
        description: 'Google Calendar integration',
        authType: 'oauth2',
        requiredScopesJson: ['https://www.googleapis.com/auth/calendar'],
        rateLimitConfigJson: { requestsPerSecond: 5, burstSize: 10 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            clientSecret: { type: 'string' },
            redirectUri: { type: 'string' },
          },
          required: ['clientId', 'clientSecret'],
        },
      },
    }),

    // Messaging providers
    prisma.capabilityProvider.create({
      data: {
        capabilityId: messagingCapability.id,
        providerName: 'twilio',
        displayName: 'Twilio',
        description: 'Twilio SMS and messaging',
        authType: 'api_key',
        requiredScopesJson: [],
        rateLimitConfigJson: { messagesPerSecond: 10, dailyLimit: 1000 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            accountSid: { type: 'string' },
            authToken: { type: 'string' },
            fromNumber: { type: 'string' },
          },
          required: ['accountSid', 'authToken'],
        },
      },
    }),

    // Discovery providers
    prisma.capabilityProvider.create({
      data: {
        capabilityId: discoveryCapability.id,
        providerName: 'firecrawl',
        displayName: 'Firecrawl',
        description: 'Firecrawl web crawling and extraction',
        authType: 'api_key',
        requiredScopesJson: [],
        rateLimitConfigJson: { requestsPerMinute: 60, concurrentCrawls: 5 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
            baseUrl: { type: 'string', default: 'https://api.firecrawl.dev' },
          },
          required: ['apiKey'],
        },
      },
    }),

    // Storage providers
    prisma.capabilityProvider.create({
      data: {
        capabilityId: storageCapability.id,
        providerName: 'google_drive',
        displayName: 'Google Drive',
        description: 'Google Drive file storage',
        authType: 'oauth2',
        requiredScopesJson: ['https://www.googleapis.com/auth/drive.file'],
        rateLimitConfigJson: { uploadsPerSecond: 5, downloadsPerSecond: 10 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            clientSecret: { type: 'string' },
            redirectUri: { type: 'string' },
          },
          required: ['clientId', 'clientSecret'],
        },
      },
    }),

    // CRM providers
    prisma.capabilityProvider.create({
      data: {
        capabilityId: crmCapability.id,
        providerName: 'hubspot',
        displayName: 'HubSpot',
        description: 'HubSpot CRM integration',
        authType: 'oauth2',
        requiredScopesJson: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
        rateLimitConfigJson: { requestsPerSecond: 10 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
          },
          required: ['accessToken'],
        },
      },
    }),
    prisma.capabilityProvider.create({
      data: {
        capabilityId: crmCapability.id,
        providerName: 'salesforce',
        displayName: 'Salesforce',
        description: 'Salesforce CRM integration',
        authType: 'oauth2',
        requiredScopesJson: ['api', 'refresh_token', 'offline_access'],
        rateLimitConfigJson: { requestsPerSecond: 5 },
        providerConfigSchemaJson: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            instanceUrl: { type: 'string' },
          },
          required: ['accessToken', 'instanceUrl'],
        },
      },
    }),
  ]);

  console.log('Created providers:', providers.map((p: any) => p.displayName));

  // Create connector configurations for key providers
  const gmailProvider = providers.find((p: any) => p.providerName === 'gmail')!;
  const googleCalendarProvider = providers.find((p: any) => p.providerName === 'google_calendar')!;
  const twilioProvider = providers.find((p: any) => p.providerName === 'twilio')!;

  const configurations = await Promise.all([
    prisma.connectorConfiguration.create({
      data: {
        capabilityProviderId: gmailProvider.id,
        configKey: 'oauth_scopes',
        configValue: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
        configType: 'oauth_scope',
        isRequired: true,
        isUserConfigurable: false,
        description: 'Required OAuth scopes for Gmail access',
      },
    }),
    prisma.connectorConfiguration.create({
      data: {
        capabilityProviderId: gmailProvider.id,
        configKey: 'rate_limit',
        configValue: { requestsPerSecond: 10, burstSize: 20 },
        configType: 'rate_limit',
        isRequired: false,
        isUserConfigurable: true,
        description: 'Rate limiting configuration for Gmail API',
      },
    }),
    prisma.connectorConfiguration.create({
      data: {
        capabilityProviderId: googleCalendarProvider.id,
        configKey: 'oauth_scopes',
        configValue: ['https://www.googleapis.com/auth/calendar'],
        configType: 'oauth_scope',
        isRequired: true,
        isUserConfigurable: false,
        description: 'Required OAuth scopes for Google Calendar access',
      },
    }),
    prisma.connectorConfiguration.create({
      data: {
        capabilityProviderId: twilioProvider.id,
        configKey: 'api_endpoint',
        configValue: 'https://api.twilio.com/2010-04-01',
        configType: 'api_endpoint',
        isRequired: false,
        isUserConfigurable: false,
        description: 'Twilio API endpoint URL',
      },
    }),
  ]);

  console.log('Created configurations:', configurations.map((c: any) => c.configKey));

  console.log('Capability integration seeding completed!');
}

async function main() {
  try {
    await seedCapabilities();
  } catch (error) {
    console.error('Error seeding capabilities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
