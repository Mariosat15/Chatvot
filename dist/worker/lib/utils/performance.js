"use strict";
/**
 * Performance utilities for debouncing, throttling, and optimized patterns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERFORMANCE_INTERVALS = exports.IntervalManager = void 0;
exports.debounce = debounce;
exports.throttle = throttle;
exports.asyncThrottle = asyncThrottle;
exports.createVisibilityAwareInterval = createVisibilityAwareInterval;
exports.shallowEqual = shallowEqual;
exports.priceChanged = priceChanged;
exports.createBatchUpdater = createBatchUpdater;
/**
 * Debounce - delays execution until after wait milliseconds have elapsed since last call
 */
function debounce(func, wait) {
    let timeoutId = null;
    return function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
            timeoutId = null;
        }, wait);
    };
}
/**
 * Throttle - ensures function is called at most once per wait milliseconds
 */
function throttle(func, wait) {
    let lastTime = 0;
    let timeoutId = null;
    return function (...args) {
        const now = Date.now();
        const remaining = wait - (now - lastTime);
        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastTime = now;
            func.apply(this, args);
        }
        else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastTime = Date.now();
                timeoutId = null;
                func.apply(this, args);
            }, remaining);
        }
    };
}
/**
 * Async throttle - for async functions, ensures only one call is in flight at a time
 */
function asyncThrottle(func, wait) {
    let lastCall = 0;
    let pending = null;
    return async function (...args) {
        const now = Date.now();
        // If there's a pending call, skip
        if (pending)
            return;
        // If within throttle window, skip
        if (now - lastCall < wait)
            return;
        lastCall = now;
        pending = func.apply(this, args);
        try {
            await pending;
        }
        finally {
            pending = null;
        }
    };
}
/**
 * Interval manager - consolidates multiple intervals into one
 * Prevents memory leaks from orphaned intervals
 */
class IntervalManagerClass {
    constructor() {
        this.intervals = new Map();
        this.mainInterval = null;
        this.tickRate = 1000; // Check every second
    }
    register(id, callback, intervalMs) {
        this.intervals.set(id, {
            callback,
            interval: intervalMs,
            lastRun: 0,
        });
        // Start main interval if not running
        if (!this.mainInterval) {
            this.startMainLoop();
        }
    }
    unregister(id) {
        this.intervals.delete(id);
        // Stop main interval if no more callbacks
        if (this.intervals.size === 0 && this.mainInterval) {
            clearInterval(this.mainInterval);
            this.mainInterval = null;
        }
    }
    startMainLoop() {
        this.mainInterval = setInterval(() => {
            const now = Date.now();
            this.intervals.forEach((config, id) => {
                if (now - config.lastRun >= config.interval) {
                    config.lastRun = now;
                    try {
                        config.callback();
                    }
                    catch (error) {
                        console.error(`Interval callback error for ${id}:`, error);
                    }
                }
            });
        }, this.tickRate);
    }
    // Clear all intervals (useful for cleanup)
    clearAll() {
        this.intervals.clear();
        if (this.mainInterval) {
            clearInterval(this.mainInterval);
            this.mainInterval = null;
        }
    }
}
exports.IntervalManager = new IntervalManagerClass();
/**
 * Visibility-aware interval - pauses when tab is hidden
 */
function createVisibilityAwareInterval(callback, intervalMs) {
    let intervalId = null;
    let isRunning = false;
    const handleVisibilityChange = () => {
        if (document.hidden) {
            stop();
        }
        else if (isRunning) {
            start();
        }
    };
    const start = () => {
        isRunning = true;
        if (!document.hidden && !intervalId) {
            callback(); // Run immediately
            intervalId = setInterval(callback, intervalMs);
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);
    };
    const stop = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        isRunning = false;
    };
    return { start, stop };
}
/**
 * Shallow compare two objects
 */
function shallowEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (obj1[key] !== obj2[key])
            return false;
    }
    return true;
}
/**
 * Check if a price has meaningfully changed
 */
function priceChanged(oldPrice, newPrice, threshold = 0.00001) {
    if (!oldPrice)
        return true;
    return (Math.abs(oldPrice.bid - newPrice.bid) >= threshold ||
        Math.abs(oldPrice.ask - newPrice.ask) >= threshold);
}
/**
 * Batch state updates - collects multiple updates and applies them in one render
 */
function createBatchUpdater(setState, delay = 16 // ~1 frame at 60fps
) {
    let updates = [];
    let timeoutId = null;
    return (updater) => {
        updates.push(updater);
        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                setState((prev) => {
                    let result = prev;
                    for (const update of updates) {
                        result = update(result);
                    }
                    return result;
                });
                updates = [];
                timeoutId = null;
            }, delay);
        }
    };
}
/**
 * Performance timing constants - centralized for easy adjustment
 */
exports.PERFORMANCE_INTERVALS = {
    // Price updates
    PRICE_POLLING: 2000, // 2 seconds (was 1000)
    PRICE_UI_UPDATE: 500, // 500ms for UI smoothness
    // Status checks
    COMPETITION_STATUS: 10000, // 10 seconds (was 5 seconds)
    CHALLENGE_STATUS: 10000, // 10 seconds (was 5 seconds)
    CHALLENGE_LIVE_DATA: 5000, // 5 seconds (was 3 seconds)
    // Admin/Background
    NOTIFICATION_POLL: 60000, // 60 seconds (was 30 seconds)
    PRESENCE_HEARTBEAT: 30000, // 30 seconds (was 10 seconds)
    FRAUD_MONITORING: 60000, // 60 seconds (was 30 seconds)
    REDIS_STATS: 30000, // 30 seconds (was 10 seconds)
    WEBSOCKET_STATUS: 15000, // 15 seconds (was 5 seconds)
    // Dashboard
    DASHBOARD_REFRESH: 15000, // 15 seconds (was 10 seconds)
    LEADERBOARD_REFRESH: 5000, // 5 seconds
    // Countdowns - keep at 1 second for accuracy
    COUNTDOWN_UPDATE: 1000,
    // Margin checks - now formula-based (local calculation triggers server call)
    // These are only used as backup safety net intervals
    MARGIN_BACKUP_CHECK: 60000, // 60 seconds - backup check (primary is formula-based)
};
