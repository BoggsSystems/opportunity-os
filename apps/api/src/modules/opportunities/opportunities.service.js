"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpportunitiesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@opportunity-os/db");
const prisma = new db_1.PrismaClient();
let OpportunitiesService = class OpportunitiesService {
    async create(createOpportunityDto, userId) {
        return prisma.opportunity.create({
            data: {
                ...createOpportunityDto,
                userId,
            },
        });
    }
    async findAll(userId) {
        return prisma.opportunity.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async findOne(id, userId) {
        const opportunity = await prisma.opportunity.findFirst({
            where: {
                id,
                userId,
            },
        });
        if (!opportunity) {
            throw new common_1.NotFoundException('Opportunity not found');
        }
        return opportunity;
    }
    async update(id, updateOpportunityDto, userId) {
        await this.findOne(id, userId);
        return prisma.opportunity.update({
            where: { id },
            data: updateOpportunityDto,
        });
    }
    async remove(id, userId) {
        await this.findOne(id, userId);
        await prisma.opportunity.delete({
            where: { id },
        });
    }
};
exports.OpportunitiesService = OpportunitiesService;
exports.OpportunitiesService = OpportunitiesService = __decorate([
    (0, common_1.Injectable)()
], OpportunitiesService);
//# sourceMappingURL=opportunities.service.js.map