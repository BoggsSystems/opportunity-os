import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { OfferingsService } from './offerings.service';
import { CreateOfferingProposalFromConversationDto } from './dto/create-offering-proposal-from-conversation.dto';
import { CreateOfferingProposalDto } from './dto/create-offering-proposal.dto';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingProposalDto } from './dto/update-offering-proposal.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

@Controller('offerings')
export class OfferingsController {
  constructor(private readonly offeringsService: OfferingsService) {}

  @Post()
  async create(@Body() createOfferingDto: CreateOfferingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.create(createOfferingDto, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findAll(user.id);
  }

  @Post('proposals')
  async createProposal(
    @Body() createOfferingProposalDto: CreateOfferingProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offeringsService.createProposal(user.id, createOfferingProposalDto);
  }

  @Post('proposals/from-conversation')
  async createProposalFromConversation(
    @Body() createOfferingProposalFromConversationDto: CreateOfferingProposalFromConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offeringsService.createProposalFromConversation(user.id, createOfferingProposalFromConversationDto.sessionId);
  }

  @Get('proposals')
  async findProposals(@CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findProposals(user.id);
  }

  @Get('proposals/pending')
  async findPendingProposal(@CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findPendingProposal(user.id);
  }

  @Get('proposals/:id')
  async findProposal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findProposal(id, user.id);
  }

  @Patch('proposals/:id')
  async updateProposal(
    @Param('id') id: string,
    @Body() updateOfferingProposalDto: UpdateOfferingProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offeringsService.updateProposal(id, user.id, updateOfferingProposalDto);
  }

  @Post('proposals/:id/confirm')
  async confirmProposal(
    @Param('id') id: string,
    @Body() updateOfferingProposalDto: UpdateOfferingProposalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offeringsService.confirmProposal(id, user.id, updateOfferingProposalDto);
  }

  @Post('proposals/:id/reject')
  async rejectProposal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.rejectProposal(id, user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findOne(id, user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateOfferingDto: UpdateOfferingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.update(id, updateOfferingDto, user.id);
  }

  @Get(':id/positioning')
  async findPositionings(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findPositionings(id, user.id);
  }

  @Get(':id/assets')
  async findAssets(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findAssets(id, user.id);
  }
}
