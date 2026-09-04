import type { GameModule } from "../types";
import { PROVIDER_GAME_TYPE } from "../types";
import { providerCapabilities, providerScoring } from "./config";
import {
  getProviderRankingValue,
  getProviderTieBreakerValue,
} from "./scoring";

/**
 * The provider game module - one module for every external title, from every provider.
 *
 * ONE MODULE, NOT ONE PER PROVIDER OR PER TITLE, and this is the plug-and-play claim made
 * concrete. Adding a title is a row in `provider_game`; adding a provider is an adapter in
 * `lib/services/game-providers/adapters/`. Neither is a new game module, because neither
 * changes how a contest is scored: the engine receives one number per player and ranks on
 * it. If a future title needed its own module, that would mean the engine had learned
 * something game-specific, which is the thing the whole architecture exists to prevent.
 *
 * Everything that genuinely varies between titles - score direction, range, attempts,
 * settings - travels as DATA on the catalogue row and the contest, and reaches this module
 * through the participant. Nothing here branches on a provider key or a game code.
 */
export const providerGameModule: GameModule = {
  type: PROVIDER_GAME_TYPE,
  label: "Provider game",
  capabilities: providerCapabilities,
  scoring: providerScoring,
  getRankingValue: getProviderRankingValue,
  getTieBreakerValue: getProviderTieBreakerValue,
};
