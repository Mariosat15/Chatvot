/**
 * Task 28 standing guard: settlement money APIs must never land in a `"use client"` file.
 *
 * The original Task 28 check (9 Sep) grepped four function names and found zero client
 * declarations. That proves the past; this file proves the future — a fifth payout path
 * added tomorrow as a client helper would otherwise pass every existing suite while
 * letting the browser decide money.
 *
 * Scans the whole tree (main + admin). Skips `node_modules`, `.next`, `dist`, and tests.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();

const MONEY_APIS = [
  "distributePrizesWithTies",
  "recordUnclaimedPool",
  "settleFeesAndGameMasters",
  "finalizeCompetition",
  "finalizeProviderCompetition",
  "payContestPrizes",
  "cancelCompetitionAndRefund",
] as const;

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  ".git",
  "games-service", // separate process; has no wallet settlement
]);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (name.includes(".test.") || name.includes(".spec.")) continue;
    out.push(full);
  }
}

function isClientModule(source: string): boolean {
  // First non-empty line (or within the first few) must be the directive.
  const head = source.slice(0, 400);
  return /^\s*["']use client["']\s*;?/m.test(head);
}

describe("Task 28 — settlement stays server-side", () => {
  it("no money settlement API appears in a use client module", () => {
    const files: string[] = [];
    walk(ROOT, files);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!isClientModule(source)) continue;
      for (const api of MONEY_APIS) {
        // Reason: a comment naming the API is not a call. Strip block + line comments first.
        const code = source
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        if (code.includes(api)) {
          offenders.push(`${relative(ROOT, file)} → ${api}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("lists the APIs it polices so a fifth payout path is an edit here, not a silent gap", () => {
    // Reason: the original Task 28 grep named four functions. Extending the list is how
    // this guard stays honest when settlement gains a new door.
    expect(MONEY_APIS.length).toBeGreaterThanOrEqual(4);
    expect(MONEY_APIS).toContain("distributePrizesWithTies");
    expect(MONEY_APIS).toContain("settleFeesAndGameMasters");
  });
});
