"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import AuthVerificationBanners from "@/components/auth/AuthVerificationBanners";
import DesktopAuthShell from "@/components/auth/desktop/DesktopAuthShell";
import { useSignInForm } from "@/hooks/useSignInForm";

/** Desktop sign-in form — look locked to the owner mockup. */
export default function DesktopSignIn() {
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
    <DesktopAuthShell variant="sign-in">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Sign In</h2>
        <p className="mt-1 text-sm text-cyan-100/70">
          Access your account and continue trading, playing and competing.
        </p>
      </div>

      <AuthVerificationBanners
        verificationStatus={verificationStatus}
        resendingEmail={resendingEmail}
        onResend={handleResendVerification}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          name="email"
          label="Email"
          placeholder="contact@example.com"
          type="email"
          autoComplete="username"
          register={register}
          error={errors.email}
          validation={{
            required: "Email is required",
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          }}
        />

        <InputField
          name="password"
          label="Password"
          placeholder="Enter your password"
          type="password"
          autoComplete="current-password"
          register={register}
          error={errors.password}
          validation={{ required: "Password is required", minLength: 8 }}
        />

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-cyan-100/80">
            <input
              type="checkbox"
              name="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-cyan-400/40 accent-yellow-400"
            />
            Remember me
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
          className="yellow-btn mt-2 w-full"
        >
          {isSubmitting ? "Signing In" : "Sign In"}
        </Button>

        <p className="pt-3 text-center text-sm text-cyan-100/70">
          Don&apos;t have an account?{" "}
          <Link
            href={signUpHref}
            prefetch
            className="font-semibold text-yellow-300 hover:text-yellow-200"
          >
            Create an account
          </Link>
        </p>
      </form>
    </DesktopAuthShell>
  );
}
