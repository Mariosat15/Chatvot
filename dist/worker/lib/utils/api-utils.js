"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTimeout = withTimeout;
exports.withOperationTimeout = withOperationTimeout;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.safeParseBody = safeParseBody;
exports.trackTiming = trackTiming;
exports.withCircuitBreaker = withCircuitBreaker;
const server_1 = require("next/server");
// =============================================================================
// API REQUEST TIMEOUT WRAPPER
// =============================================================================
/**
 * Default timeout for API requests (5 seconds)
 * Trading apps need fast responses - anything over 5s is a problem
 */
const DEFAULT_TIMEOUT_MS = 5000;
/**
 * Wraps an API handler with a timeout to prevent long-running requests
 * If the handler doesn't complete within the timeout, returns a 504 Gateway Timeout
 */
function withTimeout(handler, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return async (request) => {
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.error(`⏱️ API TIMEOUT: Request took longer than ${timeoutMs}ms`);
                resolve(server_1.NextResponse.json({ error: 'Request timeout - please try again' }, { status: 504 }));
            }, timeoutMs);
        });
        try {
            return await Promise.race([handler(request), timeoutPromise]);
        }
        catch (error) {
            console.error('API Error:', error);
            return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    };
}
/**
 * Wraps an async operation with a timeout
 * Useful for individual database operations within a handler
 */
async function withOperationTimeout(operation, timeoutMs = DEFAULT_TIMEOUT_MS, operationName = 'Operation') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    return Promise.race([operation(), timeoutPromise]);
}
// =============================================================================
// RESPONSE HELPERS
// =============================================================================
/**
 * Standard success response
 */
function successResponse(data, status = 200) {
    return server_1.NextResponse.json(data, { status });
}
/**
 * Standard error response with logging
 */
function errorResponse(message, status = 500, error) {
    if (error) {
        console.error(`API Error [${status}]:`, message, error);
    }
    return server_1.NextResponse.json({ error: message }, { status });
}
// =============================================================================
// REQUEST VALIDATION
// =============================================================================
/**
 * Safely parse JSON body with error handling
 */
async function safeParseBody(request) {
    try {
        return await request.json();
    }
    catch {
        return null;
    }
}
// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================
/**
 * Track request timing for performance monitoring
 */
function trackTiming(operationName) {
    const start = Date.now();
    return {
        /**
         * Log the elapsed time if it exceeds the threshold
         */
        end: (thresholdMs = 200) => {
            const elapsed = Date.now() - start;
            if (elapsed > thresholdMs) {
                console.warn(`⚠️ SLOW [${elapsed}ms]: ${operationName}`);
            }
            return elapsed;
        },
        /**
         * Get elapsed time without logging
         */
        elapsed: () => Date.now() - start,
    };
}
const circuitBreakers = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening
const CIRCUIT_BREAKER_RESET_MS = 30000; // 30 seconds
/**
 * Execute operation with circuit breaker pattern
 * Prevents cascading failures by stopping requests to failing services
 */
async function withCircuitBreaker(key, operation, fallback) {
    let state = circuitBreakers.get(key);
    if (!state) {
        state = { failures: 0, lastFailure: 0, isOpen: false };
        circuitBreakers.set(key, state);
    }
    // Check if circuit is open
    if (state.isOpen) {
        // Check if we should try again (reset period passed)
        if (Date.now() - state.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
            state.isOpen = false;
            state.failures = 0;
        }
        else {
            // Circuit is open - use fallback or throw
            if (fallback) {
                return fallback();
            }
            throw new Error(`Circuit breaker open for: ${key}`);
        }
    }
    try {
        const result = await operation();
        // Success - reset failures
        state.failures = 0;
        return result;
    }
    catch (error) {
        // Failure - increment counter
        state.failures++;
        state.lastFailure = Date.now();
        if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
            state.isOpen = true;
            console.error(`🔴 Circuit breaker OPEN for: ${key} (${state.failures} failures)`);
        }
        throw error;
    }
}
