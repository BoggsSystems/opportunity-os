#!/bin/bash

# Opportunity OS Setup Script
# Sets up the development environment for the monorepo

set -e

echo "Setting up Opportunity OS development environment..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Please install pnpm first:"
    echo "npm install -g pnpm"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Set up environment file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please update .env with your configuration"
fi

# Start infrastructure
echo "Starting infrastructure services..."
docker-compose -f infra/docker/docker-compose.local.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Generate Prisma client
echo "Generating Prisma client..."
cd packages/db
pnpm db:generate

# Run database migrations
echo "Running database migrations..."
pnpm db:migrate

# Seed database
echo "Seeding database..."
pnpm db:seed

cd ../..

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your API keys and configuration"
echo "2. Start the API server: pnpm dev:api"
echo "3. Start the worker: pnpm dev:worker"
echo "4. Visit http://localhost:3001/health to check API status"
