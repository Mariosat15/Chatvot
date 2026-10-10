import { Suspense } from "react";
import AuthViewportSwitch from "@/components/auth/AuthViewportSwitch";
import DesktopAuthShell from "@/components/auth/desktop/DesktopAuthShell";
import MobileAuthShell from "@/components/auth/mobile/MobileAuthShell";
import MobileAuthCard from "@/components/auth/mobile/MobileAuthCard";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

function DesktopForgot() {
  return (
    <DesktopAuthShell variant="sign-in">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Forgot password</h2>
        <p className="mt-1 text-sm text-cyan-100/70">
          Enter the email on your account and we will send a reset link.
        </p>
      </div>
      <ForgotPasswordForm />
    </DesktopAuthShell>
  );
}

function MobileForgot() {
  return (
    <MobileAuthShell
      variant="sign-in"
      title="Reset Your Password"
      subtitle="We will email you a secure link to choose a new one."
    >
      <MobileAuthCard
        title="Forgot password"
        description="Enter your account email. If it matches an account, you will get a reset link shortly."
      >
        <ForgotPasswordForm dense />
      </MobileAuthCard>
    </MobileAuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthViewportSwitch desktop={<DesktopForgot />} mobile={<MobileForgot />} />
    </Suspense>
  );
}
