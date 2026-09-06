/**
 * Test harness for the HTTP API.
 *
 * WHY THIS DRIVES A REAL LISTENER OVER REAL HTTP
 * ---------------------------------------------
 * Calling the handlers directly would be faster and would skip the three things most likely to be
 * wrong: the raw-body capture the HMAC depends on, the JSON-only error handling the specification
 * requires, and the status codes the platform branches on. All three live in middleware, so a test
 * that bypasses the server tests the half of the code that was never in doubt.
 *
 * It also means the callback receiver here is a real HTTP server, so the signature the service
 * sends is verified by code that had to parse actual bytes off a socket - which is exactly where a
 * serialise-twice bug shows up and nowhere else.
 */

import crypto from "crypto";
import http from "http";
import type { AddressInfo } from "net";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/* ------------------------------------------------------------------------------------------
 * Environment
 * ----------------------------------------------------------------------------------------- */

export const API_KEY = "test_api_key_aaaaaaaaaaaaaaaa";
export const API_SECRET = "test_api_secret_bbbbbbbbbbbbbbbb";
export const CALLBACK_TOKEN = "test_cb_token_cccccccccccccccc";
export const CALLBACK_SECRET = "test_cb_secret_dddddddddddddddd";

let memory: MongoMemoryServer | null = null;
let server: http.Server | null = null;
let receiver: http.Server | null = null;

export interface ReceivedCallback {
  headers: Record<string, string | undefined>;
  rawBody: string;
  body: Record<string, unknown>;
  signatureValid: boolean;
}

/** Everything the platform's callback endpoint would have received, in order. */
export const received: ReceivedCallback[] = [];

/**
 * How the fake platform answers the next callback.
 *
 * A mutable box rather than a parameter, because the service decides when to deliver and the test
 * only gets to decide what it finds when it does.
 */
export const receiverBehaviour = { status: 200, failTimes: 0 };

export let baseUrl = "";
export let callbackUrl = "";

/**
 * Starts a fake ChartVolt platform that verifies the signature the way the real one does.
 *
 * Verifying here rather than merely recording is the point: the real platform's ingestion computes
 * an HMAC over the raw bytes and compares in constant time, so a callback this receiver accepts is
 * one the platform would accept too. A receiver that only counted requests would pass happily while
 * every score was rejected in production.
 */
async function startReceiver(): Promise<void> {
  receiver = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const offered = (req.headers["x-signature"] as string | undefined) ?? "";
      const hex = offered.startsWith("sha256=") ? offered.slice(7) : offered;
      const expected = crypto
        .createHmac("sha256", CALLBACK_SECRET)
        .update(rawBody, "utf8")
        .digest("hex");

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        parsed = {};
      }

      received.push({
        headers: req.headers as Record<string, string | undefined>,
        rawBody,
        body: parsed,
        signatureValid: hex.length === expected.length && hex === expected,
      });

      let status = receiverBehaviour.status;
      if (receiverBehaviour.failTimes > 0) {
        receiverBehaviour.failTimes--;
        status = 503;
      }

      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: status < 300, eventId: parsed.eventId ?? null }));
    });
  });

  await new Promise<void>((resolve) => receiver!.listen(0, "127.0.0.1", resolve));
  const port = (receiver!.address() as AddressInfo).port;
  callbackUrl = `http://127.0.0.1:${port}/api/games/providers/chartvolt-games/events`;
}

/**
 * Boots MongoDB, the service and the fake platform.
 *
 * The environment is set BEFORE `createApp` is imported, because `loadConfig` caches on first read
 * and the module graph would otherwise capture whatever was set at import time. Reason this is worth
 * a comment: the failure is a config object full of defaults, which produces a 401 on every
 * request and reads exactly like a signing bug.
 */
