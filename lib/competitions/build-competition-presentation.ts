/**
 * Maps a competition document + viewer state into one presentation object
 * consumed by both grid cards and list rows.
 */

import { formatVolts } from "@/lib/utils/format-volts";
import { COMPETITION_ICON, resolveGameDefinition } from "./game-definitions";
import { getCompetitionCTA } from "./competition-cta";
import type {
  CompetitionListItem,
  CompetitionMetric,
  CompetitionPresentation,
  CompetitionStatusKey,
  CompetitionTag,
} from "./types";
import type { MetricKey } from "./game-definitions";
import type { TitleLevel } from "@/lib/constants/levels";
import { resolveLevelName } from "@/lib/utils/level-title";

function formatDuration(start: string | Date, end: string | Date): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

function formatCountdown(start: string | Date, now = Date.now()): string | undefined {
  const t = new Date(start).getTime() - now;
  if (!Number.isFinite(t) || t <= 0) return undefined;
  const totalMin = Math.floor(t / 60_000);
  if (totalMin < 60) return `Starts in ${Math.max(1, totalMin)}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 48) return `Starts in ${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days}d`;
}

function settingsString(
  settings: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!settings) return undefined;
  // Reason: Map lookup — object indexing trips security/detect-object-injection.
  const map = new Map(Object.entries(settings));
  for (const k of keys) {
    const v = map.get(k);
    if (v == null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "boolean") return v ? "Yes" : "No";
  }
  return undefined;
}

function resolveStatus(
  c: CompetitionListItem,
  isFull: boolean,
): { status: CompetitionStatusKey; label: string } {
  if (c.status === "cancelled") {
    const refunded =
      c.refunded === true || /refund/i.test(String(c.cancellationReason || ""));
    return refunded
      ? { status: "refunded", label: "REFUNDED" }
      : { status: "cancelled", label: "CANCELLED" };
  }
  if (c.status === "completed") {
    return { status: "completed", label: "COMPLETED" };
  }
  if (c.isPrivate || (c.privateAccess && c.privateAccess !== "member")) {
    if (c.status === "active") {
      return { status: "live", label: "LIVE NOW" };
    }
    return { status: "private_gm", label: "PRIVATE • GM ONLY" };
  }
  if (c.status === "active") {
    if (isFull) return { status: "full", label: "FULL" };
    return { status: "live", label: "LIVE NOW" };
  }
  if (c.status === "upcoming") {
    return { status: "starting_soon", label: "STARTING SOON" };
  }
  return { status: "open", label: "OPEN" };
}

function metricOrNull(
  key: MetricKey,
  value: string | undefined,
  opts?: { subvalue?: string; emphasize?: boolean; icon?: string },
): CompetitionMetric | null {
  if (!value || !value.trim() || value === "-" || value === "—") return null;
  // Reason: Map lookup — object indexing trips security/detect-object-injection.
  const labels = new Map<MetricKey, string>([
    ["prizePool", "PRIZE POOL"],
    ["players", "PLAYERS"],
    ["duration", "DURATION"],
    ["assets", "ASSETS"],
    ["entryFee", "ENTRY FEE"],
    ["leverage", "LEVERAGE"],
    ["difficulty", "DIFFICULTY"],
    ["startingCapital", "STARTING CAPITAL"],
    ["track", "TRACK"],
    ["boardSize", "BOARD SIZE"],
    ["mode", "MODE"],
    ["rounds", "ROUNDS"],
    ["laps", "LAPS"],
    ["scoreTarget", "SCORE TARGET"],
  ]);
  const iconMap = new Map<MetricKey, string>([
    ["prizePool", COMPETITION_ICON.trophyGold],
    ["players", COMPETITION_ICON.players],
    ["duration", COMPETITION_ICON.clock],
    ["assets", COMPETITION_ICON.volts],
    ["entryFee", COMPETITION_ICON.volts],
    ["leverage", COMPETITION_ICON.bolt],
    ["difficulty", COMPETITION_ICON.live],
    ["startingCapital", COMPETITION_ICON.wallet],
    ["track", COMPETITION_ICON.soon],
    ["boardSize", COMPETITION_ICON.prize],
    ["mode", COMPETITION_ICON.bolt],
    ["rounds", COMPETITION_ICON.soon],
    ["laps", COMPETITION_ICON.bolt],
    ["scoreTarget", COMPETITION_ICON.prize],
  ]);
  return {
    key,
    icon: opts?.icon || iconMap.get(key) || COMPETITION_ICON.bolt,
    label: labels.get(key) || key,
    value,
    subvalue: opts?.subvalue,
    emphasize: opts?.emphasize,
  };
}

function buildMetric(
  key: MetricKey,
  c: CompetitionListItem,
  creditSymbol?: string,
): CompetitionMetric | null {
  const settings = c.gameSettings;
  const prize = Number(c.prizePoolCredits ?? c.prizePool ?? 0) || 0;
  const entry = Number(c.entryFeeCredits ?? c.entryFee ?? 0) || 0;
  const symbol = creditSymbol;

  switch (key) {
    case "prizePool":
      return metricOrNull(
        key,
        formatVolts(prize, { symbol }),
        { emphasize: true },
      );
    case "players": {
      const cur = Number(c.currentParticipants ?? 0);
      const max = Number(c.maxParticipants ?? 0);
      if (!max && !cur) return null;
      return metricOrNull(key, max ? `${cur} / ${max}` : String(cur));
    }
    case "duration": {
      const d = formatDuration(c.startTime, c.endTime);
      return metricOrNull(key, d || undefined);
    }
    case "assets": {
      const assets = c.assetClasses?.filter(Boolean) ?? [];
      if (!assets.length) return null;
      const shown = assets.slice(0, 3).map((a) => a.toUpperCase());
      const extra = assets.length - shown.length;
      return metricOrNull(
        key,
        shown.join(", "),
        extra > 0 ? { subvalue: `+${extra} more` } : undefined,
      );
    }
    case "entryFee":
      return metricOrNull(
        key,
        entry <= 0 ? "FREE" : formatVolts(entry, { symbol }),
      );
    case "leverage": {
      const lev =
        c.leverage?.max ??
        c.leverage?.default ??
        c.leverageAllowed;
      if (!lev) return null;
      return metricOrNull(key, `1:${lev}`);
    }
    case "difficulty": {
      // Derived later by caller via difficultyFilter labels — keep optional from settings
      const fromSettings = settingsString(settings, [
        "difficulty",
        "difficultyLabel",
      ]);
      return metricOrNull(key, fromSettings);
    }
    case "startingCapital": {
      const cap = Number(c.startingCapital ?? c.startingTradingPoints ?? 0);
      if (!cap) return null;
      return metricOrNull(key, cap.toLocaleString());
    }
    case "track":
      return metricOrNull(
        key,
        settingsString(settings, ["track", "trackName", "map", "mapName"]),
      );
    case "boardSize":
      return metricOrNull(
        key,
        settingsString(settings, [
          "boardSize",
          "gridSize",
          "board",
          "size",
        ]),
      );
    case "mode":
      return metricOrNull(
        key,
        settingsString(settings, ["mode", "playMode", "gameMode"]) ||
          (c.playMode ? String(c.playMode).replace(/_/g, " ") : undefined) ||
          (c.attemptsPolicy
            ? String(c.attemptsPolicy).replace(/_/g, " ")
            : undefined),
      );
    case "rounds":
      return metricOrNull(
        key,
        settingsString(settings, ["rounds", "bestOf", "attempts"]),
      );
    case "laps":
      return metricOrNull(key, settingsString(settings, ["laps", "lapCount"]));
    case "scoreTarget":
      return metricOrNull(
        key,
        settingsString(settings, ["scoreTarget", "targetScore"]),
      );
    default:
      return null;
  }
}

export interface BuildPresentationOptions {
  isRegistered: boolean;
  userBalance: number;
  registrationClosed: boolean;
  creditSymbol?: string;
  levelLadder?: TitleLevel[];
  /** Optional precomputed difficulty label */
  difficultyLabel?: string;
  now?: number;
}

export function buildCompetitionPresentation(
  competition: CompetitionListItem,
  opts: BuildPresentationOptions,
): CompetitionPresentation {
  const def = resolveGameDefinition({
    gameType: competition.gameType,
    gameKey: competition.gameKey,
    gameCode: competition.gameCode,
    name: competition.name,
  });

  const prize = Number(competition.prizePoolCredits ?? competition.prizePool ?? 0) || 0;
  const entry = Number(competition.entryFeeCredits ?? competition.entryFee ?? 0) || 0;
  const current = Number(competition.currentParticipants ?? 0);
  const max = Number(competition.maxParticipants ?? 0);
  const isFull = max > 0 && current >= max;
  const { status, label } = resolveStatus(competition, isFull);

  const primaryMetrics = def.primaryMetrics
    .map((k) => buildMetric(k, competition, opts.creditSymbol))
    .filter((m): m is CompetitionMetric => Boolean(m));

  // Inject difficulty into secondary when provided from calculateCompetitionDifficulty
  const secondaryMetrics = def.secondaryMetrics
    .map((k) => {
      if (k === "difficulty" && opts.difficultyLabel) {
        return metricOrNull("difficulty", opts.difficultyLabel);
      }
      return buildMetric(k, competition, opts.creditSymbol);
    })
    .filter((m): m is CompetitionMetric => Boolean(m));

  const tags: CompetitionTag[] = [];
  const creatorName =
    competition.privateGameMasterName ||
    competition.gameMasterName ||
    competition.createdByName ||
    "";
  const isGm =
    Boolean(competition.isPrivate) ||
    Boolean(competition.privateGameMasterName) ||
    competition.createdByType === "gamemaster";

  if (isGm && creatorName) {
    tags.push({
      label: `GM: ${creatorName}`,
      tone: "creator",
    });
  } else {
    tags.push({ label: "Admin", tone: "creator" });
  }
  tags.push({ label: def.label, tone: "game" });

  if (competition.levelRequirement?.enabled && competition.levelRequirement.minLevel) {
    const lvl = Number(competition.levelRequirement.minLevel);
    const name = opts.levelLadder
      ? resolveLevelName(lvl, opts.levelLadder)
      : `Level ${lvl}`;
    tags.push({ label: name, tone: "skill" });
  }

  if (competition.isPrivate || competition.privateAccess) {
    tags.push({ label: "Private", tone: "private" });
  }

  // GM funded heuristic: private + zero entry is a common sponsored shape; also explicit flag later
  const gmFunded = Boolean(competition.isPrivate) && entry <= 0;
  if (gmFunded) {
    tags.push({ label: "GM Funded", tone: "funded" });
  }

  const cta = getCompetitionCTA({
    competition,
    isRegistered: opts.isRegistered,
    userBalance: opts.userBalance,
    registrationClosed: opts.registrationClosed,
  });

  const desc = (competition.description || "").trim();
  const shortDesc =
    desc.length > 160 ? `${desc.slice(0, 157).trimEnd()}…` : desc;

  return {
    id: String(competition._id),
    title: competition.name,
    description: shortDesc,
    gameId: def.id,
    gameName: def.label,
    gameArtwork: def.artwork,
    gameAccent: def.accent,
    theme: def.theme,
    creatorName: creatorName || "Admin",
    creatorType: isGm ? "gm" : "admin",
    status,
    statusLabel: label,
    countdownLabel:
      competition.status === "upcoming"
        ? formatCountdown(competition.startTime, opts.now)
        : undefined,
    tags,
    primaryMetrics,
    secondaryMetrics,
    prizePool: prize,
    entryFee: entry,
    visibility: competition.isPrivate || competition.privateAccess ? "private" : "public",
    gmFunded,
    cta,
  };
}
