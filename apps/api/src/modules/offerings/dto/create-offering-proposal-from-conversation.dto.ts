import { IsUUID } from 'class-validator';

export class CreateOfferingProposalFromConversationDto {
  @IsUUID()
  sessionId: string;
}
