# Architecture

## Overview

Opportunity OS is a TypeScript monorepo built with pnpm and Turborepo for an AI-powered opportunity pipeline platform.

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: NestJS (API), BullMQ (Jobs)
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis
- **Logging**: Pino
- **Validation**: Zod

### Frontend
- **Web**: TBD (React/Next.js planned)
- **Browser Extension**: TBD
- **Browser Agent**: Node.js with Playwright

### Infrastructure
- **Containerization**: Docker
- **Package Management**: pnpm
- **Monorepo**: Turborepo
- **Code Quality**: TypeScript, ESLint, Prettier

## Structure

```
opportunity-os/
apps/
  api/           # NestJS API server
  worker/        # Background job processor
  web/           # Web frontend
  browser-agent/ # Browser automation
  extension/     # Browser extension
packages/
  config/        # Environment configuration
  db/            # Database schema and client
  types/         # Shared TypeScript types
  logger/        # Logging utilities
  queue/         # Queue definitions
  ai/            # AI integration
  integrations/  # External integrations
  auth/          # Authentication utilities
  common/        # Common utilities
  ui-contracts/  # UI validation schemas
infra/
  docker/        # Docker configurations
scripts/
  setup.sh       # Environment setup
  clean.sh       # Cleanup script
docs/
  ARCHITECTURE.md # This file
```

## Data Flow

1. **API Server** receives HTTP requests
2. **Worker** processes background jobs
3. **Database** stores persistent data
4. **Redis** handles caching and job queues
5. **AI Services** process intelligent tasks
6. **Browser Agent** automates web interactions

## Key Patterns

### Shared Packages
- Config: Centralized environment validation
- Types: Shared TypeScript definitions
- Logger: Structured logging across services
- Queue: Job type definitions and queue names

### Database Design
- Multi-tenant architecture with user-centric data
- Opportunity pipeline with stages and activities
- Subscription and usage tracking
- Evidence collection and resume generation

### AI Integration
- Pluggable AI providers (OpenAI, Anthropic)
- Prompt templates and routing
- Usage tracking and cost management

## Development Workflow

1. Run `./scripts/setup.sh` to initialize environment
2. Use `pnpm dev` for development mode
3. Use `pnpm build` for production builds
4. Use `pnpm test` for running tests

## Deployment Considerations

- API server: Stateless, can be horizontally scaled
- Worker: Can be scaled based on job volume
- Database: Requires migrations and seeding
- Redis: Single instance for development, clustered for production
