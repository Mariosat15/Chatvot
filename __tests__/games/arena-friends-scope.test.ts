import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { filterRowsForScope } from "@/lib/utils/arena-scope";

function readCode(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
}

describe("filterRowsForScope", () => {
  const rows = [
    { userId: "me", score: 100 },
    { userId: "friend-a", score: 90 },
    { userId: "stranger", score: 80 },
    { userId: "friend-b", score: 70 },
  ];

  it("returns every row on global", () => {
    expect(
      filterRowsForScope(rows, "global", "me", ["friend-a", "friend-b"]),
    ).toEqual(rows);
  });

  it("keeps the viewer and their friends on friends scope", () => {
    expect(
      filterRowsForScope(rows, "friends", "me", ["friend-a", "friend-b"]).map(
        (r) => r.userId,
      ),
    ).toEqual(["me", "friend-a", "friend-b"]);
  });

  it("always keeps the viewer even with no friends in the contest", () => {
    // Reason: an empty Friends rail otherwise reads as "nobody played", which is
    // false when the viewer themselves is on the board.
    expect(
      filterRowsForScope(rows, "friends", "me", []).map((r) => r.userId),
    ).toEqual(["me"]);
  });

  it("accepts a Set as well as an array", () => {
    expect(
      filterRowsForScope(rows, "friends", "me", new Set(["friend-a"])).map(
        (r) => r.userId,
      ),
    ).toEqual(["me", "friend-a"]);
  });

  it("does not re-rank - order follows the server board", () => {
    // Reason: the friends view is a filter of the ranked board, never a second
    // ranking. Re-ranking here would be R37's shape (two places deciding order).
    const filtered = filterRowsForScope(rows, "friends", "me", [
      "friend-b",
      "friend-a",
    ]);
    expect(filtered.map((r) => r.userId)).toEqual([
      "me",
      "friend-a",
      "friend-b",
    ]);
  });

  it("keeps the viewer and same-country peers on country scope", () => {
    const countries = {
      me: "CY",
      "friend-a": "CY",
      stranger: "GB",
      "friend-b": "CY",
    };
    expect(
      filterRowsForScope(rows, "country", "me", [], countries).map(
        (r) => r.userId,
      ),
    ).toEqual(["me", "friend-a", "friend-b"]);
  });

  it("keeps only the viewer when they have no country set", () => {
    // Reason: without a country there is nobody to match — falling back to Global
    // would make Country look broken ("I clicked Country and nothing changed").
    const countries = { stranger: "GB", "friend-a": "CY" };
    expect(
      filterRowsForScope(rows, "country", "me", [], countries).map(
        (r) => r.userId,
      ),
    ).toEqual(["me"]);
  });

  it("normalises country codes so cy and CY match", () => {
    const countries = { me: "cy", stranger: "CY", "friend-a": "gb" };
    expect(
      filterRowsForScope(rows, "country", "me", [], countries).map(
        (r) => r.userId,
      ),
    ).toEqual(["me", "stranger"]);
  });
});

describe("Friends ids load once with the page, never via matchmaking", () => {
  it("the play page calls listFriendUserIds and passes friendIds into the provider", () => {
    const page = readCode("app/(root)/competitions/[id]/play/page.tsx");
    expect(page).toMatch(/listFriendUserIds\(/);
    expect(page).toMatch(/friendIds=\{friendIds\}/);
    // Country codes travel with standings, not a second friend-style fetch.
    expect(page).toMatch(/countries:\s*standings\.countries/);
    // X13: ranking by trading skill for a provider contest is the silent-wrong shape.
    expect(page).not.toMatch(/matchmaking/i);
  });

  it("the friend-ids helper uses Friendship.getUserFriends, not matchmaking", () => {
    const service = readCode("lib/services/messaging/friend-ids.service.ts");
    expect(service).toMatch(/getUserFriends/);
    expect(service).not.toMatch(/matchmaking/i);
  });
});

describe("Country scope is wired on the panel, not printed as a column", () => {
  it("the panel offers Country as a selectable scope", () => {
    const panel = readCode(
      "components/games/arena/ArenaLeaderboardPanel.tsx",
    );
    expect(panel).toMatch(/scopes=\{\["Global", "Friends", "Country"\]\}/);
    expect(panel).not.toMatch(/unavailable=\{\["Country"\]\}/);
    expect(panel).toMatch(/filterRowsForScope/);
    expect(panel).toMatch(/countries/);
  });

  it("countries travel on ArenaStandings and never on the leaderboard row type", () => {
    const service = readCode(
      "lib/services/games/arena-standings.service.ts",
    );
    expect(service).toMatch(/countries:\s*Record/);
    expect(service).toMatch(/attachArenaBoardExtras/);
    // Side map, not a column — the row enrichment must not spread `country`.
    const producer = readCode(
      "lib/services/games/leaderboard-avatars.ts",
    );
    expect(producer).toMatch(/countries\[row\.userId\]/);
    expect(producer).not.toMatch(/profileImage:[\s\S]{0,80}country/);
  });
});
