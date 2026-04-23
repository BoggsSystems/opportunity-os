import { Module } from '@nestjs/common';
import { CommercialModule } from '../commercial/commercial.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';

@Module({
  imports: [CommercialModule, ConnectorsModule],
  controllers: [OutreachController],
  providers: [OutreachService],
})
export class OutreachModule {}
