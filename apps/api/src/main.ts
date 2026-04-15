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
  
  await app.listen(port);
  
  logger.info(`Application is running on: http://localhost:${port}`);
}

bootstrap();
