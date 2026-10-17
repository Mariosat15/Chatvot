import type { DefaultPage } from "./default-pages";
import { FREE_PRIVATE_TERMS_SLUG } from "../services/gamemaster/free-private-terms-rules";

/**
 * The Free Private Competition Terms, shown before entering a Game Master-funded contest.
 *
 * Its own file because `default-pages.ts` is past the 500-line limit. Seeded once as version
 * "1"; afterwards it is Site Pages CMS copy, because the seed never overwrites an existing
 * page. `requiresLivePage` keeps it out of the built-in fallback: consent must be to a
 * versioned database page.
 */
export const FREE_PRIVATE_TERMS_PAGE: DefaultPage = {
  slug: FREE_PRIVATE_TERMS_SLUG,
  title: "Free Private Competition Terms",
  subtitle: "Please read and accept before entering a competition funded by {{gameMasterName}}.",
  isSystem: true,
  category: "action_terms",
  showEveryTime: true,
  version: "1",
  requiresLivePage: true,
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "fpc-1",
      type: "heading",
      title: "A competition funded by your Game Master",
      content: "",
      order: 0,
    },
    {
      id: "fpc-2",
      type: "paragraph",
      content:
        "Your entry to this competition is paid by {{gameMasterName}}. You pay nothing to take part.",
      order: 1,
    },
    {
      id: "fpc-3",
      type: "list",
      content:
        "The entry is not credited to your wallet. You receive no Volts that you can spend or withdraw\nYou can only win Volts as a prize, under the competition's normal prize rules\nIf the competition is cancelled, does not reach its minimum number of players, or no one records a valid result, the entry is returned to {{gameMasterName}}, not to you\nAll normal platform rules, fair-play checks and restrictions apply to this competition\nYour acceptance is recorded with the date, this competition and the version of these terms",
      order: 2,
    },
    {
      id: "fpc-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you confirm that you have read and agree to these terms for this competition.",
      order: 3,
    },
  ],
};
