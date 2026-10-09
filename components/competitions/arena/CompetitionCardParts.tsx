import Image from "next/image";
import type { CSSProperties } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { COMPETITION_CANCELLED_RIBBON_ASSET } from "@/lib/competitions/game-artwork";
import type {
  CompetitionMetric,
  CompetitionPresentation,
} from "@/lib/competitions/types";
import { CompetitionCountdown } from "./CompetitionCountdown";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";

/**
 * Pieces shared by the grid card and the list row, so the two views cannot
 * drift apart (one shows a countdown or a GM Funded tag and the other does not).
 */

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TAG_TONE = new Map<string, string>([
  ["neutral", "border-white/20 bg-white/10 text-slate-100"],
  ["game", "border-white/20 bg-white/10 text-slate-100"],
  ["creator", "border-sky-300/40 bg-sky-500/15 text-sky-100"],
  ["skill", "border-amber-400/40 bg-amber-500/15 text-amber-100"],
  ["private", "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100"],
  [
    "funded",
    "border-amber-300/70 bg-amber-400/20 text-amber-50 shadow-[0_0_12px_rgba(251,191,36,.35)]",
  ],
]);

/**
 * Reason: the blurred backdrop is ambience only — text sits on it, so it is
 * dimmed to near-solid behind the content; any game's logo baked into its
 * artwork otherwise shows through the copy and makes it unreadable.
 */
const SCRIM =
  "linear-gradient(90deg, rgba(4,9,24,.50) 0%, rgba(4,9,24,.82) 28%, rgba(4,9,24,.93) 42%, rgba(4,9,24,.94) 100%)";
export function hasMetricValue(m: CompetitionMetric): boolean {
  return Boolean(m.value && m.value.trim() && m.value !== "-" && m.value !== "—");
}

export function isSettled(p: CompetitionPresentation): boolean {
  return p.status === "completed" || p.status === "cancelled" || p.status === "refunded";
}

/** Border + glow in the game's accent; dimmer once the contest is settled. */
export function cardFrameStyle(p: CompetitionPresentation): CSSProperties {
  const accent = p.gameAccent;
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
      <div className="absolute inset-0" style={{ background: SCRIM }} />
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

/** Status, optional context badges and clock share one wrapping row. */
export function CardBadgesRow({ presentation: p }: { presentation: CompetitionPresentation }) {
  const cancelled = p.status === "cancelled" || p.status === "refunded";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!cancelled ? (
        <CompetitionStatusBadge status={p.status} label={p.statusLabel} />
      ) : null}
      {p.tags.map((tag) => (
        <span
          key={`${tag.tone}-${tag.label}`}
          title={tag.tone === "funded" ? p.gmFundedNote : undefined}
          className={`inline-flex h-[28px] items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold leading-none ${
            TAG_TONE.get(tag.tone) ?? TAG_TONE.get("neutral")
          }`}
        >
          {tag.tone === "game" ? (
            <Image
              src={p.gameIcon}
              alt=""
              width={14}
              height={14}
              className="size-3.5 object-contain"
            />
          ) : null}
          {tag.tone === "funded" ? (
            <Image
              src={COMPETITION_ICON.volts}
              alt=""
              width={14}
              height={14}
              className="size-3.5 object-contain"
            />
          ) : null}
          {tag.label}
        </span>
      ))}
      {p.countdown ? (
        <CompetitionCountdown kind={p.countdown.kind} target={p.countdown.target} />
      ) : null}
    </div>
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
