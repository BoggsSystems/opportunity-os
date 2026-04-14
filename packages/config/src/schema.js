"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    // Database
    DATABASE_URL: zod_1.z.string().url().default('postgresql://postgres:password@localhost:5432/opportunity_os'),
    // Redis
    REDIS_URL: zod_1.z.string().url().default('redis://localhost:6379'),
    // API
    PORT: zod_1.z.coerce.number().default(3001),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // AI Services
    OPENAI_API_KEY: zod_1.z.string().optional(),
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
    // Integrations
    GITHUB_TOKEN: zod_1.z.string().optional(),
    STRIPE_SECRET_KEY: zod_1.z.string().optional(),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().optional(),
    // Auth
    JWT_SECRET: zod_1.z.string().min(32).default('your-jwt-secret-change-in-production'),
    AUTH_SECRET: zod_1.z.string().min(32).default('your-auth-secret-change-in-production'),
    // Logging
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    // Browser Agent
    BROWSER_HEADLESS: zod_1.z.coerce.boolean().default(true),
    BROWSER_TIMEOUT: zod_1.z.coerce.number().default(30000),
    // Email
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    // Monitoring
    SENTRY_DSN: zod_1.z.string().url().optional(),
    DATADOG_API_KEY: zod_1.z.string().optional(),
});
function validateEnv() {
    const env = envSchema.safeParse(process.env);
    if (!env.success) {
        console.error('Invalid environment variables:', env.error.format());
        process.exit(1);
    }
    return env.data;
}
//# sourceMappingURL=schema.js.map