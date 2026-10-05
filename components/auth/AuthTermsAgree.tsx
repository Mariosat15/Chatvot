"use client";

import Link from "next/link";

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
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-cyan-100/75 sm:text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-yellow-400"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-yellow-300 underline-offset-2 hover:text-yellow-200 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-yellow-300 underline-offset-2 hover:text-yellow-200 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
