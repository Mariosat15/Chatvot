import type { DefaultPage } from "./default-pages";

/** Shown instead of the general marketplace terms when the item is a Game Master package. */
export const GM_PACKAGE_TERMS_SLUG = "terms-gamemaster-package";

/**
 * Game Master Package Terms - what a Game Master buys, and how their commission is paid.
 *
 * Its own file because `default-pages.ts` is past the 500-line limit. A new slug rather than a
 * rewrite of `terms-marketplace`, because the seed only inserts MISSING pages: a new slug
 * reaches every existing database on the next start, a reworded one would reach none.
 *
 * Reason (legal opinion, Game Master model): the commission must read as a commercial payment
 * by ChartVolt, the issuer of Volts, out of ChartVolt's own fee under a written agreement -
 * never as a Game Master accepting Volts from players. Every acceptance is recorded by
 * `/api/terms-acceptance`, which is the written agreement's audit trail.
 */
export const GM_PACKAGE_TERMS_PAGE: DefaultPage = {
  slug: GM_PACKAGE_TERMS_SLUG,
  title: "Game Master Package Terms",
  subtitle: "Please read and accept before buying a Game Master package.",
  isSystem: true,
  category: "action_terms",
  showEveryTime: true,
  version: "1",
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "agp-1",
      type: "heading",
      title: "Game Master Agreement",
      content: "",
      order: 0,
    },
    {
      id: "agp-2",
      type: "paragraph",
      content:
        "By buying this package you enter into a written Game Master Agreement with ChartVolt on the terms below. Your acceptance is recorded with the date, time and wording version, and that record forms part of the agreement.",
      order: 1,
    },
    {
      id: "agp-3",
      type: "heading",
      title: "What you are buying",
      content: "",
      order: 2,
    },
    {
      id: "agp-4",
      type: "list",
      content:
        "A licence to use ChartVolt's Game Master tools for the package period shown - your referral link, your Game Master profile and, where the package allows it, creating competitions\nThe package is a service supplied by ChartVolt. Its price is deducted from your wallet when you buy it\nThe package is personal to you and cannot be resold or transferred\nOnce the package is activated the purchase is final, except where applicable law requires a refund",
      order: 3,
    },
    {
      id: "agp-5",
      type: "heading",
      title: "How your commission is paid",
      content: "",
      order: 4,
    },
    {
      id: "agp-6",
      type: "list",
      content:
        "Your commission is paid by ChartVolt, out of ChartVolt's own platform fee, under this written agreement\nIt is a commercial payment from ChartVolt, the issuer of Volts, to you as its commercial partner. It is not a payment to you from players\nYou do not accept Volts from players or anyone else as payment for goods or services. Players pay their entry fees to ChartVolt, never to you\nPlayers you refer pay exactly the same entry fees and win exactly the same prizes as every other player. Your commission costs them nothing\nCommission is calculated only on settled competitions and challenges, at the rate shown for your package, which may be zero\nChartVolt may withhold or reverse commission connected to fraud, collusion, self-referral or a breach of these terms",
      order: 5,
    },
    {
      id: "agp-7",
      type: "heading",
      title: "Your position",
      content: "",
      order: 6,
    },
    {
      id: "agp-8",
      type: "list",
      content:
        "You act as an independent commercial partner, not as ChartVolt's employee or agent, and you may not make promises on ChartVolt's behalf\nYou are responsible for any tax due on your commission\nYou must not offer players anything that improves their score or ranking in a paid contest, or any randomised reward",
      order: 7,
    },
    {
      id: "agp-9",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you agree to the Game Master Agreement above and authorise ChartVolt to deduct the package price from your wallet.",
      order: 8,
    },
  ],
};
