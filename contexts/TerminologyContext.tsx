"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { TerminologyPack } from "@/lib/constants/terminology";

/**
 * Delivery of the resolved display vocabulary to player client components (X8, chapter 14).
 *
 * Same contract as `apps/admin/contexts/TerminologyContext.tsx`: the pack is resolved
 * server-side by `getTerms()` and handed in; `useTerms()` THROWS when unmounted rather than
 * answering the defaults. That asymmetry with the server accessor is deliberate — see the
 * admin copy's docblock (R110 / AppSettingsProvider lesson).
 *
 * Mounted in `app/(root)/layout.tsx` around the authenticated shell that owns the sidebar
 * and mobile nav. Auth and landing trees do not need it until a later X8 pass reaches them.
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
 * // Reason: vitest's node environment cannot render hooks; left inside `useTerms` the
 * // refusal is only structurally greppable. Same helper shape as the admin copy.
 */
export function requireTerms(terms: TerminologyPack | null): TerminologyPack {
  if (!terms) {
    throw new Error(
      "useTerms must be used within TerminologyProvider. It is mounted in app/(root)/layout.tsx.",
    );
  }

  return terms;
}

export function useTerms(): TerminologyPack {
  return requireTerms(useContext(TerminologyContext));
}
