import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConnectionImportController } from './connection-import.controller';
import { ConnectionImportService } from './services/connection-import.service';
import { LinkedInIngestService } from './services/linkedin-ingest.service';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AuthModule,
    AiModule,
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // Increased to 50MB for full LinkedIn ZIPs
      },
    }),
  ],
  controllers: [
    ConnectionImportController,
  ],
  providers: [
    ConnectionImportService,
    LinkedInIngestService,
  ],
  exports: [
    ConnectionImportService,
    LinkedInIngestService,
  ],
})
export class ConnectionsModule {}
