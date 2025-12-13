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
      console.log('🔄 Order placed, refreshing positions in 2 seconds to ensure TP/SL are saved...');
      // Increased delay to ensure database transaction completes and TP/SL are saved
      setTimeout(() => {
        console.log('✅ Refreshing now...');
        router.refresh();
        
        // Show success after refresh
        setTimeout(() => {
          toast.success('TP/SL loaded on chart!', {
            description: 'Your Take Profit and Stop Loss levels are now visible',
          });
        }, 500);
      }, 2000); // 2 seconds delay to ensure transaction completes
    };

    const handleTPSLUpdated = () => {
      console.log('🔄 TP/SL updated, refreshing chart...');
      setTimeout(() => {
        router.refresh();
        toast.success('TP/SL updated!', {
          description: 'Your changes are now visible on the chart',
        });
      }, 500);
    };

    window.addEventListener('orderPlaced', handleOrderPlaced);
    window.addEventListener('tpslUpdated', handleTPSLUpdated);
    
    return () => {
      window.removeEventListener('orderPlaced', handleOrderPlaced);
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

