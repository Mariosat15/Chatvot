import { getCompetitions, isUserInCompetition } from '@/lib/actions/trading/competition.actions';
import { getWalletBalance } from '@/lib/actions/trading/wallet.actions';
import CompetitionsPageContent from './page-content';

// Force dynamic rendering - this page uses authentication
export const dynamic = 'force-dynamic';

const CompetitionsPage = async () => {
  // Fetch all competitions on server
  const [upcomingCompetitions, activeCompetitions, completedCompetitions, cancelledCompetitions] = await Promise.all([
    getCompetitions({ status: 'upcoming' }),
    getCompetitions({ status: 'active' }),
    getCompetitions({ status: 'completed', limit: 10 }),
    getCompetitions({ status: 'cancelled', limit: 5 }),
  ]);

  // Combine all competitions
  const allCompetitions = [
    ...activeCompetitions,
    ...upcomingCompetitions,
    ...completedCompetitions,
    ...cancelledCompetitions,
  ];

  // Get user wallet balance (server action)
  const walletBalance = await getWalletBalance();

  // Check which competitions user has entered (parallel requests)
  const userCompetitionChecks = await Promise.all(
    allCompetitions.map(async (comp) => ({
      id: comp._id.toString(),
      isUserIn: await isUserInCompetition(comp._id.toString()),
    }))
  );

  // Create a map for quick lookup
  const userInCompetitionIds = userCompetitionChecks
    .filter((check) => check.isUserIn)
    .map((check) => check.id);

  return (
    <CompetitionsPageContent 
      initialCompetitions={allCompetitions}
      initialBalance={walletBalance.balance}
      userInCompetitionIds={userInCompetitionIds}
    />
  );
};

export default CompetitionsPage;
