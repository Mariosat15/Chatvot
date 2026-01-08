/**
 * WebSocket Notifier Service
 * 
 * This service notifies the WebSocket server of events that need to be
 * broadcast to connected clients. In production, this communicates with
 * the standalone WebSocket server.
 * 
 * Architecture:
 * - API Route receives request
 * - Processes business logic
 * - Calls WebSocket Notifier to broadcast event
 * - WebSocket server broadcasts to connected clients
 */

const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_INTERNAL_URL || 
                             process.env.NEXT_PUBLIC_WEBSOCKET_URL ||
                             'http://localhost:3003';

interface WebSocketEvent {
  type: string;
  conversationId?: string;
  participantId?: string;
  data: any;
}

class WebSocketNotifier {
  private static instance: WebSocketNotifier;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = WEBSOCKET_SERVER_URL;
  }

  static getInstance(): WebSocketNotifier {
    if (!WebSocketNotifier.instance) {
      WebSocketNotifier.instance = new WebSocketNotifier();
    }
    return WebSocketNotifier.instance;
  }

  /**
   * Notify WebSocket server of an event
   * Falls back gracefully if WebSocket server is not available
   */
  private async notify(endpoint: string, data: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        // Short timeout - don't block API responses waiting for WS
        signal: AbortSignal.timeout(2000),
      });

      return response.ok;
    } catch (error) {
      // Log but don't throw - WebSocket notifications are best-effort
      console.warn(`WebSocket notification failed: ${endpoint}`, error);
      return false;
    }
  }

  /**
   * Notify of a new message in a conversation
   */
  async notifyNewMessage(conversationId: string, message: any): Promise<void> {
    await this.notify('/internal/message', {
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
    });
  }

  /**
   * Notify of messages being read
   */
  async notifyRead(conversationId: string, participantId: string, participantName: string): Promise<void> {
    await this.notify('/internal/read', {
      conversationId,
      participantId,
      participantName,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * Notify of conversation transfer
   */
  async notifyTransfer(
    conversationId: string,
    toEmployeeId: string,
    toEmployeeName: string
  ): Promise<void> {
    await this.notify('/internal/transfer', {
      conversationId,
      toEmployeeId,
      toEmployeeName,
    });
  }

  /**
   * Notify of typing status
   */
  async notifyTyping(
    conversationId: string,
    participantId: string,
    participantName: string,
    isTyping: boolean
  ): Promise<void> {
    await this.notify('/internal/typing', {
      conversationId,
      participantId,
      participantName,
      isTyping,
    });
  }

  /**
   * Notify of friend request
   */
  async notifyFriendRequest(
    toUserId: string,
    eventType: 'received' | 'accepted' | 'declined' | 'cancelled',
    request: any
  ): Promise<void> {
    await this.notify('/internal/friend-request', {
      toUserId,
      eventType,
      request: {
        id: request._id?.toString() || request.id,
        fromUserId: request.fromUserId,
        fromUserName: request.fromUserName,
        toUserId: request.toUserId,
        toUserName: request.toUserName,
        message: request.message,
      },
    });
  }

  /**
   * Notify of presence change
   */
  async notifyPresence(participantId: string, status: 'online' | 'away' | 'busy' | 'offline'): Promise<void> {
    await this.notify('/internal/presence', {
      participantId,
      status,
    });
  }

  /**
   * Get WebSocket server health status
   */
  async getHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get WebSocket server stats
   */
  async getStats(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const wsNotifier = WebSocketNotifier.getInstance();
export default wsNotifier;

