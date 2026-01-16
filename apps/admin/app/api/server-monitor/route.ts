import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PM2Process {
  name: string;
  pid: number;
  pm_id: number;
  monit: {
    memory: number;
    cpu: number;
  };
  pm2_env: {
    status: string;
    pm_uptime: number;
    restart_time: number;
  };
}

async function getPM2Processes(): Promise<PM2Process[]> {
  try {
    const { stdout } = await execAsync('pm2 jlist', { timeout: 5000 });
    const processes = JSON.parse(stdout);
    return processes;
  } catch (error) {
    console.error('Error getting PM2 processes:', error);
    return [];
  }
}

async function getWebSocketConnections(): Promise<{ connections: number; subscribedSymbols: number }> {
  try {
    // The WebSocket server runs on WEBSOCKET_PORT (default 3003) internally
    // Use localhost to access the internal HTTP /stats endpoint
    const wsPort = process.env.WEBSOCKET_PORT || '3003';
    const statsUrl = `http://localhost:${wsPort}/stats`;
    
    const response = await fetch(statsUrl, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000) 
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        connections: data.connections || 0,
        subscribedSymbols: data.subscribedSymbols || 0,
      };
    }
    console.log(`[Server Monitor] WebSocket stats fetch failed: ${response.status}`);
    return { connections: 0, subscribedSymbols: 0 };
  } catch (error) {
    // If we can't reach the websocket server, return 0
    console.log(`[Server Monitor] WebSocket stats error:`, error instanceof Error ? error.message : error);
    return { connections: 0, subscribedSymbols: 0 };
  }
}

export async function GET() {
  try {
    // Get PM2 process stats
    const pm2Processes = await getPM2Processes();
    
    // Get WebSocket connection stats
    const wsStats = await getWebSocketConnections();
    
    // Get system stats
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    const processes = pm2Processes.map((proc) => ({
      name: proc.name,
      pid: proc.pid,
      status: proc.pm2_env?.status || 'unknown',
      cpu: proc.monit?.cpu || 0,
      memory: proc.monit?.memory || 0,
      memoryMB: (proc.monit?.memory || 0) / (1024 * 1024),
      uptime: proc.pm2_env?.pm_uptime 
        ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000)
        : 0,
      restarts: proc.pm2_env?.restart_time || 0,
    }));

    const systemStats = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemory: Math.round(totalMemory / (1024 * 1024 * 1024) * 100) / 100, // GB
      freeMemory: Math.round(freeMemory / (1024 * 1024 * 1024) * 100) / 100, // GB
      usedMemory: Math.round(usedMemory / (1024 * 1024 * 1024) * 100) / 100, // GB
      memoryUsagePercent: (usedMemory / totalMemory) * 100,
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
    };

    return NextResponse.json({
      processes,
      system: systemStats,
      websocket: wsStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Server monitor error:', error);
    return NextResponse.json(
      { error: 'Failed to get server stats' },
      { status: 500 }
    );
  }
}
