/**
 * The referred-players read model (`External game plans/24` s7.1, task 3 of the v2 programme).
 *
 * ONE answer to "who did this Game Master bring in, how, when, are they playing, and what have
 * they earned the Game Master" - read by the admin report, the Game Master's own affiliate
 * area and the financial breakdown, so the three cannot disagree. Read-only. Mirrored into
 * `apps/admin` (byte-identical test); it takes a `Db` so each app passes its own connection.
 *
 * Built as one aggregation per page. Three facts it does NOT take from the referral row,
 * because nothing writes them: `lastActivityAt`, `totalEntryFees` and `totalGMEarnings` on
 * `userreferrals` are declared and stay at their defaults for ever. Activity is read from
 * seats, money from `gamemasterearnings`.
 */

import type { Document } from "mongodb";
import type { AffiliationSource, AffiliationSurface } from "../../../database/models/user-referral.model";
import {
  effectiveSourceExpression,
  LEGACY_AFFILIATION_SOURCE,
  referralKindExpression,
  referralSurfaceExpression,
  REFERRAL_KINDS,
  type ReferralKind,
} from "./referral-kind";
import {
  escapeRegex,
  type ReferredPlayersFilter,
  type ReferredPlayersPaging,
} from "./referral-report-filter";

/** "Active" = a contest seat within this many days, while affiliated (`24` s6.1). */
export const ACTIVE_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
// The latest date a BSON Date can hold - an open affiliation's "until".
const FAR_FUTURE = new Date(8.64e15);
const EPOCH = new Date(0);

/**
 * The one database capability the read model needs. Reason: structural rather than the
 * driver's `Db` - mongoose bundles its own copy of `mongodb`, so `mongoose.connection.db` is a
 * different nominal type from the top-level package's `Db` in both apps.
 */
export interface AggregatableDb {
  collection(name: string): {
    aggregate(pipeline: Document[], options?: { allowDiskUse?: boolean }): {
      toArray(): Promise<Document[]>;
    };
    find?(
      filter: Document,
      options?: { projection?: Document; limit?: number },
    ): { toArray(): Promise<Document[]> };
  };
}

/**
 * Resolve a free-text phone fragment into user ids before the affiliation pipeline
 * runs. Reason: `userreferrals` does not store phone; the reference search matches
 * phone and the only place that field lives is `user`. Skipped when
 * `maskExternalContact` is set — operators without the grant must not discover
 * users by phone number.
 */
async function withPhoneSearchIds(
  db: AggregatableDb,
  filter: ReferredPlayersFilter,
): Promise<ReferredPlayersFilter> {
  const needle = filter.search?.trim();
  if (!needle || filter.maskExternalContact) return filter;
  // Digits-only: letters are handled by the pipeline's email/name match alone.
  if (!/\d/.test(needle)) return filter;
  const find = db.collection("user").find;
  if (typeof find !== "function") return filter;

  const digits = needle.replace(/\D/g, "");
  const pattern = digits.length >= 3 ? digits : escapeRegex(needle);
  const rows = await find.call(db.collection("user"), {
    phone: { $regex: pattern, $options: "i" },
  }, { projection: { _id: 1, id: 1 }, limit: 200 }).toArray();

  const phoneUserIds = rows
    .flatMap((row) => {
      const ids: string[] = [];
      if (typeof row.id === "string" && row.id) ids.push(row.id);
      if (row._id != null) ids.push(String(row._id));
      return ids;
    })
    .filter((id, i, arr) => arr.indexOf(id) === i);

  if (phoneUserIds.length === 0) return filter;
  return { ...filter, phoneUserIds };
}

