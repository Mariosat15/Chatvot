'use client';

import { useState } from 'react';
import { useChartSymbol } from '@/contexts/ChartSymbolContext';
import { usePrices } from '@/contexts/PriceProvider';
import { useTradingMode } from './TradingInterface';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import GameChart from './GameChart';
import GameModeOrderForm from './GameModeOrderForm';
import GameModeStatsPanel from './GameModeStatsPanel';
import GameModePositions from './GameModePositions';
import { ArrowLeft, Clock, Users, Trophy, Timer, ChevronDown, Swords, Scroll, Monitor, Gamepad2 } from 'lucide-react';
import { FOREX_PAIRS, type ForexSymbol } from '@/lib/services/pnl-calculator.service';

interface Position {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
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

interface GameModeTradingPageProps {
  competition: Competition;
  participant: Participant;
  positions: Position[];
  competitionId: string;
  defaultLeverage: number;
  startingCapital: number;
  isDisqualified?: boolean;
}

export default function GameModeTradingPage({
  competition,
  participant,
  positions,
  competitionId,
  defaultLeverage,
  startingCapital,
  isDisqualified = false,
}: GameModeTradingPageProps) {
  const { symbol, setSymbol } = useChartSymbol();
  const { prices, marketOpen } = usePrices();
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  
  const equity = participant.currentCapital + participant.unrealizedPnl;
  const marginLevel = participant.usedMargin > 0 
    ? (equity / participant.usedMargin) * 100 
    : Infinity;
  
  // Calculate time remaining
  const endTime = new Date(competition.endTime);
  const now = new Date();
  const timeRemaining = endTime.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  
  // Popular symbols for quick access
  const popularSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'USD/CHF'];
  
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
                <span className="text-purple-300 text-sm font-medium">Exit</span>
              </Link>
              
              <div className="flex items-center gap-3">
                <div className="text-2xl">⚔️</div>
                <div>
                  <h1 className="text-xl font-bold text-white">{competition.name}</h1>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "flex items-center gap-1",
                      marketOpen ? "text-green-400" : "text-red-400"
                    )}>
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        marketOpen ? "bg-green-400 animate-pulse" : "bg-red-400"
                      )} />
                      {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Quick Stats Bar */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <Image src="/game-icons/timer.png" alt="Time" width={20} height={20} />
                <span className="text-purple-300 text-sm">{daysRemaining}d {hoursRemaining}h left</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <Image src="/game-icons/treasure.png" alt="Prize" width={20} height={20} />
                <span className="text-yellow-300 text-sm">${competition.prizePool.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300 text-sm">{competition.currentParticipants} players</span>
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
            {/* Symbol Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <button
                  onClick={() => setShowSymbolPicker(!showSymbolPicker)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
                >
                  <span className="text-lg">🎮</span>
                  <span>{symbol}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showSymbolPicker && "rotate-180")} />
                </button>
                
                {showSymbolPicker && (
                  <div className="absolute top-full left-0 mt-2 z-50 bg-[#1a1a2e] border-2 border-purple-500/50 rounded-xl shadow-2xl shadow-purple-500/20 p-3 min-w-[200px]">
                    <div className="text-xs text-gray-500 mb-2 px-2">Popular Pairs</div>
                    <div className="space-y-1">
                      {Object.keys(FOREX_PAIRS).map((pair) => (
                        <button
                          key={pair}
                          onClick={() => {
                            setSymbol(pair);
                            setShowSymbolPicker(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-left font-medium text-sm transition-all",
                            symbol === pair
                              ? "bg-purple-500/30 text-purple-300"
                              : "hover:bg-dark-400 text-gray-400"
                          )}
                        >
                          {pair}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Quick Symbol Buttons */}
              {popularSymbols.filter(s => s !== symbol).slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className="px-3 py-2 bg-dark-400/50 hover:bg-dark-400 border border-dark-300 rounded-lg text-gray-400 text-sm font-medium transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            
            {/* Chart */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 overflow-hidden shadow-2xl shadow-purple-500/10">
              <GameChart 
                competitionId={competitionId} 
                positions={positions.filter(p => p.symbol === symbol)} 
              />
            </div>
            
            {/* Positions - Collapsible on Mobile */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="w-5 h-5 text-purple-400" />
                <h2 className="text-white font-bold">Active Battles ({positions.length})</h2>
              </div>
              <GameModePositions positions={positions} competitionId={competitionId} />
            </div>
          </div>
          
          {/* Right Column - Trading Interface & Stats */}
          <div className="xl:col-span-4 space-y-4">
            {/* Stats Panel */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/game-icons/chest.png" alt="Stats" width={20} height={20} />
                <h2 className="text-white font-bold">Your Treasury</h2>
              </div>
              <GameModeStatsPanel
                balance={participant.currentCapital}
                equity={equity}
                unrealizedPnl={participant.unrealizedPnl}
                usedMargin={participant.usedMargin}
                availableCapital={participant.availableCapital}
                marginLevel={marginLevel}
                startingCapital={startingCapital}
                positionCount={positions.length}
              />
            </div>
            
            {/* Order Form */}
            <div className="sticky top-4">
              <GameModeOrderForm
                competitionId={competitionId}
                availableCapital={participant.availableCapital}
                defaultLeverage={defaultLeverage}
                currentBalance={participant.currentCapital}
                disabled={isDisqualified}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Click Outside Handler for Symbol Picker */}
      {showSymbolPicker && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowSymbolPicker(false)} 
        />
      )}
    </div>
  );
}

// Mode Toggle Component
function ModeToggle() {
  const { mode, setMode } = useTradingMode();
  
  return (
    <div className="flex items-center gap-1 bg-dark-400/50 p-1 rounded-lg border border-purple-500/30">
      <button
        onClick={() => setMode('professional')}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
          mode === 'professional' 
            ? "bg-blue-500 text-white" 
            : "text-gray-400 hover:text-white"
        )}
        title="Professional Mode"
      >
        <Monitor className="w-3 h-3" />
        <span className="hidden lg:inline">Pro</span>
      </button>
      <button
        onClick={() => setMode('game')}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
          mode === 'game' 
            ? "bg-purple-500 text-white" 
            : "text-gray-400 hover:text-white"
        )}
        title="Game Mode"
      >
        <Gamepad2 className="w-3 h-3" />
        <span className="hidden lg:inline">Game</span>
      </button>
    </div>
  );
}