export async function startService(
  options: { sandbox?: boolean; sweepMs?: number; runSweeper?: boolean } = {},
): Promise<void> {
  memory = await MongoMemoryServer.create();

  process.env.GAMES_MONGODB_URI = memory.getUri();
  process.env.GAMES_DB_NAME = "chartvolt_games_test";
  process.env.GAMES_API_KEY = API_KEY;
  process.env.GAMES_API_SECRET = API_SECRET;
  process.env.GAMES_CALLBACK_TOKEN = CALLBACK_TOKEN;
  process.env.GAMES_CALLBACK_SECRET = CALLBACK_SECRET;
  process.env.GAMES_SANDBOX = options.sandbox ? "true" : "false";
  // A fast tick so the tests exercise the real timer rather than calling `sweepOnce` by hand. The
  // overlap guard and the retry scheduling only exist on the timer's path.
  process.env.GAMES_SWEEP_MS = String(options.sweepMs ?? 150);
  delete process.env.GAMES_CALLBACK_HOST_ALLOWLIST;

  await startReceiver();

  const { resetConfigForTests } = await import("../src/config");
  resetConfigForTests();

  const { connectToDatabase } = await import("../src/store/db");
  await connectToDatabase();

  const { createApp } = await import("../src/app");
  const app = createApp();

  server = http.createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const port = (server!.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;

  // `publicUrl` is read when a launch URL is built, so it has to agree with the port we just got.
  process.env.GAMES_PUBLIC_URL = baseUrl;
  resetConfigForTests();

  if (options.runSweeper !== false) {
    const { startSweeper } = await import("../src/callback/sweeper");
    startSweeper();
  }
}

export async function stopService(): Promise<void> {
  const { stopSweeper } = await import("../src/callback/sweeper");
  await stopSweeper();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  await new Promise<void>((resolve) => (receiver ? receiver.close(() => resolve()) : resolve()));
  await mongoose.disconnect();
  if (memory) await memory.stop();
}

export async function clearRounds(): Promise<void> {
  const { Round } = await import("../src/store/round.model");
  await Round.deleteMany({});
  received.length = 0;
  receiverBehaviour.status = 200;
  receiverBehaviour.failTimes = 0;
}

/* ------------------------------------------------------------------------------------------
 * Signed requests, the way the platform makes them
 * ----------------------------------------------------------------------------------------- */

export interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
  raw: string;
}

export interface CallOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** Overrides, so a test can present a wrong key, a stale timestamp or a broken signature. */
  apiKey?: string;
  secret?: string;
  timestamp?: number;
  signature?: string;
  omitSignature?: boolean;
}

export async function callApi<T = Record<string, unknown>>(
  path: string,
  options: CallOptions = {},
): Promise<ApiResponse<T>> {
  const method = options.method ?? "GET";
  // Serialise once. The same string is signed and sent, which is the rule the specification spells
  // out in its own signing example and the one this harness must not quietly break.
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const timestamp = (options.timestamp ?? Math.floor(Date.now() / 1000)).toString();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey ?? API_KEY}`,
    "X-Timestamp": timestamp,
  };
  if (body) headers["Content-Type"] = "application/json";

  if (!options.omitSignature) {
    const signature =
      options.signature ??
      crypto
        .createHmac("sha256", options.secret ?? API_SECRET)
        .update(body, "utf8")
        .digest("hex");
    headers["X-Signature"] = `sha256=${signature}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body || undefined,
  });

  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  return { status: response.status, body: parsed as T, raw };
}

/** The play surface holds only a launch token, so these calls carry no API credentials at all. */
export async function callPlay<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method: "GET" | "POST" = "POST",
): Promise<ApiResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  let parsed: unknown = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  return { status: response.status, body: parsed as T, raw };
}

export function tokenFromLaunchUrl(launchUrl: string): string {
  return new URL(launchUrl).searchParams.get("t") ?? "";
}

/* ------------------------------------------------------------------------------------------
 * Test runner
 * ----------------------------------------------------------------------------------------- */

let passed = 0;
let failed = 0;
const failures: string[] = [];

export async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
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

export function summary(label: string): number {
  console.log("");
  console.log(`${label}: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  return failed;
}

/** Waits for a condition, so a test never depends on a fixed sleep. */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${what}`);
}
