/**
 * Health Check Routes
 * 
 * Used by load balancers and monitoring tools to check server status.
 */

import { Router, Request, Response } from 'express';
import { bcryptPool } from '../workers/worker-pool';
import { getConnectionStatus } from '../config/database';

const router = Router();

/**
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'chartvolt-api',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Detailed health check with dependencies
 */
router.get('/detailed', (req: Request, res: Response) => {
  const workerStats = bcryptPool.getStats();
  const dbConnected = getConnectionStatus();

  const status = dbConnected && workerStats.initialized ? 'healthy' : 'degraded';

  res.json({
    status,
    server: 'chartvolt-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    dependencies: {
      database: dbConnected ? 'connected' : 'disconnected',
      workerPool: workerStats,
    },
  });
});

/**
 * Readiness check (for Kubernetes/load balancers)
 */
router.get('/ready', (req: Request, res: Response) => {
  const dbConnected = getConnectionStatus();
  const workerStats = bcryptPool.getStats();

  if (dbConnected && workerStats.initialized) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ 
      ready: false,
      database: dbConnected,
      workers: workerStats.initialized,
    });
  }
});

/**
 * Liveness check (for Kubernetes)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;

