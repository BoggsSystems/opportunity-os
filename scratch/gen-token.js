const crypto = require('crypto');

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function base64url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

const secret = 'local-development-jwt-secret-1234567890';
const header = { alg: 'HS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const claims = {
  sub: 'beea8f22-b737-475f-9372-21d8655fda62',
  sid: 'dummy-session-id',
  email: 'jeff@boggs.com',
  type: 'access',
  iat: now,
  exp: now + 3600
};

const encodedHeader = base64url(JSON.stringify(header));
const encodedPayload = base64url(JSON.stringify(claims));
const data = `${encodedHeader}.${encodedPayload}`;
const signature = sign(data, secret);

const token = `${data}.${signature}`;
console.log(token);
