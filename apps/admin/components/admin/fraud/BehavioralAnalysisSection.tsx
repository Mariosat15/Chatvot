'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  Activity, Users, RefreshCw, Search, 
  AlertTriangle, BarChart3, Target,
  GitCompare, Play, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProfileSummary {
  userId: string;
  totalTrades: number;
  preferredPairs: string[];
  tradingStyle: string;
  winRate: number;
  avgDuration: string;
  riskLevel: string;
  lastUpdated: string;
}

interface SimilarityPair {
  userId1: string;
  userId2: string;
  similarityScore: string;
  breakdown: {
    pairSimilarity: number;
    timingSimilarity: number;
    sizeSimilarity: number;
    durationSimilarity: number;
    riskSimilarity: number;
    styleScore: number;
    fingerprintDistance: number;
  };
  mirrorTradingDetected: boolean;
  flaggedForReview: boolean;
  lastCalculated: string;
}

interface MirrorTradingPair {
  userId1: string;
  userId2: string;
  score: number;
  matchingTrades: number;
  directionPattern: string;
  detectedAt: string;
}

interface Stats {
  profileCount: number;
  highSimilarityCount: number;
  mirrorTradingCount: number;
  flaggedCount: number;
}

export default function BehavioralAnalysisSection() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [similarities, setSimilarities] = useState<SimilarityPair[]>([]);
  const [mirrorPairs, setMirrorPairs] = useState<MirrorTradingPair[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, similarRes, mirrorRes, statsRes] = await Promise.all([
        fetch('/api/fraud/behavioral-analysis?action=profiles'),
        fetch('/api/fraud/behavioral-analysis?action=similar&threshold=0.7'),
        fetch('/api/fraud/behavioral-analysis?action=mirror-trading'),
        fetch('/api/fraud/behavioral-analysis?action=stats')
      ]);

      if (profilesRes.ok) {
        const data = await profilesRes.json();
        setProfiles(data.profiles || []);
      }

      if (similarRes.ok) {
        const data = await similarRes.json();
        setSimilarities(data.similarities || []);
      }

      if (mirrorRes.ok) {
        const data = await mirrorRes.json();
        setMirrorPairs(data.mirrorTradingPairs || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching behavioral data:', error);
      toast.error('Failed to load behavioral analysis data');
    } finally {
      setLoading(false);
    }
  };

  const runFullAnalysis = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/fraud/behavioral-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-full-analysis' })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Analysis complete! ${data.analysis.pairsCompared} pairs compared, ` +
          `${data.analysis.highSimilarityPairs} high similarity found`
        );
        await fetchData();
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      toast.error('Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const viewProfile = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/fraud/behavioral-analysis?action=profile&userId=${userId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSelectedProfile(data.profile);
        setShowProfileDialog(true);
      }
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'scalper': return '⚡';
      case 'dayTrader': return '☀️';
      case 'swing': return '📈';
      default: return '❓';
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'scalper': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'dayTrader': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'swing': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Conservative': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Aggressive': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'No SL': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.preferredPairs.some(pair => pair.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-400" />
            Behavioral Analysis
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Analyze trading patterns to detect multi-accounting and coordinated trading
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="border-gray-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={runFullAnalysis}
            disabled={analyzing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Full Analysis
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Trading Profiles</p>
                <p className="text-2xl font-bold text-gray-100">{stats?.profileCount || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">High Similarity Pairs</p>
                <p className="text-2xl font-bold text-yellow-400">{stats?.highSimilarityCount || 0}</p>
              </div>
              <GitCompare className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Mirror Trading</p>
                <p className="text-2xl font-bold text-red-400">{stats?.mirrorTradingCount || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Flagged for Review</p>
                <p className="text-2xl font-bold text-orange-400">{stats?.flaggedCount || 0}</p>
              </div>
              <Target className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mirror Trading Pairs */}
      {mirrorPairs.length > 0 && (
        <Card className="bg-gray-900 border-red-700/50">
          <CardHeader>
            <CardTitle className="text-gray-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Mirror Trading Detected
            </CardTitle>
            <CardDescription className="text-gray-400">
              Accounts with synchronized or opposite trading patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mirrorPairs.map((pair, index) => (
                <div key={index} className="p-4 bg-red-900/20 rounded-lg border border-red-700/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Account 1</p>
                        <p className="font-mono text-sm text-gray-300">
                          {pair.userId1.substring(0, 12)}...
                        </p>
                      </div>
                      <div className="text-2xl">🪞</div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Account 2</p>
                        <p className="font-mono text-sm text-gray-300">
                          {pair.userId2.substring(0, 12)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={pair.directionPattern === 'Opposite' 
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }>
                        {pair.directionPattern} Direction
                      </Badge>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Confidence</p>
                        <p className="text-lg font-bold text-red-400">
                          {(pair.score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Matches</p>
                        <p className="text-lg font-bold text-gray-300">
                          {pair.matchingTrades}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* High Similarity Pairs */}
      {similarities.length > 0 && (
        <Card className="bg-gray-900 border-yellow-700/50">
          <CardHeader>
            <CardTitle className="text-gray-100 flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-yellow-400" />
              High Similarity Pairs (&gt;70%)
            </CardTitle>
            <CardDescription className="text-gray-400">
              Account pairs with similar trading behavior patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {similarities.slice(0, 10).map((pair, index) => (
                <div key={index} className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <code className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
                        {pair.userId1.substring(0, 12)}...
                      </code>
                      <span className="text-gray-500">↔</span>
                      <code className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
                        {pair.userId2.substring(0, 12)}...
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      {pair.mirrorTradingDetected && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          🪞 Mirror Trading
                        </Badge>
                      )}
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-3">
                        {pair.similarityScore}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Breakdown */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Pairs</p>
                      <Progress value={pair.breakdown.pairSimilarity * 100} className="h-1 mt-1" />
                      <p className="text-gray-400 mt-0.5">{(pair.breakdown.pairSimilarity * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Timing</p>
                      <Progress value={pair.breakdown.timingSimilarity * 100} className="h-1 mt-1" />
                      <p className="text-gray-400 mt-0.5">{(pair.breakdown.timingSimilarity * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Size</p>
                      <Progress value={pair.breakdown.sizeSimilarity * 100} className="h-1 mt-1" />
                      <p className="text-gray-400 mt-0.5">{(pair.breakdown.sizeSimilarity * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Style</p>
                      <Progress value={pair.breakdown.styleScore * 100} className="h-1 mt-1" />
                      <p className="text-gray-400 mt-0.5">{(pair.breakdown.styleScore * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trading Profiles */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Trading Profiles
              </CardTitle>
              <CardDescription className="text-gray-400">
                Individual user trading behavior analysis
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by ID or pair..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-800 border-gray-700"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No trading profiles found</p>
              <p className="text-gray-500 text-sm mt-2">
                Profiles are created when users close trades
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map((profile) => (
                <div 
                  key={profile.userId}
                  className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => viewProfile(profile.userId)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <code className="text-xs text-gray-400 font-mono">
                      {profile.userId.substring(0, 16)}...
                    </code>
                    <Badge className={getStyleColor(profile.tradingStyle)}>
                      {getStyleIcon(profile.tradingStyle)} {profile.tradingStyle}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Trades</p>
                      <p className="text-gray-200 font-semibold">{profile.totalTrades}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Win Rate</p>
                      <p className={`font-semibold ${profile.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {profile.winRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Avg Duration</p>
                      <p className="text-gray-200">{profile.avgDuration}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Risk</p>
                      <Badge className={getRiskColor(profile.riskLevel)} variant="outline">
                        {profile.riskLevel}
                      </Badge>
                    </div>
                  </div>
                  
                  {profile.preferredPairs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-gray-500 text-xs mb-1">Preferred Pairs</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.preferredPairs.slice(0, 3).map((pair) => (
                          <Badge key={pair} variant="outline" className="border-gray-600 text-xs">
                            {pair}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Detail Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Trading Profile Details
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Detailed behavioral analysis for this user
            </DialogDescription>
          </DialogHeader>
          
          {selectedProfile && (
            <div className="space-y-4 mt-4">
              {/* User ID */}
              <div className="p-3 bg-gray-800 rounded">
                <p className="text-xs text-gray-500">User ID</p>
                <code className="text-sm text-gray-300 font-mono">
                  {selectedProfile.userId || selectedProfile._id}
                </code>
              </div>
              
              {/* Trading Style */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-gray-800 rounded text-center">
                  <p className="text-xs text-gray-500 mb-1">Scalper Score</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {((selectedProfile.tradingStyle?.scalperScore || 0) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded text-center">
                  <p className="text-xs text-gray-500 mb-1">Day Trader Score</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {((selectedProfile.tradingStyle?.dayTraderScore || 0) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded text-center">
                  <p className="text-xs text-gray-500 mb-1">Swing Score</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {((selectedProfile.tradingStyle?.swingScore || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              
              {/* Average Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-500">Avg Size</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {(selectedProfile.averageStats?.avgSize || 0).toFixed(2)} lots
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-500">Avg Duration</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {Math.round(selectedProfile.averageStats?.avgDuration || 0)} min
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-500">Avg SL</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {(selectedProfile.averageStats?.avgStopLoss || 0).toFixed(1)} pips
                  </p>
                </div>
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-500">Avg TP</p>
                  <p className="text-lg font-semibold text-gray-200">
                    {(selectedProfile.averageStats?.avgTakeProfit || 0).toFixed(1)} pips
                  </p>
                </div>
              </div>
              
              {/* Preferred Pairs */}
              {selectedProfile.patterns?.preferredPairs?.length > 0 && (
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-500 mb-2">Preferred Pairs</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.patterns.preferredPairs.map((pair: string) => (
                      <Badge key={pair} className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {pair}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Trading Hours Distribution */}
              {selectedProfile.patterns?.tradingHoursDistribution && (
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-xs text-gray-500 mb-2">Trading Hours Distribution</p>
                  <div className="flex items-end h-16 gap-0.5">
                    {selectedProfile.patterns.tradingHoursDistribution.map((val: number, hour: number) => (
                      <div 
                        key={hour}
                        className="flex-1 bg-blue-500/50 rounded-t transition-all"
                        style={{ height: `${Math.max(4, val * 100)}%` }}
                        title={`${hour}:00 - ${(val * 100).toFixed(0)}%`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:00</span>
                  </div>
                </div>
              )}
              
              {/* Mirror Trading Suspects */}
              {selectedProfile.mirrorTradingSuspects?.length > 0 && (
                <div className="p-3 bg-red-900/20 border border-red-700/30 rounded">
                  <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Mirror Trading Suspects
                  </p>
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {selectedProfile.mirrorTradingSuspects.map((suspect: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <code className="text-gray-300">
                          {suspect.pairedUserId?.toString().substring(0, 16)}...
                        </code>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          {(suspect.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

