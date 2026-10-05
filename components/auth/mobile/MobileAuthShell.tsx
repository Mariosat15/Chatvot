"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthBranding } from "@/components/auth/AuthBrandingContext";

type Props = {
  variant: "sign-in" | "sign-up";
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

/**
 * Mobile-only auth shell (md:hidden). Portrait crop + stronger overlay so
 * the form stays readable. Does not reuse desktop positioning.
 */
export default function MobileAuthShell({
  variant,
  title,
  subtitle,
  children,
}: Props) {
  const { logo, signInImage, signUpImage } = useAuthBranding();
  const background = variant === "sign-up" ? signUpImage : signInImage;
  const prefetchSrc = variant === "sign-up" ? signInImage : signUpImage;

  useEffect(() => {
    if (!prefetchSrc || prefetchSrc === background) return;
    const img = new window.Image();
    img.src = prefetchSrc;
  }, [prefetchSrc, background]);

  return (
    <div
      className="auth-page-scroll relative flex min-h-dvh flex-col overflow-x-hidden bg-[#020714] text-white"
      style={{
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={background}
        alt=""
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
          variant === "sign-up"
            ? "object-[center_28%]"
            : "object-[center_35%]"
        }`}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(2,7,20,.55), rgba(2,7,20,.82))",
        }}
      />
      <div className="absolute inset-0 bg-[#020714]/45" />

      <div className="relative z-10 mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4">
        <header className="flex flex-col items-center pt-1 text-center">
          <Link href="/" className="inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="ChartVolt"
              className="h-auto w-[120px] max-w-[135px] object-contain drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]"
            />
          </Link>
          <h1 className="mt-3 text-[28px] font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:text-[32px]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-sm text-[13px] font-medium text-cyan-100/85 sm:text-[14px]">
            {subtitle}
          </p>
        </header>

        <div className="mt-5 flex flex-1 flex-col pb-2">{children}</div>
      </div>
    </div>
  );
}
