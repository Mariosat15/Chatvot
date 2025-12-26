import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FingerprintProvider } from "@/contexts/FingerprintProvider";
import GlobalPresenceTracker from "@/components/GlobalPresenceTracker";
import UserSidebar from "@/components/UserSidebar";

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect('/sign-in');

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
        {/* Sidebar Navigation */}
        <UserSidebar user={user} />

        {/* Main Content Area */}
        <main className="flex-1 min-h-screen overflow-x-hidden">
          {/* Mobile header spacing */}
          <div className="lg:hidden h-16" />
          
          {/* Page Content - Full width, minimal padding for trading pages */}
          <div className="p-2 md:p-3 lg:p-4">
            {children}
          </div>
        </main>
      </div>
    </FingerprintProvider>
  );
};

export default Layout;
