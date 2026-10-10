import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A free (Game Master-funded) competition: cards let any balance into the lobby, and the
  lobby's entry button applies the admin's "who can join" minimum and explains it in red.
  The server (`payFundedEntry`) stays the authority; these pin the visible half.
*/

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const button = read("components/trading/CompetitionEntryButton.tsx");
const page = read("app/(root)/competitions/[id]/page.tsx");
const entry = read("lib/services/contest-entry/free-private-entry.ts");

describe("free competition minimum balance in the lobby", () => {
  it("computes the refusal from the shared rule, strict when the rule is absent", () => {
    expect(button).toMatch(
      /competition\.freePrivateEntryRule\s*\?\?\s*DEFAULT_FREE_PRIVATE_ENTRY_RULE/,
    );
    expect(button).toMatch(/freePrivateEntryRefusal\(fundedRule,\s*userBalance\)/);
  });

  it("withholds the Join button while the refusal stands", () => {
    const canEnter = button.slice(button.indexOf("const canEnter ="));
    const end = canEnter.indexOf(";");
    expect(end).toBeGreaterThan(0);
    expect(canEnter.slice(0, end)).toContain("!fundedRefusal");
    expect(button).toContain("Minimum Balance Required");
  });

  it("explains the rule in prominent red text with the configured minimum", () => {
    const start = button.indexOf("{fundedRefusal && fundedRule");
    expect(start).toBeGreaterThan(0);
    const block = button.slice(start, start + 1500);
    expect(block).toContain("text-red-400");
    expect(block).toContain("font-bold");
    expect(block).toContain("volts(fundedRule.minBalance)");
    expect(block).toContain('href="/wallet"');
  });

  it("attaches the admin rule on the lobby page for funded contests", () => {
    expect(page).toMatch(
      /if \(isFundedContest\(competition\)\)[\s\S]{0,120}competition\.freePrivateEntryRule\s*=\s*await loadFreePrivateEntryRule\(\)/,
    );
  });

  it("reads the rule through the same loader the join transaction uses", () => {
    expect(entry).toMatch(/const rule = await loadFreePrivateEntryRule\(session\)/);
  });
});
