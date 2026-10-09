/**
 * Server-side competitions browser — pageSize 10, filters, featured ranking.
 *
 * Reason: the arena must never fetchAllCompetitions() and filter thousands client-side.
 * Indexes already cover status+startTime / gameKey+status (competition.model.ts).
 */

import { Types, type PipelineStage } from "mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { loadTradingPageContent } from "@/lib/services/games/trading-page-content";
import {
  annotatePrivateContests,
} from "@/lib/services/gamemaster/private-contest-listing.service";
import type { ContestViewer } from "@/lib/services/gamemaster/visible-contests";
import { withVisibleContests } from "@/lib/services/gamemaster/visible-contests";
import { resolveGameDefinition } from "./game-definitions";
import { getTradingRiskSettings } from "@/lib/actions/trading/risk-settings.actions";
import {
  DIFFICULTY_SOURCE_FIELDS,
  difficultyForCompetition,
  isDifficultyLevel,
  type DifficultySource,
} from "./competition-difficulty-input";
import {
  COMPETITIONS_PAGE_SIZE,
  type BrowseCompetitionsResult,
  type BrowseSort,
} from "./browse-types";
import { scopeCompetitionStatusesToParticipant } from "./competition-participation-scope";

function pickImage(banner: unknown, thumb: unknown): string {
  if (typeof banner === "string" && banner.trim()) return banner.trim();
  if (typeof thumb === "string" && thumb.trim()) return thumb.trim();
  return "";
}

/**
 * Attach the SAME artwork the /games catalogue card shows, plus the game code.
 *
 * Reason: a competition stores its title at `gameConfig.gameCode`, never at the top level,
 * so the first version of this lookup (keyed on a top-level `gameCode`) matched nothing and
 * every card fell back to generic art. The catalogue keys provider titles by `gameKey`
 * (`player-catalogue.service.ts`) and trading by the trading page content — copied here.
 */
async function attachCatalogueArtwork<T extends Record<string, unknown>>(
  rows: T[],
): Promise<T[]> {
  const providerKeys = new Set<string>();
  let needsTrading = false;
  for (const row of rows) {
    const key = typeof row.gameKey === "string" ? row.gameKey : "";
    if (key.startsWith("provider:")) providerKeys.add(key);
    else needsTrading = true;
  }

  const byKey = new Map<string, string>();
  if (providerKeys.size > 0) {
    const titles = await ProviderGame.find({ gameKey: { $in: [...providerKeys] } })
      .select("gameKey bannerUrl thumbnailUrl")
      .lean();
    for (const t of titles) {
      const img = pickImage(t.bannerUrl, t.thumbnailUrl);
      if (img) byKey.set(String(t.gameKey), img);
    }
  }

  let tradingImage = "";
  if (needsTrading) {
    try {
      const content = await loadTradingPageContent();
      tradingImage = pickImage(content.bannerUrl, content.thumbnailUrl);
    } catch (error) {
      console.warn("⚠️ Trading page artwork unavailable for competitions:", error);
    }
  }

  return rows.map((row) => {
    const key = typeof row.gameKey === "string" ? row.gameKey : "";
    const config = row.gameConfig as
      | { gameCode?: unknown; settings?: unknown }
      | undefined;
    const gameSettings =
      config?.settings && typeof config.settings === "object"
        ? (config.settings as Record<string, unknown>)
        : undefined;
    const gameCode =
      typeof row.gameCode === "string" && row.gameCode
        ? row.gameCode
        : typeof config?.gameCode === "string"
          ? config.gameCode
          : undefined;
    const bannerUrl = key.startsWith("provider:")
      ? byKey.get(key)
      : tradingImage || undefined;
    return { ...row, gameCode, gameSettings, bannerUrl: bannerUrl ?? null };
  });
}

export { COMPETITIONS_PAGE_SIZE, type BrowseCompetitionsResult, type BrowseSort };

export interface BrowseCompetitionsInput {
  page?: number;
  limit?: number;
  /** Comma-separated statuses, e.g. "active,upcoming" */
  status?: string;
  game?: string;
  asset?: string;
  q?: string;
  sort?: BrowseSort | string;
  /** A DifficultyLevel; anything else is ignored. */
  difficulty?: string;
  viewer: ContestViewer;
}

