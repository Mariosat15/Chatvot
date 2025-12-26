/**
 * Authentication Middleware for API Server
 * 
 * Verifies JWT tokens and attaches user to request.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// SECURITY: No fallback - must be configured via environment
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'CRITICAL: JWT_SECRET or BETTER_AUTH_SECRET must be set. ' +
      'Without a secret, authentication is disabled for security.'
    );
  }
  return secret;
}

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
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      name?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      name?: string;
    };
    req.user = decoded;
  } catch {
    // Token invalid, but don't fail - just continue without user
  }

  next();
}

/**
 * Get user ID from session cookie (for Next.js auth compatibility)
 */
export async function getSessionUser(sessionToken: string): Promise<{ id: string } | null> {
  // This would look up the session in the database
  // For now, we'll use JWT tokens passed in Authorization header
  return null;
}

