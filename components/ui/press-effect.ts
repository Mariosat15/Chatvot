/**
 * The one press + hand-cursor effect every player-side control uses (owner, 3 Oct 2026:
 * "make them the same when hover and press"; amended 17 Oct 2026: hand on hover + same
 * press on mobile and desktop for every button).
 *
 * Copied from the competition entry buttons in `components/trading/CompetitionEntryButton.tsx`,
 * which were the reference: a 150ms transition and a 5% shrink while pressed. Hover never
 * scales - a button that grows under the cursor and shrinks under the finger moves twice per
 * click, and the two never agreed from one screen to the next. Hover changes colour only
 * (each variant's own `hover:bg-*`, or `ART_BUTTON_HOVER` for an image button).
 *
 * Prefer this constant on any `<button>`, `<Link>` styled as a button, or `role="button"`.
 * `app/globals.css` also applies the same press + hand to native `<button>` elements so a
 * hand-rolled control that forgets the class still behaves.
 */
export const PRESS_EFFECT =
  "cursor-pointer transition-all duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100";

/** Hover/press colour for a button drawn as an image, where there is no `bg-*` to shift. */
export const ART_BUTTON_HOVER = "hover:brightness-125 active:brightness-90";
