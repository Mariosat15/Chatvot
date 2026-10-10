"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signUpWithEmail } from "@/lib/actions/auth.actions";
import { useDeviceFingerprint } from "@/hooks/useDeviceFingerprint";
import {
  PASSWORD_REQUIREMENTS,
  passwordMeetsRequirements,
} from "@/lib/constants/auth-password";

export type ExtendedSignUpFormData = SignUpFormData & {
  website?: string;
};

export function useSignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { track: trackFingerprint } = useDeviceFingerprint({ auto: false });
  const [passwordStrength, setPasswordStrength] = useState<
    Record<string, boolean>
  >({});
  const [showRequirements, setShowRequirements] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | undefined>();
  const formStartTime = useRef(Date.now());

  // Reason: GM referral must survive the sign-up → sign-in hop.
  // Read from the URL once and keep in memory.
  const referralCode = searchParams.get("ref") || undefined;

  const form = useForm<ExtendedSignUpFormData>({
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      country: "",
      phoneCountry: "",
      phoneNational: "",
      address: "",
      city: "",
      postalCode: "",
      website: "",
      signupInterest: undefined,
    },
    mode: "onBlur",
  });

  const password = form.watch("password");

  useEffect(() => {
    const strength: Record<string, boolean> = {};
    PASSWORD_REQUIREMENTS.forEach((req) => {
      strength[req.id] = req.test(password || "");
    });
    setPasswordStrength(strength);
  }, [password]);

  const onSubmit = async (data: ExtendedSignUpFormData) => {
    if (!termsAccepted) {
      setTermsError(
        "You must accept the Terms of Service and Privacy Policy.",
      );
      toast.error("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    setTermsError(undefined);

    if (data.website && data.website.trim().length > 0) {
      toast.error("Registration failed. Please try again.");
      return;
    }

    const fillTime = Date.now() - formStartTime.current;
    if (fillTime < 3000) {
      toast.error("Please take your time filling out the form.");
      return;
    }

    if (!passwordMeetsRequirements(data.password)) {
      toast.error("Password does not meet security requirements");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      toast.error("Please complete the verification challenge.");
      return;
    }

    try {
      const result = await signUpWithEmail({
        ...data,
        honeypot: data.website,
        referralCode,
        captchaToken: captchaToken || undefined,
      } as SignUpFormData & {
        honeypot?: string;
        referralCode?: string;
        captchaToken?: string;
      });

      if (result.success) {
        await trackFingerprint();
        toast.success("Account created!", {
          description:
            "Please check your email to verify your account before signing in.",
        });
        const next = referralCode
          ? `/sign-in?verification=pending&ref=${encodeURIComponent(referralCode)}`
          : "/sign-in?verification=pending";
        router.push(next);
      } else if (result.error) {
        toast.error("Sign up failed", { description: result.error });
      }
    } catch (e) {
      console.error(e);
      toast.error("Sign up failed", {
        description:
          e instanceof Error ? e.message : "Failed to create an account.",
      });
    }
  };

  return {
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
  };
}
