import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/database/mongoose";
import HeroSettings from "@/database/models/hero-settings.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import AuthShell from "@/components/auth/AuthShell";
import {
  DEFAULT_AUTH_SIGN_IN_BG,
  DEFAULT_AUTH_SIGN_UP_BG,
} from "@/lib/constants/auth-art";

async function getAuthPageSettings() {
  try {
    await connectToDatabase();
    const [heroSettings, whiteLabel] = (await Promise.all([
      HeroSettings.findOne()
        .select({
          authPageSignInImage: 1,
          authPageSignUpImage: 1,
        })
        .lean(),
      WhiteLabel.findOne().select({ appLogo: 1 }).lean(),
    ])) as [
      { authPageSignInImage?: string; authPageSignUpImage?: string } | null,
      { appLogo?: string } | null,
    ];

    return {
      signInImage: heroSettings?.authPageSignInImage || DEFAULT_AUTH_SIGN_IN_BG,
      signUpImage: heroSettings?.authPageSignUpImage || DEFAULT_AUTH_SIGN_UP_BG,
      logo: whiteLabel?.appLogo || "/assets/images/logo.png",
    };
  } catch (error) {
    console.error("Failed to load auth page settings:", error);
    return {
      signInImage: DEFAULT_AUTH_SIGN_IN_BG,
      signUpImage: DEFAULT_AUTH_SIGN_UP_BG,
      logo: "/assets/images/logo.png",
    };
  }
}

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/");

  const authSettings = await getAuthPageSettings();

  return (
    <AuthShell
      logo={authSettings.logo}
      signInImage={authSettings.signInImage}
      signUpImage={authSettings.signUpImage}
    >
      {children}
    </AuthShell>
  );
};

export default Layout;
