import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Private Game Master contests are LISTED to every signed-in player (owner decision,
 * 30 Sep 2026). What each viewer is offered on the card comes from the lobby gate's own
 * answer, so the card and the gate it links to cannot disagree.
 */

const gate = vi.fn();
vi.mock("@/lib/services/gamemaster/private-contest-gate.service", () => ({
  getPrivateContestGate: (input: unknown) => gate(input),
}));

import { annotatePrivateContests } from "@/lib/services/gamemaster/private-contest-listing.service";
import {
  isPrivateCardAccess,
  privateContestCardCopy,
} from "@/lib/utils/private-contest-card-copy";

const GM = "6500000000000000000000b1";
const OTHER_GM = "6500000000000000000000b2";
const PLAYER = "6500000000000000000000a1";

const ROOT = process.cwd();
const code = (p: string) =>
  readFileSync(join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

beforeEach(() => {
  gate.mockReset();
  gate.mockResolvedValue({ state: "joinable", gameMasterName: "Ada" });
});

describe("annotatePrivateContests", () => {
  it("leaves a public contest untouched and never asks the gate about it", async () => {
    const [row] = await annotatePrivateContests([{ name: "p", visibility: "public" }], {
      userId: PLAYER,
      affiliatedGameMasterId: null,
    });
    expect(row).toEqual({ name: "p", visibility: "public" });
    expect(gate).not.toHaveBeenCalled();
  });

  it("marks the creator and the creator's affiliates as members, without a gate read", async () => {
    const contest = { visibility: "gm_private", gameMasterId: GM };
    const [asCreator] = await annotatePrivateContests([contest], {
      userId: GM,
      affiliatedGameMasterId: null,
    });
    const [asAffiliate] = await annotatePrivateContests([contest], {
      userId: PLAYER,
      affiliatedGameMasterId: GM,
    });
    expect(asCreator.privateAccess).toBe("member");
    expect(asAffiliate.privateAccess).toBe("member");
    expect(gate).not.toHaveBeenCalled();
  });

  it("gives anyone else the gate's own state and the Game Master's name", async () => {
    gate.mockResolvedValue({ state: "locked", gameMasterName: "Ada" });
    const [row] = await annotatePrivateContests([{ visibility: "gm_private", gameMasterId: GM }], {
      userId: PLAYER,
      affiliatedGameMasterId: OTHER_GM,
    });
    expect(row.privateAccess).toBe("locked");
    expect(row.privateGameMasterName).toBe("Ada");
    expect(gate).toHaveBeenCalledWith({ gameMasterId: GM, viewerUserId: PLAYER });
  });

  it("asks the gate once per Game Master, not once per contest", async () => {
    await annotatePrivateContests(
      [
        { visibility: "gm_private", gameMasterId: GM },
        { visibility: "gm_private", gameMasterId: GM },
        { visibility: "gm_private", gameMasterId: OTHER_GM },
      ],
      { userId: PLAYER, affiliatedGameMasterId: null },
    );
    expect(gate).toHaveBeenCalledTimes(2);
  });

  it("treats an unrecognised visibility as private, agreeing with the entry gate", async () => {
    const [row] = await annotatePrivateContests(
      [{ visibility: "friends_only", gameMasterId: GM }],
      { userId: PLAYER, affiliatedGameMasterId: null },
    );
    expect(row.privateAccess).toBe("joinable");
  });
});

describe("the card copy", () => {
  it("offers Join GM to a joinable player and names the Game Master", () => {
    const copy = privateContestCardCopy("joinable", "Ada");
    expect(copy.action).toBe("Join GM to enter");
    expect(copy.hint).toContain("Ada");
    expect(copy.tone).toBe("invite");
  });

  it("never offers a join to a player locked under another Game Master (D1)", () => {
    const copy = privateContestCardCopy("locked", "Ada");
    expect(copy.action).not.toMatch(/join/i);
    expect(copy.hint).toMatch(/only an admin/i);
    expect(copy.tone).toBe("closed");
  });

  it("gives a member no replacement action - they get the ordinary card", () => {
    expect(privateContestCardCopy("member", "Ada").action).toBeUndefined();
  });

  it("rejects an unknown state rather than guessing", () => {
    expect(isPrivateCardAccess("toString")).toBe(false);
    expect(isPrivateCardAccess(undefined)).toBe(false);
    expect(isPrivateCardAccess("locked")).toBe(true);
  });
});

describe("the wiring", () => {
  it.each(["lib/actions/trading/competition.actions.ts", "app/api/competitions/route.ts"])(
    "%s annotates what it lists",
    (file) => {
      expect(code(file)).toMatch(/await annotatePrivateContests\(\w+,\s*viewer\)/);
    },
  );

  it("the card replaces the entry button for a non-member who is not seated", () => {
    const card = code("components/trading/CompetitionCard.tsx");
    const at = card.indexOf("<PrivateContestCardAction");
    expect(at).toBeGreaterThan(0);
    const guard = card.slice(Math.max(0, at - 400), at);
    expect(guard).toMatch(/!isUserIn/);
    expect(guard).toMatch(/competition\.privateAccess\s*!==\s*"member"/);
  });

  it("the card shows the Private badge in both views", () => {
    const card = code("components/trading/CompetitionCard.tsx");
    expect(card.match(/<PrivateContestBadge access=\{competition\.privateAccess\}/g)).toHaveLength(2);
  });

  it("the card copy module stays model-free (R58)", () => {
    expect(code("lib/utils/private-contest-card-copy.ts")).not.toMatch(/from\s+["']@\/(database|lib\/services)/);
    expect(code("components/gamemaster/PrivateContestCardParts.tsx")).not.toMatch(
      /from\s+["']@\/(database|lib\/services)/,
    );
  });
});
