import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import {
  getCompetitions,
  getCompetitionIdsUserIsIn,
} from "@/lib/actions/trading/competition.actions";
import { getWalletBalance } from "@/lib/actions/trading/wallet.actions";
import CompetitionsPageContent from "./page-content";
import { redirectIfRestricted } from "@/lib/services/restriction-guard.service";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

const CompetitionsPage = async () => {
  // Reason: bounce restricted users to /account/review instead of showing
  // a list of competitions they cannot enter.
  await redirectIfRestricted("enterCompetition");

  // Fetch competitions with limits so list doesn't grow unbounded (50 upcoming, 50 active, etc.)
  const [
    upcomingCompetitions,
    activeCompetitions,
    completedCompetitions,
    cancelledCompetitions,
  ] = await Promise.all([
    getCompetitions({ status: "upcoming", limit: 50 }),
    getCompetitions({ status: "active", limit: 50 }),
    getCompetitions({ status: "completed", limit: 20 }),
    getCompetitions({ status: "cancelled", limit: 10 }),
  ]);

  const allCompetitions = [
    ...activeCompetitions,
    ...upcomingCompetitions,
    ...completedCompetitions,
    ...cancelledCompetitions,
  ];

  const walletBalance = await getWalletBalance();

  // Single batch query for user's participations (avoids N+1)
  const session = await auth.api.getSession({ headers: await headers() });
  const competitionIds = allCompetitions.map((c) => c._id.toString());
  const userInCompetitionIds = session?.user?.id
    ? await getCompetitionIdsUserIsIn(session.user.id, competitionIds)
    : [];

  return (
    <CompetitionsPageContent
      initialCompetitions={allCompetitions}
      initialBalance={walletBalance.balance}
      userInCompetitionIds={userInCompetitionIds}
    />
  );
};

export default CompetitionsPage;
