"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { trackDeviceFingerprint } from "@/lib/services/device-fingerprint.service";

export function useSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    null,
  );
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendEmail, setResendEmail] = useState<string | null>(null);

  const form = useForm<SignInFormData>({
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const { getValues } = form;

  useEffect(() => {
    const verification = searchParams.get("verification");
    if (!verification) return;
    setVerificationStatus(verification);

    if (verification === "success") {
      toast.success("Email verified!", {
        description: "Your email has been verified. You can now sign in.",
      });
    } else if (verification === "expired") {
      toast.error("Verification link expired", {
        description: "Please request a new verification email.",
      });
    } else if (verification === "invalid") {
      toast.error("Invalid verification link", {
        description:
          "The verification link is invalid or has already been used.",
      });
    } else if (verification === "pending") {
      toast.info("Verification required", {
        description: "Please check your email to verify your account.",
      });
    }
  }, [searchParams]);

  const handleResendVerification = async () => {
    const email = resendEmail || getValues("email");
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setResendingEmail(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Verification email sent!", {
          description: "Please check your inbox for the verification link.",
        });
        setVerificationStatus("pending");
      } else {
        toast.error("Failed to send verification email", {
          description: data.error || "Please try again later.",
        });
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      toast.error("Failed to send verification email");
    } finally {
      setResendingEmail(false);
    }
  };

  const onSubmit = async (data: SignInFormData) => {
    try {
      const result = await signInWithEmail(data);
      if (result.success) {
        if ((result as { twoFactorRequired?: boolean }).twoFactorRequired) {
          const methods = (
            result as { twoFactorMethods?: string[] }
          ).twoFactorMethods;
          const params = methods?.length
            ? `?methods=${encodeURIComponent(methods.join(","))}`
            : "";
          router.push(`/verify-2fa${params}`);
          return;
        }

        try {
          await trackDeviceFingerprint();
        } catch (fpError) {
          console.error("Failed to track fingerprint:", fpError);
        }
        router.push("/");
      } else if (result.needsVerification) {
        setVerificationStatus("needs_verification");
        setResendEmail(result.email || data.email);
        toast.error("Email not verified", {
          description:
            result.error || "Please verify your email before signing in.",
        });
      } else if (result.code === "ACCOUNT_LOCKED") {
        toast.error("Account Locked", {
          description: result.error,
          duration: 10000,
        });
      } else if (result.code === "RATE_LIMIT_EXCEEDED") {
        toast.error("Too Many Attempts", {
          description:
            result.error || "Please wait a moment before trying again.",
          duration: 8000,
        });
      } else {
        toast.error("Sign in failed", {
          description: result.error || "Invalid email or password.",
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Sign in failed", {
        description: e instanceof Error ? e.message : "Failed to sign in.",
      });
    }
  };

  return {
    form,
    verificationStatus,
    resendingEmail,
    handleResendVerification,
    onSubmit,
  };
}
