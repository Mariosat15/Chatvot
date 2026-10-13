"use client";

import { useEffect, useState } from "react";

export interface RegistrationGeo {
  restrictedCountries: string[];
  registrationAllowed: boolean;
  message?: string;
}

const OPEN: RegistrationGeo = { restrictedCountries: [], registrationAllowed: true };

/**
 * Restricted countries for the sign-up form. On a failed fetch this falls back to an open
 * list, which is safe because the server action refuses a restricted country regardless.
 */
export function useRegistrationGeo(): RegistrationGeo {
  const [geo, setGeo] = useState<RegistrationGeo>(OPEN);
  useEffect(() => {
    let alive = true;
    fetch("/api/geo/registration-status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<RegistrationGeo> | null) => {
        if (!alive || !data) return;
        setGeo({
          restrictedCountries: Array.isArray(data.restrictedCountries)
            ? data.restrictedCountries
            : [],
          registrationAllowed: data.registrationAllowed !== false,
          message: typeof data.message === "string" ? data.message : undefined,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return geo;
}
