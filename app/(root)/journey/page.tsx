import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth/auth";
import JourneyClient from "./JourneyClient";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  return <JourneyClient userId={session.user.id} />;
}
