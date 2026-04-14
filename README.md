# Opportunity OS

AI-powered opportunity pipeline platform.

## Architecture

This is a monorepo built with:
- **pnpm** - Package management
- **Turborepo** - Build orchestration
- **TypeScript** - Type safety
- **NestJS** - API framework
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching and queues

## Structure

```
opportunity-os/
  apps/                 # Applications
    api/               # NestJS API server
    worker/            # Background job processor
    web/               # Frontend web app
    browser-agent/     # Browser automation
    extension/         # Browser extension
  packages/            # Shared libraries
    config/           # Environment configuration
    db/               # Database client and schema
    types/            # Shared TypeScript types
    ui-contracts/     # UI contracts and schemas
    auth/             # Authentication utilities
    logger/           # Logging utilities
    queue/            # Queue definitions
    ai/               # AI service integrations
    integrations/     # External integrations
    common/           # Common utilities
  infra/              # Infrastructure
    docker/           # Docker configurations
    terraform/        # Terraform configs
    k8s/              # Kubernetes manifests
    env/              # Environment configs
  docs/               # Documentation
  scripts/            # Utility scripts
```

## Quick Start

1. **Install pnpm** (if not already installed)
   ```bash
   curl -fsSL https://get.pnpm.io/install.sh | sh -
   source ~/.zshrc
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start local services**
   ```bash
   pnpm docker:up
   ```

4. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```
   **Note**: Opportunity OS uses PostgreSQL on port 5433. If you have another PostgreSQL instance running, ensure no port conflicts.

5. **Generate database schema**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

6. **Start development**
   ```bash
   pnpm dev
   ```

## Available Scripts

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Lint all packages
- `pnpm test` - Run all tests
- `pnpm typecheck` - Type check all packages
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio
- `pnpm docker:up` - Start local Docker services
- `pnpm docker:down` - Stop local Docker services

## Environment Variables

See `.env.example` for all required environment variables.

## Development

### API Server
The API server runs on `http://localhost:3001` by default.

### Database
Use `pnpm db:studio` to open Prisma Studio and explore the database.

### Background Jobs
The worker processes background jobs using BullMQ and Redis.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT
