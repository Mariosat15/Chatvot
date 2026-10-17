import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { computeSkillEvidence, type SettledContest } from "@/apps/admin/lib/services/games/skill-evidence-stats";
import { rangeFilter } from "@/apps/admin/lib/services/games/skill-evidence.service";
import {
  describeEvidenceRange,
  parseEvidenceRange,
} from "@/apps/admin/lib/admin/skill-evidence-range";
import {
  correlationVerdict,
  evidenceCards,
  spreadVerdict,
} from "@/apps/admin/lib/admin/skill-evidence-copy";
import { factSheet, rulesNarrative } from "@/apps/admin/lib/services/games/skill-evidence-ai";
import { renderSkillEvidencePdf, toWinAnsi } from "@/apps/admin/lib/services/games/skill-evidence-pdf";

/**
 * The regulator report: date range, plain-English verdicts, and the PDF. The AI call
 * itself is not exercised here - the rule-based narrative is the fallback that must always
 * work, and the tables are printed from the evidence, never from model output.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const contest = (i: number, order: string[]): SettledContest => ({
  contestId: `c${i}`,
  endedAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
  entries: order.map((userId, idx) => ({ userId, rank: idx + 1 })),
});

const SKILLED = Array.from({ length: 20 }, (_, i) => contest(i, ["a", "b", "c", "d"]));
const title = { gameKey: "provider:x:sprint", displayName: "Sprint \u201CPro\u201D", ...computeSkillEvidence(SKILLED) };

describe("date range", () => {
  it("empty means unbounded and to includes the whole last day", () => {
    const all = parseEvidenceRange("", null);
    expect(all.ok && all.range).toEqual({});
    const r = parseEvidenceRange("2026-01-01", "2026-03-31");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.range.from?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(r.range.to?.toISOString()).toBe("2026-03-31T23:59:59.999Z");
    }
  });

  it("refuses an impossible day, a wrong format and a reversed range", () => {
    expect(parseEvidenceRange("2026-02-31", null).ok).toBe(false);
    expect(parseEvidenceRange("01/02/2026", null).ok).toBe(false);
    expect(parseEvidenceRange("2026-05-01", "2026-04-01").ok).toBe(false);
  });

  it("filters on the day a contest ended", () => {
    const r = parseEvidenceRange("2026-01-01", "2026-01-31");
    expect(r.ok && rangeFilter(r.range)).toEqual({
      endTime: { $gte: new Date("2026-01-01T00:00:00.000Z"), $lte: new Date("2026-01-31T23:59:59.999Z") },
    });
    expect(rangeFilter({})).toEqual({});
  });

  it("describes the period in words", () => {
    expect(describeEvidenceRange("2026-01-01", "2026-03-31")).toBe("1 Jan 2026 to 31 Mar 2026");
    expect(describeEvidenceRange(null, null)).toBe("All settled contests to date");
  });
});

describe("plain-English verdicts", () => {
  it("correlation thresholds", () => {
    expect(correlationVerdict(0.24).label).toBe("Weak sign of skill");
    expect(correlationVerdict(0.05).label).toBe("Looks like luck");
    expect(correlationVerdict(0.5).tone).toBe("skill");
    expect(correlationVerdict(null).tone).toBe("none");
  });

  it("one player taking every win reads as skill, never as less than luck", () => {
    // 20 wins, 1 winner: the repeat count alone (1 against ~4) would say "inverse".
    expect(title.winners.distinctWinners).toBe(1);
    expect(spreadVerdict(title.winners).tone).toBe("skill");
  });

  it("winners spread the way luck would spread them reads as luck", () => {
    const luck = { wins: 10, distinctWinners: 7, repeatWinners: 3, expectedRepeatWinnersByChance: 3.1, expectedDistinctWinnersByChance: 7.4, topWinnerShare: 0.5 };
    expect(spreadVerdict(luck).tone).toBe("chance");
  });

  it("every card carries a question, a verdict and a tooltip", () => {
    for (const c of evidenceCards(title)) {
      expect(c.question.endsWith("?")).toBe(true);
      expect(c.help.length).toBeGreaterThan(80);
      expect(c.verdict.label).toBeTruthy();
    }
  });
});

describe("narrative and PDF", () => {
  it("the fact sheet the AI may quote carries the computed verdicts", () => {
    const [f] = factSheet([title], 30);
    expect(f.scoreStability).toBe("1.00");
    expect(f.scoreStabilityVerdict).toBe("Clear sign of skill");
  });

  it("strips characters the PDF fonts cannot draw", () => {
    expect(toWinAnsi("\u201CHi\u201D \u2014 it\u2019s \u2026 \u{1F600}")).toBe('"Hi" - it\'s ... ');
  });

  it("renders a real PDF from the rule-based narrative, including the dates", async () => {
    const period = describeEvidenceRange("2026-01-01", "2026-03-31");
    const narrative = rulesNarrative([title], 30, period);
    expect(narrative.findings.get(title.gameKey)).toContain("Sprint");
    const bytes = await renderSkillEvidencePdf([title], narrative, {
      period,
      generatedAt: new Date("2026-04-01T10:00:00Z"),
      preparedBy: "ops@example.com",
      minPairs: 30,
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain("1 Jan 2026 to 31 Mar 2026");
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("report wiring", () => {
  it("the PDF route is a section-guarded POST", () => {
    const route = read("apps/admin/app/api/games/skill-evidence/report/route.ts");
    expect(route).toMatch(/guardSection\("skill-evidence"\)/);
    expect(route).toMatch(/export async function POST/);
    expect(route).not.toMatch(/export async function GET/);
  });

  it("the screen downloads the PDF with the applied dates", () => {
    const screen = read("apps/admin/components/admin/games/SkillEvidenceSection.tsx");
    expect(screen).toContain('fetch("/api/games/skill-evidence/report"');
    expect(screen).toMatch(/from: applied\.from/);
  });

  it("the AI narrative never supplies the table figures", () => {
    const pdf = read("apps/admin/lib/services/games/skill-evidence-pdf.ts");
    expect(pdf).toMatch(/corr\(t\.stability\.correlation\)/);
    expect(pdf).not.toMatch(/narrative\.\w+\.(correlation|wins|entries)/);
  });
});
