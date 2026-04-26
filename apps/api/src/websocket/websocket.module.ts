import { Module } from '@nestjs/common';
import { ImportGateway } from './import.gateway';

@Module({
  providers: [ImportGateway],
  exports: [ImportGateway],
})
export class WebSocketModule {}
