import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@opportunity-os/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const logger = createLogger('bootstrap');
  
  const port = configService.get<number>('PORT') || 3001;
  
  app.enableCors();
  
  await app.listen(port);
  
  logger.info(`Application is running on: http://localhost:${port}`);
}

bootstrap();
