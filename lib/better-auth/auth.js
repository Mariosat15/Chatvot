"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.getAuth = void 0;
const better_auth_1 = require("better-auth");
const mongodb_1 = require("better-auth/adapters/mongodb");
const mongoose_1 = require("@/database/mongoose");
const next_js_1 = require("better-auth/next-js");
let authInstance = null;
let authInitPromise = null;
const getAuth = async () => {
    if (authInstance)
        return authInstance;
    // Prevent multiple simultaneous initialization attempts
    if (authInitPromise)
        return authInitPromise;
    authInitPromise = (async () => {
        try {
            const mongoose = await (0, mongoose_1.connectToDatabase)();
            const db = mongoose.connection.db;
            if (!db)
                throw new Error('MongoDB connection not found');
            authInstance = (0, better_auth_1.betterAuth)({
                database: (0, mongodb_1.mongodbAdapter)(db),
                secret: process.env.BETTER_AUTH_SECRET,
                baseURL: process.env.BETTER_AUTH_URL,
                emailAndPassword: {
                    enabled: true,
                    disableSignUp: false,
                    requireEmailVerification: false,
                    minPasswordLength: 8,
                    maxPasswordLength: 128,
                    autoSignIn: true,
                },
                plugins: [(0, next_js_1.nextCookies)()],
            });
            return authInstance;
        }
        catch (error) {
            authInitPromise = null; // Reset promise on failure to allow retry
            throw error;
        }
    })();
    return authInitPromise;
};
exports.getAuth = getAuth;
// Helper function to create a recursive proxy that handles nested property access
// This allows lazy initialization while maintaining the auth.api.getSession() pattern
function createLazyAuthProxy() {
    const handler = {
        get(_target, prop) {
            // Return a proxy that either:
            // 1. Returns a function that initializes auth and calls the method
            // 2. Returns another proxy for nested access (e.g., auth.api)
            return new Proxy(function () { }, {
                // Handle function calls like auth.api.getSession()
                apply: async (_target, _thisArg, args) => {
                    const instance = await (0, exports.getAuth)();
                    const value = instance[prop];
                    if (typeof value === 'function') {
                        return value.apply(instance, args);
                    }
                    throw new Error(`${String(prop)} is not a function`);
                },
                // Handle nested property access like auth.api
                get: (_target, nestedProp) => {
                    return new Proxy(function () { }, {
                        apply: async (_target, _thisArg, args) => {
                            const instance = await (0, exports.getAuth)();
                            const parent = instance[prop];
                            if (parent && typeof parent[nestedProp] === 'function') {
                                return parent[nestedProp].apply(parent, args);
                            }
                            throw new Error(`${String(prop)}.${String(nestedProp)} is not a function`);
                        }
                    });
                }
            });
        }
    };
    return new Proxy({}, handler);
}
// Export a lazy proxy that initializes the auth instance on first method call
// This prevents connection issues from blocking module initialization
exports.auth = createLazyAuthProxy();
//# sourceMappingURL=auth.js.map