/**
 * Service configuration.
 *
 * WHY THIS REFUSES TO BOOT RATHER THAN REFUSING REQUESTS
 * -----------------------------------------------------
 * A missing secret is a deployment mistake, and there are only two ways to handle one. Either
 * every request fails with an authentication error, or the process never starts. The first is
 * what the ChartVolt platform itself got wrong in its own history: `/api/simulator/*` treated
 * absent configuration as permission to proceed, and an anonymous caller could credit any
 * wallet. The rule that came out of it - an authentication helper must never accept a request
 * because configuration is missing - is easy to state and easy to violate one `??  ""` at a
 * time.
 *
 * Refusing to boot removes the whole class. There is no code path in this service that can
 * consult a secret and find nothing, because the process would not be running.
 *
 * The second reason is operational rather than security: a service that boots and then rejects
 * every call looks identical, in a dashboard, to a service under attack. A crash loop with a
 * named missing variable says what is wrong on the first line of the log.
 */

/*
 * The four readers below index `process.env` by a name their caller supplies.
 *
 * `security/detect-object-injection` flags every one, and every one is a false positive: the names
 * are string literals written in `loadConfig` below, so none is reachable from a request. Disabled
 * at each site rather than for the file, so a future reader that DID take its name from input would
 * still be flagged.
 */

/** Read a variable that the service cannot run without. */
function required(name: string): string {
  // eslint-disable-next-line security/detect-object-injection
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `ChartVolt Games cannot start: ${name} is not set. See games-service/README.md.`,
    );
  }
  return value.trim();
}

/** Read a variable that has a sensible default. */
function optional(name: string, fallback: string): string {
  // eslint-disable-next-line security/detect-object-injection
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Read the previous half of a rotating secret pair.
 *
 * The specification asks providers to support rotating secrets "without downtime, by accepting
 * both the old and the new value during a changeover window". Absent is the normal state - it
 * means no rotation is in progress - so unlike its live counterpart this one must not refuse
 * to boot.
 */
function rotating(name: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Read a variable that is optional in development and mandatory in production.
 *
 * WHY THE DISTINCTION EXISTS, AND WHY IT IS NOT A WEAKENING
 * --------------------------------------------------------
 * Two of this service's variables have a default that is correct locally and dangerous once
 * real players arrive: the play origin defaults to localhost, and the frame allowlist defaults
 * to permitting every site. Both were previously documented rather than enforced, on the
 * reasoning that a service refusing to boot without them could not be smoke-tested. That
 * reasoning was sound about unconditional enforcement and wrong about the conclusion - the
 * smoke tools and the whole test suite run without `NODE_ENV=production`, so the two cases can
 * be separated instead of traded off.
 *
 * The failures being prevented are the invisible kind, which is why boot is the right place:
 * a localhost launch URL sends the player's iframe to their own machine, and a missing frame
 * allowlist lets any site embed a live round and overlay it. Neither produces an error, a log
 * line, or anything a dashboard can show. The player sees a blank rectangle.
 */
function requiredInProduction(name: string, fallback: string, guidance: string): string {
  // eslint-disable-next-line security/detect-object-injection
  const value = process.env[name];
  if (value && value.trim().length > 0) return value.trim();

  if (isProduction()) {
    throw new Error(`ChartVolt Games cannot start: ${name} is not set. ${guidance}`);
  }
  return fallback;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Reject a play origin a player's browser could not load the board from.
 *
 * Production only, because both refusals are correct locally: development serves plain http on
 * loopback and that is the whole point of it.
 *
 * The https requirement is not belt-and-braces. The platform is served over https, so a
 * plain-http iframe inside it is blocked as mixed content by every current browser - and the
 * block happens in the player's browser, so nothing reaches any server log. A loopback origin
 * fails the same silent way, resolving to the player's own machine.
 */
function assertPlayableOrigin(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `ChartVolt Games cannot start: GAMES_PUBLIC_URL is not a valid URL (${value}).`,
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `ChartVolt Games cannot start: GAMES_PUBLIC_URL must be https in production (${value}). ` +
        `The platform is served over https, so a plain-http game frame is blocked as mixed ` +
        `content in the player's browser and the board stays blank with nothing in any log.`,
    );
  }

  // `[::1]` arrives from `new URL` with its brackets retained.
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    throw new Error(
      `ChartVolt Games cannot start: GAMES_PUBLIC_URL is a loopback address (${value}). ` +
        `Launch URLs are built from it and handed to the player's browser, so a loopback ` +
        `origin points every player at their own machine. Use the public games domain.`,
    );
  }
}

