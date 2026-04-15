"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@opportunity-os/db");
const prisma = new db_1.PrismaClient();
let CompaniesService = class CompaniesService {
    async create(createCompanyDto, userId) {
        return prisma.company.create({
            data: {
                ...createCompanyDto,
                userId,
            },
        });
    }
    async findAll(userId) {
        return prisma.company.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async findOne(id, userId) {
        const company = await prisma.company.findFirst({
            where: {
                id,
                userId,
            },
        });
        if (!company) {
            throw new common_1.NotFoundException('Company not found');
        }
        return company;
    }
    async update(id, updateCompanyDto, userId) {
        await this.findOne(id, userId);
        return prisma.company.update({
            where: { id },
            data: updateCompanyDto,
        });
    }
    async remove(id, userId) {
        await this.findOne(id, userId);
        await prisma.company.delete({
            where: { id },
        });
    }
};
exports.CompaniesService = CompaniesService;
exports.CompaniesService = CompaniesService = __decorate([
    (0, common_1.Injectable)()
], CompaniesService);
//# sourceMappingURL=companies.service.js.map