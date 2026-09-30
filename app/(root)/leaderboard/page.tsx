import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth/auth";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";
import { isGmJoinEnabled } from "@/lib/services/gamemaster/gm-program-flags";

/**
 * Global leaderboard: data is loaded client-side via /api/leaderboard (paginated)
 * so we never send 4000+ entries to the client (avoids freeze/crash).
 */
const GlobalLeaderboardPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  // Reason: read on the server so the option is simply absent while the programme is
  // off; the API refuses too, so hiding it is presentation and not the protection.
  const gmBoardEnabled = await isGmJoinEnabled();

  return (
    <LeaderboardClient currentUserId={session.user.id} gmBoardEnabled={gmBoardEnabled} />
  );
};

export default GlobalLeaderboardPage;
