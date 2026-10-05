"use client";

import { createContext, useContext } from "react";

export type AuthBranding = {
  logo: string;
  signInImage: string;
  signUpImage: string;
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
