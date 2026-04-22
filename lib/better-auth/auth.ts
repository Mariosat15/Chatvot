import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { twoFactor } from "better-auth/plugins";
import { connectToDatabase } from "@/database/mongoose";
import { nextCookies } from "better-auth/next-js";
import { validateEnvironment } from "@/lib/utils/validate-env";
import { sendTwoFactorOTP } from "@/lib/nodemailer/send-two-factor-otp";
import bcrypt from "bcryptjs";

let authInstance: ReturnType<typeof betterAuth> | null = null;
let authInitPromise: Promise<ReturnType<typeof betterAuth>> | null = null;
let envValidated = false;

export const getAuth = async (): Promise<ReturnType<typeof betterAuth>> => {
  if (authInstance) return authInstance;

  // Validate environment on first auth initialization
  if (!envValidated) {
    validateEnvironment();
    envValidated = true;
  }

  // Prevent multiple simultaneous initialization attempts
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    try {
      const mongoose = await connectToDatabase();
      const db = mongoose.connection.db;

      if (!db) throw new Error("MongoDB connection not found");

      authInstance = betterAuth({
        // Reason: mongodbAdapter accepts Db but the mongoose native driver's
        // type shape differs slightly from the one shipped with better-auth.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        database: mongodbAdapter(db as any),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL,
        // Reason: appName is used by the twoFactor plugin as the TOTP issuer
        // shown inside authenticator apps (Google Authenticator, 1Password, etc.).
        appName: "ChartVolt",
        emailAndPassword: {
          enabled: true,
          disableSignUp: false,
          requireEmailVerification: false,
          minPasswordLength: 8,
          maxPasswordLength: 128,
          autoSignIn: true,
          // Use bcrypt to match API server's password hashing
          // API server uses bcryptjs with 12 rounds for non-blocking hashing
          password: {
            hash: async (password) => {
              return await bcrypt.hash(password, 12);
            },
            verify: async ({ hash, password }) => {
              return await bcrypt.compare(password, hash);
            },
          },
        },
        plugins: [
          // Reason: Enables TOTP-based 2FA with authenticator apps, backup
          // codes, and an email-OTP fallback channel. The plugin creates its
          // own collection to store encrypted TOTP secrets and backup codes
          // — no custom schema work required. Ordered before nextCookies()
          // so verification cookies are handled by the Next.js integration.
          twoFactor({
            issuer: "ChartVolt",
            otpOptions: {
              async sendOTP({ user, otp }) {
                await sendTwoFactorOTP({
                  email: user.email,
                  name: user.name,
                  otp,
                });
              },
            },
          }),
          nextCookies(),
        ],
      });

      return authInstance;
    } catch (error) {
      authInitPromise = null; // Reset promise on failure to allow retry
      throw error;
    }
  })();

  return authInitPromise;
};

// Helper function to create a recursive proxy that handles nested property access
// This allows lazy initialization while maintaining the auth.api.getSession() pattern
function createLazyAuthProxy(): ReturnType<typeof betterAuth> {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      // Return a proxy that either:
      // 1. Returns a function that initializes auth and calls the method
      // 2. Returns another proxy for nested access (e.g., auth.api)
      return new Proxy(function () {}, {
        // Handle function calls like auth.api.getSession()
        apply: async (_target, _thisArg, args) => {
          const instance = await getAuth();
          const value = (instance as Record<string, unknown>)[prop as string];
          if (typeof value === "function") {
            return value.apply(instance, args);
          }
          throw new Error(`${String(prop)} is not a function`);
        },
        // Handle nested property access like auth.api
        get: (_target, nestedProp) => {
          return new Proxy(function () {}, {
            apply: async (_target, _thisArg, args) => {
              const instance = await getAuth();
              const parent = (
                instance as unknown as Record<string, Record<string, unknown>>
              )[prop as string];
              if (
                parent &&
                typeof parent[nestedProp as string] === "function"
              ) {
                return (
                  parent[nestedProp as string] as (
                    ...args: unknown[]
                  ) => unknown
                ).apply(parent, args);
              }
              throw new Error(
                `${String(prop)}.${String(nestedProp)} is not a function`,
              );
            },
          });
        },
      });
    },
  };

  return new Proxy({}, handler) as ReturnType<typeof betterAuth>;
}

// Export a lazy proxy that initializes the auth instance on first method call
// This prevents connection issues from blocking module initialization
export const auth = createLazyAuthProxy();
