import Image from "next/image";
import type { CSSProperties } from "react";
import { COMPETITION_CTA_ASSET } from "@/lib/competitions/game-artwork";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
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
/** Soft edges so the hero melts into the card rather than ending in a hard box. */
const HERO_MASK =
  "radial-gradient(ellipse 72% 70% at 50% 50%, #000 62%, transparent 100%)";

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

/** Supplied cancelled ribbon, pinned to the top-right corner. */
export function CancelledRibbon({ presentation: p }: { presentation: CompetitionPresentation }) {
  if (!p.showCancelledRibbon) return null;
  return (
    <>
      {/* Reason: the ribbon art fills the top-right ~80% of a square 1024 canvas,
          so a square box pins it to the corner at its own aspect. */}
      <div
        className="pointer-events-none absolute -right-[3px] -top-[2px] z-20 size-[118px]"
        aria-hidden
      >
        <Image
          src={COMPETITION_CTA_ASSET.cancelledRibbon}
          alt=""
          fill
          className="object-contain object-right-top"
          sizes="118px"
        />
      </div>
      <span className="sr-only">{p.cancelledRibbonLabel || "CANCELLED"}</span>
    </>
  );
}

/** The whole game artwork (never cropped), with soft edges. */
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
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 [mask-image:var(--hero-mask)]"
        style={{ ["--hero-mask" as string]: HERO_MASK }}
      >
        <Image
          src={p.gameArtwork}
          alt={p.gameName}
          fill
          loading="lazy"
          decoding="async"
          className={`object-contain object-center ${isSettled(p) ? "saturate-[.7]" : ""}`}
          sizes={sizes}
        />
      </div>
    </div>
  );
}

/** Tags (GM Funded first, when it applies) followed by the ticking countdown. */
export function CardTagsRow({ presentation: p }: { presentation: CompetitionPresentation }) {
  if (p.tags.length === 0 && !p.countdown) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {p.tags.map((tag) => (
        <span
          key={`${tag.tone}-${tag.label}`}
          title={tag.tone === "funded" ? p.gmFundedNote : undefined}
          className={`inline-flex h-[24px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold leading-none ${
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

/** Owner reference: a small boxed game name with its icon, top-right of the content. */
export function GamePill({ presentation: p }: { presentation: CompetitionPresentation }) {
  return (
    <span
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-black/45 px-2.5 text-[12px] font-bold leading-none text-white"
      style={{ borderColor: `${p.gameAccent}80`, boxShadow: `0 0 10px ${p.gameAccent}33` }}
    >
      <Image src={p.gameIcon} alt="" width={16} height={16} className="size-4 object-contain" />
      {p.gameName}
    </span>
  );
}

/** The game artwork with the status pill sitting on its top-left corner. */
export function CardHeroWithStatus({
  presentation: p,
  className,
  sizes,
}: {
  presentation: CompetitionPresentation;
  className: string;
  sizes: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <CardHero presentation={p} className="absolute inset-0" sizes={sizes} />
      <div className="absolute left-1.5 top-1.5 z-10">
        <CompetitionStatusBadge status={p.status} label={p.statusLabel} />
      </div>
    </div>
  );
}
