"use client";

import { createContext, useContext } from "react";
import type { AuthFeaturePill } from "@/lib/constants/auth-feature-pills";

export type AuthBranding = {
  logo: string;
  signInImage: string;
  signUpImage: string;
  // Icon slugs, not components: this value crosses from the server layout.
  featurePills: AuthFeaturePill[];
};

const AuthBrandingContext = createContext<AuthBranding | null>(null);

export function AuthBrandingProvider({
  value,
  children,
}: {
  value: AuthBranding;
  children: React.ReactNode;
}) {
  return (
    <AuthBrandingContext.Provider value={value}>
      {children}
    </AuthBrandingContext.Provider>
  );
}

export function useAuthBranding(): AuthBranding {
  const ctx = useContext(AuthBrandingContext);
  if (!ctx) {
    throw new Error("useAuthBranding must be used inside AuthBrandingProvider");
  }
  return ctx;
}
