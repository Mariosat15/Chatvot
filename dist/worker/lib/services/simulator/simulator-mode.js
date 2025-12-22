"use strict";
/**
 * Simulator Mode Utilities
 *
 * Helpers for detecting simulator mode in API requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSimulatorRequest = isSimulatorRequest;
exports.getSimulatorUserId = getSimulatorUserId;
exports.isSimulatorEnabled = isSimulatorEnabled;
exports.createSimulatorHeaders = createSimulatorHeaders;
exports.requireSimulatorEnabled = requireSimulatorEnabled;
/**
 * Check if the request is from the simulator
 */
function isSimulatorRequest(request) {
    return request.headers.get('X-Simulator-Mode') === 'true';
}
/**
 * Get the simulated user ID from request headers
 */
function getSimulatorUserId(request) {
    return request.headers.get('X-Simulator-User-Id');
}
/**
 * Check if we should allow simulator mode
 * Only enabled in development or when explicitly allowed
 */
function isSimulatorEnabled() {
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
function createSimulatorHeaders(userId) {
    const headers = {
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
function requireSimulatorEnabled() {
    if (!isSimulatorEnabled()) {
        throw new Error('Simulator mode is not enabled');
    }
}
