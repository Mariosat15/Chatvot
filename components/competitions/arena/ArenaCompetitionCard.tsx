import Image from "next/image";
import { COMPETITION_CTA_ASSET } from "@/lib/competitions/game-artwork";
import type {
  CompetitionMetric,
  CompetitionPresentation,
} from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";
import { CompetitionCountdown } from "./CompetitionCountdown";

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TAG_TONE = new Map<string, string>([
  ["neutral", "border-white/20 bg-white/10 text-slate-100"],
  ["game", "border-white/20 bg-white/10 text-slate-100"],
  ["creator", "border-sky-300/40 bg-sky-500/15 text-sky-100"],
  ["skill", "border-amber-400/40 bg-amber-500/15 text-amber-100"],
  ["private", "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100"],
  ["funded", "border-amber-400/45 bg-amber-500/15 text-amber-100"],
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

function hasValue(m: CompetitionMetric): boolean {
  return Boolean(m.value && m.value.trim() && m.value !== "-" && m.value !== "—");
}

/**
 * Competition Arena card — owner reference anatomy (design-reference target).
 *
 * Top: the game's artwork on the left, shown WHOLE (`object-contain`, so a
 * title baked into any game's banner is never cropped) over the same artwork
 * blurred and faded; on the right the title with the status badge, tags plus a
 * ticking countdown, the description and four primary boxes. Bottom: a footer
 * row across the FULL card width — three game-specific boxes and the supplied
 * CTA PNG, vertically centred.
 *
 * Reason: the footer used to share the 72% content column with the CTA, which
 * left ~45px of text per box and split values mid-word. Spanning the whole card
 * (as the reference does) gives each box room for its label and value.
 * The card is its own CSS container, so the layout follows ITS width.
 */
export function ArenaCompetitionCard({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const settled =
    p.status === "completed" || p.status === "cancelled" || p.status === "refunded";
  const primary = p.primaryMetrics.filter(hasValue).slice(0, 4);
  const secondary = p.secondaryMetrics.filter(hasValue).slice(0, 3);
  const accent = p.gameAccent;

  return (
    <article
      className="@container relative overflow-hidden rounded-[20px] border-[1.5px]"
      style={{
        borderColor: settled ? `${accent}80` : `${accent}d9`,
        boxShadow: settled
          ? `0 0 14px ${accent}33, inset 0 0 24px ${accent}12`
          : `0 0 26px ${accent}66, 0 0 2px ${accent}, inset 0 0 32px ${accent}1f`,
        background: "#050b1c",
      }}
    >
      {/* Backdrop: the same game artwork, blurred, faded and blended */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <Image
          src={p.gameArtwork}
          alt=""
          fill
          loading="lazy"
          decoding="async"
          className={`scale-125 object-cover opacity-60 blur-2xl ${
            settled ? "saturate-50" : "saturate-150"
          }`}
          sizes="(max-width: 1536px) 50vw, 25vw"
        />
        <div className="absolute inset-0" style={{ background: SCRIM }} />
      </div>

      {p.showCancelledRibbon ? (
        // Reason: the ribbon art fills the right 716×660 of a 1024×682 canvas, so a
        // 150px box shows a ~105px ribbon pinned to the corner.
        <div
          className="pointer-events-none absolute -right-[5px] -top-[2px] z-20 h-[100px] w-[150px]"
          aria-hidden
        >
          <Image
            src={COMPETITION_CTA_ASSET.cancelledRibbon}
            alt=""
            fill
            className="object-contain object-right-top"
            sizes="150px"
          />
        </div>
      ) : null}
      {p.showCancelledRibbon ? (
        <span className="sr-only">{p.cancelledRibbonLabel || "CANCELLED"}</span>
      ) : null}

      <div className="relative z-10 flex flex-col gap-3 p-3.5 @[600px]:gap-3.5 @[600px]:p-4">
        <div className="grid grid-cols-1 gap-3 @[600px]:grid-cols-[30%_minmax(0,1fr)] @[600px]:gap-4">
          {/* Hero — whole game artwork, centred */}
          <div className="relative aspect-video w-full @[600px]:aspect-auto @[600px]:h-full @[600px]:min-h-[190px]">
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
                className={`object-contain object-center ${settled ? "saturate-[.7]" : ""}`}
                sizes="(max-width: 600px) 100vw, 320px"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-col gap-2.5">
            <div
              className={`flex items-start justify-between gap-3 ${
                p.showCancelledRibbon ? "pr-[84px]" : ""
              }`}
            >
              <h3
                className="line-clamp-2 min-w-0 text-[18px] font-black leading-tight text-white @[600px]:text-[21px]"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
              >
                {p.title}
              </h3>
              <div className="shrink-0">
                <CompetitionStatusBadge status={p.status} label={p.statusLabel} size="lg" />
              </div>
            </div>

            {p.tags.length > 0 || p.countdown ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {p.tags.map((tag) => (
                  <span
                    key={`${tag.tone}-${tag.label}`}
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
                    {tag.label}
                  </span>
                ))}
                {p.countdown ? (
                  <CompetitionCountdown kind={p.countdown.kind} target={p.countdown.target} />
                ) : null}
              </div>
            ) : null}

            {p.description ? (
              <p className="line-clamp-2 text-[12.5px] leading-snug text-slate-200/90 @[600px]:text-[13.5px]">
                {p.description}
              </p>
            ) : null}

            {primary.length > 0 ? (
              <div className="mt-auto grid grid-cols-2 gap-2 @[600px]:grid-cols-[repeat(4,minmax(0,1fr))]">
                {primary.map((m) => (
                  <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer — full card width: game-specific boxes + CTA, vertically centred */}
        <div className="grid grid-cols-2 items-stretch gap-2 @[460px]:grid-cols-3 @[600px]:grid-cols-[repeat(3,minmax(0,1fr))_minmax(190px,1.25fr)]">
          {secondary.map((m) => (
            <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
          ))}
          <div className="col-span-full flex items-center justify-center @[600px]:col-span-1 @[600px]:col-start-4">
            <CompetitionCTA cta={p.cta} glow={settled ? undefined : p.theme.glow} />
          </div>
        </div>
      </div>
    </article>
  );
}
