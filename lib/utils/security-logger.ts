/**
 * Security Logger Utility
 * 
 * Logs all security-relevant API requests for auditing
 * Automatically sanitizes sensitive data before logging
 */

import { NextRequest } from 'next/server';
import { getClientIP } from './rate-limiter';

// Fields to never log (sensitive data)
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'iban',
  'swiftBic',
  'swift_bic',
  'secretKey',
  'secret_key',
  'privateKey',
  'private_key',
  'sessionToken',
  'session_token',
  'checksum',
];

/**
 * Sanitize request body by removing sensitive fields
 */
function sanitizeBody(body: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
  if (!body) return undefined;
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(body)) {
    // Check if key contains any sensitive field name
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeBody(value as Record<string, unknown>);
    } else if (typeof value === 'string' && value.length > 200) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 200) + '...[truncated]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Determine the category from the endpoint
 */
function getCategoryFromEndpoint(endpoint: string): 'deposit' | 'withdrawal' | 'auth' | 'admin' | 'wallet' | 'kyc' | 'other' {
  const lower = endpoint.toLowerCase();
  
  if (lower.includes('/deposit') || lower.includes('/open-order') || lower.includes('/payment')) {
    return 'deposit';
  }
  if (lower.includes('/withdraw')) {
    return 'withdrawal';
  }
  if (lower.includes('/auth') || lower.includes('/sign-in') || lower.includes('/sign-up') || lower.includes('/login')) {
    return 'auth';
  }
  if (lower.includes('/admin')) {
    return 'admin';
  }
  if (lower.includes('/wallet') || lower.includes('/credit')) {
    return 'wallet';
  }
  if (lower.includes('/kyc') || lower.includes('/veriff')) {
    return 'kyc';
  }
  
  return 'other';
}

export interface LogRequestParams {
  request: NextRequest;
  userId?: string;
  userEmail?: string;
  body?: Record<string, unknown>;
  statusCode: number;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;
  rateLimitRemaining?: number;
  rateLimitExceeded?: boolean;
}

/**
 * Log a security-relevant request
 * Call this at the end of API handlers
 */
export async function logSecurityRequest(params: LogRequestParams): Promise<void> {
  try {
    // Dynamic import to avoid issues with server components
    const { connectToDatabase } = await import('@/database/mongoose');
    const SecurityLog = (await import('@/database/models/security-log.model')).default;
    
    await connectToDatabase();
    
    const endpoint = new URL(params.request.url).pathname;
    const method = params.request.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    const ipAddress = getClientIP(params.request);
    const userAgent = params.request.headers.get('user-agent') || undefined;
    
    // Get query params
    const url = new URL(params.request.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      // Don't log sensitive query params
      if (!SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        queryParams[key] = value;
      }
    });
    
    await SecurityLog.logRequest({
      userId: params.userId,
      userEmail: params.userEmail,
      ipAddress,
      userAgent,
      method,
      endpoint,
      category: getCategoryFromEndpoint(endpoint),
      requestBody: sanitizeBody(params.body),
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      statusCode: params.statusCode,
      responseTime: params.responseTimeMs,
      success: params.success,
      errorMessage: params.errorMessage,
      rateLimitRemaining: params.rateLimitRemaining,
      rateLimitExceeded: params.rateLimitExceeded || false,
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log security request:', error);
  }
}

/**
 * Helper to create a timed logger
 * Usage:
 *   const logger = createSecurityLogger(request);
 *   // ... handle request ...
 *   await logger.log({ statusCode: 200, success: true });
 */
export function createSecurityLogger(request: NextRequest) {
  const startTime = Date.now();
  
  return {
    log: async (params: Omit<LogRequestParams, 'request' | 'responseTimeMs'>) => {
      const responseTimeMs = Date.now() - startTime;
      await logSecurityRequest({
        ...params,
        request,
        responseTimeMs,
      });
    },
  };
}

/**
 * Middleware-style wrapper for API handlers
 * Automatically logs the request after the handler completes
 */
export function withSecurityLogging<T>(
  handler: (request: NextRequest, context?: T) => Promise<Response>
) {
  return async (request: NextRequest, context?: T): Promise<Response> => {
    const startTime = Date.now();
    let response: Response;
    let errorMessage: string | undefined;
    
    try {
      response = await handler(request, context);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      response = new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const responseTimeMs = Date.now() - startTime;
    
    // Log asynchronously without blocking the response
    logSecurityRequest({
      request,
      statusCode: response.status,
      success: response.status >= 200 && response.status < 400,
      errorMessage,
      responseTimeMs,
    }).catch(console.error);
    
    return response;
  };
}

