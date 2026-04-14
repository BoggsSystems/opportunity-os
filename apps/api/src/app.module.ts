import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { PeopleModule } from './modules/people/people.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotesModule } from './modules/notes/notes.module';
import { TagsModule } from './modules/tags/tags.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ResumesModule } from './modules/resumes/resumes.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    CommercialModule,
    CompaniesModule,
    PeopleModule,
    OpportunitiesModule,
    ActivitiesModule,
    TasksModule,
    NotesModule,
    TagsModule,
    DiscoveryModule,
    ResumesModule,
    EvidenceModule,
    OutreachModule,
    AiModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
