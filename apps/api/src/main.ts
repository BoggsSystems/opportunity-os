import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { createLogger } from '@opportunity-os/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const logger = createLogger('bootstrap');
  
  const port = configService.get<number>('PORT') || 3002;
  const host = process.env['HOSTNAME'] || '127.0.0.1';
  
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  await app.listen(port, host);
  
  logger.info(`Application is running on: http://${host}:${port}`);
}

bootstrap();
