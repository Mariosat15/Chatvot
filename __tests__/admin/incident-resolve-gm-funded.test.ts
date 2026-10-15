import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Reason: the incident "Full / Partial refund" credited `entryFee` to every participant's
 * wallet. On a Game Master funded contest the players paid nothing, so that paid out
 * withdrawable Volts the Game Master had funded and returned nothing to the Game Master.
 */
const ROUTE = "apps/admin/app/api/incidents/[id]/resolve/route.ts";
const source = readFileSync(ROUTE, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("incident resolve on a Game Master funded contest", () => {
  it("refuses a player refund before any wallet is credited", () => {
    const post = source.slice(source.indexOf("export async function POST"));
    const refusal = post.indexOf("GM_FUNDED_REFUND_REFUSAL");
    const credit = post.indexOf("CreditWallet.findByIdAndUpdate");
    expect(refusal).toBeGreaterThan(-1);
    expect(credit).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(credit);
    const guardAt = post.lastIndexOf("isGmFundedContest(", refusal);
    expect(guardAt).toBeGreaterThan(-1);
    const guard = post.slice(guardAt, refusal);
    expect(guard).toContain('resolutionType === "partial_refund"');
    expect(guard).toContain('resolutionType === "full_refund"');
    expect(guard).toContain("abortTransaction()");
  });

  it("shows the refusal in the options instead of a player payout", () => {
    const get = source.slice(
      source.indexOf("export async function GET"),
      source.indexOf("export async function POST"),
    );
    expect(get).toContain("const gmFunded = isGmFundedContest(");
    expect(get).toContain("description: GM_FUNDED_REFUND_REFUSAL");
    expect(get).toContain("options.partial_refund = { ...options.partial_refund, ...refused }");
    expect(get).toContain("options.full_refund = { ...options.full_refund, ...refused }");
  });

  it("names the action that does return the funds to the Game Master", () => {
    const actions = readFileSync("apps/admin/lib/admin/incident-actions.ts", "utf8");
    expect(actions).toContain('label: "Platform / Technical Fault — Full GM Refund"');
    expect(readFileSync(ROUTE, "utf8")).toContain(
      '"Platform / Technical Fault — Full GM Refund"',
    );
  });
});
