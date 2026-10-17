/**
 * Keeps a test run away from any real database.
 *
 * Reason: on 1 Oct 2026 the admin Performance Simulator ran vitest on the production
 * server with the admin process's environment, so `MONGODB_URI` named the live Atlas
 * cluster. Tests that clear collections between cases then deleted live data - the admin
 * accounts, the trading symbols and the WhiteLabel settings (which also switched Redis
 * off, because its connection settings live there). Every test is written against the
 * in-memory replica set on 127.0.0.1, so a test run never has a legitimate reason to
 * reach anything else. The rule is therefore "loopback or nothing", checked wherever a
 * test could open or wipe a connection, not just in the runner that launched it.
 *
 * Model-free and dependency-free so both apps, the test setup file and the test helper
 * can all import it.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** True when we are inside a vitest worker. */
export function isTestRun(): boolean {
  return process.env.VITEST === "true" || process.env.VITEST === "1" || !!process.env.VITEST_WORKER_ID;
}

/**
 * True only when EVERY host in a `mongodb://` connection string is the local machine.
 * `mongodb+srv://` always resolves through DNS to a remote cluster, so it is never loopback.
 */
export function isLoopbackMongoUri(uri: string | undefined | null): boolean {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  const scheme = "mongodb://";
  if (trimmed.slice(0, scheme.length).toLowerCase() !== scheme) return false;
  const rest = trimmed.slice(scheme.length);
  const authorityEnd = [rest.indexOf("/"), rest.indexOf("?")].filter((i) => i >= 0);
  const authority = authorityEnd.length ? rest.slice(0, Math.min(...authorityEnd)) : rest;
  const hostList = authority.slice(authority.lastIndexOf("@") + 1);
  if (!hostList) return false;
  return hostList.split(",").every((entry) => {
    const host = entry.startsWith("[") ? entry.slice(0, entry.indexOf("]") + 1) : entry.split(":")[0];
    return LOOPBACK_HOSTS.has(host.toLowerCase()) || /^127\.\d+\.\d+\.\d+$/.test(host);
  });
}

/**
 * The environment a launched test process gets: the caller's, minus every way to reach
 * a real data store. Used by every place that starts vitest from a running server (the
 * admin Performance Simulator route and the worker's scheduled run).
 *
 * Reason: those launchers run on production, where `process.env` names the live cluster.
 * Dropped by NAME and by VALUE, because a connection string can sit under any key.
 */
export function testRunEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const kept = Object.entries(base).filter(([key, value]) => {
    const byName = /MONGO|REDIS|DATABASE_URL|_DB_URI/i.test(key);
    const byValue = !!value && /^(mongodb(\+srv)?|rediss?):\/\//i.test(value.trim());
    return !byName && !byValue;
  });
  return { ...Object.fromEntries(kept), NODE_ENV: "test" };
}

/**
 * Throws when a test run is about to use a database that is not on this machine.
 * Throwing is deliberate: a failed test is cheap, a deleted production collection is not.
 */
export function assertTestDatabaseIsLocal(uri: string | undefined | null, where: string): void {
  if (!isTestRun()) return;
  if (isLoopbackMongoUri(uri)) return;
  throw new Error(
    `❌ Refusing to use a non-local database inside a test run (${where}). ` +
      "Tests may only connect to the in-memory MongoDB server on 127.0.0.1.",
  );
}
