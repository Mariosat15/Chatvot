import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth/auth";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";

/**
 * Global leaderboard: data is loaded client-side via /api/leaderboard (paginated)
 * so we never send 4000+ entries to the client (avoids freeze/crash).
 */
const GlobalLeaderboardPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <LeaderboardClient currentUserId={session.user.id} />
  );
};

export default GlobalLeaderboardPage;
