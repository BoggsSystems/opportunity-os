# Setting Up Real AI Provider

## Step 1: Get OpenRouter API Key

1. Go to [OpenRouter.ai](https://openrouter.ai)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-`)

## Step 2: Configure Environment

Create a `.env` file in the project root with:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/opportunity_os"

# Redis
REDIS_URL="redis://localhost:6379"

# API
PORT=3001
NODE_ENV="development"

# AI Provider Configuration
AI_PROVIDER="openrouter"
OPENROUTER_API_KEY="sk-or-v1-your-actual-api-key-here"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
OPENROUTER_MODEL="anthropic/claude-3-haiku"

# Auth
JWT_SECRET="your-jwt-secret"
AUTH_SECRET="your-auth-secret"

# Logging
LOG_LEVEL="info"
```

## Step 3: Restart API Server

```bash
# Stop current server (Ctrl+C)
# Then restart
pnpm start:dev
```

## Step 4: Test Real AI

```bash
curl -X POST http://localhost:3002/ai/test \
  -H "Content-Type: application/json"
```

## Available Models

You can change the model in your `.env`:

- `anthropic/claude-3-haiku` (fast, cheap)
- `anthropic/claude-3-sonnet` (balanced)
- `anthropic/claude-3-opus` (most capable)
- `openai/gpt-4-turbo`
- `openai/gpt-3.5-turbo`

## Troubleshooting

If you get "not configured" error:
1. Check `.env` file exists in project root
2. Verify API key starts with `sk-or-v1-`
3. Restart the API server
4. Check for typos in variable names
