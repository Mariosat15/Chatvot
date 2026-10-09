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
  const mutedArt =
    p.status === "cancelled" ||
    p.status === "refunded" ||
    p.status === "completed";

  return (
    <article
      className="relative flex min-h-[160px] flex-col gap-3 overflow-hidden rounded-2xl border bg-gradient-to-r from-[rgba(7,22,55,.94)] to-[rgba(2,8,22,.98)] p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4"
      style={{
        borderColor: `${p.gameAccent}55`,
        boxShadow: `0 0 16px ${p.theme.glow}`,
      }}
    >
      {p.showCancelledRibbon ? (
        <div
          className="pointer-events-none absolute -right-10 top-4 z-20 w-[150px] rotate-45 bg-gradient-to-r from-red-700 to-red-500 py-1 text-center text-[10px] font-black uppercase tracking-wider text-white shadow-lg"
          aria-hidden
        >
          {p.cancelledRibbonLabel || "CANCELLED"}
        </div>
      ) : null}

      <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 sm:h-auto sm:w-[200px]">
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
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(3,10,29,0.05) 0%, rgba(3,10,29,0.55) 100%)",
          }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
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
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5"
            >
              <Image
                src={m.icon}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                  {m.label}
                </p>
                <p className="truncate text-[15px] font-extrabold text-white">
                  {m.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center sm:w-[210px]">
        <CompetitionCTA cta={p.cta} />
      </div>
    </article>
  );
}
