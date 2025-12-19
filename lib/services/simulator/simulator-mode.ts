/**
 * Simulator Mode Utilities
 * 
 * Helpers for detecting simulator mode in API requests
 */

import { NextRequest } from 'next/server';

/**
 * Check if the request is from the simulator
 */
export function isSimulatorRequest(request: NextRequest): boolean {
  return request.headers.get('X-Simulator-Mode') === 'true';
}

/**
 * Get the simulated user ID from request headers
 */
export function getSimulatorUserId(request: NextRequest): string | null {
  return request.headers.get('X-Simulator-User-Id');
}

/**
 * Check if we should allow simulator mode
 * Only enabled in development or when explicitly allowed
 */
export function isSimulatorEnabled(): boolean {
  // Always allow in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Allow if explicitly enabled
  return process.env.ENABLE_SIMULATOR === 'true';
}

/**
 * Create headers for simulator requests
 */
export function createSimulatorHeaders(userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Simulator-Mode': 'true',
    'Content-Type': 'application/json',
  };
  
  if (userId) {
    headers['X-Simulator-User-Id'] = userId;
  }
  
  return headers;
}

/**
 * Validate that simulator mode is enabled
 * Throws error if not
 */
export function requireSimulatorEnabled(): void {
  if (!isSimulatorEnabled()) {
    throw new Error('Simulator mode is not enabled');
  }
}

