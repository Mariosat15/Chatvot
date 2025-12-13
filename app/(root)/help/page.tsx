import { headers } from 'next/headers';
import { auth } from '@/lib/better-auth/auth';
import HelpPageContent from './page-content';

export default async function HelpPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-800 to-dark-900">
      <HelpPageContent isLoggedIn={!!session?.user} />
    </div>
  );
}

