/**
 * Wallet Analytics category catalog — one list drives every chart and tile.
 *
 * Reason: owner 6 Oct 2026 — Wallet Analytics must stay data-agnostic. Adding a
 * bucket means one row here (plus the charts.ts mapping). Desktop and mobile
 * both read this module; neither enumerates categories inline.
 */

import {
  WALLET_CYAN,
  WALLET_GOLD,
  WALLET_MAGENTA,
  WALLET_ORANGE,
  WALLET_PINK,
  WALLET_RED,
  WALLET_SKY,
  WALLET_TEAL,
  WALLET_VIOLET,
} from "./wallet-tokens";

export type WalletFlow = "in" | "out";

export type WalletCategoryDef = {
  /** Stable UI / chart key on BreakdownDay. */
  key: string;
  /** Field on dailyCreditBreakdown rows. */
  sourceKey: string;
  /** Field on allTimeTotals when it differs from sourceKey. */
  allTimeKey?: string;
  label: string;
  color: string;
  flow: WalletFlow;
  chart: boolean;
  summary: boolean;
  spend: boolean;
  insight: boolean;
  /** Contributes to the Total Spend KPI. */
  spendMetric: boolean;
  /** Keep a summary tile even at zero. */
  alwaysShowInSummary?: boolean;
};

/**
 * Known buckets. Order = chart legend / summary / spend / insight order.
 * Unknown numeric keys on a day are appended via `resolveCategories`.
 */
export const WALLET_CATEGORIES: readonly WalletCategoryDef[] = [
  {
    key: "deposits",
    sourceKey: "deposits",
    label: "Deposits",
    color: WALLET_TEAL,
    flow: "in",
    chart: true,
    summary: true,
    spend: true,
    insight: true,
    spendMetric: false,
    alwaysShowInSummary: true,
  },
  {
    key: "contestEntries",
    sourceKey: "entries",
    allTimeKey: "entries",
    label: "Contest Entries",
    color: WALLET_GOLD,
    flow: "out",
    chart: true,
    summary: true,
    spend: true,
    insight: false,
    spendMetric: true,
  },
  {
    key: "marketplace",
    sourceKey: "marketplace",
    label: "Marketplace",
    color: WALLET_MAGENTA,
    flow: "out",
    chart: true,
    summary: true,
    spend: true,
    insight: true,
    spendMetric: true,
  },
  {
    key: "giftCredits",
    sourceKey: "giftCredits",
    label: "Gift Credits",
    color: WALLET_PINK,
    flow: "in",
    chart: true,
    summary: true,
    spend: true,
    insight: true,
    spendMetric: false,
    alwaysShowInSummary: true,
  },
  {
    key: "prizes",
    sourceKey: "wins",
    allTimeKey: "wins",
    label: "Prizes Won",
    color: WALLET_ORANGE,
    flow: "in",
    chart: true,
    summary: true,
    spend: true,
    insight: true,
    spendMetric: false,
    alwaysShowInSummary: true,
  },
  {
    key: "gmEarnings",
    sourceKey: "gmEarnings",
    label: "GM Earnings",
    color: WALLET_CYAN,
    flow: "in",
    chart: true,
    summary: true,
    spend: true,
    insight: true,
    spendMetric: false,
  },
  {
    key: "gmSpend",
    sourceKey: "gmSpend",
    label: "GM Spend",
    color: WALLET_VIOLET,
    flow: "out",
    chart: true,
    summary: true,
    spend: true,
    insight: false,
    spendMetric: true,
  },
  {
    key: "withdrawals",
    sourceKey: "withdrawals",
    label: "Withdrawals",
    color: WALLET_RED,
    flow: "out",
    chart: true,
    summary: true,
    spend: true,
    insight: true,
    spendMetric: true,
  },
  {
    key: "giftCreditsOut",
    sourceKey: "giftCreditsOut",
    label: "Gift Credits Removed",
    color: "#C084FC",
    flow: "out",
    chart: false,
    summary: true,
    spend: true,
    insight: false,
    spendMetric: true,
  },
  {
    key: "refunds",
    sourceKey: "refunds",
    label: "Refunds",
    color: WALLET_SKY,
    flow: "in",
    chart: true,
    summary: true,
    spend: true,
    insight: false,
    spendMetric: false,
  },
  {
    key: "other",
    sourceKey: "other",
    label: "Other",
    color: "#94A3B8",
    flow: "out",
    chart: true,
    summary: true,
    spend: true,
    insight: false,
    spendMetric: true,
  },
] as const;

const SOURCE_TO_UI = new Map(
  WALLET_CATEGORIES.map((c) => [c.sourceKey, c.key] as const),
);
const BY_KEY = new Map(WALLET_CATEGORIES.map((c) => [c.key, c] as const));

