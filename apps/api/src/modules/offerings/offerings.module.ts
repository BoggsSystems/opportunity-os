import { Module } from '@nestjs/common';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';

@Module({
  controllers: [OfferingsController],
  providers: [OfferingsService],
})
export class OfferingsModule {}
