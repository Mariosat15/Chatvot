"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthBranding } from "@/components/auth/AuthBrandingContext";
import { AUTH_PILL_ICONS } from "@/lib/constants/auth-feature-pills";

type Props = {
  variant: "sign-in" | "sign-up";
  children: React.ReactNode;
};

/**
 * Desktop-only auth shell. Hidden below md — mobile uses MobileAuthShell.
 * Prefetches the opposite page's background so Sign In ↔ Sign Up feels instant.
 */
export default function DesktopAuthShell({ variant, children }: Props) {
  const { logo, signInImage, signUpImage, featurePills } = useAuthBranding();
  const isSignUp = variant === "sign-up";
  const background = isSignUp ? signUpImage : signInImage;
  const prefetchSrc = isSignUp ? signInImage : signUpImage;

  // Reason: layout already has both URLs; warming the next image avoids a
  // blank flash when the user taps "Already have an account?".
  useEffect(() => {
    if (!prefetchSrc || prefetchSrc === background) return;
    const img = new window.Image();
    img.src = prefetchSrc;
  }, [prefetchSrc, background]);

  return (
    <div className="auth-page-scroll relative min-h-dvh overflow-x-hidden bg-[#050814] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={background}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,8,20,0.3),rgba(5,8,20,0.78))]" />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 flex min-h-dvh flex-col px-4 py-5 sm:px-8 sm:py-6">
        <header className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="ChartVolt"
              className="h-14 w-auto max-w-[220px] object-contain drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]"
            />
          </Link>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)] sm:mt-4 sm:text-5xl">
            {isSignUp ? "Create Your Account" : "Welcome Back"}
          </h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-cyan-100/90 sm:text-base">
            {isSignUp
              ? "Join the ultimate platform for trading and gaming competitions"
              : "Trade. Play. Compete. Conquer."}
          </p>
        </header>

        <div className="mx-auto flex w-full flex-1 items-start justify-center py-5 sm:items-center sm:py-6">
          <div
            className={`auth-card w-full rounded-3xl border border-cyan-300/35 bg-[#071226]/85 p-5 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-xl sm:p-7 ${
              isSignUp ? "max-w-3xl" : "max-w-md"
            }`}
          >
            {children}
          </div>
        </div>

        {!isSignUp && featurePills.length > 0 && (
          <ul className="mx-auto mt-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 pb-2 sm:gap-3">
            {featurePills.map(({ label, icon }, index) => {
              const Icon = AUTH_PILL_ICONS.get(icon);
              return (
                <li
                  key={`${index}-${label}`}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-[#081428]/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-50 sm:text-[11px]"
                >
                  {Icon && (
                    <Icon className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                  )}
                  {label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
