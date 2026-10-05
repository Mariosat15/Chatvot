import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import HeroSettings from "@/database/models/hero-settings.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { AuthBrandingProvider } from "@/components/auth/AuthBrandingContext";
import {
  DEFAULT_AUTH_SIGN_IN_BG,
  DEFAULT_AUTH_SIGN_UP_BG,
} from "@/lib/constants/auth-art";
import { resolveAuthFeaturePills } from "@/lib/constants/auth-feature-pills";

async function getAuthPageSettings() {
  try {
    await connectToDatabase();
    const [heroSettings, whiteLabel] = (await Promise.all([
      HeroSettings.findOne()
        .select({
          authPageSignInImage: 1,
          authPageSignUpImage: 1,
          authPageFeaturePills: 1,
        })
        .lean(),
      WhiteLabel.findOne().select({ appLogo: 1 }).lean(),
    ])) as [
      {
        authPageSignInImage?: string;
        authPageSignUpImage?: string;
        authPageFeaturePills?: unknown;
      } | null,
      { appLogo?: string } | null,
    ];

    return {
      signInImage: heroSettings?.authPageSignInImage || DEFAULT_AUTH_SIGN_IN_BG,
      signUpImage: heroSettings?.authPageSignUpImage || DEFAULT_AUTH_SIGN_UP_BG,
      logo: whiteLabel?.appLogo || "/assets/images/logo.png",
      featurePills: resolveAuthFeaturePills(heroSettings?.authPageFeaturePills),
    };
  } catch (error) {
    console.error("Failed to load auth page settings:", error);
    return {
      signInImage: DEFAULT_AUTH_SIGN_IN_BG,
      signUpImage: DEFAULT_AUTH_SIGN_UP_BG,
      logo: "/assets/images/logo.png",
      featurePills: resolveAuthFeaturePills(undefined),
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
