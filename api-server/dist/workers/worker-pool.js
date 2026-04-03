"use strict";
/**
 * Worker Thread Pool
 *
 * Manages a pool of worker threads for CPU-intensive tasks.
 * Automatically scales based on CPU cores and queues tasks when all workers are busy.
 *
 * Usage:
 *   const hash = await workerPool.hashPassword('mypassword');
 *   const isValid = await workerPool.comparePassword('mypassword', hash);
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparePassword = exports.hashPassword = exports.bcryptPool = void 0;
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class BcryptWorkerPool {
    workers = [];
    taskQueue = [];
    pendingTasks = new Map();
    taskIdCounter = 0;
    isShuttingDown = false;
    initialized = false;
    // Pool size: Use half of CPU cores, min 2, max 8
    poolSize = Math.min(Math.max(Math.floor(os_1.default.cpus().length / 2), 2), 8);
    constructor() {
        // Don't initialize in constructor - wait for first use or explicit init
    }
    /**
     * Initialize the worker pool
     * Now async — waits briefly for workers to settle so we detect immediate crashes
     */
    async initialize() {
        // Don't initialize if already initialized or if shutting down
        if (this.initialized || this.isShuttingDown)
            return;
        console.log(`🔧 Initializing bcrypt worker pool with ${this.poolSize} workers...`);
        let spawnCount = 0;
        for (let i = 0; i < this.poolSize; i++) {
            if (this.createWorker()) {
                spawnCount++;
            }
        }
        if (spawnCount === 0) {
            console.error(`❌ Bcrypt worker pool failed to spawn any workers! Password operations will fail.`);
            this.initialized = true;
            return;
        }
        // Reason: Workers that crash due to missing files or import errors die asynchronously.
        // new Worker() succeeds synchronously, but the thread exits on the next event-loop tick.
        // We wait briefly so the "exit" handlers can fire and remove dead workers before we check.
        await new Promise((resolve) => setTimeout(resolve, 500));
        const aliveCount = this.workers.length;
        if (aliveCount === 0) {
            console.error(`❌ All ${spawnCount} workers crashed immediately after spawn!`);
            console.error(`   This usually means the compiled worker file is missing or has import errors.`);
            console.error(`   Run: cd api-server && npm run build`);
            this.initialized = true;
        }
        else if (aliveCount < this.poolSize) {
            this.initialized = true;
            console.warn(`⚠️ Bcrypt worker pool partially initialized (${aliveCount}/${this.poolSize} workers alive)`);
        }
        else {
            this.initialized = true;
            console.log(`✅ Bcrypt worker pool ready (${aliveCount} workers)`);
        }
    }
    /**
     * Create a new worker
     * Returns true if worker was created successfully, false otherwise
     */
    createWorker() {
        // Don't create workers during shutdown
        if (this.isShuttingDown)
            return false;
        try {
            // Detect if running from compiled dist/ folder (same method as index.ts)
            // Use path.sep to check for exact 'dist' folder (not substring like 'distributed')
            const isCompiledBuild = __dirname.split(path_1.default.sep).includes("dist");
            // Use compiled JS in dist/, TS in source
            const workerPath = isCompiledBuild
                ? path_1.default.join(__dirname, "bcrypt.worker.js")
                : path_1.default.join(__dirname, "bcrypt.worker.ts");
            const worker = new worker_threads_1.Worker(workerPath, {
                // Use tsx for TypeScript in development (non-compiled)
                execArgv: isCompiledBuild ? undefined : ["--require", "tsx/cjs"],
            });
            const workerInfo = {
                worker,
                busy: false,
                currentTaskId: null,
            };
            worker.on("message", (result) => {
                const task = this.pendingTasks.get(result.id);
                if (task) {
                    this.pendingTasks.delete(result.id);
                    if (result.success) {
                        task.resolve(result.result);
                    }
                    else {
                        task.reject(new Error(result.error || "Worker task failed"));
                    }
                }
                workerInfo.busy = false;
                workerInfo.currentTaskId = null;
                this.processQueue();
            });
            worker.on("error", (error) => {
                console.error("❌ Worker error:", error);
                // Reject the orphaned task if there was one
                if (workerInfo.currentTaskId) {
                    const orphanedTask = this.pendingTasks.get(workerInfo.currentTaskId);
                    if (orphanedTask) {
                        this.pendingTasks.delete(workerInfo.currentTaskId);
                        orphanedTask.reject(new Error(`Worker crashed: ${error.message}`));
                    }
                }
                workerInfo.busy = false;
                workerInfo.currentTaskId = null;
                // Remove and recreate worker
                const index = this.workers.indexOf(workerInfo);
                if (index !== -1) {
                    this.workers.splice(index, 1);
                    if (!this.isShuttingDown) {
                        try {
                            this.createWorker();
                            // Process any queued tasks with the new worker
                            this.processQueue();
                        }
                        catch (recreateError) {
                            console.error("❌ Failed to recreate worker after error:", recreateError);
                            // Don't crash the server - gracefully degrade with fewer workers
                        }
                    }
                }
            });
            worker.on("exit", (code) => {
                // Skip cleanup only during intentional shutdown
                if (this.isShuttingDown)
                    return;
                // Handle any exit (code 0 or non-zero) during normal operation
                if (code !== 0) {
                    console.warn(`⚠️ Worker exited with code ${code}, recreating...`);
                }
                else {
                    console.info(`ℹ️ Worker exited normally (code 0), recreating...`);
                }
                // Reject the orphaned task if there was one
                if (workerInfo.currentTaskId) {
                    const orphanedTask = this.pendingTasks.get(workerInfo.currentTaskId);
                    if (orphanedTask) {
                        this.pendingTasks.delete(workerInfo.currentTaskId);
                        orphanedTask.reject(new Error(`Worker exited unexpectedly with code ${code}`));
                    }
                }
                // Remove zombie workerInfo and recreate
                const index = this.workers.indexOf(workerInfo);
                if (index !== -1) {
                    this.workers.splice(index, 1);
                    try {
                        this.createWorker();
                        // Process any queued tasks with the new worker
                        this.processQueue();
                    }
                    catch (recreateError) {
                        console.error("❌ Failed to recreate worker after exit:", recreateError);
                        // Don't crash the server - gracefully degrade with fewer workers
                    }
                }
            });
            this.workers.push(workerInfo);
            return true;
        }
        catch (error) {
            console.error("❌ Failed to create worker:", error);
            // Don't crash the server - gracefully degrade
            return false;
        }
    }
    /**
     * Process queued tasks
     */
    processQueue() {
        // Don't process queue during shutdown
        if (this.isShuttingDown)
            return;
        if (this.taskQueue.length === 0)
            return;
        const availableWorker = this.workers.find((w) => !w.busy);
        if (!availableWorker)
            return;
        const { message, task } = this.taskQueue.shift();
        availableWorker.busy = true;
        availableWorker.currentTaskId = task.id;
        this.pendingTasks.set(task.id, task);
        availableWorker.worker.postMessage(message);
    }
    /**
     * Execute a task on the worker pool
     * Tasks have a 30-second timeout to prevent indefinite hanging
     */
    async executeTask(type, data) {
        // Reject immediately if shutting down
        if (this.isShuttingDown) {
            return Promise.reject(new Error("Worker pool is shutting down"));
        }
        // Lazy initialization
        if (!this.initialized) {
            await this.initialize();
        }
        // CRITICAL: Reject immediately if no workers are available (pool failed to initialize)
        if (this.workers.length === 0) {
            return Promise.reject(new Error("Worker pool has no available workers. Password operations cannot be performed."));
        }
        return new Promise((resolve, reject) => {
            // Double-check shutdown state inside promise (race condition guard)
            if (this.isShuttingDown) {
                reject(new Error("Worker pool is shutting down"));
                return;
            }
            const id = `${Date.now()}-${++this.taskIdCounter}`;
            // Set up timeout to prevent indefinite hanging
            const TASK_TIMEOUT_MS = 30000; // 30 seconds
            const timeoutId = setTimeout(() => {
                // Clean up the task if it's still pending
                if (this.pendingTasks.has(id)) {
                    this.pendingTasks.delete(id);
                    reject(new Error(`Worker task timed out after ${TASK_TIMEOUT_MS / 1000} seconds`));
                }
                // Also remove from queue if it's still there
                const queueIndex = this.taskQueue.findIndex((t) => t.task.id === id);
                if (queueIndex !== -1) {
                    this.taskQueue.splice(queueIndex, 1);
                    reject(new Error(`Worker task timed out in queue after ${TASK_TIMEOUT_MS / 1000} seconds`));
                }
            }, TASK_TIMEOUT_MS);
            const task = {
                id,
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                },
            };
            const message = { type, id, ...data };
            const availableWorker = this.workers.find((w) => !w.busy);
            if (availableWorker) {
                availableWorker.busy = true;
                availableWorker.currentTaskId = id;
                this.pendingTasks.set(id, task);
                availableWorker.worker.postMessage(message);
            }
            else {
                // Queue the task
                this.taskQueue.push({ message, task });
            }
        });
    }
    /**
     * Hash a password using bcrypt (non-blocking)
     */
    async hashPassword(password, rounds = 12) {
        return this.executeTask("hash", { password, rounds });
    }
    /**
     * Compare a password with a hash (non-blocking)
     */
    async comparePassword(password, hash) {
        return this.executeTask("compare", { password, hash });
    }
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            poolSize: this.poolSize,
            initialized: this.initialized,
            totalWorkers: this.workers.length,
            activeWorkers: this.workers.filter((w) => w.busy).length,
            idleWorkers: this.workers.filter((w) => !w.busy).length,
            queuedTasks: this.taskQueue.length,
            pendingTasks: this.pendingTasks.size,
            isReady: this.isReady(),
        };
    }
    /**
     * Check if the worker pool is ready to accept tasks
     * Returns true only if initialized AND has at least one worker
     */
    isReady() {
        return this.initialized && this.workers.length > 0 && !this.isShuttingDown;
    }
    /**
     * Shutdown the worker pool
     */
    async shutdown() {
        this.isShuttingDown = true;
        console.log("🛑 Shutting down worker pool...");
        const shutdownError = new Error("Worker pool is shutting down");
        // Reject all pending tasks (in-flight operations)
        for (const [taskId, task] of this.pendingTasks) {
            console.log(`   Rejecting pending task: ${taskId}`);
            task.reject(shutdownError);
        }
        // Reject all queued tasks (waiting operations)
        for (const { task } of this.taskQueue) {
            console.log(`   Rejecting queued task: ${task.id}`);
            task.reject(shutdownError);
        }
        // Terminate all workers
        await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
        // Clear all collections
        this.workers = [];
        this.taskQueue = [];
        this.pendingTasks.clear();
        this.initialized = false;
        console.log("✅ Worker pool shut down");
    }
}
// Export singleton instance
exports.bcryptPool = new BcryptWorkerPool();
// Convenience functions
const hashPassword = (password, rounds) => exports.bcryptPool.hashPassword(password, rounds);
exports.hashPassword = hashPassword;
const comparePassword = (password, hash) => exports.bcryptPool.comparePassword(password, hash);
exports.comparePassword = comparePassword;
//# sourceMappingURL=worker-pool.js.map