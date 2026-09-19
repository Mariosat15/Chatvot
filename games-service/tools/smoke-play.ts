/**
 * Opens a real, playable round in a real browser, with no platform and no database to install.
 *
 * WHY THIS EXISTS AS A CHECKED-IN TOOL AND NOT AS A ONE-OFF
 * -------------------------------------------------------
 * Every test in this service drives the game through code. Not one of them can tell you whether a
 * finger on a phone can draw a line, whether the grid fits above the browser chrome, or whether
 * the Submit button is reachable - and this platform has twice shipped a lifecycle that was
 * complete by API and unreachable by clicking. A tool that prints a URL you can open is the
 * cheapest possible guard against a third.
 *
 * It boots an in-memory MongoDB, so it needs no local database, and it signs the create-round call
 * exactly as the platform would - which means the round it opens is indistinguishable from a real
 * one and every deadline, seed and attempt rule applies.
 *
 *   npx tsx tools/smoke-play.ts                          # Circuit Sprint, 120s, medium grid
 *   npx tsx tools/smoke-play.ts circuit-perfect           # the lower-is-better sibling
 *   npx tsx tools/smoke-play.ts circuit-sprint small 60    # a quick one to watch expire
 *
 * The round is RANKED, so a contest seed is supplied and the result is delivered to a callback
 * receiver that verifies the signature the way the platform does - the delivery is printed, so this
 * also shows the score the player earned without ever sending it to the browser.
 */

import crypto from "crypto";
import http from "http";
import type { AddressInfo } from "net";

import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = Number(process.env.SMOKE_PORT ?? 4010);
const API_KEY = "smoke_api_key_aaaaaaaaaaaaaaaa";
const API_SECRET = "smoke_api_secret_bbbbbbbbbbbbbb";
const CALLBACK_TOKEN = "smoke_cb_token_cccccccccccccc";
const CALLBACK_SECRET = "smoke_cb_secret_dddddddddddddd";

const [gameCode = "circuit-sprint", gridSize = "medium", durationOrBoards] = process.argv.slice(2);

function configFor(): Record<string, unknown> {
  if (gameCode === "circuit-perfect") {
    return {
      boardCount: Number(durationOrBoards ?? 3),
      gridSize,
      unfinishedPenaltyMs: 120_000,
    };
  }
  return { durationSeconds: Number(durationOrBoards ?? 120), gridSize };
}

/** The fake platform: it verifies the callback signature, then prints what it was told. */
async function startReceiver(): Promise<string> {
  const receiver = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const offered = String(req.headers["x-signature"] ?? "").replace(/^sha256=/, "");
      const expected = crypto
        .createHmac("sha256", CALLBACK_SECRET)
        .update(rawBody, "utf8")
        .digest("hex");

      console.log("");
      console.log("📨 result callback received");
      console.log("   signature:", offered === expected ? "valid ✅" : "INVALID ❌");
      /*
       * Every field, not a chosen few - and that is a correction rather than a preference.
       *
       * The first version printed `body.scoreType` and `body.breakdown`. Neither exists: the
       * result body carries `scoreBreakdown`, and `scoreType` is a property of a catalogue title
       * rather than of a round. So the console showed an empty score type and an empty breakdown
       * for a round that had reported both correctly, which reads exactly like the service
       * failing to send them. A tool that names fields by hand is a tool that can report a defect
       * that is not there, so the named lines are now a summary ON TOP OF the whole payload.
       */
      try {
        const body = JSON.parse(rawBody) as Record<string, unknown>;
        console.log("   status:   ", body.status, `(${String(body.eventType ?? "no eventType")})`);
        console.log("   score:    ", body.score);
        console.log("   duration: ", body.durationMs, "ms");
        console.log("   breakdown:", JSON.stringify(body.scoreBreakdown ?? null));
        console.log("   integrity:", JSON.stringify(body.integrity ?? null));
        console.log("   full body:", JSON.stringify(body));
      } catch {
        console.log("   body:", rawBody);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    });
  });

  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", () => resolve()));
  const port = (receiver.address() as AddressInfo).port;
  return `http://127.0.0.1:${port}/api/games/providers/chartvolt-games/events`;
}

