"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const health_module_1 = require("./health/health.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const commercial_module_1 = require("./modules/commercial/commercial.module");
const companies_module_1 = require("./modules/companies/companies.module");
const people_module_1 = require("./modules/people/people.module");
const opportunities_module_1 = require("./modules/opportunities/opportunities.module");
const activities_module_1 = require("./modules/activities/activities.module");
const tasks_module_1 = require("./modules/tasks/tasks.module");
const notes_module_1 = require("./modules/notes/notes.module");
const tags_module_1 = require("./modules/tags/tags.module");
const discovery_module_1 = require("./modules/discovery/discovery.module");
const resumes_module_1 = require("./modules/resumes/resumes.module");
const evidence_module_1 = require("./modules/evidence/evidence.module");
const outreach_module_1 = require("./modules/outreach/outreach.module");
const ai_module_1 = require("./modules/ai/ai.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const dev_context_interceptor_1 = require("./common/dev-context.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            commercial_module_1.CommercialModule,
            companies_module_1.CompaniesModule,
            people_module_1.PeopleModule,
            opportunities_module_1.OpportunitiesModule,
            activities_module_1.ActivitiesModule,
            tasks_module_1.TasksModule,
            notes_module_1.NotesModule,
            tags_module_1.TagsModule,
            discovery_module_1.DiscoveryModule,
            resumes_module_1.ResumesModule,
            evidence_module_1.EvidenceModule,
            outreach_module_1.OutreachModule,
            ai_module_1.AiModule,
            analytics_module_1.AnalyticsModule,
        ],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: dev_context_interceptor_1.DevContextInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map