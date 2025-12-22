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

import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';

interface PendingTask {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
}

class BcryptWorkerPool {
  private workers: WorkerInfo[] = [];
  private taskQueue: Array<{ message: any; task: PendingTask }> = [];
  private pendingTasks = new Map<string, PendingTask>();
  private taskIdCounter = 0;
  private isShuttingDown = false;
  private initialized = false;

  // Pool size: Use half of CPU cores, min 2, max 8
  private poolSize = Math.min(Math.max(Math.floor(os.cpus().length / 2), 2), 8);

  constructor() {
    // Don't initialize in constructor - wait for first use or explicit init
  }

  /**
   * Initialize the worker pool
   */
  public initialize(): void {
    if (this.initialized) return;
    
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
  private createWorker(): void {
    // Use compiled JS in production, TS in development
    const workerPath = process.env.NODE_ENV === 'production'
      ? path.join(__dirname, 'bcrypt.worker.js')
      : path.join(__dirname, 'bcrypt.worker.ts');

    const worker = new Worker(workerPath, {
      // Use ts-node/register for TypeScript in development
      execArgv: process.env.NODE_ENV !== 'production' 
        ? ['--require', 'tsx/cjs']
        : undefined,
    });

    const workerInfo: WorkerInfo = { worker, busy: false };

    worker.on('message', (result: { id: string; success: boolean; result?: any; error?: string }) => {
      const task = this.pendingTasks.get(result.id);
      
      if (task) {
        this.pendingTasks.delete(result.id);
        
        if (result.success) {
          task.resolve(result.result);
        } else {
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
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;

    const { message, task } = this.taskQueue.shift()!;
    availableWorker.busy = true;
    this.pendingTasks.set(task.id, task);
    availableWorker.worker.postMessage(message);
  }

  /**
   * Execute a task on the worker pool
   */
  private async executeTask<T>(type: string, data: any): Promise<T> {
    // Lazy initialization
    if (!this.initialized) {
      this.initialize();
    }

    return new Promise<T>((resolve, reject) => {
      const id = `${Date.now()}-${++this.taskIdCounter}`;
      const task: PendingTask = { id, resolve, reject };

      const message = { type, id, ...data };

      const availableWorker = this.workers.find(w => !w.busy);
      
      if (availableWorker) {
        availableWorker.busy = true;
        this.pendingTasks.set(id, task);
        availableWorker.worker.postMessage(message);
      } else {
        // Queue the task
        this.taskQueue.push({ message, task });
      }
    });
  }

  /**
   * Hash a password using bcrypt (non-blocking)
   */
  public async hashPassword(password: string, rounds: number = 12): Promise<string> {
    return this.executeTask<string>('hash', { password, rounds });
  }

  /**
   * Compare a password with a hash (non-blocking)
   */
  public async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.executeTask<boolean>('compare', { password, hash });
  }

  /**
   * Get pool statistics
   */
  public getStats() {
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
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    console.log('🛑 Shutting down worker pool...');
    
    await Promise.all(
      this.workers.map(({ worker }) => worker.terminate())
    );

    this.workers = [];
    this.taskQueue = [];
    this.pendingTasks.clear();
    this.initialized = false;
    
    console.log('✅ Worker pool shut down');
  }
}

// Export singleton instance
export const bcryptPool = new BcryptWorkerPool();

// Convenience functions
export const hashPassword = (password: string, rounds?: number) => 
  bcryptPool.hashPassword(password, rounds);

export const comparePassword = (password: string, hash: string) => 
  bcryptPool.comparePassword(password, hash);

