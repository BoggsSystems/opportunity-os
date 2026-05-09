import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActionItemConfirmationSource,
  ActionItemStatus,
  CampaignStatus,
  ActionLaneStatus,
  ActionLaneType,
  ActionCycleStatus,
  ActivityType,
  ConversationInsightSentiment,
  ConversationMessageDirection,
  ConversationMessageSource,
  ConversationThreadStatus,
  ReferralMilestoneType,
  UserLifecycleStage,
  OfferingStatus,
  OfferingType,
  prisma,
} from "@opportunity-os/db";
import {
  CaptureConversationMessageDto,
  ConfirmActionItemDto,
  ConversationFeedbackIntakeDto,
  CreateConversationThreadDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateActionLaneDto,
  UpdateActionLaneDto,
  CreateActionCycleDto,
  UpdateActionCycleDto,
  CreateActionItemDto,
  FinalizeOnboardingPlanDto,
  SynthesizeConversationThreadDto,
  UpdateActionItemDto,
} from "./dto/campaign.dto";
import { AiService } from "../ai/ai.service";
import { AdminLifecycleService } from "../admin/admin-lifecycle.service";
import { CommercialService } from "../commercial/commercial.service";

@Injectable()
export class CampaignOrchestrationService {
  constructor(
    private readonly aiService: AiService,
    private readonly commercialService: CommercialService,
    private readonly adminLifecycleService: AdminLifecycleService,
  ) {}

  async finalizeOnboardingPlan(
    userId: string,
    data: FinalizeOnboardingPlanDto,
  ) {
    const selectedCampaigns = data.campaigns.filter((campaign) =>
      data.selectedCampaignIds.includes(campaign.id),
    );
    const selectedLanes = data.actionLanes.filter((lane) =>
      data.selectedActionLaneIds.includes(lane.id),
    );

    if (!selectedCampaigns.length) {
      throw new BadRequestException(
        "At least one selected campaign is required",
      );
    }

    if (!selectedLanes.length) {
      throw new BadRequestException(
        "At least one selected action lane is required",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const offeringIdMap = new Map<string, string>();
      const campaignIdMap = new Map<string, string>();
      const laneIdMap = new Map<string, string>();
      const persistedOfferings: any[] = [];
      const persistedCampaigns: any[] = [];
      const persistedActionLanes: any[] = [];

      // 0. Clean up existing onboarding data to avoid duplicates if re-running
      await tx.campaign.deleteMany({ where: { userId } });
      await tx.offering.deleteMany({ where: { userId } });
      // Note: Cascade deletes should handle related records if configured in Prisma, 
      // otherwise we might need to delete them explicitly.

      // 1. Persist selected offerings
      const selectedOfferings = (data.offerings || []).filter(o => 
        data.selectedOfferingIds.includes(o.id)
      );

      for (const offering of selectedOfferings) {
        const persistedOffering = await tx.offering.create({
          data: {
            userId,
            title: offering.title,
            description: offering.description,
            offeringType: (offering.type as OfferingType) || OfferingType.service,
            status: OfferingStatus.active,
            metadataJson: {
              onboardingOfferingId: offering.id,
              evidence: offering.evidence
            }
          }
        });
        offeringIdMap.set(offering.id, persistedOffering.id);
        persistedOfferings.push(persistedOffering);
      }

      // 2. Persist campaigns and link to offerings
      for (const campaign of selectedCampaigns) {
        // Find the actual DB ID for the linked offering
        console.log(`[DEBUG] Mapping campaign "${campaign.title}" with offeringId: "${campaign.offeringId}"`);
        console.log(`[DEBUG] Current offeringIdMap keys: ${Array.from(offeringIdMap.keys()).join(', ')}`);
        
        const offeringId = campaign.offeringId ? offeringIdMap.get(campaign.offeringId) : null;
        console.log(`[DEBUG] Resulting offeringId (DB UUID): ${offeringId}`);

        const persistedCampaign = await tx.campaign.create({
          data: {
            userId,
            offeringId,
            title: campaign.title,
            description: campaign.description,
            objective: campaign.goalMetric || campaign.description,
            successDefinition: campaign.goalMetric,
            strategicAngle: campaign.messagingHook || campaign.laneTitle,
            targetSegment: campaign.targetSegment,
            priorityScore: 70,
            status: CampaignStatus.PLANNING,
            metadataJson: {
              onboardingCampaignId: campaign.id,
              laneTitle: campaign.laneTitle,
              duration: campaign.duration,
              channels: campaign.channels,
              comprehensiveSynthesis: data.comprehensiveSynthesis,
            },
          },
        });
        campaignIdMap.set(campaign.id, persistedCampaign.id);
        persistedCampaigns.push(persistedCampaign);

        // Create CampaignChannels for this campaign
        if (campaign.channels?.length) {
          for (const channelCode of campaign.channels) {
            await tx.campaignChannel.create({
              data: {
                campaignId: persistedCampaign.id,
                channelCode,
                recommendedByAi: true,
                status: 'active',
              },
            });
          }
        }
      }

      for (const lane of selectedLanes) {
        const campaignIds = this.onboardingLaneCampaignIds(
          lane,
          selectedCampaigns,
        );
        for (const onboardingCampaignId of campaignIds) {
          const campaignId = campaignIdMap.get(onboardingCampaignId);
          if (!campaignId) continue;

          // Find relevant CampaignChannel if possible
          const laneType = this.inferActionLaneType(lane);
          const campaignChannels = await tx.campaignChannel.findMany({
            where: { campaignId },
          });
          
          // Map lane type to channel code for linking
          const channelCode = this.mapLaneTypeToChannelCode(laneType);
          const campaignChannel = campaignChannels.find(cc => cc.channelCode === channelCode) || campaignChannels[0];

          const persistedLane = await tx.actionLane.create({
            data: {
              campaignId,
              campaignChannelId: campaignChannel?.id,
              laneType,
              title: lane.title,
              description: lane.description,
              strategy: lane.tactics?.join("\n") || lane.description,
              targetCriteriaJson: {
                campaignIds: lane.campaignIds,
                requiredConnectors: lane.requiredConnectors,
              },
              cadenceJson: {
                tactics: lane.tactics || [],
              },
              priorityScore: this.onboardingSelectionPriority(data, lane.id),
              status: ActionLaneStatus.ACTIVE,
              metadataJson: {
                onboardingLaneId: lane.id,
                source: "onboarding",
              },
            },
          });
          laneIdMap.set(`${onboardingCampaignId}:${lane.id}`, persistedLane.id);
          persistedActionLanes.push(persistedLane);
        }
      }

      const selectedCampaignId =
        data.activationSelection?.campaignId || selectedCampaigns[0]?.id;
      const selectedLaneId =
        data.activationSelection?.laneId || selectedLanes[0]?.id;
      const persistedCampaignId = selectedCampaignId
        ? campaignIdMap.get(selectedCampaignId)
        : undefined;
      const persistedLaneId =
        selectedCampaignId && selectedLaneId
          ? laneIdMap.get(`${selectedCampaignId}:${selectedLaneId}`)
          : undefined;

      let actionCycle: any = null;
      let actionItem: any = null;

      if (persistedCampaignId && persistedLaneId) {
        const campaign = selectedCampaigns.find(
          (candidate) => candidate.id === selectedCampaignId,
        );
        const lane = selectedLanes.find(
          (candidate) => candidate.id === selectedLaneId,
        );
        const laneType = lane
          ? this.inferActionLaneType(lane)
          : ActionLaneType.other;
        const firstAction = this.firstActionForLane(laneType);

        actionCycle = await tx.actionCycle.create({
          data: {
            campaignId: persistedCampaignId,
            actionLaneId: persistedLaneId,
            cycleNumber: 1,
            title: `First action cycle: ${lane?.title || "Selected action lane"}`,
            objective: `Stage and approve the first ${lane?.title || "action"} for ${campaign?.title || "the selected campaign"}.`,
            actionType: firstAction.actionType,
            status: ActionCycleStatus.surfaced,
            priorityScore: 90,
            surfacedAt: new Date(),
            executionDataJson: {
              source: "onboarding",
              campaign: campaign ? JSON.parse(JSON.stringify(campaign)) : null,
              lane: lane ? JSON.parse(JSON.stringify(lane)) : null,
              nextSteps: firstAction.steps,
            },
            generatedReasoningJson: {
              rationale: `This lane was selected during onboarding as the first action cycle for ${campaign?.title || "the campaign"}.`,
              approvalRequired: true,
            },
          },
        });

        actionItem = await tx.actionItem.create({
          data: {
            userId,
            campaignId: persistedCampaignId,
            actionLaneId: persistedLaneId,
            actionCycleId: actionCycle.id,
            targetType: firstAction.targetType,
            actionType: firstAction.actionType,
            title: firstAction.title,
            instructions: firstAction.instructions,
            status: ActionItemStatus.suggested,
            confirmationRequired: true,
            priorityScore: 90,
            externalProvider: firstAction.externalProvider,
            metadataJson: {
              source: "onboarding",
              onboardingCampaignId: selectedCampaignId,
              onboardingLaneId: selectedLaneId,
              nextSteps: firstAction.steps,
            },
          },
        });
      }

      return {
        campaigns: persistedCampaigns,
        actionLanes: persistedActionLanes,
        firstActionCycle: actionCycle,
        firstActionItem: actionItem,
      };
    });

    await this.commercialService.recordReferralMilestone(
      userId,
      ReferralMilestoneType.onboarding_completed,
      {
        entityType: result.firstActionCycle
          ? "action_cycle"
          : "onboarding_plan",
        entityId: result.firstActionCycle?.id,
      },
    );

    const lifecycleEvents = [
      this.adminLifecycleService.recordEvent({
        userId,
        stage: UserLifecycleStage.profile_grounded,
        eventType: "onboarding_completed",
        sourceType: "onboarding_plan",
        sourceId: result.firstActionCycle?.id,
        metadata: {
          campaigns: result.campaigns.length,
          actionLanes: result.actionLanes.length,
        },
      }),
      this.adminLifecycleService.recordEvent({
        userId,
        stage: UserLifecycleStage.campaign_generated,
        eventType: "campaigns_generated",
        sourceType: "onboarding_plan",
        sourceId: result.firstActionCycle?.id,
        metadata: {
          campaigns: result.campaigns.length,
        },
      }),
      this.adminLifecycleService.recordEvent({
        userId,
        stage: UserLifecycleStage.action_lanes_selected,
        eventType: "action_lanes_selected",
        sourceType: "onboarding_plan",
        sourceId: result.firstActionCycle?.id,
        metadata: {
          actionLanes: result.actionLanes.length,
        },
      }),
    ];

    if (result.firstActionItem) {
      lifecycleEvents.push(
        this.adminLifecycleService.recordEvent({
          userId,
          stage: UserLifecycleStage.first_action_primed,
          eventType: "first_action_primed",
          sourceType: "action_item",
          sourceId: result.firstActionItem.id,
          metadata: {
            actionType: result.firstActionItem.actionType,
          },
        }),
      );
    }

    await Promise.all(lifecycleEvents);

    return result;
  }

