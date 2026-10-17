import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminContestViewHref } from "../../apps/admin/lib/admin/admin-contest-href";

// Reason: Manage Game Masters listed a Game Master's competitions and the contests their
// earnings came from by NAME only, so an operator had to copy the name into another screen
// to find the contest. Each row now carries an Open button to the admin view page.

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const VIEW = stripComments(read("apps/admin/components/admin/GameMasterDetailView.tsx"));
const BUTTON = stripComments(
  read("apps/admin/components/admin/gamemaster/ContestOpenButton.tsx"),
);
const ROUTE = stripComments(read("apps/admin/app/api/gamemasters/[id]/route.ts"));

const ID = "64b7f0c2a1b2c3d4e5f60718";

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\nfunction ", start + 10);
  const body = source.slice(start, next === -1 ? undefined : next);
  expect(body.length).toBeGreaterThan(200);
  return body;
}

describe("adminContestViewHref", () => {
  it("opens a competition on the admin competition view page", () => {
    expect(adminContestViewHref("competition", ID)).toBe(`/competitions/view/${ID}`);
  });

  it("opens a challenge on the admin challenge view page", () => {
    expect(adminContestViewHref("challenge", ID)).toBe(`/challenges/view/${ID}`);
  });

  it("gives no link for an unknown kind, including prototype keys", () => {
    for (const kind of ["bonus", "", "__proto__", "toString", "constructor", null, undefined]) {
      expect(adminContestViewHref(kind as string, ID)).toBeNull();
    }
  });

  it("gives no link for a missing or malformed id", () => {
    for (const id of [null, undefined, "", "competitions", `${ID}x`, "undefined"]) {
      expect(adminContestViewHref("competition", id as string)).toBeNull();
    }
  });
});

describe("Manage Game Masters contest buttons", () => {
  it("the Competitions tab has exactly one Open button, for a competition, after the End cell", () => {
    const tab = sliceFunction(VIEW, "CompetitionsTab");
    const calls = tab.match(/<ContestOpenButton\b/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(tab).toMatch(/<ContestOpenButton\s+kind="competition"\s+id=\{comp\.id\}/);
    expect(tab.indexOf("<ContestOpenButton")).toBeGreaterThan(tab.indexOf("comp.endTime"));
  });

  it("the Earnings tab has exactly one Open button, keyed on the earning's own source", () => {
    const tab = sliceFunction(VIEW, "EarningsTab");
    const calls = tab.match(/<ContestOpenButton\b/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(tab).toMatch(/<ContestOpenButton\s+kind=\{e\.sourceType\}\s+id=\{e\.sourceId\}/);
  });

  it("both tables gained a header cell for the button", () => {
    expect(sliceFunction(VIEW, "CompetitionsTab")).toMatch(/<th[^>]*>View<\/th>/);
    expect(sliceFunction(VIEW, "EarningsTab")).toMatch(/<th[^>]*>View<\/th>/);
  });

  it("the API passes the earning's sourceId through to the screen", () => {
    const earnings = ROUTE.slice(ROUTE.indexOf("earnings: earnings.map("));
    expect(earnings.length).toBeGreaterThan(50);
    expect(earnings.slice(0, 400)).toMatch(/sourceId:\s*e\.sourceId/);
  });

  it("the button builds its address with the shared helper and never by hand", () => {
    expect(BUTTON).toMatch(/adminContestViewHref\(kind,\s*id\)/);
    expect(BUTTON).not.toMatch(/\/competitions\/view\//);
    expect(BUTTON).not.toMatch(/\/challenges\/view\//);
  });

  it("renders no link at all when there is nowhere to go", () => {
    expect(BUTTON).toMatch(/if\s*\(!href\)\s*\{\s*return/);
  });
});
