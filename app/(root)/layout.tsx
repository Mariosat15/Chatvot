import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FingerprintProvider } from "@/contexts/FingerprintProvider";
import GlobalPresenceTracker from "@/components/GlobalPresenceTracker";
import UserSidebar from "@/components/UserSidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";

const emailVerifiedCache = new Map<string, { verified: boolean; ts: number }>();
const EMAIL_VERIFIED_TTL_MS = 5 * 60 * 1000;

const Layout = async ({ children }: { children: React.ReactNode }) => {
  // #region agent log
  const _layoutT0 = Date.now();
  const _layoutAuthT0 = Date.now();
  // #endregion
  const session = await auth.api.getSession({ headers: await headers() });
  // #region agent log
  console.log(`[PERF] layout auth.getSession: ${Date.now()-_layoutAuthT0}ms hasUser=${!!session?.user}`);
  // #endregion

  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;
  const now = Date.now();
  const cached = emailVerifiedCache.get(userId);
  if (cached && now - cached.ts < EMAIL_VERIFIED_TTL_MS) {
    if (!cached.verified) redirect("/verify-email-required");
  } else {
    try {
      // #region agent log
      const _emailT0 = Date.now();
      // #endregion
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
        // #region agent log
        console.log(`[PERF] layout emailVerified DB: ${Date.now()-_emailT0}ms verified=${verified}`);
        // #endregion
        if (user && !verified) redirect("/verify-email-required");
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "digest" in error) {
        const digest = (error as { digest?: string }).digest;
        if (digest?.startsWith("NEXT_REDIRECT")) throw error;
      }
    }
  }

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };

  return (
    <FingerprintProvider>
      {/* Global presence tracking for online/offline status */}
      <GlobalPresenceTracker userId={session.user.id} />

      <div className="min-h-screen bg-gray-950 text-gray-400 flex">
        {/* Sidebar Navigation - Desktop Only */}
        <UserSidebar user={user} />

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen overflow-x-hidden">
          {/* Mobile header spacing */}
          <div className="lg:hidden h-16" />

          {/* Page Content - Responsive padding */}
          <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-5 lg:px-6 pb-20 lg:pb-6">
            {children}
          </div>

          {/* Mobile bottom nav spacing */}
          <div className="lg:hidden h-16" />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </FingerprintProvider>
  );
};

export default Layout;
