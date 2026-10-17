/**
 * Filters for the referred-players read model (`External game plans/24` s7.2), parsed from a
 * query string. Pure, and mirrored into `apps/admin` (byte-identical test).
 *
 * Every value is checked against an allow-list (a Set) or `Number.isFinite`, and an invalid
 * value is DROPPED rather than refused - a stale bookmark should show an unfiltered report,
 * not an error page. Nothing from the query string ever reaches a Mongo operator position:
 * the search is escaped into a literal regex and every other value is matched by equality.
 */

import type { AffiliationSurface } from "../../../database/models/user-referral.model";
import {
  REFERRAL_KINDS,
  isAffiliationSurface,
  type ReferralKind,
} from "./referral-kind";

export type AffiliationStatusFilter = "current" | "ended";
export type ActivityFilter = "active" | "inactive";

export interface ReferredPlayersFilter {
  /** Game Master USER ids. Absent = every Game Master (admin only - callers decide). */
  gameMasterIds?: string[];
  kind?: ReferralKind;
  surface?: AffiliationSurface;
  joinedFrom?: Date;
  joinedTo?: Date;
  status?: AffiliationStatusFilter;
  activity?: ActivityFilter;
  search?: string;
  /**
   * User ids whose `user.phone` matched the search string. Filled by `readReferredPlayers`
   * for the admin report (never by a Game Master route - those set `maskExternalContact`).
   * Reason: phone lives on the user document, so a referral-row regex cannot find it; resolving
   * the ids first keeps the aggregation index-friendly and keeps D6 out of this path.
   */
  phoneUserIds?: string[];
  /**
   * User ids whose `user.usernameLower` STARTS with the search string. Filled by
   * `readReferredPlayers`. Reason: the username lives on the user document, not the referral
   * row, and it is the one name every screen may show.
   */
  usernameUserIds?: string[];
  /**
   * Set by the Game Master's own routes, never parsed from the query string. Reason: without
   * it a Game Master could learn a hidden email (D6) by searching for it and watching the row
   * appear - so the search matches an email only on rows whose terms were accepted.
   */
  contactRequiresConsent?: boolean;
  /**
   * Set by the Game Master's own routes from the SESSION user's package switch
   * (`resolveShowExternalReferralDetails`), never parsed from the query string. When true, an
   * external referral is searchable only by exact client id or the start of the first name -
   * the same things the masked row still shows.
   */
  maskExternalContact?: boolean;
}

export interface ReferredPlayersPaging {
  page: number;
  limit: number;
}

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
export const MAX_SEARCH_LENGTH = 100;
const MAX_GM_IDS = 50;

const KIND_SET: ReadonlySet<string> = new Set(REFERRAL_KINDS);
const STATUS_SET: ReadonlySet<string> = new Set(["current", "ended"]);
const ACTIVITY_SET: ReadonlySet<string> = new Set(["active", "inactive"]);
// Reason: ids are compared by equality only, but a shape check keeps a 10 MB string or an
// operator-looking value out of the query and out of the audit log.
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

function parseDate(raw: string | null, endOfDay: boolean): Date | undefined {
  if (!raw) return undefined;
  // `YYYY-MM-DD` from a date input means the whole day; a full ISO string is taken as given.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : raw;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function parseReferredPlayersQuery(params: URLSearchParams): {
  filter: ReferredPlayersFilter;
  paging: ReferredPlayersPaging;
} {
  const filter: ReferredPlayersFilter = {};

  const gmIds = params
    .getAll("gameMasterId")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => ID_SHAPE.test(v));
  if (gmIds.length > 0) filter.gameMasterIds = [...new Set(gmIds)].slice(0, MAX_GM_IDS);

  const kind = params.get("kind");
  if (kind && KIND_SET.has(kind)) filter.kind = kind as ReferralKind;

  const surface = params.get("surface");
  if (isAffiliationSurface(surface)) filter.surface = surface;

  const status = params.get("status");
  if (status && STATUS_SET.has(status)) filter.status = status as AffiliationStatusFilter;

  const activity = params.get("activity");
  if (activity && ACTIVITY_SET.has(activity)) filter.activity = activity as ActivityFilter;

  const from = parseDate(params.get("joinedFrom"), false);
  const to = parseDate(params.get("joinedTo"), true);
  if (from) filter.joinedFrom = from;
  if (to) filter.joinedTo = to;

  const search = params.get("search")?.trim();
  if (search) filter.search = search.slice(0, MAX_SEARCH_LENGTH);

  return {
    filter,
    paging: {
      page: parsePositiveInt(params.get("page"), 1, 10_000),
      limit: parsePositiveInt(params.get("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT),
    },
  };
}

/** Escape every regex metacharacter so a search is always a literal substring match. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