export interface ReferredPlayerRow {
  referralId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  gameMasterId: string;
  gameMasterEmail: string;
  kind: ReferralKind;
  source: AffiliationSource | null;
  surface: AffiliationSurface | null;
  viaCompetitionId: string | null;
  /** The shown stint's start; `firstJoinedAt` is the pair's first, earlier if they rejoined. */
  joinedAt: string | null;
  firstJoinedAt: string | null;
  /** How many stints this player has had with this Game Master (2+ = rejoined). */
  affiliations: number;
  endedAt: string | null;
  endedReason: string | null;
  /** The affiliation itself is live (the one active row, R119). */
  isCurrent: boolean;
  /** Current AND a contest seat within ACTIVE_WINDOW_DAYS. */
  isActive: boolean;
  lastActivityAt: string | null;
  competitionsEntered: number;
  challengesEntered: number;
  /** Non-cancelled entry fees the Game Master earned on, in credits. */
  entryFees: number;
  earned: number;
  paid: number;
  pending: number;
  /** Covered by D6 - the Game Master screens show contact details only when true. */
  termsAccepted: boolean;
  /** From the player's profile. `phone` is contact data: the Game Master view never maps it. */
  phone: string | null;
  country: string | null;
}

export interface ReferralGroupTotals {
  players: number;
  current: number;
  active: number;
  entryFees: number;
  earned: number;
  paid: number;
  pending: number;
}

export interface ReferredPlayersReport {
  rows: ReferredPlayerRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    all: ReferralGroupTotals;
    byKind: Record<ReferralKind, ReferralGroupTotals>;
    bySurface: Array<{ surface: AffiliationSurface | null } & ReferralGroupTotals>;
  };
  asOf: string;
}

function emptyTotals(): ReferralGroupTotals {
  return { players: 0, current: 0, active: 0, entryFees: 0, earned: 0, paid: 0, pending: 0 };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function iso(value: unknown): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function searchMatch(filter: ReferredPlayersFilter, withConsent: boolean): Document {
  if (!filter.search) return {};
  const pattern = escapeRegex(filter.search);
  const byEmail: Document = { userEmail: { $regex: pattern, $options: "i" } };
  // Reason: the same test as the view's email gate - a non-empty acceptance id AND a referral
  // still assigned to this Game Master (`isCurrent` is `isActive === true`) - so a row the
  // search can find by email is exactly a row whose email the screen may show.
  if (withConsent && filter.contactRequiresConsent) {
    byEmail.termsAcceptanceId = { $type: "string", $ne: "" };
    byEmail.isActive = true;
  }
  // Reason: the client id is the one identifier every screen shows, so an exact match on it
  // is always allowed - it reveals nothing the row does not already display.
  const byId: Document = { userId: filter.search.trim() };
  const openOr: Document[] = [byId, byEmail, { userName: { $regex: pattern, $options: "i" } }];
  // Reason: admin phone search resolves matching user ids before the aggregation (see
  // `resolvePhoneSearchUserIds`). Never attached when `maskExternalContact` is set - a Game
  // Master must not discover a hidden phone by whether a row appears.
  if (filter.phoneUserIds && filter.phoneUserIds.length > 0 && !filter.maskExternalContact) {
    openOr.push({ userId: { $in: filter.phoneUserIds } });
  }
  const open: Document = { $or: openOr };
  if (!(withConsent && filter.maskExternalContact)) return open;
  // Reason: a masked external row must not be findable by what the screen hides, or typing a
  // guessed email or surname confirms it by whether the row appears. Only the exact id, or the
  // START of the name when the query has no whitespace (so it cannot reach the second word),
  // and never a name holding an `@`, which `maskLastName` hides whole.
  const masked: Document[] = [byId];
  if (!/\s/.test(filter.search.trim())) {
    masked.push({
      $and: [
        { userName: { $regex: `^${pattern}`, $options: "i" } },
        { userName: { $not: /@/ } },
      ],
    });
  }
  return {
    $or: [
      { kind: { $ne: "external" }, ...open },
      { kind: "external", $or: masked },
    ],
  };
}

/** Stages on the raw referral row, before anything is computed. Index-friendly. */
function baseMatch(filter: ReferredPlayersFilter): Document {
  const match: Document = { ...searchMatch(filter, false) };
  if (filter.gameMasterIds) match.gameMasterId = { $in: filter.gameMasterIds };
  return match;
}

/**
 * Filters on the ONE row a player gets per Game Master (see `groupPerPlayer`).
 * Reason: applied after grouping, never to the raw rows - filtering "ended" first would keep
 * the old stint of a player who has since rejoined and report them ended while they are
 * affiliated, and the consent test must look at the row whose email the screen would show,
 * or an email on an older consented stint answers a search the current row may not.
 */
function groupedMatch(filter: ReferredPlayersFilter): Document {
  const match: Document = { ...searchMatch(filter, true) };
  if (filter.status === "current") match.isActive = true;
  if (filter.status === "ended") match.isActive = { $ne: true };
  if (filter.joinedFrom || filter.joinedTo) {
    match.referredAt = {
      ...(filter.joinedFrom ? { $gte: filter.joinedFrom } : {}),
      ...(filter.joinedTo ? { $lte: filter.joinedTo } : {}),
    };
  }
  return match;
}

/**
 * One row per (player, Game Master). Reason: a detach followed by a rejoin writes a second
 * `userreferrals` document for the same pair, and listing both showed one player twice - once
 * ended, once current. The row shown is the current stint if there is one, else the latest;
 * contests and money are SUMMED over every stint with that Game Master, because each stint's
 * window is disjoint and dropping the old one would erase what it earned. A player moved to a
 * different Game Master still appears once under each - they are two relationships.
 */
function groupPerPlayer(): Document[] {
  const summed = ["competitionsEntered", "challengesEntered", "entryFees", "earned", "paid", "pending"];
  return [
    { $sort: { isActive: -1, referredAt: -1, _id: -1 } },
    {
      $group: {
        _id: { u: "$userId", gm: "$gameMasterId" },
        doc: { $first: "$$ROOT" },
        affiliations: { $sum: 1 },
        lastActivity: { $max: "$lastActivity" },
        firstJoinedAt: { $min: "$referredAt" },
        ...Object.fromEntries(summed.map((f) => [f, { $sum: `$${f}` }])),
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$doc",
            {
              affiliations: "$affiliations",
              lastActivity: "$lastActivity",
              firstJoinedAt: "$firstJoinedAt",
              ...Object.fromEntries(summed.map((f) => [f, `$${f}`])),
            },
          ],
        },
      },
    },
  ];
}

