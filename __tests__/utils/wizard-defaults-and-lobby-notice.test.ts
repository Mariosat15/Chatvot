/**
 * Owner, 2 Oct 2026: every create wizard opens its calendar on TODAY (so starting today is
 * only a time change), and both game wizards state - read-only - how long before the start
 * the lobby opens, because that length is the GAME's and is copied at creation.
 *
 * Reason: a Game Master saw a one-minute lobby where the game was believed to say five, and
 * no screen showed which number the competition would copy.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultContestWindow } from "@/lib/utils/default-contest-window";
import { formatLobbyLead, lobbyNotice } from "@/lib/utils/lobby-notice";

const root = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("defaultContestWindow", () => {
  it("starts today about an hour ahead, rounded up to five minutes", () => {
    const w = defaultContestWindow(60, new Date("2026-10-02T08:03:30Z"));
    expect(w).toEqual({
      startDate: "2026-10-02",
      startTime: "09:05",
      endDate: "2026-10-02",
      endTime: "10:05",
    });
  });

  it("runs for the requested length", () => {
    const w = defaultContestWindow(24 * 60, new Date("2026-10-02T08:00:00Z"));
    expect(w).toEqual({
      startDate: "2026-10-02",
      startTime: "09:00",
      endDate: "2026-10-03",
      endTime: "09:00",
    });
  });

  it("rolls to tomorrow only when an hour ahead is already tomorrow", () => {
    const w = defaultContestWindow(60, new Date("2026-10-02T23:30:00Z"));
    expect(w.startDate).toBe("2026-10-03");
    expect(w.startTime).toBe("00:30");
  });

  it("never yields a zero-length window", () => {
    const w = defaultContestWindow(0, new Date("2026-10-02T08:00:00Z"));
    expect(`${w.endDate}T${w.endTime}`).not.toBe(`${w.startDate}T${w.startTime}`);
  });
});

describe("lobbyNotice", () => {
  it("states the game's lobby length for a scheduled contest", () => {
    expect(lobbyNotice("scheduled", 300)).toBe(
      "Lobby opens 5 minutes before the start. This is set on the game and copied when you create the competition.",
    );
    expect(formatLobbyLead(60)).toBe("1 minute");
    expect(formatLobbyLead(90)).toBe("90 seconds");
  });

  it("says nothing for any other shape, or for a value it was not given", () => {
    expect(lobbyNotice("anytime", 300)).toBeNull();
    expect(lobbyNotice(undefined, 300)).toBeNull();
    expect(lobbyNotice("scheduled", undefined)).toBeNull();
    expect(lobbyNotice("scheduled", Number.NaN)).toBeNull();
  });
});

describe("mirrors and wiring", () => {
  it.each(["default-contest-window.ts", "lobby-notice.ts"])(
    "lib utils %s is byte-identical in the admin app",
    (file) => {
      expect(read(`apps/admin/lib/utils/${file}`)).toBe(read(`lib/utils/${file}`));
    },
  );

  it("provider-contest service is byte-identical and carries the RESOLVED lobby length", () => {
    const main = read("lib/services/game-providers/provider-contest.service.ts");
    expect(read("apps/admin/lib/services/game-providers/provider-contest.service.ts")).toBe(main);
    expect(main).toMatch(/lobbySeconds:\s*resolveLobbySeconds\(title\.lobbySeconds\),\s*\n\s*maxPlayers/);
  });

  it("the GM creation-options route passes the lobby length through", () => {
    expect(stripComments(read("app/api/gamemaster/creation-options/route.ts"))).toMatch(
      /lobbySeconds:\s*t\.lobbySeconds/,
    );
  });

  it("both schedule steps read the title's value through lobbyNotice, never a literal", () => {
    const admin = stripComments(read("apps/admin/components/admin/games/wizard/StepSchedule.tsx"));
    expect(admin).toMatch(/lobbyNotice\(draft\.playMode,\s*title\?\.lobbySeconds\)/);
    expect(admin).toMatch(/\{lobbyLine\}/);
    expect(admin).toContain('href="/dashboard?activeTab=game-providers"');

    const gm = stripComments(read("components/gamemaster/provider-contest-wizard-steps.tsx"));
    expect(gm).toMatch(/lobbyNotice\(rules\.playMode,\s*lobbySeconds\)/);
    expect(gm).toMatch(/\{lobbyLine\}/);
    expect(stripComments(read("components/gamemaster/ProviderContestCreateForm.tsx"))).toMatch(
      /lobbySeconds=\{title\.lobbySeconds\}/,
    );
  });

  it("every create wizard seeds its dates from the shared rule, not tomorrow", () => {
    const files = [
      "components/gamemaster/ProviderContestCreateForm.tsx",
      "app/(root)/gamemaster/create-competition/page-content.tsx",
      "apps/admin/components/admin/CompetitionCreatorForm.tsx",
      "apps/admin/components/admin/games/contest-draft.ts",
    ];
    for (const f of files) {
      const code = stripComments(read(f));
      expect(code, f).toMatch(/defaultContestWindow\(\s*(60|24 \* 60)\s*[,)]/);
      expect(code, f).not.toMatch(/24 \* 60 \* 60 \* 1000/);
    }
  });
});
