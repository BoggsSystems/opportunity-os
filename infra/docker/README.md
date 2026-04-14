# Docker Infrastructure

Local development infrastructure for Opportunity OS.

## Services

- **PostgreSQL**: Database server on port 5432
- **Redis**: Cache and queue server on port 6379

## Usage

Start the services:

```bash
docker-compose -f docker-compose.local.yml up -d
```

Stop the services:

```bash
docker-compose -f docker-compose.local.yml down
```

View logs:

```bash
docker-compose -f docker-compose.local.yml logs -f
```

## Environment Variables

The services use default credentials for local development:

- PostgreSQL: `postgres:postgres@localhost:5432/opportunity_os`
- Redis: `redis://localhost:6379`

## Data Persistence

- PostgreSQL data is stored in Docker volume `postgres_data`
- Redis data is stored in Docker volume `redis_data`