/**
 * The affiliation's time window. The END is always the row's `endedAt` (open = for ever).
 * Reason: the START is `referredAt` for every row EXCEPT a referral-link (or legacy) one.
 * Those may carry a `referredAt` written later than their real start (the old sync route
 * stamped "now"), and windowing them would hide earnings that genuinely belong to the pair. A
 * player can only sign up through a link once, so those rows have no earlier row to overlap.
 * Join GM and admin-move rows are written by code that stamps the real moment, and an admin
 * move row windowed from the epoch credited the NEW Game Master with every contest the player
 * had ever entered under the old one (found 1 Oct 2026).
 */
function windowStages(): Document[] {
  return [
    {
      $addFields: {
        _from: { $cond: [{ $eq: ["$_effSource", LEGACY_AFFILIATION_SOURCE] }, EPOCH, "$referredAt"] },
        _to: { $ifNull: ["$endedAt", FAR_FUTURE] },
      },
    },
  ];
}

function seatLookup(from: string, dateField: string, as: string): Document {
  return {
    $lookup: {
      from,
      let: { u: "$userId", from: "$_from", to: "$_to" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$userId", "$$u"] },
                { $gte: [`$${dateField}`, "$$from"] },
                { $lt: [`$${dateField}`, "$$to"] },
              ],
            },
          },
        },
        { $group: { _id: null, count: { $sum: 1 }, last: { $max: `$${dateField}` } } },
      ],
      as,
    },
  };
}

function earningsLookup(): Document {
  const notCancelled = { $ne: ["$status", "cancelled"] };
  return {
    $lookup: {
      from: "gamemasterearnings",
      let: { gm: "$gameMasterId", u: "$userId", from: "$_from", to: "$_to" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$gameMasterId", "$$gm"] },
                { $eq: ["$referredUserId", "$$u"] },
                { $gte: ["$createdAt", "$$from"] },
                { $lt: ["$createdAt", "$$to"] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            entryFees: { $sum: { $cond: [notCancelled, "$entryFeeAmount", 0] } },
            earned: { $sum: { $cond: [notCancelled, "$netEarning", 0] } },
            paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$netEarning", 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$netEarning", 0] } },
          },
        },
      ],
      as: "_earn",
    },
  };
}

