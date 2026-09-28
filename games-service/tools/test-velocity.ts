/**
 * Volt Velocity against the REAL race server.
 *
 * WHY THE RACE SERVER IS SPAWNED RATHER THAN STUBBED
 * -------------------------------------------------
 * Every contract here is between two programs written by two teams: the room id, the seat
 * registration, the ticket format and the receipt signature. A stubbed race server proves only
 * that this service agrees with the stub. Spawning `velocity-server/server/start.mjs` (the PM2 entry point) proves the
 * two halves agree with each other, which is the only claim worth making.
 *
 * It is spawned as a PROCESS and its track list is read as TEXT, never imported:
 * `check:isolation` forbids this service importing anything outside its own folder, and a test
 * import would be exactly the shared code that rule exists to prevent.
 *
 * WHAT IS NOT COVERED, AND WHY
 * ---------------------------
 * A race that runs to the flag takes five minutes of real time and needs two clients steering, so
 * the finished-race path is covered by `scoreForEntry` on hand-built entries plus a receipt the
 * real server signed. A cancelled race exercises the whole settle path end to end.
 */

import { spawn, type ChildProcess } from "child_process";
import crypto from "crypto";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";

import {
  callApi,
  callPlay,
  clearRounds,
  received,
  startService,
  stopService,
  summary,
  test,
  tokenFromLaunchUrl,
  waitFor,
} from "./api-harness";

const RACE_ROOT = path.resolve(__dirname, "..", "..", "velocity-server");
const TICKET_SECRET = crypto.randomBytes(32).toString("hex");
const ADMIN_KEY = crypto.randomBytes(32).toString("hex");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

let race: ChildProcess | null = null;
let raceUrl = "";

