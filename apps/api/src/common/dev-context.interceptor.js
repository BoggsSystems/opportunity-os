"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevContextInterceptor = void 0;
const common_1 = require("@nestjs/common");
const db_1 = require("@opportunity-os/db");
const prisma = new db_1.PrismaClient();
let DevContextInterceptor = class DevContextInterceptor {
    constructor() {
        this.devUserId = null;
    }
    async intercept(context, next) {
        if (!this.devUserId) {
            const devUser = await prisma.user.findFirst({
                orderBy: { createdAt: 'desc' },
            });
            this.devUserId = devUser?.id || null;
        }
        const request = context.switchToHttp().getRequest();
        request.user = this.devUserId ? { id: this.devUserId } : null;
        return next.handle();
    }
};
exports.DevContextInterceptor = DevContextInterceptor;
exports.DevContextInterceptor = DevContextInterceptor = __decorate([
    (0, common_1.Injectable)()
], DevContextInterceptor);
//# sourceMappingURL=dev-context.interceptor.js.map