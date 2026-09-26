import { defineConfig } from "vitest/config";
import path from "path";

/**
 * The cross-process end-to-end suite, deliberately NOT part of `npm test`.
 *
 * WHY IT IS SEPARATE, WHICH IS A JUDGEMENT WORTH RECORDING RATHER THAN A CONVENIENCE
 * ---------------------------------------------------------------------------------
 * `__tests__/games/end-to-end-round.test.ts` starts a real `games-service` process, binds a port,
 * and takes about 75 seconds - because `circuit-sprint`'s duration is clamped to a 60-second floor
 * by the game's own config schema, so a sprint round cannot finish faster than that.
 *
 * Three reasons it does not belong in the default run, in order of how badly each would bite:
 *
 * 1. **It needs `games-service/node_modules`.** That is a separate install, on purpose - the
 *    service shares no code and no dependencies with this repository. In a fresh clone the suite
 *    would fail with a missing-module error, and it would read as "the platform is broken" rather
 *    than "the optional service is not installed".
 * 2. **It binds TCP port 4117.** Two runs at once, or a developer's own service on that port,
 *    fail for a reason that has nothing to do with the code under test.
 * 3. **The pre-push hook runs the suite.** Quadrupling that from ~25s to ~100s is how a team
 *    learns to reach for `--no-verify`, which costs more than this test buys.
 *
 * So it is opt-in and named: `npm run test:e2e-round`. It is the ONLY test that proves the two
 * halves agree - every other provider test runs against a stubbed `fetch` or the mock adapter -
 * so it must be run before any claim that a provider game works, and in CI on a schedule rather
 * than on every commit.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/games/end-to-end-round.test.ts"],
    // Generous, and not padding: the sprint's 60-second clock plus a sweeper tick plus settlement
    // is most of two minutes on a slow machine, and a timeout here would report as a hang.
    testTimeout: 300_000,
    hookTimeout: 180_000,
    // One file, one process, no parallelism - it owns a port and a child process.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    // Same reason as the root config: one Mongoose instance, or a transaction cannot be observed.
    dedupe: ["mongoose"],
  },
});
