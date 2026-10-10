import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import HeroSettings from "@/database/models/hero-settings.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CompanySettings from "@/database/models/company-settings.model";
import { AuthBrandingProvider } from "@/components/auth/AuthBrandingContext";
import {
  DEFAULT_AUTH_SIGN_IN_BG,
  DEFAULT_AUTH_SIGN_UP_BG,
} from "@/lib/constants/auth-art";
import { resolveAuthFeaturePills } from "@/lib/constants/auth-feature-pills";

// Reason: the same address the landing footer's "Contact Us" already uses, so a
// deployment with no Company Settings email still shows a reachable inbox.
const DEFAULT_SUPPORT_EMAIL = "support@chartvolt.com";

async function getAuthPageSettings() {
  try {
    await connectToDatabase();
    const [heroSettings, whiteLabel, company] = (await Promise.all([
      HeroSettings.findOne()
        .select({
          authPageSignInImage: 1,
          authPageSignUpImage: 1,
          authPageFeaturePills: 1,
        })
        .lean(),
      WhiteLabel.findOne().select({ appLogo: 1 }).lean(),
      // Reason: findOne, not getSingleton - a public page must not create documents.
      CompanySettings.findOne().select({ email: 1 }).lean(),
    ])) as [
      {
        authPageSignInImage?: string;
        authPageSignUpImage?: string;
        authPageFeaturePills?: unknown;
      } | null,
      { appLogo?: string } | null,
      { email?: string } | null,
    ];

    return {
      signInImage: heroSettings?.authPageSignInImage || DEFAULT_AUTH_SIGN_IN_BG,
      signUpImage: heroSettings?.authPageSignUpImage || DEFAULT_AUTH_SIGN_UP_BG,
      logo: whiteLabel?.appLogo || "/assets/images/logo.png",
      featurePills: resolveAuthFeaturePills(heroSettings?.authPageFeaturePills),
      supportEmail: company?.email?.trim() || DEFAULT_SUPPORT_EMAIL,
    };
  } catch (error) {
    console.error("Failed to load auth page settings:", error);
    return {
      signInImage: DEFAULT_AUTH_SIGN_IN_BG,
      signUpImage: DEFAULT_AUTH_SIGN_UP_BG,
      logo: "/assets/images/logo.png",
      featurePills: resolveAuthFeaturePills(undefined),
      supportEmail: DEFAULT_SUPPORT_EMAIL,
    };
  }
}

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/");

  const authSettings = await getAuthPageSettings();

  return (
    <AuthBrandingProvider value={authSettings}>{children}</AuthBrandingProvider>
  );
};

export default Layout;
