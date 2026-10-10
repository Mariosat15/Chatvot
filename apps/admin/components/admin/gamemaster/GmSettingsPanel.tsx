"use client";

import GmProgramSwitches from "./GmProgramSwitches";
import FreePrivateEntryRuleControl from "./FreePrivateEntryRuleControl";
import GmAffiliationMigration from "./GmAffiliationMigration";
import GameMasterCompetitionDefaultsSection from "./GameMasterCompetitionDefaultsSection";

/**
 * Every Game Master setting on one tab of Manage Game Masters: the programme switches, the
 * free-seat entry rule, the affiliation migration, then the competition defaults.
 *
 * Reason: the defaults keep their own `gm-competition-defaults` grant (their route refuses
 * without it), so an employee holding only `gamemaster-management` sees the switches and a
 * note rather than a screen whose every save is refused.
 */
export default function GmSettingsPanel({ canEditDefaults }: { canEditDefaults: boolean }) {
  return (
    <div className="space-y-6">
      <GmProgramSwitches />
      <FreePrivateEntryRuleControl />
      <GmAffiliationMigration />
      {canEditDefaults ? (
        <GameMasterCompetitionDefaultsSection />
      ) : (
        <p className="rounded-lg border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400">
          Game Master Competition Defaults need the &quot;GM Competition Defaults&quot; permission.
        </p>
      )}
    </div>
  );
}
