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
    const memUsage = process.memoryUsage();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalConnections: connections.size,
      uniqueParticipants: participantConnections.size,
      activeConversations: conversationSubscribers.size,
      presenceWatchers: presenceSubscribers.size,
      memoryUsage: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
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
                type: 'new_message',
                data: { conversationId: data.conversationId, message: data.message },
              });
              console.log(`📤 Broadcast message to ${data.conversationId}`);
            }
            break;

          case 'read':
            // Broadcast read receipt
            if (data.conversationId) {
              broadcastToConversation(data.conversationId, {
                type: 'read_receipt',
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
  const type = url.searchParams.get('type') as 'user' | 'employee' || 'user';

  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }

  let participantId: string;
  let participantType: 'user' | 'employee' = type;
  let participantName = 'Unknown';

  // Try JWT verification first, then fall back to raw ID
  try {
    const decoded = verify(token, JWT_SECRET) as JWTPayload;
    participantId = decoded.id || decoded.sub || decoded.userId || '';
    participantType = decoded.type || type;
    participantName = decoded.name || decoded.email || 'Unknown';
    
    if (!participantId) {
      throw new Error('No user ID in token');
    }
  } catch (jwtError) {
    // JWT verification failed - treat token as raw user/admin ID
    // This supports both JWT auth and simple ID-based auth
    // Accept: MongoDB ObjectIds (24 hex), or any alphanumeric string (admin IDs, session IDs)
    if (token && token.length >= 1 && /^[a-f0-9]{24}$|^[a-zA-Z0-9@._-]+$/.test(token)) {
      // Looks like a MongoDB ObjectId, admin ID, or email
      participantId = token;
      participantName = type === 'employee' ? 'Employee' : 'User';
      console.log(`🔑 Using raw ID auth for ${type}: ${token.length > 10 ? token.substring(0, 10) + '...' : token}`);
    } else {
      console.error('Authentication failed: Invalid token format:', token?.substring(0, 20));
      ws.close(4001, 'Authentication failed');
      return;
    }
  }

  const connectionId = `${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const connection: Connection = {
    ws,
    participantId,
    participantType,
    participantName,
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

  console.log(`✅ Connected: ${participantId} (${participantType}) - Total: ${connections.size}`);
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

    case 'watch_presence':
      // Subscribe to presence updates for specific participants (friends/conversation partners)
      if (data.participantIds && Array.isArray(data.participantIds)) {
        for (const targetId of data.participantIds) {
          subscribeToPresence(connectionId, targetId);
        }
        console.log(`👁️ ${connection.participantId} watching presence of ${data.participantIds.length} users`);
      }
      break;

    case 'unwatch_presence':
      // Unsubscribe from presence updates
      if (data.participantIds && Array.isArray(data.participantIds)) {
        for (const targetId of data.participantIds) {
          unsubscribeFromPresence(connectionId, targetId);
        }
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

  // Remove from presence subscribers (clean up any presence watches)
  for (const [targetId, subs] of presenceSubscribers) {
    subs.delete(connectionId);
    if (subs.size === 0) presenceSubscribers.delete(targetId);
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

// Track who is interested in whose presence (friends/conversation partners only)
const presenceSubscribers = new Map<string, Set<string>>(); // participantId -> Set of connectionIds watching them

function subscribeToPresence(watcherConnectionId: string, targetParticipantId: string) {
  if (!presenceSubscribers.has(targetParticipantId)) {
    presenceSubscribers.set(targetParticipantId, new Set());
  }
  presenceSubscribers.get(targetParticipantId)!.add(watcherConnectionId);
}

function unsubscribeFromPresence(watcherConnectionId: string, targetParticipantId: string) {
  const subs = presenceSubscribers.get(targetParticipantId);
  if (subs) {
    subs.delete(watcherConnectionId);
    if (subs.size === 0) presenceSubscribers.delete(targetParticipantId);
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

  // OPTIMIZED: Only broadcast to users who are actively watching this participant
  // (users in the same conversation or friends) instead of ALL users
  const subscribers = presenceSubscribers.get(participantId);
  
  if (subscribers && subscribers.size > 0) {
    for (const connectionId of subscribers) {
      const connection = connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        send(connection.ws, event);
      }
    }
    console.log(`📡 Presence ${status} for ${participantId} sent to ${subscribers.size} subscribers`);
  }
  
  // Also notify the participant themselves (for multi-device sync)
  const ownConnections = participantConnections.get(participantId);
  if (ownConnections) {
    for (const connId of ownConnections) {
      const conn = connections.get(connId);
      if (conn && conn.ws.readyState === WebSocket.OPEN) {
        send(conn.ws, event);
      }
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
    presenceWatchers: presenceSubscribers.size,
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

