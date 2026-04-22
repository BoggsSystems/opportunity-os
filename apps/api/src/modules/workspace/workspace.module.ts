import { Module } from '@nestjs/common';
import { NextActionsModule } from '../next-actions/next-actions.module';
import { CommercialModule } from '../commercial/commercial.module';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [NextActionsModule, CommercialModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
