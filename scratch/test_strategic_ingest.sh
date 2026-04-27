#!/bin/bash

# Configuration
API_URL="http://localhost:3002"
ZIP_PATH="/Users/jeffboggs/Downloads/Complete_LinkedInDataExport_03-10-2026.zip.zip"
USER_EMAIL="test-user-$(date +%s)@example.com"
USER_PASS="Password123!"

echo "🚀 Starting End-to-End Strategic Ingest Test"
echo "📧 Testing with user: $USER_EMAIL"

# 1. Register
echo "📝 Registering new user..."
REGISTER_RES=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\", \"password\":\"$USER_PASS\", \"fullName\":\"Test Strategic User\"}")

if [[ $REGISTER_RES == *"accessToken"* ]]; then
  echo "✅ Registration successful"
else
  echo "❌ Registration failed: $REGISTER_RES"
  exit 1
fi

# 2. Login to get fresh token
echo "🔑 Logging in..."
LOGIN_RES=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\", \"password\":\"$USER_PASS\"}")

TOKEN=$(echo $LOGIN_RES | grep -oE '"accessToken":"[^"]+"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to extract token: $LOGIN_RES"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

# 2.5 Verify Token
echo "👤 Verifying token with /auth/me..."
ME_RES=$(curl -s -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")
echo "👤 Me Response: $ME_RES"

# 2.7 Verify Controller Registration
echo "📋 Checking /connections/imports..."
IMPORTS_RES=$(curl -s -X GET "$API_URL/connections/imports" \
  -H "Authorization: Bearer $TOKEN")
echo "📋 Imports Response: $IMPORTS_RES"

# 2.8 Test /connections/import
echo "📋 Testing /connections/import..."
IMPORT_TEST_RES=$(curl -s -X POST "$API_URL/connections/import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/Users/jeffboggs/opportunity-os/test_connections.csv" \
  -F "name=Import Test")
echo "📋 Import Test Response: $IMPORT_TEST_RES"

# 3. Ingest ZIP
echo "📦 Ingesting LinkedIn ZIP..."
INGEST_RES=$(curl -v -X POST "$API_URL/connections/ingest-zip" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$ZIP_PATH" \
  -F "name=End-to-End Strategic Audit" \
  -F "source=linkedin_export")

echo "📥 Ingest Response: $INGEST_RES"

# 4. Verify Persistence
echo "🔍 Verifying database persistence..."
sleep 2 # Wait for AI processing if any (though it's usually synchronous in this endpoint)

OFFERINGS_RES=$(curl -s -X GET "$API_URL/connections/imports" \
  -H "Authorization: Bearer $TOKEN")

echo "📊 Imports in DB: $OFFERINGS_RES"

echo "✨ Test complete."
