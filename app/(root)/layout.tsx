import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FingerprintProvider } from "@/contexts/FingerprintProvider";
import GlobalPresenceTracker from "@/components/GlobalPresenceTracker";
import UserSidebar from "@/components/UserSidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect('/sign-in');

  // SECURITY: Check if user's email is verified
  // This prevents users who registered but haven't verified their email from accessing the app
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (db) {
      // Build query to match user by id (string) or _id (ObjectId)
      const userIdString = session.user.id;
      const query: { $or: object[] } = {
        $or: [
          { id: userIdString },
        ]
      };
      
      // Also try ObjectId if it's a valid 24-character hex string
      if (userIdString && /^[0-9a-fA-F]{24}$/.test(userIdString)) {
        query.$or.push({ _id: new ObjectId(userIdString) });
      }
      
      const user = await db.collection('user').findOne(query);
      
      console.log(`🔍 Email verification check for ${session.user.email}: found=${!!user}, emailVerified=${user?.emailVerified}`);
      
      // Block if user exists and email is NOT verified
      // emailVerified can be false, null, or undefined - all mean not verified
      if (user && user.emailVerified !== true) {
        console.log(`🚫 Blocking unverified user from accessing app: ${session.user.email}`);
        redirect('/verify-email-required');
      }
    }
  } catch (error) {
    console.error('Error checking email verification:', error);
    // Continue if check fails - don't block users due to database errors
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
