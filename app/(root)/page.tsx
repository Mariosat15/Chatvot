import { redirect } from "next/navigation";

// This page just redirects to dashboard
// The actual root "/" shows the landing page for visitors
export const dynamic = 'force-dynamic';

const RootRedirect = async () => {
    redirect('/dashboard');
}

export default RootRedirect;
