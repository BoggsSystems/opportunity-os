import { Controller, Get, Post, Body, Query, UnauthorizedException } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { UserPostureService } from './user-posture.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  ConceptSourceType,
  IngestionArtifactStatus,
  IntelligenceChunkKind,
  IntelligenceJobStatus,
} from '@opportunity-os/db';

@Controller('intelligence')
export class IntelligenceController {
  constructor(
    private readonly intelligenceService: IntelligenceService,
    private readonly userPostureService: UserPostureService,
  ) {}

  @Get('vault')
  async getVault(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.getVault(user.id);
  }

  @Get('artifacts')
  async getArtifacts(
    @Query('status') status: IngestionArtifactStatus | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.getIngestionArtifacts(user.id, status);
  }

  @Get('jobs')
  async getJobs(
    @Query('status') status: IntelligenceJobStatus | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.getIntelligenceJobs(user.id, status);
  }

  @Get('chunks')
  async getChunks(
    @Query('kind') kind: IntelligenceChunkKind | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.getIntelligenceChunks(user.id, kind);
  }

  @Post('shred')
  async shredAssets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: { 
      assetIds: string[]; 
      sourceType: ConceptSourceType; 
      providerName?: string; 
      connectorId?: string;
      synthesisOnly?: boolean;
    }
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.shredAssets(
      user.id, 
      data.assetIds, 
      data.sourceType, 
      data.providerName, 
      data.connectorId,
      data.synthesisOnly
    );
  }

  @Post('link-proof')
  async linkConceptToProof(
    @Body() data: { conceptId: string; proofPointId: string }
  ) {
    return this.intelligenceService.linkConceptToProof(data.conceptId, data.proofPointId);
  }

  @Post('posture/synthesize')
  async synthesizePosture(@CurrentUser() user: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException();
    return this.userPostureService.synthesizePosture(user.id);
  }

  @Get('posture')
  async getPosture(@CurrentUser() user: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException();
    return this.userPostureService.getPosture(user.id);
  }
}
