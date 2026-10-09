import Image from "next/image";

type UtilityTone = "cyan" | "gold";

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const TONES = new Map<
  UtilityTone,
  { border: string; glow: string; label: string }
>([
  [
    "cyan",
    {
      border: "border-cyan-400/40",
      glow: "shadow-[0_0_14px_rgba(0,216,255,.15)]",
      label: "text-cyan-300/80",
    },
  ],
  [
    "gold",
    {
      border: "border-amber-400/40",
      glow: "shadow-[0_0_14px_rgba(255,176,32,.15)]",
      label: "text-amber-300/80",
    },
  ],
]);

export function ArenaUtilityCard({
  icon,
  label,
  value,
  subvalue,
  tone,
  interactive = false,
  compact = false,
}: {
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  tone: UtilityTone;
  interactive?: boolean;
  /** Phone layout: three cards side by side in a 360-430px band. */
  compact?: boolean;
}) {
  const fallback = {
    border: "border-cyan-400/40",
    glow: "shadow-[0_0_14px_rgba(0,216,255,.15)]",
    label: "text-cyan-300/80",
  };
  const t = TONES.get(tone) ?? fallback;
  const frame = compact
    ? "h-[62px] gap-1.5 rounded-xl px-2"
    : "h-[86px] gap-3 rounded-[14px] px-3.5";
  return (
    <div
      className={`flex items-center border bg-black/45 ${frame} ${t.border} ${t.glow} ${
        interactive ? "transition hover:brightness-110" : ""
      }`}
    >
      <Image
        src={icon}
        alt=""
        width={40}
        height={40}
        className={
          compact
            ? "h-6 w-6 shrink-0 object-contain"
            : "h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
        }
      />
      <div className="min-w-0">
        <p
          className={
            compact
              ? `truncate text-[9px] font-bold uppercase tracking-wide ${t.label}`
              : `text-[11px] font-bold uppercase tracking-wider sm:text-[12px] ${t.label}`
          }
        >
          {label}
        </p>
        <p
          className={
            compact
              ? "truncate text-[13px] font-black tabular-nums leading-tight text-white"
              : "truncate text-[21px] font-black tabular-nums leading-tight text-white sm:text-[23px]"
          }
        >
          {value}
        </p>
        {subvalue ? (
          <p
            className={
              compact
                ? "truncate text-[9px] text-white/50"
                : "truncate text-[12px] text-white/50"
            }
          >
            {subvalue}
          </p>
        ) : null}
      </div>
    </div>
  );
}
