"use client";

import { useState, useEffect, useRef, memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { closePosition } from "@/lib/actions/trading/position.actions";
import {
  calculateUnrealizedPnL,
  calculatePnLPercentage,
  ForexSymbol,
} from "@/lib/services/pnl-calculator.service";
import { usePrices } from "@/contexts/PriceProvider";
import {
  usePositionSync,
  POSITION_EVENTS,
  getAuthoritativePositionIds,
  setAuthoritativePositionIds,
} from "@/hooks/usePositionSync";
import {
  usePositionEventListener,
  PositionEvent,
  POSITION_SSE_EVENT,
} from "@/contexts/PositionEventsProvider";
import { toast } from "sonner";
import {
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Filter,
  Edit,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EditPositionModal from "./EditPositionModal";

interface Position {
  _id: string;
  symbol: ForexSymbol;
  side: "long" | "short";
  quantity: number;
  orderType: "market" | "limit";
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
  competitionId?: string;
  challengeId?: string;
}

const PositionsTable = ({
  positions,
  competitionId,
  challengeId,
}: PositionsTableProps) => {
  const router = useRouter();
  const { prices, subscribe, unsubscribe, isStale, forceRefresh } = usePrices();
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [livePositions, setLivePositions] = useState<Position[]>(positions);

  // Track locally closed positions to prevent them from flickering back
  const closedPositionIdsRef = useRef<Set<string>>(new Set());

  // ⚡ Track pending TP/SL edits to prevent race conditions with price updates
  // Key: positionId, Value: {takeProfit, stopLoss, timestamp}
  const pendingTPSLEditsRef = useRef<
    Map<string, { takeProfit?: number; stopLoss?: number; timestamp: number }>
  >(new Map());
  const PENDING_EDIT_TIMEOUT = 5000; // Clear pending edit after 5 seconds (server should have synced by then)

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null,
  );

  // ⚡ SSE Event Listener for INSTANT position updates (< 100ms latency)
  // This receives events directly from the server when TP/SL triggers
  usePositionEventListener(
    (event: PositionEvent) => {

      if (event.eventType === "closed") {
        // Instantly remove position from UI
        closedPositionIdsRef.current.add(event.positionId);
        setLivePositions((prev) =>
          prev.filter((p) => p._id !== event.positionId),
        );

        // Update authoritative IDs
        const authIds = getAuthoritativePositionIds();
        if (authIds) {
          authIds.delete(event.positionId);
          setAuthoritativePositionIds(authIds);
        }

        // Toast is handled by PositionEventsProvider, but we still refresh data
        router.refresh();
      }
    },
    [router],
  );

  // ⚡ Position sync as BACKUP (in case SSE fails)
  // Reduced importance since SSE handles most cases now
  usePositionSync({
    competitionId,
    challengeId,
    enabled: true,
    onPositionClosed: (positionId, reason) => {
      // Only show toast if not already handled by SSE
      const closedPosition = livePositions.find((p) => p._id === positionId);
      if (closedPosition && !closedPositionIdsRef.current.has(positionId)) {
        const reasonText =
          reason === "tp"
            ? "Take Profit"
            : reason === "sl"
              ? "Stop Loss"
              : reason === "margin"
                ? "Margin Call"
                : "TP/SL";
        toast.success(`Position closed by ${reasonText}`, {
          description: `${closedPosition.symbol} ${closedPosition.side} position closed`,
        });

        // Optimistically remove from UI
        closedPositionIdsRef.current.add(positionId);
        setLivePositions((prev) => prev.filter((p) => p._id !== positionId));
      }
    },
  });

  // Listen for position closed events from other sources
  useEffect(() => {
    const handlePositionClosed = (event: CustomEvent) => {
      const { positionId, reason, serverPositionIds } = event.detail;

      // Always add to closed set to prevent flicker, even if not in current list
      if (positionId !== "unknown") {
        closedPositionIdsRef.current.add(positionId);
      }

      // If server sent position IDs, use those to filter
      if (serverPositionIds && Array.isArray(serverPositionIds)) {
        const validIds = new Set<string>(serverPositionIds);
        setLivePositions((prev) => {
          const filtered = prev.filter((p) => validIds.has(p._id));
          if (filtered.length < prev.length) {
            prev.forEach((p) => {
              if (!validIds.has(p._id)) {
                closedPositionIdsRef.current.add(p._id);
                toast.success(`Position closed`, {
                  description: `${p.symbol} ${p.side} position`,
                });
              }
            });
          }
          return filtered;
        });
      } else {
        // Remove specific position from local state
        setLivePositions((prev) => {
          const filtered = prev.filter((p) => p._id !== positionId);
          const wasRemoved = filtered.length < prev.length;

          if (wasRemoved) {
            const closedPosition = prev.find((p) => p._id === positionId);
            if (closedPosition) {
              const reasonText =
                reason === "tp"
                  ? "Take Profit"
                  : reason === "sl"
                    ? "Stop Loss"
                    : reason === "margin"
                      ? "Margin Call"
                      : "TP/SL";
              toast.success(`Position closed by ${reasonText}`, {
                description: `${closedPosition.symbol} ${closedPosition.side} position`,
              });
            }
          } else {
          }

          return filtered;
        });
      }

      // Always refresh to update stats
      router.refresh();
    };

    // Also listen for general positions changed event to trigger refresh
    const handlePositionsChanged = (event: CustomEvent) => {

      const { serverPositionIds, closedPositions, isInitialSync } =
        event.detail;

      // ⚡ IMPORTANT: Add any explicitly closed positions to closedPositionIdsRef
      // This ensures we track them even if livePositions is empty/stale
      if (closedPositions && Array.isArray(closedPositions)) {
        closedPositions.forEach((id: string) => {
          closedPositionIdsRef.current.add(id);
        });
      }

      // If server sent position IDs, store them as the authoritative source
      // This prevents router.refresh() from restoring stale positions
      if (serverPositionIds && Array.isArray(serverPositionIds)) {
        const validIds = new Set<string>(serverPositionIds);

        // ⚡ IMPORTANT: Store server's position IDs as the authoritative source (in global state)
        setAuthoritativePositionIds(validIds);

        setLivePositions((prev) => {
          // Check if there are any positions to remove
          const positionsToRemove = prev.filter((p) => !validIds.has(p._id));

          if (positionsToRemove.length > 0) {

            // Mark removed positions
            positionsToRemove.forEach((p) => {
              closedPositionIdsRef.current.add(p._id);
              // Only show toast if not initial sync (to avoid spamming on page load)
              if (!isInitialSync) {
                toast.success(`Position closed`, {
                  description: `${p.symbol} ${p.side} position`,
                });
              }
            });

            // Return filtered list
            return prev.filter((p) => validIds.has(p._id));
          }

          return prev;
        });
      }

      // Force router refresh to get latest stats
      router.refresh();
    };

    window.addEventListener(
      POSITION_EVENTS.POSITION_CLOSED,
      handlePositionClosed as EventListener,
    );
    window.addEventListener(
      POSITION_EVENTS.POSITIONS_CHANGED,
      handlePositionsChanged as EventListener,
    );

    return () => {
      window.removeEventListener(
        POSITION_EVENTS.POSITION_CLOSED,
        handlePositionClosed as EventListener,
      );
      window.removeEventListener(
        POSITION_EVENTS.POSITIONS_CHANGED,
        handlePositionsChanged as EventListener,
      );
    };
  }, [router, livePositions]);

  // Sync positions from props when they change - exclude locally closed ones
  useEffect(() => {
    // Filter out any positions that were closed locally (optimistic removal)
    let filteredPositions = positions.filter(
      (p) => !closedPositionIdsRef.current.has(p._id),
    );

    // ⚡ IMPORTANT: Also filter against the authoritative server position list
    // This prevents router.refresh() from restoring stale positions that position sync already knows are closed
    // Uses GLOBAL state that persists across component remounts
    const authoritativeIds = getAuthoritativePositionIds();
    if (authoritativeIds !== null) {
      const beforeCount = filteredPositions.length;

      // Filter positions: only keep those that are either:
      // 1. In the authoritative server list, OR
      // 2. NOT in closedPositionIdsRef (meaning they could be new)
      filteredPositions = filteredPositions.filter((p) => {
        // If position is in authoritative list, keep it
        if (authoritativeIds.has(p._id)) return true;

        // If position was explicitly closed (in closedPositionIdsRef), filter it out
        if (closedPositionIdsRef.current.has(p._id)) {
          return false;
        }

        // Position not in server list and not explicitly closed
        // This is likely a NEW position opened after the last sync
        // Add it to authoritative list to track it going forward
        authoritativeIds.add(p._id);
        return true;
      });

      if (filteredPositions.length < beforeCount) {
      }
    }

    // If server confirms position is gone, remove from closed set
    const propsPositionIds = new Set(positions.map((p) => p._id));
    closedPositionIdsRef.current.forEach((id) => {
      if (!propsPositionIds.has(id)) {
        closedPositionIdsRef.current.delete(id);
      }
    });

    // Clear pending edits if server data now matches (sync complete)
    pendingTPSLEditsRef.current.forEach((edit, positionId) => {
      const serverPosition = positions.find((p) => p._id === positionId);
      if (serverPosition) {
        // If server TP/SL matches pending edit, clear it
        if (
          serverPosition.takeProfit === edit.takeProfit &&
          serverPosition.stopLoss === edit.stopLoss
        ) {
          pendingTPSLEditsRef.current.delete(positionId);
        }
      }
    });

    setLivePositions(filteredPositions);
  }, [positions]);

  // Filters
  const [filterSymbol, setFilterSymbol] = useState<string>("all");
  const [filterSide, setFilterSide] = useState<string>("all");
  const [filterPnL, setFilterPnL] = useState<string>("all");

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

  // Reason: Compute live-priced positions IN THE SAME RENDER CYCLE as the price change.
  // Previously this was a useEffect+setLivePositions pattern which caused a double-render:
  //   Render1 (stale prices on screen) → useEffect → setState → Render2 (new prices)
  // With useMemo, prices are applied during Render1 itself — zero extra delay.
  const pricedPositions = useMemo(() => {
    const now = Date.now();

    // Clean up expired pending edits (side effect in memo is safe here — it's just ref cleanup)
    pendingTPSLEditsRef.current.forEach((edit, positionId) => {
      if (now - edit.timestamp > PENDING_EDIT_TIMEOUT) {
        pendingTPSLEditsRef.current.delete(positionId);
      }
    });

    return livePositions.map((position) => {
      const currentPrice = prices.get(position.symbol as ForexSymbol);
      if (!currentPrice) return position;

      const marketPrice =
        position.side === "long" ? currentPrice.bid : currentPrice.ask;
      const pnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol,
      );
      const pnlPercentage = calculatePnLPercentage(pnl, position.marginUsed);

      // ⚡ Check if there's a pending TP/SL edit for this position
      const pendingEdit = pendingTPSLEditsRef.current.get(position._id);

      return {
        ...position,
        currentPrice: marketPrice,
        unrealizedPnl: pnl,
        unrealizedPnlPercentage: pnlPercentage,
        // Preserve pending TP/SL edits until server syncs
        ...(pendingEdit && {
          takeProfit: pendingEdit.takeProfit,
          stopLoss: pendingEdit.stopLoss,
        }),
      };
    });
  }, [prices, livePositions]);

  const handleClosePosition = async (
    positionId: string,
    symbol: ForexSymbol,
  ) => {
    setClosingPosition(positionId);

    try {
      // 🔒 LOCK THE CURRENT PRICE at the moment user clicks close
      const currentPrice = prices.get(symbol);
      const lockedPrice = currentPrice
        ? {
            bid: currentPrice.bid,
            ask: currentPrice.ask,
            timestamp: Date.now(), // Lock timestamp
          }
        : undefined;

      const result = await closePosition(positionId, lockedPrice);

      if (result.success) {
        // ⚡ IMMEDIATE UI UPDATE - dispatch event so chart removes the position line instantly
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("positionClosed", {
              detail: { positionId, symbol },
            }),
          );
        }

        toast.success("Position closed!", {
          description: result.message,
        });

        // Track this position as closed to prevent it from flickering back
        closedPositionIdsRef.current.add(positionId);

        // Remove from local state immediately for instant UI feedback
        setLivePositions((prev) => prev.filter((p) => p._id !== positionId));

        // Refresh server data to get updated stats (non-blocking visual feedback already done)
        router.refresh();
      } else {
        // Server returned a business-logic reason (market closed, paused, restricted, etc.)
        const description = result.error || "Unable to close position. Please try again.";
        toast.error("Close failed", { description });
      }
    } catch (error) {
      // Unexpected network / runtime error
      const description =
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again or contact support if the issue persists.";
      toast.error("Failed to close position", { description });
    } finally {
      setClosingPosition(null);
    }
  };

  // Apply filters — uses pricedPositions (live prices applied via useMemo, zero delay)
  const filteredPositions = pricedPositions.filter((position) => {
    if (filterSymbol !== "all" && position.symbol !== filterSymbol)
      return false;
    if (filterSide !== "all" && position.side !== filterSide) return false;
    if (filterPnL === "profit" && position.unrealizedPnl <= 0) return false;
    if (filterPnL === "loss" && position.unrealizedPnl >= 0) return false;
    return true;
  });

  // Get unique symbols for filter
  const uniqueSymbols = Array.from(new Set(positions.map((p) => p.symbol)));

  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-600">No open positions</p>
        <p className="text-sm text-dark-700 mt-1">
          Place an order to start trading
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stale Price Warning */}
      {isStale && (
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="size-4" />
            <span className="text-sm">
              Prices may be outdated. Connection interrupted.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={forceRefresh}
            className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="size-4 mr-1" />
            Refresh
          </Button>
        </div>
      )}

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
            <SelectItem
              value="all"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              All Pairs
            </SelectItem>
            {uniqueSymbols.map((symbol) => (
              <SelectItem
                key={symbol}
                value={symbol}
                className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
              >
                {symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSide} onValueChange={setFilterSide}>
          <SelectTrigger className="h-9 text-sm w-[110px] bg-dark-300 border-dark-400">
            <SelectValue placeholder="Side" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-dark-400 z-50">
            <SelectItem
              value="all"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              All Sides
            </SelectItem>
            <SelectItem
              value="long"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              Long
            </SelectItem>
            <SelectItem
              value="short"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              Short
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPnL} onValueChange={setFilterPnL}>
          <SelectTrigger className="h-9 text-sm w-[100px] bg-dark-300 border-dark-400">
            <SelectValue placeholder="P&L" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-dark-400 z-50">
            <SelectItem
              value="all"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              All P&L
            </SelectItem>
            <SelectItem
              value="profit"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              Profit
            </SelectItem>
            <SelectItem
              value="loss"
              className="text-sm bg-[#1e1e1e] hover:bg-dark-300"
            >
              Loss
            </SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-dark-600 ml-auto">
          Showing {filteredPositions.length} of {positions.length}
        </span>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-dark-600 text-sm">
            No positions match your filters
          </p>
        </div>
      ) : (
        <div
          ref={tableContainerRef}
          className="overflow-auto max-h-[400px] dark-scrollbar"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-dark-200 z-10">
              <TableRow className="border-dark-300">
                <TableHead className="text-dark-600 bg-dark-200">
                  Symbol
                </TableHead>
                <TableHead className="text-dark-600 bg-dark-200">
                  Side
                </TableHead>
                <TableHead className="text-dark-600 bg-dark-200">
                  Type
                </TableHead>
                <TableHead className="text-dark-600 text-right bg-dark-200">
                  Quantity
                </TableHead>
                <TableHead className="text-dark-600 text-right bg-dark-200">
                  Entry
                </TableHead>
                <TableHead className="text-dark-600 text-right bg-dark-200">
                  Current
                </TableHead>
                <TableHead className="text-dark-600 text-right bg-dark-200">
                  P&L
                </TableHead>
                <TableHead className="text-dark-600 text-right bg-dark-200">
                  SL
                </TableHead>
                <TableHead className="text-dark-600 text-right bg-dark-200">
                  TP
                </TableHead>
                <TableHead className="text-dark-600 bg-dark-200">
                  Opened
                </TableHead>
                <TableHead className="text-dark-600 text-center bg-dark-200">
                  Actions
                </TableHead>
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
                      isProfit ? "bg-green-500/20" : "bg-red-500/20",
                    )}
                  >
                    <TableCell className="font-medium text-light-900">
                      {position.symbol}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-xs font-semibold",
                          isProfit
                            ? "bg-green-500/30 text-green-400"
                            : "bg-red-500/30 text-red-400",
                        )}
                      >
                        {position.side === "long" ? (
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
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold w-fit",
                            !position.orderType ||
                              position.orderType === "market"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-purple-500/20 text-purple-400",
                          )}
                        >
                          {!position.orderType ||
                          position.orderType === "market"
                            ? "⚡ Market"
                            : "📊 Limit"}
                        </span>
                        {position.orderType === "limit" &&
                          position.limitPrice && (
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
                    <TableCell
                      className={cn(
                        "text-right font-bold text-lg",
                        isProfit ? "text-green-400" : "text-red-400",
                      )}
                    >
                      {position.currentPrice.toFixed(5)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className={cn(
                          "font-bold text-lg",
                          isProfit ? "text-green-400" : "text-red-400",
                        )}
                      >
                        {isProfit ? "+" : ""}$
                        {position.unrealizedPnl.toFixed(2)}
                      </div>
                      <div
                        className={cn(
                          "text-sm font-semibold",
                          isProfit ? "text-green-400" : "text-red-400",
                        )}
                      >
                        ({isProfit ? "+" : ""}
                        {position.unrealizedPnlPercentage.toFixed(2)}%)
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-light-900 text-sm">
                      {position.stopLoss ? position.stopLoss.toFixed(5) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-light-900 text-sm">
                      {position.takeProfit
                        ? position.takeProfit.toFixed(5)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-dark-600 text-sm">
                      <div>
                        {new Date(position.openedAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        )}
                      </div>
                      <div className="text-xs">
                        {new Date(position.openedAt).toLocaleTimeString(
                          "en-US",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </div>
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
                          onClick={() =>
                            handleClosePosition(position._id, position.symbol)
                          }
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
        onSuccess={(updatedData) => {
          // ⚡ IMMEDIATE UI UPDATE - update local state with new TP/SL values
          if (selectedPosition) {
            // Store pending edit to prevent price update effect from overwriting
            pendingTPSLEditsRef.current.set(selectedPosition._id, {
              takeProfit: updatedData.takeProfit,
              stopLoss: updatedData.stopLoss,
              timestamp: Date.now(),
            });

            setLivePositions((prev) =>
              prev.map((p) =>
                p._id === selectedPosition._id
                  ? {
                      ...p,
                      takeProfit: updatedData.takeProfit,
                      stopLoss: updatedData.stopLoss,
                    }
                  : p,
              ),
            );

            // Also update the selected position reference
            setSelectedPosition((prev) =>
              prev
                ? {
                    ...prev,
                    takeProfit: updatedData.takeProfit,
                    stopLoss: updatedData.stopLoss,
                  }
                : null,
            );
          }

          // Dispatch event so chart updates TP/SL lines immediately
          window.dispatchEvent(
            new CustomEvent("tpslUpdated", {
              detail: {
                positionId: selectedPosition?._id,
                takeProfit: updatedData.takeProfit,
                stopLoss: updatedData.stopLoss,
              },
            }),
          );

          // Also refresh server data for full sync
          router.refresh();
        }}
      />
    </div>
  );
};

// Memoize the component to prevent re-renders when parent re-renders but positions haven't changed
// But be lenient - always re-render if length or IDs change
export default memo(PositionsTable, (prevProps, nextProps) => {
  // Always re-render if competitionId or challengeId changed
  if (prevProps.competitionId !== nextProps.competitionId) return false;
  if (prevProps.challengeId !== nextProps.challengeId) return false;

  // Always re-render if positions count changed (important for TP/SL closures!)
  if (prevProps.positions.length !== nextProps.positions.length) return false;

  // Check if any position data changed (not just IDs, but also TP/SL values, etc.)
  const prevIds = prevProps.positions
    .map((p) => `${p._id}:${p.takeProfit}:${p.stopLoss}`)
    .join(",");
  const nextIds = nextProps.positions
    .map((p) => `${p._id}:${p.takeProfit}:${p.stopLoss}`)
    .join(",");

  // Return true to skip re-render, false to re-render
  return prevIds === nextIds;
});
