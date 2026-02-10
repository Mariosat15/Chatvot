/**
 * Chartvolt WebSocket Server
 *
 * Production-ready WebSocket server for real-time messaging
 * Runs as a separate PM2 process alongside other Chartvolt services
 *
 * Start with: pm2 start ecosystem.config.js --only chartvolt-websocket
 */

import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { verify } from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env" });
dotenv.config({ path: "../.env.local" });

const PORT = process.env.WEBSOCKET_PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || "";

// Get JWT secret with production safety check
// Checks multiple env vars for compatibility with different auth setups
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET, AUTH_SECRET, or BETTER_AUTH_SECRET is required in production");
  }
  if (!secret) {
    console.warn("⚠️  JWT secret not set - using insecure fallback (OK for development only)");
    // snyk:ignore:next-line - Intentional dev-only fallback, production requires env var (line 27-29 throws)
    return "dev-fallback-secret-not-for-production-use-32ch";
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

// ==========================================
// Types
// ==========================================

interface Connection {
  ws: WebSocket;
  participantId: string;
  participantType: "user" | "employee";
  participantName: string;
  conversationIds: Set<string>;
  subscribedSymbols: Set<string>; // Symbols this client wants price updates for
  lastHeartbeat: number;
  isAlive: boolean;
}

interface JWTPayload {
  id?: string;
  sub?: string;
  userId?: string;
  type?: "user" | "employee";
  name?: string;
  email?: string;
}

// ==========================================
// State Management
// ==========================================

const MAX_CONNECTIONS = 6000; // Hard limit (~20% buffer above expected 5K users)
const connections = new Map<string, Connection>();
const conversationSubscribers = new Map<string, Set<string>>(); // conversationId -> connectionIds
const participantConnections = new Map<string, Set<string>>(); // participantId -> connectionIds

// ==========================================
// MongoDB Connection
// ==========================================

/**
 * Load WebSocket pool settings from MDB Cluster settings in DB.
 * Falls back to defaults (5/1) on any error.
 */
async function loadWsPoolSettings(
  uri: string,
): Promise<{ maxPoolSize: number; minPoolSize: number }> {
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      serverMonitoringMode: "poll",
    });
    await client.connect();
    const doc = await client
      .db()
      .collection("mdbclustersettings")
      .findOne({ _id: "global-mdb-cluster-settings" as any });
    await client.close();

    if (doc) {
      return {
        maxPoolSize: doc.wsMaxPoolSize ?? 5,
        minPoolSize: doc.wsMinPoolSize ?? 1,
      };
    }
  } catch {
    // Settings not available — use defaults
  }
  return { maxPoolSize: 5, minPoolSize: 1 };
}

async function connectToMongoDB() {
  try {
    if (!MONGODB_URI) {
      console.error("❌ MONGODB_URI not configured");
      return false;
    }

    const pool = await loadWsPoolSettings(MONGODB_URI);

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: pool.maxPoolSize,
      minPoolSize: pool.minPoolSize,
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      serverMonitoringMode: "poll",
    });
    console.log(
      `✅ Connected to MongoDB (pool: ${pool.maxPoolSize}/${pool.minPoolSize})`,
    );
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    return false;
  }
}