  // CAMPAIGN OPERATIONS
  async createCampaign(userId: string, data: CreateCampaignDto) {
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        objective: data.objective,
        successDefinition: data.successDefinition,
        strategicAngle: data.strategicAngle,
        targetSegment: data.targetSegment,
        timeframeStart: data.timeframeStart,
        timeframeEnd: data.timeframeEnd,
        offeringId: data.offeringId,
        goalId: data.goalId,
        priorityScore: data.priorityScore || 50,
        status: CampaignStatus.PLANNING,
      },
      include: {
        offering: true,
        goal: true,
        actionLanes: true,
      },
    });

    await this.adminLifecycleService.recordEvent({
      userId,
      stage: UserLifecycleStage.campaign_generated,
      eventType: "campaign_generated",
      sourceType: "campaign",
      sourceId: campaign.id,
      metadata: {
        title: campaign.title,
      },
    });

    return campaign;
  }

  async getCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        offering: true,
        goal: true,
        actionLanes: {
          include: {
            actionCycles: {
              include: {
                actionItems: {
                  orderBy: { priorityScore: "desc" },
                  take: 10,
                },
              },
              orderBy: [{ cycleNumber: "desc" }, { priorityScore: "desc" }],
              take: 10,
            },
            actionItems: {
              where: {
                status: {
                  in: [
                    ActionItemStatus.suggested,
                    ActionItemStatus.ready,
                    ActionItemStatus.in_progress,
                  ],
                },
              },
              orderBy: { priorityScore: "desc" },
              take: 10,
            },
          },
          orderBy: { priorityScore: "desc" },
        },
        campaignMetrics: {
          orderBy: { computedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  async listCampaigns(userId: string, status?: CampaignStatus) {
    return prisma.campaign.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: {
        offering: { select: { id: true, title: true, offeringType: true } },
        goal: { select: { id: true, title: true } },
        _count: {
          select: {
            actionLanes: true,
            actionCycles: true,
            actionItems: true,
          },
        },
      },
      orderBy: { priorityScore: "desc" },
    });
  }

  async updateCampaign(
    userId: string,
    campaignId: string,
    data: UpdateCampaignDto,
  ) {
    await this.findCampaign(userId, campaignId);

    return prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        offering: true,
        goal: true,
        actionLanes: true,
      },
    });
  }

  async deleteCampaign(userId: string, campaignId: string) {
    await this.findCampaign(userId, campaignId);

    return prisma.campaign.delete({
      where: { id: campaignId },
    });
  }

  // ACTION LANE OPERATIONS
  async createActionLane(userId: string, data: CreateActionLaneDto) {
    // Verify campaign ownership
    await this.findCampaign(userId, data.campaignId);

    return prisma.actionLane.create({
      data: {
        campaignId: data.campaignId,
        laneType: data.laneType,
        title: data.title,
        description: data.description,
        strategy: data.strategy,
        cadenceJson: data.cadenceJson,
        targetCriteriaJson: data.targetCriteriaJson,
        priorityScore: data.priorityScore || 50,
        status: ActionLaneStatus.ACTIVE,
      },
      include: {
        campaign: true,
      },
    });
  }

  async getActionLane(userId: string, actionLaneId: string) {
    const actionLane = await prisma.actionLane.findFirst({
      where: { id: actionLaneId },
      include: {
        campaign: { select: { id: true, userId: true, title: true } },
        actionCycles: {
          include: {
            actionItems: {
              orderBy: { priorityScore: "desc" },
              take: 10,
            },
          },
          orderBy: [{ cycleNumber: "desc" }, { priorityScore: "desc" }],
        },
        actionItems: {
          where: {
            status: {
              in: [
                ActionItemStatus.suggested,
                ActionItemStatus.ready,
                ActionItemStatus.in_progress,
              ],
            },
          },
          orderBy: { priorityScore: "desc" },
          take: 20,
        },
        campaignMetrics: {
          orderBy: { computedAt: "desc" },
          take: 10,
        },
      },
    });

    if (!actionLane || actionLane.campaign.userId !== userId) {
      throw new NotFoundException("Action lane not found");
    }

    return actionLane;
  }

  async listActionLanes(
    userId: string,
    campaignId?: string,
    status?: ActionLaneStatus,
  ) {
    const where: any = {};

    if (campaignId) {
      where.campaignId = campaignId;
      // Verify campaign ownership
      await this.findCampaign(userId, campaignId);
    } else {
      where.campaign = { is: { userId } };
    }

    if (status) {
      where.status = status;
    }

    return prisma.actionLane.findMany({
      where,
      include: {
        campaign: { select: { id: true, title: true, status: true } },
        _count: {
          select: {
            actionCycles: true,
            actionItems: true,
          },
        },
      },
      orderBy: { priorityScore: "desc" },
    });
  }

  async updateActionLane(
    userId: string,
    actionLaneId: string,
    data: UpdateActionLaneDto,
  ) {
    await this.getActionLane(userId, actionLaneId);

    return prisma.actionLane.update({
      where: { id: actionLaneId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        campaign: true,
      },
    });
  }

  async deleteActionLane(userId: string, actionLaneId: string) {
    await this.getActionLane(userId, actionLaneId);

    return prisma.actionLane.delete({
      where: { id: actionLaneId },
    });
  }

  // ACTION CYCLE OPERATIONS
  async createActionCycle(userId: string, data: CreateActionCycleDto) {
    const actionLane = await this.verifyActionLaneOwnership(
      userId,
      data.actionLaneId,
    );

    return prisma.actionCycle.create({
      data: {
        campaignId: actionLane.campaignId,
        actionLaneId: data.actionLaneId,
        cycleNumber: data.cycleNumber,
        title: data.title,
        objective: data.objective,
        targetType: data.targetType,
        targetId: data.targetId,
        actionType: data.actionType,
        priorityScore: data.priorityScore || 50,
        status: data.status || ActionCycleStatus.planned,
        surfacedAt:
          data.status === ActionCycleStatus.surfaced ? new Date() : undefined,
        executionDataJson: data.executionDataJson,
        generatedReasoningJson: data.generatedReasoningJson,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      },
      include: {
        campaign: true,
        actionLane: true,
        actionItems: true,
      },
    });
  }

  async getActionCycle(userId: string, actionCycleId: string) {
    const actionCycle = await prisma.actionCycle.findFirst({
      where: { id: actionCycleId },
      include: {
        campaign: { select: { id: true, userId: true, title: true } },
        actionLane: true,
        actionItems: {
          include: {
            targetPerson: true,
            targetCompany: true,
          },
          orderBy: { priorityScore: "desc" },
        },
      },
    });

    if (!actionCycle || actionCycle.campaign.userId !== userId) {
      throw new NotFoundException("Action cycle not found");
    }

    return actionCycle;
  }

  async listActionCycles(
    userId: string,
    campaignId?: string,
    actionLaneId?: string,
    status?: ActionCycleStatus,
  ) {
    const where: any = {};

    if (campaignId) {
      where.campaignId = campaignId;
      // Verify campaign ownership
      await this.findCampaign(userId, campaignId);
    } else if (actionLaneId) {
      where.actionLaneId = actionLaneId;
      // Verify lane ownership
      const actionLane = await this.verifyActionLaneOwnership(
        userId,
        actionLaneId,
      );
      where.campaignId = actionLane.campaignId;
    } else {
      where.campaign = { is: { userId } };
    }

    if (status) {
      where.status = status;
    }

    return prisma.actionCycle.findMany({
      where,
      include: {
        campaign: { select: { id: true, title: true } },
        actionLane: { select: { id: true, title: true, laneType: true } },
        _count: {
          select: {
            actionItems: true,
          },
        },
      },
      orderBy: [{ cycleNumber: "desc" }, { priorityScore: "desc" }],
    });
  }

  async updateActionCycle(
    userId: string,
    actionCycleId: string,
    data: UpdateActionCycleDto,
  ) {
    await this.getActionCycle(userId, actionCycleId);

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Add timestamps based on status changes
    if (data.status) {
      switch (data.status) {
        case ActionCycleStatus.pursuing:
        case ActionCycleStatus.active:
          updateData.pursuingAt = new Date();
          break;
        case ActionCycleStatus.executed:
          updateData.executedAt = new Date();
          break;
        case ActionCycleStatus.confirmed:
        case ActionCycleStatus.completed:
          updateData.confirmedAt = new Date();
          break;
      }
    }

    return prisma.actionCycle.update({
      where: { id: actionCycleId },
      data: updateData,
      include: {
        campaign: true,
        actionLane: true,
        actionItems: true,
      },
    });
  }

  async deleteActionCycle(userId: string, actionCycleId: string) {
    await this.getActionCycle(userId, actionCycleId);

    return prisma.actionCycle.delete({
      where: { id: actionCycleId },
    });
  }

  // ACTION ITEM OPERATIONS
  async createActionItem(userId: string, data: CreateActionItemDto) {
    const actionLane = await this.verifyActionLaneOwnership(
      userId,
      data.actionLaneId,
    );

    if (data.actionCycleId) {
      await this.verifyActionCycleBelongsToLane(
        userId,
        data.actionCycleId,
        actionLane.id,
      );
    }

    await this.verifyOptionalTargets(
      userId,
      data.targetPersonId,
      data.targetCompanyId,
    );

    return prisma.actionItem.create({
      data: {
        userId,
        campaignId: actionLane.campaignId,
        actionLaneId: actionLane.id,
        actionCycleId: data.actionCycleId,
        targetType: data.targetType,
        targetId: data.targetId,
        targetPersonId: data.targetPersonId,
        targetCompanyId: data.targetCompanyId,
        actionType: data.actionType,
        title: data.title,
        instructions: data.instructions,
        draftContent: data.draftContent,
        finalContent: data.finalContent,
        externalUrl: data.externalUrl,
        externalProvider: data.externalProvider,
        status: data.status || ActionItemStatus.suggested,
        confirmationRequired: data.confirmationRequired ?? true,
        priorityScore: data.priorityScore || 50,
        dueAt: data.dueAt,
        metadataJson: data.metadataJson,
        preparedAt:
          data.status === ActionItemStatus.ready ? new Date() : undefined,
      },
      include: this.actionItemInclude(),
    });
  }

  async getActionItem(userId: string, actionItemId: string) {
    const actionItem = await prisma.actionItem.findFirst({
      where: { id: actionItemId, userId },
      include: this.actionItemInclude(),
    });

    if (!actionItem) {
      throw new NotFoundException("Action item not found");
    }

    return actionItem;
  }

  async getActionItemCanvas(userId: string, actionItemId: string) {
    const actionItem = await this.getActionItem(userId, actionItemId);
    const thread = await prisma.conversationThread.findFirst({
      where: { userId, actionItemId },
      include: this.conversationThreadInclude(),
      orderBy: { updatedAt: "desc" },
    });
    const panelType = this.actionCanvasPanelType(
      actionItem.actionType,
      actionItem.actionLane.laneType,
    );

    return {
      panelType,
      actionItem,
      campaign: actionItem.campaign,
      actionLane: actionItem.actionLane,
      actionCycle: actionItem.actionCycle,
      thread,
      latestInsight: thread?.insights?.[0] || null,
      context: {
        objective: actionItem.actionCycle?.title || actionItem.title,
        primaryInstruction: actionItem.instructions,
        targetLabel:
          actionItem.targetPerson?.fullName ||
          actionItem.targetCompany?.name ||
          actionItem.targetType ||
          "Campaign audience",
        externalProvider: actionItem.externalProvider,
        externalUrl: actionItem.externalUrl,
        draftContent: actionItem.draftContent,
        finalContent: actionItem.finalContent,
      },
      availableCommands: this.actionCanvasCommands(
        panelType,
        actionItem.status,
      ),
    };
  }

  async listActionItems(
    userId: string,
    filters: {
      campaignId?: string;
      actionLaneId?: string;
      actionCycleId?: string;
      status?: ActionItemStatus;
    },
  ) {
    const where: any = { userId };

    if (filters.campaignId) {
      await this.findCampaign(userId, filters.campaignId);
      where.campaignId = filters.campaignId;
    }

    if (filters.actionLaneId) {
      const actionLane = await this.verifyActionLaneOwnership(
        userId,
        filters.actionLaneId,
      );
      where.actionLaneId = actionLane.id;
    }

    if (filters.actionCycleId) {
      const actionCycle = await this.getActionCycle(
        userId,
        filters.actionCycleId,
      );
      where.actionCycleId = actionCycle.id;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return prisma.actionItem.findMany({
      where,
      include: this.actionItemInclude(),
      orderBy: [
        { dueAt: "asc" },
        { priorityScore: "desc" },
        { createdAt: "desc" },
      ],
    });
  }

  async updateActionItem(
    userId: string,
    actionItemId: string,
    data: UpdateActionItemDto,
  ) {
    await this.getActionItem(userId, actionItemId);

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    this.applyActionItemStatusTimestamps(updateData, data.status);

    return prisma.actionItem.update({
      where: { id: actionItemId },
      data: updateData,
      include: this.actionItemInclude(),
    });
  }

  async confirmActionItem(
    userId: string,
    actionItemId: string,
    data: ConfirmActionItemDto,
  ) {
    const actionItem = await this.getActionItem(userId, actionItemId);
    const occurredAt = data.occurredAt || new Date();
    const confirmationSource =
      data.confirmationSource || ActionItemConfirmationSource.user_confirmed;
    const confirmedStatus = this.confirmedStatusForAction(
      actionItem.actionType,
    );
    const finalContent =
      data.finalContent ?? actionItem.finalContent ?? actionItem.draftContent;

    const confirmedActionItem = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          userId,
          personId: actionItem.targetPersonId,
          companyId: actionItem.targetCompanyId,
          activityType: this.activityTypeForAction(actionItem.actionType),
          channel:
            actionItem.externalProvider ||
            this.channelForLane(actionItem.actionLane.laneType),
          direction: "outbound",
          subject: actionItem.title,
          bodySummary: finalContent,
          occurredAt,
          outcome: data.outcome || "confirmed",
          metadataJson: {
            actionItemId: actionItem.id,
            campaignId: actionItem.campaignId,
            actionLaneId: actionItem.actionLaneId,
            actionCycleId: actionItem.actionCycleId,
            confirmationSource,
            actionType: actionItem.actionType,
          },
        },
      });

      return tx.actionItem.update({
        where: { id: actionItem.id },
        data: {
          status: confirmedStatus,
          confirmationSource,
          finalContent,
          activityId: activity.id,
          completedAt: occurredAt,
          updatedAt: new Date(),
        },
        include: this.actionItemInclude(),
      });
    });

    if (actionItem.actionCycleId) {
      await this.commercialService.recordReferralMilestone(
        userId,
        ReferralMilestoneType.first_cycle_completed,
        {
          entityType: "action_cycle",
          entityId: actionItem.actionCycleId,
        },
      );
    }

    if (confirmedStatus === ActionItemStatus.sent_confirmed) {
      await this.commercialService.recordReferralMilestone(
        userId,
        ReferralMilestoneType.first_outreach_sent,
        {
          entityType: "action_item",
          entityId: actionItem.id,
        },
      );
    }

    await this.adminLifecycleService.recordEvent({
      userId,
      stage: UserLifecycleStage.first_action_completed,
      eventType: "first_action_completed",
      sourceType: "action_item",
      sourceId: actionItem.id,
      occurredAt,
      metadata: {
        actionType: actionItem.actionType,
        status: confirmedStatus,
      },
    });

    await this.adminLifecycleService.recordEvent({
      userId,
      stage: UserLifecycleStage.activated,
      eventType: "activated",
      sourceType: "action_item",
      sourceId: actionItem.id,
      occurredAt,
      metadata: {
        reason: "first_action_completed",
      },
    });

    return confirmedActionItem;
  }

  async deleteActionItem(userId: string, actionItemId: string) {
    await this.getActionItem(userId, actionItemId);

    return prisma.actionItem.delete({
      where: { id: actionItemId },
    });
  }

  // CONVERSATION FEEDBACK LOOP
  async createConversationThread(
    userId: string,
    data: CreateConversationThreadDto,
  ) {
    const context = await this.resolveConversationContext(userId, data);

    return prisma.conversationThread.create({
      data: {
        userId,
        campaignId: context.campaignId,
        actionLaneId: context.actionLaneId,
        actionCycleId: context.actionCycleId,
        actionItemId: context.actionItemId,
        targetPersonId: context.targetPersonId,
        targetCompanyId: context.targetCompanyId,
        channel: data.channel,
        externalProvider: data.externalProvider,
        externalThreadUrl: data.externalThreadUrl,
        metadataJson: data.metadataJson,
      },
      include: this.conversationThreadInclude(),
    });
  }

  async getConversationThread(userId: string, threadId: string) {
    const thread = await prisma.conversationThread.findFirst({
      where: { id: threadId, userId },
      include: this.conversationThreadInclude(),
    });

    if (!thread) {
      throw new NotFoundException("Conversation thread not found");
    }

    return thread;
  }

  async getOrCreateActionItemConversationThread(
    userId: string,
    actionItemId: string,
  ) {
    const actionItem = await this.getActionItem(userId, actionItemId);
    const existing = await prisma.conversationThread.findFirst({
      where: { userId, actionItemId },
      include: this.conversationThreadInclude(),
      orderBy: { createdAt: "desc" },
    });

    if (existing) return existing;

    return prisma.conversationThread.create({
      data: {
        userId,
        campaignId: actionItem.campaignId,
        actionLaneId: actionItem.actionLaneId,
        actionCycleId: actionItem.actionCycleId,
        actionItemId: actionItem.id,
        targetPersonId: actionItem.targetPersonId,
        targetCompanyId: actionItem.targetCompanyId,
        channel: this.channelForActionItem(
          actionItem.actionType,
          actionItem.actionLane.laneType,
        ),
        externalProvider: actionItem.externalProvider,
        externalThreadUrl: actionItem.externalUrl,
        status: ConversationThreadStatus.waiting_for_reply,
        metadataJson: {
          createdFromActionItem: true,
          actionType: actionItem.actionType,
        },
      },
      include: this.conversationThreadInclude(),
    });
  }

  async captureConversationMessage(
    userId: string,
    threadId: string,
    data: CaptureConversationMessageDto,
  ) {
    const thread = await this.getConversationThread(userId, threadId);
    const hasText = Boolean(data.bodyText?.trim());
    const attachmentUrls = data.attachmentUrls || [];

    if (!hasText && attachmentUrls.length === 0) {
      throw new BadRequestException(
        "Message text or at least one attachment is required",
      );
    }

    const direction = data.direction || ConversationMessageDirection.inbound;
    const occurredAt = data.occurredAt || new Date();

    return prisma.$transaction(async (tx) => {
      const message = await tx.conversationThreadMessage.create({
        data: {
          userId,
          threadId: thread.id,
          direction,
          source:
            data.source ||
            (attachmentUrls.length > 0
              ? ConversationMessageSource.screenshot
              : ConversationMessageSource.manual_paste),
          bodyText: data.bodyText,
          attachmentUrls,
          attachmentMimeTypes: data.attachmentMimeTypes || [],
          occurredAt,
          metadataJson: data.metadataJson,
        },
      });

      await tx.conversationThread.update({
        where: { id: thread.id },
        data: {
          status:
            direction === ConversationMessageDirection.inbound
              ? ConversationThreadStatus.needs_response
              : ConversationThreadStatus.waiting_for_reply,
          lastMessageAt: occurredAt,
          updatedAt: new Date(),
        },
      });

      if (
        direction === ConversationMessageDirection.inbound &&
        thread.actionItemId
      ) {
        await tx.actionItem.update({
          where: { id: thread.actionItemId },
          data: {
            status: ActionItemStatus.responded,
            respondedAt: occurredAt,
            updatedAt: new Date(),
          },
        });
      }

      return message;
    });
  }

  async synthesizeConversationThread(
    userId: string,
    threadId: string,
    data: SynthesizeConversationThreadDto = {},
  ) {
    const thread = await this.getConversationThread(userId, threadId);
    const synthesis = await this.deriveConversationSynthesis(thread);

    return prisma.$transaction(async (tx) => {
      let suggestedActionItemId: string | undefined;

      if (data.createSuggestedAction && thread.actionLaneId) {
        const actionItem = await tx.actionItem.create({
          data: {
            userId,
            campaignId: thread.campaignId || thread.actionLane!.campaignId,
            actionLaneId: thread.actionLaneId,
            actionCycleId: thread.actionCycleId,
            targetPersonId: thread.targetPersonId,
            targetCompanyId: thread.targetCompanyId,
            targetType: thread.targetPersonId
              ? "person"
              : thread.targetCompanyId
                ? "company"
                : "conversation",
            targetId: thread.targetPersonId || thread.targetCompanyId,
            actionType: synthesis.suggestedActionType,
            title: synthesis.recommendedNextAction,
            instructions: `Review the captured ${thread.channel} exchange, then respond based on the synthesized feedback.`,
            draftContent: synthesis.draftFollowUp,
            externalProvider: thread.externalProvider,
            externalUrl: thread.externalThreadUrl,
            status: ActionItemStatus.suggested,
            confirmationRequired: true,
            priorityScore: synthesis.priorityScore,
            metadataJson: {
              sourceConversationThreadId: thread.id,
              sourceInsight: synthesis.summary,
            },
          },
        });
        suggestedActionItemId = actionItem.id;
      }

      const insight = await tx.conversationThreadInsight.create({
        data: {
          userId,
          threadId: thread.id,
          summary: synthesis.summary,
          sentiment: synthesis.sentiment,
          intent: synthesis.intent,
          objections: synthesis.objections,
          buyingSignals: synthesis.buyingSignals,
          recommendedNextAction: synthesis.recommendedNextAction,
          suggestedActionType: synthesis.suggestedActionType,
          suggestedActionItemId,
          evidenceMessageIds: synthesis.evidenceMessageIds,
          metadataJson: {
            imageAttachmentCount: synthesis.imageAttachmentCount,
            synthesisMode: synthesis.synthesisMode,
          },
        },
      });

      await tx.conversationThread.update({
        where: { id: thread.id },
        data: {
          latestSummary: synthesis.summary,
          latestSentiment: synthesis.sentiment,
          latestIntent: synthesis.intent,
          nextActionSummary: synthesis.recommendedNextAction,
          status: ConversationThreadStatus.needs_response,
          updatedAt: new Date(),
        },
      });

      return {
        insight,
        suggestedActionItemId,
      };
    });
  }

  async intakeConversationFeedback(
    userId: string,
    data: ConversationFeedbackIntakeDto,
  ) {
    const hasEvidence =
      Boolean(data.bodyText?.trim()) || Boolean(data.attachmentUrls?.length);

    if (!hasEvidence) {
      throw new BadRequestException(
        "Reply text or at least one attachment is required",
      );
    }

    if (data.threadIdHint) {
      const thread = await this.getConversationThread(
        userId,
        data.threadIdHint,
      );
      return this.captureAndSynthesizeAttributedFeedback(
        userId,
        thread.id,
        data,
      );
    }

    if (data.actionItemIdHint) {
      const thread = await this.getOrCreateActionItemConversationThread(
        userId,
        data.actionItemIdHint,
      );
      return this.captureAndSynthesizeAttributedFeedback(
        userId,
        thread.id,
        data,
      );
    }

    const candidates = await this.findConversationAttributionCandidates(
      userId,
      data,
    );
    const topCandidate = candidates[0];

    if (
      topCandidate &&
      topCandidate.confidence >= 0.75 &&
      topCandidate.threadId
    ) {
      return this.captureAndSynthesizeAttributedFeedback(
        userId,
        topCandidate.threadId,
        data,
        candidates,
      );
    }

    if (
      topCandidate &&
      topCandidate.confidence >= 0.75 &&
      topCandidate.actionItemId
    ) {
      const thread = await this.getOrCreateActionItemConversationThread(
        userId,
        topCandidate.actionItemId,
      );
      return this.captureAndSynthesizeAttributedFeedback(
        userId,
        thread.id,
        data,
        candidates,
      );
    }

    return {
      status: candidates.length ? "needs_clarification" : "no_match",
      candidates,
      clarificationQuestion: candidates.length
        ? "Which conversation should I attach this response to?"
        : "I could not confidently match this response to an open conversation. Which campaign or action was this from?",
    };
  }

  // AI DECISION SUPPORT
  async getNextBestAction(userId: string, campaignId: string) {
    const campaign = await this.getCampaign(userId, campaignId);

    // Get all active lanes with their execution records
    const lanesWithCycles = await prisma.actionLane.findMany({
      where: {
        campaignId,
        status: ActionLaneStatus.ACTIVE,
      },
      include: {
        actionCycles: {
          where: {
            status: {
              in: [
                ActionCycleStatus.planned,
                ActionCycleStatus.active,
                ActionCycleStatus.surfaced,
                ActionCycleStatus.pursuing,
              ],
            },
          },
          include: {
            actionItems: {
              where: {
                status: {
                  in: [
                    ActionItemStatus.suggested,
                    ActionItemStatus.ready,
                    ActionItemStatus.in_progress,
                  ],
                },
              },
              orderBy: { priorityScore: "desc" },
            },
          },
          orderBy: { priorityScore: "desc" },
        },
        actionItems: {
          where: {
            status: {
              in: [
                ActionItemStatus.suggested,
                ActionItemStatus.ready,
                ActionItemStatus.in_progress,
              ],
            },
          },
          orderBy: { priorityScore: "desc" },
          take: 5,
        },
        campaignMetrics: {
          where: { metricType: "conversion_rate" },
          orderBy: { computedAt: "desc" },
          take: 3,
        },
      },
      orderBy: { priorityScore: "desc" },
    });

    // AI decision logic for lane prioritization
    const laneScores = lanesWithCycles.map((lane) => {
      const recentConversionRate =
        lane.campaignMetrics[0]?.metricValue.toNumber() || 0;
      const activeExecutionCount = lane.actionCycles.length;
      const lanePriority = lane.priorityScore;

      // Score based on performance, capacity, and priority
      const performanceScore = recentConversionRate * 0.4;
      const capacityScore = activeExecutionCount < 3 ? 0.3 : 0; // Prefer lanes with capacity
      const priorityScore = (lanePriority / 100) * 0.3;

      return {
        lane,
        totalScore: performanceScore + capacityScore + priorityScore,
        recommendation: this.generateLaneRecommendation(
          lane,
          activeExecutionCount,
          recentConversionRate,
        ),
      };
    });

    // Sort by total score
    laneScores.sort((a, b) => b.totalScore - a.totalScore);

    const bestLane = laneScores[0];
    if (!bestLane) {
      return {
        recommendation: "No active lanes available for action",
        nextAction: null,
      };
    }

    const nextExecution = bestLane.lane.actionCycles[0];
    const nextItem =
      bestLane.lane.actionItems[0] || nextExecution?.actionItems?.[0];

    return {
      recommendation: bestLane.recommendation,
      nextAction: {
        campaign,
        actionLane: bestLane.lane,
        actionCycle: nextExecution,
        actionItem: nextItem || null,
        confidence: bestLane.totalScore,
        alternativeLanes: laneScores.slice(1, 3).map((ls) => ({
          lane: ls.lane,
          score: ls.totalScore,
          recommendation: ls.recommendation,
        })),
      },
    };
  }

  // CAMPAIGN METRICS
  async updateCampaignMetrics(
    userId: string,
    campaignId: string,
    metricType: string,
    value: number,
  ) {
    await this.findCampaign(userId, campaignId);

    return prisma.campaignMetric.create({
      data: {
        campaignId,
        userId,
        metricType,
        metricValue: value,
        computedAt: new Date(),
      },
    });
  }

  async updateLaneMetrics(
    userId: string,
    actionLaneId: string,
    metricType: string,
    value: number,
  ) {
    await this.getActionLane(userId, actionLaneId);

    return prisma.campaignMetric.create({
      data: {
        actionLaneId,
        userId,
        metricType,
        metricValue: value,
        computedAt: new Date(),
      },
    });
  }

  async getCampaignMetrics(
    userId: string,
    campaignId: string,
    metricType?: string,
  ) {
    await this.findCampaign(userId, campaignId);

    const where: any = { campaignId };
    if (metricType) {
      where.metricType = metricType;
    }

    return prisma.campaignMetric.findMany({
      where,
      orderBy: { computedAt: "desc" },
      take: 50,
    });
  }

  // PRIVATE HELPER METHODS
  private async findCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return campaign;
  }

  private async verifyActionLaneOwnership(
    userId: string,
    actionLaneId: string,
  ) {
    const actionLane = await prisma.actionLane.findFirst({
      where: { id: actionLaneId },
      include: {
        campaign: { select: { id: true, userId: true } },
      },
    });

    if (!actionLane || actionLane.campaign.userId !== userId) {
      throw new NotFoundException("Action lane not found");
    }

    return actionLane;
  }

  private async verifyActionCycleBelongsToLane(
    userId: string,
    actionCycleId: string,
    actionLaneId: string,
  ) {
    const actionCycle = await this.getActionCycle(userId, actionCycleId);

    if (actionCycle.actionLaneId !== actionLaneId) {
      throw new BadRequestException(
        "Action cycle does not belong to the provided action lane",
      );
    }

    return actionCycle;
  }

  private async verifyOptionalTargets(
    userId: string,
    targetPersonId?: string,
    targetCompanyId?: string,
  ) {
    if (targetPersonId) {
      const person = await prisma.person.findFirst({
        where: { id: targetPersonId, userId },
      });
      if (!person) throw new NotFoundException("Target person not found");
    }

    if (targetCompanyId) {
      const company = await prisma.company.findFirst({
        where: { id: targetCompanyId, userId },
      });
      if (!company) throw new NotFoundException("Target company not found");
    }
  }

  private actionItemInclude() {
    return {
      campaign: { select: { id: true, title: true, status: true } },
      actionLane: {
        select: { id: true, title: true, laneType: true, status: true },
      },
      actionCycle: {
        select: { id: true, title: true, cycleNumber: true, status: true },
      },
      targetPerson: true,
      targetCompany: true,
      activity: true,
      workspaceCommand: {
        select: { id: true, commandType: true, status: true },
      },
    };
  }

  private conversationThreadInclude() {
    return {
      campaign: {
        select: { id: true, title: true, status: true, targetSegment: true },
      },
      actionLane: {
        select: {
          id: true,
          campaignId: true,
          title: true,
          laneType: true,
          status: true,
        },
      },
      actionCycle: {
        select: { id: true, title: true, cycleNumber: true, status: true },
      },
      actionItem: {
        select: { id: true, title: true, actionType: true, status: true },
      },
      targetPerson: true,
      targetCompany: true,
      messages: { orderBy: { occurredAt: "asc" as const } },
      insights: { orderBy: { createdAt: "desc" as const }, take: 5 },
    };
  }

  private async captureAndSynthesizeAttributedFeedback(
    userId: string,
    threadId: string,
    data: ConversationFeedbackIntakeDto,
    candidates: any[] = [],
  ) {
    const message = await this.captureConversationMessage(userId, threadId, {
      direction: ConversationMessageDirection.inbound,
      source: data.attachmentUrls?.length
        ? ConversationMessageSource.screenshot
        : ConversationMessageSource.manual_paste,
      bodyText: data.bodyText || data.message,
      attachmentUrls: data.attachmentUrls || [],
      attachmentMimeTypes: data.attachmentMimeTypes || [],
      metadataJson: {
        intakeMessage: data.message,
        channelHint: data.channelHint,
        personHint: data.personHint,
        companyHint: data.companyHint,
        campaignIdHint: data.campaignIdHint,
      },
    });
    const synthesis = await this.synthesizeConversationThread(
      userId,
      threadId,
      {
        createSuggestedAction: data.createSuggestedAction ?? true,
      },
    );
    const thread = await this.getConversationThread(userId, threadId);

    return {
      status: "captured",
      thread,
      message,
      insight: synthesis.insight,
      suggestedActionItemId: synthesis.suggestedActionItemId,
      candidates,
    };
  }

  private async findConversationAttributionCandidates(
    userId: string,
    data: ConversationFeedbackIntakeDto,
  ) {
    const [threads, actionItems] = await Promise.all([
      prisma.conversationThread.findMany({
        where: {
          userId,
          status: {
            in: [
              ConversationThreadStatus.active,
              ConversationThreadStatus.waiting_for_reply,
              ConversationThreadStatus.needs_response,
            ],
          },
        },
        include: this.conversationThreadInclude(),
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      prisma.actionItem.findMany({
        where: {
          userId,
          status: {
            in: [
              ActionItemStatus.suggested,
              ActionItemStatus.ready,
              ActionItemStatus.in_progress,
              ActionItemStatus.sent_confirmed,
              ActionItemStatus.published_confirmed,
            ],
          },
        },
        include: this.actionItemInclude(),
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
    ]);

    const threadCandidates = threads.map((thread: any) => {
      const scored = this.scoreAttributionCandidate(data, {
        channel: thread.channel,
        campaignId: thread.campaignId,
        campaignTitle: thread.campaign?.title,
        laneTitle: thread.actionLane?.title,
        actionTitle: thread.actionItem?.title,
        personName: thread.targetPerson?.fullName,
        companyName: thread.targetCompany?.name,
        lastMessageAt: thread.lastMessageAt || thread.createdAt,
      });

      return {
        type: "conversation_thread",
        threadId: thread.id,
        actionItemId: thread.actionItemId,
        confidence: scored.confidence,
        reasons: scored.reasons,
        label:
          thread.actionItem?.title ||
          thread.actionLane?.title ||
          thread.campaign?.title ||
          thread.channel,
        campaign: thread.campaign,
        actionLane: thread.actionLane,
        actionItem: thread.actionItem,
        targetPerson: thread.targetPerson,
        targetCompany: thread.targetCompany,
      };
    });

    const actionItemCandidates = actionItems.map((actionItem: any) => {
      const scored = this.scoreAttributionCandidate(data, {
        channel: this.channelForActionItem(
          actionItem.actionType,
          actionItem.actionLane.laneType,
        ),
        campaignId: actionItem.campaignId,
        campaignTitle: actionItem.campaign?.title,
        laneTitle: actionItem.actionLane?.title,
        actionTitle: actionItem.title,
        personName: actionItem.targetPerson?.fullName,
        companyName: actionItem.targetCompany?.name,
        lastMessageAt: actionItem.completedAt || actionItem.createdAt,
      });

      return {
        type: "action_item",
        threadId: undefined,
        actionItemId: actionItem.id,
        confidence: scored.confidence,
        reasons: scored.reasons,
        label: actionItem.title,
        campaign: actionItem.campaign,
        actionLane: actionItem.actionLane,
        actionItem: {
          id: actionItem.id,
          title: actionItem.title,
          actionType: actionItem.actionType,
          status: actionItem.status,
        },
        targetPerson: actionItem.targetPerson,
        targetCompany: actionItem.targetCompany,
      };
    });

    return [...threadCandidates, ...actionItemCandidates]
      .filter((candidate) => candidate.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private scoreAttributionCandidate(
    data: ConversationFeedbackIntakeDto,
    candidate: {
      channel?: string;
      campaignId?: string;
      campaignTitle?: string;
      laneTitle?: string;
      actionTitle?: string;
      personName?: string;
      companyName?: string;
      lastMessageAt?: Date | string;
    },
  ) {
    let score = 0.15;
    const reasons: string[] = ["Recent open campaign conversation"];
    const evidence =
      `${data.message || ""} ${data.bodyText || ""} ${data.personHint || ""} ${data.companyHint || ""}`.toLowerCase();

    if (data.channelHint && candidate.channel?.includes(data.channelHint)) {
      score += 0.25;
      reasons.push(`Channel matches ${data.channelHint}`);
    }

    if (data.campaignIdHint && candidate.campaignId === data.campaignIdHint) {
      score += 0.3;
      reasons.push("Campaign hint matches");
    }

    if (
      data.personHint &&
      candidate.personName &&
      this.textIncludesLoose(candidate.personName, data.personHint)
    ) {
      score += 0.25;
      reasons.push(`Person matches ${candidate.personName}`);
    }

    if (
      data.companyHint &&
      candidate.companyName &&
      this.textIncludesLoose(candidate.companyName, data.companyHint)
    ) {
      score += 0.2;
      reasons.push(`Company matches ${candidate.companyName}`);
    }

    for (const [label, value, weight] of [
      ["person", candidate.personName, 0.25],
      ["company", candidate.companyName, 0.2],
      ["campaign", candidate.campaignTitle, 0.15],
      ["lane", candidate.laneTitle, 0.12],
      ["action", candidate.actionTitle, 0.12],
    ] as Array<[string, string | undefined, number]>) {
      if (value && this.textIncludesLoose(evidence, value)) {
        score += weight;
        reasons.push(`${label} text appears in feedback`);
      }
    }

    const recencyBoost = this.recencyBoost(candidate.lastMessageAt);
    if (recencyBoost > 0) {
      score += recencyBoost;
      reasons.push("Recent action/thread");
    }

    return {
      confidence: Math.min(0.98, Number(score.toFixed(2))),
      reasons,
    };
  }

  private textIncludesLoose(source: string, target: string): boolean {
    const normalizedSource = source.toLowerCase();
    const normalizedTarget = target.toLowerCase();
    return (
      normalizedSource.includes(normalizedTarget) ||
      normalizedTarget
        .split(/\s+/)
        .filter(Boolean)
        .some((part) => part.length > 2 && normalizedSource.includes(part))
    );
  }

  private recencyBoost(value?: Date | string): number {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return 0;
    const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
    if (ageHours <= 24) return 0.18;
    if (ageHours <= 72) return 0.12;
    if (ageHours <= 168) return 0.06;
    return 0;
  }

  private async resolveConversationContext(
    userId: string,
    data: CreateConversationThreadDto,
  ) {
    const context: {
      campaignId?: string;
      actionLaneId?: string;
      actionCycleId?: string;
      actionItemId?: string;
      targetPersonId?: string;
      targetCompanyId?: string;
    } = {};

    if (data.actionItemId) {
      const actionItem = await this.getActionItem(userId, data.actionItemId);
      context.actionItemId = actionItem.id;
      context.campaignId = actionItem.campaignId;
      context.actionLaneId = actionItem.actionLaneId;
      context.actionCycleId = actionItem.actionCycleId || undefined;
      context.targetPersonId = actionItem.targetPersonId || undefined;
      context.targetCompanyId = actionItem.targetCompanyId || undefined;
      return context;
    }

    if (data.campaignId) {
      const campaign = await this.findCampaign(userId, data.campaignId);
      context.campaignId = campaign.id;
    }

    if (data.actionLaneId) {
      const actionLane = await this.verifyActionLaneOwnership(
        userId,
        data.actionLaneId,
      );
      context.actionLaneId = actionLane.id;
      context.campaignId = actionLane.campaignId;
    }

    if (data.actionCycleId) {
      const actionCycle = await this.getActionCycle(userId, data.actionCycleId);
      context.actionCycleId = actionCycle.id;
      context.campaignId = actionCycle.campaignId;
      context.actionLaneId = actionCycle.actionLaneId;
    }

    await this.verifyOptionalTargets(
      userId,
      data.targetPersonId,
      data.targetCompanyId,
    );
    context.targetPersonId = data.targetPersonId;
    context.targetCompanyId = data.targetCompanyId;

    return context;
  }

  private async deriveConversationSynthesis(thread: any) {
    const inboundMessages = (thread.messages || []).filter(
      (message: any) =>
        message.direction === ConversationMessageDirection.inbound,
    );
    const latestInbound = inboundMessages[inboundMessages.length - 1];
    const allText = inboundMessages
      .map((message: any) => message.bodyText || "")
      .join("\n")
      .toLowerCase();
    const imageAttachmentCount = (thread.messages || []).reduce(
      (count: number, message: any) =>
        count +
        (message.attachmentMimeTypes || []).filter((mimeType: string) =>
          mimeType.startsWith("image/"),
        ).length,
      0,
    );

    try {
      const aiSynthesis = await this.aiService.synthesizeConversationFeedback({
        thread,
        messages: thread.messages || [],
      });

      return {
        ...aiSynthesis,
        sentiment: aiSynthesis.sentiment as ConversationInsightSentiment,
        evidenceMessageIds: (thread.messages || []).map(
          (message: any) => message.id,
        ),
        imageAttachmentCount,
        synthesisMode: "ai_multimodal",
      };
    } catch {
      // Keep the action loop functional when AI credentials are missing or the model returns invalid JSON.
    }

    const positiveTerms = [
      "interested",
      "thanks",
      "helpful",
      "sounds good",
      "yes",
      "open",
      "happy to",
      "let’s",
      "let's",
      "useful",
    ];
    const negativeTerms = [
      "not interested",
      "no thanks",
      "unsubscribe",
      "stop",
      "irrelevant",
      "busy",
      "not now",
    ];
    const objectionTerms = [
      "cost",
      "budget",
      "timing",
      "too busy",
      "already",
      "not now",
      "priority",
      "security",
      "approval",
    ];

    const hasPositive = positiveTerms.some((term) => allText.includes(term));
    const hasNegative = negativeTerms.some((term) => allText.includes(term));
    const objections = objectionTerms.filter((term) => allText.includes(term));
    const buyingSignals = positiveTerms.filter((term) =>
      allText.includes(term),
    );
    const sentiment =
      hasPositive && hasNegative
        ? ConversationInsightSentiment.mixed
        : hasPositive
          ? ConversationInsightSentiment.positive
          : hasNegative
            ? ConversationInsightSentiment.negative
            : allText.trim() || imageAttachmentCount > 0
              ? ConversationInsightSentiment.neutral
              : ConversationInsightSentiment.unknown;

    const intent =
      sentiment === ConversationInsightSentiment.positive
        ? "engaged"
        : sentiment === ConversationInsightSentiment.negative
          ? "disqualified_or_low_priority"
          : objections.length > 0
            ? "objection_handling"
            : "needs_follow_up";

    const channelLabel = (thread.channel || "conversation").replace(/_/g, " ");
    const summary = latestInbound?.bodyText
      ? `Latest ${channelLabel} reply captured: "${this.truncate(latestInbound.bodyText, 180)}"`
      : imageAttachmentCount > 0
        ? `Latest ${channelLabel} feedback captured from ${imageAttachmentCount} image attachment${imageAttachmentCount === 1 ? "" : "s"}.`
        : `Conversation feedback captured for ${channelLabel}.`;

    const recommendedNextAction =
      sentiment === ConversationInsightSentiment.negative
        ? "Decide whether to close this thread or send a brief graceful exit"
        : objections.length > 0
          ? "Draft an objection-handling reply"
          : sentiment === ConversationInsightSentiment.positive
            ? "Draft a reply that advances to a concrete next step"
            : "Draft a lightweight follow-up response";

    return {
      summary,
      sentiment,
      intent,
      objections,
      buyingSignals,
      recommendedNextAction,
      suggestedActionType: this.followUpActionTypeForChannel(thread.channel),
      draftFollowUp: this.draftFollowUpForSynthesis(
        sentiment,
        objections,
        thread,
      ),
      priorityScore:
        sentiment === ConversationInsightSentiment.positive
          ? 85
          : objections.length > 0
            ? 75
            : 60,
      evidenceMessageIds: (thread.messages || []).map(
        (message: any) => message.id,
      ),
      imageAttachmentCount,
      synthesisMode: "deterministic_first_pass",
    };
  }

  private followUpActionTypeForChannel(channel: string): string {
    if (channel?.includes("linkedin")) return "linkedin_reply_follow_up";
    if (channel?.includes("email")) return "email_reply_follow_up";
    if (channel?.includes("youtube")) return "youtube_comment_follow_up";
    return "conversation_follow_up";
  }

  private draftFollowUpForSynthesis(
    sentiment: ConversationInsightSentiment,
    objections: string[],
    thread: any,
  ): string {
    const campaignTitle = thread.campaign?.title || "this campaign";

    if (sentiment === ConversationInsightSentiment.positive) {
      return `Thanks for the thoughtful reply. It sounds like this is relevant to ${campaignTitle}. Would it be useful if I shared a concrete example or a short next step?`;
    }

    if (objections.length > 0) {
      return `That makes sense. The point is not to add noise, but to see whether there is a practical angle worth exploring. The main issue I heard is ${objections[0]}; I can keep this focused around that.`;
    }

    if (sentiment === ConversationInsightSentiment.negative) {
      return `Understood, thanks for letting me know. I will leave it there for now.`;
    }

    return `Thanks for the reply. The reason I reached out is that this connects directly to ${campaignTitle}. Would a short example be useful?`;
  }

  private channelForActionItem(actionType: string, laneType: string): string {
    if (actionType.includes("linkedin") || laneType.includes("linkedin"))
      return actionType.includes("post") ? "linkedin_post" : "linkedin_dm";
    if (actionType.includes("email") || laneType.includes("email"))
      return "email";
    if (actionType.includes("youtube") || laneType.includes("video"))
      return "youtube";
    return this.channelForLane(laneType);
  }

  private actionCanvasPanelType(actionType: string, laneType: string): string {
    if (actionType.includes("email") || laneType.includes("email"))
      return "email";
    if (
      actionType.includes("linkedin") &&
      (actionType.includes("post") || laneType.includes("content"))
    )
      return "linkedin_post";
    if (actionType.includes("linkedin") || laneType.includes("linkedin"))
      return "linkedin_dm";
    if (actionType.includes("youtube") || laneType.includes("video"))
      return "content";
    if (laneType.includes("content")) return "content";
    return "generic";
  }

  private actionCanvasCommands(
    panelType: string,
    status: ActionItemStatus,
  ): string[] {
    const base = ["capture_feedback", "ask_conductor"];

    if (
      status === ActionItemStatus.suggested ||
      status === ActionItemStatus.ready ||
      status === ActionItemStatus.in_progress
    ) {
      if (panelType === "email")
        return ["edit_draft", "send_or_confirm", ...base];
      if (panelType === "linkedin_dm")
        return ["open_linkedin", "confirm_sent", ...base];
      if (panelType === "linkedin_post" || panelType === "content")
        return ["edit_content", "confirm_published", ...base];
      return ["confirm_done", ...base];
    }

    return base;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength
      ? `${value.slice(0, maxLength - 1)}...`
      : value;
  }

  private applyActionItemStatusTimestamps(
    updateData: any,
    status?: ActionItemStatus,
  ) {
    if (!status) return;

    const now = new Date();
    switch (status) {
      case ActionItemStatus.ready:
        updateData.preparedAt = now;
        break;
      case ActionItemStatus.in_progress:
        updateData.openedAt = now;
        break;
      case ActionItemStatus.sent_confirmed:
      case ActionItemStatus.published_confirmed:
      case ActionItemStatus.converted:
        updateData.completedAt = now;
        break;
      case ActionItemStatus.skipped:
      case ActionItemStatus.failed:
        updateData.skippedAt = now;
        break;
      case ActionItemStatus.responded:
        updateData.respondedAt = now;
        break;
    }
  }

  private onboardingLaneCampaignIds(
    lane: any,
    selectedCampaigns: Array<{ id: string }>,
  ): string[] {
    if (Array.isArray(lane.campaignIds) && lane.campaignIds.length > 0) {
      return lane.campaignIds.filter((id: string) =>
        selectedCampaigns.some((campaign) => campaign.id === id),
      );
    }

    return selectedCampaigns.map((campaign) => campaign.id);
  }

  private onboardingSelectionPriority(
    data: FinalizeOnboardingPlanDto,
    laneId: string,
  ): number {
    return data.activationSelection?.laneId === laneId ? 90 : 70;
  }

  private inferActionLaneType(lane: any): ActionLaneType {
    const value =
      `${lane.type || ""} ${lane.title || ""} ${lane.description || ""}`.toLowerCase();

    if (value.includes("linkedin") && value.includes("dm"))
      return ActionLaneType.linkedin_dm;
    if (
      value.includes("linkedin") &&
      (value.includes("message") || value.includes("messaging"))
    )
      return ActionLaneType.linkedin_messaging;
    if (
      value.includes("linkedin") &&
      (value.includes("post") || value.includes("content"))
    )
      return ActionLaneType.linkedin_content;
    if (value.includes("linkedin") && value.includes("comment"))
      return ActionLaneType.linkedin_commenting;
    if (
      value.includes("email") ||
      value.includes("outlook") ||
      value.includes("gmail")
    )
      return ActionLaneType.email;
    if (
      value.includes("warm") ||
      value.includes("intro") ||
      value.includes("referral")
    )
      return ActionLaneType.warm_intro;
    if (value.includes("research")) return ActionLaneType.account_research;
    if (value.includes("call")) return ActionLaneType.call_outreach;

    return ActionLaneType.other;
  }

  private firstActionForLane(laneType: ActionLaneType) {
    if (
      laneType === ActionLaneType.linkedin_dm ||
      laneType === ActionLaneType.linkedin_messaging
    ) {
      return {
        actionType: "linkedin_dm_select_contact",
        targetType: "person",
        externalProvider: "linkedin",
        title: "Select first LinkedIn DM contact",
        instructions:
          "Review suggested LinkedIn contacts for this campaign, choose the first recipient, then draft a DM for manual approval and send confirmation.",
        steps: [
          "Find best-fit LinkedIn contacts from imported/profile data.",
          "Select the first recipient.",
          "Draft a concise LinkedIn DM.",
          "Open LinkedIn for manual send.",
          "Confirm sent so the system can log the action.",
        ],
      };
    }

    if (laneType === ActionLaneType.email) {
      return {
        actionType: "email_select_recipient",
        targetType: "person",
        externalProvider: "outlook",
        title: "Select first email outreach recipient",
        instructions:
          "Review suggested recipients for this campaign, choose the first contact, then generate an email draft for approval before sending.",
        steps: [
          "Find best-fit recipients for the campaign.",
          "Select the first recipient.",
          "Draft the email.",
          "Ask for approval before sending.",
          "Log send and follow-up state.",
        ],
      };
    }

    if (laneType === ActionLaneType.linkedin_content) {
      return {
        actionType: "linkedin_post_draft",
        targetType: "audience",
        externalProvider: "linkedin",
        title: "Draft first LinkedIn post",
        instructions:
          "Draft a campaign-aligned LinkedIn post for review, then ask the user to publish manually and confirm.",
        steps: [
          "Choose the post angle.",
          "Draft the LinkedIn post.",
          "Ask for approval.",
          "Open LinkedIn for manual publishing.",
          "Confirm published and log the action.",
        ],
      };
    }

    return {
      actionType: "manual_action_prepare",
      targetType: "campaign",
      externalProvider: "manual",
      title: "Prepare first campaign action",
      instructions:
        "Prepare the first concrete action for this campaign lane and ask for approval before any external execution.",
      steps: [
        "Explain why this lane is first.",
        "Prepare the first action.",
        "Ask for approval.",
        "Log completion after confirmation.",
      ],
    };
  }

  private confirmedStatusForAction(actionType: string): ActionItemStatus {
    return actionType.includes("post") || actionType.includes("publish")
      ? ActionItemStatus.published_confirmed
      : ActionItemStatus.sent_confirmed;
  }

  private activityTypeForAction(actionType: string): ActivityType {
    if (actionType.includes("linkedin")) return ActivityType.linkedin_message;
    if (actionType.includes("email")) return ActivityType.email;
    if (actionType.includes("call")) return ActivityType.call;
    if (actionType.includes("follow")) return ActivityType.follow_up;
    return ActivityType.note_event;
  }

  private channelForLane(laneType: string): string {
    if (laneType.includes("linkedin")) return "linkedin";
    if (laneType.includes("email")) return "email";
    if (laneType.includes("call")) return "phone";
    return laneType;
  }

  private generateLaneRecommendation(
    lane: any,
    activeExecutionCount: number,
    conversionRate: number,
  ): string {
    const laneType = lane.laneType.replace("_", " ");

    if (activeExecutionCount === 0) {
      return `${laneType} lane is idle - consider surfacing new targets or refining strategy`;
    }

    if (conversionRate > 0.3) {
      return `${laneType} lane is performing well - consider increasing capacity or expanding target criteria`;
    }

    if (conversionRate < 0.1) {
      return `${laneType} lane needs attention - review strategy, target criteria, or messaging`;
    }

    return `${laneType} lane is steady - continue current approach and monitor performance`;
  }

  private mapLaneTypeToChannelCode(laneType: ActionLaneType): string {
    const type = laneType.toString();
    if (type.includes("email")) return "email";
    if (type.includes("linkedin_messaging") || type.includes("linkedin_dm"))
      return "linkedin_dm";
    if (type.includes("linkedin_content")) return "linkedin_post";
    if (type.includes("linkedin_commenting")) return "linkedin_comment";
    if (type.includes("referral") || type.includes("warm_intro"))
      return "warm_intro";
    if (type.includes("event") || type.includes("webinar")) return "webinar";
    if (type.includes("research")) return "research";
    return "other";
  }
}
