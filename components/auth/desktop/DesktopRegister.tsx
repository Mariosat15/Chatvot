"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import { CountrySelectField } from "@/components/forms/CountrySelectField";
import { PhoneInputField } from "@/components/forms/PhoneInputField";
import CaptchaWidget from "@/components/security/CaptchaWidget";
import AuthTermsAgree from "@/components/auth/AuthTermsAgree";
import DesktopAuthShell from "@/components/auth/desktop/DesktopAuthShell";
import { PASSWORD_REQUIREMENTS } from "@/lib/constants/auth-password";
import { SIGNUP_INTEREST_OPTIONS } from "@/lib/utils/signup-interest";
import { useSignUpForm } from "@/hooks/useSignUpForm";
import { usernameValidation } from "@/components/auth/username-validation";

/** Desktop registration — two-column grid; mobile uses MobileRegister. */
export default function DesktopRegister() {
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

  const signInHref = referralCode
    ? `/sign-in?ref=${encodeURIComponent(referralCode)}`
    : "/sign-in";

  return (
    <DesktopAuthShell variant="sign-up">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Sign Up</h2>
        <p className="mt-1 text-sm text-cyan-100/70">
          Join thousands of traders and gamers competing on ChartVolt.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <InputField
              name="fullName"
              label="Full Name"
              placeholder="John Doe"
              register={register}
              error={errors.fullName}
              validation={{ required: "Full name is required", minLength: 2 }}
            />
          </div>

          <div className="sm:col-span-2">
            <InputField
              name="username"
              label="Username"
              placeholder="volt_trader"
              register={register}
              error={errors.username}
              validation={usernameValidation}
            />
            <p className="mt-1 text-xs text-cyan-100/55">
              Other players see only your username, never your full name.
            </p>
          </div>

          <div className="sm:col-span-2">
            <InputField
              name="email"
              label="Email"
              placeholder="contact@example.com"
              register={register}
              error={errors.email}
              validation={{
                required: "Email is required",
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Valid email address is required",
              }}
            />
          </div>

          <div className="space-y-2">
            <InputField
              name="password"
              label="Password"
              placeholder="Enter a strong password"
              type="password"
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
            {showRequirements && (
              <div className="rounded-lg border border-cyan-400/20 bg-[#06101e]/80 p-3">
                <p className="mb-2 text-xs text-cyan-100/70">
                  Password must contain:
                </p>
                <ul className="space-y-1">
                  {PASSWORD_REQUIREMENTS.map((req) => (
                    <li key={req.id} className="flex items-center gap-2 text-xs">
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
            )}
          </div>

          <InputField
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Re-enter your password"
            type="password"
            register={register}
            error={errors.confirmPassword}
            validation={{
              required: "Please confirm your password",
              validate: (value: string) =>
                value === password || "Passwords do not match",
            }}
          />

          <div className="sm:col-span-2">
            <PhoneInputField
              control={control}
              register={register}
              setValue={setValue}
              watch={watch}
              countryError={errors.phoneCountry}
              nationalError={errors.phoneNational}
              required
              layout="split"
            />
          </div>

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

          <InputField
            name="address"
            label="Address"
            placeholder="123 Main Street"
            register={register}
            error={errors.address}
            validation={{ required: "Address is required" }}
          />

          <InputField
            name="city"
            label="City"
            placeholder="London"
            register={register}
            error={errors.city}
            validation={{ required: "City is required" }}
          />

          <InputField
            name="postalCode"
            label="ZIP Code"
            placeholder="SW1A 1AA"
            register={register}
            error={errors.postalCode}
            validation={{ required: "Postal code is required" }}
          />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] -top-[9999px] opacity-0"
          tabIndex={-1}
        >
          <label htmlFor="website-desktop">Website (leave blank)</label>
          <input
            {...register("website")}
            type="text"
            id="website-desktop"
            name="website"
            autoComplete="off"
            tabIndex={-1}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-white">
            What kind of player are you?
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SIGNUP_INTEREST_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-cyan-300/25 bg-[#06101e]/70 px-3 py-2.5 has-[:checked]:border-yellow-400/80 has-[:checked]:bg-yellow-400/10"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    value={opt.value}
                    className="accent-yellow-400"
                    {...register("signupInterest", {
                      required: "Please pick one",
                    })}
                  />
                  <span className="text-sm font-medium text-white">
                    {opt.label}
                  </span>
                </span>
                <span className="pl-6 text-xs text-cyan-100/60">{opt.hint}</span>
              </label>
            ))}
          </div>
          {errors.signupInterest && (
            <p className="text-xs text-red-400">
              {String(errors.signupInterest.message || "Please pick one")}
            </p>
          )}
        </fieldset>

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
          className="yellow-btn mt-2 w-full"
        >
          {isSubmitting ? "Creating Account" : "Create Account"}
        </Button>

        <p className="pt-2 text-center text-sm text-cyan-100/70">
          Already have an account?{" "}
          <Link
            href={signInHref}
            prefetch
            className="font-semibold text-yellow-300 hover:text-yellow-200"
          >
            Sign In
          </Link>
        </p>
      </form>
    </DesktopAuthShell>
  );
}
