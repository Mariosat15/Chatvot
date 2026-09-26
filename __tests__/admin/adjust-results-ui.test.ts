import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * The adjust-results ADMIN UI.
 *
 * Until this slice the route was money-correct (R76) and had **no UI caller at all** -
 * recorded in `12` s3.2a/b and the X6.5 outstanding list. Closing that gap must not invent a
 * second money writer: the panel POSTs to the existing route and nothing else.
 *
 * THESE TESTS STRIP COMMENTS FIRST. The panel and the view page explain the anti-patterns in
 * prose (`participantId`, incident paste, no second wallet writer), so a structural test that
 * reads prose fails in both directions.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const PANEL =
  "apps/admin/components/admin/competitions/AdjustResultsPanel.tsx";
const VIEW_PAGE = "apps/admin/app/competitions/view/[id]/page.tsx";
const ROUTE =
  "apps/admin/app/api/competitions/[id]/adjust-results/route.ts";
const RESOLVE =
  "apps/admin/app/api/incidents/[id]/resolve/route.ts";

describe("adjust-results has a UI caller on the completed contest view", () => {
  it("mounts AdjustResultsPanel on the contest view page", () => {
    const code = readCode(VIEW_PAGE);
    expect(code).toContain("<AdjustResultsPanel");
    // Count: a second unguarded mount elsewhere on the page would be a second entry to money.
    expect(code.match(/<AdjustResultsPanel/g)?.length).toBe(1);
  });

  it("gates the mount on completed status AND seats existing", () => {
    /*
      Position within the construct, never a bare identifier. `isCompleted` appears many times
      on this page; the load-bearing claim is that the panel sits behind both checks.
    */
    const code = readCode(VIEW_PAGE);
    const mount = code.indexOf("<AdjustResultsPanel");
    expect(mount).toBeGreaterThan(-1);
    const gateSlice = code.slice(Math.max(0, mount - 200), mount);
    expect(gateSlice).toMatch(/isCompleted/);
    expect(gateSlice).toMatch(/adjustSeats\.length\s*>\s*0/);
  });

  it("builds seats from CompetitionParticipant._id, never from finalLeaderboard alone", () => {
    const code = readCode(VIEW_PAGE);
    expect(code).toMatch(/CompetitionParticipant\.find/);
    expect(code).toMatch(/participantId:\s*seat\._id\.toString\(\)/);
  });
});

describe("the panel talks only to the existing adjust-results route", () => {
  it("does not POST adjust-results itself", () => {
    // Reason: the panel used to be the UI caller. Adjusting a settled prize is now
    // hub-driven, so a fetch here would be a second door that skips the incident record.
    // The route file below is still the writer; the incident act service calls it.
    const code = readCode(PANEL);
    expect(code).not.toMatch(/fetch\(/);
    expect(code).not.toMatch(/adjust-results/);
    expect(code).toMatch(/HubWithheldAction/);
  });

  it("does not import wallet, participant or settlement modules", () => {
    /*
      A second money writer in the browser is the failure mode this panel exists to avoid.
      Judge by imports of driver-reaching modules, never by the word "wallet" in copy.
    */
    const code = readCode(PANEL);
    expect(code).not.toMatch(/from\s+["']@\/database\/models/);
    expect(code).not.toMatch(/from\s+["']@\/lib\/services\/settlement/);
    expect(code).not.toMatch(/CreditWallet|WalletTransaction/);
  });

  it("does not submit a correction of its own", () => {
    // Reason: the early-return on a blank incident id lived in this panel. The hub's
    // act route now requires the reason, so a handleSubmit here would be the old door.
    const code = readCode(PANEL);
    expect(code).not.toMatch(/handleSubmit/);
    expect(code).not.toMatch(/incidentId/);
  });

  it("names the hub rather than showing per-row outcomes", () => {
    const code = readCode(PANEL);
    expect(code).not.toMatch(/setLastResults/);
    expect(code).toMatch(/HubWithheldAction/);
  });

  it("the resolve path uses formatVolts and does not quote a euro to the player", () => {
    // Reason: the panel no longer renders amounts. The player-facing sentence is the
    // compensation notification on the resolve route, which used to say "credited €X".
    const code = readCode(RESOLVE);
    expect(code).toMatch(/formatVolts\(/);
    expect(code).toMatch(/You have been credited \$\{formatVolts\(/);
    expect(code).not.toMatch(/credited €/);
  });
});

describe("the route file still exists as the single writer", () => {
  it("is still the POST handler the panel calls", () => {
    const code = readCode(ROUTE);
    expect(code).toMatch(/export\s+async\s+function\s+POST/);
    expect(code).toMatch(/guardSection\(\s*["']competitions["']\s*\)/);
  });
});
