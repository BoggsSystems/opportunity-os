import { Global, Module } from '@nestjs/common';
import { SystemDateService } from './system-date.service';

@Global()
@Module({
  providers: [SystemDateService],
  exports: [SystemDateService],
})
export class CommonModule {}
