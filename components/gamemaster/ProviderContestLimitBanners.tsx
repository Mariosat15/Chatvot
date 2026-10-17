import { AlertCircle } from "lucide-react";

/** The package-limit banners above the Game Master provider-contest wizard. */
export function ProviderContestLimitBanners({
  blockedByActive,
  blockedByDaily,
  activeCompetitions,
  maxActiveCompetitions,
  competitionsCreatedToday,
  maxCompetitionsPerDay,
}: {
  blockedByActive: boolean;
  blockedByDaily: boolean;
  activeCompetitions: number;
  maxActiveCompetitions: number;
  competitionsCreatedToday: number;
  maxCompetitionsPerDay: number;
}) {
  return (
    <>
      {blockedByActive && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4">
          <AlertCircle className="h-6 w-6 shrink-0 text-red-400" />
          <div>
            <h3 className="font-semibold text-red-400">
              Active Competition Limit Reached
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              You already have {activeCompetitions} active competition(s)
              (limit {maxActiveCompetitions}). Wait for one to finish (or
              for an upcoming contest to drop below its minimum entrants)
              before creating another.
            </p>
          </div>
        </div>
      )}

      {blockedByDaily && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4">
          <AlertCircle className="h-6 w-6 shrink-0 text-red-400" />
          <div>
            <h3 className="font-semibold text-red-400">Daily Limit Reached</h3>
            <p className="mt-1 text-sm text-gray-400">
              You&apos;ve created {competitionsCreatedToday} competition(s)
              today (limit {maxCompetitionsPerDay}). Come back tomorrow to
              create more!
            </p>
          </div>
        </div>
      )}
    </>
  );
}