/**
 * Phone and country live on the Better Auth `user` document, never on the referral row.
 * Reason: inside the rows facet AFTER `$limit`, so it costs one page of index lookups, and
 * keyed on `_id` as the ObjectId the id string spells - Better Auth keeps the identity in
 * `_id`, and a lookup on an `id` field alone finds nothing (R68). The string itself is the
 * fallback for a string `_id`. Only the two fields are projected, never the whole account.
 */
function contactLookup(): Document[] {
  const uid = { $convert: { input: "$userId", to: "objectId", onError: "$userId", onNull: "$userId" } };
  return [
    { $addFields: { _uid: uid } },
    {
      $lookup: {
        from: "user",
        localField: "_uid",
        foreignField: "_id",
        pipeline: [{ $project: { _id: 0, phone: 1, country: 1 } }],
        as: "_user",
      },
    },
    { $addFields: { phone: { $first: "$_user.phone" }, country: { $first: "$_user.country" } } },
  ];
}

export function buildReferredPlayersPipeline(
  filter: ReferredPlayersFilter,
  paging: ReferredPlayersPaging,
  now: Date,
): Document[] {
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS);
  const derivedMatch: Document = {};
  if (filter.kind) derivedMatch.kind = filter.kind;
  if (filter.surface) derivedMatch.surface = filter.surface;
  if (filter.activity) derivedMatch.isActiveNow = filter.activity === "active";

  const lastOf = (field: string) => ({ $ifNull: [{ $first: `$${field}.last` }, null] });

  return [
    { $match: baseMatch(filter) },
    { $addFields: { _effSource: effectiveSourceExpression() } },
    {
      $addFields: {
        kind: referralKindExpression("$_effSource"),
        surface: referralSurfaceExpression("$_effSource"),
      },
    },
    ...windowStages(),
    seatLookup("competitionparticipants", "enteredAt", "_comp"),
    seatLookup("challengeparticipants", "joinedAt", "_chal"),
    earningsLookup(),
    {
      $addFields: {
        lastActivity: { $max: [lastOf("_comp"), lastOf("_chal")] },
        competitionsEntered: { $ifNull: [{ $first: "$_comp.count" }, 0] },
        challengesEntered: { $ifNull: [{ $first: "$_chal.count" }, 0] },
        entryFees: { $ifNull: [{ $first: "$_earn.entryFees" }, 0] },
        earned: { $ifNull: [{ $first: "$_earn.earned" }, 0] },
        paid: { $ifNull: [{ $first: "$_earn.paid" }, 0] },
        pending: { $ifNull: [{ $first: "$_earn.pending" }, 0] },
      },
    },
    ...groupPerPlayer(),
    { $match: groupedMatch(filter) },
    {
      $addFields: {
        isActiveNow: {
          $and: [{ $eq: ["$isActive", true] }, { $gte: [{ $ifNull: ["$lastActivity", EPOCH] }, activeSince] }],
        },
      },
    },
    { $match: derivedMatch },
    {
      $facet: {
        rows: [
          { $sort: { referredAt: -1, _id: -1 } },
          { $skip: (paging.page - 1) * paging.limit },
          { $limit: paging.limit },
          ...contactLookup(),
          {
            $project: {
              _comp: 0, _chal: 0, _earn: 0, _from: 0, _to: 0, _uid: 0, _user: 0, signupIP: 0, signupUserAgent: 0,
            },
          },
        ],
        total: [{ $count: "n" }],
        groups: [
          {
            $group: {
              _id: { kind: "$kind", surface: "$surface" },
              players: { $sum: 1 },
              current: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
              active: { $sum: { $cond: ["$isActiveNow", 1, 0] } },
              entryFees: { $sum: "$entryFees" },
              earned: { $sum: "$earned" },
              paid: { $sum: "$paid" },
              pending: { $sum: "$pending" },
            },
          },
        ],
      },
    },
  ];
}

