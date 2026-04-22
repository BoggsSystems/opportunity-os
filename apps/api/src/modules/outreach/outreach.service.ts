import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma, prisma } from '@opportunity-os/db';
import { CommercialService } from '../commercial/commercial.service';
import { SendOutreachDto } from './dto/send-outreach.dto';

@Injectable()
export class OutreachService {
  constructor(private readonly commercialService: CommercialService) {}

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
      where: {
        id: opportunityId,
        userId,
      },
      include: {
        company: true,
        primaryPerson: true,
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const contactName = opportunity.primaryPerson?.firstName || opportunity.primaryPerson?.fullName || 'there';
    const companyName = opportunity.company.name;
    const opportunitySummary = opportunity.summary?.trim() || 'a relevant opportunity to connect';
    const suggestedAction = opportunity.nextAction?.trim();
    const subject = `Idea for ${companyName}: ${opportunity.title}`;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });
    const userName = user?.fullName?.split(' ')[0] || 'Jeff';

    const body = [
      `Hi ${contactName},`,
      '',
      `I wanted to reach out because ${opportunitySummary.toLowerCase()}.`,
      `It struck me as a strong fit for ${companyName} given the momentum around ${opportunity.title.toLowerCase()}.`,
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

  async sendDraft(
    userId: string,
    draft: SendOutreachDto,
  ) {
    const allowance = await this.commercialService.incrementUsage(userId, 'email_send');
    if (!allowance.allowed) {
      return {
        success: false,
        blocked: true,
        ...allowance,
      };
    }

    const linkedRefs = await this.resolveLinkedRefs(userId, draft);

    const activity = await prisma.activity.create({
      data: {
        userId,
        opportunityId: linkedRefs.opportunityId,
        companyId: linkedRefs.companyId,
        personId: linkedRefs.personId,
        activityType: ActivityType.email,
        subject: draft.subject,
        bodySummary: draft.body.slice(0, 500),
        occurredAt: new Date(),
        metadataJson: this.toJson({
          recipients: draft.recipients,
          sentVia: 'ios_local_dev',
          source: 'outreach_send',
        }),
      },
    });

    return {
      success: true,
      activity,
      sentAt: new Date().toISOString(),
      usage: {
        featureKey: allowance.featureKey,
        used: allowance.used,
        remaining: allowance.remaining,
      },
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
