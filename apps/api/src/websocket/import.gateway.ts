import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { EventEmitter2 } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ImportGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ImportGateway.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.logger.log('🔌 Import WebSocket Gateway constructor called');
    this.logger.log('🔌 EventEmitter2 injected successfully');
  }

  afterInit(server: Server) {
    this.logger.log('🔌 WebSocket Gateway initialized with server');
    this.logger.log(`🔌 Server instance type: ${server.constructor.name}`);
    this.logger.log(`🔌 Server has socket.io: ${!!server.emit && !!server.on}`);
    
    // Listen to import progress events from services
    this.eventEmitter.on('import.progress', (data) => {
      this.logger.log(`📊 Emitting progress: ${data.percentage}%`);
      this.sendImportProgress(data.importId, data);
    });

    this.eventEmitter.on('import.completed', (data) => {
      this.logger.log(`✅ Emitting completion: ${data.importedRecords} imported`);
      this.sendImportCompletion(data.importId, data);
    });

    this.eventEmitter.on('import.error', (data) => {
      this.logger.log(`❌ Emitting error: ${data.message}`);
      this.sendImportError(data.importId, data);
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`🔗 Client connected: ${client.id}`);
    this.logger.log(`🔗 Client connected from: ${client.handshake.address}`);
    this.logger.log(`🔗 Client handshake headers:`, client.handshake.headers);
    this.logger.log(`🔗 Client transport: ${client.conn.transport.name}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }

  // Subscribe to import updates
  @SubscribeMessage('subscribe-import')
  handleSubscribeImport(
    @MessageBody() importId: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`📡 Client ${client.id} subscribed to import: ${importId}`);
    client.join(`import-${importId}`);
    
    // Send current status if available
    this.sendImportStatus(importId);
  }

  // Unsubscribe from import updates
  @SubscribeMessage('unsubscribe-import')
  handleUnsubscribeImport(
    @MessageBody() importId: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`📡 Client ${client.id} unsubscribed from import: ${importId}`);
    client.leave(`import-${importId}`);
  }

  // Send import progress update to all subscribed clients
  sendImportProgress(importId: string, data: {
    status: string;
    totalRecords?: number;
    processedRecords?: number;
    importedRecords?: number;
    duplicateRecords?: number;
    failedRecords?: number;
    percentage?: number;
    message?: string;
  }) {
    this.logger.log(`📊 Sending progress for import ${importId}:`, data);
    
    try {
      if (this.server && this.server.to) {
        this.server.to(`import-${importId}`).emit('import-progress', {
          type: 'progress',
          importId,
          timestamp: new Date().toISOString(),
          data,
        });
      } else {
        this.logger.warn('🔌 Server not available for sending progress');
      }
    } catch (error) {
      this.logger.error('🔌 Error sending progress:', error);
    }
  }

  // Send import completion
  sendImportCompletion(importId: string, data: {
    status: string;
    totalRecords: number;
    importedRecords: number;
    duplicateRecords: number;
    failedRecords: number;
    duration: number;
  }) {
    this.logger.log(`✅ Sending completion for import ${importId}:`, data);
    
    try {
      if (this.server && this.server.to) {
        this.server.to(`import-${importId}`).emit('import-completed', {
          type: 'completed',
          importId,
          timestamp: new Date().toISOString(),
          data,
        });
      } else {
        this.logger.warn('🔌 Server not available for sending completion');
      }
    } catch (error) {
      this.logger.error('🔌 Error sending completion:', error);
    }
  }

  // Send import error
  sendImportError(importId: string, error: {
    message: string;
    details?: any;
  }) {
    this.logger.log(`❌ Sending error for import ${importId}:`, error);
    
    try {
      if (this.server && this.server.to) {
        this.server.to(`import-${importId}`).emit('import-error', {
          type: 'error',
          importId,
          timestamp: new Date().toISOString(),
          data: error,
        });
      } else {
        this.logger.warn('🔌 Server not available for sending error');
      }
    } catch (error) {
      this.logger.error('🔌 Error sending error:', error);
    }
  }

  // Send current import status (for new subscribers)
  private async sendImportStatus(importId: string) {
    // This would fetch current status from the import service
    // For now, we'll implement this in the service
    this.logger.log(`📋 Sending current status for import ${importId}`);
  }
}