async function main(): Promise<void> {
  const memory = await MongoMemoryServer.create();

  process.env.GAMES_MONGODB_URI = memory.getUri();
  process.env.GAMES_DB_NAME = "chartvolt_games_smoke";
  process.env.GAMES_API_KEY = API_KEY;
  process.env.GAMES_API_SECRET = API_SECRET;
  process.env.GAMES_CALLBACK_TOKEN = CALLBACK_TOKEN;
  process.env.GAMES_CALLBACK_SECRET = CALLBACK_SECRET;
  process.env.GAMES_PUBLIC_URL = `http://localhost:${PORT}`;
  process.env.GAMES_SANDBOX = "true";
  delete process.env.GAMES_CALLBACK_HOST_ALLOWLIST;

  const resultCallbackUrl = await startReceiver();

  const { resetConfigForTests } = await import("../src/config");
  resetConfigForTests();

  const { connectToDatabase } = await import("../src/store/db");
  await connectToDatabase();

  const { createApp } = await import("../src/app");
  const server = http.createServer(createApp());
  // A named refusal rather than an unhandled 'error' event, which prints a stack trace whose top
  // frame is this line and whose message is buried three lines down. The common cause is a
  // previous run of this same tool still holding the port.
  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${PORT} is already in use - an earlier smoke run is probably still going. ` +
              `Stop it, or set SMOKE_PORT to something else.`,
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen(PORT, () => resolve());
  });

  const { startSweeper } = await import("../src/callback/sweeper");
  startSweeper();

  // Signed exactly as the platform signs it: the same string is hashed and sent, which is the one
  // rule a hand-rolled client gets wrong.
  const body = JSON.stringify({
    roundId: `cv_rnd_smoke_${crypto.randomBytes(4).toString("hex")}`,
    gameCode,
    mode: "ranked",
    player: { playerId: "cv_p_smoke", displayName: "Smoke Tester", locale: "en" },
    config: configFor(),
    contentSeed: "cv_ctst_smoke_contest",
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    resultCallbackUrl,
    returnUrl: `http://localhost:${PORT}/health`,
  });

  const response = await fetch(`http://127.0.0.1:${PORT}/v1/rounds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "X-Timestamp": Math.floor(Date.now() / 1000).toString(),
      "X-Signature": `sha256=${crypto.createHmac("sha256", API_SECRET).update(body, "utf8").digest("hex")}`,
    },
    body,
  });

  const created = (await response.json()) as { launchUrl?: string; error?: unknown };
  if (response.status !== 201 || !created.launchUrl) {
    console.error("❌ could not create a round:", response.status, created);
    process.exit(1);
  }

  console.log("");
  console.log(`🎮 ${gameCode} on a ${gridSize} grid is ready.`);
  console.log("");
  console.log(`   ${created.launchUrl}`);
  console.log("");
  console.log("   Open it. Drag between matching numbers, fill every square, Submit.");
  console.log("   The score is computed here and delivered over a signed callback - watch below.");
  console.log("   Ctrl+C to stop.");

  /*
   * `--reveal` prints the first board's solution, and it is worth being clear about why that is
   * safe here and would not be anywhere else.
   *
   * The seed is never exposed to a player - section 12 forbids it, and there is deliberately no
   * endpoint that returns content for a seed. This is not an endpoint: it is a local tool with its
   * own in-memory database that has already printed the launch token to the same console. What it
   * buys is the ability to prove a FULL solve by hand, which is the one thing no automated test
   * can do - a test drives the client's own input model, so it cannot tell you whether a finger
   * can complete a board on a real screen.
   */
  if (!process.argv.includes("--reveal")) return;

  const { Round } = await import("../src/store/round.model");
  const round = await Round.findOne({}).sort({ createdAt: -1 });
  if (!round) return;

  const { generateForPlayer } = await import("../src/engine/generate");
  const { shapeFor } = await import("../src/games/titles");
  const solution = generateForPlayer(
    round.contentSeed ?? round.providerRoundId,
    round.presentationSeed,
    0,
    shapeFor((round.config as { gridSize: "small" | "medium" | "large" }).gridSize),
  );

  console.log("");
  console.log("🔍 board 0, one valid covering (cells are [x, y], origin top-left):");
  for (const [id, path] of solution.solution.entries()) {
    console.log(`   pair ${id + 1}: ${path.map((cell) => `[${cell[0]},${cell[1]}]`).join(" ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
