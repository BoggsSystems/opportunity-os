const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');

// Root directory
const rootDir = '/Users/jeffboggs/opportunity-os';
const envPath = path.join(rootDir, '.env');

function base64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/JWT_SECRET="?([^"\n]+)"?/);
  if (!match) {
    console.error('JWT_SECRET not found in .env');
    process.exit(1);
  }
  const jwtSecret = match[1];

  // User from DB (these PIDs/IDs are from the existing generate-token.js)
  const userId = 'feb5205b-3be5-4180-9251-50d9861688de';
  const email = 'ai-native-book-1776882110@example.com';
  const sessionId = '77777777-7777-7777-7777-777777777777'; // Mock session

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: userId,
    sid: sessionId,
    email: email,
    identityId: undefined, // Optional in TokenService
    type: 'access',
    iat: now,
    exp: now + (24 * 60 * 60), // 24 hours
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(claims));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(data, jwtSecret);

  const token = `${data}.${signature}`;
  console.log(token);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
