/**
 * Paid entry must refuse whenever the player could not play or trade afterwards.
 *
 * THE DEFECT. Entry used to ask only status + registration deadline. For provider contests
 * the deadline is floored at the play-window end so late joiners can enter a *running* race.
 * Once the shared race has finished or been cancelled, Join still took a fee and Play refused.
 *
 * These tests pin the shared helper and the two call sites that must use it (entry before any
 * wallet read; launch before createRound). A mid-race DNF must NOT close entry while others
 * are still racing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
  ensureCollections,
} from "../helpers/mongo-test-server";
import GameRound from "@/database/models/games/game-round.model";
import {
  contestClockHasEnded,
  scheduledRaceUnjoinable,
  explainWhyEntryIsUnplayable,
} from "@/lib/services/games/contest-playability";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("contestClockHasEnded", () => {
  const now = new Date("2026-10-15T12:00:00.000Z");

  it("refuses a provider contest past its play window", () => {
    const msg = contestClockHasEnded(
      {
        gameType: "provider",
        playWindowEnd: new Date("2026-10-15T11:00:00.000Z"),
      },
      now,
    );
    expect(msg).toMatch(/already ended/i);
  });

  it("refuses a trading contest past endTime", () => {
    const msg = contestClockHasEnded(
      {
        gameType: "trading",
        endTime: new Date("2026-10-15T11:00:00.000Z"),
      },
      now,
    );
    expect(msg).toMatch(/already ended/i);
  });

  it("allows entry while the clock is still open", () => {
    expect(
      contestClockHasEnded(
        {
          gameType: "provider",
          playWindowEnd: new Date("2026-10-15T13:00:00.000Z"),
        },
        now,
      ),
    ).toBeNull();
  });
});

describe("scheduledRaceUnjoinable", () => {
  beforeAll(async () => {
    const uri = await startTestMongo();
    await mongoose.connect(uri);
    await ensureCollections(["game_round"]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await stopTestMongo();
  });

  beforeEach(async () => {
    await clearTestMongo();
  });

  const contestId = () => new mongoose.Types.ObjectId();

  async function seedRound(
    id: mongoose.Types.ObjectId,
    userId: string,
    status: string,
    rawScore?: number,
  ) {
    return GameRound.create({
      roundId: `cv_rnd_${userId}_${status}_${Math.random().toString(16).slice(2)}`,
      providerKey: "chartvolt-games",
      gameCode: "volt-velocity",
      gameKey: "provider:chartvolt-games:volt-velocity",
      userId,
      contestType: "competition",
      contestId: id,
      attemptNumber: 1,
      mode: "ranked",
      status,
      rawScore,
      expiresAt: new Date(Date.now() + 600_000),
    });
  }

  it("ignores non-scheduled contests", async () => {
    const id = contestId();
    await seedRound(id, "aaaaaaaaaaaaaaaaaaaaaaaa", "completed", 1200);
    expect(
      await scheduledRaceUnjoinable({
        _id: id,
        gameType: "provider",
        playMode: "anytime",
      }),
    ).toBeNull();
  });

  it("refuses when the start-wait passed and nobody ever began", async () => {
    const id = contestId();
    const start = new Date("2026-10-15T10:00:00.000Z");
    // One pending round alone is still "never started" for playNeverStarted.
    await seedRound(id, "aaaaaaaaaaaaaaaaaaaaaaaa", "pending");

    const msg = await scheduledRaceUnjoinable(
      {
        _id: id,
        gameType: "provider",
        playMode: "scheduled",
        playWindowStart: start,
        startWaitSeconds: 300,
      },
      new Date("2026-10-15T10:10:00.000Z"),
    );
    expect(msg).toMatch(/fewer than two players/i);
  });

  it("refuses when scored rounds exist and nobody is still live", async () => {
    const id = contestId();
    await seedRound(id, "aaaaaaaaaaaaaaaaaaaaaaaa", "completed", 900);
    await seedRound(id, "bbbbbbbbbbbbbbbbbbbbbbbb", "completed", 800);

    const msg = await scheduledRaceUnjoinable({
      _id: id,
      gameType: "provider",
      playMode: "scheduled",
      playWindowStart: new Date("2026-10-15T10:00:00.000Z"),
      startWaitSeconds: 300,
    });
    expect(msg).toMatch(/already finished/i);
  });

  it("keeps entry open when one player DNFs while another is still racing", async () => {
    const id = contestId();
    await seedRound(id, "aaaaaaaaaaaaaaaaaaaaaaaa", "abandoned", 0);
    await seedRound(id, "bbbbbbbbbbbbbbbbbbbbbbbb", "launched");

    expect(
      await scheduledRaceUnjoinable({
        _id: id,
        gameType: "provider",
        playMode: "scheduled",
        playWindowStart: new Date("2026-10-15T10:00:00.000Z"),
        startWaitSeconds: 300,
      }),
    ).toBeNull();
  });
});

describe("explainWhyEntryIsUnplayable ordering", () => {
  it("names a paused contest before the clock", async () => {
    const block = await explainWhyEntryIsUnplayable({
      isPaused: true,
      pauseReason: "incident",
      gameType: "trading",
      endTime: new Date("2099-01-01T00:00:00.000Z"),
    });
    expect(block?.code).toBe("contest_paused");
    expect(block?.error).toMatch(/paused/i);
  });
});

describe("wiring - entry and launch ask the same facts", () => {
  it("enterContest calls playability after the seat check and before wallet work", () => {
    const src = stripComments(read("lib/services/contest-entry.service.ts"));
    const playabilityAt = src.indexOf("explainWhyEntryIsUnplayable(");
    const existingAt = src.indexOf("CompetitionParticipant.findOne");
    const walletAt = src.indexOf("CreditWallet.findOne");
    expect(playabilityAt).toBeGreaterThan(-1);
    expect(existingAt).toBeGreaterThan(-1);
    expect(walletAt).toBeGreaterThan(-1);
    expect(playabilityAt).toBeGreaterThan(existingAt);
    expect(playabilityAt).toBeLessThan(walletAt);
  });

  it("launch refuses clock-ended and race-unjoinable before createRound", () => {
    const src = stripComments(read("lib/services/games/round-launch.service.ts"));
    const clockAt = src.indexOf("contestClockHasEnded");
    const raceAt = src.indexOf("scheduledRaceUnjoinable");
    const createAt = src.indexOf("createRound(");
    expect(clockAt).toBeGreaterThan(-1);
    expect(raceAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(-1);
    expect(Math.max(clockAt, raceAt)).toBeLessThan(createAt);
    expect(src).toMatch(/race_unjoinable/);
  });

  it("Join Late is permanently disabled for race_unjoinable", () => {
    const preflight = read("components/games/RoundPreflight.tsx");
    expect(preflight).toMatch(/PERMANENT_LAUNCH_REFUSALS/);
    expect(preflight).toMatch(/"race_unjoinable"/);
  });

  it("the join route maps the new failure codes", () => {
    const route = read("app/api/competitions/[id]/join/route.ts");
    expect(route).toMatch(/unplayable:\s*409/);
    expect(route).toMatch(/contest_paused:\s*409/);
    expect(route).toMatch(/title_unavailable:\s*503/);
  });
});
