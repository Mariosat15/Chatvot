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
});

describe("Friends ids load once with the page, never via matchmaking", () => {
  it("the play page calls listFriendUserIds and passes friendIds into the provider", () => {
    const page = readCode("app/(root)/competitions/[id]/play/page.tsx");
    expect(page).toMatch(/listFriendUserIds\(/);
    expect(page).toMatch(/friendIds=\{friendIds\}/);
    // X13: ranking by trading skill for a provider contest is the silent-wrong shape.
    expect(page).not.toMatch(/matchmaking/i);
  });

  it("the friend-ids helper uses Friendship.getUserFriends, not matchmaking", () => {
    const service = readCode("lib/services/messaging/friend-ids.service.ts");
    expect(service).toMatch(/getUserFriends/);
    expect(service).not.toMatch(/matchmaking/i);
  });
});
