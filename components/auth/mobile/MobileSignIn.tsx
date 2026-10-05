"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthVerificationBanners from "@/components/auth/AuthVerificationBanners";
import AuthSupportContact from "@/components/auth/AuthSupportContact";
import MobileAuthShell from "@/components/auth/mobile/MobileAuthShell";
import MobileAuthCard from "@/components/auth/mobile/MobileAuthCard";
import MobileAuthInput from "@/components/auth/mobile/MobileAuthInput";
import MobileFeatureChips from "@/components/auth/mobile/MobileFeatureChips";
import { useSignInForm } from "@/hooks/useSignInForm";
import { useSearchParams } from "next/navigation";

/** Dedicated mobile sign-in — not a shrunk desktop form. */
export default function MobileSignIn() {
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") || undefined;
  const {
    form,
    verificationStatus,
    resendingEmail,
    handleResendVerification,
    onSubmit,
    rememberMe,
    setRememberMe,
  } = useSignInForm();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const signUpHref = referralCode
    ? `/sign-up?ref=${encodeURIComponent(referralCode)}`
    : "/sign-up";

  return (
    <MobileAuthShell
      variant="sign-in"
      title="Welcome Back, Challenger"
      subtitle="Trade. Play. Compete. Conquer."
    >
      <MobileAuthCard
        title="Jump Back In"
        description="Sign in and pick up where you left off — join competitions, challenge players and keep climbing the leaderboard."
      >
        <AuthVerificationBanners
          verificationStatus={verificationStatus}
          resendingEmail={resendingEmail}
          onResend={handleResendVerification}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <MobileAuthInput
            name="email"
            label="Email"
            placeholder="contact@example.com"
            type="email"
            icon="mail"
            autoComplete="username"
            register={register}
            error={errors.email}
            validation={{
              required: "Email is required",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Please enter a valid email.",
              },
            }}
          />

          <MobileAuthInput
            name="password"
            label="Password"
            placeholder="Enter your password"
            type="password"
            icon="lock"
            showPasswordToggle
            autoComplete="current-password"
            register={register}
            error={errors.password}
            validation={{
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters",
              },
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <label className="inline-flex cursor-pointer items-center gap-2 text-cyan-100/85">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-cyan-400/40 accent-yellow-400"
              />
              Keep me signed in
            </label>
            <Link
              href="/forgot-password"
              className="font-medium text-yellow-300 hover:text-yellow-200"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="yellow-btn mt-1 h-14 w-full text-[16px] font-bold"
          >
            {isSubmitting ? (
              "Signing in..."
            ) : (
              <span className="inline-flex items-center gap-2">
                Enter ChartVolt
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            )}
          </Button>

          <p className="pt-2 text-center text-[13px] text-cyan-100/70">
            New to ChartVolt?{" "}
            <Link
              href={signUpHref}
              prefetch
              className="font-semibold text-yellow-300 hover:text-yellow-200"
            >
              Create your account
            </Link>
          </p>
          <AuthSupportContact className="border-t border-cyan-400/15 pt-3" />
        </form>
      </MobileAuthCard>

      <MobileFeatureChips />
    </MobileAuthShell>
  );
}
