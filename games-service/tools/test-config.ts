/**
 * The boot-time configuration guards.
 *
 * WHAT THIS SUITE IS FOR
 * ----------------------
 * Two variables have a default that is right in development and dangerous in production, and
 * both fail INVISIBLY when left at it:
 *
 *   GAMES_PUBLIC_URL      launch URLs are built from it, so a localhost value sends every
 *                         player's iframe to their own machine
 *   GAMES_FRAME_ANCESTORS the CSP allowlist, so an unset value lets any site embed a live
 *                         round and overlay it
 *
 * Neither produces an error, a log line or a failed request. The player sees a blank rectangle
 * and the operator sees a healthy service. That is precisely the class this service's config
 * module exists to remove by refusing to boot, and until now these two were documented rather
 * than enforced.
 *
 * WHY THE PRODUCTION CARVE-OUT IS THE POINT, NOT A COMPROMISE
 * ---------------------------------------------------------
 * The guards must be inert without `NODE_ENV=production`, or they break the smoke tools, the
 * local rehearsal and every other suite here - all of which legitimately serve plain http on
 * loopback with no allowlist. So HALF THE TESTS BELOW ASSERT THAT NOTHING IS REFUSED, which is
 * as load-bearing as the refusals: a guard that fired in development would be reverted within
 * the day, and reverted guards protect nobody.
 *
 * WHY EVERY CASE RELOADS THE CONFIG
 * ---------------------------------
 * `loadConfig` caches on first read, because it is consulted on every request. A test that
 * forgot `resetConfigForTests` would read the previous case's answer and pass while asserting
 * nothing - so the helper below always resets, and the environment is restored afterwards
 * rather than left for the next case to inherit.
 */

import assert from "assert";

