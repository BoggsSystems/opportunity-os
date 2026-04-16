import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@opportunity-os/db';
import { OfferingContext, OfferingInterpretation } from '../interfaces/offering-context.interface';
import { AiService } from '../../ai/ai.service';

const prisma = new PrismaClient();

@Injectable()
export class OfferingContextService {
  constructor(private aiService: AiService) {}

  async getActiveOfferingContext(userId: string): Promise<OfferingContext | null> {
    // Get the most recently updated active offering
    const offering = await prisma.offering.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        positionings: {
          where: {
            status: 'active',
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        assets: {
          where: {
            status: 'active',
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!offering) {
      return null;
    }

    return {
      offering: {
        id: offering.id,
        title: offering.title,
        description: offering.description || '',
        offeringType: offering.offeringType,
        status: offering.status,
      },
      positionings: offering.positionings.map(pos => ({
        id: pos.id,
        title: pos.title,
        description: pos.description || '',
        status: pos.status,
      })),
      assets: offering.assets.map(asset => ({
        id: asset.id,
        title: asset.title,
        description: asset.description || '',
        assetType: asset.assetType,
        contentUrl: asset.contentUrl || undefined,
        contentText: asset.contentText || undefined,
        isPublic: asset.isPublic,
        status: asset.status,
        offeringPositioningId: asset.offeringPositioningId || undefined,
      })),
    };
  }

  async interpretOffering(context: OfferingContext): Promise<OfferingInterpretation> {
    // Use AI service to get enhanced interpretation
    try {
      const aiInterpretation = await this.aiService.interpretOffering(context);
      
      // If AI returns structured data, use it
      if (aiInterpretation.structured) {
        return aiInterpretation.interpretation;
      }
      
      // Fallback to rule-based interpretation if AI fails
      console.warn('AI interpretation was unstructured, falling back to rule-based interpretation');
      return this.ruleBasedInterpretation(context);
    } catch (error) {
      console.error('AI interpretation failed, using rule-based fallback:', error);
      return this.ruleBasedInterpretation(context);
    }
  }

  private ruleBasedInterpretation(context: OfferingContext): OfferingInterpretation {
    // Original rule-based interpretation as fallback
    const { offering, positionings, assets } = context;

    // Extract target audiences from positionings and offering description
    const targetAudience = this.extractTargetAudience(offering, positionings);
    
    // Determine likely opportunity types based on offering type and positioning
    const likelyOpportunityTypes = this.determineOpportunityTypes(offering, positionings);
    
    // Identify likely channels based on asset types and positioning
    const likelyChannels = this.identifyChannels(assets, positionings);
    
    // Map supporting assets by type and relevance
    const supportingAssets = assets.map(asset => `${asset.title} (${asset.assetType})`);
    
    // Determine next step patterns from positioning angles
    const nextStepPatterns = this.extractNextStepPatterns(positionings);
    
    // Extract strategic focus areas
    const strategicFocus = this.extractStrategicFocus(offering, positionings);

    return {
      targetAudience,
      likelyOpportunityTypes,
      likelyChannels,
      supportingAssets,
      nextStepPatterns,
      strategicFocus,
    };
  }

  private extractTargetAudience(offering: any, positionings: any[]): string[] {
    const audiences = new Set<string>();
    
    // Extract from positionings
    positionings.forEach(pos => {
      if (pos.description.includes('CTO')) audiences.add('CTOs');
      if (pos.description.includes('engineering leaders')) audiences.add('Engineering Leaders');
      if (pos.description.includes('Heads of Engineering')) audiences.add('Heads of Engineering');
      if (pos.description.includes('Engineering Directors')) audiences.add('Engineering Directors');
      if (pos.description.includes('Technical product leaders')) audiences.add('Technical Product Leaders');
    });

    // Extract from offering description
    if (offering.description.includes('software organization')) audiences.add('Software Organizations');
    if (offering.description.includes('financial firms')) audiences.add('Financial Firms');
    if (offering.description.includes('product organizations')) audiences.add('Product Organizations');

    return Array.from(audiences);
  }

  private determineOpportunityTypes(offering: any, positionings: any[]): string[] {
    const types = new Set<string>();
    
    if (offering.offeringType === 'consulting') {
      types.add('Consulting Engagement');
      types.add('Strategic Assessment');
      types.add('Transformation Project');
    }

    positionings.forEach(pos => {
      if (pos.title.includes('transformation')) types.add('Digital Transformation');
      if (pos.title.includes('audit') || pos.title.includes('diagnostic')) types.add('Organizational Audit');
      if (pos.title.includes('velocity') || pos.title.includes('competitiveness')) types.add('Process Optimization');
    });

    return Array.from(types);
  }

  private identifyChannels(assets: any[], positionings: any[]): string[] {
    const channels = new Set<string>();
    
    // From assets
    assets.forEach(asset => {
      if (asset.assetType === 'document') channels.add('Executive Briefings');
      if (asset.assetType === 'image') channels.add('Visual Presentations');
      if (asset.assetType === 'video') channels.add('Video Content');
      if (asset.assetType === 'other' && asset.title.includes('LinkedIn')) channels.add('Social Media');
      if (asset.assetType === 'portfolio') channels.add('Portfolio Reviews');
      if (asset.assetType === 'case_study') channels.add('Case Study Distribution');
    });

    // From positionings
    positionings.forEach(pos => {
      if (pos.title.includes('Executive')) channels.add('Executive Meetings');
      if (pos.title.includes('diagnostic')) channels.add('Assessment Workshops');
      if (pos.title.includes('velocity')) channels.add('Performance Reviews');
    });

    return Array.from(channels);
  }

  private extractNextStepPatterns(positionings: any[]): string[] {
    const patterns = new Set<string>();
    
    positionings.forEach(pos => {
      if (pos.title.includes('Executive')) patterns.add('Schedule Executive Discovery Call');
      if (pos.title.includes('diagnostic')) patterns.add('Conduct Initial Assessment');
      if (pos.title.includes('transformation')) patterns.add('Develop Transformation Roadmap');
      if (pos.title.includes('velocity')) patterns.add('Analyze Current Velocity Metrics');
    });

    return Array.from(patterns);
  }

  private extractStrategicFocus(offering: any, positionings: any[]): string[] {
    const focus = new Set<string>();
    
    // From offering type
    if (offering.offeringType === 'consulting') {
      focus.add('Strategic Consulting');
      focus.add('Process Improvement');
    }

    // From positionings
    positionings.forEach(pos => {
      if (pos.description.includes('AI')) focus.add('AI Integration');
      if (pos.description.includes('delivery')) focus.add('Delivery Optimization');
      if (pos.description.includes('workflow')) focus.add('Workflow Redesign');
      if (pos.description.includes('team')) focus.add('Team Structure');
      if (pos.description.includes('governance')) focus.add('Governance Patterns');
    });

    return Array.from(focus);
  }
}
