"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { TerminologyPack } from "@/lib/constants/terminology";

/**
 * Delivery of the resolved display vocabulary to client components (X6.5, chapter 14).
 *
 * WHY THIS IS NOT PART OF `AppSettingsProvider`, WHICH IS WHAT CHAPTER 14 SPECIFIES.
 * `apps/admin` mounts `AppSettingsProvider` nowhere - `app/layout.tsx` is the app's only
 * layout and wraps `children` in nothing - while nineteen admin components call
 * `useAppSettings()` regardless and silently receive the value handed to `createContext`.
 * They have been reading a hard-coded credit symbol and base currency for as long as they
 * have existed. That is recorded as its own defect and is deliberately not fixed here,
 * because mounting that provider changes what nineteen money-adjacent screens display and
 * has no business riding along in a wording commit. The point for this file is narrower and
 * more important: HAD THE TOKENS BEEN DELIVERED THE WAY THE PLAN SAYS, `useTerms()` would
 * have been correct, tested, probed, and would have returned the defaults on every admin
 * screen for ever.
 *
 * THE HOOK THEREFORE THROWS WHEN NO PROVIDER IS MOUNTED, and that is the opposite direction
 * from `getTerms()` on the server, which deliberately falls back to the defaults. The
 * asymmetry is the lesson above, so do not "fix" it for consistency with the service:
 *
 *   - `getTerms()` fails to the defaults because its failure is a DATABASE read that may
 *     time out under a live screen. Falling back costs one deployment the word "Tournament"
 *     for a moment; refusing would take the screen down for a settings query.
 *   - `useTerms()` refuses because its failure is STRUCTURAL. A missing provider is a static
 *     fact about the component tree, not about data, so it is all renders or none - it
 *     cannot appear in production having passed development. Falling back to the defaults
 *     here is precisely the silence that hid the `useAppSettings` defect, and the one
 *     outcome that must not happen is an operator renaming a token, seeing nothing change,
 *     and concluding the feature is broken when it is the wiring that is absent.
 */
const TerminologyContext = createContext<TerminologyPack | null>(null);

export function TerminologyProvider({
  terms,
  children,
}: {
  /** Resolved server-side by `getTerms()`. Never assembled in the browser. */
  terms: TerminologyPack;
  children: ReactNode;
}) {
  return (
    <TerminologyContext.Provider value={terms}>
      {children}
    </TerminologyContext.Provider>
  );
}

/**
 * The refusal, as a pure function, so that it can be proven rather than asserted about.
 *
 * // Reason: the suite runs in vitest's `node` environment with no `jsdom` and no
 * // `@testing-library/react`, so a hook cannot be rendered. Left inside `useTerms` the
 * // refusal would be pinned only by a structural check - and "the file contains a throw" is
 * // green against a throw that has been made unreachable. Given that the whole reason this
 * // context exists is a provider nobody noticed was unmounted, the property "refuses instead
 * // of quietly answering the defaults" is the last one to leave untested.
 */
export function requireTerms(terms: TerminologyPack | null): TerminologyPack {
  if (!terms) {
    throw new Error(
      "useTerms must be used within TerminologyProvider. It is mounted in apps/admin/app/layout.tsx.",
    );
  }

  return terms;
}

/**
 * The resolved display vocabulary. Every token is present, so a consumer never writes
 * `terms.contest ?? "Competition"` - that fallback would be a second copy of the default
 * living in the browser, which is the "one rule, two copies" shape and the copy that drifts
 * is the one on screen.
 */
export function useTerms(): TerminologyPack {
  return requireTerms(useContext(TerminologyContext));
}
