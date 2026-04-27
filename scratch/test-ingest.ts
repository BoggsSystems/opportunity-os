import { NestFactory } from '@nestjs/core';
import { ConnectionsModule } from '../apps/api/src/modules/connections/connections.module';
import { LinkedInIngestService } from '../apps/api/src/modules/connections/services/linkedin-ingest.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ConnectionsModule);
  const service = app.get(LinkedInIngestService);
  
  const zipPath = '/Users/jeffboggs/Downloads/Complete_LinkedInDataExport_03-10-2026.zip';
  const userId = 'b7d60c45-0cd6-45db-bdc8-6fd4b1dc084d';
  const importId = 'test-import-' + Date.now();

  console.log(`🚀 Starting ingest test for file: ${zipPath}`);
  
  const buffer = fs.readFileSync(zipPath);
  
  try {
    const draft = await service.processFullZip(buffer, userId, importId);
    console.log('✅ STRATEGIC DRAFT GENERATED:');
    console.log(JSON.stringify(draft, null, 2));
  } catch (error) {
    console.error('❌ INGEST FAILED:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
