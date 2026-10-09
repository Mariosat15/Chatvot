import Image from "next/image";
import { COMPETITION_CTA_ASSET } from "@/lib/competitions/game-artwork";
import type {
  CompetitionMetric,
  CompetitionPresentation,
} from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TAG_TONE = new Map<string, string>([
  ["neutral", "border-white/20 bg-white/10 text-slate-100"],
  ["game", "border-white/20 bg-white/10 text-slate-100"],
  ["creator", "border-sky-300/35 bg-sky-500/15 text-sky-100"],
  ["skill", "border-amber-400/30 bg-amber-500/10 text-amber-200"],
  ["private", "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-200"],
  ["funded", "border-amber-400/40 bg-amber-500/15 text-amber-100"],
]);

/**
 * Reason: the blurred backdrop is ambience only — text sits on it, so it is
 * dimmed to near-solid behind the content column; any game's logo baked into its
 * artwork otherwise shows through the copy and makes it unreadable.
 */
const WIDE_SCRIM =
  "linear-gradient(90deg, rgba(4,9,24,.55) 0%, rgba(4,9,24,.80) 26%, rgba(4,9,24,.92) 40%, rgba(4,9,24,.94) 100%)";
const STACKED_SCRIM =
  "linear-gradient(180deg, rgba(4,9,24,.55) 0%, rgba(4,9,24,.92) 40%, rgba(4,9,24,.94) 100%)";
/** The hero's inner edge melts into the card instead of ending in a hard line. */
const HERO_EDGE_MASK = "linear-gradient(90deg, #000 78%, transparent 100%)";

function hasValue(m: CompetitionMetric): boolean {
  return Boolean(m.value && m.value.trim() && m.value !== "-" && m.value !== "—");
}

/**
 * Competition Arena card — Image 1 anatomy.
 *
 * One game artwork spans the whole card behind a fade (left ~28% clear, content
 * on the right 72%). Status badge top-left, game badge top-right, title + tags,
 * description, a row of four primary boxes, then three game-specific boxes with
 * the supplied CTA PNG bottom-right.
 *
 * Reason: the card is its own CSS container, so it switches between the wide
 * grid and the stacked phone layout by ITS width, not the viewport's — the
 * arena grid puts two cards per row only where each card is wide enough.
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

  return (
    <article
      className="@container relative overflow-hidden rounded-[18px] border"
      style={{
        borderColor: settled ? `${p.gameAccent}33` : `${p.gameAccent}66`,
        boxShadow: settled
          ? `0 0 10px ${p.gameAccent}1f`
          : `0 0 22px ${p.theme.glow}, inset 0 0 0 1px ${p.gameAccent}14`,
        background: "#050b1c",
      }}
    >
      {/* Backdrop: the same game artwork, blurred, faded and blended — not the hero */}
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
        <div
          className="absolute inset-0 @[600px]:hidden"
          style={{ background: STACKED_SCRIM }}
        />
        <div
          className="absolute inset-0 hidden @[600px]:block"
          style={{ background: WIDE_SCRIM }}
        />
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

      <div className="relative z-10 grid grid-cols-1 @[600px]:grid-cols-[28%_72%]">
        {/* Hero column — the game's artwork, crisp and centred in its own box */}
        <div className="relative h-[170px] @[600px]:h-auto @[600px]:min-h-[260px]">
          <div
            className="absolute inset-0 overflow-hidden @[600px]:[mask-image:var(--hero-mask)]"
            style={{ ["--hero-mask" as string]: HERO_EDGE_MASK }}
          >
            <Image
              src={p.gameArtwork}
              alt={p.gameName}
              fill
              loading="lazy"
              decoding="async"
              className={`object-cover ${settled ? "saturate-[.7]" : ""}`}
              style={{ objectPosition: p.artworkObjectPosition }}
              sizes="(max-width: 600px) 100vw, 260px"
            />
          </div>
          <div className="relative p-3">
            <CompetitionStatusBadge
              status={p.status}
              label={p.statusLabel}
              countdown={p.countdownLabel}
            />
          </div>
        </div>

        {/* Content column */}
        <div className="flex min-w-0 flex-col gap-2.5 p-3.5 @[600px]:py-4 @[600px]:pl-2 @[600px]:pr-4">
          <div
            className={`flex items-start justify-between gap-3 ${
              p.showCancelledRibbon ? "pr-[78px]" : ""
            }`}
          >
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[17px] font-black leading-tight text-white @[600px]:text-[19px]">
                {p.title}
              </h3>
              {p.tags.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={`${tag.tone}-${tag.label}`}
                      className={`inline-flex h-[22px] items-center rounded-full border px-2 text-[10px] font-bold leading-none ${
                        TAG_TONE.get(tag.tone) ?? TAG_TONE.get("neutral")
                      }`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <span
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-extrabold uppercase leading-none tracking-wide sm:text-[11px]"
              style={{
                borderColor: `${p.gameAccent}66`,
                color: p.gameAccent,
                background: `${p.gameAccent}1a`,
                boxShadow: settled ? undefined : `0 0 10px ${p.theme.glow}`,
              }}
            >
              <Image
                src={p.gameIcon}
                alt=""
                width={16}
                height={16}
                className="size-4 object-contain"
              />
              {p.gameName}
            </span>
          </div>

          {p.description ? (
            <p className="line-clamp-2 text-[12px] leading-snug text-slate-200/90 @[600px]:text-[13px]">
              {p.description}
            </p>
          ) : null}

          {primary.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 @[600px]:grid-cols-[repeat(4,minmax(0,1fr))]">
              {primary.map((m) => (
                <CompetitionDataBlock key={m.key} metric={m} accent={p.gameAccent} />
              ))}
            </div>
          ) : null}

              {/* Reason: the CTA joins the box row only once three boxes plus a ≥170px
              CTA fit (card ≥720px); narrower, it drops beneath so no value is squeezed. */}
          <div className="mt-auto grid grid-cols-2 items-center gap-2 @[420px]:grid-cols-3 @[720px]:grid-cols-[repeat(3,minmax(0,1fr))_minmax(170px,1.15fr)]">
            {secondary.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} accent={p.gameAccent} />
            ))}
            <div className="col-span-full mt-1 flex justify-center @[600px]:justify-end @[720px]:col-span-1 @[720px]:col-start-4 @[720px]:mt-0">
              <CompetitionCTA cta={p.cta} glow={settled ? undefined : p.theme.glow} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
