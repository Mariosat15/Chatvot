/**
 * Normal / Private / Funded badges and filters on the Game Master dashboard (owner, 2 Oct 2026).
 *
 * Reason: a funded contest is always private too, so the order of the checks is the whole
 * rule - "Private" on a funded contest hides the fact that matters most, that the Game Master
 * pays every seat. And a challenge earning has no competition, so it must carry no badge
 * rather than "Normal" for a contest it was never part of.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gmContestKind, parseGmContestKind } from "@/lib/utils/gm-contest-kind";
import { kindForEarning } from "@/lib/services/gamemaster/earning-contest-kind";
import { filterByContestKind } from "@/components/gamemaster/GmContestKindBadge";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(path.join(root, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("gmContestKind", () => {
  it("names a funded contest Funded even though it is also private", () => {
    expect(gmContestKind({ visibility: "gm_private", fundingMode: "gm_funded" })).toBe("funded");
  });

  it("names an invite-only paid contest Private", () => {
    expect(gmContestKind({ visibility: "gm_private", fundingMode: "players_pay" })).toBe("private");
  });

  it("names a public contest, or one predating the fields, Normal", () => {
    expect(gmContestKind({ visibility: "public" })).toBe("normal");
    expect(gmContestKind({})).toBe("normal");
  });

  it("refuses an unknown filter value rather than trusting it", () => {
    expect(parseGmContestKind("funded")).toBe("funded");
    expect(parseGmContestKind("__proto__")).toBeNull();
    expect(parseGmContestKind(undefined)).toBeNull();
  });
});

describe("kindForEarning", () => {
  const kinds = new Map([["507f1f77bcf86cd799439011", "funded" as const]]);

  it("reads the contest's kind for a competition earning", () => {
    expect(
      kindForEarning({ sourceType: "competition", sourceId: "507f1f77bcf86cd799439011" }, kinds),
    ).toBe("funded");
  });

  it("gives a challenge earning no kind, never Normal", () => {
    expect(
      kindForEarning({ sourceType: "challenge", sourceId: "507f1f77bcf86cd799439011" }, kinds),
    ).toBeNull();
  });

  it("gives an earning whose contest is gone no kind", () => {
    expect(
      kindForEarning({ sourceType: "competition", sourceId: "507f1f77bcf86cd799439012" }, kinds),
    ).toBeNull();
  });
});

describe("filterByContestKind", () => {
  const rows = [{ kind: "normal" as const }, { kind: "funded" as const }, { kind: null }];

  it("keeps everything for All types", () => {
    expect(filterByContestKind(rows, "all")).toHaveLength(3);
  });

  it("keeps only the chosen kind", () => {
    expect(filterByContestKind(rows, "funded")).toEqual([{ kind: "funded" }]);
  });
});

describe("dashboard wiring", () => {
  it("the dashboard route selects both fields the kind is derived from", () => {
    const src = read("app/api/gamemaster/dashboard/route.ts");
    expect(src).toMatch(/visibility fundingMode/);
    expect(src).toMatch(/kind:\s*gmContestKind\(c\)/);
    expect(src).toMatch(/kind:\s*kindForEarning\(e,\s*kinds\)/);
  });

  it("the Earnings page route attaches the kind too", () => {
    expect(read("app/api/gamemaster/earnings/route.ts")).toMatch(
      /kind:\s*kindForEarning\(e,\s*kinds\)/,
    );
  });

  it("both tabs render the filter and the badge", () => {
    const tabs = read("app/(root)/gamemaster/gamemaster-dashboard-tabs.tsx");
    expect(tabs.match(/<GmContestKindFilter value=\{kindFilter\}/g)).toHaveLength(2);
    expect(tabs).toMatch(/<GmContestKindBadge kind=\{comp\.kind\}/);
    expect(tabs).toMatch(/<GmContestKindBadge kind=\{e\.kind\}/);
  });

  it("the page applies the kind filter to both lists, not merely holds it in state", () => {
    const page = read("app/(root)/gamemaster/page-content.tsx");
    expect(page).toMatch(/filterByContestKind\(byStatus,\s*compKindFilter\)/);
    expect(page).toMatch(/filterByContestKind\(byStatus,\s*earningsKindFilter\)/);
    expect(page).toMatch(/kindFilter=\{compKindFilter\}/);
    expect(page).toMatch(/kindFilter=\{earningsKindFilter\}/);
  });
});
