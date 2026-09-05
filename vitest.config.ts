import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "apps", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/services/**", "lib/actions/**"],
      exclude: ["node_modules", ".next", "apps", "dist", "**/*.test.*"],
    },
    // Reason: Timeout increased for tests that touch DB or external services
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    /**
     * Forces ONE Mongoose instance across both apps, for tests only.
     *
     * Reason: `apps/admin` has its own `node_modules/mongoose`, so a file under `apps/admin`
     * resolving the bare specifier `mongoose` gets a DIFFERENT instance from the one a test
     * connects. The symptom is `Connection operation buffering timed out after 10000ms`,
     * which reads like a slow database rather than an unconnected one, and it is what made
     * admin actions untestable and left them covered only by tests that read their source.
     *
     * Deduping is the right tool rather than connecting the second instance: a session
     * belongs to a MongoClient, so two instances pointed at the same URI still cannot share
     * one transaction. Every model in the admin app resolves through `@` to the root copy
     * under test anyway, and `check:mirrors` is what proves the two copies agree - this only
     * makes the runtime single-instance so a transaction can be observed at all.
     */
    dedupe: ["mongoose"],
  },
});
