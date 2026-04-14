# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker
- Git

### Setup

1. **Install pnpm** (if not already installed)
   ```bash
   curl -fsSL https://get.pnpm.io/install.sh | sh -
   source ~/.zshrc
   ```

2. Clone the repository
3. Run `./scripts/setup.sh`
4. Update `.env` with your configuration
5. Start development services

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/opportunity_os

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3001
NODE_ENV=development

# AI Services
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Integrations
GITHUB_TOKEN=your_github_token
STRIPE_SECRET_KEY=your_stripe_key

# Authentication
JWT_SECRET=your_jwt_secret

# Logging
LOG_LEVEL=debug
```

## Development Commands

### Root Commands

```bash
# Install dependencies
pnpm install

# Development mode (all packages)
pnpm dev

# Build all packages
pnpm build

# Test all packages
pnpm test

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Clean all packages
pnpm clean
```

### Individual Apps

```bash
# API server
pnpm dev:api
pnpm build:api

# Worker
pnpm dev:worker
pnpm build:worker

# Web frontend
pnpm dev:web
pnpm build:web

# Browser agent
pnpm dev:browser-agent
pnpm build:browser-agent
```

### Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Reset database
pnpm db:reset

# View database
pnpm db:studio
```

## Project Structure

### Apps

- **api/**: NestJS API server with health endpoint
- **worker/**: Background job processor
- **web/**: Frontend application (placeholder)
- **browser-agent/**: Browser automation (placeholder)
- **extension/**: Browser extension (placeholder)

### Packages

- **config/**: Environment configuration with Zod validation
- **db/**: Prisma schema, client, and migrations
- **types/**: Shared TypeScript types and enums
- **logger/**: Pino logging utilities
- **queue/**: Job queue definitions and types
- **ai/**: AI integration and providers
- **integrations/**: External service integrations
- **auth/**: Authentication utilities
- **common/**: Shared utility functions
- **ui-contracts/**: UI validation schemas

## Code Standards

### TypeScript

- Use strict mode
- Prefer explicit types
- Use shared types from `@opportunity-os/types`
- Follow naming conventions

### Database

- Use Prisma for all database operations
- Write migrations for schema changes
- Include seed data for development
- Use transactions for complex operations

### Logging

- Use structured logging with Pino
- Include context and correlation IDs
- Log at appropriate levels
- Avoid sensitive data in logs

## Testing

### Unit Tests
- Use Jest for unit testing
- Mock external dependencies
- Test business logic thoroughly
- Maintain good coverage

### Integration Tests
- Test API endpoints
- Test database operations
- Test job processing
- Use test databases

## Deployment

### Local Development
- Use Docker Compose for services
- Use environment variables for configuration
- Run migrations before starting

### Production
- Build optimized bundles
- Use environment-specific configs
- Monitor and log appropriately
- Use proper secrets management

## Troubleshooting

### Common Issues

1. **Database connection**: Ensure PostgreSQL is running
2. **Redis connection**: Check Redis service status
3. **Type errors**: Run `pnpm typecheck`
4. **Build failures**: Check dependencies and clean build

### Debugging

- Use `pnpm dev` for hot reloading
- Check logs with appropriate log level
- Use database studio for data inspection
- Use browser dev tools for frontend issues
