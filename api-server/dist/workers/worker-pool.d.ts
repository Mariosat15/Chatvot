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
declare class BcryptWorkerPool {
    private workers;
    private taskQueue;
    private pendingTasks;
    private taskIdCounter;
    private isShuttingDown;
    private initialized;
    private poolSize;
    constructor();
    /**
     * Initialize the worker pool
     */
    initialize(): void;
    /**
     * Create a new worker
     */
    private createWorker;
    /**
     * Process queued tasks
     */
    private processQueue;
    /**
     * Execute a task on the worker pool
     */
    private executeTask;
    /**
     * Hash a password using bcrypt (non-blocking)
     */
    hashPassword(password: string, rounds?: number): Promise<string>;
    /**
     * Compare a password with a hash (non-blocking)
     */
    comparePassword(password: string, hash: string): Promise<boolean>;
    /**
     * Get pool statistics
     */
    getStats(): {
        poolSize: number;
        initialized: boolean;
        activeWorkers: number;
        idleWorkers: number;
        queuedTasks: number;
        pendingTasks: number;
    };
    /**
     * Shutdown the worker pool
     */
    shutdown(): Promise<void>;
}
export declare const bcryptPool: BcryptWorkerPool;
export declare const hashPassword: (password: string, rounds?: number) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export {};
//# sourceMappingURL=worker-pool.d.ts.map