function parseStatuses(raw: string | undefined): string[] {
  if (!raw || raw === "all") {
    return ["active", "upcoming", "completed", "cancelled"];
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["active", "upcoming"];
}

function gameMatchClause(game: string | undefined): Record<string, unknown> | null {
  if (!game || game === "all") return null;
  if (game === "trading") {
    // Reason: absent label resolves to trading (invariant 5); never match provider rows.
    return {
      $and: [
        { gameType: { $ne: "provider" } },
        {
          $or: [
            { gameType: "trading" },
            { gameType: { $exists: false } },
            { gameType: null },
            { gameKey: "trading" },
            { gameKey: { $in: [null, ""] } },
          ],
        },
      ],
    };
  }
  if (game === "provider") {
    return { gameType: "provider" };
  }
  if (game === "circuitSprint") {
    return {
      $or: [
        { gameCode: /circuit|sprint|perfect/i },
        { gameKey: /circuit|sprint|perfect/i },
        { name: /circuit|sprint|perfect/i },
      ],
    };
  }
  if (game === "voltVelocity") {
    return {
      $or: [
        { gameCode: /velocity/i },
        { gameKey: /velocity/i },
        { name: /velocity/i },
      ],
    };
  }
  if (game === "voltStack") {
    return {
      $or: [
        { gameCode: /stack/i },
        { gameKey: /stack/i },
        { name: /stack/i },
      ],
    };
  }
  return null;
}

function statusRankExpr() {
  return {
    $switch: {
      branches: [
        { case: { $eq: ["$status", "active"] }, then: 1 },
        { case: { $eq: ["$status", "upcoming"] }, then: 2 },
        { case: { $eq: ["$status", "completed"] }, then: 6 },
        { case: { $eq: ["$status", "cancelled"] }, then: 7 },
      ],
      default: 8,
    },
  };
}

/** Above this many candidates the filter still works, but we say so in the log. */
const DIFFICULTY_SCAN_WARN = 5000;

/**
 * Difficulty is derived from eight fields rather than stored, so it cannot be a Mongo
 * predicate. Reason: filtering the fetched page in the browser (the previous version)
 * showed 0-10 cards out of every page and a total that ignored the filter. Instead read
 * the deciding fields of every candidate, decide here with the SAME helper the cards use,
 * and hand the matching ids back to the normal query so sort, counts and pages stay right.
 */
async function idsMatchingDifficulty(
  query: Record<string, unknown>,
  level: string,
): Promise<unknown[]> {
  let platformLeverage = 100;
  try {
    const settings = await getTradingRiskSettings();
    if (settings?.maxLeverage) platformLeverage = settings.maxLeverage;
  } catch (error) {
    console.warn("⚠️ Risk settings unavailable for difficulty filter:", error);
  }

  const candidates = await Competition.find(query)
    .select(DIFFICULTY_SOURCE_FIELDS)
    .lean();
  if (candidates.length > DIFFICULTY_SCAN_WARN) {
    console.warn(
      `⚠️ Difficulty filter scanned ${candidates.length} competitions; consider storing difficulty.`,
    );
  }
  return candidates
    .filter(
      (c) =>
        difficultyForCompetition(c as DifficultySource, platformLeverage)
          .level === level,
    )
    .map((c) => c._id);
}

export async function browseCompetitions(
  input: BrowseCompetitionsInput,
): Promise<BrowseCompetitionsResult> {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number(input.limit) || COMPETITIONS_PAGE_SIZE),
  );
  const statuses = parseStatuses(input.status);
  const sort = (input.sort || "featured") as BrowseSort;

  const participantCompetitionIds = input.viewer.userId
    ? (
        await CompetitionParticipant.distinct("competitionId", {
          userId: input.viewer.userId,
        })
      ).map(String)
    : [];
  const participantCompetitionIdSet = new Set(participantCompetitionIds);
  // Reason: Mongoose casts find() predicates but does not cast aggregation
  // pipelines; the featured query is an aggregate over ObjectId `_id` values.
  const participantCompetitionObjectIds = participantCompetitionIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const base = scopeCompetitionStatusesToParticipant(
    statuses,
    participantCompetitionObjectIds,
  );

  const gameClause = gameMatchClause(input.game);
  // Reason: trading clause sets gameType twice if merged naively — build $and.
  const and: Record<string, unknown>[] = [base];
  if (gameClause) and.push(gameClause);

  if (input.asset) {
    and.push({ assetClasses: input.asset });
  }

  const q = (input.q || "").trim();
  if (q) {
    // Reason: escape before $regex so user search cannot inject a pattern.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = { $regex: escaped, $options: "i" };
    and.push({
      $or: [
        { name: rx },
        { description: rx },
        { gameKey: rx },
        { gameCode: rx },
        { createdByName: rx },
        { gameMasterName: rx },
        { assetClasses: rx },
      ],
    });
  }

  if (isDifficultyLevel(input.difficulty)) {
    and.push({
      _id: {
        $in: await idsMatchingDifficulty(
          withVisibleContests({ $and: [...and] }, input.viewer),
          input.difficulty,
        ),
      },
    });
  }

  const mongoQuery = withVisibleContests({ $and: and }, input.viewer);

  const { listProvidersBlockingEntries, shouldHideUpcomingEmptyDuringOutage } =
    await import("@/lib/services/game-providers/provider-entry-gate");
  const blocking = await listProvidersBlockingEntries();

  // Featured / newest use aggregation for status ranking; others use find+sort.
  let rows: Array<Record<string, unknown>> = [];
  let totalItems = 0;

  if (sort === "featured" || sort === "newest") {
    const pipeline: PipelineStage[] = [
      { $match: mongoQuery },
      {
        $addFields: {
          _statusRank: statusRankExpr(),
          _prize: {
            $ifNull: ["$prizePoolCredits", { $ifNull: ["$prizePool", 0] }],
          },
        },
      },
      {
        $sort:
          sort === "featured"
            ? { _statusRank: 1, startTime: -1 }
            : { createdAt: -1 },
      },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize * 3 }, // over-fetch; outage filter may drop some
          ],
          total: [{ $count: "n" }],
          live: [
            { $match: { status: "active" } },
            { $count: "n" },
          ],
          soon: [
            { $match: { status: "upcoming" } },
            { $count: "n" },
          ],
          prize: [
            {
              $group: {
                _id: null,
                sum: { $sum: "$_prize" },
              },
            },
          ],
        },
      },
    ];

    const [agg] = await Competition.aggregate(pipeline);
    const rawItems = (agg?.items || []) as Array<Record<string, unknown>>;
    totalItems = Number(agg?.total?.[0]?.n || 0);

    const visible = rawItems.filter(
      (c) => !shouldHideUpcomingEmptyDuringOutage(c as never, blocking),
    );
    rows = visible.slice(0, pageSize);

    const liveNow = Number(agg?.live?.[0]?.n || 0);
    const startingSoon = Number(agg?.soon?.[0]?.n || 0);
    const totalPrizePool = Number(agg?.prize?.[0]?.sum || 0);

    const annotated = await annotatePrivateContests(rows, input.viewer);
    const withArt = await attachCatalogueArtwork(
      annotated as Array<Record<string, unknown>>,
    );

    const userInCompetitionIds = withArt
      .map((c) => String(c._id))
      .filter((id) => participantCompetitionIdSet.has(id));

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      items: JSON.parse(JSON.stringify(withArt)),
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      kpis: { liveNow, startingSoon, totalPrizePool },
      userInCompetitionIds,
    };
  }

  // Non-featured sorts
  const sortSpec: Record<string, 1 | -1> =
    sort === "start"
      ? { startTime: 1 }
      : sort === "prize"
        ? { prizePoolCredits: -1 }
        : sort === "participants"
          ? { currentParticipants: -1 }
          : sort === "entry"
            ? { entryFeeCredits: 1 }
            : { startTime: -1 };

  const [listed, count, liveNow, startingSoon, prizeAgg] = await Promise.all([
    Competition.find(mongoQuery)
      .sort(sortSpec)
      .skip((page - 1) * pageSize)
      .limit(pageSize * 3)
      .lean(),
    Competition.countDocuments(mongoQuery),
    Competition.countDocuments({ $and: [mongoQuery, { status: "active" }] }),
    Competition.countDocuments({ $and: [mongoQuery, { status: "upcoming" }] }),
    Competition.aggregate([
      { $match: mongoQuery },
      {
        $group: {
          _id: null,
          sum: {
            $sum: {
              $ifNull: ["$prizePoolCredits", { $ifNull: ["$prizePool", 0] }],
            },
          },
        },
      },
    ]),
  ]);

  totalItems = count;
  const visible = (listed as Array<Record<string, unknown>>).filter(
    (c) => !shouldHideUpcomingEmptyDuringOutage(c as never, blocking),
  );
  // Optional post-filter when game was trading-shaped but provider slipped through
  const gameFiltered =
    input.game && input.game !== "all"
      ? visible.filter((c) => resolveGameDefinition(c as never).id === input.game)
      : visible;
  rows = gameFiltered.slice(0, pageSize);

  const annotated = await annotatePrivateContests(rows, input.viewer);
  const withArt = await attachCatalogueArtwork(
    annotated as Array<Record<string, unknown>>,
  );

  const userInCompetitionIds = withArt
    .map((c) => String(c._id))
    .filter((id) => participantCompetitionIdSet.has(id));

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    items: JSON.parse(JSON.stringify(withArt)),
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    kpis: {
      liveNow,
      startingSoon,
      totalPrizePool: Number(prizeAgg?.[0]?.sum || 0),
    },
    userInCompetitionIds,
  };
}