function integer(name: string, fallback: number): number {
  // eslint-disable-next-line security/detect-object-injection
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  // Reason for `Number.isFinite` rather than a truthiness check: PORT=0 is a real value that
  // asks the OS for an ephemeral port, and `||` would silently replace it with the default.
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ServiceConfig {
  port: number;
  /**
   * The origin this service is reachable on, used to build launch URLs.
   *
   * It must be the PLAY origin, which the specification treats as a separate fact from the API
   * base URL - the platform's own security policy has to allow it in `frame-ancestors`, and its
   * own example puts play on a different subdomain from the API.
   */
  publicUrl: string;
  /**
   * The CSP `frame-ancestors` value - which origins may embed the game.
   *
   * `undefined` means no restriction, which is correct for a service not yet told who its
   * customer is. It is mandatory in production, enforced at boot.
   */
  frameAncestors?: string;
  mongoUri: string;
  /** Database name, kept separate so one accidental URI cannot land us in the platform's data. */
  dbName: string;

  /** Credentials WE issue to the platform, presented on every call it makes to us. */
  inbound: {
    apiKey: string;
    apiKeyPrevious?: string;
    apiSecret: string;
    apiSecretPrevious?: string;
  };

  /** Credentials the PLATFORM issues to us, presented on every callback we send it. */
  outbound: {
    callbackToken: string;
    callbackSecret: string;
  };

  /**
   * Enables the sandbox controls the specification asks for: force a score, force a terminal
   * state, suppress a callback.
   *
   * Defaults to false. Reason: these controls decide prize money if they are ever reachable in
   * production, so the safe value is the one you get by forgetting to set anything.
   */
  sandbox: boolean;

  /** Where catalogue artwork is served from. */
  assetBaseUrl: string;
}

let cached: ServiceConfig | null = null;

/** The origin launch URLs are built from. See `assertPlayableOrigin`. */
function playOrigin(): string {
  const value = requiredInProduction(
    "GAMES_PUBLIC_URL",
    `http://localhost:${integer("PORT", 4010)}`,
    `It is the address a player's browser loads the game board from, and launch URLs are built ` +
      `from it. It is a separate fact from the API base URL the platform calls - that one can ` +
      `be loopback; this one cannot.`,
  ).replace(/\/+$/, "");

  if (isProduction()) assertPlayableOrigin(value);
  return value;
}

export function loadConfig(): ServiceConfig {
  if (cached) return cached;

  cached = {
    port: integer("PORT", 4010),
    publicUrl: playOrigin(),
    frameAncestors:
      requiredInProduction(
        "GAMES_FRAME_ANCESTORS",
        "",
        `It is the CSP frame-ancestors allowlist. Unset, any site on the internet can embed a ` +
          `live round and overlay it. Set it to every origin players arrive on, www included, ` +
          `space-separated.`,
      ) || undefined,
    mongoUri: required("GAMES_MONGODB_URI"),
    dbName: optional("GAMES_DB_NAME", "chartvolt_games"),

    inbound: {
      apiKey: required("GAMES_API_KEY"),
      apiKeyPrevious: rotating("GAMES_API_KEY_PREVIOUS"),
      apiSecret: required("GAMES_API_SECRET"),
      apiSecretPrevious: rotating("GAMES_API_SECRET_PREVIOUS"),
    },

    outbound: {
      callbackToken: required("GAMES_CALLBACK_TOKEN"),
      callbackSecret: required("GAMES_CALLBACK_SECRET"),
    },

    // Reason for `=== "true"` rather than a truthy check: `SANDBOX=false` and `SANDBOX=0` are
    // both what an operator writes when they mean off, and both are truthy strings.
    sandbox: optional("GAMES_SANDBOX", "false") === "true",

    assetBaseUrl: optional("GAMES_ASSET_BASE_URL", optional("GAMES_PUBLIC_URL", "")).replace(
      /\/+$/,
      "",
    ),
  };

  return cached;
}

/** Test seam. The config is cached because it is read on every request. */
export function resetConfigForTests(): void {
  cached = null;
}
