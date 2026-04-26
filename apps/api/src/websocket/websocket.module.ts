import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ImportGateway } from './import.gateway';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
  ],
  providers: [ImportGateway],
  exports: [ImportGateway],
})
export class WebSocketModule {
  constructor(private _importGateway: ImportGateway) {
    console.log('🔌 WebSocketModule constructor called');
    console.log('🔌 ImportGateway injected:', !!this._importGateway);
  }
}
