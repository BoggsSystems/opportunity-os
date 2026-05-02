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
import { OnEvent } from '@nestjs/event-emitter';
import { prisma } from '@opportunity-os/db';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ImportGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ImportGateway.name);

  constructor() {
    this.logger.log('🔌 Import WebSocket Gateway constructor called');
  }

  afterInit() {
    this.logger.log('🔌 WebSocket Gateway initialized');
  }
  
  @OnEvent('import.progress')
  handleImportProgressEvent(data: any) {
    this.logger.log(`📊 Received import.progress event for ${data.importId}: ${data.percentage}%`);
    this.sendImportProgress(data.importId, data);
  }

  @OnEvent('import.completed')
  handleImportCompletedEvent(data: any) {
    this.logger.log(`✅ Received import.completed event for ${data.importId}`);
    this.sendImportCompletion(data.importId, data);
  }

  @OnEvent('import.error')
  handleImportErrorEvent(data: any) {
    this.logger.log(`❌ Received import.error event for ${data.importId}: ${data.message}`);
    this.sendImportError(data.importId, data);
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
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const importId = typeof data === 'string' ? data : data?.importId;
    
    if (!importId) {
      this.logger.warn(`📡 Client ${client.id} tried to subscribe with invalid importId:`, data);
      return;
    }

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
    this.logger.log(`📋 Sending current status for import ${importId}`);
    try {
      const batch = await prisma.connectionImportBatch.findUnique({
        where: { id: importId }
      });

      if (batch) {
        const percentage = batch.totalRows > 0 
          ? Math.round(((batch.createdPeopleCount + batch.duplicateCount + batch.errorCount) / batch.totalRows) * 100)
          : 0;

        this.sendImportProgress(importId, {
          status: batch.status.toString(),
          totalRecords: batch.totalRows,
          processedRecords: batch.createdPeopleCount + batch.duplicateCount + batch.errorCount,
          importedRecords: batch.createdPeopleCount,
          duplicateRecords: batch.duplicateCount,
          failedRecords: batch.errorCount,
          percentage
        });

        if (batch.status === 'completed') {
          this.sendImportCompletion(importId, {
            status: 'completed',
            totalRecords: batch.totalRows,
            importedRecords: batch.createdPeopleCount,
            duplicateRecords: batch.duplicateCount,
            failedRecords: batch.errorCount,
            duration: 0 // Unknown
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Error sending initial status: ${error.message}`);
    }
  }
}
