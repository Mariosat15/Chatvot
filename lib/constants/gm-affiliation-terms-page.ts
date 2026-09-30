import type { DefaultPage } from "./default-pages";
import { GM_AFFILIATION_TERMS_SLUG } from "../services/gamemaster/gm-terms-rules";

/**
 * The Gamemaster Affiliation Terms (`External game plans/24` s5.1).
 *
 * Its own file because `default-pages.ts` is past the 500-line limit. Seeded once as
 * version "1"; after that it is Site Pages CMS copy (R11 - reword after counsel, never by a
 * deploy-time edit here, because the seed never overwrites an existing page).
 *
 * `{{gameMasterName}}` is filled in by the dialog. `requiresLivePage` keeps this page out of
 * the public route's built-in fallback: a player may only consent to wording that exists as
 * a versioned database page.
 */
export const GM_AFFILIATION_TERMS_PAGE: DefaultPage = {
  slug: GM_AFFILIATION_TERMS_SLUG,
  title: "Gamemaster Affiliation Terms",
  subtitle: "Please read and accept before joining {{gameMasterName}}.",
  isSystem: true,
  category: "action_terms",
  showEveryTime: false,
  version: "1",
  requiresLivePage: true,
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "agm-1",
      type: "heading",
      title: "Joining a Game Master",
      content: "",
      order: 0,
    },
    {
      id: "agm-2",
      type: "paragraph",
      content:
        "By accepting, you become affiliated with {{gameMasterName}}. Please read what that means before you continue.",
      order: 1,
    },
    {
      id: "agm-3",
      type: "list",
      content:
        "Your affiliation is permanent. You cannot leave or switch to another Game Master yourself; only platform support can reassign you\n{{gameMasterName}} earns a share of the platform fee from the competitions and challenges you enter. This costs you nothing extra: your entry fees and prizes are exactly the same as for any other player\n{{gameMasterName}} will be able to see your name, email address and country\nYou will get access to {{gameMasterName}}'s private competitions\nIf {{gameMasterName}}'s Game Master membership ends or is removed, you will be free to join another Game Master",
      order: 2,
    },
    {
      id: "agm-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you confirm that you have read and agree to these terms and consent to your name, email address and country being shared with {{gameMasterName}}.",
      order: 3,
    },
  ],
};
