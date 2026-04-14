#!/bin/bash

# Opportunity OS Clean Script
# Cleans up build artifacts and containers

set -e

echo "Cleaning Opportunity OS..."

# Clean build artifacts
echo "Cleaning build artifacts..."
pnpm clean
find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# Stop and remove containers
echo "Stopping and removing containers..."
docker-compose -f infra/docker/docker-compose.local.yml down -v

# Remove Docker images
echo "Removing Docker images..."
docker rmi opportunity-os-postgres 2>/dev/null || true
docker rmi opportunity-os-redis 2>/dev/null || true

# Remove Docker volumes
echo "Removing Docker volumes..."
docker volume rm opportunity-os_postgres_data 2>/dev/null || true
docker volume rm opportunity-os_redis_data 2>/dev/null || true

echo "Clean complete!"
