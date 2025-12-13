import { Metadata } from 'next';
import { Suspense } from 'react';
import MarketplaceContent from './page-content';

export const metadata: Metadata = {
  title: 'Marketplace | Trading Arsenal',
  description: 'Browse trading bots, indicators, and tools to enhance your trading experience.',
};

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}

