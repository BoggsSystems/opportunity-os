import pino from 'pino';
import { getConfig } from '@opportunity-os/config';

const config = getConfig();

const baseLogger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      const err = object['err'] as { message?: string; stack?: string } | undefined;
      if (err) {
        object['err'] = {
          ...err,
          message: err.message,
          stack: err.stack,
        };
      }
      return object;
    },
  },
});

export function createLogger(context?: string) {
  if (context) {
    return baseLogger.child({ context });
  }
  return baseLogger;
}

export const logger = createLogger();

export default logger;
