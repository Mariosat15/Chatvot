'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { closePosition } from '@/lib/actions/trading/position.actions';
import { calculateUnrealizedPnL, calculatePnLPercentage, ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { usePrices } from '@/contexts/PriceProvider';
import { toast } from 'sonner';
import { X, Loader2, TrendingUp, TrendingDown, Filter, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import EditPositionModal from './EditPositionModal';

interface Position {
  _id: string;
  symbol: ForexSymbol;
  side: 'long' | 'short';
  quantity: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercentage: number;
  stopLoss?: number;
  takeProfit?: number;
  marginUsed: number;
  openedAt: string;
}

interface PositionsTableProps {
  positions: Position[];
  competitionId: string;
}

const PositionsTable = ({ positions, competitionId }: PositionsTableProps) => {
  const router = useRouter();
  const { prices, subscribe, unsubscribe } = usePrices();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [livePositions, setLivePositions] = useState<Position[]>(positions);
  
  // Track locally closed positions to prevent them from flickering back
  const closedPositionIdsRef = useRef<Set<string>>(new Set());
  
  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  // Sync positions from props when they change - exclude locally closed ones
  useEffect(() => {
    // Filter out any positions that were closed locally (optimistic removal)
    const filteredPositions = positions.filter(p => !closedPositionIdsRef.current.has(p._id));
    
    // If server confirms position is gone, remove from closed set
    const serverPositionIds = new Set(positions.map(p => p._id));
    closedPositionIdsRef.current.forEach(id => {
      if (!serverPositionIds.has(id)) {
        closedPositionIdsRef.current.delete(id);
      }
    });
    
    setLivePositions(filteredPositions);
  }, [positions]);
  
  // Filters
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const [filterSide, setFilterSide] = useState<string>('all');
  const [filterPnL, setFilterPnL] = useState<string>('all');
  
  // Table container ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to all position symbols
  useEffect(() => {
    const symbols = positions.map((p) => p.symbol);
    symbols.forEach((symbol) => subscribe(symbol as ForexSymbol));

    return () => {
      symbols.forEach((symbol) => unsubscribe(symbol as ForexSymbol));
    };
  }, [positions, subscribe, unsubscribe]);

  // Update positions with real-time prices - exclude locally closed positions
  useEffect(() => {
    // Filter out closed positions first
    const activePositions = positions.filter(p => !closedPositionIdsRef.current.has(p._id));
    
    const updatedPositions = activePositions.map((position) => {
      const currentPrice = prices.get(position.symbol as ForexSymbol);
      if (!currentPrice) return position;

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
      const pnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol
      );
      const pnlPercentage = calculatePnLPercentage(pnl, position.marginUsed);

      return {
        ...position,
        currentPrice: marketPrice,
        unrealizedPnl: pnl,
        unrealizedPnlPercentage: pnlPercentage,
      };
    });

    setLivePositions(updatedPositions);
  }, [prices, positions]);

  const handleClosePosition = async (positionId: string, symbol: ForexSymbol) => {
    setClosingPosition(positionId);

    try {
      // 🔒 LOCK THE CURRENT PRICE at the moment user clicks close
      const currentPrice = prices.get(symbol);
      const lockedPrice = currentPrice ? {
        bid: currentPrice.bid,
        ask: currentPrice.ask,
        timestamp: Date.now(), // Lock timestamp
      } : undefined;


      const result = await closePosition(positionId, lockedPrice);

      if (result.success) {
        // ⚡ IMMEDIATE UI UPDATE - dispatch event so chart removes the position line instantly
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('positionClosed', { 
            detail: { positionId, symbol } 
          }));
        }

        toast.success('Position closed!', {
          description: result.message,
        });
        
        // Track this position as closed to prevent it from flickering back
        closedPositionIdsRef.current.add(positionId);
        
        // Remove from local state immediately for instant UI feedback
        setLivePositions(prev => prev.filter(p => p._id !== positionId));
        
        // Refresh server data to get updated stats (non-blocking visual feedback already done)
        router.refresh();
      }
    } catch (error) {
      toast.error('Failed to close position', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setClosingPosition(null);
    }
  };

  // Apply filters
  const filteredPositions = livePositions.filter((position) => {
    if (filterSymbol !== 'all' && position.symbol !== filterSymbol) return false;
    if (filterSide !== 'all' && position.side !== filterSide) return false;
    if (filterPnL === 'profit' && position.unrealizedPnl <= 0) return false;
    if (filterPnL === 'loss' && position.unrealizedPnl >= 0) return false;
    return true;
  });

  // Get unique symbols for filter
  const uniqueSymbols = Array.from(new Set(positions.map((p) => p.symbol)));

  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-600">No open positions</p>
        <p className="text-sm text-dark-700 mt-1">Place an order to start trading</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters - Bigger & More Visible */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-dark-600" />
          <span className="text-sm text-dark-600 font-medium">Filters:</span>
        </div>
        
        <Select value={filterSymbol} onValueChange={setFilterSymbol}>
          <SelectTrigger className="h-9 text-sm w-[120px] bg-dark-300 border-dark-400">
            <SelectValue placeholder="Symbol" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-dark-400 z-50">
            <SelectItem value="all" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">All Pairs</SelectItem>
            {uniqueSymbols.map((symbol) => (
              <SelectItem key={symbol} value={symbol} className="text-sm bg-[#1e1e1e] hover:bg-dark-300">{symbol}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSide} onValueChange={setFilterSide}>
          <SelectTrigger className="h-9 text-sm w-[110px] bg-dark-300 border-dark-400">
            <SelectValue placeholder="Side" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-dark-400 z-50">
            <SelectItem value="all" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">All Sides</SelectItem>
            <SelectItem value="long" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Long</SelectItem>
            <SelectItem value="short" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Short</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPnL} onValueChange={setFilterPnL}>
          <SelectTrigger className="h-9 text-sm w-[100px] bg-dark-300 border-dark-400">
            <SelectValue placeholder="P&L" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-dark-400 z-50">
            <SelectItem value="all" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">All P&L</SelectItem>
            <SelectItem value="profit" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Profit</SelectItem>
            <SelectItem value="loss" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Loss</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-dark-600 ml-auto">
          Showing {filteredPositions.length} of {positions.length}
        </span>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-dark-600 text-sm">No positions match your filters</p>
        </div>
      ) : (
    <div 
      ref={tableContainerRef}
      className="overflow-auto max-h-[400px] dark-scrollbar"
    >
      <Table>
        <TableHeader className="sticky top-0 bg-dark-200 z-10">
          <TableRow className="border-dark-300">
            <TableHead className="text-dark-600 bg-dark-200">Symbol</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Side</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Type</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">Quantity</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">Entry</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">Current</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">P&L</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">SL</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">TP</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Opened</TableHead>
            <TableHead className="text-dark-600 text-center bg-dark-200">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPositions.map((position) => {
            const isProfit = position.unrealizedPnl >= 0;
            return (
              <TableRow 
                key={position._id} 
                className={cn(
                  "border-dark-300",
                  isProfit ? "bg-green-500/20" : "bg-red-500/20"
                )}
              >
                <TableCell className="font-medium text-light-900">
                  {position.symbol}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-xs font-semibold',
                      isProfit
                        ? 'bg-green-500/30 text-green-400'
                        : 'bg-red-500/30 text-red-400'
                    )}
                  >
                    {position.side === 'long' ? (
                      <>
                        <TrendingUp className="size-3 inline mr-1" />
                        Long
                      </>
                    ) : (
                      <>
                        <TrendingDown className="size-3 inline mr-1" />
                        Short
                      </>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-semibold w-fit',
                      (!position.orderType || position.orderType === 'market')
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    )}>
                      {(!position.orderType || position.orderType === 'market') ? '⚡ Market' : '📊 Limit'}
                    </span>
                    {position.orderType === 'limit' && position.limitPrice && (
                      <span className="text-xs text-dark-600">
                        Limit: {position.limitPrice.toFixed(5)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-light-900">
                  {position.quantity}
                </TableCell>
                <TableCell className="text-right text-dark-600">
                  {position.entryPrice.toFixed(5)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-bold text-lg",
                  isProfit ? 'text-green-400' : 'text-red-400'
                )}>
                  {position.currentPrice.toFixed(5)}
                </TableCell>
                <TableCell className="text-right">
                  <div className={cn('font-bold text-lg', isProfit ? 'text-green-400' : 'text-red-400')}>
                    {isProfit ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                  </div>
                  <div className={cn('text-sm font-semibold', isProfit ? 'text-green-400' : 'text-red-400')}>
                    ({isProfit ? '+' : ''}
                    {position.unrealizedPnlPercentage.toFixed(2)}%)
                  </div>
                </TableCell>
                <TableCell className="text-right text-light-900 text-sm">
                  {position.stopLoss ? position.stopLoss.toFixed(5) : '—'}
                </TableCell>
                <TableCell className="text-right text-light-900 text-sm">
                  {position.takeProfit ? position.takeProfit.toFixed(5) : '—'}
                </TableCell>
                <TableCell className="text-dark-600 text-sm">
                  <div>{new Date(position.openedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div className="text-xs">{new Date(position.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPosition(position);
                        setEditModalOpen(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                      title="Edit TP/SL"
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleClosePosition(position._id, position.symbol)}
                      disabled={closingPosition === position._id}
                      className="text-red hover:text-red hover:bg-red/10"
                      title="Close Position"
                    >
                      {closingPosition === position._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
      )}

      {/* Edit Position Modal */}
      <EditPositionModal
        position={selectedPosition}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedPosition(null);
        }}
        onSuccess={() => {
          // Trigger positions refresh event and refresh server data
          window.dispatchEvent(new CustomEvent('tpslUpdated'));
          router.refresh();
        }}
      />
    </div>
  );
};

// Memoize the component to prevent re-renders when parent re-renders but positions haven't changed
export default memo(PositionsTable, (prevProps, nextProps) => {
  // Only re-render if positions array or competitionId changed
  if (prevProps.competitionId !== nextProps.competitionId) return false;
  if (prevProps.positions.length !== nextProps.positions.length) return false;
  
  // Check if any position IDs changed
  const prevIds = prevProps.positions.map(p => p._id).join(',');
  const nextIds = nextProps.positions.map(p => p._id).join(',');
  return prevIds === nextIds;
});

