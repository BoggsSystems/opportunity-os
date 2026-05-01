import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().default('postgresql://postgres:password@localhost:5432/opportunity_os'),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // API
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // AI Services
  AI_PROVIDER: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_DISCOVERY_MODEL: z.string().default('gpt-4o'),
  TAVILY_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  PERPLEXITY_MODEL: z.string().default('sonar-reasoning'),
  PERPLEXITY_DISCOVERY_MODE: z.enum(['agent', 'search']).default('agent'),
  APOLLO_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CALLBACK_URL: z.string().url().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  MICROSOFT_CALLBACK_URL: z.string().url().optional(),
  API_PUBLIC_URL: z.string().url().optional(),

  // Integrations
  GITHUB_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(32).default('your-jwt-secret-change-in-production'),
  AUTH_SECRET: z.string().min(32).default('your-auth-secret-change-in-production'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Browser Agent
  BROWSER_HEADLESS: z.coerce.boolean().default(true),
  BROWSER_TIMEOUT: z.coerce.number().default(30000),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.safeParse(process.env);
  
  if (!env.success) {
    console.error('Invalid environment variables:', env.error.format());
    process.exit(1);
  }
  
  return env.data;
}
