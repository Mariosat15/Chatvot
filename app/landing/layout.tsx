import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TradingArena - Where Champions Trade',
  description: 'Join the world\'s most exciting trading competitions. Compete in real-time, challenge other traders, and win massive prizes.',
  keywords: 'trading competitions, forex trading, crypto trading, trading challenges, leaderboard, trading platform',
  openGraph: {
    title: 'TradingArena - Where Champions Trade',
    description: 'Join the world\'s most exciting trading competitions.',
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

