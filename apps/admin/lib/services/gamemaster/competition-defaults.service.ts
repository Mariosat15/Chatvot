/**
 * Reading and saving the Game Master competition defaults. The only file that touches the
 * model - the option list and the validator are model-free so client screens can use them.
 */
import GameMasterCompetitionDefaults, {
  GAMEMASTER_COMPETITION_DEFAULTS_KEY,
} from "@/database/models/trading/gamemaster-competition-defaults.model";
import type { ResolvedCompetitionDefault } from "./competition-defaults";
import { resolveCompetitionDefaults } from "./competition-defaults-apply";

/**
 * The admin's configuration, every option present. A failed read falls back to the shipped
 * defaults with every option open - exactly what a Game Master could do before this screen
 * existed - rather than refusing every creation because a settings read timed out.
 */
export async function loadGameMasterCompetitionDefaults(): Promise<
  ResolvedCompetitionDefault[]
> {
  try {
    const doc = await GameMasterCompetitionDefaults.findOne({
      singletonKey: GAMEMASTER_COMPETITION_DEFAULTS_KEY,
    }).lean();
    return resolveCompetitionDefaults(doc?.options);
  } catch (error) {
    console.warn(
      "⚠️ [GM competition defaults] Could not read the settings; using the shipped defaults:",
      error,
    );
    return resolveCompetitionDefaults(undefined);
  }
}

/** Store an already-validated list. Options absent from it keep their stored entry. */
export async function saveGameMasterCompetitionDefaults(
  entries: readonly ResolvedCompetitionDefault[],
  updatedBy: string | undefined,
): Promise<ResolvedCompetitionDefault[]> {
  const existing = await GameMasterCompetitionDefaults.findOne({
    singletonKey: GAMEMASTER_COMPETITION_DEFAULTS_KEY,
  }).lean();
  const merged = new Map<string, ResolvedCompetitionDefault>();
  for (const entry of resolveCompetitionDefaults(existing?.options)) {
    merged.set(entry.key, entry);
  }
  for (const entry of entries) merged.set(entry.key, entry);

  const options = [...merged.values()];
  await GameMasterCompetitionDefaults.updateOne(
    { singletonKey: GAMEMASTER_COMPETITION_DEFAULTS_KEY },
    { $set: { options, updatedBy } },
    { upsert: true },
  );
  return options;
}
