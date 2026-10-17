import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  VELOCITY_ROTATE_CONFIRMATION,
  applyVelocitySecrets,
  generateVelocitySecrets,
  getVelocitySecretStatus,
  readVelocitySecretValues,
  resolveGamesServiceEnvPath,
  writeVelocitySecrets,
} from "../../apps/admin/lib/services/games/velocity-secrets.service";

/**
 * The admin "Generate secrets" control for Volt Velocity writes two lines into
 * games-service/.env. These tests pin the three things that would be silent if wrong:
 * the rest of the file survives, an existing secret is never replaced without a rotation,
 * and no response or status ever carries a value.
 */

const HEX_64 = /^[0-9a-f]{64}$/;
const ROOT = path.resolve(__dirname, "../..");
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

let dir: string;
let envPath: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "velocity-secrets-"));
  envPath = path.join(dir, ".env");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("generateVelocitySecrets", () => {
  it("makes two different 32-byte hex values", () => {
    const values = generateVelocitySecrets();
    expect(values.VELOCITY_ADMIN_KEY).toMatch(HEX_64);
    expect(values.VELOCITY_TICKET_SECRET).toMatch(HEX_64);
    expect(values.VELOCITY_ADMIN_KEY).not.toBe(values.VELOCITY_TICKET_SECRET);
  });
});

describe("applyVelocitySecrets", () => {
  const values = { VELOCITY_ADMIN_KEY: "a".repeat(64), VELOCITY_TICKET_SECRET: "b".repeat(64) };

  it("replaces the commented placeholders env.example ships, leaving every other line", () => {
    const text = "PORT=4010\n# VELOCITY_ADMIN_KEY=\n# VELOCITY_TICKET_SECRET=\nMONGODB_URI=x\n";
    expect(applyVelocitySecrets(text, values)).toBe(
      `PORT=4010\nVELOCITY_ADMIN_KEY=${"a".repeat(64)}\nVELOCITY_TICKET_SECRET=${"b".repeat(64)}\nMONGODB_URI=x\n`,
    );
  });

  it("replaces a live line in place and drops a duplicate of it", () => {
    const text = "VELOCITY_ADMIN_KEY=old\nX=1\nVELOCITY_ADMIN_KEY=older\n";
    const out = applyVelocitySecrets(text, values);
    expect(out.match(/^VELOCITY_ADMIN_KEY=/gm)).toHaveLength(1);
    expect(out.startsWith(`VELOCITY_ADMIN_KEY=${"a".repeat(64)}\nX=1\n`)).toBe(true);
    expect(out).toContain(`VELOCITY_TICKET_SECRET=${"b".repeat(64)}`);
  });

  it("keeps Windows line endings", () => {
    const out = applyVelocitySecrets("PORT=1\r\n", values);
    expect(out).toBe(
      `PORT=1\r\nVELOCITY_ADMIN_KEY=${"a".repeat(64)}\r\nVELOCITY_TICKET_SECRET=${"b".repeat(64)}\r\n`,
    );
  });
});

describe("readVelocitySecretValues", () => {
  it("ignores a commented line and strips quotes", () => {
    const values = readVelocitySecretValues('# VELOCITY_ADMIN_KEY=nope\nVELOCITY_TICKET_SECRET="t"\n');
    expect(values).toEqual({ VELOCITY_ADMIN_KEY: "", VELOCITY_TICKET_SECRET: "t" });
  });
});

