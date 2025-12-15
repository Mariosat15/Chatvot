import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LandingPageContent from "./landing/page-content";

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  // Check if user is logged in
  const session = await auth.api.getSession({ headers: await headers() });

  // If logged in, redirect to dashboard
  if (session?.user) {
    redirect('/dashboard');
  }

  // If not logged in, show the landing page
  return <LandingPageContent />;
}

