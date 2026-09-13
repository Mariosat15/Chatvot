"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronUp, ChevronDown } from "lucide-react";
import PositionsTable from "./PositionsTable";
import PendingOrders from "./PendingOrders";
import TradeHistory from "./TradeHistory";

interface BottomPositionsPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  positions: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingOrders: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tradeHistory: any[];
  competitionId: string;
  className?: string;
}

export function BottomPositionsPanel({
  positions,
  pendingOrders,
  tradeHistory,
  competitionId,
  className,
}: BottomPositionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState("positions");

  // Calculate counts for badges
  const positionsCount = positions.length;
  const pendingCount = pendingOrders.length;
  const historyCount = tradeHistory.length;

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-t-2xl border border-dark-400/30 shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Header with toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-dark-300/50 hover:bg-dark-300/70 transition-colors border-b border-dark-400/30"
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-light-900 uppercase tracking-wider">
            Trading Activity
          </span>
          
          {/* Quick stats when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-3">
              {positionsCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  {positionsCount} Open
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">
                  {pendingCount} Pending
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="size-5 text-dark-600" />
          ) : (
            <ChevronUp className="size-5 text-dark-600" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "max-h-[400px]" : "max-h-0"
        )}
      >
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-dark-300/80 border border-dark-400/50 mb-4 p-1 rounded-xl backdrop-blur-sm shadow-lg">
              <TabsTrigger
                value="positions"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/30 rounded-lg font-semibold transition-all duration-200 text-sm"
              >
                <span className="flex items-center gap-2">
                  Positions
                  <span className={cn(
                    "inline-flex items-center justify-center size-5 rounded-full text-xs font-bold",
                    activeTab === "positions" ? "bg-white/20" : "bg-emerald-500/20 text-emerald-400"
                  )}>
                    {positionsCount}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/30 rounded-lg font-semibold transition-all duration-200 text-sm"
              >
                <span className="flex items-center gap-2">
                  Pending
                  <span className={cn(
                    "inline-flex items-center justify-center size-5 rounded-full text-xs font-bold",
                    activeTab === "pending" ? "bg-white/20" : "bg-blue-500/20 text-blue-400"
                  )}>
                    {pendingCount}
                  </span>
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 rounded-lg font-semibold transition-all duration-200 text-sm"
              >
                <span className="flex items-center gap-2">
                  History
                  <span className={cn(
                    "inline-flex items-center justify-center size-5 rounded-full text-xs font-bold",
                    activeTab === "history" ? "bg-white/20" : "bg-purple-500/20 text-purple-400"
                  )}>
                    {historyCount}
                  </span>
                </span>
              </TabsTrigger>
            </TabsList>

            <div className="overflow-x-auto max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-dark-400 scrollbar-track-dark-300">
              <TabsContent value="positions" className="mt-0">
                <PositionsTable
                  positions={positions}
                  competitionId={competitionId}
                />
              </TabsContent>

              <TabsContent value="pending" className="mt-0">
                <PendingOrders orders={pendingOrders} />
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <TradeHistory trades={tradeHistory as any} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
