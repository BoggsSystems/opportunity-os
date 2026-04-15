"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeopleService = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@opportunity-os/db");
const prisma = new db_1.PrismaClient();
let PeopleService = class PeopleService {
    async create(createPersonDto, userId) {
        return prisma.person.create({
            data: {
                ...createPersonDto,
                userId,
            },
        });
    }
    async findAll(userId) {
        return prisma.person.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async findOne(id, userId) {
        const person = await prisma.person.findFirst({
            where: {
                id,
                userId,
            },
        });
        if (!person) {
            throw new common_1.NotFoundException('Person not found');
        }
        return person;
    }
    async update(id, updatePersonDto, userId) {
        await this.findOne(id, userId);
        return prisma.person.update({
            where: { id },
            data: updatePersonDto,
        });
    }
    async remove(id, userId) {
        await this.findOne(id, userId);
        await prisma.person.delete({
            where: { id },
        });
    }
};
exports.PeopleService = PeopleService;
exports.PeopleService = PeopleService = __decorate([
    (0, common_1.Injectable)()
], PeopleService);
//# sourceMappingURL=people.service.js.map