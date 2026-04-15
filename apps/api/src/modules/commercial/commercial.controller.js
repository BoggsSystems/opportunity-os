"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommercialController = void 0;
const common_1 = require("@nestjs/common");
const commercial_service_1 = require("./commercial.service");
let CommercialController = class CommercialController {
    constructor(commercialService) {
        this.commercialService = commercialService;
    }
    async getSubscription(req) {
        return this.commercialService.getSubscription(req.user.id);
    }
    async getEntitlements(req) {
        return this.commercialService.getEntitlements(req.user.id);
    }
    async getUsage(req) {
        return this.commercialService.getUsage(req.user.id);
    }
};
exports.CommercialController = CommercialController;
__decorate([
    (0, common_1.Get)('subscription'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CommercialController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Get)('entitlements'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CommercialController.prototype, "getEntitlements", null);
__decorate([
    (0, common_1.Get)('usage'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CommercialController.prototype, "getUsage", null);
exports.CommercialController = CommercialController = __decorate([
    (0, common_1.Controller)('me'),
    __metadata("design:paramtypes", [commercial_service_1.CommercialService])
], CommercialController);
//# sourceMappingURL=commercial.controller.js.map