// ==========================================
// HTTP Server with Internal API
// ==========================================
// NOTE: Using HTTP is intentional - this server runs internally behind nginx
// which handles SSL/TLS termination. Direct HTTPS here would add unnecessary
// overhead and complexity for internal service-to-service communication.

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        connections: connections.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      }),
    );
    return;
  }

  // Stats endpoint for server monitor
  if (req.url === "/stats") {
    // Count all unique subscribed symbols across all connections
    const allSubscribedSymbols = new Set<string>();
    connections.forEach((conn) => {
      conn.subscribedSymbols.forEach((symbol) =>
        allSubscribedSymbols.add(symbol),
      );
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        connections: connections.size,
        subscribedSymbols: allSubscribedSymbols.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now(),
      }),
    );
    return;
  }

  // Stats endpoint
  if (req.url === "/stats") {
    const memUsage = process.memoryUsage();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
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
      }),
    );
    return;
  }

  // ==========================================
  // Internal API endpoints (called by main app)
  // ==========================================

  if (req.method === "POST" && req.url?.startsWith("/internal/")) {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const endpoint = req.url?.replace("/internal/", "");

        switch (endpoint) {
          case "message":
            // Broadcast new message
            if (data.conversationId && data.message) {
              broadcastToConversation(data.conversationId, {
                type: "new_message",
                data: {
                  conversationId: data.conversationId,
                  message: data.message,
                },
              });
              // Message broadcast sent
            }
            break;

          case "read":
            // Broadcast read receipt
            if (data.conversationId) {
              broadcastToConversation(
                data.conversationId,
                {
                  type: "read_receipt",
                  data: {
                    conversationId: data.conversationId,
                    participantId: data.participantId,
                    participantName: data.participantName,
                    readAt: data.readAt,
                  },
                },
                data.participantId,
              );
            }
            break;

          case "transfer":
            // Broadcast transfer
            if (data.conversationId) {
              broadcastToConversation(data.conversationId, {
                type: "conversation_update",
                data: {
                  conversationId: data.conversationId,
                  type: "transfer",
                  data: {
                    newEmployeeId: data.toEmployeeId,
                    newEmployeeName: data.toEmployeeName,
                  },
                },
              });
              // Notify the new employee
              broadcastToParticipant(data.toEmployeeId, {
                type: "notification",
                data: {
                  id: `transfer-${Date.now()}`,
                  type: "conversation_assigned",
                  title: "New Conversation",
                  message: "A conversation has been transferred to you",
                  data: { conversationId: data.conversationId },
                },
              });
            }
            break;

          case "typing":
            // Broadcast typing indicator
            if (data.conversationId) {
              broadcastToConversation(
                data.conversationId,
                {
                  type: "typing",
                  data: {
                    conversationId: data.conversationId,
                    participantId: data.participantId,
                    participantName: data.participantName,
                    isTyping: data.isTyping,
                  },
                },
                data.participantId,
              );
            }
            break;

          case "friend-request":
            // Broadcast friend request
            if (data.toUserId) {
              broadcastToParticipant(data.toUserId, {
                type: "friend_request",
                data: { type: data.eventType, request: data.request },
              });
            }
            break;

          case "presence":
            // Broadcast presence
            if (data.participantId) {
              broadcastPresence(data.participantId, data.status);
            }
            break;

          case "broadcast":
            // Generic broadcast to conversation participants
            if (data.conversationId && data.type) {
              broadcastToConversation(data.conversationId, {
                type: data.type,
                data: data.data || data,
              });
              console.log(
                `📢 Broadcast ${data.type} to ${data.conversationId}`,
              );
            }
            break;

          case "chat-transferred":
            // Broadcast chat transfer event
            if (data.conversationId) {
              broadcastToConversation(data.conversationId, {
                type: "chat_transferred",
                data: {
                  conversationId: data.conversationId,
                  isChatTransferred: data.isChatTransferred ?? false,
                  assignedEmployeeId: data.assignedEmployeeId,
                  assignedEmployeeName: data.assignedEmployeeName,
                  chatTransferredTo: data.chatTransferredTo,
                  chatTransferredToName: data.chatTransferredToName,
                  chatTransferredFrom: data.chatTransferredFrom,
                  chatTransferredFromName: data.chatTransferredFromName,
                },
              });
              console.log(
                `🔄 Broadcast chat_transferred to ${data.conversationId}`,
              );

              // Notify affected employees
              if (data.assignedEmployeeId) {
                broadcastToParticipant(data.assignedEmployeeId, {
                  type: "notification",
                  data: {
                    id: `transfer-${Date.now()}`,
                    type: "chat_transfer",
                    title: data.isChatTransferred
                      ? "Chat Transferred"
                      : "Chat Returned",
                    message: data.isChatTransferred
                      ? "A chat has been transferred to you"
                      : "A chat has been returned to you",
                    data: { conversationId: data.conversationId },
                  },
                });
              }
            }
            break;

          case "profile-updated":
            // Broadcast profile update to affected users (friends and conversation participants)
            if (data.userId && data.affectedUserIds) {
              const profileUpdateEvent = {
                type: "profile_updated",
                data: {
                  userId: data.userId,
                  name: data.name,
                  avatar: data.avatar,
                  timestamp: new Date().toISOString(),
                },
              };

              // Notify all affected users (friends and conversation participants)
              for (const affectedUserId of data.affectedUserIds) {
                broadcastToParticipant(affectedUserId, profileUpdateEvent);
              }

              // Also notify the user themselves (for multi-tab/device sync)
              broadcastToParticipant(data.userId, profileUpdateEvent);

              // Profile update broadcast sent
            }
            break;

          case "prices":
            // Broadcast prices AND forming candles to clients based on their subscriptions
            // Called by websocket-price-streamer every ~200ms

            // OPTIMIZATION 1: Skip if no clients connected
            if (connections.size === 0) break;

            if (
              data.prices ||
              data.formingCandles ||
              data.formingCandles5m ||
              data.formingCandles15m ||
              data.formingCandles30m
            ) {
              const allPrices = data.prices || [];
              const allCandles1m = data.formingCandles || [];
              const allCandles5m = data.formingCandles5m || [];
              const allCandles15m = data.formingCandles15m || [];
              const allCandles30m = data.formingCandles30m || [];
              const allCandles1h = data.formingCandles1h || [];
              const allCandles4h = data.formingCandles4h || [];
              const allCandlesD = data.formingCandlesD || [];
              const allCandlesW = data.formingCandlesW || [];
              const allCandlesM = data.formingCandlesM || [];
              // ⭐ COMPLETED CANDLES - so clients can update their historical data
              const completedCandles = data.completedCandles || [];
              const timestamp = Date.now();

              // OPTIMIZATION 2: Pre-stringify for unsubscribed clients (stringify once, use many)
              let cachedFullDataStr: string | null = null;

              let clientCount = 0;
              let filteredCount = 0;

              connections.forEach((conn) => {
                if (conn.ws.readyState !== WebSocket.OPEN) return;

                try {
                  const hasSubscriptions = conn.subscribedSymbols.size > 0;

                  if (hasSubscriptions) {
                    // Filter to only subscribed symbols (must stringify per client)
                    const subs = conn.subscribedSymbols;
                    const eventData = {
                      type: "price_update",
                      data: {
                        prices: allPrices.filter((p: { symbol: string }) =>
                          subs.has(p.symbol),
                        ),
                        formingCandles: allCandles1m.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandles5m: allCandles5m.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandles15m: allCandles15m.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandles30m: allCandles30m.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandles1h: allCandles1h.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandles4h: allCandles4h.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandlesD: allCandlesD.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandlesW: allCandlesW.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        formingCandlesM: allCandlesM.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        // ⭐ Completed candles - filter by symbol
                        completedCandles: completedCandles.filter(
                          (c: { symbol: string }) => subs.has(c.symbol),
                        ),
                        timestamp,
                      },
                    };
                    conn.ws.send(JSON.stringify(eventData));
                    filteredCount++;
                  } else {
                    // No subscriptions - use cached stringified data
                    if (!cachedFullDataStr) {
                      cachedFullDataStr = JSON.stringify({
                        type: "price_update",
                        data: {
                          prices: allPrices,
                          formingCandles: allCandles1m,
                          formingCandles5m: allCandles5m,
                          formingCandles15m: allCandles15m,
                          formingCandles30m: allCandles30m,
                          formingCandles1h: allCandles1h,
                          formingCandles4h: allCandles4h,
                          formingCandlesD: allCandlesD,
                          formingCandlesW: allCandlesW,
                          formingCandlesM: allCandlesM,
                          // ⭐ Completed candles
                          completedCandles: completedCandles,
                          timestamp,
                        },
                      });
                    }
                    conn.ws.send(cachedFullDataStr);
                  }
                  clientCount++;
                } catch {
                  // Ignore send errors
                }
              });

              // Price broadcasts happen silently
            }
            break;

          case "data_updated":
            // Broadcast data update notification to all price viewers
            // Called when: seeding completes, gap fill completes, historical download completes
            if (data.symbol && data.timeframe) {
              const updateEvent = {
                type: "data_updated",
                data: {
                  symbol: data.symbol,
                  timeframe: data.timeframe,
                  reason: data.reason || "historical_data_updated",
                  timestamp: Date.now(),
                },
              };

              let notifiedCount = 0;
              connections.forEach((conn) => {
                if (conn.ws.readyState !== WebSocket.OPEN) return;

                // Only notify clients subscribed to this symbol
                if (conn.subscribedSymbols.has(data.symbol)) {
                  try {
                    conn.ws.send(JSON.stringify(updateEvent));
                    notifiedCount++;
                  } catch {
                    // Ignore send errors
                  }
                }
              });

              console.log(
                `🔄 [Data Updated] ${data.symbol} ${data.timeframe} - notified ${notifiedCount} clients (${data.reason || "update"})`,
              );
            }
            break;

          default:
            console.warn(`Unknown internal endpoint: ${endpoint}`);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error("Internal API error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal error" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

// ==========================================
// WebSocket Server
// ==========================================

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  // Enforce connection limit to prevent memory exhaustion
  if (connections.size >= MAX_CONNECTIONS) {
    console.error(`⚠️ Connection limit reached (${MAX_CONNECTIONS}), rejecting new connection`);
    ws.close(1008, "Server at capacity");
    return;
  }
  handleConnection(ws, req);
});

function handleConnection(ws: WebSocket, req: any) {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  const type = (url.searchParams.get("type") as "user" | "employee") || "user";

  if (!token) {
    ws.close(4001, "Authentication required");
    return;
  }

  let participantId: string;
  let participantType: "user" | "employee" = type;
  let participantName = "Unknown";

  // Try JWT verification first, then fall back to raw ID
  try {
    const decoded = verify(token, JWT_SECRET) as JWTPayload;
    participantId = decoded.id || decoded.sub || decoded.userId || "";
    participantType = decoded.type || type;
    participantName = decoded.name || decoded.email || "Unknown";

    if (!participantId) {
      throw new Error("No user ID in token");
    }
  } catch {
    // JWT verification failed - treat token as raw user/admin ID
    // This supports both JWT auth and simple ID-based auth
    // Accept: MongoDB ObjectIds (24 hex), or any alphanumeric string (admin IDs, session IDs)
    if (
      token &&
      token.length >= 1 &&
      /^[a-f0-9]{24}$|^[a-zA-Z0-9@._-]+$/.test(token)
    ) {
      // Looks like a MongoDB ObjectId, admin ID, or email
      participantId = token;
      participantName = type === "employee" ? "Employee" : "User";
      // Auth via raw ID
    } else {
      console.error(
        "Authentication failed: Invalid token format:",
        token?.substring(0, 20),
      );
      ws.close(4001, "Authentication failed");
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
    subscribedSymbols: new Set(), // Start with no subscriptions
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
  ws.on("pong", () => {
    connection.isAlive = true;
    connection.lastHeartbeat = Date.now();
  });

  // Handle incoming messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(connectionId, message);
    } catch (error) {
      console.error("Invalid message format:", error);
    }
  });

  // Handle close
  ws.on("close", () => {
    handleDisconnect(connectionId);
  });

  // Handle error
  ws.on("error", (error) => {
    // Sanitize error message to prevent format string injection
    const safeMessage = String(error.message || "unknown error").slice(0, 200);
    console.error(`WebSocket error for ${participantId}:`, safeMessage);
    handleDisconnect(connectionId);
  });

  // Send connection acknowledgment
  send(ws, {
    type: "connected",
    data: {
      connectionId,
      participantId,
      serverTime: new Date().toISOString(),
    },
  });

  // Broadcast presence
  broadcastPresence(participantId, "online");

  // Connection tracked silently (visible via /stats endpoint)
}

