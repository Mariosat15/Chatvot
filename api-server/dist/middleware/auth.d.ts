/**
 * Authentication Middleware for API Server
 *
 * Verifies JWT tokens and attaches user to request.
 */
import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name?: string;
    };
}
/**
 * Verify JWT token and attach user to request
 */
export declare function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Optional authentication - doesn't fail if no token
 */
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Get user ID from session cookie (for Next.js auth compatibility)
 */
export declare function getSessionUser(sessionToken: string): Promise<{
    id: string;
} | null>;
//# sourceMappingURL=auth.d.ts.map