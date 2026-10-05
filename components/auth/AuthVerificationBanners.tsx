"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";

type Props = {
  verificationStatus: string | null;
  resendingEmail: boolean;
  onResend: () => void;
};

export default function AuthVerificationBanners({
  verificationStatus,
  resendingEmail,
  onResend,
}: Props) {
  if (!verificationStatus) return null;

  if (verificationStatus === "success") {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
        <p className="text-sm text-green-400">
          Your email has been verified! You can now sign in.
        </p>
      </div>
    );
  }

  if (verificationStatus === "pending") {
    return (
      <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <div className="mb-2 flex items-center gap-3">
          <Mail className="h-5 w-5 shrink-0 text-yellow-500" />
          <p className="text-sm font-medium text-yellow-400">
            Verification email sent!
          </p>
        </div>
        <p className="text-xs text-gray-400">
          Please check your inbox and click the verification link to activate
          your account.
        </p>
      </div>
    );
  }

  if (
    verificationStatus === "needs_verification" ||
    verificationStatus === "expired"
  ) {
    return (
      <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div className="mb-2 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm font-medium text-red-400">
            {verificationStatus === "expired"
              ? "Verification link expired"
              : "Email verification required"}
          </p>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          {verificationStatus === "expired"
            ? "Your verification link has expired. Please request a new one."
            : "Please verify your email before signing in."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResend}
          disabled={resendingEmail}
          className="text-xs"
        >
          {resendingEmail ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-3 w-3" />
              Resend Verification Email
            </>
          )}
        </Button>
      </div>
    );
  }

  return null;
}
