import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { FingerprintProvider } from "@/contexts/FingerprintProvider";
import { TerminologyProvider } from "@/contexts/TerminologyContext";
import { getTerms } from "@/lib/services/terminology.service";
import GlobalPresenceTracker from "@/components/GlobalPresenceTracker";
import AccountStandingGuard from "@/components/AccountStandingGuard";
import ChallengePopup from "@/components/challenges/ChallengePopup";
import AffiliateTermsModal from "@/components/gamemaster/AffiliateTermsModal";
import UserSidebar from "@/components/UserSidebar";
import Header from "@/components/Header";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { getPublicName } from "@/lib/utils/user-lookup";

const emailVerifiedCache = new Map<string, { verified: boolean; ts: number }>();
const EMAIL_VERIFIED_TTL_MS = 5 * 60 * 1000;

const Layout = async ({ children }: { children: React.ReactNode }) => {
  // Reason: an operator rename must reach the next request; a static bake freezes defaults.
  noStore();
  const terms = await getTerms();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;
  const now = Date.now();
  const cached = emailVerifiedCache.get(userId);
  if (cached && now - cached.ts < EMAIL_VERIFIED_TTL_MS) {
    if (!cached.verified) redirect("/verify-email-required");
  } else {
    try {
      const mongoose = await connectToDatabase();
      const db = mongoose.connection.db;
      if (db) {
        const query: { $or: object[] } = { $or: [{ id: userId }] };
        if (userId && /^[0-9a-fA-F]{24}$/.test(userId)) {
          query.$or.push({ _id: new ObjectId(userId) });
        }
        const user = await db
          .collection("user")
          .findOne(query, { projection: { emailVerified: 1 } });
        const verified = user?.emailVerified === true;
        emailVerifiedCache.set(userId, { verified, ts: now });
        if (user && !verified) redirect("/verify-email-required");
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "digest" in error) {
        const digest = (error as { digest?: string }).digest;
        if (digest?.startsWith("NEXT_REDIRECT")) throw error;
      }
    }
  }

  // Reason: Better Auth's session carries no `username`, and the sidebar card is the one place a
  // player sees how everybody else sees them, so it must show the public name, not the real one.
  const publicName = await getPublicName(session.user.id);

  const user = {
    id: session.user.id,
    name: session.user.name,
    publicName,
    email: session.user.email,
  };

  return (
    <FingerprintProvider>
      <TerminologyProvider terms={terms}>
        {/* Global presence tracking for online/offline status */}
        <GlobalPresenceTracker userId={session.user.id} />

        {/* Live lock / deactivate / ban check on every page, desktop and mobile */}
        <AccountStandingGuard />

        {/* Real-time challenge popup notifications (WS push) */}
        <ChallengePopup userId={session.user.id} />

        {/* Reason: ONE modal for every Game Master terms question - a pending referral-link
            sign-up (attached only on Accept) and a terms request to an affiliated player.
            Shown from the stored state on every entry until answered (`External game plans/24` s5.6). */}
        <AffiliateTermsModal />

        <div className="min-h-screen bg-gray-950 text-gray-400 flex">
          {/* Sidebar Navigation - Desktop Only */}
          <UserSidebar user={user} />

          {/* Main Content Area */}
          {/*
            Reason: below lg the UserSidebar logo bar is `fixed` and 64px tall, so
            without pt-16 the first 64px of every page sat under it (the owner's
            "account status hidden under the logo", 29 Sep 2026).
          */}
          <main className="flex-1 min-h-screen overflow-x-hidden pt-16 lg:pt-0">
            {/*
              Reason: Overview mock Header — Overview/Wallet/Performance/Competitions/
              Tutorials. Games/Challenges/Marketplace stay on the sidebar (recorded
              deviation from games-first Header).
            */}
            <Header user={user} />

            {/* Page Content - Responsive padding */}
            {/*
              Reason: no phone bottom nav (owner, 29 Sep 2026) - the logo bar's
              menu already carries every route, so no bottom clearance is needed.
            */}
            <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-5 lg:px-6 pb-6">
              <AnnouncementBanner />
              {children}
            </div>
          </main>
        </div>
      </TerminologyProvider>
    </FingerprintProvider>
  );
};

export default Layout;
