import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminAnalyticsService } from "./admin-analytics.service";
import { AdminLifecycleService } from "./admin-lifecycle.service";
import { AdminMetricSnapshotService } from "./admin-metric-snapshot.service";
import { AdminOperationsService } from "./admin-operations.service";
import { AdminGuard } from "./admin.guard";

@Module({
  controllers: [AdminController],
  providers: [
    AdminAnalyticsService,
    AdminLifecycleService,
    AdminMetricSnapshotService,
    AdminOperationsService,
    AdminGuard,
  ],
  exports: [AdminLifecycleService, AdminOperationsService],
})
export class AdminModule {}
