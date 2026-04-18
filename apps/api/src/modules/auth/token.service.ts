import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getConfig } from '@opportunity-os/config';
import { AccessTokenClaims } from './auth.types';

@Injectable()
export class TokenService {
  private readonly config = getConfig();

  signAccessToken(payload: Omit<AccessTokenClaims, 'iat' | 'exp' | 'type'>, ttlSeconds: number): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      ...payload,
      type: 'access',
      iat: now,
      exp: now + ttlSeconds,
    };

    const encodedHeader = this.base64url(JSON.stringify(header));
    const encodedPayload = this.base64url(JSON.stringify(claims));
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = this.sign(data, this.config.JWT_SECRET);

    return `${data}.${signature}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid access token');
    }

    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.sign(data, this.config.JWT_SECRET);

    if (!this.safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid access token signature');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AccessTokenClaims;
    const now = Math.floor(Date.now() / 1000);

    if (payload.type !== 'access' || payload.exp <= now) {
      throw new UnauthorizedException('Access token expired');
    }

    return payload;
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashOpaqueToken(token: string): string {
    return createHash('sha256')
      .update(`${token}.${this.config.AUTH_SECRET}`)
      .digest('hex');
  }

  private sign(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('base64url');
  }

  private base64url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  }
}
