"use strict";
/**
 * Health Check Routes
 *
 * Used by load balancers and monitoring tools to check server status.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const worker_pool_1 = require("../workers/worker-pool");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
/**
 * Basic health check
 */
router.get("/", (req, res) => {
    res.json({
        status: "healthy",
        server: "chartvolt-api",
        timestamp: new Date().toISOString(),
    });
});
/**
 * Detailed health check with dependencies
 */
router.get("/detailed", (req, res) => {
    const workerStats = worker_pool_1.bcryptPool.getStats();
    const dbConnected = (0, database_1.getConnectionStatus)();
    // Use isReady instead of initialized - isReady verifies workers.length > 0
    // initialized can be true even when zero workers were created
    const status = dbConnected && workerStats.isReady ? "healthy" : "degraded";
    res.json({
        status,
        server: "chartvolt-api",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: "MB",
        },
        dependencies: {
            database: dbConnected ? "connected" : "disconnected",
            workerPool: workerStats,
        },
    });
});
/**
 * Readiness check (for Kubernetes/load balancers)
 */
router.get("/ready", (req, res) => {
    const dbConnected = (0, database_1.getConnectionStatus)();
    const workerStats = worker_pool_1.bcryptPool.getStats();
    // Use isReady instead of initialized - isReady verifies workers.length > 0
    // initialized can be true even when zero workers were created
    if (dbConnected && workerStats.isReady) {
        res.status(200).json({ ready: true });
    }
    else {
        res.status(503).json({
            ready: false,
            database: dbConnected,
            workers: workerStats.isReady,
            workersInitialized: workerStats.initialized,
            totalWorkers: workerStats.totalWorkers,
        });
    }
});
/**
 * Liveness check (for Kubernetes)
 */
router.get("/live", (req, res) => {
    res.status(200).json({ alive: true });
});
exports.default = router;
//# sourceMappingURL=health.routes.js.map