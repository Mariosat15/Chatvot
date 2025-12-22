/**
 * Bcrypt Worker Thread
 * 
 * Runs bcrypt hashing on a separate thread to avoid blocking the main event loop.
 * This is critical for performance - bcrypt is intentionally slow for security.
 * 
 * Without this: 100 registrations = 30+ seconds of blocking
 * With this: 100 registrations = handled in parallel, no blocking
 */

import { parentPort, workerData } from 'worker_threads';
import bcrypt from 'bcryptjs';

interface WorkerMessage {
  type: 'hash' | 'compare';
  id: string;
  password: string;
  hash?: string;
  rounds?: number;
}

interface WorkerResult {
  id: string;
  success: boolean;
  result?: string | boolean;
  error?: string;
}

if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    const result: WorkerResult = { id: message.id, success: false };

    try {
      if (message.type === 'hash') {
        const rounds = message.rounds || 12;
        const hash = await bcrypt.hash(message.password, rounds);
        result.success = true;
        result.result = hash;
      } else if (message.type === 'compare') {
        if (!message.hash) {
          throw new Error('Hash required for compare operation');
        }
        const isValid = await bcrypt.compare(message.password, message.hash);
        result.success = true;
        result.result = isValid;
      } else {
        throw new Error(`Unknown operation type: ${message.type}`);
      }
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    parentPort?.postMessage(result);
  });
}

