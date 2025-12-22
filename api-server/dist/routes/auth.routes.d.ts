/**
 * Auth Routes - Handles registration and login with non-blocking bcrypt
 *
 * These are the CPU-intensive routes that benefit most from worker threads.
 * Registration: bcrypt.hash (300-500ms blocking → 0ms blocking)
 * Login: bcrypt.compare (100-300ms blocking → 0ms blocking)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=auth.routes.d.ts.map