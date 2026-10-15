import { NeonPanel } from "@/components/neon/Cards";
import ContestCountdown from "@/components/games/ContestCountdown";

/**
 * Center column of the game arena lobby: contest title, rule badges, showcase
 * countdown, and the Join / Play control.
 */

export function LobbyRuleBadge({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  const classes =
    tone === "warn"
      ? "border-amber-400/45 bg-amber-500/15 text-amber-100"
      : "border-sky-400/45 bg-sky-500/15 text-sky-100";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}

export function LobbyCenterStage({
  title,
  badges,
  showCountdown,
  countdownTarget,
  serverNow,
  countdownLabel,
  countdownVariant,
  scheduleDetails,
  attemptNote,
  entryControl,
  attemptsPanel,
}: {
  title: string;
  badges: React.ReactNode;
  showCountdown: boolean;
  countdownTarget?: string | number | Date | null;
  serverNow?: string;
  countdownLabel: string;
  countdownVariant: "start" | "end";
  scheduleDetails?: React.ReactNode;
  attemptNote?: string | null;
  entryControl: React.ReactNode;
  attemptsPanel?: React.ReactNode;
}) {
  return (
    <NeonPanel accent="score" size="lg" className="!p-0 overflow-hidden">
      <div className="relative space-y-4 border border-cyan-400/25 bg-gradient-to-b from-[#0B1834]/90 via-[#080F22]/95 to-[#050A16] p-5 shadow-[inset_0_0_40px_rgba(56,189,248,0.08)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.18),transparent_55%)]" />
        <div className="relative space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
            </h2>
            {badges ? (
              <div className="mt-3 flex flex-wrap gap-2">{badges}</div>
            ) : null}
          </div>

          {showCountdown && countdownTarget ? (
            <ContestCountdown
              target={countdownTarget}
              serverNow={serverNow}
              label={countdownLabel}
              variant={countdownVariant}
              details={scheduleDetails}
              size="showcase"
            />
          ) : scheduleDetails ? (
            <div className="rounded-xl border border-[#1B2540] bg-[#060B18]/80 p-4">
              {scheduleDetails}
            </div>
          ) : null}

          {attemptNote ? (
            <p className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-100/90">
              {attemptNote}
            </p>
          ) : null}

          <div className="pt-1">{entryControl}</div>
          {attemptsPanel}
        </div>
      </div>
    </NeonPanel>
  );
}
