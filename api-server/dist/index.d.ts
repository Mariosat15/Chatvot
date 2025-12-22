/**
 * Chartvolt API Server
 *
 * Dedicated Express server for heavy API operations.
 * Runs separately from Next.js to avoid blocking UI rendering.
 *
 * Features:
 * - Worker threads for bcrypt (non-blocking password hashing)
 * - Gzip compression
 * - Rate limiting
 * - Security headers (Helmet)
 * - CORS configured for main app
 *
 * Port: 4000 (default)
 *
 * Usage:
 *   npm run dev     # Development with hot reload
 *   npm run build   # Build for production
 *   npm run start   # Production start
 */
export {};
//# sourceMappingURL=index.d.ts.map