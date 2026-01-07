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
  currentTaskId: string | null; // Track which task this worker is processing
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
    // Don't initialize if already initialized or if shutting down
    if (this.initialized || this.isShuttingDown) return;
    
    console.log(`🔧 Initializing bcrypt worker pool with ${this.poolSize} workers...`);

    let successCount = 0;
    for (let i = 0; i < this.poolSize; i++) {
      if (this.createWorker()) {
        successCount++;
      }
    }

    this.initialized = true;
    
    if (successCount === 0) {
      console.error(`❌ Bcrypt worker pool failed to create any workers! Password operations will fail.`);
    } else if (successCount < this.poolSize) {
      console.warn(`⚠️ Bcrypt worker pool partially initialized (${successCount}/${this.poolSize} workers)`);
    } else {
      console.log(`✅ Bcrypt worker pool ready (${this.poolSize} workers)`);
    }
  }

  /**
   * Create a new worker
   * Returns true if worker was created successfully, false otherwise
   */
  private createWorker(): boolean {
    // Don't create workers during shutdown
    if (this.isShuttingDown) return false;
    
    try {
      // Detect if running from compiled dist/ folder (same method as index.ts)
      // Use path.sep to check for exact 'dist' folder (not substring like 'distributed')
      const isCompiledBuild = __dirname.split(path.sep).includes('dist');
      
      // Use compiled JS in dist/, TS in source
      const workerPath = isCompiledBuild
        ? path.join(__dirname, 'bcrypt.worker.js')
        : path.join(__dirname, 'bcrypt.worker.ts');

      const worker = new Worker(workerPath, {
        // Use tsx for TypeScript in development (non-compiled)
        execArgv: isCompiledBuild 
          ? undefined
          : ['--require', 'tsx/cjs'],
      });

      const workerInfo: WorkerInfo = { worker, busy: false, currentTaskId: null };

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
      workerInfo.currentTaskId = null;
      this.processQueue();
    });

    worker.on('error', (error) => {
      console.error('❌ Worker error:', error);
      
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
          } catch (recreateError) {
            console.error('❌ Failed to recreate worker after error:', recreateError);
            // Don't crash the server - gracefully degrade with fewer workers
          }
        }
      }
    });

    worker.on('exit', (code) => {
      // Skip cleanup only during intentional shutdown
      if (this.isShuttingDown) return;
      
      // Handle any exit (code 0 or non-zero) during normal operation
      if (code !== 0) {
        console.warn(`⚠️ Worker exited with code ${code}, recreating...`);
      } else {
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
        } catch (recreateError) {
          console.error('❌ Failed to recreate worker after exit:', recreateError);
          // Don't crash the server - gracefully degrade with fewer workers
        }
      }
    });

    this.workers.push(workerInfo);
    return true;
    
    } catch (error) {
      console.error('❌ Failed to create worker:', error);
      // Don't crash the server - gracefully degrade
      return false;
    }
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    // Don't process queue during shutdown
    if (this.isShuttingDown) return;
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;

    const { message, task } = this.taskQueue.shift()!;
    availableWorker.busy = true;
    availableWorker.currentTaskId = task.id;
    this.pendingTasks.set(task.id, task);
    availableWorker.worker.postMessage(message);
  }

  /**
   * Execute a task on the worker pool
   */
  private async executeTask<T>(type: string, data: any): Promise<T> {
    // Reject immediately if shutting down
    if (this.isShuttingDown) {
      return Promise.reject(new Error('Worker pool is shutting down'));
    }
    
    // Lazy initialization
    if (!this.initialized) {
      this.initialize();
    }

    return new Promise<T>((resolve, reject) => {
      // Double-check shutdown state inside promise (race condition guard)
      if (this.isShuttingDown) {
        reject(new Error('Worker pool is shutting down'));
        return;
      }
      
      const id = `${Date.now()}-${++this.taskIdCounter}`;
      const task: PendingTask = { id, resolve, reject };

      const message = { type, id, ...data };

      const availableWorker = this.workers.find(w => !w.busy);
      
      if (availableWorker) {
        availableWorker.busy = true;
        availableWorker.currentTaskId = id;
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
    
    const shutdownError = new Error('Worker pool is shutting down');
    
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
    await Promise.all(
      this.workers.map(({ worker }) => worker.terminate())
    );

    // Clear all collections
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

