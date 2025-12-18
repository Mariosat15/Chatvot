import { betterAuth } from "better-auth";
import { mongodbAdapter} from "better-auth/adapters/mongodb";
import { connectToDatabase} from "@/database/mongoose";
import { nextCookies} from "better-auth/next-js";

let authInstance: ReturnType<typeof betterAuth> | null = null;
let authInitPromise: Promise<ReturnType<typeof betterAuth>> | null = null;

export const getAuth = async (): Promise<ReturnType<typeof betterAuth>> => {
    if(authInstance) return authInstance;

    // Prevent multiple simultaneous initialization attempts
    if (authInitPromise) return authInitPromise;

    authInitPromise = (async () => {
        try {
            const mongoose = await connectToDatabase();
            const db = mongoose.connection.db;

            if(!db) throw new Error('MongoDB connection not found');

            authInstance = betterAuth({
                database: mongodbAdapter(db as any),
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
                plugins: [nextCookies()],
            });

            return authInstance;
        } catch (error) {
            authInitPromise = null; // Reset promise on failure to allow retry
            throw error;
        }
    })();

    return authInitPromise;
}

// Helper function to create a recursive proxy that handles nested property access
// This allows lazy initialization while maintaining the auth.api.getSession() pattern
function createLazyAuthProxy(): ReturnType<typeof betterAuth> {
    const handler: ProxyHandler<object> = {
        get(_target, prop) {
            // Return a proxy that either:
            // 1. Returns a function that initializes auth and calls the method
            // 2. Returns another proxy for nested access (e.g., auth.api)
            return new Proxy(function() {}, {
                // Handle function calls like auth.api.getSession()
                apply: async (_target, _thisArg, args) => {
                    const instance = await getAuth();
                    const value = (instance as Record<string, unknown>)[prop as string];
                    if (typeof value === 'function') {
                        return value.apply(instance, args);
                    }
                    throw new Error(`${String(prop)} is not a function`);
                },
                // Handle nested property access like auth.api
                get: (_target, nestedProp) => {
                    return new Proxy(function() {}, {
                        apply: async (_target, _thisArg, args) => {
                            const instance = await getAuth();
                            const parent = (instance as unknown as Record<string, Record<string, unknown>>)[prop as string];
                            if (parent && typeof parent[nestedProp as string] === 'function') {
                                return (parent[nestedProp as string] as (...args: unknown[]) => unknown).apply(parent, args);
                            }
                            throw new Error(`${String(prop)}.${String(nestedProp)} is not a function`);
                        }
                    });
                }
            });
        }
    };

    return new Proxy({}, handler) as ReturnType<typeof betterAuth>;
}

// Export a lazy proxy that initializes the auth instance on first method call
// This prevents connection issues from blocking module initialization
export const auth = createLazyAuthProxy();
