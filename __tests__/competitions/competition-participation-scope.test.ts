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
    expect(parts).toContain("if (isCancelled(p)) return null");
    expect(parts).toContain("<CompetitionStatusBadge");
    expect(parts).toContain('p.status !== "cancelled"');
    expect(parts).toContain('borderColor: "rgba(248,74,89,.92)"');
    expect(parts).toContain("CANCELLED_SCRIM");
    expect(card).toContain("<CancelledRibbon");
  });

  it("keeps the header clear and puts context plus time in the data grid", () => {
    const parts = readFileSync(
      "components/competitions/arena/CompetitionCardParts.tsx",
      "utf8",
    );
    const card = readFileSync(
      "components/competitions/arena/ArenaCompetitionCard.tsx",
      "utf8",
    );
    const list = readFileSync(
      "components/competitions/arena/ArenaCompetitionListRow.tsx",
      "utf8",
    );
    const infoBlock = readFileSync(
      "components/competitions/arena/CompetitionInfoDataBlock.tsx",
      "utf8",
    );
    const dataBlock = readFileSync(
      "components/competitions/arena/CompetitionDataBlock.tsx",
      "utf8",
    );
    const countdown = readFileSync(
      "components/competitions/arena/CompetitionCountdown.tsx",
      "utf8",
    );
    const header = parts.slice(
      parts.indexOf("export function CardBadgesRow"),
      parts.indexOf("export function CardContextDataBlocks"),
    );

    expect(header).not.toContain("p.tags.map");
    expect(header).not.toContain("CompetitionCountdown");
    expect(parts).toContain("<CompetitionInfoDataBlock");
    expect(parts).toContain("<CompetitionCountdownDataBlock");
    expect(card).toContain('<CardContextDataBlocks presentation={p} layout="grid"');
    expect(list).toContain('<CardContextDataBlocks presentation={p} layout="list"');
    expect(parts).toContain('tag.tone === "creator" ? "col-span-2"');
    expect(parts.indexOf('["private", 1]')).toBeLessThan(
      parts.indexOf('["creator", 4]'),
    );
    expect(parts.indexOf('["creator", 1]')).toBeLessThan(
      parts.indexOf('["private", 2]'),
    );
    expect(card).toContain('className="w-full max-w-[220px]"');
    expect(card).not.toContain("max-w-none");
    // Reason: CTA must live inside the metric grid so it aligns with the boxes.
    const listMetricsGrid = list.slice(
      list.indexOf('mt-auto grid auto-rows-fr'),
      list.indexOf("<CardContextDataBlocks"),
    );
    const cardMetricsGrid = card.slice(
      card.indexOf('mt-auto grid auto-rows-fr'),
      card.indexOf("<CardContextDataBlocks"),
    );
    expect(listMetricsGrid).toContain("<CompetitionCTA");
    expect(cardMetricsGrid).toContain("<CompetitionCTA");
    expect(list).not.toContain("@[1100px]:grid-cols-[230px_minmax(0,1fr)_220px]");
    expect(list).not.toContain("flex items-end justify-center");
    expect(infoBlock).toContain("<PopoverTrigger asChild>");
    expect(infoBlock).toContain("onPointerEnter={showForMouse}");
    expect(infoBlock).toContain("onPointerLeave={hideForMouse}");
    expect(infoBlock).toContain('event.pointerType === "mouse"');
    expect(infoBlock).toContain("onOpenChange={setOpen}");
    expect(infoBlock).toContain("onOpenAutoFocus={(event) => event.preventDefault()}");
    expect(countdown).toContain("<CompetitionInfoDataBlock");
    expect(dataBlock).toContain('metric.key === "mode"');
    expect(dataBlock).toContain("describeCompetitionMode(metric.value)");
    expect(dataBlock).toContain("<CompetitionInfoDataBlock");
  });
});
