import { Injectable } from "@nestjs/common";
import {
  AdminOperationalIssueSeverity,
  AdminOperationalIssueSource,
  AdminOperationalIssueStatus,
  Prisma,
  prisma,
} from "@opportunity-os/db";

@Injectable()
export class AdminOperationsService {
  async createIssue(input: {
    userId?: string;
    source: AdminOperationalIssueSource;
    sourceId?: string;
    providerName?: string;
    severity?: AdminOperationalIssueSeverity;
    title: string;
    details?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.adminOperationalIssue.create({
      data: {
        userId: input.userId,
        source: input.source,
        sourceId: input.sourceId,
        providerName: input.providerName,
        severity: input.severity || AdminOperationalIssueSeverity.warning,
        title: input.title,
        details: input.details,
        metadataJson: this.json(input.metadata),
      },
    });
  }

  async listIssues(input: {
    status?: AdminOperationalIssueStatus;
    severity?: AdminOperationalIssueSeverity;
    source?: AdminOperationalIssueSource;
    limit?: number;
  }) {
    return prisma.adminOperationalIssue.findMany({
      where: {
        status: input.status,
        severity: input.severity,
        source: input.source,
      },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: Math.min(input.limit || 50, 200),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async updateIssue(
    id: string,
    input: {
      status?: AdminOperationalIssueStatus;
      severity?: AdminOperationalIssueSeverity;
      details?: string;
    },
  ) {
    const now = new Date();
    return prisma.adminOperationalIssue.update({
      where: { id },
      data: {
        status: input.status,
        severity: input.severity,
        details: input.details,
        acknowledgedAt:
          input.status === AdminOperationalIssueStatus.investigating ? now : undefined,
        resolvedAt:
          input.status === AdminOperationalIssueStatus.resolved ||
          input.status === AdminOperationalIssueStatus.ignored
            ? now
            : undefined,
      },
    });
  }

  private json(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    return value ? JSON.parse(JSON.stringify(value)) : undefined;
  }
}
