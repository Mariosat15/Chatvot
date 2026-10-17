"use client";

import AuthViewportSwitch from "@/components/auth/AuthViewportSwitch";
import DesktopRegister from "@/components/auth/desktop/DesktopRegister";
import MobileRegister from "@/components/auth/mobile/MobileRegister";

export default function SignUpPage() {
  return (
    <AuthViewportSwitch
      desktop={<DesktopRegister />}
      mobile={<MobileRegister />}
    />
  );
}
