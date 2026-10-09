import Image from "next/image";
import { COMPETITION_CTA_ASSET } from "@/lib/competitions/game-artwork";
import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";

export function ArenaCompetitionListRow({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const metrics = [...p.primaryMetrics, ...p.secondaryMetrics]
    .filter((m) => m.value && m.value.trim() && m.value !== "-" && m.value !== "—")
    .slice(0, 5);
  const mutedArt =
    p.status === "cancelled" ||
    p.status === "refunded" ||
    p.status === "completed";

  return (
    <article
      className="relative flex min-h-[160px] flex-col gap-3 overflow-hidden rounded-2xl border p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
      style={{
        borderColor: `${p.gameAccent}55`,
        boxShadow: `0 0 16px ${p.theme.glow}`,
        background: "rgba(3,10,29,.92)",
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src={p.gameArtwork}
          alt=""
          fill
          loading="lazy"
          decoding="async"
          className={`object-cover opacity-[0.22] ${mutedArt ? "saturate-50" : ""}`}
          style={{ objectPosition: p.artworkObjectPosition }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,10,29,.4),rgba(3,10,29,.95))]" />
      </div>

      {p.showCancelledRibbon ? (
        <div
          className="pointer-events-none absolute -right-1 -top-1 z-30 h-[120px] w-[120px]"
          aria-hidden
        >
          <Image
            src={COMPETITION_CTA_ASSET.cancelledRibbon}
            alt=""
            fill
            className="object-contain object-right-top mix-blend-screen"
            sizes="120px"
          />
        </div>
      ) : null}

      <div className="relative z-10 h-36 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 sm:h-auto sm:w-[200px]">
        <Image
          src={p.gameArtwork}
          alt=""
          fill
          loading="lazy"
          decoding="async"
          className={`object-cover ${mutedArt ? "saturate-50" : ""}`}
          style={{ objectPosition: p.artworkObjectPosition }}
          sizes="200px"
        />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CompetitionStatusBadge
              status={p.status}
              label={p.statusLabel}
              countdown={p.countdownLabel}
            />
            <span
              className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
              style={{
                borderColor: `${p.gameAccent}55`,
                color: p.gameAccent,
                background: `${p.gameAccent}14`,
              }}
            >
              {p.gameName}
            </span>
          </div>
          <h3 className="mt-2 text-[18px] font-black text-white sm:text-[20px]">
            {p.title}
          </h3>
        </div>

        {metrics.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {metrics.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} compact />
            ))}
          </div>
        ) : null}

        <div className="flex justify-end sm:w-[220px] sm:self-end">
          <CompetitionCTA cta={p.cta} />
        </div>
      </div>
    </article>
  );
}
