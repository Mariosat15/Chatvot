/**
 * The one press effect every player-side button uses (owner, 3 Oct 2026: "make them the same
 * when hover and press ... small press like the buttons in competition").
 *
 * Copied from the competition entry buttons in `components/trading/CompetitionEntryButton.tsx`,
 * which were the reference: a 150ms transition and a 5% shrink while pressed. Hover never
 * scales - a button that grows under the cursor and shrinks under the finger moves twice per
 * click, and the two never agreed from one screen to the next. Hover changes colour only
 * (each variant's own `hover:bg-*`, or `ART_BUTTON_HOVER` for an image button).
 */
export const PRESS_EFFECT =
  "transition-all duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100";

/** Hover/press colour for a button drawn as an image, where there is no `bg-*` to shift. */
export const ART_BUTTON_HOVER = "hover:brightness-125 active:brightness-90";
