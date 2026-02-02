"use strict";
/**
 * Bcrypt Worker Thread
 *
 * Runs bcrypt hashing on a separate thread to avoid blocking the main event loop.
 * This is critical for performance - bcrypt is intentionally slow for security.
 *
 * Without this: 100 registrations = 30+ seconds of blocking
 * With this: 100 registrations = handled in parallel, no blocking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
if (worker_threads_1.parentPort) {
    worker_threads_1.parentPort.on('message', async (message) => {
        const result = { id: message.id, success: false };
        try {
            if (message.type === 'hash') {
                const rounds = message.rounds || 12;
                const hash = await bcryptjs_1.default.hash(message.password, rounds);
                result.success = true;
                result.result = hash;
            }
            else if (message.type === 'compare') {
                if (!message.hash) {
                    throw new Error('Hash required for compare operation');
                }
                const isValid = await bcryptjs_1.default.compare(message.password, message.hash);
                result.success = true;
                result.result = isValid;
            }
            else {
                throw new Error(`Unknown operation type: ${message.type}`);
            }
        }
        catch (error) {
            result.success = false;
            result.error = error instanceof Error ? error.message : 'Unknown error';
        }
        worker_threads_1.parentPort?.postMessage(result);
    });
}
//# sourceMappingURL=bcrypt.worker.js.map