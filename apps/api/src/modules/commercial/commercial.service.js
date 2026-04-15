"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommercialService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@opportunity-os/db");
const prisma = new db_1.PrismaClient();
let CommercialService = class CommercialService {
    async getSubscription(userId) {
        const subscription = await prisma.subscription.findFirst({
            where: {
                userId: userId,
                status: 'active',
            },
            include: {
                plan: true,
            },
        });
        if (!subscription) {
            throw new common_1.NotFoundException('No active subscription found');
        }
        return {
            id: subscription.id,
            status: subscription.status,
            plan: {
                id: subscription.plan.id,
                code: subscription.plan.code,
                name: subscription.plan.name,
                description: subscription.plan.description,
                monthlyPriceCents: subscription.plan.monthlyPriceCents,
                annualPriceCents: subscription.plan.annualPriceCents,
                currency: subscription.plan.currency,
            },
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            startedAt: subscription.startedAt,
        };
    }
    async getEntitlements(userId) {
        const subscription = await prisma.subscription.findFirst({
            where: {
                userId: userId,
                status: 'active',
            },
            include: {
                plan: {
                    include: {
                        planFeatures: true,
                    },
                },
            },
        });
        if (!subscription) {
            throw new common_1.NotFoundException('No active subscription found');
        }
        const entitlements = subscription.plan.planFeatures.map(feature => ({
            key: feature.featureKey,
            accessLevel: feature.accessLevel,
            config: feature.configJson,
        }));
        return {
            planCode: subscription.plan.code,
            planName: subscription.plan.name,
            entitlements,
        };
    }
    async getUsage(userId) {
        const usageCounters = await prisma.usageCounter.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
        return {
            usageCounters: usageCounters.map(counter => ({
                key: counter.featureKey,
                value: counter.usedCount,
                period: {
                    start: counter.usagePeriodStart,
                    end: counter.usagePeriodEnd,
                },
                updatedAt: counter.updatedAt,
            })),
        };
    }
};
exports.CommercialService = CommercialService;
exports.CommercialService = CommercialService = __decorate([
    (0, common_1.Injectable)()
], CommercialService);
//# sourceMappingURL=commercial.service.js.map