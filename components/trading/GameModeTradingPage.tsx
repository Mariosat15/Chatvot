"use client";

import { useChartSymbol } from "@/contexts/ChartSymbolContext";
import { usePrices } from "@/contexts/PriceProvider";
import { useTradingMode } from "./TradingInterface";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import GameChart from "./GameChart";
import GameModeSimpleOrderForm from "./GameModeSimpleOrderForm";
import GameModePositions from "./GameModePositions";
import GameMarketWatchSidebar from "./GameMarketWatchSidebar";
import GameLiveRankingPanel from "./GameLiveRankingPanel";
import { ArrowLeft, Users, Monitor, Gamepad2, TrendingUp, TrendingDown } from "lucide-react";
import { MarginStatusIndicator } from "./MarginStatusIndicator";
import { getMarginStatus } from "@/lib/services/risk-manager.service";
import { useLiveAccountStats } from "@/hooks/useLiveAccountStats";

interface Position {
  _id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  takeProfit?: number;
  stopLoss?: number;
  currentPrice: number;
}

interface Competition {
  _id: string;
  name: string;
  endTime: Date;
  currentParticipants: number;
  prizePool: number;
}

interface Participant {
  currentCapital: number;
  availableCapital: number;
  unrealizedPnl: number;
  usedMargin: number;
  currentOpenPositions: number;
}

interface MarginThresholds {
  LIQUIDATION: number;
  MARGIN_CALL: number;
  WARNING: number;
  SAFE?: number;
}

interface GameModeTradingPageProps {
  competition: Competition;
  participant: Participant;
  positions: Position[];
  competitionId: string;
  defaultLeverage: number;
  startingCapital: number;
  isDisqualified?: boolean;
  marginThresholds?: MarginThresholds;
  userId?: string;
}

