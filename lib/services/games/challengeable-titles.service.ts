import { connectToDatabase } from "@/database/mongoose";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { parseConfigSchema } from "@/lib/services/games/config-schema";
import { resolveGameCategory } from "@/lib/services/games/game-categories";
import { resolvePlayMode } from "@/lib/services/games/play-shape";

/**
 * The main-app reader of which provider titles a PLAYER may challenge someone else to.
 *
 * The sibling of `apps/admin/lib/services/game-providers/provider-contest.service.ts`'s
 * `listContestableTitles`, deliberately not a shared module: that function serves an operator
 * drafting a contest, and an operator is allowed to prepare one ahead of a launch - which is
 * exactly why its own `externalGamesEnabled` check is a WARNING, not a refusal, in
 * `contest-preflight.ts`. A player opening the challenge dialog has no "drafting" case; the
 * feature must be either genuinely usable or absent. So this reader turns the same field into
 * a HARD gate: if external games are off platform-wide, the list is empty and the picker
 * shows only Trading, rather than a card that fails on submit.
 *
 * THE FILTERS ARE OTHERWISE THE SAME THREE SWITCHES AS THE ADMIN READER - the provider's own
 * `enabled`, the title's `chartvoltEnabled` and `providerStatus: "active"`, and an installed
 * adapter - because a title that fails any of them cannot run a round regardless of who is
 * asking. `supportsOneVsOne` and `supportsContentSeed` are deliberately NOT filtered out here;
 * they are returned so the picker can disable the card and name the reason, matching
 * `StepChooseGame.tsx`'s "withhold with the reason" pattern rather than hiding titles a player
 * might reasonably wonder about.
 */
export interface ChallengeableTitle {
  providerKey: string;
  providerName: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  category?: string;
  family: "independent" | "head_to_head";
  /** The RESOLVED play mode - see `resolvePlayMode`. A `head_to_head` title is scheduled. */
  playMode: "anytime" | "scheduled";
  scoreDirection: "higher_is_better" | "lower_is_better";
  scoreType: "integer" | "decimal" | "duration_ms";
  scoreUnit?: string;
  maxDurationSeconds?: number;
  supportsOneVsOne: boolean;
  supportsContentSeed: boolean;
  /** True only when the title's own schema is well-formed. A malformed schema still lists
   *  the title (so the operator side is not silently affected) but the create route refuses
   *  it, the same fail-closed behaviour `contest-preflight.ts` already applies. */
  schemaOk: boolean;
}

export async function listChallengeableTitles(): Promise<ChallengeableTitle[]> {
  await connectToDatabase();

  const settings = await WhiteLabel.findOne()
    .select("externalGamesEnabled")
    .lean<{ externalGamesEnabled?: boolean } | null>();

  // Reason: the hard gate. See the module comment - a player has no "prepare ahead of
  // launch" case, so the master switch being off must hide the feature rather than warn.
  if (!settings?.externalGamesEnabled) return [];

  const providers = await GameProvider.find({ enabled: true }).lean<
    { providerKey: string; displayName: string }[]
  >();
  if (providers.length === 0) return [];

  const enabledKeys = providers.map((p) => p.providerKey);
  const nameByKey = new Map(providers.map((p) => [p.providerKey, p.displayName]));

  const titles = await ProviderGame.find({
    providerKey: { $in: enabledKeys },
    chartvoltEnabled: true,
    providerStatus: "active",
  })
    .sort({ displayName: 1 })
    .lean();

  return titles
    .filter((title) => Boolean(getProviderAdapter(title.providerKey)))
    .map((title) => {
      const parsed = parseConfigSchema(title.configSchema);
      return {
        providerKey: title.providerKey,
        providerName: nameByKey.get(title.providerKey) ?? title.providerKey,
        gameCode: title.gameCode,
        gameKey: title.gameKey,
        displayName: title.displayName,
        category: resolveGameCategory(title.category)?.label,
        family: title.family,
        playMode: resolvePlayMode(title),
        scoreDirection: title.scoreDirection,
        scoreType: title.scoreType,
        scoreUnit: title.scoreUnit,
        maxDurationSeconds: title.maxDurationSeconds,
        supportsOneVsOne: Boolean(title.supportsOneVsOne),
        supportsContentSeed: Boolean(title.supportsContentSeed),
        schemaOk: parsed.ok,
      } as ChallengeableTitle;
    });
}
