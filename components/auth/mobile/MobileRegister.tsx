"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountrySelectField } from "@/components/forms/CountrySelectField";
import { PhoneInputField } from "@/components/forms/PhoneInputField";
import CaptchaWidget from "@/components/security/CaptchaWidget";
import AuthTermsAgree from "@/components/auth/AuthTermsAgree";
import MobileAuthShell from "@/components/auth/mobile/MobileAuthShell";
import MobileAuthCard from "@/components/auth/mobile/MobileAuthCard";
import MobileAuthInput from "@/components/auth/mobile/MobileAuthInput";
import MobileInterestSelector from "@/components/auth/mobile/MobileInterestSelector";
import { PASSWORD_REQUIREMENTS } from "@/lib/constants/auth-password";
import { useSignUpForm } from "@/hooks/useSignUpForm";
import { usernameValidation } from "@/components/auth/username-validation";
import type { SignupInterest } from "@/lib/utils/signup-interest";

/**
 * Dedicated mobile registration — one column, one page, same field order as desktop.
 * Reason: the two-step version hid address, city, ZIP, the player-type choice and the terms
 * box behind Continue, and the owner read them as missing (10 Oct 2026).
 */
export default function MobileRegister() {
  const {
    form,
    password,
    passwordStrength,
    showRequirements,
    setShowRequirements,
    captchaToken,
    setCaptchaToken,
    captchaEnabled,
    setCaptchaEnabled,
    termsAccepted,
    setTermsAccepted,
    termsError,
    setTermsError,
    onSubmit,
    referralCode,
  } = useSignUpForm();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const signupInterest = watch("signupInterest") as SignupInterest | undefined;

  const signInHref = referralCode
    ? `/sign-in?ref=${encodeURIComponent(referralCode)}`
    : "/sign-in";

  return (
    <MobileAuthShell
      variant="sign-up"
      title="Join ChartVolt"
      subtitle="Create your account and start competing across trading and games."
    >
      <MobileAuthCard
        title="Create Your Player Account"
        description="Set up your profile, choose what you want to compete in, and get ready to play."
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="relative space-y-3.5"
        >
              <MobileAuthInput
                name="fullName"
                label="Full Name"
                placeholder="John Doe"
                register={register}
                error={errors.fullName}
                validation={{
                  required: "Full name is required",
                  minLength: { value: 2, message: "Name is too short" },
                }}
                autoComplete="name"
              />

              <div>
                <MobileAuthInput
                  name="username"
                  label="Username"
                  placeholder="volt_trader"
                  register={register}
                  error={errors.username}
                  validation={usernameValidation as never}
                  autoComplete="username"
                />
                <p className="mt-1 text-xs text-cyan-100/55">
                  Other players see only your username, never your full name.
                </p>
              </div>

              <MobileAuthInput
                name="email"
                label="Email"
                placeholder="contact@example.com"
                type="email"
                icon="mail"
                autoComplete="email"
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

              <div className="space-y-2">
                <MobileAuthInput
                  name="password"
                  label="Password"
                  placeholder="Enter a strong password"
                  type="password"
                  icon="lock"
                  showPasswordToggle
                  autoComplete="new-password"
                  register={register}
                  error={errors.password}
                  validation={{
                    required: "Password is required",
                    validate: (value: string) =>
                      PASSWORD_REQUIREMENTS.every((req) => req.test(value)) ||
                      "Password does not meet security requirements",
                  }}
                  onFocus={() => setShowRequirements(true)}
                />
                {showRequirements ? (
                  <div className="rounded-xl border border-cyan-400/20 bg-[#06101e]/80 p-3">
                    <p className="mb-2 text-[12px] text-cyan-100/70">
                      Password must contain:
                    </p>
                    <ul className="space-y-1">
                      {PASSWORD_REQUIREMENTS.map((req) => (
                        <li
                          key={req.id}
                          className="flex items-center gap-2 text-[12px]"
                        >
                          {passwordStrength[req.id] ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <X className="h-3 w-3 text-red-500" />
                          )}
                          <span
                            className={
                              passwordStrength[req.id]
                                ? "text-green-400"
                                : "text-cyan-100/60"
                            }
                          >
                            {req.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <MobileAuthInput
                name="confirmPassword"
                label="Confirm Password"
                placeholder="Re-enter your password"
                type="password"
                icon="lock"
                showPasswordToggle
                autoComplete="new-password"
                register={register}
                error={errors.confirmPassword}
                validation={{
                  required: "Please confirm your password",
                  validate: (value: string) =>
                    value === password || "Passwords do not match",
                }}
              />

              {/* Reason: match code trigger and national input to the same
                  fixed 56px height — min-h alone let the number field grow
                  taller than the dial-code button. */}
              <div className="auth-card [&_.form-label]:text-[11px] [&_.form-input]:!h-14 [&_.form-input]:min-h-14 [&_.form-input]:rounded-xl [&_.form-input]:text-[16px] [&_.country-select-trigger]:!h-14 [&_.country-select-trigger]:min-h-14 [&_.country-select-trigger]:rounded-xl [&_.select-trigger]:!h-14">
                <PhoneInputField
                  control={control}
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  countryError={errors.phoneCountry}
                  nationalError={errors.phoneNational}
                  required
                />
              </div>

              <div className="auth-card space-y-1 [&_.form-label]:text-[11px] [&_.form-input]:h-14 [&_.form-input]:rounded-xl [&_.form-input]:text-[16px] [&_.country-select-trigger]:h-14 [&_.country-select-trigger]:rounded-xl [&_.select-trigger]:h-14">
                <CountrySelectField
                  name="country"
                  label="Country"
                  control={
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control as any
                  }
                  error={errors.country}
                  required
                />
              </div>

              <MobileAuthInput
                name="address"
                label="Address"
                placeholder="123 Main Street"
                register={register}
                error={errors.address}
                validation={{ required: "Address is required" }}
                autoComplete="street-address"
              />

              <MobileAuthInput
                name="city"
                label="City"
                placeholder="London"
                register={register}
                error={errors.city}
                validation={{ required: "City is required" }}
                autoComplete="address-level2"
              />

              <MobileAuthInput
                name="postalCode"
                label="ZIP / Postal Code"
                placeholder="SW1A 1AA"
                register={register}
                error={errors.postalCode}
                validation={{ required: "Postal code is required" }}
                autoComplete="postal-code"
              />

              <MobileInterestSelector
                value={signupInterest}
                onChange={(v) =>
                  setValue("signupInterest", v, { shouldValidate: true })
                }
                error={
                  errors.signupInterest
                    ? String(errors.signupInterest.message || "Please pick one")
                    : undefined
                }
              />
              {/* Keep RHF validation wired even though UI is custom cards */}
              <input
                type="hidden"
                {...register("signupInterest", {
                  required: "Please pick one",
                })}
              />

              <AuthTermsAgree
                checked={termsAccepted}
                onChange={(v) => {
                  setTermsAccepted(v);
                  if (v) setTermsError(undefined);
                }}
                error={termsError}
              />

              <CaptchaWidget
                onToken={setCaptchaToken}
                onEnabledChange={setCaptchaEnabled}
              />

              <Button
                type="submit"
                disabled={isSubmitting || (captchaEnabled && !captchaToken)}
                className="yellow-btn mt-1 h-14 w-full text-[15px] font-bold sm:text-[16px]"
              >
                {isSubmitting
                  ? "Creating your account..."
                  : "Create Account & Start Playing"}
              </Button>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[9999px] -top-[9999px] opacity-0"
            tabIndex={-1}
          >
            <label htmlFor="website-mobile">Website (leave blank)</label>
            <input
              {...register("website")}
              type="text"
              id="website-mobile"
              name="website"
              autoComplete="off"
              tabIndex={-1}
            />
          </div>

          <p className="pt-1 text-center text-[13px] text-cyan-100/70">
            Already have an account?{" "}
            <Link
              href={signInHref}
              prefetch
              className="font-semibold text-yellow-300 hover:text-yellow-200"
            >
              Sign in
            </Link>
          </p>
        </form>
      </MobileAuthCard>
    </MobileAuthShell>
  );
}
