import { createLogger } from '@opportunity-os/logger';
import { getConfig } from '@opportunity-os/config';

const logger = createLogger('worker');
const config = getConfig();

async function bootstrap() {
  logger.info('Starting Opportunity OS Worker...');
  
  // TODO: Initialize queue connections
  // TODO: Register job processors
  // TODO: Start schedulers
  
  logger.info('Worker started successfully');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down worker...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Shutting down worker...');
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start worker:', error);
  process.exit(1);
});
