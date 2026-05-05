import { io, Socket } from 'socket.io-client';

export interface ImportProgress {
  type: 'progress';
  importId: string;
  timestamp: string;
  data: {
    status: string;
    totalRecords?: number;
    processedRecords?: number;
    importedRecords?: number;
    duplicateRecords?: number;
    failedRecords?: number;
    percentage?: number;
    message?: string;
  };
}

export interface ImportCompleted {
  type: 'completed';
  importId: string;
  timestamp: string;
  data: {
    status: string;
    totalRecords: number;
    importedRecords: number;
    duplicateRecords: number;
    failedRecords: number;
    duration: number;
  };
}

export interface ImportError {
  type: 'error';
  importId: string;
  timestamp: string;
  data: {
    message: string;
    details?: any;
  };
}

export interface ShreddingProgress {
  type: 'shredding-progress';
  batchId: string;
  assetId?: string;
  assetName?: string;
  step: string;
  percentage: number;
  message?: string;
  summary?: string;
  timestamp: string;
}

export interface ShreddingCompleted {
  type: 'shredding-completed';
  batchId: string;
  timestamp: string;
  data: {
    importedCount?: number;
    failedCount?: number;
    summary?: string;
  };
}

export interface ShreddingError {
  type: 'shredding-error';
  batchId: string;
  timestamp: string;
  error: any;
}

export type ImportEvent = ImportProgress | ImportCompleted | ImportError | ShreddingProgress | ShreddingCompleted | ShreddingError;

export class ImportWebSocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, (event: ImportEvent) => void>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    // Don't connect automatically, wait for subscription
  }

  private connect() {
    if (this.socket?.connected) return;
    
    console.log('🔌 Connecting to Import WebSocket...');
    
    this.socket = io('http://localhost:3002', {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Import WebSocket');
      this.reconnectAttempts = 0;
      
      // Resubscribe to all active listeners on reconnect
      this.listeners.forEach((_, importId) => {
        console.log(`📡 Re-subscribing to import: ${importId}`);
        this.socket?.emit('subscribe-import', importId);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Import WebSocket:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Import WebSocket connection error:', error);
    });

    // Import event listeners
    this.socket.on('import-progress', (event: ImportProgress) => {
      console.log('📊 Import progress:', event);
      this.notifyListeners(event);
    });

    this.socket.on('import-completed', (event: ImportCompleted) => {
      console.log('✅ Import completed:', event);
      this.notifyListeners(event);
    });

    this.socket.on('import-error', (event: ImportError) => {
      console.log('❌ Import error:', event);
      this.notifyListeners(event);
    });

    this.socket.on('shredding-progress', (event: ShreddingProgress) => {
      console.log('📊 Shredding progress:', event);
      this.notifyListeners(event);
    });

    this.socket.on('shredding-completed', (event: ShreddingCompleted) => {
      console.log('✅ Shredding completed:', event);
      this.notifyListeners(event);
    });

    this.socket.on('shredding-error', (event: ShreddingError) => {
      console.log('❌ Shredding error:', event);
      this.notifyListeners(event);
    });
  }


  private notifyListeners(event: ImportEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in WebSocket listener:', error);
      }
    });
  }

  // Subscribe to import updates
  subscribe(importId: string, callback: (event: ImportEvent) => void) {
    console.log(`📡 Subscribing to import: ${importId}`);
    
    // Add listener
    this.listeners.set(importId, callback);
    
    // Ensure connected
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    
    // Tell server we want updates for this import
    if (this.socket) {
      this.socket.emit('subscribe-import', importId);
    }
  }

  // Unsubscribe from import updates
  unsubscribe(importId: string) {
    console.log(`📡 Unsubscribing from import: ${importId}`);
    
    // Remove listener
    this.listeners.delete(importId);
    
    // Tell server we don't want updates anymore
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-import', importId);
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect() {
    console.log('🔌 Disconnecting Import WebSocket');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.listeners.clear();
  }
}

// Singleton instance
export const importWebSocketService = new ImportWebSocketService();
