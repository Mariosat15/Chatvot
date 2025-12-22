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
     */
    initialize() {
        if (this.initialized)
            return;
        console.log(`🔧 Initializing bcrypt worker pool with ${this.poolSize} workers...`);
        for (let i = 0; i < this.poolSize; i++) {
            this.createWorker();
        }
        this.initialized = true;
        console.log(`✅ Bcrypt worker pool ready (${this.poolSize} workers)`);
    }
    /**
     * Create a new worker
     */
    createWorker() {
        // Use compiled JS in production, TS in development
        const workerPath = process.env.NODE_ENV === 'production'
            ? path_1.default.join(__dirname, 'bcrypt.worker.js')
            : path_1.default.join(__dirname, 'bcrypt.worker.ts');
        const worker = new worker_threads_1.Worker(workerPath, {
            // Use ts-node/register for TypeScript in development
            execArgv: process.env.NODE_ENV !== 'production'
                ? ['--require', 'tsx/cjs']
                : undefined,
        });
        const workerInfo = { worker, busy: false };
        worker.on('message', (result) => {
            const task = this.pendingTasks.get(result.id);
            if (task) {
                this.pendingTasks.delete(result.id);
                if (result.success) {
                    task.resolve(result.result);
                }
                else {
                    task.reject(new Error(result.error || 'Worker task failed'));
                }
            }
            workerInfo.busy = false;
            this.processQueue();
        });
        worker.on('error', (error) => {
            console.error('❌ Worker error:', error);
            workerInfo.busy = false;
            // Remove and recreate worker
            const index = this.workers.indexOf(workerInfo);
            if (index !== -1) {
                this.workers.splice(index, 1);
                if (!this.isShuttingDown) {
                    this.createWorker();
                }
            }
        });
        worker.on('exit', (code) => {
            if (code !== 0 && !this.isShuttingDown) {
                console.warn(`⚠️ Worker exited with code ${code}, recreating...`);
                const index = this.workers.indexOf(workerInfo);
                if (index !== -1) {
                    this.workers.splice(index, 1);
                    this.createWorker();
                }
            }
        });
        this.workers.push(workerInfo);
    }
    /**
     * Process queued tasks
     */
    processQueue() {
        if (this.taskQueue.length === 0)
            return;
        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker)
            return;
        const { message, task } = this.taskQueue.shift();
        availableWorker.busy = true;
        this.pendingTasks.set(task.id, task);
        availableWorker.worker.postMessage(message);
    }
    /**
     * Execute a task on the worker pool
     */
    async executeTask(type, data) {
        // Lazy initialization
        if (!this.initialized) {
            this.initialize();
        }
        return new Promise((resolve, reject) => {
            const id = `${Date.now()}-${++this.taskIdCounter}`;
            const task = { id, resolve, reject };
            const message = { type, id, ...data };
            const availableWorker = this.workers.find(w => !w.busy);
            if (availableWorker) {
                availableWorker.busy = true;
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
        return this.executeTask('hash', { password, rounds });
    }
    /**
     * Compare a password with a hash (non-blocking)
     */
    async comparePassword(password, hash) {
        return this.executeTask('compare', { password, hash });
    }
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            poolSize: this.poolSize,
            initialized: this.initialized,
            activeWorkers: this.workers.filter(w => w.busy).length,
            idleWorkers: this.workers.filter(w => !w.busy).length,
            queuedTasks: this.taskQueue.length,
            pendingTasks: this.pendingTasks.size,
        };
    }
    /**
     * Shutdown the worker pool
     */
    async shutdown() {
        this.isShuttingDown = true;
        console.log('🛑 Shutting down worker pool...');
        await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
        this.workers = [];
        this.taskQueue = [];
        this.pendingTasks.clear();
        this.initialized = false;
        console.log('✅ Worker pool shut down');
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