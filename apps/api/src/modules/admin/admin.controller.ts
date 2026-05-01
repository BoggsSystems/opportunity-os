import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  AdminOperationalIssueSeverity,
  AdminOperationalIssueSource,
  AdminOperationalIssueStatus,
  UserLifecycleStage,
} from "@opportunity-os/db";
import { AdminAnalyticsService } from "./admin-analytics.service";
import { AdminGuard } from "./admin.guard";
import { AdminMetricSnapshotService } from "./admin-metric-snapshot.service";
import { AdminOperationsService } from "./admin-operations.service";

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly analyticsService: AdminAnalyticsService,
    private readonly metricSnapshotService: AdminMetricSnapshotService,
    private readonly operationsService: AdminOperationsService,
  ) {}

  @Get("overview")
  async overview() {
    return this.analyticsService.getOverview();
  }

  @Get("funnel")
  async funnel() {
    return this.analyticsService.getFunnel();
  }

  @Get("users")
  async users(
    @Query("query") query?: string,
    @Query("stage") stage?: UserLifecycleStage,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.analyticsService.listUsers({
      query,
      stage,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Get("users/:userId")
  async user(@Param("userId") userId: string) {
    return this.analyticsService.getUserState(userId);
  }

  @Get("campaigns")
  async campaigns() {
    return this.analyticsService.getCampaignAnalytics();
  }

  @Get("connectors")
  async connectors() {
    return this.analyticsService.getConnectorAnalytics();
  }

  @Get("billing-referrals")
  async billingReferrals() {
    return this.analyticsService.getBillingReferralAnalytics();
  }

  @Post("metrics/snapshots/monthly")
  async createMonthlyMetricSnapshot(
    @Body()
    body: {
      month?: string;
      periodStart?: string;
      periodEnd?: string;
    },
  ) {
    return this.metricSnapshotService.createMonthlySnapshot(body || {});
  }

  @Get("metrics/snapshots")
  async metricSnapshots(
    @Query("metricKey") metricKey?: string,
    @Query("periodStart") periodStart?: string,
    @Query("periodEnd") periodEnd?: string,
    @Query("limit") limit?: string,
  ) {
    return this.metricSnapshotService.listSnapshots({
      metricKey,
      periodStart,
      periodEnd,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("operations/issues")
  async issues(
    @Query("status") status?: AdminOperationalIssueStatus,
    @Query("severity") severity?: AdminOperationalIssueSeverity,
    @Query("source") source?: AdminOperationalIssueSource,
    @Query("limit") limit?: string,
  ) {
    return this.operationsService.listIssues({
      status,
      severity,
      source,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch("operations/issues/:id")
  async updateIssue(
    @Param("id") id: string,
    @Body()
    body: {
      status?: AdminOperationalIssueStatus;
      severity?: AdminOperationalIssueSeverity;
      details?: string;
    },
  ) {
    return this.operationsService.updateIssue(id, body);
  }
}