async function startRaceServer(dataDir: string): Promise<void> {
  const port = await freePort();
  raceUrl = `http://127.0.0.1:${port}`;
  race = spawn(process.execPath, ["server/start.mjs"], {
    cwd: RACE_ROOT,
    env: {
      ...process.env,
      // The same names games-service reads: the race server shares its .env.
      VELOCITY_TICKET_SECRET: TICKET_SECRET,
      VELOCITY_ADMIN_KEY: ADMIN_KEY,
      VELOCITY_DATA_DIR: dataDir,
      VELOCITY_RACE_URL: `http://127.0.0.1:${port}`,
      // A PORT that is not the race port proves the shared file's PORT is ignored.
      PORT: "1",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitFor(
    async () => {
      try {
        return (await fetch(`${raceUrl}/health`)).ok;
      } catch {
        return false;
      }
    },
    "the race server to answer /health",
    10_000,
  );
}

function adminGet(pathname: string): Promise<Response> {
  return fetch(`${raceUrl}${pathname}`, { headers: { Authorization: `Bearer ${ADMIN_KEY}` } });
}

function velocityBody(contentSeed: string, overrides: Record<string, unknown> = {}) {
  return {
    roundId: `cv_rnd_${crypto.randomBytes(5).toString("hex")}`,
    gameCode: "volt-velocity",
    mode: "ranked",
    player: {
      playerId: `cv_p_${crypto.randomBytes(4).toString("hex")}`,
      displayName: "Racer One",
      locale: "en",
      country: "GR",
    },
    config: { trackId: "auto" },
    contentSeed,
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    resultCallbackUrl: "",
    returnUrl: "https://chartvolt.test/contests/1",
    parentOrigin: "https://chartvolt.test",
    ...overrides,
  };
}

async function main(): Promise<number> {
  if (!fs.existsSync(path.join(RACE_ROOT, "node_modules"))) {
    // Loud, not silent: a skipped suite that prints nothing reads as a passing one.
    console.log("SKIPPED: velocity-server/node_modules is missing. Run `npm ci` in velocity-server.");
    return 0;
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cv-velocity-"));
  const clientFile = path.join(scratch, "Volt-Velocity-3D.html");
  fs.writeFileSync(clientFile, "<!doctype html><title>stub client</title>");
  await startRaceServer(path.join(scratch, "race-data"));

  // Set BEFORE startService, which resets the config cache after writing its own variables.
  process.env.VELOCITY_ADMIN_KEY = ADMIN_KEY;
  process.env.VELOCITY_TICKET_SECRET = TICKET_SECRET;
  process.env.VELOCITY_RACE_URL = raceUrl;
  process.env.VELOCITY_PUBLIC_RACE_URL = raceUrl;
  process.env.VELOCITY_CLIENT_FILE = clientFile;
  await startService({ sandbox: true });
  const { callbackUrl } = await import("./api-harness");
  const { Round } = await import("../src/store/round.model");
  const { VELOCITY_TRACK_IDS, AUTO_TRACK_POOL, trackForSeed } = await import(
    "../src/games/volt-velocity/tracks"
  );
  const { verifyReceipt, scoreForEntry, raceIdentity } = await import("../src/games/volt-velocity/race-server");
  const { latestRaceStart, parseStartWait } = await import("../src/games/volt-velocity/launch");

  console.log("Volt Velocity against the real race server");

  await test("our track list matches the race server's, id for id and in order", () => {
    const source = fs.readFileSync(path.join(RACE_ROOT, "src", "tracks.js"), "utf8");
    const block = source.slice(source.indexOf("TRACKS=["), source.indexOf("];", source.indexOf("TRACKS=[")));
    assert(block.length > 20, "could not find the TRACKS block in tracks.js");
    const theirs = [...block.matchAll(/\{id:'([^']+)'/g)].map((m) => m[1]);
    assert(
      JSON.stringify(theirs) === JSON.stringify([...VELOCITY_TRACK_IDS]),
      `track drift: race server ${theirs.join(",")} vs ours ${VELOCITY_TRACK_IDS.join(",")}`,
    );
  });

  // Reason: "auto" is a modulo over the pool, so a pool that grew with the track list would move
  // a running contest onto a different track between two of its rounds.
  await test("auto picks from the original fifteen tracks, whatever is added later", () => {
    const original = VELOCITY_TRACK_IDS.slice(0, 15);
    assert(JSON.stringify([...AUTO_TRACK_POOL]) === JSON.stringify(original), "auto pool changed");
    assert(Object.isFrozen(AUTO_TRACK_POOL), "auto pool is not frozen");
    for (let seed = 0; seed < 60; seed += 1) {
      assert(trackForSeed(seed) === original[seed % 15], `seed ${seed} moved to ${trackForSeed(seed)}`);
    }
    assert(!AUTO_TRACK_POOL.includes("nebula"), "a new track leaked into auto");
  });

  // Reason: this test used to assert practice was REFUSED, because the race server had no room
  // for one pilot. Anytime competitions later gained a solo room, and practice is that same room
  // with nothing at stake - so the refusal is inverted, not deleted. No content seed is sent,
  // exactly as the platform sends none for practice; the track seeds from the round's own id.
  await test("practice seats one pilot in a room of their own, with no content seed", async () => {
    await clearRounds();
    const bodies = [0, 1].map(() =>
      velocityBody("", { mode: "practice", contestType: "practice", contentSeed: undefined, resultCallbackUrl: callbackUrl }),
    );
    for (const body of bodies) {
      const created = await callApi("/v1/rounds", { method: "POST", body });
      assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);
    }
    const rounds = await Round.find({ mode: "practice" }).lean();
    const raceIds = new Set(rounds.map((r) => r.race?.raceId));
    assert(rounds.length === 2 && raceIds.size === 2 && !raceIds.has(undefined), "practice rounds shared a room");
    // Separate ids alone cannot prove the room is SOLO: the round-id seed already makes every
    // practice id unique, so an open-roster room would pass the check above. The solo key is
    // what freezes the roster at one pilot, and it is visible only in the id it produces.
    for (const round of rounds) {
      const solo = raceIdentity("volt-velocity", round.providerRoundId, "auto", undefined, 3, round.providerRoundId);
      assert(round.race?.raceId === solo.raceId, "practice room is not a solo room");
    }
  });

  await test("a practice round with a start time is refused", async () => {
    const response = await callApi("/v1/rounds", {
      method: "POST",
      body: velocityBody("", {
        mode: "practice",
        contestType: "practice",
        contentSeed: undefined,
        scheduledStartAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        resultCallbackUrl: callbackUrl,
      }),
    });
    assert(response.status === 400, `expected 400, got ${response.status}`);
  });

  await test("a ranked round seats the player, and two entrants share one room", async () => {
    await clearRounds();
    const seed = `cv_vv_room_${crypto.randomBytes(3).toString("hex")}`;
    const a = await callApi<{ providerRoundId: string }>("/v1/rounds", {
      method: "POST",
      body: velocityBody(seed, { resultCallbackUrl: callbackUrl }),
    });
    const b = await callApi<{ providerRoundId: string }>("/v1/rounds", {
      method: "POST",
      body: velocityBody(seed, { resultCallbackUrl: callbackUrl }),
    });
    assert(a.status === 201 && b.status === 201, `create returned ${a.status} / ${b.status}: ${a.raw}`);
    const rounds = await Round.find({ contentSeed: seed }).lean();
    assert(rounds.length === 2, `expected 2 rounds, found ${rounds.length}`);
    const raceIds = new Set(rounds.map((r) => r.race?.raceId));
    assert(raceIds.size === 1 && !raceIds.has(undefined), "the two entrants were not put in one room");
    const result = await adminGet(`/v1/races/${rounds[0].race!.raceId}/result`);
    assert(result.status === 202, `the race server does not know the room (HTTP ${result.status})`);
  });

  await test("the session hands out a ticket the race server accepts, never in a URL", async () => {
    await clearRounds();
    const created = await callApi<{ launchUrl: string; providerRoundId: string }>("/v1/rounds", {
      method: "POST",
      body: velocityBody(`cv_vv_ticket_${crypto.randomBytes(3).toString("hex")}`, {
        resultCallbackUrl: callbackUrl,
      }),
    });
    assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);
    const launch = new URL(created.body.launchUrl);
    assert([...launch.searchParams.keys()].join() === "t", `launch URL carries ${launch.search}`);

    const session = await callPlay<{
      ticket?: string;
      raceId?: string;
      clientUrl?: string;
      raceUrl?: string;
      status?: string;
    }>("/play/api/velocity/session", { t: tokenFromLaunchUrl(created.body.launchUrl) });
    assert(session.status === 200, `session returned ${session.status}: ${session.raw}`);
    const { ticket, raceId, clientUrl } = session.body;
    assert(ticket && raceId && clientUrl, `session is missing fields: ${session.raw}`);
    assert(session.body.status === "in_progress", `round not opened: ${session.body.status}`);
    assert(!clientUrl.includes(ticket) && !(session.body.raceUrl ?? "").includes(ticket), "ticket in a URL");
    assert(!created.body.launchUrl.includes(ticket), "ticket in the launch URL");

    const join = await fetch(`${raceUrl}/v1/races/${raceId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ticket}` },
    });
    assert(join.status === 200, `the race server refused our ticket (HTTP ${join.status})`);

    const forged = ticket.slice(0, -2) + (ticket.endsWith("AA") ? "BB" : "AA");
    const refused = await fetch(`${raceUrl}/v1/races/${raceId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${forged}` },
    });
    assert(refused.status === 401, `a tampered ticket was accepted (HTTP ${refused.status})`);

    const client = await fetch(`${callApiBase()}${clientUrl}`);
    assert(client.status === 200, `client not served (HTTP ${client.status})`);

    // The lobby's background download must fetch EXACTLY the URL the session hands out, or the
    // warmed copy sits in the cache under a name the race never asks for.
    // An overriding single-file build has its assets inline, so the list is the page alone.
    const warm = await fetch(`${callApiBase()}/play/warmup/volt-velocity`);
    assert(warm.status === 200, `warmup returned ${warm.status}`);
    assert(warm.headers.get("cache-control") === "no-store", "warmup list is cacheable");
    const { urls } = (await warm.json()) as { urls?: string[] };
    assert(
      JSON.stringify(urls) === JSON.stringify([clientUrl]),
      `warmup lists ${JSON.stringify(urls)}, expected only ${clientUrl}`,
    );
  });

  await test("packed client assets are served immutable, and nothing else is", async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "vendor", "volt-velocity", "manifest.json"), "utf8"),
    ) as { assets: Array<{ file: string }> };
    const glb = manifest.assets.find((entry) => entry.file.endsWith(".glb"));
    assert(glb, "the packed manifest lists no model");
    const asset = await fetch(`${callApiBase()}/play/volt-velocity/client/assets/${glb.file}`);
    assert(asset.status === 200, `asset returned ${asset.status}`);
    assert(asset.headers.get("content-type") === "model/gltf-binary", `type ${asset.headers.get("content-type")}`);
    assert(/immutable/.test(asset.headers.get("cache-control") ?? ""), "asset is not immutable");
    assert(asset.headers.get("x-content-type-options") === "nosniff", "asset is sniffable");
    await asset.arrayBuffer();

    for (const bad of [
      "0000000000000000.glb",
      glb.file.toUpperCase(),
      glb.file.replace(".glb", ".js"),
      "..%2Fmanifest.json",
      "manifest.json",
    ]) {
      const refused = await fetch(`${callApiBase()}/play/volt-velocity/client/assets/${bad}`);
      assert(refused.status === 404, `${bad} returned ${refused.status}`);
    }
  });

  await test("warmup answers 204 for a game with no client to download", async () => {
    const other = await fetch(`${callApiBase()}/play/warmup/circuit-sprint`, { redirect: "manual" });
    assert(other.status === 204, `expected 204, got ${other.status}`);
  });

  await test("a scheduled race nobody joins is cancelled, and the round is voided with no score", async () => {
    await clearRounds();
    const seed = `cv_vv_cancel_${crypto.randomBytes(3).toString("hex")}`;
    const created = await callApi<{ providerRoundId: string }>("/v1/rounds", {
      method: "POST",
      body: velocityBody(seed, {
        resultCallbackUrl: callbackUrl,
        // The race server waits past the start for two Ready pilots until `latestStartAt`, then
        // cancels. A round ending two minutes out leaves no room for a 3-lap race after the
        // start, so `latestRaceStart` clamps the latest start to the start itself.
        scheduledStartAt: new Date(Date.now() + 7_000).toISOString(),
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      }),
    });
    assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);

    await waitFor(
      () => received.some((c) => c.body.providerRoundId === created.body.providerRoundId),
      "the voided delivery",
      30_000,
    );
    const delivery = received.find((c) => c.body.providerRoundId === created.body.providerRoundId)!;
    assert(delivery.signatureValid, "the delivery was not signed correctly");
    assert(delivery.body.status === "voided", `expected voided, got ${String(delivery.body.status)}`);
    assert(delivery.body.score === undefined && delivery.body.rawScore === undefined, "a voided race carried a score");

    const round = await Round.findOne({ contentSeed: seed }).lean();
    const receipt = (await (await adminGet(`/v1/races/${round!.race!.raceId}/result`)).json()) as Record<
      string,
      unknown
    >;
    const verified = verifyReceipt(TICKET_SECRET, receipt);
    assert(verified.status === "cancelled", `receipt status ${verified.status}`);

    let tamperRefused = false;
    try {
      verifyReceipt(TICKET_SECRET, {
        ...receipt,
        signedPayload: String(receipt.signedPayload).replace('"cancelled"', '"finished"'),
      });
    } catch {
      tamperRefused = true;
    }
    assert(tamperRefused, "a tampered receipt verified");
  });

  await test("the latest start leaves a full race inside the round, never before the start", () => {
    const start = new Date("2026-09-28T12:00:00Z");
    const hourLater = new Date(start.getTime() + 3_600_000);
    // 3 laps = 300 s of race, plus the 10 s countdown and a 30 s margin.
    assert(latestRaceStart(start, hourLater, 3).getTime() === hourLater.getTime() - 340_000, "3-lap latest start");
    assert(latestRaceStart(start, hourLater, 10).getTime() === hourLater.getTime() - 1_040_000, "10-lap latest start");
    const tight = new Date(start.getTime() + 60_000);
    assert(latestRaceStart(start, tight, 3).getTime() === start.getTime(), "latest start fell before the start");
    const far = new Date(start.getTime() + 24 * 3_600_000);
    assert(latestRaceStart(start, far, 1).getTime() === start.getTime() + 6 * 3_600_000, "past the 6 h horizon");
  });

  await test("the platform's waiting limit caps the latest start, and a bad limit is refused", () => {
    const start = new Date("2026-09-28T12:00:00Z");
    const hourLater = new Date(start.getTime() + 3_600_000);
    // 300 s of waiting is earlier than the full-race fit (3,260 s), so the wait decides.
    assert(latestRaceStart(start, hourLater, 3, 300).getTime() === start.getTime() + 300_000, "wait did not cap");
    // A wait longer than the fit never lets the race overrun the round: 30 laps leave only
    // 560 s to start in, which is earlier than the 900 s wait, so the fit decides.
    assert(
      latestRaceStart(start, hourLater, 30, 900).getTime() === start.getTime() + 560_000,
      "a long wait let the race overrun the round",
    );
    assert(parseStartWait(undefined, start) === undefined, "absent wait was invented");
    assert(parseStartWait(600, start) === 600, "a valid wait was lost");
    for (const bad of [59, 901, 300.5, "300", 0]) {
      let refused = false;
      try {
        parseStartWait(bad, start);
      } catch {
        refused = true;
      }
      assert(refused, `wait ${String(bad)} was accepted`);
    }
    let unscheduledRefused = false;
    try {
      parseStartWait(300, undefined);
    } catch {
      unscheduledRefused = true;
    }
    assert(unscheduledRefused, "a wait without a scheduled start was accepted");
  });

  await test("a room the race server has lost is voided once it is old enough", async () => {
    await clearRounds();
    const created = await callApi<{ providerRoundId: string }>("/v1/rounds", {
      method: "POST",
      body: velocityBody(`cv_vv_lost_${crypto.randomBytes(3).toString("hex")}`, {
        resultCallbackUrl: callbackUrl,
      }),
    });
    assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);
    // Raw driver, so Mongoose's timestamps cannot put `createdAt` back to now.
    await Round.collection.updateOne(
      { providerRoundId: created.body.providerRoundId },
      {
        $set: { "race.raceId": "vv-lost-room-000", createdAt: new Date(Date.now() - 5 * 60_000) },
        $unset: { "race.lastPolledAt": "" },
      },
    );
    await waitFor(
      async () =>
        (await Round.findOne({ providerRoundId: created.body.providerRoundId }).lean())?.status === "voided",
      "the lost room's round to be voided",
      10_000,
    );
  });

  await test("an anytime competition gives every player a room of their own", async () => {
    await clearRounds();
    const seed = `cv_vv_solo_${crypto.randomBytes(3).toString("hex")}`;
    const bodies = [0, 1].map(() => velocityBody(seed, { resultCallbackUrl: callbackUrl, contestType: "competition" }));
    for (const body of bodies) {
      const created = await callApi("/v1/rounds", { method: "POST", body });
      assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);
    }
    const rounds = await Round.find({ contentSeed: seed }).lean();
    const raceIds = new Set(rounds.map((r) => r.race?.raceId));
    assert(rounds.length === 2 && raceIds.size === 2 && !raceIds.has(undefined), "solo rounds shared a room");
  });

  await test("a challenge shares one room and races 3 laps whatever was asked for", async () => {
    await clearRounds();
    const seed = `cv_vv_chal_${crypto.randomBytes(3).toString("hex")}`;
    for (const laps of [7, 3]) {
      const created = await callApi("/v1/rounds", {
        method: "POST",
        body: velocityBody(seed, {
          resultCallbackUrl: callbackUrl,
          contestType: "challenge",
          config: { trackId: "auto", laps },
        }),
      });
      assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);
    }
    const rounds = await Round.find({ contentSeed: seed }).lean();
    assert(rounds.every((r) => (r.config as { laps?: number }).laps === 3), "a challenge raced other than 3 laps");
    assert(new Set(rounds.map((r) => r.race?.raceId)).size === 1, "the two challengers were not put in one room");
  });

  await test("the lap count is part of the room, and a bad contestType is refused", async () => {
    await clearRounds();
    const seed = `cv_vv_laps_${crypto.randomBytes(3).toString("hex")}`;
    for (const laps of [3, 5]) {
      const created = await callApi("/v1/rounds", {
        method: "POST",
        body: velocityBody(seed, { resultCallbackUrl: callbackUrl, config: { trackId: "auto", laps } }),
      });
      assert(created.status === 201, `create returned ${created.status}: ${created.raw}`);
    }
    const rounds = await Round.find({ contentSeed: seed }).lean();
    assert(new Set(rounds.map((r) => r.race?.raceId)).size === 2, "a 3-lap and a 5-lap race shared a room");
    assert(rounds.some((r) => (r.config as { laps?: number }).laps === 5), "5 laps did not resolve to 5");

    const bad = await callApi("/v1/rounds", {
      method: "POST",
      body: velocityBody(seed, { resultCallbackUrl: callbackUrl, contestType: "duel" }),
    });
    assert(bad.status === 400, `expected 400 for an unknown contestType, got ${bad.status}`);
  });

  await test("a faster time always wins, and points only break an exact tie", () => {
    const base = { playerId: "p", bestLapMs: 40_000, lapsCompleted: 3, dnf: false, finished: true };
    const fastFewPoints = scoreForEntry({ ...base, timeMs: 100_000, skillScore: 0 }).score!;
    const slowManyPoints = scoreForEntry({ ...base, timeMs: 100_001, skillScore: 999_999 }).score!;
    const tiedMorePoints = scoreForEntry({ ...base, timeMs: 100_000, skillScore: 500 }).score!;
    assert(fastFewPoints < slowManyPoints, "points beat a faster time");
    assert(tiedMorePoints < fastFewPoints, "more points did not win a tied time");
    assert(scoreForEntry({ ...base, timeMs: 100_000, skillScore: 10 ** 9 }).score! > 99_999, "points uncapped");
  });

  await test("only a finisher without a DNF scores, and a missing entry scores nothing", () => {
    const base = { playerId: "p", bestLapMs: 40_000, lapsCompleted: 3, skillScore: 0 };
    assert(scoreForEntry({ ...base, dnf: false, finished: true, timeMs: 123_456 }).score === 123_456, "finisher");
    assert(scoreForEntry({ ...base, dnf: true, finished: true, timeMs: 123_456 }).score === undefined, "DNF");
    assert(scoreForEntry({ ...base, dnf: false, finished: false, timeMs: null }).score === undefined, "unfinished");
    assert(scoreForEntry(undefined).score === undefined, "absent entry");
  });

  const failed = summary("Volt Velocity");
  await stopService();
  race?.kill();
  fs.rmSync(scratch, { recursive: true, force: true });
  return failed;
}

function callApiBase(): string {
  return process.env.GAMES_PUBLIC_URL ?? "";
}

main()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((error) => {
    console.error(error);
    race?.kill();
    process.exit(1);
  });
