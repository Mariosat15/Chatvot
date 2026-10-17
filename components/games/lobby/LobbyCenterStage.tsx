import { Clock, PlayCircle, RotateCcw, type LucideIcon } from "lucide-react";
import ContestCountdown from "@/components/games/ContestCountdown";
import { StageIcon } from "@/components/games/preflight-parts";

/**
 * Center column of the game arena lobby (owner target, 15 Oct 2026 image 1):
 * gamepad + short title, rule badges, blurb, cyan neon countdown, fact chips, gold PLAY.
 *
 * Kind-agnostic: title/description/badges are handed in from catalogue + contest facts.
 * The old one-paragraph info bar became three short chips (owner, 15 Oct 2026: "organise
 * into categories"). Icons are picked by a string kind so the facts stay plain data.
 */

export type LobbyStageFactKind = "clock" | "start" | "attempt";

export interface LobbyStageFact {
  kind: LobbyStageFactKind;
  label: string;
  value: string;
}

const FACT_ICON = new Map<LobbyStageFactKind, LucideIcon>([
  ["clock", Clock],
  ["start", PlayCircle],
  ["attempt", RotateCcw],
]);

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
  facts,
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
  /** Short round facts drawn as chips (round length, when to start, attempt cost). */
  facts?: LobbyStageFact[];
  entryControl: React.ReactNode;
  attemptsPanel?: React.ReactNode;
}) {
  return (
    // Reason: no NeonPanel / overflow-hidden wrapper here - it clipped the outer glow,
    // which is why the stage looked flat beside the owner's target.
    <div>
      <div className="relative space-y-4 rounded-xl border border-cyan-400/60 bg-gradient-to-b from-[#0B1834]/95 via-[#080F22] to-[#050A16] p-5 shadow-[0_0_36px_-2px_rgba(34,211,238,0.38),inset_0_0_48px_rgba(56,189,248,0.10)] sm:p-6">
        <div className="relative space-y-4">
          <div>
            <div className="flex items-center gap-3">
              <StageIcon slug="gamepad-blue" size="lg" />
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

          {facts && facts.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {facts.map((fact) => {
                const Icon = FACT_ICON.get(fact.kind) ?? Clock;
                return (
                  <div
                    key={fact.label}
                    className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-cyan-400/45 bg-[#061820]/85 px-2 py-2.5 text-center shadow-[0_0_16px_-2px_rgba(34,211,238,0.35),inset_0_0_12px_rgba(34,211,238,0.08)]"
                  >
                    <Icon className="h-4 w-4 text-cyan-300" aria-hidden />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">
                      {fact.label}
                    </span>
                    <span className="text-xs font-bold text-white">{fact.value}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="pt-1">{entryControl}</div>
          {attemptsPanel}
        </div>
      </div>
    </div>
  );
}
