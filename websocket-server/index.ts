/**
 * Chartvolt WebSocket Server
 * 
 * Production-ready WebSocket server for real-time messaging
 * Runs as a separate PM2 process alongside other Chartvolt services
 * 
 * Start with: pm2 start ecosystem.config.js --only chartvolt-websocket
 */

import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });
dotenv.config({ path: '../.env.local' });

const PORT = process.env.WEBSOCKET_PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'default-secret';
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';

// ==========================================
// Types
// ==========================================

interface Connection {
  ws: WebSocket;
  participantId: string;
  participantType: 'user' | 'employee';
  participantName: string;
  conversationIds: Set<string>;
  lastHeartbeat: number;
  isAlive: boolean;
}

interface JWTPayload {
  id?: string;
  sub?: string;
  userId?: string;
  type?: 'user' | 'employee';
  name?: string;
  email?: string;
}

// ==========================================
// State Management
// ==========================================

const connections = new Map<string, Connection>();
const conversationSubscribers = new Map<string, Set<string>>(); // conversationId -> connectionIds
const participantConnections = new Map<string, Set<string>>(); // participantId -> connectionIds

// ==========================================
// MongoDB Connection
// ==========================================

async function connectToMongoDB() {
  try {
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI not configured');
      return false;
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
}

// ==========================================
// HTTP Server with Internal API
// ==========================================

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: connections.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }));
    return;
  }

  // Stats endpoint
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalConnections: connections.size,
      uniqueParticipants: participantConnections.size,
      activeConversations: conversationSubscribers.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    }));
    return;
  }

  // ==========================================
  // Internal API endpoints (called by main app)
  // ==========================================
  
  if (req.method === 'POST' && req.url?.startsWith('/internal/')) {
    let body = '';
    
    req.on('data', chunk => { body += chunk; });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const endpoint = req.url?.replace('/internal/', '');

        switch (endpoint) {
          case 'message':
            // Broadcast new message
            if (data.conversationId && data.message) {
              broadcastToConversation(data.conversationId, {
                type: 'message',
                data: { conversationId: data.conversationId, message: data.message },
              });
              console.log(`📤 Broadcast message to ${data.conversationId}`);
            }
            break;

          case 'read':
            // Broadcast read receipt
            if (data.conversationId) {
              broadcastToConversation(data.conversationId, {
                type: 'read',
                data: {
                  conversationId: data.conversationId,
                  participantId: data.participantId,
                  participantName: data.participantName,
                  readAt: data.readAt,
                },
              }, data.participantId);
            }
            break;

          case 'transfer':
            // Broadcast transfer
            if (data.conversationId) {
              broadcastToConversation(data.conversationId, {
                type: 'conversation_update',
                data: {
                  conversationId: data.conversationId,
                  type: 'transfer',
                  data: {
                    newEmployeeId: data.toEmployeeId,
                    newEmployeeName: data.toEmployeeName,
                  },
                },
              });
              // Notify the new employee
              broadcastToParticipant(data.toEmployeeId, {
                type: 'notification',
                data: {
                  id: `transfer-${Date.now()}`,
                  type: 'conversation_assigned',
                  title: 'New Conversation',
                  message: 'A conversation has been transferred to you',
                  data: { conversationId: data.conversationId },
                },
              });
            }
            break;

          case 'typing':
            // Broadcast typing indicator
            if (data.conversationId) {
              broadcastToConversation(data.conversationId, {
                type: 'typing',
                data: {
                  conversationId: data.conversationId,
                  participantId: data.participantId,
                  participantName: data.participantName,
                  isTyping: data.isTyping,
                },
              }, data.participantId);
            }
            break;

          case 'friend-request':
            // Broadcast friend request
            if (data.toUserId) {
              broadcastToParticipant(data.toUserId, {
                type: 'friend_request',
                data: { type: data.eventType, request: data.request },
              });
            }
            break;

          case 'presence':
            // Broadcast presence
            if (data.participantId) {
              broadcastPresence(data.participantId, data.status);
            }
            break;

          default:
            console.warn(`Unknown internal endpoint: ${endpoint}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Internal API error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ==========================================
// WebSocket Server
// ==========================================

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  handleConnection(ws, req);
});

function handleConnection(ws: WebSocket, req: any) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }

  try {
    const decoded = verify(token, JWT_SECRET) as JWTPayload;
    const participantId = decoded.id || decoded.sub || decoded.userId;

    if (!participantId) {
      ws.close(4001, 'Invalid token - no user ID');
      return;
    }

    const connectionId = `${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const connection: Connection = {
      ws,
      participantId,
      participantType: decoded.type || 'user',
      participantName: decoded.name || decoded.email || 'Unknown',
      conversationIds: new Set(),
      lastHeartbeat: Date.now(),
      isAlive: true,
    };

    // Store connection
    connections.set(connectionId, connection);

    // Track participant connections
    if (!participantConnections.has(participantId)) {
      participantConnections.set(participantId, new Set());
    }
    participantConnections.get(participantId)!.add(connectionId);

    // Setup ping/pong for connection health
    ws.on('pong', () => {
      connection.isAlive = true;
      connection.lastHeartbeat = Date.now();
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(connectionId, message);
      } catch (error) {
        console.error('Invalid message format:', error);
      }
    });

    // Handle close
    ws.on('close', () => {
      handleDisconnect(connectionId);
    });

    // Handle error
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${participantId}:`, error.message);
      handleDisconnect(connectionId);
    });

    // Send connection acknowledgment
    send(ws, {
      type: 'connected',
      data: {
        connectionId,
        participantId,
        serverTime: new Date().toISOString(),
      },
    });

    // Broadcast presence
    broadcastPresence(participantId, 'online');

    console.log(`✅ Connected: ${participantId} (${decoded.type || 'user'}) - Total: ${connections.size}`);
  } catch (error: any) {
    console.error('Authentication failed:', error.message);
    ws.close(4001, 'Authentication failed');
  }
}

function handleMessage(connectionId: string, message: any) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  const { type, ...data } = message;

  switch (type) {
    case 'subscribe':
      // Subscribe to conversation updates
      if (data.conversationId) {
        connection.conversationIds.add(data.conversationId);
        addSubscriber(data.conversationId, connectionId);
        console.log(`📌 ${connection.participantId} subscribed to ${data.conversationId}`);
      }
      break;

    case 'unsubscribe':
      // Unsubscribe from conversation
      if (data.conversationId) {
        connection.conversationIds.delete(data.conversationId);
        removeSubscriber(data.conversationId, connectionId);
      }
      break;

    case 'typing':
      // Broadcast typing indicator
      if (data.conversationId) {
        broadcastToConversation(data.conversationId, {
          type: 'typing',
          data: {
            conversationId: data.conversationId,
            participantId: connection.participantId,
            participantName: connection.participantName,
            isTyping: data.isTyping !== false,
          },
        }, connection.participantId);
      }
      break;

    case 'heartbeat':
      connection.lastHeartbeat = Date.now();
      connection.isAlive = true;
      send(connection.ws, {
        type: 'heartbeat_ack',
        data: { timestamp: Date.now() },
      });
      break;

    case 'presence':
      // Update presence status
      if (data.status) {
        broadcastPresence(connection.participantId, data.status);
      }
      break;

    case 'message':
      // Broadcast new message to conversation
      if (data.conversationId && data.message) {
        broadcastToConversation(data.conversationId, {
          type: 'message',
          data: {
            conversationId: data.conversationId,
            message: data.message,
          },
        });
      }
      break;

    default:
      console.log(`Unknown message type: ${type}`);
  }
}

function handleDisconnect(connectionId: string) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Remove from all conversation subscribers
  for (const conversationId of connection.conversationIds) {
    removeSubscriber(conversationId, connectionId);
  }

  // Remove from participant connections
  const participantConns = participantConnections.get(connection.participantId);
  if (participantConns) {
    participantConns.delete(connectionId);
    if (participantConns.size === 0) {
      participantConnections.delete(connection.participantId);
      // Only broadcast offline if no more connections for this participant
      broadcastPresence(connection.participantId, 'offline');
    }
  }

  connections.delete(connectionId);
  console.log(`❌ Disconnected: ${connection.participantId} - Total: ${connections.size}`);
}

// ==========================================
// Helper Functions
// ==========================================

function send(ws: WebSocket, event: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function addSubscriber(conversationId: string, connectionId: string) {
  if (!conversationSubscribers.has(conversationId)) {
    conversationSubscribers.set(conversationId, new Set());
  }
  conversationSubscribers.get(conversationId)!.add(connectionId);
}

function removeSubscriber(conversationId: string, connectionId: string) {
  const subscribers = conversationSubscribers.get(conversationId);
  if (subscribers) {
    subscribers.delete(connectionId);
    if (subscribers.size === 0) {
      conversationSubscribers.delete(conversationId);
    }
  }
}

function broadcastToConversation(conversationId: string, event: any, excludeParticipantId?: string) {
  const subscribers = conversationSubscribers.get(conversationId);
  if (!subscribers) return;

  for (const connectionId of subscribers) {
    const connection = connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      if (excludeParticipantId && connection.participantId === excludeParticipantId) continue;
      send(connection.ws, event);
    }
  }
}

function broadcastToParticipant(participantId: string, event: any) {
  const connectionIds = participantConnections.get(participantId);
  if (!connectionIds) return;

  for (const connectionId of connectionIds) {
    const connection = connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      send(connection.ws, event);
    }
  }
}

function broadcastPresence(participantId: string, status: string) {
  const event = {
    type: 'presence',
    data: {
      participantId,
      status,
      lastSeen: new Date().toISOString(),
    },
  };

  // Broadcast to all connected users (they'll filter relevant ones client-side)
  for (const [_, connection] of connections) {
    if (connection.ws.readyState === WebSocket.OPEN) {
      send(connection.ws, event);
    }
  }
}

// ==========================================
// Ping/Pong Health Check
// ==========================================

const PING_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 10000; // 10 seconds to respond

setInterval(() => {
  const now = Date.now();
  
  for (const [connectionId, connection] of connections) {
    if (!connection.isAlive) {
      // Connection didn't respond to last ping
      console.log(`⏰ Connection timeout: ${connection.participantId}`);
      connection.ws.terminate();
      handleDisconnect(connectionId);
      continue;
    }

    // Mark as not alive and send ping
    connection.isAlive = false;
    connection.ws.ping();
  }
}, PING_INTERVAL);

// ==========================================
// API Endpoints for Backend Integration
// ==========================================

// These functions can be called from other services via HTTP or internal messaging

export function notifyNewMessage(conversationId: string, message: any) {
  broadcastToConversation(conversationId, {
    type: 'message',
    data: { conversationId, message },
  });
}

export function notifyRead(conversationId: string, participantId: string, participantName: string) {
  broadcastToConversation(conversationId, {
    type: 'read',
    data: {
      conversationId,
      participantId,
      participantName,
      readAt: new Date().toISOString(),
    },
  }, participantId);
}

export function notifyTransfer(conversationId: string, toEmployeeId: string, toEmployeeName: string) {
  broadcastToConversation(conversationId, {
    type: 'conversation_update',
    data: {
      conversationId,
      type: 'transfer',
      data: { newEmployeeId: toEmployeeId, newEmployeeName: toEmployeeName },
    },
  });

  broadcastToParticipant(toEmployeeId, {
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

export function notifyFriendRequest(toUserId: string, eventType: string, request: any) {
  broadcastToParticipant(toUserId, {
    type: 'friend_request',
    data: { type: eventType, request },
  });
}

export function getOnlineParticipants(participantIds: string[]): string[] {
  return participantIds.filter(id => participantConnections.has(id));
}

export function getStats() {
  return {
    totalConnections: connections.size,
    uniqueParticipants: participantConnections.size,
    activeConversations: conversationSubscribers.size,
  };
}

// ==========================================
// Graceful Shutdown
// ==========================================

function shutdown() {
  console.log('🛑 Shutting down WebSocket server...');

  // Close all connections gracefully
  for (const [connectionId, connection] of connections) {
    connection.ws.close(1001, 'Server shutting down');
  }

  wss.close(() => {
    server.close(() => {
      mongoose.disconnect().then(() => {
        console.log('✅ WebSocket server shut down cleanly');
        process.exit(0);
      });
    });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ==========================================
// Start Server
// ==========================================

async function start() {
  console.log('🚀 Starting Chartvolt WebSocket Server...');
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Connect to MongoDB (optional - for presence persistence)
  await connectToMongoDB();

  server.listen(PORT, () => {
    console.log(`✅ WebSocket server running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  });
}

start().catch(console.error);

