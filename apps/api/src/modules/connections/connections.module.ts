import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConnectionImportController } from './connection-import.controller';
import { ConnectionImportService } from './services/connection-import.service';
import { AuthModule } from '../auth/auth.module';

// Prisma Models (will be replaced with actual imports when Prisma is integrated)

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [
    ConnectionImportController,
  ],
  providers: [
    ConnectionImportService,
  ],
  exports: [
    ConnectionImportService,
  ],
})
export class ConnectionsModule {}
