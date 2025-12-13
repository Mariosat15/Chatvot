import { Suspense } from 'react';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import ChallengesPageContent from './page-content';

export const metadata = {
  title: 'My Challenges | 1v1 Trading Battles',
  description: 'View and manage your 1v1 trading challenges',
};

export default async function ChallengesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/sign-in');
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-cyan-400">Loading challenges...</div>
        </div>
      }
    >
      <ChallengesPageContent userId={session.user.id} />
    </Suspense>
  );
}

