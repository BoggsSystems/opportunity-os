// Authentication utilities and types

import type { User } from '@opportunity-os/types';

export interface CurrentUser extends User {
  subscription?: {
    status: string;
    planId: string;
    features: string[];
  };
}

export interface AuthContext {
  user: CurrentUser;
  token: string;
  permissions: string[];
}

export const AUTH_CONSTANTS = {
  TOKEN_HEADER: 'Authorization',
  TOKEN_PREFIX: 'Bearer ',
  DEFAULT_PERMISSIONS: ['read:own'],
  ADMIN_PERMISSIONS: ['read:all', 'write:all', 'admin'],
} as const;

export function hasPermission(context: AuthContext, permission: string): boolean {
  return context.permissions.includes(permission);
}

export function hasFeature(context: AuthContext, feature: string): boolean {
  return context.user.subscription?.features.includes(feature) || false;
}
