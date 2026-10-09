import Image from "next/image";
import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionCTA } from "./CompetitionCTA";

export function ArenaCompetitionListRow({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const metrics = [...p.primaryMetrics, ...p.secondaryMetrics].slice(0, 4);

  return (
    <article
      className="flex min-h-[150px] flex-col gap-3 overflow-hidden rounded-2xl border bg-gradient-to-r from-[rgba(7,22,55,.92)] to-[rgba(2,8,22,.96)] p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
      style={{
        borderColor: `${p.gameAccent}55`,
        boxShadow: `0 0 16px ${p.theme.glow}`,
      }}
    >
      <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 sm:h-auto sm:w-[190px]">
        <Image
          src={p.gameArtwork}
          alt=""
          fill
          className="object-cover"
          sizes="190px"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <CompetitionStatusBadge
            status={p.status}
            label={p.statusLabel}
            countdown={p.countdownLabel}
          />
          <h3 className="mt-2 text-lg font-black text-white sm:text-xl">
            {p.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <span
                key={`${tag.tone}-${tag.label}`}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-white/75"
              >
                {tag.label}
              </span>
            ))}
          </div>
          {p.description ? (
            <p className="mt-2 line-clamp-2 text-[13px] text-white/55">
              {p.description}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.key}
              className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                {m.label}
              </p>
              <p className="truncate text-sm font-extrabold text-white">
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center sm:w-[200px]">
        <CompetitionCTA cta={p.cta} />
      </div>
    </article>
  );
}
