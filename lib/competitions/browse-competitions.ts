/**
 * Server-side competitions browser — pageSize 10, filters, featured ranking.
 *
 * Reason: the arena must never fetchAllCompetitions() and filter thousands client-side.
 * Indexes already cover status+startTime / gameKey+status (competition.model.ts).
 */

import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import {
  annotatePrivateContests,
} from "@/lib/services/gamemaster/private-contest-listing.service";
import type { ContestViewer } from "@/lib/services/gamemaster/visible-contests";
import { withVisibleContests } from "@/lib/services/gamemaster/visible-contests";
import { resolveGameDefinition } from "./game-definitions";
import {
  COMPETITIONS_PAGE_SIZE,
  type BrowseCompetitionsResult,
  type BrowseSort,
} from "./browse-types";

/**
 * Attach catalogue bannerUrl so cards use the same artwork as /games.
 * Reason: Games prefers operator/catalogue banner; play-* neon is the fallback.
 */
async function attachCatalogueArtwork<T extends Record<string, unknown>>(
  rows: T[],
): Promise<T[]> {
  const codes = new Set<string>();
  for (const row of rows) {
    const code =
      typeof row.gameCode === "string" ? row.gameCode.trim().toLowerCase() : "";
    if (code) codes.add(code);
  }
  if (codes.size === 0) return rows;

  const titles = await ProviderGame.find({
    gameCode: { $in: [...codes] },
  })
    .select("gameCode bannerUrl thumbnailUrl")
    .lean();

  const byCode = new Map<string, string>();
  for (const t of titles) {
    const code = String(t.gameCode || "")
      .trim()
      .toLowerCase();
    if (!code) continue;
    const banner =
      (typeof t.bannerUrl === "string" && t.bannerUrl.trim()) ||
      (typeof t.thumbnailUrl === "string" && t.thumbnailUrl.trim()) ||
      "";
    if (banner) byCode.set(code, banner);
  }

  return rows.map((row) => {
    const code =
      typeof row.gameCode === "string" ? row.gameCode.trim().toLowerCase() : "";
    if (!code) return row;
    const banner = byCode.get(code);
    if (!banner) return row;
    return { ...row, bannerUrl: banner };
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

  const base: Record<string, unknown> = {
    status: { $in: statuses, $ne: "draft" },
  };

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

  const mongoQuery = withVisibleContests({ $and: and }, input.viewer);

  const { listProvidersBlockingEntries, shouldHideUpcomingEmptyDuringOutage } =
    await import("@/lib/services/game-providers/provider-entry-gate");
  const blocking = await listProvidersBlockingEntries();

  // Featured / newest use aggregation for status ranking; others use find+sort.
  let rows: Array<Record<string, unknown>> = [];
  let totalItems = 0;

  if (sort === "featured" || sort === "newest") {
    const pipeline: Record<string, unknown>[] = [
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

    let userInCompetitionIds: string[] = [];
    if (input.viewer.userId) {
      const ids = withArt.map((c) => String(c._id));
      if (ids.length > 0) {
        const parts = await CompetitionParticipant.find({
          userId: input.viewer.userId,
          competitionId: { $in: ids },
          status: { $in: ["active", "completed"] },
        })
          .select("competitionId")
          .lean();
        userInCompetitionIds = parts.map((p) => String(p.competitionId));
      }
    }

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
    Competition.countDocuments(
      withVisibleContests({ status: "active" }, input.viewer),
    ),
    Competition.countDocuments(
      withVisibleContests({ status: "upcoming" }, input.viewer),
    ),
    Competition.aggregate([
      { $match: withVisibleContests({ status: { $in: statuses } }, input.viewer) },
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

  let userInCompetitionIds: string[] = [];
  if (input.viewer.userId) {
    const ids = withArt.map((c) => String(c._id));
    if (ids.length > 0) {
      const parts = await CompetitionParticipant.find({
        userId: input.viewer.userId,
        competitionId: { $in: ids },
        status: { $in: ["active", "completed"] },
      })
        .select("competitionId")
        .lean();
      userInCompetitionIds = parts.map((p) => String(p.competitionId));
    }
  }

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
