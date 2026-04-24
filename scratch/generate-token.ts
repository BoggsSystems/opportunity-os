import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env
const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf8');
const jwtSecret = envContent.match(/JWT_SECRET="([^"]+)"/)?.[1];

if (!jwtSecret) {
  console.error('JWT_SECRET not found in .env');
  process.exit(1);
}

// User from DB
const userId = 'feb5205b-3be5-4180-9251-50d9861688de';
const email = 'ai-native-book-1776882110@example.com';
const sessionId = '77777777-7777-7777-7777-777777777777'; // Mock session

const token = jwt.sign(
  {
    sub: userId,
    sid: sessionId,
    email: email,
  },
  jwtSecret,
  { expiresIn: '24h' }
);

console.log(token);
