import InlineCountdown from "@/components/trading/InlineCountdown";
import { NeonNote, NeonRow } from "@/components/neon/Cards";
import { NEON_LABEL } from "@/components/neon/tokens";

/** Play-mode rule + optional last-attempt cut-off under the Schedule card. */
export function GameLobbyScheduleNote({
  modeLabel,
  modeDetail,
  playMode,
  reservesFullRound,
  showAttemptCutoff,
  attemptCutoffMs,
}: {
  modeLabel: string;
  modeDetail: string;
  playMode: "anytime" | "scheduled";
  reservesFullRound: boolean;
  showAttemptCutoff: boolean;
  attemptCutoffMs: number | null;
}) {
  return (
    <>
      <NeonNote>
        <span className="font-semibold text-gray-100">{modeLabel}</span>{" "}
        {modeDetail}
        {playMode === "anytime" && (
          <>
            {" "}
            {reservesFullRound
              ? "An attempt has to begin early enough to finish inside the window, so the last one starts before it shuts."
              : "Anything still running when the window shuts is closed with the competition and scored on what you managed."}
          </>
        )}
      </NeonNote>
      {showAttemptCutoff && attemptCutoffMs !== null && (
        <div className="mt-3 space-y-2">
          <p className={NEON_LABEL}>Last attempt</p>
          <NeonRow
            label="Last attempt can start in"
            accent="waiting"
            value={
              <InlineCountdown
                targetDate={new Date(attemptCutoffMs).toISOString()}
                type="end"
                zeroLabel="Passed"
              />
            }
          />
        </div>
      )}
    </>
  );
}
