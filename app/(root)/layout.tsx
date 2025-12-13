import Header from "@/components/Header";
import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import { FingerprintProvider } from "@/contexts/FingerprintProvider";
import GlobalPresenceTracker from "@/components/GlobalPresenceTracker";

const Layout = async ({ children }: { children : React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() });

    if(!session?.user) redirect('/sign-in');

    const user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
    }

    return (
        <FingerprintProvider>
            {/* Global presence tracking for online/offline status */}
            <GlobalPresenceTracker userId={session.user.id} />
            
            <main className="min-h-screen text-gray-400">
                <Header user={user} />

                <div className="container py-10">
                    {children}
                </div>
            </main>
        </FingerprintProvider>
    )
}
export default Layout
