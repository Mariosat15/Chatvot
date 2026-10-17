import type { DefaultPage, DefaultPageSection } from "./default-pages";

/**
 * The wording every database was seeded with before 13 Oct 2026 - trading-only, and silent on
 * the fairness rules players already benefit from.
 *
 * Reason: kept verbatim so the seed can recognise a page nobody has edited and upgrade it
 * (`upgradeableSystemPage` in `site-page-seed.service.ts`). A page an operator has reworded
 * never matches this and is left alone - R11, counsel owns live wording.
 */
export const COMPETITION_ENTRY_TERMS_V0_SECTIONS: DefaultPageSection[] = [
  {
    id: "ace-1",
    type: "heading",
    title: "Competition Entry Agreement",
    content: "",
    order: 0,
  },
  {
    id: "ace-2",
    type: "paragraph",
    content:
      "By entering this competition, you acknowledge and agree to the following terms. Competitions involve simulated trading with virtual capital. Entry fees are non-refundable once the competition begins.",
    order: 1,
  },
  {
    id: "ace-3",
    type: "list",
    content:
      "Entry fees are deducted from your credit wallet and are non-refundable once the competition starts\nAll trading within competitions is simulated — no real financial instruments are traded\nThe platform reserves the right to disqualify participants for rule violations, collusion, or exploitation\nPrize distribution follows the competition rules defined at the time of creation\nMargin calls and liquidation may apply — resulting in disqualification and loss of entry fee\nResults and rankings are final as determined by the platform's scoring system",
    order: 2,
  },
  {
    id: "ace-4",
    type: "paragraph",
    content:
      "By clicking 'I Accept', you agree to the competition rules, accept the risk of losing your entry fee, and acknowledge that results are final.",
    order: 3,
  },
];

/**
 * Competition Entry Terms, version 1 - game-neutral, and publishing the fairness rules
 * (legal opinion: identical content, no paid advantages, no mystery packs, minimum two
 * players, refunds). Every sentence states behaviour the platform already enforces:
 * `minParticipants` defaults to 2 and auto-cancels with full refunds, `supportsContentSeed`
 * is a publish gate (R53), the marketplace sells nothing that improves a paid score, and the
 * unscored-player rule is the contest's `unscoredContestPolicy` (`05` s9.3).
 */
export const COMPETITION_ENTRY_TERMS_PAGE: DefaultPage = {
  slug: "terms-competition-entry",
  title: "Competition Entry Terms",
  subtitle: "Please read and accept before entering this competition.",
  isSystem: true,
  category: "action_terms",
  version: "1",
  replacesUneditedSections: [COMPETITION_ENTRY_TERMS_V0_SECTIONS],
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "ace-1",
      type: "heading",
      title: "Competition Entry Agreement",
      content: "",
      order: 0,
    },
    {
      id: "ace-2",
      type: "paragraph",
      content:
        "By entering this competition, you agree to the terms below and to the rules shown on the competition page. Winning depends on how well you play, never on chance.",
      order: 1,
    },
    {
      id: "ace-5",
      type: "heading",
      title: "Our fairness rules",
      content: "",
      order: 2,
    },
    {
      id: "ace-6",
      type: "list",
      content:
        "Identical content for every entrant: every player in a competition plays the same game content under the same rules and clock - in a game, the same track, board or puzzle set; in trading, the same starting capital and the same market prices\nNo paid advantages: nothing sold on ChartVolt can improve your score or ranking in a paid competition. No extra time, retries, hints, skips or easier content are for sale\nNo mystery packs: ChartVolt never sells random or mystery rewards of any kind\nMinimum two players: no paid competition is ever single-player. If fewer players than the competition's minimum (never fewer than two) have entered when it is due to start, it is cancelled and every entry fee is refunded in full\nThe same terms for everyone: players referred by a Game Master pay the same entry fees and win the same prizes as everyone else",
      order: 3,
    },
    {
      id: "ace-7",
      type: "heading",
      title: "Refunds",
      content: "",
      order: 4,
    },
    {
      id: "ace-8",
      type: "list",
      content:
        "If ChartVolt cancels a competition, before or after it starts, every entry fee is refunded in full\nA fault during a single round does not cancel the competition: the competition's published rule for unfinished rounds applies\nOnce the competition has started, entry fees are otherwise non-refundable\nIf you enter but record no score, the rule the organiser set when the competition was created applies: your fee is either refunded less the platform fee, or stays in the prize pool\nIf you are disqualified for breaking the rules - collusion, multiple accounts, exploiting a fault, or, in trading, liquidation - you receive no refund and no prize",
      order: 5,
    },
    {
      id: "ace-3",
      type: "heading",
      title: "Results",
      content: "",
      order: 6,
    },
    {
      id: "ace-9",
      type: "list",
      content:
        "Entry fees are deducted from your wallet when you enter\nPrizes are paid as shown on the competition page, after the competition is settled\nIn trading competitions all trading is simulated - no real financial instruments are traded\nRankings are decided by the competition's published scoring rule and are final once settled",
      order: 7,
    },
    {
      id: "ace-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you agree to these terms and the competition's rules, accept the risk of losing your entry fee, and acknowledge that settled results are final.",
      order: 8,
    },
  ],
};
