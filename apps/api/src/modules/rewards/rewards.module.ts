import { Module, Global } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { SystemDateService } from '../../common/system-date.service';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Global()
@Module({
  imports: [AuthModule, BillingModule],
  controllers: [RewardsController],
  providers: [RewardsService, SystemDateService],
  exports: [RewardsService, SystemDateService],
})
export class RewardsModule {}
