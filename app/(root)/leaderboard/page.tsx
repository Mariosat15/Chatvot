import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth/auth';
import { getGlobalLeaderboard, getMyLeaderboardPosition } from '@/lib/actions/leaderboard/global-leaderboard.actions';
import LeaderboardContent from '@/components/leaderboard/LeaderboardContent';
import LeaderboardPresenceTracker from '@/components/leaderboard/LeaderboardPresenceTracker';

const GlobalLeaderboardPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect('/sign-in');
  }

  const [leaderboard, myPosition] = await Promise.all([
    getGlobalLeaderboard(0), // 0 = get ALL users
    getMyLeaderboardPosition(),
  ]);

  return (
    <>
      {/* Track user presence while on leaderboard */}
      <LeaderboardPresenceTracker />
      
      <LeaderboardContent
        leaderboard={leaderboard}
        myPosition={myPosition}
        currentUserId={session.user.id}
      />
    </>
  );
};

export default GlobalLeaderboardPage;
