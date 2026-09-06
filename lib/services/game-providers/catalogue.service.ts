/**
 * Catalogue sync (X2, chapter 09 E1 and chapter 02 section 3).
 *
 * Pulls a provider's title list and upserts it into `provider_game`. The point of caching
 * it in our own collection rather than calling the provider per request is chapter 07
 * section 7: when a sync fails, players see nothing wrong and no money is affected,
 * because the catalogue they browse is ours.
 *
 * THE THREE RULES THIS SERVICE EXISTS TO ENFORCE
 * ----------------------------------------------
 * 1. A sync NEVER enables a title. `chartvoltEnabled` is ours and defaults to false
 *    (chapter 04 section 3.2). A provider flipping their own `status` to `active` must not
 *    put an untested game in front of paying players.
 *
 * 2. A sync NEVER rewrites `gameKey`, `gameCode` or `providerKey`. They are the join keys
 *    for all historical stats and are immutable at the schema level too. A sync that could
 *    repoint them could silently reassign every past result.
 *
 * 3. A sync NEVER overwrites operator-edited presentation content. Chapter 16 section 1
 *    makes the catalogue admin-editable at X11; a later sync clobbering a hand-written
 *    description is the defect that makes operators stop trusting the screen. Enforced
 *    here by listing the fields a sync owns, rather than spreading the whole payload.
 */

import ProviderGame from "@/database/models/games/provider-game.model";
import GameProvider from "@/database/models/games/game-provider.model";
import type {
  GameProviderAdapter,
  ProviderCatalogueGame,
} from "./contract";

/** `provider:{providerKey}:{gameCode}`, chapter 02 section 2.1. Derived once, never again. */
export function buildProviderGameKey(
  providerKey: string,
  gameCode: string,
): string {
  return `provider:${providerKey}:${gameCode}`;
}

export interface CatalogueSyncResult {
  success: boolean;
  providerKey: string;
  /** Titles the provider returned. */
  received: number;
  /** Rows created. */
  created: number;
  /** Rows whose provider-owned fields changed. */
  updated: number;
  /** Rows already correct. */
  unchanged: number;
  /**
   * Titles in our cache that the provider no longer lists.
   *
   * Reported, never deleted. Reason: a title with historical rounds cannot be removed
   * without orphaning the stats joined to its `gameKey`, and a provider omitting a game
   * from one response is as likely to be a partial failure on their side as a withdrawal.
   * Retiring a title is `chartvoltEnabled: false` plus an operator decision.
   */
  missingFromProvider: string[];
  error?: string;
}

/**
 * The fields a sync is allowed to write.
 *
 * Reason: an allow-list, not a spread. Spreading the provider payload would mean any field
 * they add - or any field an operator later edits - is silently overwritten on the next
 * sync, and that failure is invisible until someone notices their wording reverted. Adding
 * a field here is a deliberate one-line decision.
 */
function providerOwnedFields(game: ProviderCatalogueGame) {
  return {
    family: game.family,
    supportsCompetition: game.supportsCompetition,
    supportsOneVsOne: game.supportsOneVsOne,
    supportsPractice: game.supportsPractice,
    supportsContentSeed: game.supportsContentSeed,
    scoreDirection: game.scoreDirection,
    scoreType: game.scoreType,
    scoreRange: game.scoreRange,
    typicalDurationSeconds: game.typicalDurationSeconds,
    maxDurationSeconds: game.maxDurationSeconds,
    configSchema: game.configSchema,
    providerStatus: game.status,
  };
}

/**
 * Fields set only when a row is first created.
 *
 * Presentation copy is seeded from the provider once and then belongs to the operator.
 * This is the mechanism behind rule 3 above.
 */
function firstSyncOnlyFields(game: ProviderCatalogueGame) {
  return {
    displayName: game.displayName,
    description: game.description,
    thumbnailUrl: game.thumbnailUrl,
    category: game.category,
  };
}

/**
 * Syncs one provider's catalogue.
 *
 * Idempotent: running it twice with an unchanged catalogue reports `unchanged` for every
 * title and writes nothing. Safe to run on a schedule, which is how it is meant to run -
 * never per request (chapter 15 section 6).
 *
 * Returns rather than throws, so a failed sync is a reported condition and not a 500 on
 * whatever screen happened to trigger it.
 */
export async function syncProviderCatalogue(
  adapter: GameProviderAdapter,
): Promise<CatalogueSyncResult> {
  const providerKey = adapter.providerKey;
  const base: CatalogueSyncResult = {
    success: false,
    providerKey,
    received: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    missingFromProvider: [],
  };

  const listed = await adapter.listGames();
  if (!listed.success) {
    // Reason: the cached catalogue stays exactly as it was. Chapter 07 section 7 - a
    // catalogue sync failure has no player impact and no money impact, and the way to keep
    // that true is to change nothing on failure.
    console.warn(
      `⚠️ Catalogue sync failed for provider "${providerKey}": ${listed.error}`,
    );
    return { ...base, error: listed.error };
  }

  const games = listed.data;
  base.received = games.length;

  const seenCodes = new Set<string>();

  for (const game of games) {
    seenCodes.add(game.gameCode);
    const gameKey = buildProviderGameKey(providerKey, game.gameCode);

    try {
      const existing = await ProviderGame.findOne({
        providerKey,
        gameCode: game.gameCode,
      });

      if (!existing) {
        await ProviderGame.create({
          providerKey,
          gameCode: game.gameCode,
          gameKey,
          ...firstSyncOnlyFields(game),
          ...providerOwnedFields(game),
          // Not passed from the payload - see rule 1. The schema default is false and the
          // operator enables the title after testing it.
          lastSyncedAt: new Date(),
        });
        base.created += 1;
        continue;
      }

      const incoming = providerOwnedFields(game);
      const changed = Object.entries(incoming).some(
        ([field, value]) =>
          JSON.stringify(existing.get(field)) !== JSON.stringify(value),
      );

      if (changed) {
        existing.set(incoming);
      }
      existing.set("lastSyncedAt", new Date());
      await existing.save();

      if (changed) base.updated += 1;
      else base.unchanged += 1;
    } catch (error) {
      // Reason: one malformed title must not abandon the rest of the catalogue. A provider
      // adding a game with a family we do not recognise should cost us that one row, not
      // the whole sync - and the alternative silently leaves earlier rows updated and later
      // ones not, which is worse than a partial success that says so.
      console.error(
        `❌ Catalogue sync failed for "${providerKey}/${game.gameCode}":`,
        error,
      );
      return {
        ...base,
        error: `Failed while syncing "${game.gameCode}". Some titles may not be updated.`,
      };
    }
  }

  const cached = await ProviderGame.find({ providerKey })
    .select("gameCode")
    .lean<{ gameCode: string }[]>();
  base.missingFromProvider = cached
    .map((row) => row.gameCode)
    .filter((code) => !seenCodes.has(code));

  // Reason: recorded on the provider, not the titles, because it answers "did we hear from
  // them" - which is a provider-level health question (chapter 04 section 3.1).
  await GameProvider.updateOne(
    { providerKey },
    { $set: { lastCatalogueSyncAt: new Date() } },
  );

  return { ...base, success: true };
}
