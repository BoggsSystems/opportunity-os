import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, prisma } from '@opportunity-os/db';

@Injectable()
export class OutreachService {
  async generateDraft(userId: string, opportunityId: string) {
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
      select: { firstName: true }
    });
    const userName = user?.firstName || 'Jeff';

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
      subject,
      body,
      recipients,
      approvalRequired: true,
    };
  }

  async sendDraft(
    userId: string,
    draft: {
      subject: string;
      body: string;
      recipients: Array<{ name: string; organization: string; email?: string | null; role: string }>;
    },
  ) {
    await prisma.activity.create({
      data: {
        userId,
        activityType: ActivityType.email,
        subject: draft.subject,
        bodySummary: draft.body.slice(0, 500),
        occurredAt: new Date(),
        metadataJson: {
          recipients: draft.recipients,
          sentVia: 'ios_local_dev',
        },
      },
    });

    return {
      success: true,
      sentAt: new Date().toISOString(),
    };
  }
}