export default function GameModeTradingPage({
  competition,
  participant,
  positions,
  competitionId,
  defaultLeverage,
  startingCapital,
  isDisqualified = false,
  marginThresholds,
  userId,
}: GameModeTradingPageProps) {
  const { symbol } = useChartSymbol();
  const { marketOpen } = usePrices();

  // Reason: Use the same live PnL calculation as pro mode so stats update on every price tick.
  const {
    liveUnrealizedPnl,
    liveEquity,
    liveAvailableCapital,
    liveMarginLevel,
  } = useLiveAccountStats({
    balance: participant.currentCapital,
    usedMargin: participant.usedMargin,
    positions,
    liquidationThreshold: marginThresholds?.LIQUIDATION ?? 50,
    marginCallThreshold: marginThresholds?.MARGIN_CALL ?? 100,
  });

  const marginLevel = liveMarginLevel;

  const marginStatus = getMarginStatus(
    participant.currentCapital,
    liveUnrealizedPnl,
    participant.usedMargin,
    marginThresholds
      ? {
          liquidation: marginThresholds.LIQUIDATION,
          marginCall: marginThresholds.MARGIN_CALL,
          warning: marginThresholds.WARNING,
        }
      : undefined,
  );

  // Calculate time remaining
  const endTime = new Date(competition.endTime);
  const now = new Date();
  const timeRemaining = endTime.getTime() - now.getTime();
  const daysRemaining = Math.max(
    0,
    Math.floor(timeRemaining / (1000 * 60 * 60 * 24)),
  );
  const hoursRemaining = Math.max(
    0,
    Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e]">
      {/* Gaming Header */}
      <div className="relative bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b-2 border-purple-500/50">
        <div className="absolute inset-0 bg-[url('/images/noise.png')] opacity-5" />

        <div className="container mx-auto px-4 py-3 relative">
          <div className="flex items-center justify-between">
            {/* Back Button & Title */}
            <div className="flex items-center gap-4">
              <Link
                href={`/competitions/${competitionId}`}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4 text-purple-400 group-hover:-translate-x-1 transition-transform" />
                <span className="text-purple-300 text-sm font-medium">
                  Exit
                </span>
              </Link>

              <div className="flex items-center gap-3">
                <div className="text-2xl">⚔️</div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {competition.name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        marketOpen ? "text-green-400" : "text-red-400",
                      )}
                    >
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          marketOpen
                            ? "bg-green-400 animate-pulse"
                            : "bg-red-400",
                        )}
                      />
                      {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <Image
                  src="/game-icons/timer.png"
                  alt="Time"
                  width={20}
                  height={20}
                />
                <span className="text-purple-300 text-sm">
                  {daysRemaining}d {hoursRemaining}h left
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <Image
                  src="/game-icons/treasure.png"
                  alt="Prize"
                  width={20}
                  height={20}
                />
                <span className="text-yellow-300 text-sm">
                  ${competition.prizePool.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300 text-sm">
                  {competition.currentParticipants} players
                </span>
              </div>

              {/* Mode Toggle */}
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left Column - Chart & Positions */}
          <div className="xl:col-span-8 space-y-4">
            {/* Margin Warning Banner */}
            <MarginStatusIndicator
              status={marginStatus.status}
              marginLevel={marginLevel}
              message={marginStatus.message}
              mode="game"
              openPositionsCount={positions.length}
            />

            {/* Chart */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 overflow-hidden shadow-2xl shadow-purple-500/10">
              <GameChart
                competitionId={competitionId}
                positions={positions.filter((p) => p.symbol === symbol)}
              />
            </div>

            {/* Positions - Simplified */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚔️</span>
                  <h2 className="text-white font-bold">
                    Your Trades ({positions.length})
                  </h2>
                </div>
                {positions.length > 0 && (
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-bold",
                    liveUnrealizedPnl >= 0 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-red-500/20 text-red-400"
                  )}>
                    {liveUnrealizedPnl >= 0 ? "+" : ""}{liveUnrealizedPnl.toFixed(2)}
                  </div>
                )}
              </div>
              <GameModePositions
                positions={positions}
                competitionId={competitionId}
              />
            </div>

            {/* Simplified Stats - Beginner Friendly */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📊</span>
                <h2 className="text-white font-bold">Your Progress</h2>
              </div>

              {/* Simple Progress Display */}
              <div className="space-y-4">
                {/* Main P&L Display - Big & Clear */}
                <div className={cn(
                  "rounded-xl p-4 text-center border-2",
                  liveEquity >= startingCapital
                    ? "bg-gradient-to-br from-green-500/20 to-emerald-600/10 border-green-500/50"
                    : "bg-gradient-to-br from-red-500/20 to-rose-600/10 border-red-500/50"
                )}>
                  <div className="text-gray-300 text-sm mb-2">Total Profit/Loss</div>
                  <div className={cn(
                    "text-3xl font-black flex items-center justify-center gap-2",
                    liveEquity >= startingCapital ? "text-green-400" : "text-red-400"
                  )}>
                    {liveEquity >= startingCapital ? (
                      <TrendingUp className="w-8 h-8" />
                    ) : (
                      <TrendingDown className="w-8 h-8" />
                    )}
                    {liveEquity >= startingCapital ? "+" : ""}
                    ${(liveEquity - startingCapital).toFixed(2)}
                  </div>
                  <div className={cn(
                    "text-sm mt-1",
                    liveEquity >= startingCapital ? "text-green-300" : "text-red-300"
                  )}>
                    {((liveEquity - startingCapital) / startingCapital * 100).toFixed(2)}% from start
                  </div>
                </div>

                {/* Simple Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-purple-500/10 rounded-xl p-3 text-center border border-purple-500/20">
                    <div className="text-purple-300 text-xs mb-1">💰 Started</div>
                    <div className="text-white font-bold">${startingCapital.toLocaleString()}</div>
                  </div>
                  <div className="bg-blue-500/10 rounded-xl p-3 text-center border border-blue-500/20">
                    <div className="text-blue-300 text-xs mb-1">💎 Now</div>
                    <div className="text-white font-bold">${liveEquity.toFixed(2)}</div>
                  </div>
                  <div className="bg-cyan-500/10 rounded-xl p-3 text-center border border-cyan-500/20">
                    <div className="text-cyan-300 text-xs mb-1">💵 Free</div>
                    <div className="text-white font-bold">${liveAvailableCapital.toFixed(2)}</div>
                  </div>
                </div>

                {/* Account Health Bar */}
                <div className="bg-dark-400/30 rounded-xl p-3 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Account Health</span>
                    <span className={cn(
                      "text-sm font-bold",
                      marginLevel > 300 ? "text-green-400" : marginLevel > 150 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {marginLevel > 300 ? "😊 Great!" : marginLevel > 150 ? "😐 OK" : "😰 Low"}
                    </span>
                  </div>
                  <div className="h-3 bg-dark-500 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        marginLevel > 300 ? "bg-gradient-to-r from-green-500 to-emerald-400" 
                          : marginLevel > 150 ? "bg-gradient-to-r from-yellow-500 to-orange-400" 
                          : "bg-gradient-to-r from-red-500 to-rose-400"
                      )}
                      style={{ width: `${Math.min(100, marginLevel / 5)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Market Watch, Leaderboard & Trade Station */}
          <div className="xl:col-span-4 space-y-4">
            {/* Market Watch Sidebar */}
            <GameMarketWatchSidebar />

            {/* Live Ranking Leaderboard */}
            <GameLiveRankingPanel
              competitionId={competitionId}
              userId={userId}
            />

            {/* Simplified Order Form for Beginners */}
            <GameModeSimpleOrderForm
              competitionId={competitionId}
              availableCapital={liveAvailableCapital}
              defaultLeverage={defaultLeverage}
              currentBalance={participant.currentCapital}
              startingCapital={startingCapital}
              currentEquity={liveEquity}
              usedMargin={participant.usedMargin}
              openPositionsCount={positions.length}
              maxPositions={10}
              disabled={isDisqualified}
              marginThresholds={marginThresholds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Mode Toggle Component
function ModeToggle() {
  const { mode, setMode } = useTradingMode();

  return (
    <div className="flex items-center gap-1 bg-dark-400/50 p-1 rounded-lg border border-purple-500/30">
      <button
        onClick={() => setMode("professional")}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
          mode === "professional"
            ? "bg-blue-500 text-white"
            : "text-gray-400 hover:text-white",
        )}
        title="Professional Mode"
      >
        <Monitor className="w-3 h-3" />
        <span className="hidden lg:inline">Pro</span>
      </button>
      <button
        onClick={() => setMode("game")}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
          mode === "game"
            ? "bg-purple-500 text-white"
            : "text-gray-400 hover:text-white",
        )}
        title="Game Mode"
      >
        <Gamepad2 className="w-3 h-3" />
        <span className="hidden lg:inline">Game</span>
      </button>
    </div>
  );
}
