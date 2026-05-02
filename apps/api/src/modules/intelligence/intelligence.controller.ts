import { Controller, Get, Post, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ConceptSourceType } from '@opportunity-os/db';

@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  @Get('vault')
  async getVault(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.getVault(user.id);
  }

  @Post('shred')
  async shredText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: { text: string; sourceId: string; sourceType: ConceptSourceType }
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.shredText(user.id, data.text, {
      id: data.sourceId,
      type: data.sourceType
    });
  }

  @Post('concepts/link-proof')
  async linkConceptToProof(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: { conceptId: string; proofPointId: string }
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.intelligenceService.linkConceptToProof(data.conceptId, data.proofPointId);
  }
}
