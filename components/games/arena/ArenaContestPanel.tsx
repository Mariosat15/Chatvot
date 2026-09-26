import { getTerms } from "@/lib/services/terminology.service";
import type { PlayState } from "@/components/games/play-state";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";
import {
  ArenaContestPanelView,
  type ArenaContestFacts,
} from "./ArenaContestPanelView";

export type { ArenaContestFacts };

/**
 * Server entry for contest info. Resolves vocabulary once, then renders the shared view.
 *
 * The live arena path uses `ArenaLiveSidebar` → `ArenaContestPanelView` instead, with terms
 * already resolved on the page, so joins can refresh the seats tile without a full reload.
 */

interface Props {
  facts: ArenaContestFacts;
  state: PlayState;
  presentation: GamePresentation;
  rank?: number;
}

export async function ArenaContestPanel({
  facts,
  state,
  presentation,
  rank,
}: Props) {
  const terms = await getTerms();
  return (
    <ArenaContestPanelView
      facts={facts}
      state={state}
      presentation={presentation}
      terms={terms}
      rank={rank}
    />
  );
}
