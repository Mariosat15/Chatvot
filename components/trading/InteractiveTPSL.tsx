'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import EditPositionModal from './EditPositionModal';

import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

interface Position {
  _id: string;
  symbol: ForexSymbol;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl?: number;
  takeProfit?: number;
  stopLoss?: number;
  marginUsed: number;
}

interface InteractiveTPSLProps {
  positions: Position[];
  competitionId: string;
}

/**
 * This component makes TP/SL lines interactive by:
 * 1. Allowing click-to-edit functionality
 * 2. Auto-refreshing positions after trades
 * 3. Managing edit modal state
 */
const InteractiveTPSL = ({ positions }: InteractiveTPSLProps) => {
  const router = useRouter();
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [lastPositionCount, setLastPositionCount] = useState(positions.length);

  // Monitor position changes and refresh if needed
  useEffect(() => {
    if (positions.length !== lastPositionCount) {
      setLastPositionCount(positions.length);
      // Refresh the page data after 1 second to ensure TP/SL lines show
      setTimeout(() => {
        router.refresh();
      }, 1000);
    }
  }, [positions.length, lastPositionCount, router]);

  // Listen for position updates from order placement
  useEffect(() => {
    const handleOrderPlaced = () => {
      // ⚡ FAST REFRESH - reduced from 2s to 300ms
      // Transaction is already committed before the response is sent
      setTimeout(() => {
        router.refresh();
      }, 300); // 300ms is enough for Next.js revalidation to propagate
    };

    const handlePositionOpened = () => {
      // ⚡ IMMEDIATE refresh when new position is opened
      router.refresh();
    };

    const handleTPSLUpdated = () => {
      setTimeout(() => {
        router.refresh();
        toast.success('TP/SL updated!', {
          description: 'Your changes are now visible on the chart',
        });
      }, 300);
    };

    window.addEventListener('orderPlaced', handleOrderPlaced);
    window.addEventListener('positionOpened', handlePositionOpened);
    window.addEventListener('tpslUpdated', handleTPSLUpdated);
    
    return () => {
      window.removeEventListener('orderPlaced', handleOrderPlaced);
      window.removeEventListener('positionOpened', handlePositionOpened);
      window.removeEventListener('tpslUpdated', handleTPSLUpdated);
    };
  }, [router]);

  const positionToEdit = editingPosition 
    ? positions.find(p => p._id === editingPosition) 
    : null;

  return (
    <>
      {/* Edit Position Modal */}
      {positionToEdit && (
        <EditPositionModal
          isOpen={!!editingPosition}
          onClose={() => {
            setEditingPosition(null);
            // Don't refresh here - only refresh on success to avoid unnecessary reloads
          }}
          onSuccess={() => {
            // Trigger refresh event
            window.dispatchEvent(new CustomEvent('tpslUpdated'));
          }}
          position={positionToEdit}
        />
      )}
      
      {/* Hidden helper for external components to trigger edit */}
      <div 
        id="tpsl-edit-trigger" 
        data-position-id={editingPosition}
        style={{ display: 'none' }}
      />
    </>
  );
};

export default InteractiveTPSL;

