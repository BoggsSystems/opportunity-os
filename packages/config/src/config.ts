import { validateEnv, type Env } from './schema';

let config: Env;

export function getConfig(): Env {
  if (!config) {
    config = validateEnv();
  }
  return config;
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}
