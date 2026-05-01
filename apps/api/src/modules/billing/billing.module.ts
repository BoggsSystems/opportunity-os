import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { CommercialModule } from "../commercial/commercial.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
  imports: [CommercialModule, AdminModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
