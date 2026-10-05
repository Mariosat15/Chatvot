"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Trophy, Swords, BarChart3, Gift } from "lucide-react";

export const AUTH_SIGN_IN_PILLS = [
  { label: "AI Markets Simulation", icon: BarChart3 },
  { label: "Skill Games & Puzzles", icon: Gamepad2 },
  { label: "Competitions & Tournaments", icon: Swords },
  { label: "Live Leaderboards", icon: Trophy },
  { label: "Exciting Rewards", icon: Gift },
] as const;

interface AuthShellProps {
  logo: string;
  signInImage: string;
  signUpImage: string;
  children: React.ReactNode;
}

/**
 * Full-bleed login/register shell matching the owner mockup (5 Oct 2026).
 * Background comes from Branding (or the shipped defaults). The painted
 * mockup is the layout reference — forms are real HTML, not baked into art.
 */
export default function AuthShell({
  logo,
  signInImage,
  signUpImage,
  children,
}: AuthShellProps) {
  const pathname = usePathname() || "";
  const isSignUp = pathname.includes("sign-up");
  const background = isSignUp ? signUpImage : signInImage;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050814] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={background}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,8,20,0.25),rgba(5,8,20,0.72))]" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-6 sm:px-8">
        <header className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="ChartVolt"
              className="h-14 w-auto max-w-[220px] object-contain drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]"
            />
          </Link>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)] sm:text-5xl">
            {isSignUp ? "Create Your Account" : "Welcome Back"}
          </h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-cyan-100/90 sm:text-base">
            {isSignUp
              ? "Join the ultimate platform for trading and gaming competitions"
              : "Trade. Play. Compete. Conquer."}
          </p>
        </header>

        <div className="mx-auto flex w-full flex-1 items-start justify-center py-6 sm:items-center">
          <div
            className={`auth-card w-full rounded-3xl border border-cyan-300/35 bg-[#071226]/78 p-5 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-xl sm:p-7 ${
              isSignUp ? "max-w-3xl" : "max-w-md"
            }`}
          >
            {children}
          </div>
        </div>

        {!isSignUp && (
          <ul className="mx-auto mt-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 pb-2 sm:gap-3">
            {AUTH_SIGN_IN_PILLS.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-[#081428]/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.2)] sm:text-[11px]"
              >
                <Icon className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
