import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isGameMasterActiveCompetition,
  countActiveCompetitionsInList,
  remainingActiveCompetitionSlots,
  gameMasterActiveCompetitionFilter,
  countGameMasterActiveCompetitions,
} from "@/lib/services/gamemaster/active-competitions";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("isGameMasterActiveCompetition", () => {
  it("counts a running contest", () => {
    expect(
      isGameMasterActiveCompetition({
        status: "active",
        currentParticipants: 0,
        minParticipants: 2,
      }),
    ).toBe(true);
  });

  it("counts a draft so unpublished slots cannot be stockpiled", () => {
    expect(
      isGameMasterActiveCompetition({
        status: "draft",
        currentParticipants: 0,
        minParticipants: 2,
      }),
    ).toBe(true);
  });

  it("counts an upcoming contest once min participants are met", () => {
    // Reason: the owner's rule — 2 of 2 joined, contest has not started yet → active.
    expect(
      isGameMasterActiveCompetition({
        status: "upcoming",
        currentParticipants: 2,
        minParticipants: 2,
      }),
    ).toBe(true);
  });

  it("does not count an empty upcoming contest waiting for sign-ups", () => {
    expect(
      isGameMasterActiveCompetition({
        status: "upcoming",
        currentParticipants: 1,
        minParticipants: 2,
      }),
    ).toBe(false);
  });

  it("does not count completed or cancelled contests", () => {
    expect(
      isGameMasterActiveCompetition({
        status: "completed",
        currentParticipants: 10,
        minParticipants: 2,
      }),
    ).toBe(false);
    expect(
      isGameMasterActiveCompetition({
        status: "cancelled",
        currentParticipants: 10,
        minParticipants: 2,
      }),
    ).toBe(false);
  });

  it("defaults minParticipants to 2 when absent", () => {
    expect(
      isGameMasterActiveCompetition({
        status: "upcoming",
        currentParticipants: 2,
      }),
    ).toBe(true);
    expect(
      isGameMasterActiveCompetition({
        status: "upcoming",
        currentParticipants: 1,
      }),
    ).toBe(false);
  });
});

describe("countActiveCompetitionsInList and remaining slots", () => {
  it("counts only contests that pass the active rule", () => {
    const n = countActiveCompetitionsInList([
      { status: "active", currentParticipants: 5, minParticipants: 2 },
      { status: "upcoming", currentParticipants: 2, minParticipants: 2 },
      { status: "upcoming", currentParticipants: 0, minParticipants: 2 },
      { status: "completed", currentParticipants: 8, minParticipants: 2 },
      { status: "draft", currentParticipants: 0, minParticipants: 2 },
    ]);
    expect(n).toBe(3);
  });

  it("floors remaining slots at zero", () => {
    expect(remainingActiveCompetitionSlots(4, 10)).toBe(6);
    expect(remainingActiveCompetitionSlots(10, 10)).toBe(0);
    expect(remainingActiveCompetitionSlots(12, 10)).toBe(0);
  });
});

describe("Mongo filter matches the pure helper", () => {
  it("filter keys gameMasterId and the three status branches", () => {
    const filter = gameMasterActiveCompetitionFilter("gm-1") as {
      gameMasterId: string;
      $or: Array<Record<string, unknown>>;
    };
    expect(filter.gameMasterId).toBe("gm-1");
    expect(filter.$or).toHaveLength(3);
    expect(filter.$or.some((b) => b.status === "active")).toBe(true);
    expect(filter.$or.some((b) => b.status === "draft")).toBe(true);
    const upcoming = filter.$or.find((b) => b.status === "upcoming");
    expect(upcoming).toBeDefined();
    expect(upcoming).toHaveProperty("$expr");
  });

  it("countGameMasterActiveCompetitions passes the shared filter", async () => {
    let seen: Record<string, unknown> | null = null;
    const db = {
      collection() {
        return {
          async countDocuments(filter: Record<string, unknown>) {
            seen = filter;
            return 7;
          },
        };
      },
    };
    const n = await countGameMasterActiveCompetitions(db, "gm-x");
    expect(n).toBe(7);
    expect(seen).toEqual(gameMasterActiveCompetitionFilter("gm-x"));
  });

  it("returns 0 for an empty gameMasterId without querying", async () => {
    let called = false;
    const db = {
      collection() {
        return {
          async countDocuments() {
            called = true;
            return 99;
          },
        };
      },
    };
    expect(await countGameMasterActiveCompetitions(db, "")).toBe(0);
    expect(called).toBe(false);
  });
});

describe("active-competitions is mirrored and consumed by dashboards", () => {
  const MAIN = "lib/services/gamemaster/active-competitions.ts";
  const ADMIN = "apps/admin/lib/services/gamemaster/active-competitions.ts";

  it("both copies are byte-identical", () => {
    expect(read(ADMIN).replace(/\r\n/g, "\n")).toBe(
      read(MAIN).replace(/\r\n/g, "\n"),
    );
  });

  it("player dashboard stats use the shared active rule", () => {
    const source = read("app/api/gamemaster/dashboard/route.ts");
    expect(source).toMatch(/countActiveCompetitionsInList/);
    expect(source).toMatch(/remainingActiveSlots/);
    expect(source).toMatch(/maxActiveCompetitions/);
  });

  it("admin GM detail returns activeCompetitions from the counter", () => {
    const source = read("apps/admin/app/api/gamemasters/[id]/route.ts");
    expect(source).toMatch(/countGameMasterActiveCompetitions/);
    expect(source).toMatch(/activeCompetitions/);
    expect(source).toMatch(/remainingActiveSlots/);
  });

  it("player KPI shows Active Competitions and Slots Left ratios", () => {
    const source = read("app/(root)/gamemaster/page-content.tsx");
    expect(source).toMatch(/Active Competitions/);
    expect(source).toMatch(/Slots Left/);
  });
});
