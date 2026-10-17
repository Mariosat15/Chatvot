"use client";

import AuthViewportSwitch from "@/components/auth/AuthViewportSwitch";
import DesktopSignIn from "@/components/auth/desktop/DesktopSignIn";
import MobileSignIn from "@/components/auth/mobile/MobileSignIn";

export default function SignInPage() {
  return (
    <AuthViewportSwitch
      desktop={<DesktopSignIn />}
      mobile={<MobileSignIn />}
    />
  );
}
