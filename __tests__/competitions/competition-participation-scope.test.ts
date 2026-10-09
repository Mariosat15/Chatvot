import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scopeCompetitionStatusesToParticipant } from "@/lib/competitions/competition-participation-scope";

describe("scopeCompetitionStatusesToParticipant", () => {
  it("shows completed history only for competitions the player joined", () => {
    expect(
      scopeCompetitionStatusesToParticipant(
        ["completed"],
        ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
      ),
    ).toEqual({
      $or: [
        {
          status: { $in: ["completed"] },
          _id: {
            $in: [
              "507f1f77bcf86cd799439011",
              "507f1f77bcf86cd799439012",
            ],
          },
        },
      ],
    });
  });

  it("keeps open competitions discoverable while scoping settled history", () => {
    expect(
      scopeCompetitionStatusesToParticipant(
        ["active", "upcoming", "completed", "cancelled"],
        ["507f1f77bcf86cd799439011"],
      ),
    ).toEqual({
      $or: [
        {
          status: {
            $in: ["active", "upcoming"],
            $ne: "draft",
          },
        },
        {
          status: { $in: ["completed", "cancelled"] },
          _id: { $in: ["507f1f77bcf86cd799439011"] },
        },
      ],
    });
  });

  it("does not expose settled history to a viewer with no participant seats", () => {
    expect(
      scopeCompetitionStatusesToParticipant(
        ["completed", "cancelled"],
        [],
      ),
    ).toEqual({ _id: { $in: [] } });
  });

  it("keeps the participation scope inside the server-side paginated query", () => {
    const source = readFileSync(
      "lib/competitions/browse-competitions.ts",
      "utf8",
    );
    expect(source).toContain(
      'CompetitionParticipant.distinct("competitionId"',
    );
    expect(source).toContain("new Types.ObjectId(id)");
    expect(source).toContain("scopeCompetitionStatusesToParticipant(");
    expect(source).toContain("participantCompetitionObjectIds,");
    expect(source.indexOf("scopeCompetitionStatusesToParticipant(")).toBeLessThan(
      source.indexOf("const mongoQuery"),
    );
  });

  it("uses the uploaded ribbon as the only cancelled-status marker", () => {
    const parts = readFileSync(
      "components/competitions/arena/CompetitionCardParts.tsx",
      "utf8",
    );
    const card = readFileSync(
      "components/competitions/arena/ArenaCompetitionCard.tsx",
      "utf8",
    );
    expect(parts).toContain("!cancelled ? (");
    expect(parts).toContain("<CompetitionStatusBadge");
    expect(parts).toContain('p.status !== "cancelled"');
    expect(card).toContain("<CancelledRibbon");
  });
});
