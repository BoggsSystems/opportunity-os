import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma, prisma } from '@opportunity-os/db';
import { CommercialService } from '../commercial/commercial.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { SendOutreachDto } from './dto/send-outreach.dto';
import { AiService } from '../ai/ai.service';
import { ContextOrchestratorService } from './services/context-orchestrator.service';
import { ContextStack } from './interfaces/context-stack.interface';

@Injectable()
export class OutreachService {
  constructor(
    private readonly commercialService: CommercialService,
    private readonly connectorsService: ConnectorsService,
    private readonly contextOrchestrator: ContextOrchestratorService,
    private readonly aiService: AiService,
  ) {}

  async generateHierarchicalDraft(userId: string, actionItemId: string) {
    const allowance = await this.commercialService.incrementUsage(userId, 'email_drafts');
    if (!allowance.allowed) {
      return { success: false, blocked: true, ...allowance };
    }

    const context = await this.contextOrchestrator.buildStack(userId, actionItemId);
    
    const actionItem = await (prisma.actionItem.findFirst({
      where: { id: actionItemId, userId },
      include: { targetPerson: true, targetCompany: true }
    }) as any);

    if (!actionItem) throw new NotFoundException('ActionItem not found');

    const leadName = actionItem.targetPerson?.firstName || actionItem.targetPerson?.fullName || 'there';
    const companyName = actionItem.targetCompany?.name || 'your company';

    const prompt = this.buildPrompt(context, leadName, companyName);
    const result = await this.aiService.generateText('', {
      messages: [
        { role: 'system', content: this.getSystemPrompt(context) },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    const subjectMatch = result.match(/Subject:\s*(.*)/i);
    const bodyMatch = result.split(/Body:\s*/i);
    
    const subject = subjectMatch ? subjectMatch[1] : `Re: ${context.action.title}`;
    const body = bodyMatch.length > 1 ? bodyMatch[1].trim() : result.trim();

    // Persist the draft to the action item
    await prisma.actionItem.update({
      where: { id: actionItemId },
      data: {
        draftContent: body,
        draftSubject: subject
      }
    });

    return {
      id: actionItemId,
      subject,
      body,
      strategyName: context.persona?.name,
      usage: {
        featureKey: allowance.featureKey,
        used: allowance.used,
        remaining: allowance.remaining,
      },
    };
  }

  private getSystemPrompt(context: ContextStack): string {
    return [
      `You are a strategic outreach specialist acting in the persona of: ${context.persona?.name || 'Professional Consultant'}.`,
      `Your tone and logic must follow these instructions: ${context.persona?.instructions || 'Be professional and concise.'}`,
      `Your goal is: ${context.campaign?.strategicAngle || 'Generate interest in the offering'}.`,
      'ALWAYS return the output in this format:',
      'Subject: [Subject Line]',
      'Body: [Email/Message Body]'
    ].join('\n');
  }

  private buildPrompt(context: ContextStack, leadName: string, companyName: string): string {
    return [
      '### CONTEXT STACK ###',
      `1. FOUNDATION (Offering): ${context.offering?.title}. Value Prop: ${context.offering?.valueProposition}`,
      `2. STRATEGY (Campaign): ${context.campaign?.name}. Angle: ${context.campaign?.strategicAngle}`,
      `3. TACTICS (Action Lane): Channel: ${context.actionLane?.type}. Name: ${context.actionLane?.name}`,
      `4. TRIGGER (Signal): ${context.action.title}. Details: ${context.action.description}`,
      '',
      '### RECIPIENT ###',
      `Name: ${leadName}`,
      `Company: ${companyName}`,
      '',
      'Write the outreach message now.'
    ].join('\n');
  }

  async generateDraft(userId: string, opportunityId: string) {
    const allowance = await this.commercialService.incrementUsage(userId, 'email_drafts');
    if (!allowance.allowed) {
      return {
        success: false,
        blocked: true,
        ...allowance,
      };
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      include: {
        company: true,
        primaryPerson: true,
        campaign: { include: { offering: true, goal: true } },
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const contactName = opportunity.primaryPerson?.firstName || opportunity.primaryPerson?.fullName || 'there';
    const companyName = opportunity.company.name;
    const opportunitySummary = opportunity.summary?.trim() || 'a relevant opportunity to connect';
    const suggestedAction = opportunity.nextAction?.trim();
    const offeringTitle = opportunity.campaign?.offering?.title;
    const campaignAngle = opportunity.campaign?.strategicAngle;
    const subject = offeringTitle
      ? `${offeringTitle} for ${companyName}`
      : `Idea for ${companyName}: ${opportunity.title}`;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });
    const userName = user?.fullName?.split(' ')[0] || 'Jeff';

    const body = [
      `Hi ${contactName},`,
      '',
      `I wanted to reach out because ${opportunitySummary.toLowerCase()}.`,
      offeringTitle
        ? `I thought ${offeringTitle} could be relevant for ${companyName}${campaignAngle ? `, especially around ${campaignAngle.toLowerCase()}` : ''}.`
        : `It struck me as a strong fit for ${companyName} given the momentum around ${opportunity.title.toLowerCase()}.`,
      suggestedAction ? `A practical next step could be: ${suggestedAction}.` : 'A short conversation might be the fastest way to see if there is a fit.',
      '',
      'If helpful, I can send over a concise point of view and a few concrete ideas to start from.',
      '',
      'Best,',
      userName,
    ].join('\n');

    const recipients = [
      {
        id: opportunity.primaryPerson?.id || opportunity.company.id,
        name: opportunity.primaryPerson?.fullName || `Team at ${companyName}`,
        organization: companyName,
        email: opportunity.primaryPerson?.email || null,
        role: opportunity.primaryPerson?.title || 'Contact',
      },
    ];

    return {
      id: opportunity.id,
      opportunityId: opportunity.id,
      subject,
      body,
      recipients,
      approvalRequired: true,
      usage: {
        featureKey: allowance.featureKey,
        used: allowance.used,
        remaining: allowance.remaining,
      },
    };
  }

  async generateFollowUpDraft(userId: string, opportunityId: string) {
    const allowance = await this.commercialService.incrementUsage(userId, 'email_drafts');
    if (!allowance.allowed) {
      return {
        success: false,
        blocked: true,
        ...allowance,
      };
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      include: {
        company: true,
        primaryPerson: true,
        activities: { where: { activityType: ActivityType.email }, orderBy: { occurredAt: 'desc' }, take: 1 },
        campaign: { include: { offering: true } },
      },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const contactName = opportunity.primaryPerson?.firstName || opportunity.primaryPerson?.fullName || 'there';
    const companyName = opportunity.company.name;
    const offeringTitle = opportunity.campaign?.offering?.title ?? opportunity.title;
    const previousSubject = opportunity.activities[0]?.subject;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    const userName = user?.fullName?.split(' ')[0] || 'Jeff';

    return {
      id: `${opportunity.id}:follow_up`,
      opportunityId: opportunity.id,
      subject: previousSubject ? `Re: ${previousSubject.replace(/^Re:\s*/i, '')}` : `Following up on ${offeringTitle}`,
      body: [
        `Hi ${contactName},`,
        '',
        `I wanted to briefly follow up on my note about ${offeringTitle}.`,
        `If this is relevant for ${companyName}, I can send a concise summary or a few concrete ideas to make the conversation useful.`,
        '',
        'Would a short conversation next week be worth exploring?',
        '',
        'Best,',
        userName,
      ].join('\n'),
      recipients: [
        {
          id: opportunity.primaryPerson?.id || opportunity.company.id,
          name: opportunity.primaryPerson?.fullName || `Team at ${companyName}`,
          organization: companyName,
          email: opportunity.primaryPerson?.email || null,
          role: opportunity.primaryPerson?.title || 'Contact',
        },
      ],
      approvalRequired: true,
      draftType: 'follow_up',
      usage: {
        featureKey: allowance.featureKey,
        used: allowance.used,
        remaining: allowance.remaining,
      },
    };
  }

  async sendDraft(
    userId: string,
    draft: SendOutreachDto,
    options: { stubbed?: boolean } = {},
  ) {
    const allowance = options.stubbed
      ? null
      : await this.commercialService.checkCapability(userId, { featureKey: 'email_send', connectorCapability: 'email' });
    if (allowance && !allowance.allowed) {
      return {
        success: false,
        blocked: true,
        ...allowance,
      };
    }

    const linkedRefs = await this.resolveLinkedRefs(userId, draft);
    const occurredAt = new Date();
    const recipientEmails = draft.recipients?.map((recipient) => recipient.email).filter((email): email is string => Boolean(email)) ?? [];
    if (!options.stubbed && recipientEmails.length === 0) {
      throw new BadRequestException('At least one recipient email is required for real send.');
    }

    const providerResult = options.stubbed
      ? null
      : await this.connectorsService.sendEmail(userId, {
          to: recipientEmails,
          subject: draft.subject,
          body: draft.body,
          opportunityId: linkedRefs.opportunityId,
          companyId: linkedRefs.companyId,
          personId: linkedRefs.personId,
        });

    const usage = options.stubbed ? null : await this.commercialService.incrementUsage(userId, 'email_send');

    const activity = await prisma.activity.create({
      data: {
        userId,
        opportunityId: linkedRefs.opportunityId,
        companyId: linkedRefs.companyId,
        personId: linkedRefs.personId,
        activityType: ActivityType.email,
        subject: draft.subject,
        bodySummary: draft.body.slice(0, 500),
        occurredAt,
        metadataJson: this.toJson({
          recipients: draft.recipients,
          direction: 'outbound',
          sentVia: options.stubbed ? 'stubbed_email' : providerResult?.connector.capabilityProvider.providerName,
          providerMessageId: providerResult?.result.providerMessageId,
          providerThreadId: providerResult?.result.providerThreadId,
          source: 'outreach_send',
          stubbed: options.stubbed === true,
        }),
      },
    });

    if (linkedRefs.opportunityId) {
      await prisma.opportunity.updateMany({
        where: { id: linkedRefs.opportunityId, userId },
        data: {
          stage: draft.id?.includes('follow_up') ? undefined : 'outreach_sent',
          nextAction: draft.id?.includes('follow_up') ? 'Watch for reply and continue conversation.' : 'Follow up if there is no reply.',
          nextActionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return {
      success: true,
      activity,
      stubbed: options.stubbed === true,
      sentAt: occurredAt.toISOString(),
      provider: providerResult
        ? {
            connectorId: providerResult.connector.id,
            providerName: providerResult.connector.capabilityProvider.providerName,
            providerMessageId: providerResult.result.providerMessageId,
            providerThreadId: providerResult.result.providerThreadId,
          }
        : null,
      usage: usage
        ? {
            featureKey: usage.featureKey,
            used: usage.used,
            remaining: usage.remaining,
          }
        : null,
    };
  }

  private async resolveLinkedRefs(userId: string, draft: SendOutreachDto) {
    let opportunity:
      | {
          id: string;
          companyId: string;
          primaryPersonId: string | null;
        }
      | null = null;

    if (draft.opportunityId) {
      opportunity = await prisma.opportunity.findFirst({
        where: { id: draft.opportunityId, userId },
        select: { id: true, companyId: true, primaryPersonId: true },
      });
      if (!opportunity) {
        throw new NotFoundException('Opportunity not found');
      }
    }

    const companyId = draft.companyId ?? opportunity?.companyId;
    const personId = draft.personId ?? opportunity?.primaryPersonId ?? undefined;

    const [company, person] = await Promise.all([
      companyId
        ? prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true } })
        : null,
      personId
        ? prisma.person.findFirst({ where: { id: personId, userId }, select: { id: true, companyId: true } })
        : null,
    ]);

    if (companyId && !company) {
      throw new NotFoundException('Company not found');
    }
    if (personId && !person) {
      throw new NotFoundException('Person not found');
    }
    if (person?.companyId && companyId && person.companyId !== companyId) {
      throw new NotFoundException('Person not found for company');
    }

    return {
      opportunityId: opportunity?.id ?? draft.opportunityId,
      companyId,
      personId,
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
