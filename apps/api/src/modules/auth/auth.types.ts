export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId?: string;
  authenticationIdentityId?: string;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  email: string;
  identityId?: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshSessionContext {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}
