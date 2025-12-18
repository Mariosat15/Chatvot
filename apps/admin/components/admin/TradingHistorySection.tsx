'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  User,
  Trophy,
  Swords,
  ChevronLeft,
  ChevronRight,
  Eye,
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Trade {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  realizedPnlPercentage: number;
  openedAt: string;
  closedAt: string;
  closeReason: string;
  holdingTimeSeconds: number;
  leverage: number;
  marginUsed: number;
  hadStopLoss: boolean;
  stopLossPrice?: number;
  hadTakeProfit: boolean;
  takeProfitPrice?: number;
  isWinner: boolean;
}

interface UserSummary {
  id: string;
  email: string;
  name: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  competitions: number;
  challenges: number;
}

interface ContestInfo {
  id: string;
  name: string;
  type: 'competition' | 'challenge';
  status: string;
  trades: Trade[];
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    largestWin: number;
    largestLoss: number;
    averageHoldingTime: number;
  };
}

interface UserDetail {
  user: UserSummary;
  contests: ContestInfo[];
}

export default function TradingHistorySection() {
  // State
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [contestTypeFilter, setContestTypeFilter] = useState<'all' | 'competition' | 'challenge'>('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [sortBy, setSortBy] = useState<'trades' | 'pnl' | 'winrate'>('trades');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const pageSize = 20;

  // Fetch users with trading history
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        search: searchQuery,
        contestType: contestTypeFilter,
        dateRange,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/trading-history/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setTotalUsers(data.total);
    } catch (error) {
      toast.error('Failed to load trading history');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, contestTypeFilter, dateRange, sortBy, sortOrder]);

  // Fetch user detail
  const fetchUserDetail = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/trading-history/users/${userId}?contestType=${contestTypeFilter}&dateRange=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch user details');
      
      const data = await response.json();
      setSelectedUser(data);
      // Set the first contest as selected
      if (data.contests && data.contests.length > 0) {
        setSelectedContestId(data.contests[0].id);
      }
      setViewMode('detail');
    } catch (error) {
      toast.error('Failed to load user details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Go back to list view
  const goBackToList = () => {
    setSelectedUser(null);
    setSelectedContestId('');
    setViewMode('list');
  };

  // Get selected contest
  const getSelectedContest = () => {
    if (!selectedUser || !selectedContestId) return null;
    return selectedUser.contests.find(c => c.id === selectedContestId) || null;
  };

  // Open trade detail modal
  const openTradeDetail = (trade: Trade) => {
    setSelectedTrade(trade);
    setTradeModalOpen(true);
  };

  // Export to CSV
  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        contestType: contestTypeFilter,
        dateRange,
        format: 'csv',
      });

      const response = await fetch(`/api/trading-history/export?${params}`);
      if (!response.ok) throw new Error('Failed to export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trading-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Export complete');
    } catch (error) {
      toast.error('Export failed');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  // Render User Detail View
  if (viewMode === 'detail' && selectedUser) {
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goBackToList}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Users
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <User className="h-6 w-6 text-cyan-400" />
                {selectedUser.user.name || selectedUser.user.email}
              </h2>
              <p className="text-gray-400 mt-1">
                Complete trading history across all contests
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* User Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{selectedUser.user.totalTrades}</p>
                  <p className="text-xs text-gray-400">Total Trades</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn(
            "bg-gradient-to-br border",
            selectedUser.user.winRate >= 50 
              ? "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
              : "from-red-500/10 to-red-500/5 border-red-500/20"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  selectedUser.user.winRate >= 50 ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  <TrendingUp className={cn(
                    "h-5 w-5",
                    selectedUser.user.winRate >= 50 ? "text-emerald-400" : "text-red-400"
                  )} />
                </div>
                <div>
                  <p className={cn(
                    "text-2xl font-bold",
                    selectedUser.user.winRate >= 50 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {selectedUser.user.winRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">Win Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={cn(
            "bg-gradient-to-br border",
            selectedUser.user.totalPnl >= 0 
              ? "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
              : "from-red-500/10 to-red-500/5 border-red-500/20"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  selectedUser.user.totalPnl >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  <DollarSign className={cn(
                    "h-5 w-5",
                    selectedUser.user.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  )} />
                </div>
                <div>
                  <p className={cn(
                    "text-2xl font-bold",
                    selectedUser.user.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {selectedUser.user.totalPnl >= 0 ? '+' : ''}${selectedUser.user.totalPnl.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">Total P&L</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {selectedUser.user.competitions + selectedUser.user.challenges}
                  </p>
                  <p className="text-xs text-gray-400">Total Contests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contest Selection & Trading History */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4">
              <div>
                <CardTitle className="text-white text-lg">Contest Trading History</CardTitle>
                <CardDescription className="text-gray-400">
                  Select a contest to view individual trades
                </CardDescription>
              </div>
              <div className="w-full max-w-2xl mx-auto">
                <Label className="text-gray-400 text-xs mb-2 block text-center">Select Contest</Label>
                <Select value={selectedContestId} onValueChange={setSelectedContestId}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white w-full">
                    <SelectValue placeholder="Select a contest..." />
                  </SelectTrigger>
                  <SelectContent 
                    className="bg-gray-800 border-gray-700 max-h-[400px]"
                    position="popper"
                    sideOffset={4}
                  >
                    {selectedUser.contests.map((contest) => (
                      <SelectItem 
                        key={contest.id} 
                        value={contest.id}
                        className="text-white hover:bg-gray-700 focus:bg-gray-700 py-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          {contest.type === 'competition' ? (
                            <Trophy className="h-4 w-4 text-orange-400 shrink-0" />
                          ) : (
                            <Swords className="h-4 w-4 text-red-400 shrink-0" />
                          )}
                          <span className="whitespace-nowrap">{contest.name || 'Unnamed'}</span>
                          <Badge variant="outline" className="text-xs border-gray-600 shrink-0 ml-2">
                            {contest.summary.totalTrades} trades
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const contest = getSelectedContest();
              if (!contest) {
                return (
                  <div className="text-center py-12 text-gray-500">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a contest to view trading history</p>
                  </div>
                );
              }

              return (
                <>
                  {/* Contest Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                      <p className="text-sm text-gray-500 mb-1">Trades</p>
                      <p className="text-xl font-bold text-white">{contest.summary.totalTrades}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {contest.summary.winningTrades}W / {contest.summary.losingTrades}L
                      </p>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                      <p className="text-sm text-gray-500 mb-1">Win Rate</p>
                      <p className={cn(
                        "text-xl font-bold",
                        contest.summary.winRate >= 50 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {contest.summary.winRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                      <p className="text-sm text-gray-500 mb-1">Total P&L</p>
                      <p className={cn(
                        "text-xl font-bold",
                        contest.summary.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {contest.summary.totalPnl >= 0 ? '+' : ''}${contest.summary.totalPnl.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                      <p className="text-sm text-gray-500 mb-1">Avg Holding Time</p>
                      <p className="text-xl font-bold text-white">
                        {formatDuration(contest.summary.averageHoldingTime)}
                      </p>
                    </div>
                  </div>

                  {/* Trades Table */}
                  <div className="rounded-lg border border-gray-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700 bg-gray-800/50">
                          <TableHead className="text-gray-400 font-semibold">Symbol</TableHead>
                          <TableHead className="text-gray-400 font-semibold">Side</TableHead>
                          <TableHead className="text-gray-400 font-semibold text-right">Entry Price</TableHead>
                          <TableHead className="text-gray-400 font-semibold text-right">Exit Price</TableHead>
                          <TableHead className="text-gray-400 font-semibold text-right">P&L</TableHead>
                          <TableHead className="text-gray-400 font-semibold text-center">Close Reason</TableHead>
                          <TableHead className="text-gray-400 font-semibold text-center">Duration</TableHead>
                          <TableHead className="text-gray-400 font-semibold">Closed At</TableHead>
                          <TableHead className="text-gray-400 font-semibold text-center">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contest.trades.map((trade) => (
                          <TableRow 
                            key={trade._id} 
                            className="border-gray-700/50 hover:bg-gray-800/30 cursor-pointer"
                            onClick={() => openTradeDetail(trade)}
                          >
                            <TableCell className="font-semibold text-white">
                              {trade.symbol}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "px-3 py-1",
                                  trade.side === 'long' 
                                    ? "border-emerald-500/50 text-emerald-400"
                                    : "border-red-500/50 text-red-400"
                                )}
                              >
                                {trade.side === 'long' ? (
                                  <TrendingUp className="h-4 w-4 mr-1" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 mr-1" />
                                )}
                                {trade.side.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-gray-300 font-mono">
                              {trade.entryPrice.toFixed(5)}
                            </TableCell>
                            <TableCell className="text-right text-gray-300 font-mono">
                              {trade.exitPrice.toFixed(5)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "font-bold",
                                trade.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                              )}>
                                {trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "px-2 py-1",
                                  trade.closeReason === 'take_profit' && "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
                                  trade.closeReason === 'stop_loss' && "border-red-500/50 text-red-400 bg-red-500/10",
                                  trade.closeReason === 'user' && "border-blue-500/50 text-blue-400 bg-blue-500/10",
                                  trade.closeReason === 'margin_call' && "border-orange-500/50 text-orange-400 bg-orange-500/10",
                                )}
                              >
                                {trade.closeReason === 'take_profit' && <Target className="h-4 w-4 mr-1" />}
                                {trade.closeReason === 'stop_loss' && <AlertTriangle className="h-4 w-4 mr-1" />}
                                {trade.closeReason === 'user' && <User className="h-4 w-4 mr-1" />}
                                {trade.closeReason.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-gray-400">
                              {formatDuration(trade.holdingTimeSeconds)}
                            </TableCell>
                            <TableCell className="text-gray-400">
                              {new Date(trade.closedAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTradeDetail(trade);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Trade Detail Modal */}
        <Dialog open={tradeModalOpen} onOpenChange={setTradeModalOpen}>
          <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                Trade Details
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Complete information about this trade
              </DialogDescription>
            </DialogHeader>

            {selectedTrade && (
              <div className="space-y-6">
                {/* Trade Header */}
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-12 w-12 rounded-lg flex items-center justify-center",
                      selectedTrade.side === 'long' ? "bg-emerald-500/20" : "bg-red-500/20"
                    )}>
                      {selectedTrade.side === 'long' ? (
                        <TrendingUp className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{selectedTrade.symbol}</p>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "mt-1",
                          selectedTrade.side === 'long' 
                            ? "border-emerald-500/50 text-emerald-400"
                            : "border-red-500/50 text-red-400"
                        )}
                      >
                        {selectedTrade.side.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-2xl font-bold",
                      selectedTrade.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {selectedTrade.realizedPnl >= 0 ? '+' : ''}${selectedTrade.realizedPnl.toFixed(2)}
                    </p>
                    <p className={cn(
                      "text-sm",
                      selectedTrade.realizedPnl >= 0 ? "text-emerald-400/70" : "text-red-400/70"
                    )}>
                      {selectedTrade.realizedPnlPercentage >= 0 ? '+' : ''}{selectedTrade.realizedPnlPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Trade Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Entry Price</p>
                      <p className="text-lg font-mono text-white">{selectedTrade.entryPrice.toFixed(5)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Exit Price</p>
                      <p className="text-lg font-mono text-white">{selectedTrade.exitPrice.toFixed(5)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Quantity (Lots)</p>
                      <p className="text-lg font-mono text-white">{selectedTrade.quantity}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Leverage</p>
                      <p className="text-lg font-mono text-white">{selectedTrade.leverage}x</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Margin Used</p>
                      <p className="text-lg font-mono text-white">${selectedTrade.marginUsed.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Close Reason</p>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-sm",
                          selectedTrade.closeReason === 'take_profit' && "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
                          selectedTrade.closeReason === 'stop_loss' && "border-red-500/50 text-red-400 bg-red-500/10",
                          selectedTrade.closeReason === 'user' && "border-blue-500/50 text-blue-400 bg-blue-500/10",
                          selectedTrade.closeReason === 'margin_call' && "border-orange-500/50 text-orange-400 bg-orange-500/10",
                        )}
                      >
                        {selectedTrade.closeReason.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Holding Time</p>
                      <p className="text-lg text-white">{formatDuration(selectedTrade.holdingTimeSeconds)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <p className="text-xs text-gray-500 mb-1">Result</p>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-sm",
                          selectedTrade.isWinner 
                            ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                            : "border-red-500/50 text-red-400 bg-red-500/10"
                        )}
                      >
                        {selectedTrade.isWinner ? (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        {selectedTrade.isWinner ? 'Winner' : 'Loser'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Stop Loss / Take Profit Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-1">Stop Loss</p>
                    {selectedTrade.hadStopLoss ? (
                      <p className="text-lg font-mono text-red-400">{selectedTrade.stopLossPrice?.toFixed(5)}</p>
                    ) : (
                      <p className="text-lg text-gray-500">Not set</p>
                    )}
                  </div>
                  <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-1">Take Profit</p>
                    {selectedTrade.hadTakeProfit ? (
                      <p className="text-lg font-mono text-emerald-400">{selectedTrade.takeProfitPrice?.toFixed(5)}</p>
                    ) : (
                      <p className="text-lg text-gray-500">Not set</p>
                    )}
                  </div>
                </div>

                {/* Timing Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-1">Opened At</p>
                    <p className="text-sm text-white">{new Date(selectedTrade.openedAt).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    <p className="text-xs text-gray-500 mb-1">Closed At</p>
                    <p className="text-sm text-white">{new Date(selectedTrade.closedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render Users List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-cyan-400" />
            Trading History
          </h2>
          <p className="text-gray-400 mt-1">
            View and analyze trading history for all users across competitions and challenges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers()}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <Label className="text-gray-400 text-xs mb-1.5 block">Search User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by email or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-900/50 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Contest Type Filter */}
            <div className="w-[160px]">
              <Label className="text-gray-400 text-xs mb-1.5 block">Contest Type</Label>
              <Select value={contestTypeFilter} onValueChange={(v: 'all' | 'competition' | 'challenge') => setContestTypeFilter(v)}>
                <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="competition">Competitions</SelectItem>
                  <SelectItem value="challenge">Challenges</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="w-[140px]">
              <Label className="text-gray-400 text-xs mb-1.5 block">Date Range</Label>
              <Select value={dateRange} onValueChange={(v: 'all' | '7d' | '30d' | '90d') => setDateRange(v)}>
                <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="w-[140px]">
              <Label className="text-gray-400 text-xs mb-1.5 block">Sort By</Label>
              <Select value={sortBy} onValueChange={(v: 'trades' | 'pnl' | 'winrate') => setSortBy(v)}>
                <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="trades">Total Trades</SelectItem>
                  <SelectItem value="pnl">Total P&L</SelectItem>
                  <SelectItem value="winrate">Win Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 h-10"
            >
              {sortOrder === 'desc' ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <User className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
                <p className="text-xs text-gray-400">Active Traders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.reduce((sum, u) => sum + u.competitions, 0)}
                </p>
                <p className="text-xs text-gray-400">Competition Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Swords className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.reduce((sum, u) => sum + u.challenges, 0)}
                </p>
                <p className="text-xs text-gray-400">Challenge Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.reduce((sum, u) => sum + u.totalTrades, 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">Total Trades</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">Users Trading Summary</CardTitle>
          <CardDescription className="text-gray-400">
            Click on a user to view their detailed trading history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-gray-800/50">
                  <TableHead className="text-gray-400">User</TableHead>
                  <TableHead className="text-gray-400 text-center">Trades</TableHead>
                  <TableHead className="text-gray-400 text-center">Win Rate</TableHead>
                  <TableHead className="text-gray-400 text-right">Total P&L</TableHead>
                  <TableHead className="text-gray-400 text-center">Competitions</TableHead>
                  <TableHead className="text-gray-400 text-center">Challenges</TableHead>
                  <TableHead className="text-gray-400 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-500" />
                      <p className="text-gray-500 mt-2">Loading...</p>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <User className="h-8 w-8 mx-auto text-gray-600" />
                      <p className="text-gray-500 mt-2">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      className="border-gray-700 hover:bg-gray-800/50 cursor-pointer"
                      onClick={() => fetchUserDetail(user.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{user.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-white font-medium">{user.totalTrades}</span>
                          <span className="text-xs text-gray-500">
                            ({user.winningTrades}W / {user.losingTrades}L)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "font-medium",
                            user.winRate >= 50 
                              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                              : "border-red-500/50 text-red-400 bg-red-500/10"
                          )}
                        >
                          {user.winRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-bold",
                          user.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {user.totalPnl >= 0 ? '+' : ''}${user.totalPnl.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                          <Trophy className="h-3 w-3 mr-1" />
                          {user.competitions}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-red-500/50 text-red-400">
                          <Swords className="h-3 w-3 mr-1" />
                          {user.challenges}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalUsers)} of {totalUsers}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-gray-700 text-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-gray-400 text-sm px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border-gray-700 text-gray-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