export function toReferredPlayerRow(doc: Document): ReferredPlayerRow {
  return {
    referralId: String(doc._id),
    userId: String(doc.userId ?? ""),
    userName: typeof doc.userName === "string" ? doc.userName : null,
    userEmail: String(doc.userEmail ?? ""),
    gameMasterId: String(doc.gameMasterId ?? ""),
    gameMasterEmail: String(doc.gameMasterEmail ?? ""),
    kind: doc.kind as ReferralKind,
    source: (doc._effSource ?? null) as AffiliationSource | null,
    surface: (doc.surface ?? null) as AffiliationSurface | null,
    viaCompetitionId:
      typeof doc.affiliatedVia?.competitionId === "string" ? doc.affiliatedVia.competitionId : null,
    joinedAt: iso(doc.referredAt),
    firstJoinedAt: iso(doc.firstJoinedAt ?? doc.referredAt),
    affiliations: Math.max(1, num(doc.affiliations)),
    endedAt: iso(doc.endedAt),
    endedReason: typeof doc.endedReason === "string" ? doc.endedReason : null,
    isCurrent: doc.isActive === true,
    isActive: doc.isActiveNow === true,
    lastActivityAt: iso(doc.lastActivity),
    competitionsEntered: num(doc.competitionsEntered),
    challengesEntered: num(doc.challengesEntered),
    entryFees: num(doc.entryFees),
    earned: num(doc.earned),
    paid: num(doc.paid),
    pending: num(doc.pending),
    termsAccepted: typeof doc.termsAcceptanceId === "string" && doc.termsAcceptanceId.length > 0,
    phone: text(doc.phone),
    country: text(doc.country),
  };
}

function addInto(target: ReferralGroupTotals, g: Document): void {
  target.players += num(g.players);
  target.current += num(g.current);
  target.active += num(g.active);
  target.entryFees += num(g.entryFees);
  target.earned += num(g.earned);
  target.paid += num(g.paid);
  target.pending += num(g.pending);
}

/** Never throws for "no rows"; a database error propagates so the route can 500 with a log. */
export async function readReferredPlayers(
  db: AggregatableDb,
  filter: ReferredPlayersFilter,
  paging: ReferredPlayersPaging,
  now: Date = new Date(),
): Promise<ReferredPlayersReport> {
  const enriched = await withPhoneSearchIds(db, filter);
  const [facet] = await db
    .collection("userreferrals")
    .aggregate(buildReferredPlayersPipeline(enriched, paging, now), { allowDiskUse: true })
    .toArray();

  const byKind = Object.fromEntries(REFERRAL_KINDS.map((k) => [k, emptyTotals()])) as Record<
    ReferralKind,
    ReferralGroupTotals
  >;
  const all = emptyTotals();
  const surfaces = new Map<string, { surface: AffiliationSurface | null } & ReferralGroupTotals>();

  for (const g of (facet?.groups ?? []) as Document[]) {
    const kind = g._id?.kind as ReferralKind;
    const surface = (g._id?.surface ?? null) as AffiliationSurface | null;
    addInto(all, g);
    // Reason: `kind` came from the database, so it is checked against the allow-list first.
    // eslint-disable-next-line security/detect-object-injection
    if (REFERRAL_KINDS.includes(kind)) addInto(byKind[kind], g);
    const key = surface ?? "";
    const bucket = surfaces.get(key) ?? { surface, ...emptyTotals() };
    addInto(bucket, g);
    surfaces.set(key, bucket);
  }

  return {
    rows: ((facet?.rows ?? []) as Document[]).map(toReferredPlayerRow),
    total: num((facet?.total as Document[] | undefined)?.[0]?.n),
    page: paging.page,
    limit: paging.limit,
    summary: { all, byKind, bySurface: [...surfaces.values()].sort((a, b) => b.players - a.players) },
    asOf: now.toISOString(),
  };
}
