import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth/auth';
import MessagingClient from './MessagingClient';

export default async function MessagingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session?.user) {
    redirect('/sign-in');
  }

  return (
    <MessagingClient 
      session={{
        user: {
          id: session.user.id,
          name: session.user.name || '',
          email: session.user.email || '',
          image: session.user.image || undefined,
        }
      }} 
    />
  );
}
