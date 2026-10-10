/**
 * Writes `games-service/.env` in one command.
 *
 * Generates the four credentials, borrows the database connection string and the public origin
 * from the platform's own `.env`, and prints the two values that have to be typed into the admin
 * panel afterwards.
 *
 * WHY THIS EXISTS
 * ---------------
 * The manual version is four `openssl` runs and eleven lines of hand-edited configuration, where
 * a single typo produces `signature_invalid` on every result - an error that reads like an attack
 * rather than like a typo. Every value it writes is either random or already known to the machine,
 * so there is nothing here a person needs to decide.
 *
 * WHY READING THE PLATFORM'S .env IS NOT AN ISOLATION BREACH
 * ---------------------------------------------------------
 * `check:isolation` forbids this service SHARING CODE with the platform, because a shared type
 * would let the two sides agree with each other about something the specification never says.
 * This reads a configuration file at setup time and imports nothing - the running service still
 * has no knowledge of the platform whatsoever, and a real third-party provider would simply be
 * handed the same two facts by email. Deleting this file would change no runtime behaviour.
 *
 * WHAT IT REFUSES TO DO, WHICH IS THE IMPORTANT PART
 * -------------------------------------------------
 *   - Overwrite an existing `.env`. Rotating the credentials without also re-entering them in the
 *     admin panel breaks every result delivery, and the four boxes there can never be read back -
 *     so the old values would be gone with no way to recover them. `--force` if you mean it.
 *   - Write an origin the service would then refuse to boot on. The same https and non-loopback
 *     rules `assertPlayableOrigin` enforces are applied HERE, where the message can name the file
 *     to fix, rather than at 3am in a PM2 restart loop.
 *   - Print the database connection string. It contains a password and this output gets pasted
 *     into chat windows and support tickets.
 *
 * Usage, from `games-service/`:
 *   npm run setup:env
 *   npm run setup:env -- --url https://chartvolt.com     # if the platform's .env has no base URL
 *   npm run setup:env -- --force                         # regenerate, accepting the consequence
 *   npm run setup:env -- --dev                           # a localhost file for development
 *
 * `--dev` exists because the rules above are production rules, and a developer needs the file
 * they forbid. It is safe rather than a loophole: `assertPlayableOrigin` in `src/config.ts` still
 * refuses to BOOT on a loopback origin whenever `NODE_ENV=production`, so a `--dev` file copied
 * to a server fails loudly on the first start rather than pointing every player at their own
 * machine. The carve-out is in the file's contents, never in the service's enforcement.
 */

import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SERVICE_ROOT = join(__dirname, "..");
const TARGET = join(SERVICE_ROOT, ".env");
const PLATFORM_ENV = join(SERVICE_ROOT, "..", ".env");
const PLATFORM_ENV_LOCAL = join(SERVICE_ROOT, "..", ".env.local");

/** One credential: 32 random bytes as hex, which is what `openssl rand -hex 32` produces. */
function secret(): string {
  return randomBytes(32).toString("hex");
}

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/**
 * Pull one variable out of a `.env` file.
 *
 * Deliberately a line scan rather than a dotenv import: this runs before anything is guaranteed
 * to be installed, and it must never load the platform's variables into this process - only read
 * the two it was asked for.
 */
