'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
 * 2. Auto-refreshing positions after trades (debounced)
 * 3. Managing edit modal state
 */
const InteractiveTPSL = ({ positions }: InteractiveTPSLProps) => {
  const router = useRouter();
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const lastPositionCountRef = useRef(positions.length);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  // Debounced refresh to prevent multiple rapid refreshes
  const scheduleRefresh = useCallback((delay: number = 300) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    refreshTimeoutRef.current = setTimeout(() => {
      if (!isRefreshingRef.current) {
        isRefreshingRef.current = true;
        router.refresh();
        // Reset flag after a short delay to allow next refresh
        setTimeout(() => {
          isRefreshingRef.current = false;
        }, 500);
      }
      refreshTimeoutRef.current = null;
    }, delay);
  }, [router]);

  // Monitor position changes - using ref to avoid triggering effect on every render
  useEffect(() => {
    if (positions.length !== lastPositionCountRef.current) {
      lastPositionCountRef.current = positions.length;
      // Only refresh if positions were added (new trade)
      scheduleRefresh(500);
    }
  }, [positions.length, scheduleRefresh]);

  // Listen for position updates from order placement
  useEffect(() => {
    const handleOrderPlaced = () => {
      scheduleRefresh(300);
    };

    const handlePositionOpened = () => {
      scheduleRefresh(100); // Faster for new positions
    };

    const handleTPSLUpdated = () => {
      scheduleRefresh(300);
      toast.success('TP/SL updated!', {
        description: 'Your changes are now visible on the chart',
      });
    };

    window.addEventListener('orderPlaced', handleOrderPlaced);
    window.addEventListener('positionOpened', handlePositionOpened);
    window.addEventListener('tpslUpdated', handleTPSLUpdated);
    
    return () => {
      window.removeEventListener('orderPlaced', handleOrderPlaced);
      window.removeEventListener('positionOpened', handlePositionOpened);
      window.removeEventListener('tpslUpdated', handleTPSLUpdated);
      // Clear any pending timeouts
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [scheduleRefresh]);

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

