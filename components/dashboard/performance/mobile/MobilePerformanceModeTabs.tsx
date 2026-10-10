"use client";

export type PerfBreakdownMode = "trading" | "challenges" | "competitions";

/**
 * One deeper section at a time under the trend. Trading is withheld when R21
 * hides that chrome.
 */
export default function MobilePerformanceModeTabs({
  mode,
  onChange,
  showTrading,
}: {
  mode: PerfBreakdownMode;
  onChange: (next: PerfBreakdownMode) => void;
  showTrading: boolean;
}) {
  const tabs: { id: PerfBreakdownMode; label: string }[] = [
    ...(showTrading ? [{ id: "trading" as const, label: "Trading" }] : []),
    { id: "challenges", label: "1v1" },
    { id: "competitions", label: "Competitions" },
  ];

  return (
    <div
      className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Performance breakdown"
    >
      {tabs.map((tab) => {
        const on = tab.id === mode;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={`min-h-[48px] shrink-0 rounded-full border px-4 text-sm font-semibold ${
              on
                ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_16px_rgba(0,217,255,0.25)]"
                : "border-white/10 bg-white/[0.04] text-[#8ea4c5]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
