import InlineCountdown from "@/components/trading/InlineCountdown";
import { MobileLobbyCard } from "@/components/competitions/lobby/mobile/MobileLobbyCard";

/**
 * One status strip + one countdown (guide §5). Never a second timer elsewhere
 * on the phone tree.
 */

function statusCopy(status: string): { headline: string; detail?: string } {
  switch (status) {
    case "upcoming":
      return { headline: "Starting soon" };
    case "active":
      return { headline: "Live now" };
    case "completed":
      return { headline: "Completed", detail: "Results are final" };
    case "cancelled":
      return { headline: "Cancelled", detail: "Refunded when applicable" };
    default:
      return { headline: status || "Competition" };
  }
}

export function MobileGameLobbyStatus({
  status,
  isActive,
  isCompleted,
  isCancelled,
  countdownTarget,
  contestLabel = "Competition",
}: {
  status: string;
  isActive: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  countdownTarget?: Date | string | null;
  contestLabel?: string;
}) {
  const copy = statusCopy(status);
  const showCountdown =
    Boolean(countdownTarget) && !isCompleted && !isCancelled;

  return (
    <MobileLobbyCard>
      <div className="flex min-w-0 flex-col items-center gap-1 text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-cyan-300">
          {copy.headline}
        </p>
        {showCountdown && countdownTarget ? (
          <div className="w-full min-w-0">
            <p className="mb-1 text-[12px] text-gray-400">
              {isActive ? `${contestLabel} ends in` : `${contestLabel} starts in`}
            </p>
            <InlineCountdown
              targetDate={
                typeof countdownTarget === "string"
                  ? countdownTarget
                  : new Date(countdownTarget).toISOString()
              }
              type={isActive ? "end" : "start"}
              zeroLabel={isActive ? "Ending…" : "Starting…"}
            />
          </div>
        ) : copy.detail ? (
          <p className="text-[13px] text-gray-300">{copy.detail}</p>
        ) : null}
      </div>
    </MobileLobbyCard>
  );
}
