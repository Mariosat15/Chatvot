"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type AuthTermsAgreeProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  className?: string;
};

/** Terms checkbox with real /terms and /privacy links. */
export default function AuthTermsAgree({
  checked,
  onChange,
  error,
  className = "",
}: AuthTermsAgreeProps) {
  return (
    <div
      className={cn(
        // Reason: cyan-100/75 was invisible on the dark mobile card; keep the
        // body readable and the legal links high-contrast yellow.
        "rounded-xl border border-cyan-400/25 bg-[#06101e]/70 px-3 py-3",
        className,
      )}
    >
      <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-snug text-cyan-50 sm:text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-cyan-300/60 accent-yellow-400"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
            onClick={(e) => e.stopPropagation()}
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