describe("writeVelocitySecrets", () => {
  it("refuses when the file does not exist, rather than creating a stray .env", () => {
    const result = writeVelocitySecrets({ rotate: false, envPath });
    expect(result).toMatchObject({ success: false, code: "env_missing" });
  });

  it("writes both on a fresh file and the service would read them", () => {
    writeFileSync(envPath, "PORT=4010\n# VELOCITY_ADMIN_KEY=\n# VELOCITY_TICKET_SECRET=\n");
    const result = writeVelocitySecrets({ rotate: false, envPath });
    expect(result).toMatchObject({ success: true, rotated: false });

    const text = readFileSync(envPath, "utf8");
    const values = readVelocitySecretValues(text);
    expect(values.VELOCITY_ADMIN_KEY).toMatch(HEX_64);
    expect(values.VELOCITY_TICKET_SECRET).toMatch(HEX_64);
    expect(text.startsWith("PORT=4010\n")).toBe(true);
    expect(readdirTmp()).toEqual([".env"]);
  });

  it("refuses to replace existing secrets without a rotation, and changes nothing", () => {
    const original = "VELOCITY_ADMIN_KEY=keep\nVELOCITY_TICKET_SECRET=keep2\n";
    writeFileSync(envPath, original);
    const result = writeVelocitySecrets({ rotate: false, envPath });
    expect(result).toMatchObject({ success: false, code: "already_configured" });
    expect(readFileSync(envPath, "utf8")).toBe(original);
  });

  it("treats ONE set secret as configured too", () => {
    writeFileSync(envPath, "VELOCITY_ADMIN_KEY=only\n");
    expect(writeVelocitySecrets({ rotate: false, envPath })).toMatchObject({
      code: "already_configured",
    });
  });

  it("rotates when asked, replacing both", () => {
    writeFileSync(envPath, "VELOCITY_ADMIN_KEY=old\nVELOCITY_TICKET_SECRET=old2\n");
    expect(writeVelocitySecrets({ rotate: true, envPath })).toMatchObject({
      success: true,
      rotated: true,
    });
    const values = readVelocitySecretValues(readFileSync(envPath, "utf8"));
    expect(values.VELOCITY_ADMIN_KEY).toMatch(HEX_64);
    expect(values.VELOCITY_TICKET_SECRET).toMatch(HEX_64);
  });

  it("never returns a secret value", () => {
    writeFileSync(envPath, "");
    const result = writeVelocitySecrets({ rotate: false, envPath });
    const values = readVelocitySecretValues(readFileSync(envPath, "utf8"));
    const serialised = JSON.stringify(result) + JSON.stringify(getVelocitySecretStatus(envPath));
    expect(serialised).not.toContain(values.VELOCITY_ADMIN_KEY);
    expect(serialised).not.toContain(values.VELOCITY_TICKET_SECRET);
  });
});

describe("getVelocitySecretStatus", () => {
  it("flags two equal secrets, which the race server refuses", () => {
    writeFileSync(envPath, "VELOCITY_ADMIN_KEY=same\nVELOCITY_TICKET_SECRET=same\n");
    expect(getVelocitySecretStatus(envPath)).toMatchObject({
      fileFound: true,
      adminKeyConfigured: true,
      ticketSecretConfigured: true,
      secretsEqual: true,
    });
  });
});

describe("resolveGamesServiceEnvPath", () => {
  it("defaults to games-service/.env beside apps/admin, the PM2 layout", () => {
    const cwd = path.join(ROOT, "apps", "admin");
    expect(resolveGamesServiceEnvPath({}, cwd)).toBe(path.join(ROOT, "games-service", ".env"));
  });

  it("honours GAMES_SERVICE_ENV_FILE", () => {
    expect(resolveGamesServiceEnvPath({ GAMES_SERVICE_ENV_FILE: "/srv/g/.env" }, "/x")).toBe(
      path.resolve("/x", "/srv/g/.env"),
    );
  });
});

describe("the route and the control", () => {
  const route = read("apps/admin/app/api/games/velocity-secrets/route.ts");
  const control = read("apps/admin/components/admin/games/VelocitySecretsControl.tsx");

  it("guards both handlers on the Game Providers section", () => {
    expect(route.match(/export async function (GET|POST)\b/g)).toHaveLength(2);
    expect(route.match(/guardSection\("game-providers"\)/g)).toHaveLength(2);
  });

  it("rotates only on the typed phrase, never on a boolean", () => {
    expect(route).toContain("body.confirm === VELOCITY_ROTATE_CONFIRMATION");
    expect(route).not.toMatch(/body\.rotate/);
    expect(VELOCITY_ROTATE_CONFIRMATION).toBe("ROTATE");
  });

  it("the client control never imports the fs-using service (R58)", () => {
    expect(control).not.toMatch(/from\s+["'][^"']*velocity-secrets\.service["']/);
    expect(control).toContain("@/lib/admin/velocity-secrets-copy");
  });

  it("the control names no game - the route says which title it belongs to", () => {
    expect(control).not.toMatch(/volt-velocity/);
    expect(control).toContain("status.gameCode !== title.gameCode");
  });
});

function readdirTmp(): string[] {
  return readdirSync(dir);
}
