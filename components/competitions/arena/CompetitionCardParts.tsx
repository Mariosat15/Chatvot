import Image from "next/image";
import type { CSSProperties } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import {
  COMPETITION_CANCELLED_RIBBON_ASSET,
  COMPETITION_TYPE_RIBBON_ASSET,
} from "@/lib/competitions/game-artwork";
import type {
  CompetitionMetric,
  CompetitionPresentation,
} from "@/lib/competitions/types";
import { CompetitionCountdownDataBlock } from "./CompetitionCountdown";
import { CompetitionInfoDataBlock } from "./CompetitionInfoDataBlock";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";

/**
 * Pieces shared by the grid card and the list row, so the two views cannot
 * drift apart (one shows a countdown or a GM Funded tag and the other does not).
 */

const CONTEXT_BLOCK = {
  creator: { label: "Host", icon: COMPETITION_ICON.players },
  funded: { label: "Funding", icon: COMPETITION_ICON.starbox },
  private: { label: "Access", icon: COMPETITION_ICON.wallet },
  skill: { label: "Requirement", icon: COMPETITION_ICON.trophyGold },
  neutral: { label: "Details", icon: COMPETITION_ICON.live },
} as const;

const GRID_CONTEXT_ORDER = new Map([
  ["funded", 0],
  ["private", 1],
  ["skill", 2],
  ["neutral", 3],
  ["creator", 4],
]);
const LIST_CONTEXT_ORDER = new Map([
  ["funded", 0],
  ["creator", 1],
  ["private", 2],
  ["skill", 3],
  ["neutral", 4],
]);

/**
 * Reason: the blurred backdrop is ambience only — text sits on it, so it is
 * dimmed to near-solid behind the content; any game's logo baked into its
 * artwork otherwise shows through the copy and makes it unreadable.
 */
const SCRIM =
  "linear-gradient(90deg, rgba(4,9,24,.50) 0%, rgba(4,9,24,.82) 28%, rgba(4,9,24,.93) 42%, rgba(4,9,24,.94) 100%)";
const CANCELLED_SCRIM =
  "linear-gradient(90deg, rgba(45,5,12,.48) 0%, rgba(35,5,12,.86) 35%, rgba(28,4,10,.96) 100%)";
export function hasMetricValue(m: CompetitionMetric): boolean {
  return Boolean(m.value && m.value.trim() && m.value !== "-" && m.value !== "—");
}

function isCancelled(p: CompetitionPresentation): boolean {
  return p.status === "cancelled" || p.status === "refunded";
}

export function isSettled(p: CompetitionPresentation): boolean {
  return p.status === "completed" || isCancelled(p);
}

/** Border + glow in the game's accent; dimmer once the contest is settled. */
export function cardFrameStyle(p: CompetitionPresentation): CSSProperties {
  const accent = p.gameAccent;
  if (isCancelled(p)) {
    return {
      borderColor: "rgba(248,74,89,.92)",
      boxShadow:
        "0 0 22px rgba(239,44,65,.48), 0 0 2px #f84a59, inset 0 0 34px rgba(122,8,27,.28)",
      background: "#18060c",
    };
  }
  const settled = isSettled(p);
  return {
    borderColor: settled ? `${accent}80` : `${accent}d9`,
    boxShadow: settled
      ? `0 0 14px ${accent}33, inset 0 0 24px ${accent}12`
      : `0 0 26px ${accent}66, 0 0 2px ${accent}, inset 0 0 32px ${accent}1f`,
    background: "#050b1c",
  };
}

/** The game artwork, blurred and faded behind the whole card. */
export function CardBackdrop({ presentation: p }: { presentation: CompetitionPresentation }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <Image
        src={p.gameArtwork}
        alt=""
        fill
        loading="lazy"
        decoding="async"
        className={`scale-125 object-cover opacity-60 blur-2xl ${
          isSettled(p) ? "saturate-50" : "saturate-150"
        }`}
        sizes="(max-width: 1536px) 50vw, 25vw"
      />
      <div
        className="absolute inset-0"
        style={{ background: isCancelled(p) ? CANCELLED_SCRIM : SCRIM }}
      />
    </div>
  );
}

