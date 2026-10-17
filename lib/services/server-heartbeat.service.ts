import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { connectToDatabase } from "@/database/mongoose";

const execAsync = promisify(exec);

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
let heartbeatTimer: NodeJS.Timeout | null = null;
let heartbeatStarted = false;

const SERVER_ID = process.env.SERVER_ID || os.hostname();
const IS_PRIMARY = process.env.IS_PRIMARY !== "false";
const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";

/**
 * Get the server's public IP address
 */
async function getPublicIP(): Promise<string> {
  try {
    const { stdout } = await execAsync("curl -s --max-time 3 ifconfig.me", {
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    try {
      const { stdout } = await execAsync("hostname -I", { timeout: 3000 });
      return stdout.trim().split(" ")[0] || "";
    } catch {
      return "";
    }
  }
}

/**
 * Get PM2 process list
 */
async function getPM2Processes(): Promise<
  Array<{
    name: string;
    status: string;
    cpu: number;
    memoryMB: number;
    uptime: number;
    restarts: number;
  }>
> {
  try {
    const { stdout } = await execAsync("pm2 jlist", { timeout: 5000 });
    const processes = JSON.parse(stdout);
    return processes.map(
      (p: {
        name: string;
        pm2_env: {
          status: string;
          pm_uptime: number;
          restart_time: number;
        };
        monit: { cpu: number; memory: number };
      }) => ({
        name: p.name,
        status: p.pm2_env?.status || "unknown",
        cpu: p.monit?.cpu || 0,
        memoryMB: Math.round((p.monit?.memory || 0) / 1024 / 1024),
        uptime: p.pm2_env?.pm_uptime || 0,
        restarts: p.pm2_env?.restart_time || 0,
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Get disk usage
 */
async function getDiskUsage(): Promise<{
  usedGB: number;
  totalGB: number;
  percent: number;
}> {
  try {
    const { stdout } = await execAsync(
      "df -BG / | tail -1 | awk '{print $2,$3,$5}'",
      { timeout: 3000 },
    );
    const parts = stdout.trim().split(/\s+/);
    const total = parseFloat(parts[0]) || 0;
    const used = parseFloat(parts[1]) || 0;
    const percent = parseFloat(parts[2]) || 0;
    return { usedGB: used, totalGB: total, percent };
  } catch {
    return { usedGB: 0, totalGB: 0, percent: 0 };
  }
}

/**
 * Get git commit hash
 */
async function getGitVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync("git rev-parse --short HEAD", {
      timeout: 3000,
      cwd: process.cwd(),
    });
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

/**
 * Check if Redis is connected (lightweight check)
 */
async function checkRedisConnected(): Promise<boolean> {
  try {
    const { getRedis } = await import("@/lib/services/redis.service");
    const redis = await getRedis();
    if (!redis) return false;
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Get WebSocket connection count
 */
async function getWSConnections(): Promise<number> {
  try {
    const wsPort = process.env.WEBSOCKET_PORT || "3003";
    const response = await fetch(`http://localhost:${wsPort}/stats`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const data = await response.json();
      return data.connections || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Send a single heartbeat to MongoDB
 */
async function sendHeartbeat(): Promise<void> {
  try {
    await connectToDatabase();

    // Dynamic import to avoid circular dependency issues
    const { Server } = await import("@/database/models/server.model");

    const [pm2Procs, disk, version, redisOk, wsConns] = await Promise.all([
      getPM2Processes(),
      getDiskUsage(),
      getGitVersion(),
      checkRedisConnected(),
      getWSConnections(),
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpus = os.cpus();
    let cpuPercent = 0;
    if (cpus.length > 0) {
      const avg = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0);
      cpuPercent = Math.round(avg / cpus.length);
    }

    // On secondary servers, the worker is intentionally stopped (IS_PRIMARY=false).
    // Exclude it from the health check so it doesn't falsely trigger "degraded".
    const relevantProcs = IS_PRIMARY
      ? pm2Procs
      : pm2Procs.filter((p) => p.name !== "chartvolt-worker");

    const onlineProcs = relevantProcs.filter((p) => p.status === "online").length;

    const status =
      onlineProcs === 0
        ? "degraded"
        : onlineProcs < relevantProcs.length
          ? "degraded"
          : "online";

    await Server.findOneAndUpdate(
      { serverId: SERVER_ID },
      {
        $set: {
          hostname: os.hostname(),
          role: IS_PRIMARY ? "primary" : "secondary",
          status,
          lastHeartbeat: new Date(),
          stats: {
            cpuPercent,
            memoryPercent: Math.round((usedMem / totalMem) * 100),
            memoryUsedMB: Math.round(usedMem / 1024 / 1024),
            memoryTotalMB: Math.round(totalMem / 1024 / 1024),
            diskPercent: disk.percent,
            diskUsedGB: disk.usedGB,
            diskTotalGB: disk.totalGB,
            pm2Processes: pm2Procs.length,
            pm2Online: onlineProcs,
            redisConnected: redisOk,
            wsConnections: wsConns,
            nodeVersion: process.version,
          },
          version,
          domain: DOMAIN,
          pm2Processes: pm2Procs,
        },
        $setOnInsert: {
          startedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    console.error(
      "[Heartbeat] Error:",
      error instanceof Error ? error.message : error,
    );
  }
}

// Cache the public IP so we don't fetch it every 30 seconds
let cachedIP = "";

async function sendHeartbeatWithIP(): Promise<void> {
  if (!cachedIP) {
    cachedIP = await getPublicIP();
  }

  await sendHeartbeat();

  // Update IP separately if we have it (don't block heartbeat on IP fetch)
  if (cachedIP) {
    try {
      await connectToDatabase();
      const { Server } = await import("@/database/models/server.model");
      await Server.updateOne({ serverId: SERVER_ID }, { $set: { ip: cachedIP } });
    } catch {
      // Ignore IP update failures
    }
  }
}

/**
 * Start the heartbeat service.
 * Safe to call multiple times - only starts once.
 */
export function startHeartbeat(): void {
  if (heartbeatStarted) return;
  heartbeatStarted = true;

  console.log(
    `[Heartbeat] Starting server heartbeat (ID: ${SERVER_ID}, Role: ${IS_PRIMARY ? "primary" : "secondary"})`,
  );

  // Send first heartbeat immediately
  sendHeartbeatWithIP().catch(() => {});

  // Then every 30 seconds
  heartbeatTimer = setInterval(() => {
    sendHeartbeatWithIP().catch(() => {});
  }, HEARTBEAT_INTERVAL);

  // Don't block process exit
  if (heartbeatTimer.unref) {
    heartbeatTimer.unref();
  }
}

/**
 * Stop the heartbeat service
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  heartbeatStarted = false;
}
