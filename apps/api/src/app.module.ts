import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TestValidationController } from './common/test-validation.controller';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { PeopleModule } from './modules/people/people.module';
import { OfferingsModule } from './modules/offerings/offerings.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotesModule } from './modules/notes/notes.module';
import { TagsModule } from './modules/tags/tags.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { NextActionsModule } from './modules/next-actions/next-actions.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { AiModule } from './modules/ai/ai.module';
import { AssetModule } from './modules/asset/asset.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { GoalsModule } from './modules/goals/goals.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CampaignOrchestrationModule } from './modules/campaign-orchestration/campaign-orchestration.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { DevContextInterceptor } from './common/dev-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    CommercialModule,
    ConnectorsModule,
    CompaniesModule,
    PeopleModule,
    OfferingsModule,
    OpportunitiesModule,
    ActivitiesModule,
    TasksModule,
    NotesModule,
    TagsModule,
    DiscoveryModule,
    NextActionsModule,
    ResumesModule,
    AssetModule,
    EvidenceModule,
    OutreachModule,
    AiModule,
    AnalyticsModule,
    GoalsModule,
    CampaignsModule,
    CampaignOrchestrationModule,
    WorkspaceModule,
  ],
  controllers: [TestValidationController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: DevContextInterceptor,
    },
  ],
})
export class AppModule {}
