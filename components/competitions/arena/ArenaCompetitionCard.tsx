import Image from "next/image";
import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";

const TAG_TONE: Record<string, string> = {
  neutral: "border-white/15 bg-white/5 text-white/70",
  game: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  creator: "border-white/20 bg-white/10 text-white/80",
  skill: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  private: "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-200",
  funded: "border-amber-400/40 bg-amber-500/15 text-amber-100",
};

export function ArenaCompetitionCard({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-[rgba(7,22,55,.92)] to-[rgba(2,8,22,.96)]"
      style={{
        borderColor: `${p.gameAccent}66`,
        boxShadow: `0 0 22px ${p.theme.glow}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
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

      <div className="relative mx-4 mt-3 h-[180px] overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:h-[200px]">
        <Image
          src={p.gameArtwork}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020816]/85 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-[20px] font-black leading-tight text-white sm:text-[22px]">
            {p.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <span
                key={`${tag.tone}-${tag.label}`}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${TAG_TONE[tag.tone]}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        {p.description ? (
          <p className="line-clamp-2 text-[13px] leading-snug text-white/60">
            {p.description}
          </p>
        ) : null}

        {p.primaryMetrics.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {p.primaryMetrics.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} />
            ))}
          </div>
        ) : null}

        {p.secondaryMetrics.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {p.secondaryMetrics.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} compact />
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-1">
          <CompetitionCTA cta={p.cta} />
        </div>
      </div>
    </article>
  );
}