function readPlatformVar(source: string, name: string): string | undefined {
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    if (trimmed.slice(0, separator).trim() !== name) continue;

    // Strip surrounding quotes, which are legal in a .env file and would otherwise be copied
    // into ours as part of the value.
    return trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/**
 * The origin players load the board from, validated against the service's own boot rules.
 *
 * Reason for duplicating the check instead of importing it: `assertPlayableOrigin` runs inside
 * `loadConfig`, which requires the very file this script is writing. Failing here with the
 * offending value in the message is worth eight lines.
 */
function playableOrigin(raw: string, source: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`"${raw}" (from ${source}) is not a valid URL. Pass a good one with --url.`);
  }

  if (parsed.protocol !== "https:") {
    fail(
      `The play origin must be https, and ${source} gave "${raw}".\n` +
        `   Reason: the board is embedded in a page served over https, so a plain-http frame is\n` +
        `   blocked by the browser as mixed content - a blank rectangle with nothing in any log.`,
    );
  }

  if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname)) {
    fail(
      `The play origin cannot be loopback, and ${source} gave "${raw}".\n` +
        `   Reason: it goes into the URL every PLAYER'S BROWSER opens, so a loopback address\n` +
        `   points each of them at their own machine. Pass the public site with --url.`,
    );
  }

  return parsed.origin;
}

/**
 * Both the bare host and its `www.` form, because players arrive on either.
 *
 * Not applied in development: `www.localhost` is not a thing, and an allowlist carrying an
 * address that cannot resolve invites somebody to "fix" the real one by copying the pattern.
 */
function frameAncestors(origin: string, isDev: boolean): string {
  if (isDev) return origin;

  const { hostname } = new URL(origin);
  if (hostname.startsWith("www.")) {
    return `${origin} https://${hostname.slice(4)}`;
  }
  return `${origin} https://www.${hostname}`;
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const dev = args.includes("--dev");
const urlFlagIndex = args.indexOf("--url");
const urlFlag = urlFlagIndex === -1 ? undefined : args[urlFlagIndex + 1];

/**
 * Development origin, matching how the proxy actually serves the game.
 *
 * Reason it is the platform's port and not the service's: the board is reached through the app's
 * `/play` rewrites in production, so a dev file pointing straight at 4010 would exercise a route
 * no player ever takes - and the two differ in exactly the places that break (asset prefix,
 * frame ancestors, message origin).
 */
const DEV_ORIGIN = "http://localhost:3000";

// --- refuse before touching anything -----------------------------------------------------------

if (existsSync(TARGET) && !force) {
  fail(
    `games-service/.env already exists, so nothing was changed.\n\n` +
      `   Regenerating it would issue four NEW credentials, and the four boxes in the admin\n` +
      `   panel cannot be read back - so the current ones would be unrecoverable and every\n` +
      `   game result would start failing signature checks.\n\n` +
      `   If that is what you want: npm run setup:env -- --force\n` +
      `   You will then have to re-enter all four values in the admin panel.`,
  );
}

// In development the local override wins, mirroring Next.js's own precedence - otherwise a
// developer pointed at a local replica set silently gets the production cluster.
const sources = dev ? [PLATFORM_ENV_LOCAL, PLATFORM_ENV] : [PLATFORM_ENV];
const foundSource = sources.find((path) => existsSync(path));

if (!foundSource) {
  fail(
    `Could not find the platform's .env at ${PLATFORM_ENV}.\n` +
      `   Run this from inside games-service/ on the server, where the platform sits one\n` +
      `   directory up. Nothing was changed.`,
  );
}

const platform = readFileSync(foundSource, "utf8");

const mongoUri = readPlatformVar(platform, "MONGODB_URI");
if (!mongoUri) {
  fail(
    `The platform's .env has no MONGODB_URI line, so there is nothing to copy.\n` +
      `   Add GAMES_MONGODB_URI by hand instead - see env.example. Nothing was changed.`,
  );
}

const baseUrl = readPlatformVar(platform, "NEXT_PUBLIC_BASE_URL");
const originSource =
  urlFlag !== undefined
    ? "--url"
    : baseUrl !== undefined
      ? "the platform's NEXT_PUBLIC_BASE_URL"
      : undefined;

const rawOrigin = urlFlag ?? baseUrl;
if (!dev && (!rawOrigin || !originSource)) {
  fail(
    `Could not work out the public site address.\n` +
      `   The platform's .env has no NEXT_PUBLIC_BASE_URL, so pass it explicitly:\n` +
      `     npm run setup:env -- --url https://your-site.com\n` +
      `   Nothing was changed.`,
  );
}

const origin = dev ? DEV_ORIGIN : playableOrigin(rawOrigin!, originSource!);

// --- write ------------------------------------------------------------------------------------

const credentials = {
  apiKey: secret(),
  apiSecret: secret(),
  callbackToken: secret(),
  callbackSecret: secret(),
};

const contents = `# ChartVolt Games - generated by \`npm run setup:env${dev ? " -- --dev" : ""}\` on ${new Date().toISOString()}.${
  dev
    ? `
#
# DEVELOPMENT FILE. The loopback origin below is refused at boot when NODE_ENV=production, so
# copying this to a server fails loudly rather than pointing every player at their own machine.`
    : ""
}
#
# The four credentials below are also typed into the admin panel, under
# GAMES -> Game Providers -> ChartVolt Games -> Credentials. They must match exactly.
# Annotated reference for every variable: games-service/env.example

