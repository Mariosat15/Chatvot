"use client";

import { Mail } from "lucide-react";
import { useAuthBranding } from "@/components/auth/AuthBrandingContext";

/** "Need help?" line with the company support email, shared by desktop and mobile sign-in. */
export default function AuthSupportContact({ className = "" }: { className?: string }) {
  const { supportEmail } = useAuthBranding();
  if (!supportEmail) return null;

  return (
    <p
      className={`flex flex-wrap items-center justify-center gap-1.5 text-center text-[13px] text-cyan-100/70 ${className}`}
    >
      <Mail className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
      <span>Need help? Contact us at</span>
      <a
        href={`mailto:${supportEmail}`}
        className="break-all font-semibold text-yellow-300 hover:text-yellow-200"
      >
        {supportEmail}
      </a>
    </p>
  );
}
