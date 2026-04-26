import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  },
})
export class ImportGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ImportGateway.name);
  private connectedClients = new Map<string, Socket>();

  constructor() {
    this.logger.log('🔌 Import WebSocket Gateway initialized');
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
    
    this.server.to(`import-${importId}`).emit('import-progress', {
      type: 'progress',
      importId,
      timestamp: new Date().toISOString(),
      data,
    });
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
    
    this.server.to(`import-${importId}`).emit('import-completed', {
      type: 'completed',
      importId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  // Send import error
  sendImportError(importId: string, error: {
    message: string;
    details?: any;
  }) {
    this.logger.log(`❌ Sending error for import ${importId}:`, error);
    
    this.server.to(`import-${importId}`).emit('import-error', {
      type: 'error',
      importId,
      timestamp: new Date().toISOString(),
      data: error,
    });
  }

  // Send current import status (for new subscribers)
  private async sendImportStatus(importId: string) {
    // This would fetch current status from the import service
    // For now, we'll implement this in the service
    this.logger.log(`📋 Sending current status for import ${importId}`);
  }
}
