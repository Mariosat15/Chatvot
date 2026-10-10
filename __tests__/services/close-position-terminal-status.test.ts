import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * X6.5 leftover from `12` s3.2a — closePosition must refuse terminal contest states.
 *
 * Closing on `completed` / `finalizing` moves capital after (or during) the leaderboard
 * snapshot. The cancelled half shipped with R77; this suite pins the widened set.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const POSITION_ACTIONS = path.join(
  REPO_ROOT,
  "lib",
  "actions",
  "trading",
  "position.actions.ts",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function closePositionBody(): string {
  const source = stripComments(fs.readFileSync(POSITION_ACTIONS, "utf8"));
  const start = source.indexOf("export const closePosition");
  expect(start).toBeGreaterThan(-1);
  // Next top-level export after closePosition — keep the slice inside this function.
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("closePosition refuses terminal contest statuses", () => {
  it("still refuses cancelled (R77)", () => {
    const body = closePositionBody();
    expect(body).toMatch(/status\s*===\s*["']cancelled["']/);
    expect(body).toMatch(/Competition was cancelled/);
  });

  it("refuses completed", () => {
    const body = closePositionBody();
    expect(body).toMatch(/status\s*===\s*["']completed["']/);
    expect(body).toMatch(/Competition has ended/);
  });

  it("refuses finalizing", () => {
    const body = closePositionBody();
    expect(body).toMatch(/status\s*===\s*["']finalizing["']/);
    expect(body).toMatch(/being finalized/);
  });

  it("does not revive the dead emergency_ended status check", () => {
    // Reason: that status is declared and written by nothing. Restoring it would make
    // the guard look complete while still missing cancelled/completed/finalizing.
    const body = closePositionBody();
    expect(body).not.toMatch(/emergency_ended/);
  });
});
