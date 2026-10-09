import type { CompetitionStatusKey } from "@/lib/competitions/types";

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const STYLES = new Map<CompetitionStatusKey, string>([
  [
    "live",
    "border-cyan-400/50 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(0,216,255,.25)]",
  ],
  [
    "starting_soon",
    "border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-[0_0_12px_rgba(255,176,32,.25)]",
  ],
  ["open", "border-sky-400/40 bg-sky-500/15 text-sky-200"],
  [
    "private_gm",
    "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_12px_rgba(217,76,255,.25)]",
  ],
  ["gm_funded", "border-amber-400/50 bg-amber-500/15 text-amber-100"],
  ["completed", "border-slate-400/40 bg-slate-500/20 text-slate-200"],
  ["cancelled", "border-red-500/50 bg-red-500/20 text-red-200"],
  ["refunded", "border-orange-500/50 bg-orange-500/20 text-orange-200"],
  ["full", "border-gray-500/40 bg-gray-600/30 text-gray-300"],
  ["in_progress", "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"],
]);

export function CompetitionStatusBadge({
  status,
  label,
  countdown,
}: {
  status: CompetitionStatusKey;
  label: string;
  countdown?: string;
}) {
  const style =
    STYLES.get(status) ?? "border-slate-400/40 bg-slate-500/20 text-slate-200";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${style}`}
      >
        {label}
      </span>
      {countdown ? (
        <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-black/40 px-2.5 py-1 text-[11px] font-bold text-amber-200">
          {countdown}
        </span>
      ) : null}
    </div>
  );
}
