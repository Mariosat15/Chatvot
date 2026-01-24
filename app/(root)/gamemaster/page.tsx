import { Metadata } from 'next';
import { Suspense } from 'react';
import GameMasterDashboardContent from './page-content';

export const metadata: Metadata = {
  title: 'Game Master Dashboard | ChartVolt',
  description: 'Manage your Game Master status, referrals, and earnings.',
};

export default function GameMasterDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    }>
      <GameMasterDashboardContent />
    </Suspense>
  );
}