/** Palette for keys that are not yet in the catalog. */
const FALLBACK_PALETTE = [
  "#22D3EE",
  "#A3E635",
  "#FB7185",
  "#FBBF24",
  "#818CF8",
  "#2DD4BF",
  "#F472B6",
  "#FDBA74",
] as const;

export function humanizeWalletKey(key: string): string {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return "Other";
  return spaced.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function colorForUnknownKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]!;
}

export type ResolvedWalletCategory = {
  key: string;
  label: string;
  color: string;
  flow: WalletFlow;
  chart: boolean;
  summary: boolean;
  spend: boolean;
  insight: boolean;
  spendMetric: boolean;
  alwaysShowInSummary: boolean;
  known: boolean;
};

function toResolved(def: WalletCategoryDef): ResolvedWalletCategory {
  return {
    key: def.key,
    label: def.label,
    color: def.color,
    flow: def.flow,
    chart: def.chart,
    summary: def.summary,
    spend: def.spend,
    insight: def.insight,
    spendMetric: def.spendMetric,
    alwaysShowInSummary: Boolean(def.alwaysShowInSummary),
    known: true,
  };
}

/**
 * Merge catalog with any numeric keys present on the data that are not yet
 * catalogued — those still render so a new charts.ts bucket is never silent.
 */
export function resolveCategories(
  presentKeys: Iterable<string>,
): ResolvedWalletCategory[] {
  const present = new Set(presentKeys);
  const out: ResolvedWalletCategory[] = [];
  const seen = new Set<string>();

  for (const def of WALLET_CATEGORIES) {
    out.push(toResolved(def));
    seen.add(def.key);
  }

  for (const raw of present) {
    if (raw === "date") continue;
    const uiKey = SOURCE_TO_UI.get(raw) ?? raw;
    if (seen.has(uiKey)) continue;
    seen.add(uiKey);
    out.push({
      key: uiKey,
      label: humanizeWalletKey(uiKey),
      color: colorForUnknownKey(uiKey),
      // Reason: unknown ledger buckets are treated as outflow until catalogued —
      // safer for spend totals than guessing income.
      flow: "out",
      chart: true,
      summary: true,
      spend: true,
      insight: false,
      spendMetric: true,
      alwaysShowInSummary: false,
      known: false,
    });
  }

  return out;
}

export function categoryByKey(key: string): ResolvedWalletCategory | undefined {
  const def = BY_KEY.get(key);
  if (def) return toResolved(def);
  return undefined;
}

/** Safe numeric read — Map avoids detect-object-injection on dynamic keys. */
export function readFiniteNumber(
  record: Record<string, unknown> | undefined,
  key: string,
): number {
  if (!record) return 0;
  const n = new Map(Object.entries(record)).get(key);
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Map a raw dailyCreditBreakdown row onto UI keys (including unknowns). */
export function mapRawBreakdownRow(
  row: Record<string, unknown>,
): { date: string } & Record<string, number> {
  const date = String(row.date ?? "");
  // Reason: Map writes — object indexing trips detect-object-injection.
  const day = new Map<string, number>();
  const rowMap = new Map(Object.entries(row));

  for (const def of WALLET_CATEGORIES) {
    const raw = rowMap.get(def.sourceKey);
    day.set(
      def.key,
      typeof raw === "number" && Number.isFinite(raw) ? raw : 0,
    );
  }

  for (const [k, v] of rowMap) {
    if (k === "date" || typeof v !== "number" || !Number.isFinite(v)) continue;
    if (SOURCE_TO_UI.has(k)) continue;
    if (BY_KEY.has(k)) continue;
    day.set(k, v);
  }

  return { date, ...Object.fromEntries(day) };
}

export function readAllTimeBucket(
  totals: Record<string, number> | undefined,
  def: WalletCategoryDef,
): number {
  const key = def.allTimeKey ?? def.sourceKey;
  return readFiniteNumber(totals, key);
}

export function sumCategory(
  rows: Array<Record<string, number | string>>,
  key: string,
): number {
  let s = 0;
  for (const r of rows) {
    s += readFiniteNumber(r as Record<string, unknown>, key);
  }
  return s;
}

export function presentKeysFromRows(
  rows: Array<Record<string, unknown>>,
): string[] {
  const keys = new Set<string>();
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (k === "date") continue;
      if (typeof v === "number" && Number.isFinite(v)) keys.add(k);
    }
  }
  return [...keys];
}

/** Colour map derived from the catalog — keeps wallet-tokens consumers working. */
export function categoryColorMap(): Record<string, string> {
  // Reason: Map writes — object indexing trips detect-object-injection.
  const map = new Map<string, string>([["net", "#34D399"]]);
  for (const c of WALLET_CATEGORIES) {
    map.set(c.key, c.color);
  }
  // Reason: legacy aliases still referenced by older art maps.
  map.set("purchases", map.get("contestEntries") ?? WALLET_GOLD);
  map.set("bonuses", map.get("giftCredits") ?? WALLET_PINK);
  return Object.fromEntries(map);
}
