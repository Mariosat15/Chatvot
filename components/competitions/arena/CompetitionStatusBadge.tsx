import Image from "next/image";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import type { CompetitionStatusKey } from "@/lib/competitions/types";

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const STYLES = new Map<CompetitionStatusKey, string>([
  [
    "live",
    "border-cyan-400/50 bg-cyan-500/20 text-cyan-100 shadow-[0_0_12px_rgba(0,216,255,.25)]",
  ],
  [
    "starting_soon",
    "border-amber-400/50 bg-amber-500/20 text-amber-100 shadow-[0_0_12px_rgba(255,176,32,.25)]",
  ],
  ["open", "border-sky-400/40 bg-sky-500/20 text-sky-100"],
  [
    "private_gm",
    "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-100 shadow-[0_0_12px_rgba(217,76,255,.25)]",
  ],
  ["gm_funded", "border-amber-400/50 bg-amber-500/20 text-amber-100"],
  ["completed", "border-slate-400/40 bg-slate-600/40 text-slate-100"],
  ["cancelled", "border-red-500/50 bg-red-600/30 text-red-100"],
  ["refunded", "border-orange-500/50 bg-orange-600/30 text-orange-100"],
  ["full", "border-gray-500/40 bg-gray-600/40 text-gray-200"],
  ["in_progress", "border-cyan-400/40 bg-cyan-500/20 text-cyan-100"],
]);

const ICONS = new Map<CompetitionStatusKey, string>([
  ["live", COMPETITION_ICON.live],
  ["in_progress", COMPETITION_ICON.live],
  ["starting_soon", COMPETITION_ICON.soon],
  ["open", COMPETITION_ICON.soon],
  ["private_gm", COMPETITION_ICON.bolt],
  ["gm_funded", COMPETITION_ICON.volts],
  ["completed", COMPETITION_ICON.trophyGold],
  ["full", COMPETITION_ICON.players],
]);

const PILL =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-extrabold uppercase leading-none tracking-wide backdrop-blur-sm sm:text-[11px]";

const PILL_LG =
  "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[11px] font-black uppercase leading-none tracking-wide backdrop-blur-sm sm:text-[12px]";

export function CompetitionStatusBadge({
  status,
  label,
  countdown,
  size = "md",
}: {
  status: CompetitionStatusKey;
  label: string;
  countdown?: string;
  /** `lg` is the card's top-right badge (replaces the game-name pill) */
  size?: "md" | "lg";
}) {
  const style =
    STYLES.get(status) ?? "border-slate-400/40 bg-slate-600/40 text-slate-100";
  const icon = ICONS.get(status);
  const lg = size === "lg";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`${lg ? PILL_LG : PILL} ${style}`}>
        {icon ? (
          <Image
            src={icon}
            alt=""
            width={lg ? 22 : 14}
            height={lg ? 22 : 14}
            className={`${lg ? "size-[22px]" : "size-3.5"} object-contain`}
          />
        ) : (
          <span className={`${lg ? "size-2" : "size-1.5"} rounded-full bg-current`} aria-hidden />
        )}
        {label}
      </span>
      {countdown ? (
        <span className={`${PILL} border-amber-400/30 bg-black/55 text-amber-100`}>
          <Image
            src={COMPETITION_ICON.clock}
            alt=""
            width={14}
            height={14}
            className="size-3.5 object-contain"
          />
          {countdown}
        </span>
      ) : null}
    </div>
  );
}