PORT=4010

# Where a player's browser loads the board from. Served by the platform app's /play rewrites,
# which is why this is the main site and not a games subdomain.
GAMES_PUBLIC_URL=${origin}

# Who may embed a live round. Left open, any site on the internet could frame it and overlay it.
GAMES_FRAME_ANCESTORS=${frameAncestors(origin, dev)}

# Catalogue artwork. The /play prefix is required on this route: the platform app owns
# public/assets, so our artwork is mounted one level in at /play/assets/.
GAMES_ASSET_BASE_URL=${origin}/play

# Copied from the platform's MONGODB_URI. Sharing the cluster is safe because GAMES_DB_NAME is
# passed explicitly to the driver, so these collections land in their own database and this
# service cannot read the platform's data even by accident.
GAMES_MONGODB_URI=${mongoUri}
GAMES_DB_NAME=chartvolt_games

# Issued TO US by the provider - sent OUT with every call the platform makes to the game.
GAMES_API_KEY=${credentials.apiKey}
GAMES_API_SECRET=${credentials.apiSecret}

# Issued BY US to the provider - arrives IN with every result the game posts back.
GAMES_CALLBACK_TOKEN=${credentials.callbackToken}
GAMES_CALLBACK_SECRET=${credentials.callbackSecret}

# Sandbox can force a score, and a forced score decides real prize money. Never true here.
GAMES_SANDBOX=false
`;

writeFileSync(TARGET, contents, { encoding: "utf8" });

try {
  // Owner read/write only. Best-effort: this is a no-op on Windows, where the file is not on a
  // server anyway.
  chmodSync(TARGET, 0o600);
} catch {
  console.warn("⚠️  Could not restrict permissions on .env - check them by hand.");
}

// --- tell the operator exactly what to do next -------------------------------------------------

const line = "─".repeat(72);

console.log(`
✅ Wrote games-service/.env

   Play origin      ${origin}
   Artwork          ${origin}/play
   Database         chartvolt_games  (own database, platform's cluster)
   Sandbox          off

${line}
 NOW COPY THESE FOUR VALUES INTO THE ADMIN PANEL
 GAMES → Game Providers → ChartVolt Games → Credentials
${line}

 Issued to us by the provider
   API key            ${credentials.apiKey}
   API secret         ${credentials.apiSecret}

 Issued by us to the provider
   Callback token     ${credentials.callbackToken}
   Callback secret    ${credentials.callbackSecret}

${line}

 These four are also the ONLY reason to keep this output. They cannot be read back
 from the admin panel afterwards, and re-running this script issues new ones.

 Next:
   1.  cd .. && pm2 start ecosystem.config.js --only chartvolt-games && pm2 save
   2.  curl -s http://127.0.0.1:4010/health          -> "ok":true, "sandbox":false
   3.  Register the provider in the admin panel with API base URL http://127.0.0.1:4010
   4.  Paste the four values above, Sync games, then enable the provider and both titles
`);
