/**
 * How wide an admin dialog is, in one definition.
 *
 * WHY THIS EXISTS, AND IT IS NOT TIDINESS: `DialogContent`'s own class list ends with
 * `sm:max-w-lg`, so a dialog that asks for room by writing an UNPREFIXED `max-w-4xl` gets
 * 32rem anyway. Two things have to line up for that to happen and both do:
 *
 *   1. `cn()` is `twMerge`, which keys a conflict on the utility group AND the modifier. A
 *      bare `max-w-4xl` does not conflict with `sm:max-w-lg`, so both reach the DOM.
 *   2. Tailwind emits `.sm\:max-w-lg` after `.max-w-4xl` in the stylesheet, and the two have
 *      equal specificity, so the later one wins at every width from 640px up.
 *
 * The result is a control that appears to work and does nothing: the class is present, the
 * diff reads correctly, and the dialog is 32rem wide. It is why the game catalogue's
 * seven-column table was clipped at the fourth column.
 *
 * // Reason: every token here carries the `sm:` modifier, which is what makes twMerge DROP
 * the base cap rather than sit beside it. A token without the modifier is silently dead, and
 * `__tests__/admin/dialog-widths.test.ts` asserts the removal behaviourally rather than
 * asserting the string, because the string is not the property that matters.
 *
 * The `min(..., calc(100vw - 3rem))` half keeps the gutter the base class provides. One class
 * per token, deliberately, so no second breakpoint can reintroduce an ordering question.
 */

/**
 * Dense screens: data tables, catalogues, anything with more than about four columns.
 *
 * 90rem rather than a viewport percentage so the layout is the same on a 4K monitor as on a
 * laptop, and the table below it is what scrolls if the screen is genuinely too small.
 */
export const DIALOG_WIDTH_WIDE = "sm:max-w-[min(90rem,calc(100vw-3rem))]";

/**
 * Forms with side-by-side fields or explanatory copy beside a control.
 *
 * One width for all of them on purpose. The three game dialogs previously asked for 4xl, 3xl
 * and 2xl, which was three answers to a question nobody had asked - and all three rendered at
 * 32rem regardless, so no operator has ever seen the difference.
 */
export const DIALOG_WIDTH_MEDIUM = "sm:max-w-[min(56rem,calc(100vw-3rem))]";

/**
 * A short form: a handful of stacked fields, a confirmation, a set of credentials.
 *
 * The same 32rem the base class already imposes, which is why the dialogs on it look correct
 * today. It is a token rather than nothing at all so that the intent is written down: a
 * dialog with no width class is one nobody has thought about, and it inherits whatever the
 * shared primitive happens to say next year.
 */
export const DIALOG_WIDTH_STANDARD = "sm:max-w-[min(32rem,calc(100vw-3rem))]";