function handleMessage(connectionId: string, message: any) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  const { type, ...data } = message;

  switch (type) {
    case "subscribe":
      // Subscribe to conversation updates
      if (data.conversationId) {
        connection.conversationIds.add(data.conversationId);
        addSubscriber(data.conversationId, connectionId);
      }
      break;

    case "unsubscribe":
      // Unsubscribe from conversation
      if (data.conversationId) {
        connection.conversationIds.delete(data.conversationId);
        removeSubscriber(data.conversationId, connectionId);
      }
      break;

    case "subscribe_symbol":
      // Subscribe to price updates for specific symbol(s)
      if (data.symbol) {
        connection.subscribedSymbols.add(data.symbol);
      }
      if (data.symbols && Array.isArray(data.symbols)) {
        data.symbols.forEach((s: string) =>
          connection.subscribedSymbols.add(s),
        );
      }
      break;

    case "unsubscribe_symbol":
      // Unsubscribe from price updates
      if (data.symbol) {
        connection.subscribedSymbols.delete(data.symbol);
      }
      if (data.symbols && Array.isArray(data.symbols)) {
        data.symbols.forEach((s: string) =>
          connection.subscribedSymbols.delete(s),
        );
      }
      break;

    case "typing":
      // Broadcast typing indicator
      if (data.conversationId) {
        broadcastToConversation(
          data.conversationId,
          {
            type: "typing",
            data: {
              conversationId: data.conversationId,
              participantId: connection.participantId,
              participantName: connection.participantName,
              isTyping: data.isTyping !== false,
            },
          },
          connection.participantId,
        );
      }
      break;

    case "heartbeat":
      connection.lastHeartbeat = Date.now();
      connection.isAlive = true;
      send(connection.ws, {
        type: "heartbeat_ack",
        data: { timestamp: Date.now() },
      });
      break;

    case "presence":
      // Update presence status
      if (data.status) {
        broadcastPresence(connection.participantId, data.status);
      }
      break;

    case "watch_presence":
      // Subscribe to presence updates for specific participants (friends/conversation partners)
      if (data.participantIds && Array.isArray(data.participantIds)) {
        for (const targetId of data.participantIds) {
          subscribeToPresence(connectionId, targetId);
        }
        // Presence watch registered silently
      }
      break;

    case "unwatch_presence":
      // Unsubscribe from presence updates
      if (data.participantIds && Array.isArray(data.participantIds)) {
        for (const targetId of data.participantIds) {
          unsubscribeFromPresence(connectionId, targetId);
        }
      }
      break;

    case "message":
      // Broadcast new message to conversation
      if (data.conversationId && data.message) {
        broadcastToConversation(data.conversationId, {
          type: "message",
          data: {
            conversationId: data.conversationId,
            message: data.message,
          },
        });
      }
      break;

    default:
      console.error(`Unknown WS message type: ${type}`);
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
      broadcastPresence(connection.participantId, "offline");
    }
  }

  connections.delete(connectionId);
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

