"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_REQUIREMENTS } from "@/lib/constants/auth-password";

type Status = {
  valid: boolean;
  requiresTwoFactor: boolean;
  twoFactorVerified: boolean;
};

/** Shared reset-password form — password + optional 2FA step. */
export default function ResetPasswordForm({
  dense = false,
}: {
  dense?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const urlError = searchParams.get("error");

  const [status, setStatus] = useState<Status | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying2fa, setVerifying2fa] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setStatus({
          valid: false,
          requiresTwoFactor: false,
          twoFactorVerified: false,
        });
        setLoadingStatus(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/auth/password-reset/status?token=${encodeURIComponent(token)}`,
        );
        const data = (await res.json().catch(() => ({}))) as Status;
        if (!cancelled) {
          setStatus({
            valid: Boolean(data.valid),
            requiresTwoFactor: Boolean(data.requiresTwoFactor),
            twoFactorVerified: Boolean(data.twoFactorVerified),
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({
            valid: false,
            requiresTwoFactor: false,
            twoFactorVerified: false,
          });
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const passwordStrength = Object.fromEntries(
    PASSWORD_REQUIREMENTS.map((req) => [req.id, req.test(password)]),
  ) as Record<string, boolean>;

  const inputClass = dense
    ? "h-14 rounded-xl border-cyan-400/25 bg-[#06101e] text-[16px] text-white"
    : "form-input";

  const verifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      toast.error("Enter your authenticator or backup code.");
      return;
    }
    setVerifying2fa(true);
    try {
      const res = await fetch("/api/auth/password-reset/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: twoFactorCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Could not verify the code.");
        return;
      }
      setStatus((prev) =>
        prev
          ? { ...prev, twoFactorVerified: true }
          : {
              valid: true,
              requiresTwoFactor: true,
              twoFactorVerified: true,
            },
      );
      toast.success("Verified. Choose a new password.");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setVerifying2fa(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PASSWORD_REQUIREMENTS.every((req) => req.test(password))) {
      toast.error("Password does not meet security requirements.");
      return;
    }
    // Reason: client UX only — the confirm API re-checks password rules; a
    // timing-safe compare here does not protect a secret.
    // eslint-disable-next-line security/detect-possible-timing-attacks -- form UX
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (data?.code === "TWO_FACTOR_REQUIRED") {
          setStatus((prev) =>
            prev
              ? { ...prev, requiresTwoFactor: true, twoFactorVerified: false }
              : {
                  valid: true,
                  requiresTwoFactor: true,
                  twoFactorVerified: false,
                },
          );
        }
        toast.error(
          data?.error || "Could not reset password. Please try again.",
        );
        return;
      }
      toast.success(data.message || "Password updated.");
      router.push("/sign-in");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <p className="text-sm text-cyan-100/70">Checking your reset link…</p>
    );
  }

  if (urlError === "INVALID_TOKEN" || !status?.valid) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-cyan-50">
          This reset link is invalid or has expired. Request a new one from the
          sign-in page.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block font-semibold text-yellow-300 hover:text-yellow-200"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (status.requiresTwoFactor && !status.twoFactorVerified) {
    return (
      <form onSubmit={verifyTwoFactor} className="space-y-4">
        <p className="text-sm leading-relaxed text-cyan-50">
          This account has two-factor authentication enabled. Enter a code from
          your authenticator app (or a backup code) before choosing a new
          password.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="reset-2fa" className="text-cyan-100/80">
            Authentication code
          </Label>
          <Input
            id="reset-2fa"
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <Button
          type="submit"
          disabled={verifying2fa}
          className={`yellow-btn w-full font-bold ${dense ? "h-14 text-[16px]" : ""}`}
        >
          {verifying2fa ? "Verifying..." : "Verify and Continue"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-password" className="text-cyan-100/80">
          New password
        </Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="rounded-xl border border-cyan-400/20 bg-[#06101e]/80 p-3">
        <ul className="space-y-1">
          {PASSWORD_REQUIREMENTS.map((req) => (
            <li key={req.id} className="flex items-center gap-2 text-[12px]">
              {passwordStrength[req.id] ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-red-500" />
              )}
              <span
                className={
                  passwordStrength[req.id] ? "text-green-400" : "text-cyan-100/60"
                }
              >
                {req.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm" className="text-cyan-100/80">
          Confirm password
        </Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className={`yellow-btn w-full font-bold ${dense ? "h-14 text-[16px]" : ""}`}
      >
        {submitting ? "Updating..." : "Set New Password"}
      </Button>

      <p className="text-center text-sm text-cyan-100/70">
        <Link
          href="/sign-in"
          className="font-semibold text-yellow-300 hover:text-yellow-200"
        >
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}
