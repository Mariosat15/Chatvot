import { Gamepad2, Info } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import ContestCountdown from "@/components/games/ContestCountdown";

/**
 * Center column of the game arena lobby (owner target, 15 Oct 2026 image 1):
 * gamepad + short title, rule badges, blurb, cyan neon countdown, info bar, gold PLAY.
 *
 * Kind-agnostic: title/description/badges are handed in from catalogue + contest facts.
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
      ? "border-amber-400/70 bg-[#1a1208]/90 text-amber-50 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
      : "border-cyan-400/70 bg-[#061820]/90 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.22)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-wide ${classes}`}
    >
      {children}
    </span>
  );
}

export function LobbyCenterStage({
  title,
  description,
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
  /** Short game name (e.g. Circuit Sprint), not the full contest marketing title. */
  title: string;
  description?: string | null;
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
      <div className="relative space-y-4 border border-cyan-400/40 bg-gradient-to-b from-[#0B1834]/95 via-[#080F22] to-[#050A16] p-5 shadow-[0_0_28px_rgba(34,211,238,0.12),inset_0_0_40px_rgba(56,189,248,0.06)] sm:p-6">
        <div className="relative space-y-4">
          <div>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_16px_rgba(34,211,238,0.35)]"
              >
                <Gamepad2 className="h-5 w-5 text-cyan-300" />
              </span>
              <h2 className="text-2xl font-black uppercase tracking-[0.06em] text-white sm:text-3xl">
                {title}
              </h2>
            </div>
            {badges ? (
              <div className="mt-3 flex flex-wrap gap-2">{badges}</div>
            ) : null}
            {description ? (
              <p className="mt-3 text-sm leading-relaxed text-gray-200/90">
                {description}
              </p>
            ) : null}
          </div>

          {showCountdown && countdownTarget ? (
            <ContestCountdown
              target={countdownTarget}
              serverNow={serverNow}
              label={countdownLabel}
              variant={countdownVariant}
              details={scheduleDetails}
              size="arena"
            />
          ) : scheduleDetails ? (
            <div className="rounded-xl border border-cyan-400/30 bg-[#060B18]/80 p-4">
              {scheduleDetails}
            </div>
          ) : null}

          {attemptNote ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-cyan-400/40 bg-[#061820]/80 px-3 py-2.5 shadow-[0_0_14px_rgba(34,211,238,0.12)]">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-gray-100/95">
                {attemptNote}
              </p>
            </div>
          ) : null}

          <div className="pt-1">{entryControl}</div>
          {attemptsPanel}
        </div>
      </div>
    </NeonPanel>
  );
}
