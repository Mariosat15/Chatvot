import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * The two Volt Velocity secrets, generated from the admin panel and written into the ONE `.env`
 * that both `chartvolt-games` and `chartvolt-velocity` read (`games-service/.env`; the race
 * server is started with `--env-file=../games-service/.env` in `ecosystem.config.js`).
 *
 * WRITE-ONLY, AND WHY
 * -------------------
 * The values are generated here, written to the file and never returned, logged or stored in
 * MongoDB. The status this module reports is "is it set", never "what is it". `23` s7 keeps these
 * secrets out of the platform; this module is an owner-approved exception (27 Sep 2026) that
 * holds them only for the length of one request.
 *
 * SAME-SERVER ONLY
 * ----------------
 * The admin app can only write a file on its own machine. The default path assumes the admin runs
 * from `apps/admin` beside `games-service/`, which is the PM2 layout. Anywhere else, set
 * `GAMES_SERVICE_ENV_FILE`. The screen shows the resolved path so a wrong file is visible, and the
 * write refuses when the file does not exist rather than creating a stray `.env` nothing reads -
 * the failure that made the payment-provider `.env` writer unsafe.
 */

export const VELOCITY_GAME_CODE = "volt-velocity";
export const VELOCITY_SECRET_KEYS = ["VELOCITY_ADMIN_KEY", "VELOCITY_TICKET_SECRET"] as const;
export type VelocitySecretKey = (typeof VELOCITY_SECRET_KEYS)[number];

export {
  VELOCITY_RESTART_COMMAND,
  VELOCITY_ROTATE_CONFIRMATION,
} from "../../admin/velocity-secrets-copy";

export function resolveGamesServiceEnvPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const override = env.GAMES_SERVICE_ENV_FILE?.trim();
  if (override) return path.resolve(cwd, override);
  return path.resolve(cwd, "..", "..", "games-service", ".env");
}

function keyPattern(key: VelocitySecretKey, allowCommented: boolean): RegExp {
  // Reason: the keys are fixed literals above, never caller input, so building the pattern from
  // them cannot inject anything.
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(`^\\s*${allowCommented ? "#?\\s*" : ""}(?:export\\s+)?${key}\\s*=(.*)$`);
}

function unquote(raw: string): string {
  const value = raw.trim();
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return (quoted ? quoted[2] : value).trim();
}

/** The value of each key as the games service would read it, from `.env` text. */
export function readVelocitySecretValues(text: string): Record<VelocitySecretKey, string> {
  const result: Record<VelocitySecretKey, string> = {
    VELOCITY_ADMIN_KEY: "",
    VELOCITY_TICKET_SECRET: "",
  };
  for (const line of text.split(/\r?\n/)) {
    for (const key of VELOCITY_SECRET_KEYS) {
      const match = keyPattern(key, false).exec(line);
      // eslint-disable-next-line security/detect-object-injection
      if (match) result[key] = unquote(match[1]);
    }
  }
  return result;
}

/**
 * Put `KEY=value` in place for each key, touching no other line.
 *
 * An existing live line is replaced where it stands; failing that, the commented placeholder
 * `env.example` ships (`# VELOCITY_ADMIN_KEY=`) is replaced; failing that, the line is appended.
 * Any further live line for the same key is dropped, because a duplicate means the file says two
 * things and which one wins depends on the loader.
 */
export function applyVelocitySecrets(
  text: string,
  values: Record<VelocitySecretKey, string>,
): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.length === 0 ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/);

  for (const key of VELOCITY_SECRET_KEYS) {
    // eslint-disable-next-line security/detect-object-injection
    const replacement = `${key}=${values[key]}`;
    const live = lines.flatMap((line, index) => (keyPattern(key, false).test(line) ? [index] : []));

    if (live.length > 0) {
      lines.splice(live[0], 1, replacement);
      for (const index of live.slice(1).reverse()) lines.splice(index, 1);
      continue;
    }
    const placeholder = lines.findIndex((line) => keyPattern(key, true).test(line));
    if (placeholder >= 0) lines.splice(placeholder, 1, replacement);
    else lines.push(replacement);
  }

  return lines.join(newline) + newline;
}

