import { Module } from '@nestjs/common';
import { NextActionsModule } from '../next-actions/next-actions.module';
import { CommercialModule } from '../commercial/commercial.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { OfferingsModule } from '../offerings/offerings.module';
import { AiModule } from '../ai/ai.module';
import { OutreachModule } from '../outreach/outreach.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [
    NextActionsModule,
    CommercialModule,
    DiscoveryModule,
    OfferingsModule,
    AiModule,
    OutreachModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
