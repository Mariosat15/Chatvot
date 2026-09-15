import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      ".next",
      "apps",
      "dist",
      /**
       * The cross-process end-to-end round, which has its own config and its own npm script.
       *
       * Reason it is excluded rather than merely slow: it starts a real `games-service` process,
       * which needs `games-service/node_modules` - a separate install by design, since the service
       * shares no dependencies with this repository. Left in, a fresh clone fails the WHOLE suite
       * on a missing module and it reads as the platform being broken. See `vitest.e2e.config.ts`
       * for the other two reasons and `npm run test:e2e-round` to run it.
       */
      "__tests__/games/end-to-end-round.test.ts",
    ],
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
      /**
       * ADMIN-ONLY MODULES AN ADMIN ROUTE UNDER TEST REACHES THROUGH `@`.
       *
       * Reason: `@` maps to the repository ROOT here, because almost everything under test is
       * main-app code and every mirrored model resolves to the root copy. An admin API route
       * imported into a test resolves its own `@/lib/admin/...` against that root and fails,
       * even when the test mocks it - Vitest keys a mock by resolved id, so an unresolvable
       * specifier throws while the route module is still being loaded.
       *
       * Listed ONE MODULE AT A TIME rather than mapping `@/lib/admin/*` wholesale. A wildcard
       * would silently resolve any admin-only module a main-app file reaches for, which is
       * exactly the R58 / R75 class of build failure that only `next build` can see - the
       * suite would go green on an app that cannot be built at all.
       *
       * More specific entries must stay ABOVE `@`: Vite tries aliases in order.
       */
      "@/lib/admin/section-route-guard": path.resolve(
        __dirname,
        "apps/admin/lib/admin/section-route-guard.ts",
      ),
      /**
       * The admin terminology context, reached by every game contest screen X6.5 tokenised.
       *
       * Reason it is needed at all: the structural suites read these components as TEXT and so
       * never resolve the import, but `provider-contest-schedule-and-prizes.test.ts` imports
       * `PrizeDistributionEditor` for real. The moment a noun on it became a token, that suite
       * stopped LOADING - `Cannot find module`, zero tests, which reads as the suite being
       * broken rather than as one import being unresolvable. Note the shape of the failure:
       * `next build` resolves this specifier correctly against the admin tsconfig, so the
       * typecheck, the lint and the app were all fine and only the harness could see it. That
       * is R58 from the opposite direction, and it is why the alias is the fix rather than
       * rewriting fourteen imports to relative paths - the aliased form is what the app uses.
       *
       * THE TRAP THIS CARRIES INTO X7, pinned by a test rather than left as a comment: there is
       * no main-app `contexts/TerminologyContext` today, which is the only reason this entry is
       * unambiguous. X7 delivers tokens to the PLAYER screens and is the obvious moment one
       * appears - at which point every main-app file importing it would resolve here, to the
       * admin copy, in tests only. See `__tests__/admin/terminology-delivery.test.ts`.
       */
      "@/contexts/TerminologyContext": path.resolve(
        __dirname,
        "apps/admin/contexts/TerminologyContext.tsx",
      ),
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
