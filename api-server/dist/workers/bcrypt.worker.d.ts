/**
 * Bcrypt Worker Thread
 *
 * Runs bcrypt hashing on a separate thread to avoid blocking the main event loop.
 * This is critical for performance - bcrypt is intentionally slow for security.
 *
 * Without this: 100 registrations = 30+ seconds of blocking
 * With this: 100 registrations = handled in parallel, no blocking
 */
export {};
//# sourceMappingURL=bcrypt.worker.d.ts.map