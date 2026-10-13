import LiveCountdown from "@/components/trading/LiveCountdown";

/**
 * One full-width Starts In / Ends In panel (Complobyymobile §8).
 * Hidden when completed or cancelled so it cannot contradict status.
 */

export function MobileLobbyCountdown({
  startTime,
  endTime,
  isUpcoming,
  isActive,
}: {
  startTime: Date | string;
  endTime: Date | string;
  isUpcoming: boolean;
  isActive: boolean;
}) {
  if (isUpcoming) {
    return (
      <LiveCountdown
        targetDate={new Date(startTime)}
        label="Starts in"
        type="start"
        status="upcoming"
      />
    );
  }
  if (isActive) {
    return (
      <LiveCountdown
        targetDate={new Date(endTime)}
        label="Ends in"
        type="end"
        status="active"
      />
    );
  }
  return null;
}
