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
    const cta = readFileSync(
      "components/competitions/arena/CompetitionCTA.tsx",
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
    expect(card).toContain("only=\"creator\"");
    expect(card).toContain("only=\"other\"");
    expect(list).toContain('<CardContextDataBlocks presentation={p} layout="list"');
    // Host spans two cells in both views; private access is a ribbon, not a box.
    expect(parts).toContain('tag.tone === "creator" ? "col-span-2"');
    expect(parts).toContain('tag.tone !== "private"');
    // Countdown is two cells and leads the context, in both views, so
    // Funding sits beside it.
    expect(parts.indexOf("{countdown}")).toBeGreaterThan(-1);
    expect(parts.indexOf("{countdown}")).toBeLessThan(
      parts.indexOf("{tags.map((tag)"),
    );
    // CTA: centred own row, one box tall, never stretched, no blurring glow.
    expect(cta).toContain("!greyed && glow && !fillCell");
    expect(list).toContain("col-span-full flex h-[56px] items-stretch justify-center");
    expect(card).toContain("col-span-full flex h-[56px] items-stretch justify-center");
    expect(card).toContain("<PrivateRibbon");
    expect(list).toContain("<PrivateRibbon");
    expect(parts).toContain("COMPETITION_TYPE_RIBBON_ASSET.private");
    expect(parts).toContain("absolute -left-1 -top-1");
    expect(parts.indexOf('["private", 1]')).toBeLessThan(
      parts.indexOf('["creator", 4]'),
    );
    expect(parts.indexOf('["creator", 1]')).toBeLessThan(
      parts.indexOf('["private", 2]'),
    );
    // Reason: CTA occupies the metric cell, but its artwork keeps its own
    // proportions — `object-fill` visibly stretched the baked-in text.
    expect(cta).not.toContain("object-fill");
    expect(cta).toContain('className="object-contain"');
    expect(card).toContain("fillCell");
    expect(list).toContain("fillCell");
    expect(card).toContain('className="h-full w-full"');
    expect(list).toContain('className="h-full w-full"');
    // Grid order: metrics → two-cell Host → two-cell countdown + Funding →
    // CTA on its own full-width, centred row (box count varies per game).
    const cardGridStart = card.indexOf("mt-auto grid grid-flow-row-dense");
    const creator = card.indexOf('only="creator"', cardGridStart);
    const other = card.indexOf('only="other"', cardGridStart);
    const cardCta = card.indexOf("<CompetitionCTA", cardGridStart);
    expect(cardGridStart).toBeGreaterThan(-1);
    expect(creator).toBeGreaterThan(cardGridStart);
    expect(other).toBeGreaterThan(creator);
    expect(cardCta).toBeGreaterThan(other);
    expect(card.slice(other, cardCta)).toContain(
      "col-span-full flex h-[56px] items-stretch justify-center",
    );

    // CTA must live inside the metric grid so it aligns with the boxes.
    const listGridStart = list.indexOf("mt-auto grid grid-flow-row-dense");
    expect(listGridStart).toBeGreaterThan(-1);
    const listMetricsGrid = list.slice(listGridStart, list.indexOf("</article>"));
    expect(listMetricsGrid.indexOf("<CardContextDataBlocks")).toBeLessThan(
      listMetricsGrid.indexOf("<CompetitionCTA"),
    );
    expect(card.slice(cardGridStart, card.indexOf("</article>"))).toContain(
      "<CompetitionCTA",
    );
    expect(list).not.toContain("@[1100px]:grid-cols-[230px_minmax(0,1fr)_220px]");
    expect(list).not.toContain("flex items-end justify-center");
    expect(card).toContain("<CompetitionTypeRibbon");
    expect(list).toContain("<CompetitionTypeRibbon");
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

  it("uses the gamepad for board size, a short GM tag, a compact clock and narrow-cell values", () => {
    const read = (p: string) => readFileSync(p, "utf8");
    const presentation = read("lib/competitions/build-competition-presentation.ts");
    expect(presentation).toContain('["boardSize", COMPETITION_ICON.gamepad]');
    expect(presentation).toContain('label: "GM", tone: "funded"');
    expect(presentation).not.toContain('"GM Funded"');
    expect(read("lib/competitions/game-definitions.ts")).toContain(
      "gamepad: `${ICON_BASE}/icon-gamepad.png`",
    );
    expect(read("components/competitions/arena/CompetitionCountdown.tsx")).toContain(
      "whitespace-nowrap font-mono text-[12px]",
    );
    expect(read("components/competitions/arena/CompetitionDataShell.tsx")).toContain(
      "text-[13px] text-white @[150px]:text-[15px]",
    );
  });

  it("marks suggestions the player already joined with the ALREADY IN ribbon and button", () => {
    const service = readFileSync("lib/services/games/game-suggestions.service.ts", "utf8");
    const card = readFileSync("components/dashboard/GameSuggestionsCard.tsx", "utf8");
    expect(service).toContain('status: { $ne: "refunded" }');
    expect(service).toContain("alreadyIn: joined.has(c._id.toString())");
    expect(card).toContain("COMPETITION_TYPE_RIBBON_ASSET.alreadyIn");
    expect(card).toContain('{c.alreadyIn ? "Already In" : "Join"}');
  });
});