export function generateVelocitySecrets(): Record<VelocitySecretKey, string> {
  const adminKey = randomBytes(32).toString("hex");
  let ticketSecret = randomBytes(32).toString("hex");
  // The race server refuses to boot when they are equal; astronomically unlikely, never assumed.
  while (ticketSecret === adminKey) ticketSecret = randomBytes(32).toString("hex");
  return { VELOCITY_ADMIN_KEY: adminKey, VELOCITY_TICKET_SECRET: ticketSecret };
}

export interface VelocitySecretStatus {
  gameCode: string;
  envPath: string;
  fileFound: boolean;
  adminKeyConfigured: boolean;
  ticketSecretConfigured: boolean;
  /** Both set to the same value: the race server refuses to boot. */
  secretsEqual: boolean;
}

export function getVelocitySecretStatus(envPath = resolveGamesServiceEnvPath()): VelocitySecretStatus {
  const fileFound = existsSync(envPath);
  const values = fileFound
    ? readVelocitySecretValues(readFileSync(envPath, "utf8"))
    : { VELOCITY_ADMIN_KEY: "", VELOCITY_TICKET_SECRET: "" };
  return {
    gameCode: VELOCITY_GAME_CODE,
    envPath,
    fileFound,
    adminKeyConfigured: values.VELOCITY_ADMIN_KEY.length > 0,
    ticketSecretConfigured: values.VELOCITY_TICKET_SECRET.length > 0,
    secretsEqual:
      values.VELOCITY_ADMIN_KEY.length > 0 &&
      values.VELOCITY_ADMIN_KEY === values.VELOCITY_TICKET_SECRET,
  };
}

export type WriteVelocitySecretsResult =
  | { success: true; rotated: boolean; envPath: string }
  | { success: false; code: "env_missing" | "already_configured" | "write_failed"; error: string };

export function writeVelocitySecrets(options: {
  rotate: boolean;
  envPath?: string;
}): WriteVelocitySecretsResult {
  const envPath = options.envPath ?? resolveGamesServiceEnvPath();

  if (!existsSync(envPath)) {
    return {
      success: false,
      code: "env_missing",
      error: `No games-service .env was found at ${envPath}. Create it first with "npm run setup:env" in games-service, or set GAMES_SERVICE_ENV_FILE on the admin app.`,
    };
  }

  const original = readFileSync(envPath, "utf8");
  const current = readVelocitySecretValues(original);
  const alreadySet = VELOCITY_SECRET_KEYS.some(
    // eslint-disable-next-line security/detect-object-injection
    (key) => current[key].length > 0,
  );
  if (alreadySet && !options.rotate) {
    return {
      success: false,
      code: "already_configured",
      error:
        "The Volt Velocity secrets are already set. Replacing them ends every race in progress - confirm a rotation to continue.",
    };
  }

  const values = generateVelocitySecrets();
  const next = applyVelocitySecrets(original, values);

  // Reason: write a sibling file and rename it over the original, so a crash mid-write can never
  // leave games-service with a half-written .env; keep the original's permissions (0600 when
  // setup:env made it).
  const mode = statSync(envPath).mode & 0o777;
  const temporary = `${envPath}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    writeFileSync(temporary, next, { encoding: "utf8", mode });
    renameSync(temporary, envPath);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    console.error("❌ Could not write the Volt Velocity secrets:", error);
    return {
      success: false,
      code: "write_failed",
      error: `The admin app could not write ${envPath}. Check that it has permission to change that file.`,
    };
  }

  const written = readVelocitySecretValues(readFileSync(envPath, "utf8"));
  const verified = VELOCITY_SECRET_KEYS.every(
    // eslint-disable-next-line security/detect-object-injection
    (key) => written[key] === values[key],
  );
  if (!verified) {
    return {
      success: false,
      code: "write_failed",
      error: "The .env was written but did not read back as expected. Check the file by hand.",
    };
  }

  return { success: true, rotated: alreadySet, envPath };
}
