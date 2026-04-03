"use strict";
/**
 * Authentication Middleware for API Server
 *
 * Verifies JWT tokens and attaches user to request.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.optionalAuth = optionalAuth;
exports.getSessionUser = getSessionUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Safely extract Authorization header value
 * HTTP spec allows multiple headers with same name, resulting in string[]
 * This prevents TypeError when calling .split() on an array
 */
function getAuthorizationHeader(req) {
    const authHeader = req.headers["authorization"];
    // Handle array case (multiple Authorization headers sent)
    if (Array.isArray(authHeader)) {
        return authHeader[0]; // Use first header
    }
    return authHeader;
}
/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req) {
    const authHeader = getAuthorizationHeader(req);
    if (!authHeader || typeof authHeader !== "string") {
        return null;
    }
    // Expected format: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
        return null;
    }
    return parts[1];
}
// SECURITY: No fallback - must be configured via environment
function getJwtSecret() {
    const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error("CRITICAL: JWT_SECRET or BETTER_AUTH_SECRET must be set. " +
            "Without a secret, authentication is disabled for security.");
    }
    return secret;
}
/**
 * Verify JWT token and attach user to request
 */
function authenticateToken(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({ error: "Token expired" });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        res.status(500).json({ error: "Authentication failed" });
    }
}
/**
 * Optional authentication - doesn't fail if no token
 */
function optionalAuth(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
        req.user = decoded;
    }
    catch {
        // Token invalid, but don't fail - just continue without user
    }
    next();
}
/**
 * Get user ID from session cookie (for Next.js auth compatibility)
 */
async function getSessionUser(sessionToken) {
    // This would look up the session in the database
    // For now, we'll use JWT tokens passed in Authorization header
    return null;
}
//# sourceMappingURL=auth.js.map