/** The game artwork filling its dedicated panel, with a fade into the content. */
export function CardHero({
  presentation: p,
  className,
  sizes,
}: {
  presentation: CompetitionPresentation;
  className: string;
  sizes: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-black/25 ${className}`}>
      <Image
        src={p.gameArtwork}
        alt={`${p.gameName} game artwork`}
        fill
        loading="lazy"
        decoding="async"
        className={`object-cover ${isSettled(p) ? "saturate-[.7]" : ""}`}
        style={{ objectPosition: p.artworkObjectPosition }}
        sizes={sizes}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_65%,rgba(5,11,28,.82)_100%)]"
        aria-hidden
      />
    </div>
  );
}

/** Keep the card header quiet: game identity is already in the artwork and title. */
export function CardBadgesRow({ presentation: p }: { presentation: CompetitionPresentation }) {
  if (isCancelled(p)) return null;

  return (
    <div className="flex min-h-[28px] items-center">
      <CompetitionStatusBadge status={p.status} label={p.statusLabel} />
    </div>
  );
}

function contextExplanation(
  p: CompetitionPresentation,
  tone: string,
  value: string,
): string {
  switch (tone) {
    case "creator":
      return p.creatorType === "gm"
        ? `${value} is the Game Master hosting and managing this competition.`
        : "This competition is hosted and managed by the ChartVolt team.";
    case "funded":
      return (
        p.gmFundedNote ??
        "The Game Master pays the entry cost for every player in this competition."
      );
    case "private":
      return "This is a private competition. Only players allowed by its host can enter.";
    case "skill":
      return `${value} is the minimum account level required to enter this competition.`;
    default:
      return `${value} is an additional condition for this competition.`;
  }
}

/** Context and timing are data, so they use the same boxes as every other card metric. */
export function CardContextDataBlocks({
  presentation: p,
  layout,
  only = "all",
}: {
  presentation: CompetitionPresentation;
  layout: "grid" | "list";
  only?: "all" | "creator" | "other";
}) {
  const order = layout === "grid" ? GRID_CONTEXT_ORDER : LIST_CONTEXT_ORDER;
  // Reason: private access is shown by the top-left PrivateRibbon, so a box
  // repeating it would spend a whole grid cell on a fact already on the card.
  const tags = p.tags
    .filter((tag) => tag.tone !== "game" && tag.tone !== "private")
    .filter((tag) => {
      if (only === "creator") return tag.tone === "creator";
      if (only === "other") return tag.tone !== "creator";
      return true;
    })
    .sort(
      (a, b) =>
        (order.get(a.tone) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.tone) ?? Number.MAX_SAFE_INTEGER),
    );

  // Host and the countdown are two cells wide in both views (a GM name and a
  // "1d 00:57:24" clock do not fit one cell).
  // Reason: grid puts Funding beside Host (dense gap) and Starts In on the
  // next row under Host at the same two-cell width; list keeps countdown
  // first so Funding still sits beside the clock.
  const countdown =
    only !== "creator" && p.countdown ? (
      <CompetitionCountdownDataBlock
        kind={p.countdown.kind}
        target={p.countdown.target}
        accent={p.gameAccent}
        className="col-span-2"
      />
    ) : null;

  const tagBlocks = tags.map((tag) => {
    const context =
      CONTEXT_BLOCK[tag.tone as keyof typeof CONTEXT_BLOCK] ?? CONTEXT_BLOCK.neutral;
    return (
      <CompetitionInfoDataBlock
        key={`${tag.tone}-${tag.label}`}
        icon={context.icon}
        label={context.label}
        value={tag.label}
        explanation={contextExplanation(p, tag.tone, tag.label)}
        accent={p.gameAccent}
        className={tag.tone === "creator" ? "col-span-2" : undefined}
      />
    );
  });

  return (
    <>
      {layout === "grid" ? (
        <>
          {tagBlocks}
          {countdown}
        </>
      ) : (
        <>
          {countdown}
          {tagBlocks}
        </>
      )}
    </>
  );
}

/** True when the presentation carries a private-access tag. */
export function isPrivateCompetition(p: CompetitionPresentation): boolean {
  return p.tags.some((tag) => tag.tone === "private");
}

/** Top-left PRIVATE ribbon; the right corner keeps the GAME / TRADING / cancelled ribbon. */
export function PrivateRibbon({
  presentation: p,
}: {
  presentation: CompetitionPresentation;
}) {
  if (!isPrivateCompetition(p)) return null;
  return (
    <Image
      src={COMPETITION_TYPE_RIBBON_ASSET.private}
      alt="Private competition: only players allowed by the host can enter"
      width={112}
      height={112}
      className="pointer-events-none absolute -left-1 -top-1 z-20 size-[96px] object-contain sm:size-[112px]"
      sizes="112px"
    />
  );
}

/** The uploaded ribbon is the only cancelled-status marker on a cancelled card. */
export function CancelledRibbon({
  presentation: p,
}: {
  presentation: CompetitionPresentation;
}) {
  if (p.status !== "cancelled" && p.status !== "refunded") return null;
  return (
    <Image
      src={COMPETITION_CANCELLED_RIBBON_ASSET}
      alt={p.statusLabel}
      width={112}
      height={112}
      className="pointer-events-none absolute -right-1 -top-1 z-20 size-[96px] object-contain sm:size-[112px]"
      sizes="112px"
    />
  );
}

/** GAME / TRADING identity ribbon; cancellation takes precedence over identity. */
export function CompetitionTypeRibbon({
  presentation: p,
}: {
  presentation: CompetitionPresentation;
}) {
  if (isCancelled(p)) return null;
  const trading = p.gameId === "trading";
  return (
    <Image
      src={
        trading
          ? COMPETITION_TYPE_RIBBON_ASSET.trading
          : COMPETITION_TYPE_RIBBON_ASSET.game
      }
      alt={trading ? "Trading competition" : "Game competition"}
      width={112}
      height={112}
      className="pointer-events-none absolute -right-1 -top-1 z-20 size-[96px] object-contain sm:size-[112px]"
      sizes="112px"
    />
  );
}