function broadcastToConversation(
  conversationId: string,
  event: any,
  excludeParticipantId?: string,
) {
  const subscribers = conversationSubscribers.get(conversationId);
  if (!subscribers) return;

  for (const connectionId of subscribers) {
    const connection = connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      if (
        excludeParticipantId &&
        connection.participantId === excludeParticipantId
      )
        continue;
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

function subscribeToPresence(
  watcherConnectionId: string,
  targetParticipantId: string,
) {
  if (!presenceSubscribers.has(targetParticipantId)) {
    presenceSubscribers.set(targetParticipantId, new Set());
  }
  presenceSubscribers.get(targetParticipantId)!.add(watcherConnectionId);
}

function unsubscribeFromPresence(
  watcherConnectionId: string,
  targetParticipantId: string,
) {
  const subs = presenceSubscribers.get(targetParticipantId);
  if (subs) {
    subs.delete(watcherConnectionId);
    if (subs.size === 0) presenceSubscribers.delete(targetParticipantId);
  }
}

function broadcastPresence(participantId: string, status: string) {
  const event = {
    type: "presence",
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
    // Presence broadcast sent silently
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
const _PING_TIMEOUT = 10000; // 10 seconds to respond

setInterval(() => {
  const _now = Date.now();

  for (const [connectionId, connection] of connections) {
    if (!connection.isAlive) {
      // Connection didn't respond to last ping
      // Connection timeout - terminate silently
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
    type: "message",
    data: { conversationId, message },
  });
}

export function notifyRead(
  conversationId: string,
  participantId: string,
  participantName: string,
) {
  broadcastToConversation(
    conversationId,
    {
      type: "read",
      data: {
        conversationId,
        participantId,
        participantName,
        readAt: new Date().toISOString(),
      },
    },
    participantId,
  );
}

export function notifyTransfer(
  conversationId: string,
  toEmployeeId: string,
  toEmployeeName: string,
) {
  broadcastToConversation(conversationId, {
    type: "conversation_update",
    data: {
      conversationId,
      type: "transfer",
      data: { newEmployeeId: toEmployeeId, newEmployeeName: toEmployeeName },
    },
  });

  broadcastToParticipant(toEmployeeId, {
    type: "notification",
    data: {
      id: `transfer-${Date.now()}`,
      type: "conversation_assigned",
      title: "New Conversation",
      message: "A conversation has been transferred to you",
      data: { conversationId },
    },
  });
}

export function notifyFriendRequest(
  toUserId: string,
  eventType: string,
  request: any,
) {
  broadcastToParticipant(toUserId, {
    type: "friend_request",
    data: { type: eventType, request },
  });
}

export function getOnlineParticipants(participantIds: string[]): string[] {
  return participantIds.filter((id) => participantConnections.has(id));
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
  console.log("🛑 Shutting down WebSocket server...");

  // Close all connections gracefully
  for (const [_connectionId, connection] of connections) {
    connection.ws.close(1001, "Server shutting down");
  }

  wss.close(() => {
    server.close(() => {
      mongoose.disconnect().then(() => {
        console.log("✅ WebSocket server shut down cleanly");
        process.exit(0);
      });
    });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ==========================================
// Start Server
// ==========================================

async function start() {
  console.log("🚀 Starting WebSocket Server...");

  // Connect to MongoDB (optional - for presence persistence)
  await connectToMongoDB();

  server.listen(PORT, () => {
    console.log(`✅ WebSocket server running on port ${PORT}`);
  });
}

start().catch(console.error);