import { loadConfig, resetConfigForTests } from "../src/config";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failed++;
    const message = (error as Error).message.split("\n").slice(0, 3).join(" | ");
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${message}`);
  }
}

/**
 * The variables every case needs set, so a refusal under test is never confused with a refusal
 * about a missing secret. These are the ones `required()` enforces unconditionally.
 */
const SECRETS: Record<string, string> = {
  GAMES_MONGODB_URI: "mongodb://127.0.0.1:27017/",
  GAMES_API_KEY: "k".repeat(32),
  GAMES_API_SECRET: "s".repeat(32),
  GAMES_CALLBACK_TOKEN: "t".repeat(32),
  GAMES_CALLBACK_SECRET: "c".repeat(32),
};

/** The variables a case may vary. Absent from the map means "unset it". */
type Overrides = Partial<
  Record<"NODE_ENV" | "GAMES_PUBLIC_URL" | "GAMES_FRAME_ANCESTORS" | "PORT", string>
>;

const MANAGED = ["NODE_ENV", "GAMES_PUBLIC_URL", "GAMES_FRAME_ANCESTORS", "PORT"] as const;

/*
 * The two accessors below are the only places this file touches `process.env` by a computed
 * name, so `security/detect-object-injection` is answered once here rather than at seven call
 * sites. Every name reaching them comes from `SECRETS`, `MANAGED` or an `Overrides` key - all
 * string literals in this file - so none is reachable from input. Concentrating the access also
 * makes the restore in `loadUnder`'s `finally` provably symmetric with the setup.
 */

function readEnv(name: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection
  return process.env[name];
}

function writeEnv(name: string, value: string | undefined): void {
  // eslint-disable-next-line security/detect-object-injection
  if (value === undefined) delete process.env[name];
  // eslint-disable-next-line security/detect-object-injection
  else process.env[name] = value;
}

/**
 * Load the config under a given environment, then put the environment back.
 *
 * Returns either the config or the Error, so a case can assert on both outcomes with the same
 * call. Reason for returning rather than throwing: a case asserting that boot SUCCEEDS reads
 * better without a try/catch, and the restore below must run either way.
 */
function loadUnder(
  overrides: Overrides,
  omitSecrets: readonly string[] = [],
): { config?: ReturnType<typeof loadConfig>; error?: Error } {
  // Snapshot before anything is touched, including the secrets - `omitSecrets` deletes one, and
  // a snapshot covering only MANAGED would leave it deleted for every later case in the file.
  const saved = new Map<string, string | undefined>();
  for (const name of [...MANAGED, ...Object.keys(SECRETS)]) saved.set(name, readEnv(name));

  try {
    for (const [name, value] of Object.entries(SECRETS)) {
      writeEnv(name, omitSecrets.includes(name) ? undefined : value);
    }
    for (const name of MANAGED) writeEnv(name, undefined);
    for (const [name, value] of Object.entries(overrides)) writeEnv(name, value);

    resetConfigForTests();
    return { config: loadConfig() };
  } catch (error) {
    return { error: error as Error };
  } finally {
    for (const [name, value] of saved) writeEnv(name, value);
    resetConfigForTests();
  }
}

/** Assert boot was refused, and that the message names the variable an operator must fix. */
function refused(result: { error?: Error }, mentioning: string): Error {
  assert.ok(result.error, "expected boot to be refused, but the config loaded");
  assert.ok(
    result.error.message.includes(mentioning),
    `refusal must name ${mentioning} so the operator knows what to fix, got: ${result.error.message}`,
  );
  return result.error;
}

const PRODUCTION = { NODE_ENV: "production" } as const;
const GOOD_ORIGIN = "https://games.example.com";
const GOOD_ANCESTORS = "https://example.com https://www.example.com";

function main(): void {
  console.log("");
  console.log("Configuration guards");
  console.log("");

  /* ----------------------------------------------------------------------------------------
   * Development: nothing is refused
   * --------------------------------------------------------------------------------------- */

  test("development boots with neither the play origin nor the allowlist set", () => {
    const { config, error } = loadUnder({});
    assert.ok(!error, `development boot must not be refused, got: ${error?.message}`);
    assert.ok(config);
    // The localhost default is the correct answer here, and it is what smoke-play.ts relies on.
    assert.match(config.publicUrl, /^http:\/\/localhost:\d+$/);
    assert.strictEqual(config.frameAncestors, undefined);
  });

  test("the development play origin follows PORT rather than hard-coding 4010", () => {
    const { config } = loadUnder({ PORT: "4999" });
    assert.strictEqual(config?.publicUrl, "http://localhost:4999");
  });

  test("development accepts a plain-http loopback origin explicitly set", () => {
    const { config, error } = loadUnder({ GAMES_PUBLIC_URL: "http://127.0.0.1:4010" });
    assert.ok(!error, `development must accept loopback, got: ${error?.message}`);
    assert.strictEqual(config?.publicUrl, "http://127.0.0.1:4010");
  });

  /* ----------------------------------------------------------------------------------------
   * Production: the two silent failures are refused
   * --------------------------------------------------------------------------------------- */

  test("production refuses to boot with no play origin", () => {
    const result = loadUnder({ ...PRODUCTION, GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS });
    const error = refused(result, "GAMES_PUBLIC_URL");
    // The guidance must explain the distinction that causes the mistake, or an operator
    // "fixes" it by pasting the loopback API base URL they just entered in the admin panel.
    assert.ok(
      error.message.includes("API base URL"),
      "the refusal must distinguish the play origin from the API base URL",
    );
  });

  test("production refuses a loopback play origin", () => {
    for (const origin of [
      "https://localhost:4010",
      "https://127.0.0.1:4010",
      "https://[::1]:4010",
    ]) {
      const result = loadUnder({
        ...PRODUCTION,
        GAMES_PUBLIC_URL: origin,
        GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
      });
      refused(result, "loopback");
    }
  });

  test("production refuses a plain-http play origin", () => {
    const result = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: "http://games.example.com",
      GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
    });
    const error = refused(result, "https");
    // Reason: the operator cannot find this in a server log, so the message has to say so.
    assert.ok(
      error.message.includes("mixed content"),
      "the refusal must say why plain http fails invisibly",
    );
  });

  test("production refuses a play origin that is not a URL at all", () => {
    const result = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: "games.example.com",
      GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
    });
    refused(result, "GAMES_PUBLIC_URL");
  });

  test("production refuses to boot with no frame allowlist", () => {
    const result = loadUnder({ ...PRODUCTION, GAMES_PUBLIC_URL: GOOD_ORIGIN });
    const error = refused(result, "GAMES_FRAME_ANCESTORS");
    assert.ok(
      error.message.includes("embed"),
      "the refusal must say what an unset allowlist permits",
    );
  });

  test("a blank frame allowlist is refused in production, not treated as set", () => {
    // Reason: `GAMES_FRAME_ANCESTORS=` is what a half-finished .env looks like, and a
    // presence check on the key rather than the value would accept it and emit an empty
    // `frame-ancestors` directive - which permits nothing and blanks the game for everyone.
    const result = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: GOOD_ORIGIN,
      GAMES_FRAME_ANCESTORS: "   ",
    });
    refused(result, "GAMES_FRAME_ANCESTORS");
  });

  /* ----------------------------------------------------------------------------------------
   * Production, correctly configured
   * --------------------------------------------------------------------------------------- */

  test("production boots with a public https origin and an allowlist", () => {
    const { config, error } = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: GOOD_ORIGIN,
      GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
    });
    assert.ok(!error, `correct production config must boot, got: ${error?.message}`);
    assert.strictEqual(config?.publicUrl, GOOD_ORIGIN);
    assert.strictEqual(config?.frameAncestors, GOOD_ANCESTORS);
  });

  test("a trailing slash on the play origin is stripped, in production too", () => {
    // Reason: launch URLs are built by concatenation, so a kept slash yields `//play?t=` -
    // which most servers tolerate and some proxies redirect, losing the token's query string.
    const { config } = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: `${GOOD_ORIGIN}//`,
      GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
    });
    assert.strictEqual(config?.publicUrl, GOOD_ORIGIN);
  });

  test("the allowlist keeps multiple origins as written", () => {
    // A single origin is the easy case; the mistake is a config that silently keeps only one.
    const { config } = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: GOOD_ORIGIN,
      GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
    });
    assert.ok(config?.frameAncestors?.includes("https://www.example.com"));
    assert.ok(config?.frameAncestors?.includes("https://example.com"));
  });

  /* ----------------------------------------------------------------------------------------
   * The guards must not have widened anything else
   * --------------------------------------------------------------------------------------- */

  test("a missing secret is still refused in development", () => {
    // Reason: the production carve-out must apply ONLY to the two variables it was written
    // for. If it leaked onto the secrets, development would boot with no credentials and the
    // whole "refuse to boot rather than refuse requests" property would be gone.
    refused(loadUnder({}, ["GAMES_API_SECRET"]), "GAMES_API_SECRET");
  });

  test("a missing secret is refused in production too", () => {
    refused(
      loadUnder({ ...PRODUCTION, GAMES_PUBLIC_URL: GOOD_ORIGIN, GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS }, [
        "GAMES_CALLBACK_SECRET",
      ]),
      "GAMES_CALLBACK_SECRET",
    );
  });

  test("sandbox mode still defaults off under a production environment", () => {
    const { config } = loadUnder({
      ...PRODUCTION,
      GAMES_PUBLIC_URL: GOOD_ORIGIN,
      GAMES_FRAME_ANCESTORS: GOOD_ANCESTORS,
    });
    assert.strictEqual(config?.sandbox, false);
  });

  console.log("");
  console.log(`Configuration tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
