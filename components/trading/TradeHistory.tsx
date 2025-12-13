'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDragScroll } from '@/hooks/useDragScroll';

interface HistoricalTrade {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  realizedPnlPercentage: number;
  marginUsed: number;
  entrySpread?: number;
  exitSpread?: number;
  totalCosts?: number;
  openedAt: string;
  closedAt: string;
  closeReason: 'manual' | 'stop_loss' | 'take_profit' | 'liquidation';
}

interface TradeHistoryProps {
  trades: HistoricalTrade[];
}

const TradeHistory = ({ trades }: TradeHistoryProps) => {
  const tableContainerRef = useDragScroll<HTMLDivElement>();
  
  // Filters
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const [filterSide, setFilterSide] = useState<string>('all');
  const [filterPnL, setFilterPnL] = useState<string>('all');
  const [filterReason, setFilterReason] = useState<string>('all');

  // Apply filters
  const filteredTrades = trades.filter((trade) => {
    if (filterSymbol !== 'all' && trade.symbol !== filterSymbol) return false;
    if (filterSide !== 'all' && trade.side !== filterSide) return false;
    if (filterPnL === 'profit' && trade.realizedPnl <= 0) return false;
    if (filterPnL === 'loss' && trade.realizedPnl >= 0) return false;
    if (filterReason !== 'all' && trade.closeReason !== filterReason) return false;
    return true;
  });

  // Get unique symbols for filter
  const uniqueSymbols = Array.from(new Set(trades.map((t) => t.symbol)));

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-600">No trade history yet</p>
        <p className="text-sm text-dark-700 mt-1">Closed trades will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Spread Cost Explanation */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-400 mb-1">Understanding Spread Costs</h4>
            <p className="text-xs text-dark-600 leading-relaxed">
              When you trade Forex, you <strong>buy at ASK price</strong> (higher) and <strong>sell at BID price</strong> (lower). 
              The difference is called the <strong>spread</strong> - this is how brokers make money. Your P&L already includes this cost. 
              For example: if the price shows 1.10000/1.10003 (BID/ASK), you pay 3 pips spread when opening AND closing.
            </p>
          </div>
        </div>
      </div>

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

        <Select value={filterReason} onValueChange={setFilterReason}>
          <SelectTrigger className="h-9 text-sm w-[120px] bg-dark-300 border-dark-400">
            <SelectValue placeholder="Reason" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e1e] border-dark-400 z-50">
            <SelectItem value="all" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">All Reasons</SelectItem>
            <SelectItem value="manual" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Manual</SelectItem>
            <SelectItem value="stop_loss" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Stop Loss</SelectItem>
            <SelectItem value="take_profit" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Take Profit</SelectItem>
            <SelectItem value="liquidation" className="text-sm bg-[#1e1e1e] hover:bg-dark-300">Liquidation</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-dark-600 ml-auto">
          Showing {filteredTrades.length} of {trades.length}
        </span>
      </div>

      {filteredTrades.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-dark-600 text-sm">No trades match your filters</p>
        </div>
      ) : (
    <div 
      ref={tableContainerRef}
      className="overflow-x-auto overflow-y-auto scrollbar-hide max-h-[500px] md:max-h-[600px]" 
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <Table>
        <TableHeader className="sticky top-0 bg-dark-200 z-10">
          <TableRow className="border-dark-300">
            <TableHead className="text-dark-600 bg-dark-200">Symbol</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Side</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Type</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">Quantity</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">Entry</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">Exit</TableHead>
            <TableHead className="text-dark-600 text-right bg-dark-200">P&L</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Opened</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Closed</TableHead>
            <TableHead className="text-dark-600 bg-dark-200">Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTrades.map((trade) => {
            const isProfit = trade.realizedPnl >= 0;
            return (
              <TableRow 
                key={trade._id} 
                className={cn(
                  "border-dark-300",
                  isProfit ? "bg-green-500/10" : "bg-red-500/10"
                )}
              >
                <TableCell className="font-medium text-light-900">
                  {trade.symbol}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'px-2 py-1 rounded text-xs font-semibold',
                      trade.side === 'long'
                        ? 'bg-green-500/30 text-green-400'
                        : 'bg-red-500/30 text-red-400'
                    )}
                  >
                    {trade.side === 'long' ? (
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
                      (!trade.orderType || trade.orderType === 'market')
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    )}>
                      {(!trade.orderType || trade.orderType === 'market') ? '⚡ Market' : '📊 Limit'}
                    </span>
                    {trade.orderType === 'limit' && trade.limitPrice && (
                      <span className="text-xs text-dark-600">
                        Limit: {trade.limitPrice.toFixed(5)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-light-900 font-mono">
                  {trade.quantity}
                </TableCell>
                <TableCell className="text-right text-light-900 font-mono text-sm">
                  {trade.entryPrice.toFixed(5)}
                </TableCell>
                <TableCell className="text-right text-light-900 font-mono text-sm">
                  {trade.exitPrice.toFixed(5)}
                </TableCell>
                <TableCell className="text-right">
                  <div className={cn('font-bold text-lg', isProfit ? 'text-green-400' : 'text-red-400')}>
                    {isProfit ? '+' : ''}${trade.realizedPnl.toFixed(2)}
                  </div>
                  <div className={cn('text-sm font-semibold', isProfit ? 'text-green-400' : 'text-red-400')}>
                    ({isProfit ? '+' : ''}
                    {trade.realizedPnlPercentage.toFixed(2)}%)
                  </div>
                  {trade.totalCosts && trade.totalCosts > 0 && (
                    <div className="text-xs text-amber-500 mt-1" title="Spread cost already included in P&L">
                      📊 Spread: ${trade.totalCosts.toFixed(2)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-dark-600 text-sm">
                  <div>{new Date(trade.openedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div className="text-xs">{new Date(trade.openedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </TableCell>
                <TableCell className="text-dark-600 text-sm">
                  <div>{new Date(trade.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div className="text-xs">{new Date(trade.closedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </TableCell>
                <TableCell className="text-sm">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    trade.closeReason === 'manual' && 'bg-blue-500/20 text-blue-400',
                    trade.closeReason === 'stop_loss' && 'bg-red-500/20 text-red-400',
                    trade.closeReason === 'take_profit' && 'bg-green-500/20 text-green-400',
                    trade.closeReason === 'liquidation' && 'bg-orange-500/20 text-orange-400'
                  )}>
                    {trade.closeReason === 'manual' && '🔘 Manual'}
                    {trade.closeReason === 'stop_loss' && '🛑 Stop Loss'}
                    {trade.closeReason === 'take_profit' && '🎯 Take Profit'}
                    {trade.closeReason === 'liquidation' && '⚠️ Liquidation'}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
      )}
    </div>
  );
};

export default TradeHistory;

