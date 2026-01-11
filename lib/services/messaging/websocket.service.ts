/**
 * WebSocket Service for Real-time Messaging
 * 
 * PRODUCTION NOTE: In production, WebSocket connections are handled by a separate
 * server running at websocket-server/index.ts (PM2 process: chartvolt-websocket).
 * 
 * This file now exports the WebSocket notifier that communicates with the
 * production WebSocket server via HTTP. The old in-process WebSocket code
 * is kept for development/fallback purposes.
 * 
 * Architecture:
 * - Production: chartvolt-websocket (standalone server on port 3003)
 * - API routes call wsNotifier to broadcast events
 * - wsNotifier sends HTTP requests to chartvolt-websocket
 * - chartvolt-websocket broadcasts to connected clients
 */

// Re-export the production-ready notifier
export { wsNotifier, default as WebSocketNotifier } from './websocket-notifier';

import { Server as HTTPServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { Types } from 'mongoose';
import { verify } from 'jsonwebtoken';

// Connection store
interface Connection {
  ws: WebSocket;
  participantId: string;
  participantType: 'user' | 'employee';
  participantName: string;
  conversationIds: Set<string>;
  lastHeartbeat: number;
}

const connections = new Map<string, Connection>();
const conversationSubscribers = new Map<string, Set<string>>(); // conversationId -> participantIds

// Event types
export type WebSocketEvent =
  | { type: 'message'; data: MessageEvent }
  | { type: 'typing'; data: TypingEvent }
  | { type: 'presence'; data: PresenceEvent }
  | { type: 'read'; data: ReadEvent }
  | { type: 'conversation_update'; data: ConversationUpdateEvent }
  | { type: 'friend_request'; data: FriendRequestEvent }
  | { type: 'notification'; data: NotificationEvent };

interface MessageEvent {
  conversationId: string;
  message: {
    id: string;
    senderId: string;
    senderType: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    messageType: string;
    attachments?: any[];
    createdAt: string;
  };
}

interface TypingEvent {
  conversationId: string;
  participantId: string;
  participantName: string;
  isTyping: boolean;
}

interface PresenceEvent {
  participantId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: string;
}

interface ReadEvent {
  conversationId: string;
  participantId: string;
  participantName: string;
  readAt: string;
}

interface ConversationUpdateEvent {
  conversationId: string;
  type: 'transfer' | 'close' | 'new_participant' | 'unread_update';
  data: any;
}

interface FriendRequestEvent {
  type: 'received' | 'accepted' | 'declined' | 'cancelled';
  request: {
    id: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    message?: string;
  };
}

interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export class WebSocketService {
  private static wss: WebSocketServer | null = null;
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  
  /**
   * Initialize WebSocket server (call this once on server startup)
   */
  static initialize(server: HTTPServer): void {
    if (this.wss) {
      console.log('⚠️ WebSocket server already initialized');
      return;
    }
    
    this.wss = new WebSocketServer({ server, path: '/ws/messaging' });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    // Start heartbeat check
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000); // Check every 30 seconds
    
    console.log('✅ WebSocket server initialized on /ws/messaging');
  }
  
  /**
   * Handle new WebSocket connection
   */
  private static handleConnection(ws: WebSocket, req: any): void {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }
    
    // Verify JWT token
    try {
      const jwtSecret = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'default-secret';
      const decoded = verify(token, jwtSecret) as {
        id?: string;
        sub?: string;
        userId?: string;
        type?: 'user' | 'employee';
        name?: string;
      };
      
      const participantId = decoded.id || decoded.sub || decoded.userId;
      if (!participantId) {
        ws.close(4001, 'Invalid token');
        return;
      }
      
      const connectionId = `${participantId}-${Date.now()}`;
      const connection: Connection = {
        ws,
        participantId,
        participantType: decoded.type || 'user',
        participantName: decoded.name || 'Unknown',
        conversationIds: new Set(),
        lastHeartbeat: Date.now(),
      };
      
      connections.set(connectionId, connection);
      
      // Handle messages
      ws.on('message', (data) => {
        this.handleMessage(connectionId, data.toString());
      });
      
      // Handle close
      ws.on('close', () => {
        this.handleDisconnect(connectionId);
      });
      
      // Handle error
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(connectionId);
      });
      
      // Send connected confirmation
      this.send(connectionId, {
        type: 'connected',
        data: { participantId, connectionId },
      });
      
      // Broadcast presence
      this.broadcastPresence(participantId, 'online');
      
      console.log(`✅ WebSocket connected: ${participantId}`);
    } catch (error) {
      console.error('WebSocket auth error:', error);
      ws.close(4001, 'Authentication failed');
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private static handleMessage(connectionId: string, data: string): void {
    const connection = connections.get(connectionId);
    if (!connection) return;
    
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'subscribe':
          // Subscribe to conversation updates
          if (message.conversationId) {
            connection.conversationIds.add(message.conversationId);
            this.addSubscriber(message.conversationId, connectionId);
          }
          break;
          
        case 'unsubscribe':
          // Unsubscribe from conversation
          if (message.conversationId) {
            connection.conversationIds.delete(message.conversationId);
            this.removeSubscriber(message.conversationId, connectionId);
          }
          break;
          
        case 'typing':
          // Broadcast typing indicator
          if (message.conversationId) {
            this.broadcastToConversation(message.conversationId, {
              type: 'typing',
              data: {
                conversationId: message.conversationId,
                participantId: connection.participantId,
                participantName: connection.participantName,
                isTyping: message.isTyping !== false,
              },
            }, connection.participantId);
          }
          break;
          
        case 'heartbeat':
          connection.lastHeartbeat = Date.now();
          this.send(connectionId, { type: 'heartbeat_ack', data: { timestamp: Date.now() } });
          break;
          
        case 'presence':
          // Update presence status
          if (message.status) {
            this.broadcastPresence(connection.participantId, message.status);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }
  
  /**
   * Handle disconnect
   */
  private static handleDisconnect(connectionId: string): void {
    const connection = connections.get(connectionId);
    if (!connection) return;
    
    // Remove from all conversation subscribers
    for (const conversationId of connection.conversationIds) {
      this.removeSubscriber(conversationId, connectionId);
    }
    
    // Broadcast offline status
    this.broadcastPresence(connection.participantId, 'offline');
    
    connections.delete(connectionId);
    console.log(`❌ WebSocket disconnected: ${connection.participantId}`);
  }
  
  /**
   * Check heartbeats and disconnect stale connections
   */
  private static checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout
    
    for (const [connectionId, connection] of connections) {
      if (now - connection.lastHeartbeat > timeout) {
        console.log(`⏰ WebSocket heartbeat timeout: ${connection.participantId}`);
        connection.ws.close(4002, 'Heartbeat timeout');
        this.handleDisconnect(connectionId);
      }
    }
  }
  
  /**
   * Add subscriber to conversation
   */
  private static addSubscriber(conversationId: string, connectionId: string): void {
    if (!conversationSubscribers.has(conversationId)) {
      conversationSubscribers.set(conversationId, new Set());
    }
    conversationSubscribers.get(conversationId)!.add(connectionId);
  }
  
  /**
   * Remove subscriber from conversation
   */
  private static removeSubscriber(conversationId: string, connectionId: string): void {
    const subscribers = conversationSubscribers.get(conversationId);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        conversationSubscribers.delete(conversationId);
      }
    }
  }
  
  /**
   * Send message to specific connection
   */
  private static send(connectionId: string, event: any): void {
    const connection = connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(event));
    }
  }
  
  /**
   * Broadcast to all connections of a participant
   */
  static broadcastToParticipant(participantId: string, event: any): void {
    for (const [connectionId, connection] of connections) {
      if (connection.participantId === participantId && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(event));
      }
    }
  }
  
  /**
   * Broadcast to all subscribers of a conversation
   */
  static broadcastToConversation(conversationId: string, event: any, excludeParticipantId?: string): void {
    const subscribers = conversationSubscribers.get(conversationId);
    if (!subscribers) return;
    
    for (const connectionId of subscribers) {
      const connection = connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        if (excludeParticipantId && connection.participantId === excludeParticipantId) continue;
        connection.ws.send(JSON.stringify(event));
      }
    }
  }
  
  /**
   * Broadcast presence update to all connections
   */
  private static broadcastPresence(participantId: string, status: string): void {
    const event = {
      type: 'presence',
      data: {
        participantId,
        status,
        lastSeen: new Date().toISOString(),
      },
    };
    
    // Broadcast to all connections (they'll filter relevant ones)
    for (const [_, connection] of connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(event));
      }
    }
  }
  
  // ==========================================
  // PUBLIC BROADCAST METHODS (called from API routes)
  // ==========================================
  
  /**
   * Broadcast new message to conversation participants
   */
  static notifyNewMessage(conversationId: string, message: any): void {
    this.broadcastToConversation(conversationId, {
      type: 'message',
      data: {
        conversationId,
        message: {
          id: message._id?.toString() || message.id,
          senderId: message.senderId,
          senderType: message.senderType,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar,
          content: message.content,
          messageType: message.messageType,
          attachments: message.attachments,
          createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
        },
      },
    });
  }
  
  /**
   * Notify read receipt
   */
  static notifyRead(conversationId: string, participantId: string, participantName: string): void {
    this.broadcastToConversation(conversationId, {
      type: 'read',
      data: {
        conversationId,
        participantId,
        participantName,
        readAt: new Date().toISOString(),
      },
    }, participantId);
  }
  
  /**
   * Notify conversation transfer
   */
  static notifyTransfer(conversationId: string, toEmployeeId: string, toEmployeeName: string): void {
    this.broadcastToConversation(conversationId, {
      type: 'conversation_update',
      data: {
        conversationId,
        type: 'transfer',
        data: {
          newEmployeeId: toEmployeeId,
          newEmployeeName: toEmployeeName,
        },
      },
    });
    
    // Also notify the new employee
    this.broadcastToParticipant(toEmployeeId, {
      type: 'notification',
      data: {
        id: `transfer-${Date.now()}`,
        type: 'conversation_assigned',
        title: 'New Conversation',
        message: 'A conversation has been transferred to you',
        data: { conversationId },
      },
    });
  }
  
  /**
   * Notify friend request
   */
  static notifyFriendRequest(
    toUserId: string,
    eventType: 'received' | 'accepted' | 'declined' | 'cancelled',
    request: any
  ): void {
    this.broadcastToParticipant(toUserId, {
      type: 'friend_request',
      data: {
        type: eventType,
        request: {
          id: request._id?.toString() || request.id,
          fromUserId: request.fromUserId,
          fromUserName: request.fromUserName,
          toUserId: request.toUserId,
          toUserName: request.toUserName,
          message: request.message,
        },
      },
    });
  }
  
  /**
   * Get online status for participants
   */
  static getOnlineParticipants(participantIds: string[]): string[] {
    const online: string[] = [];
    for (const [_, connection] of connections) {
      if (participantIds.includes(connection.participantId)) {
        online.push(connection.participantId);
      }
    }
    return [...new Set(online)];
  }
  
  /**
   * Get connection count
   */
  static getConnectionCount(): number {
    return connections.size;
  }
  
  /**
   * Shutdown WebSocket server
   */
  static shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.wss) {
      for (const [connectionId, connection] of connections) {
        connection.ws.close(1001, 'Server shutting down');
      }
      this.wss.close();
      this.wss = null;
    }
    
    connections.clear();
    conversationSubscribers.clear();
    
    console.log('🛑 WebSocket server shut down');
  }
}

export default WebSocketService;

