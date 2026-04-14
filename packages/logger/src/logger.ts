import pino from 'pino';
import { getConfig } from '@opportunity-os/config';

const config = getConfig();

const baseLogger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      if (object.err) {
        object.err = {
          ...object.err,
          message: object.err.message,
          stack: object.err.stack,
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
