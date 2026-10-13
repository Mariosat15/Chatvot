import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeSkillEvidence,
  MIN_PAIRS_FOR_EVIDENCE,
  pearson,
  spearman,
  type SettledContest,
} from "@/apps/admin/lib/services/games/skill-evidence-stats";
import { toSettledContest } from "@/apps/admin/lib/services/games/skill-evidence.service";

/**
 * Skill evidence (legal opinion s9 item 4). The figures are only useful if a skill
 * fixture and a chance fixture produce visibly different answers, so each measure is
 * tested both ways. A test that only ever sees one kind of data cannot tell a working
 * statistic from one that returns a constant.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function contest(i: number, order: string[]): SettledContest {
  return {
    contestId: `c${i}`,
    endedAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
    entries: order.map((userId, idx) => ({ userId, rank: idx + 1 })),
  };
}

/** Deterministic PRNG so the "chance" fixture is the same on every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    // Reason: i and j are numeric shuffle indices, not request-supplied keys.
    // eslint-disable-next-line security/detect-object-injection
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SKILLED = Array.from({ length: 20 }, (_, i) => contest(i, ["a", "b", "c", "d"]));

const players = Array.from({ length: 10 }, (_, i) => `p${i}`);
const rand = mulberry32(42);
const CHANCE = Array.from({ length: 200 }, (_, i) => contest(i, shuffled(players, rand)));

describe("correlation helpers", () => {
  it("pearson is 1 for a perfect line and null when undefined", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("spearman uses ranks, so a monotone curve is 1", () => {
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 64])).toBeCloseTo(1);
  });
});

describe("score stability", () => {
  it("is high when the same players finish in the same order every time", () => {
    const ev = computeSkillEvidence(SKILLED);
    expect(ev.stability.pairs).toBe(4 * 19);
    expect(ev.stability.correlation).toBeCloseTo(1);
    expect(ev.sufficient).toBe(true);
  });

  it("is near zero when finishing order is random", () => {
    const ev = computeSkillEvidence(CHANCE);
    expect(ev.stability.pairs).toBeGreaterThan(1000);
    expect(Math.abs(ev.stability.correlation ?? 1)).toBeLessThan(0.15);
  });

  it("labels a thin sample as insufficient", () => {
    const ev = computeSkillEvidence(SKILLED.slice(0, 3));
    expect(ev.stability.pairs).toBeLessThan(MIN_PAIRS_FOR_EVIDENCE);
    expect(ev.sufficient).toBe(false);
  });
});

describe("experience against winning", () => {
  it("is positive when veterans beat newcomers", () => {
    const fixture = Array.from({ length: 15 }, (_, i) =>
      contest(i, ["vet1", "vet2", `new${i}a`, `new${i}b`]),
    );
    const ev = computeSkillEvidence(fixture);
    expect(ev.experience.correlation).toBeGreaterThan(0.5);
    const first = ev.experience.buckets.find((b) => b.label === "First contest");
    expect(first?.winRate).toBe(1 / 32);
    expect(first?.chanceWinRate).toBeCloseTo(0.25);
  });

  it("is near zero when finishing order is random", () => {
    const ev = computeSkillEvidence(CHANCE);
    expect(Math.abs(ev.experience.correlation ?? 1)).toBeLessThan(0.15);
  });
});

describe("spread of winners", () => {
  it("one dominant winner against a chance expectation of several repeat winners", () => {
    const ev = computeSkillEvidence(SKILLED);
    expect(ev.winners.wins).toBe(20);
    expect(ev.winners.distinctWinners).toBe(1);
    expect(ev.winners.repeatWinners).toBe(1);
    expect(ev.winners.expectedRepeatWinnersByChance).toBeGreaterThan(3.5);
    expect(ev.winners.topWinnerShare).toBe(1);
  });

  it("under chance the observed repeat winners sit close to the expectation", () => {
    const ev = computeSkillEvidence(CHANCE);
    expect(ev.winners.distinctWinners).toBe(10);
    expect(Math.abs(ev.winners.repeatWinners - ev.winners.expectedRepeatWinnersByChance)).toBeLessThan(1);
  });
});

describe("input hygiene", () => {
  it("skips contests with fewer than two entries and duplicate seats", () => {
    const ev = computeSkillEvidence([
      contest(0, ["solo"]),
      { contestId: "dup", endedAt: new Date(1), entries: [{ userId: "x", rank: 1 }, { userId: "x", rank: 2 }, { userId: "y", rank: 3 }] },
    ]);
    expect(ev.contests).toBe(1);
    expect(ev.entries).toBe(2);
  });

  it("toSettledContest drops disqualified, anonymous and unranked rows", () => {
    const c = toSettledContest({
      _id: "abc",
      endTime: new Date(5),
      finalLeaderboard: [
        { userId: "a", rank: 1 },
        { userId: "b", rank: 2, qualificationStatus: "disqualified" },
        { rank: 3 },
        { userId: "d", rank: 0 },
        { userId: "e", rank: 4, qualificationStatus: "qualified" },
      ],
    });
    expect(c).toEqual({
      contestId: "abc",
      endedAt: new Date(5),
      entries: [
        { userId: "a", rank: 1 },
        { userId: "e", rank: 4 },
      ],
    });
  });
});

describe("admin wiring", () => {
  it("the route is section-guarded", () => {
    const route = read("apps/admin/app/api/games/skill-evidence/route.ts");
    expect(route).toMatch(/guardSection\("skill-evidence"\)/);
  });

  it("the section id is a grantable enum value and catalogued", () => {
    expect(read("apps/admin/database/models/admin-employee.model.ts")).toContain('"skill-evidence"');
    expect(read("apps/admin/lib/admin/admin-section-catalog.ts")).toContain('"skill-evidence"');
  });

  it("the dashboard renders the screen and the screen reads the route", () => {
    const dash = read("apps/admin/components/admin/AdminDashboard.tsx");
    expect(dash).toMatch(/case "skill-evidence":\s*return <SkillEvidenceSection/);
    expect(read("apps/admin/components/admin/games/SkillEvidenceSection.tsx")).toContain(
      'fetch("/api/games/skill-evidence"',
    );
  });

  it("evidence is read from settled provider contests only", () => {
    const svc = read("apps/admin/lib/services/games/skill-evidence.service.ts");
    expect(svc).toMatch(/status:\s*"completed"/);
    expect(svc).toMatch(/gameType:\s*"provider"/);
  });
});
