import Image from "next/image";
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
 * Horizontal mini-dashboard card (FIXCOMP Image 2 anatomy).
 * Artwork left → content right, with a soft fade into the panel.
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
  const chips = p.secondaryMetrics.slice(0, 3);

  return (
    <article
      className="card relative flex min-h-[310px] flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-[rgba(7,22,55,.94)] to-[rgba(2,8,22,.98)] md:min-h-[340px]"
      style={{
        borderColor: `${p.gameAccent}66`,
        boxShadow: `0 0 22px ${p.theme.glow}`,
      }}
    >
      {p.showCancelledRibbon ? (
        <div
          className="pointer-events-none absolute -right-10 top-5 z-20 w-[160px] rotate-45 bg-gradient-to-r from-red-700 to-red-500 py-1 text-center text-[10px] font-black uppercase tracking-wider text-white shadow-lg"
          aria-hidden
        >
          {p.cancelledRibbonLabel || "CANCELLED"}
        </div>
      ) : null}

      <div className="cardContent relative flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Artwork pane */}
        <div className="relative h-[140px] w-full shrink-0 overflow-hidden md:h-auto md:w-[42%] lg:w-[44%]">
          <Image
            src={p.gameArtwork}
            alt=""
            fill
            loading="lazy"
            decoding="async"
            className={`object-cover ${mutedArt ? "saturate-50 opacity-90" : ""}`}
            style={{ objectPosition: p.artworkObjectPosition }}
            sizes="(max-width: 768px) 100vw, 25vw"
          />
          {/* Fade into content — horizontal on desktop, downward on mobile */}
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                "linear-gradient(90deg, rgba(3,10,29,0.03) 0%, rgba(3,10,29,0.15) 58%, rgba(3,10,29,0.96) 100%)",
            }}
          />
          <div
            className="absolute inset-0 md:hidden"
            style={{
              background:
                "linear-gradient(to bottom, transparent 35%, rgba(3,10,29,.65) 72%, rgba(3,10,29,1) 100%)",
            }}
          />
        </div>

        {/* Content pane */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <CompetitionStatusBadge
              status={p.status}
              label={p.statusLabel}
              countdown={p.countdownLabel}
            />
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

          {p.primaryMetrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {p.primaryMetrics.slice(0, 4).map((m) => (
                <CompetitionDataBlock key={m.key} metric={m} />
              ))}
            </div>
          ) : null}

          <div className="cardFooter mt-auto flex flex-col gap-2 pt-1 sm:flex-row sm:items-end sm:justify-between">
            {chips.length > 0 ? (
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {chips.map((m) => (
                  <span
                    key={m.key}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/12 bg-black/35 px-2 py-1 text-[11px] font-semibold text-white/75"
                  >
                    <span className="text-white/45">{m.label}:</span>
                    {m.value}
                  </span>
                ))}
              </div>
            ) : (
              <span />
            )}
            <div className="w-full shrink-0 sm:w-[200px]">
              <CompetitionCTA cta={p.cta} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
