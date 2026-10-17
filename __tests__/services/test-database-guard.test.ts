/**
 * Pins the guards added after the 1 Oct 2026 incident, when the admin Performance
 * Simulator ran vitest on the production server with the live MONGODB_URI in its
 * environment and the test cleanup deleted production collections (admins, symbols,
 * the white-label settings that hold the Redis configuration).
 *
 * Reason: every layer below fails silently if removed - tests still pass, against
 * whatever database the environment happens to name.
 */
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  assertTestDatabaseIsLocal,
  isLoopbackMongoUri,
  isTestRun,
  testRunEnvironment,
} from "../../database/test-database-guard";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("isLoopbackMongoUri", () => {
  it.each([
    "mongodb://127.0.0.1:27017/test",
    "mongodb://localhost:1234/x?replicaSet=rs",
    "mongodb://user:pw@127.0.0.1:5000,127.0.0.1:5001/x",
    "mongodb://[::1]:27017/x",
  ])("accepts %s", (uri) => expect(isLoopbackMongoUri(uri)).toBe(true));

  it.each([
    "mongodb+srv://u:p@cluster0.abc.mongodb.net/prod",
    "mongodb://db.example.com:27017/prod",
    "mongodb://127.0.0.1:1,db.example.com:2/mixed",
    "",
    "not a uri",
  ])("refuses %s", (uri) => expect(isLoopbackMongoUri(uri)).toBe(false));
});

describe("assertTestDatabaseIsLocal", () => {
  it("knows it is inside a test run", () => expect(isTestRun()).toBe(true));

  it("refuses an Atlas address during a test run", () => {
    expect(() => assertTestDatabaseIsLocal("mongodb+srv://u:p@c.mongodb.net/prod", "t")).toThrow(
      /Refusing to use a non-local database/,
    );
  });

  it("allows the in-memory server", () => {
    expect(() => assertTestDatabaseIsLocal("mongodb://127.0.0.1:5555/t", "t")).not.toThrow();
  });
});

describe("testRunEnvironment", () => {
  it("drops database and redis addresses by name and by value, keeps the rest", () => {
    const env = testRunEnvironment({
      MONGODB_URI: "mongodb+srv://u:p@c.mongodb.net/prod",
      REDIS_URL: "redis://prod:6379",
      SOMETHING_ELSE: "mongodb://db.example.com/prod",
      PATH: "/usr/bin",
      NODE_ENV: "production",
    });
    expect(env).toEqual({ PATH: "/usr/bin", NODE_ENV: "test" });
  });
});

describe("the live-database setup file", () => {
  it("has removed the production address from this very process", () => {
    for (const value of Object.values(process.env)) {
      if (value && /^mongodb(\+srv)?:\/\//i.test(value)) expect(isLoopbackMongoUri(value)).toBe(true);
    }
  });

  it.each(["vitest.config.ts", "vitest.e2e.config.ts"])("%s loads it", (file) => {
    expect(stripComments(read(file))).toMatch(/setupFiles:\s*\[\s*"__tests__\/setup\/forbid-live-database\.ts"/);
  });
});

describe("every launcher of vitest scrubs the environment", () => {
  it.each(["apps/admin/app/api/tests/run/route.ts", "worker/jobs/scheduled-test-run.job.ts"])("%s", (file) => {
    const code = stripComments(read(file));
    expect(code).toMatch(/env:\s*testRunEnvironment\(\)/);
    expect(code).not.toMatch(/\.\.\.process\.env/);
  });
});

describe("both connectToDatabase copies call the guard", () => {
  it.each(["database/mongoose.ts", "apps/admin/database/mongoose.ts"])("%s", (file) => {
    expect(stripComments(read(file))).toMatch(/assertTestDatabaseIsLocal\(\s*\w+,\s*"connectToDatabase"\s*\)/);
  });

  it("the guard module is mirrored byte for byte", () => {
    expect(read("apps/admin/database/test-database-guard.ts")).toBe(read("database/test-database-guard.ts"));
  });
});
