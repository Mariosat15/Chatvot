import Image from "next/image";
import { COMPETITION_CTA_ASSET } from "@/lib/competitions/game-artwork";
import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TAG_TONE = new Map<string, string>([
  ["neutral", "border-white/15 bg-white/5 text-white/70"],
  ["game", "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"],
  ["creator", "border-white/20 bg-white/10 text-white/80"],
  ["skill", "border-amber-400/30 bg-amber-500/10 text-amber-200"],
  ["private", "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-200"],
  ["funded", "border-amber-400/40 bg-amber-500/15 text-amber-100"],
]);

/**
 * Competition Arena card — Image 1 target anatomy.
 *
 * Full game artwork as faded card background + crisp left hero, dynamic metric
 * boxes (primary + secondary), owner CTA PNGs, cancelled ribbon asset.
 */
export function ArenaCompetitionCard({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const mutedArt =
    p.status === "cancelled" ||
    p.status === "refunded" ||
    p.status === "completed";
  // Reason: secondary fields are always boxed (ENTRY FEE / MODE / DIFFICULTY …) —
  // never plain "Label: value" chips. Only render keys that have values.
  const secondaryBoxes = p.secondaryMetrics.filter(
    (m) => m.value && m.value.trim() && m.value !== "-" && m.value !== "—",
  );
  const primaryBoxes = p.primaryMetrics
    .filter((m) => m.value && m.value.trim() && m.value !== "-" && m.value !== "—")
    .slice(0, 4);

  return (
    <article
      className="card relative flex min-h-[310px] flex-col overflow-hidden rounded-2xl border md:min-h-[360px]"
      style={{
        borderColor: `${p.gameAccent}66`,
        boxShadow: `0 0 24px ${p.theme.glow}`,
        background: "rgba(3,10,29,.92)",
      }}
    >
      {/* Full-card faded game artwork (Image 1) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src={p.gameArtwork}
          alt=""
          fill
          loading="lazy"
          decoding="async"
          className={`object-cover opacity-[0.28] ${mutedArt ? "saturate-50" : "saturate-75"}`}
          style={{ objectPosition: p.artworkObjectPosition }}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(3,10,29,0.35) 0%, rgba(3,10,29,0.72) 42%, rgba(3,10,29,0.96) 100%)",
          }}
        />
      </div>

      {p.showCancelledRibbon ? (
        <div
          className="pointer-events-none absolute -right-1 -top-1 z-30 h-[140px] w-[140px] sm:h-[168px] sm:w-[168px]"
          aria-hidden
        >
          <Image
            src={COMPETITION_CTA_ASSET.cancelledRibbon}
            alt=""
            fill
            className="object-contain object-right-top mix-blend-screen"
            sizes="168px"
          />
          <span className="sr-only">
            {p.cancelledRibbonLabel || "CANCELLED"}
          </span>
        </div>
      ) : null}

      <div className="cardContent relative z-10 flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Crisp left hero — same game art, full colour */}
        <div className="relative h-[150px] w-full shrink-0 overflow-hidden md:h-auto md:w-[38%] lg:w-[40%]">
          <Image
            src={p.gameArtwork}
            alt=""
            fill
            loading="lazy"
            decoding="async"
            className={`object-cover ${mutedArt ? "saturate-50 opacity-90" : ""}`}
            style={{ objectPosition: p.artworkObjectPosition }}
            sizes="(max-width: 768px) 100vw, 22vw"
          />
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                "linear-gradient(90deg, rgba(3,10,29,0.02) 0%, rgba(3,10,29,0.18) 55%, rgba(3,10,29,0.92) 100%)",
            }}
          />
          <div
            className="absolute inset-0 md:hidden"
            style={{
              background:
                "linear-gradient(to bottom, transparent 40%, rgba(3,10,29,.75) 100%)",
            }}
          />
          <div className="absolute left-3 top-3 z-10">
            <CompetitionStatusBadge
              status={p.status}
              label={p.statusLabel}
              countdown={p.countdownLabel}
            />
          </div>
        </div>

        {/* Content pane */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
          <div className="flex items-start justify-end gap-2">
            <span
              className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold sm:text-[12px]"
              style={{
                borderColor: `${p.gameAccent}55`,
                color: p.gameAccent,
                background: `${p.gameAccent}14`,
              }}
            >
              {p.gameName}
            </span>
          </div>

          <div>
            <h3 className="text-[18px] font-black leading-tight text-white sm:text-[20px]">
              {p.title}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {p.tags.map((tag) => (
                <span
                  key={`${tag.tone}-${tag.label}`}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${TAG_TONE.get(tag.tone) ?? TAG_TONE.get("neutral")}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>

          {p.description ? (
            <p className="line-clamp-2 text-[12px] leading-snug text-white/60 sm:text-[13px]">
              {p.description}
            </p>
          ) : null}

          {primaryBoxes.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {primaryBoxes.map((m) => (
                <CompetitionDataBlock key={m.key} metric={m} />
              ))}
            </div>
          ) : null}

          <div className="cardFooter mt-auto flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-end sm:justify-between">
            {secondaryBoxes.length > 0 ? (
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                {secondaryBoxes.slice(0, 4).map((m) => (
                  <CompetitionDataBlock key={m.key} metric={m} compact />
                ))}
              </div>
            ) : (
              <span />
            )}
            <div className="w-full shrink-0 sm:w-[220px]">
              <CompetitionCTA cta={p.cta} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
