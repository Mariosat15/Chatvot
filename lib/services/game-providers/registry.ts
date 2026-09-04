/**
 * The provider registry (X2, chapter 02 section 3).
 *
 * Maps a `providerKey` to the adapter that talks to it. This is the SECOND registry in the
 * system and the distinction matters, because conflating them is how provider vocabulary
 * ends up in the contest engine:
 *
 *   Game registry     `lib/games/registry.ts`   gameType     -> which code module scores
 *   Provider registry  this file                providerKey  -> which external adapter
 *
 * The contest engine only ever touches the first one. It never learns that a provider
 * exists (chapter 02 section 10 rule 1); it sees a `provider` game module and participants
 * with scores. Only code inside the provider layer resolves a `providerKey`.
 */

import { WhiteLabel } from "@/database/models/whitelabel.model";
import type { GameProviderAdapter } from "./contract";
import { MockProviderAdapter, MOCK_PROVIDER_KEY } from "./adapters/mock.adapter";

/**
 * Every adapter that exists in code, keyed by `providerKey`.
 *
 * Registered here, enabled in settings. The two are separate: being in this map means the
 * code exists, not that an operator has turned it on.
 *
 * The mock is registered unconditionally and that is deliberate. It is not throwaway
 * scaffolding - chapter 09 E1 makes it the basis of every automated test and the reason
 * seven of nine phases can proceed without waiting on a provider. It is kept out of
 * production by `enabled` in settings, defaulting to false, exactly like a real provider.
 */
const ADAPTERS = new Map<string, GameProviderAdapter>([
  [MOCK_PROVIDER_KEY, new MockProviderAdapter()],
]);

/** Registers an adapter. Exported for tests and for the X9 second-adapter skeleton. */
export function registerProviderAdapter(adapter: GameProviderAdapter): void {
  ADAPTERS.set(adapter.providerKey, adapter);
}

/** Resolves an adapter by key, ignoring settings. Returns null when no such adapter. */
export function getProviderAdapter(
  providerKey: string | null | undefined,
): GameProviderAdapter | null {
  if (!providerKey) return null;
  return ADAPTERS.get(providerKey.trim()) ?? null;
}

/** Every registered key. Used by admin screens to offer what could be configured. */
export function listRegisteredProviderKeys(): string[] {
  return [...ADAPTERS.keys()].sort();
}

export type ProviderResolution =
  | { available: true; adapter: GameProviderAdapter }
  | { available: false; reason: string };

/**
 * Resolves an adapter AND confirms an operator has enabled it.
 *
 * Returns rather than throws, for the reason given in `contract.ts`.
 *
 * Two switches must both be on, and they are separate on purpose. `externalGamesEnabled`
 * is the master kill switch for the feature, so a rollout can be reversed in one action
 * (chapter 09 section 5); the per-provider `enabled` flag turns off one supplier without
 * touching the others.
 *
 * FAILS CLOSED on a settings read error. Reason: the alternative is that a database blip
 * silently enables every provider, including ones half-configured. The cost of failing
 * closed is a visible refusal that someone reports; the cost of failing open is real money
 * moving against a provider we cannot authenticate to.
 */
export async function resolveEnabledProvider(
  providerKey: string | null | undefined,
): Promise<ProviderResolution> {
  const adapter = getProviderAdapter(providerKey);
  if (!adapter) {
    return {
      available: false,
      reason: `No adapter is registered for provider "${providerKey ?? "(none)"}".`,
    };
  }

  try {
    const settings = await WhiteLabel.findOne()
      .select("externalGamesEnabled gameProviders")
      .lean<{
        externalGamesEnabled?: boolean;
        gameProviders?: { providerKey: string; enabled?: boolean }[];
      }>();

    if (!settings?.externalGamesEnabled) {
      return {
        available: false,
        reason: "External games are disabled for this platform.",
      };
    }

    const entry = settings.gameProviders?.find(
      (p) => p.providerKey === adapter.providerKey,
    );

    // Reason: an ABSENT entry and one with `enabled: false` are the same answer here, but
    // for different causes, so they get different messages - a provider nobody configured
    // reads as a setup gap, while one explicitly switched off reads as a decision. Stage 0
    // taught this the hard way with `canEnterChallenges`: a stored value and an absent one
    // are different facts, and a message that conflates them sends the operator hunting in
    // the wrong screen.
    if (!entry) {
      return {
        available: false,
        reason: `Provider "${adapter.providerKey}" is not configured in settings.`,
      };
    }
    if (!entry.enabled) {
      return {
        available: false,
        reason: `Provider "${adapter.providerKey}" is disabled.`,
      };
    }

    return { available: true, adapter };
  } catch (error) {
    console.error("❌ Provider settings read failed:", error);
    return {
      available: false,
      reason: "Provider availability could not be confirmed.",
    };
  }
}
