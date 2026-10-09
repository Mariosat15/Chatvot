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
}: {
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  tone: UtilityTone;
  interactive?: boolean;
}) {
  const fallback = {
    border: "border-cyan-400/40",
    glow: "shadow-[0_0_14px_rgba(0,216,255,.15)]",
    label: "text-cyan-300/80",
  };
  const t = TONES.get(tone) ?? fallback;
  return (
    <div
      className={`flex h-[74px] items-center gap-3 rounded-[14px] border bg-black/40 px-3 ${t.border} ${t.glow} ${
        interactive ? "transition hover:brightness-110" : ""
      }`}
    >
      <Image
        src={icon}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p
          className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}
        >
          {label}
        </p>
        <p className="truncate text-base font-black tabular-nums text-white sm:text-[17px]">
          {value}
        </p>
        {subvalue ? (
          <p className="truncate text-[11px] text-white/50">{subvalue}</p>
        ) : null}
      </div>
    </div>
  );
}
