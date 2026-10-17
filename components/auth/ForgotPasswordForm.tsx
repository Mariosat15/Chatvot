"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shared forgot-password form used by desktop and mobile shells. */
export default function ForgotPasswordForm({
  dense = false,
}: {
  dense?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(
          data?.error || "Something went wrong. Please contact support.",
        );
        return;
      }
      setSent(true);
      toast.success(
        data.message ||
          "If this email exists in our system, check your inbox for a reset link.",
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-cyan-50">
          If an account exists for{" "}
          <span className="font-semibold text-yellow-300">{email.trim()}</span>,
          we sent a password reset link. Check your inbox and spam folder.
        </p>
        <p className="text-sm text-cyan-100/70">
          The link expires in one hour. If you have two-factor authentication
          enabled, you will need your authenticator code after opening the link.
        </p>
        <Link
          href="/sign-in"
          className="inline-block font-semibold text-yellow-300 hover:text-yellow-200"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email" className="text-cyan-100/80">
          Email
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@example.com"
          className={
            dense
              ? "h-14 rounded-xl border-cyan-400/25 bg-[#06101e] text-[16px] text-white"
              : "form-input"
          }
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className={`yellow-btn w-full font-bold ${dense ? "h-14 text-[16px]" : ""}`}
      >
        {submitting ? "Sending..." : "Send Reset Link"}
      </Button>

      <p className="text-center text-sm text-cyan-100/70">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="font-semibold text-yellow-300 hover:text-yellow-200"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
