import { Suspense } from "react";
import AuthViewportSwitch from "@/components/auth/AuthViewportSwitch";
import DesktopAuthShell from "@/components/auth/desktop/DesktopAuthShell";
import MobileAuthShell from "@/components/auth/mobile/MobileAuthShell";
import MobileAuthCard from "@/components/auth/mobile/MobileAuthCard";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

function DesktopReset() {
  return (
    <DesktopAuthShell variant="sign-in">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Choose a new password</h2>
        <p className="mt-1 text-sm text-cyan-100/70">
          Pick a strong password. If 2FA is on for this account, confirm it
          first.
        </p>
      </div>
      <ResetPasswordForm />
    </DesktopAuthShell>
  );
}

function MobileReset() {
  return (
    <MobileAuthShell
      variant="sign-in"
      title="New Password"
      subtitle="Confirm 2FA if enabled, then set a strong password."
    >
      <MobileAuthCard
        title="Reset password"
        description="If your account uses two-factor authentication, enter that code before setting a new password."
      >
        <ResetPasswordForm dense />
      </MobileAuthCard>
    </MobileAuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthViewportSwitch desktop={<DesktopReset />} mobile={<MobileReset />} />
    </Suspense>
  );
}
