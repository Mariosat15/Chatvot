import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getWalletBalance } from "@/lib/actions/trading/wallet.actions";
import CompetitionsPageContent from "./page-content";
import { redirectIfRestricted } from "@/lib/services/restriction-guard.service";
import { getTitleLevels } from "@/lib/services/xp-config.service";
import { resolveContestViewer } from "@/lib/services/gamemaster/contest-viewer.service";
import {
  browseCompetitions,
  COMPETITIONS_PAGE_SIZE,
} from "@/lib/competitions/browse-competitions";
import { connectToDatabase } from "@/database/mongoose";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

const CompetitionsPage = async () => {
  // Reason: bounce restricted users to /account/review instead of showing
  // a list of competitions they cannot enter.
  await redirectIfRestricted("enterCompetition");
  await connectToDatabase();

  const session = await auth.api.getSession({ headers: await headers() });
  const viewer = await resolveContestViewer(session?.user?.id ?? null);

  // Reason: never seed the browser with hundreds of historical contests — page 1 only.
  const browse = await browseCompetitions({
    page: 1,
    limit: COMPETITIONS_PAGE_SIZE,
    status: "active,upcoming",
    sort: "featured",
    viewer,
  });

  const walletBalance = await getWalletBalance();
  const levelLadder = await getTitleLevels();

  return (
    <CompetitionsPageContent
      initialBrowse={browse}
      initialBalance={walletBalance.balance}
      levelLadder={levelLadder}
    />
  );
};

export default CompetitionsPage;
