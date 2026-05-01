import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@opportunity-os/db';
import { 
  ContextStack, 
  ActionContext, 
  ActionLaneContext, 
  CampaignContext, 
  OfferingContext 
} from '../interfaces/context-stack.interface';

@Injectable()
export class ContextOrchestratorService {
  async buildStack(userId: string, actionItemId: string): Promise<ContextStack> {
    const actionItem = await (prisma.actionItem.findFirst({
      where: { id: actionItemId, userId },
      include: {
        actionLane: {
          include: {
            campaign: {
              include: {
                offering: true
              }
            }
          }
        },
        person: true,
        company: true,
        opportunity: true
      }
    }) as any);

    if (!actionItem) {
      throw new NotFoundException('ActionItem not found');
    }

    const stack: ContextStack = {
      action: {
        id: actionItem.id,
        title: actionItem.title,
        description: actionItem.description,
        suggestedAction: actionItem.suggestedAction,
        metadata: actionItem.metadataJson
      }
    };

    const lane = actionItem.actionLane;
    if (lane) {
      stack.actionLane = {
        id: lane.id,
        name: lane.name,
        type: lane.type,
        metadata: lane.metadataJson
      };

      const campaign = lane.campaign;
      if (campaign) {
        stack.campaign = {
          id: campaign.id,
          name: campaign.name,
          strategicAngle: campaign.strategicAngle,
          metadata: campaign.metadataJson
        };

        const offering = campaign.offering;
        if (offering) {
          stack.offering = {
            id: offering.id,
            title: offering.title,
            description: offering.description,
            valueProposition: offering.valueProposition,
            metadata: offering.metadataJson
          };
        }
      }
    }

    // Apply Persona Decorator logic
    this.decoratePersona(stack);

    return stack;
  }

  private decoratePersona(stack: ContextStack) {
    // Determine persona based on Lane Type or Campaign Metadata
    const laneType = stack.actionLane?.type?.toLowerCase();
    
    if (laneType === 'linkedin') {
      stack.persona = {
        name: 'The Social Professional',
        instructions: 'Write a brief, conversational LinkedIn DM. Avoid formal email greetings. Focus on mutual interests or specific company news.'
      };
    } else if (stack.campaign?.name?.toLowerCase().includes('job hunter') || stack.campaign?.metadata?.mission === 'JOB_HUNTER') {
      stack.persona = {
        name: 'The Proof-of-Work Job Hunter',
        instructions: 'Focus on providing evidence of past success that solves the specific pain mentioned in the signal. Keep it humble but high-expertise.'
      };
    } else {
      stack.persona = {
        name: 'The Value-First Consultant',
        instructions: 'Focus on providing a specific insight or observation before making any ask. Aim for curiosity and trust.'
      };
    }
  }
}
