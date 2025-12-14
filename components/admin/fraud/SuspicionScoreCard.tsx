'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Shield, TrendingUp, Users, Clock } from 'lucide-react';

interface ScoreBreakdown {
  percentage?: number;  // Model stores 'percentage'
  points?: number;      // Backward compatibility
  evidence?: string;
  lastDetected?: string;
}

interface SuspicionScoreData {
  userId: string;
  totalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: string;
  scoreBreakdown: {
    deviceMatch: ScoreBreakdown;
    ipMatch: ScoreBreakdown;
    ipBrowserMatch: ScoreBreakdown;
    sameCity: ScoreBreakdown;
    samePayment: ScoreBreakdown;
    rapidCreation: ScoreBreakdown;
    coordinatedEntry: ScoreBreakdown;
    tradingSimilarity: ScoreBreakdown;
    mirrorTrading: ScoreBreakdown;
    timezoneLanguage: ScoreBreakdown;
    deviceSwitching: ScoreBreakdown;
  };
  linkedAccounts: Array<{
    userId: string;
    matchType: string;
    confidence: number;
    detectedAt: string;
  }>;
  scoreHistory: Array<{
    timestamp: string;
    score: number;
    reason: string;
    delta: number;
    triggeredBy: string;
  }>;
}

interface Props {
  score: SuspicionScoreData;
}

export default function SuspicionScoreCard({ score }: Props) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-500 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 50) return 'text-orange-500';
    if (score >= 30) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const detectionMethods = [
    { key: 'deviceMatch', label: 'Device Match', maxPercentage: 40, icon: '📱' },
    { key: 'ipBrowserMatch', label: 'IP + Browser', maxPercentage: 35, icon: '🌐' },
    { key: 'mirrorTrading', label: 'Mirror Trading', maxPercentage: 35, icon: '🪞' },
    { key: 'ipMatch', label: 'IP Match', maxPercentage: 30, icon: '🔗' },
    { key: 'samePayment', label: 'Payment Method', maxPercentage: 30, icon: '💳' },
    { key: 'tradingSimilarity', label: 'Trading Similarity', maxPercentage: 30, icon: '📈' },
    { key: 'coordinatedEntry', label: 'Coordinated Entry', maxPercentage: 25, icon: '🎯' },
    { key: 'rapidCreation', label: 'Rapid Creation', maxPercentage: 20, icon: '⚡' },
    { key: 'sameCity', label: 'Same Location', maxPercentage: 15, icon: '📍' },
    { key: 'deviceSwitching', label: 'Device Switching', maxPercentage: 15, icon: '🔄' },
    { key: 'timezoneLanguage', label: 'Timezone/Language', maxPercentage: 10, icon: '🌍' }
  ];

  const activeDetections = detectionMethods
    .map(method => {
      const breakdown = score.scoreBreakdown[method.key as keyof typeof score.scoreBreakdown];
      // The model stores 'percentage', not 'points'
      const detectionPercentage = breakdown?.percentage || breakdown?.points || 0;
      return {
        ...method,
        ...breakdown,
        percentage: detectionPercentage,
      };
    })
    .filter(method => method.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const recentHistory = [...(score.scoreHistory || [])].reverse().slice(0, 5);

  return (
    <div className="space-y-6 w-full h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-400" />
            Fraud Detection Score
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            User: <span className="font-mono text-gray-300">{score.userId.substring(0, 16)}...</span>
          </p>
        </div>
        <Badge className={`${getRiskColor(score.riskLevel)} text-lg px-4 py-2`}>
          {getRiskIcon(score.riskLevel)} {score.riskLevel.toUpperCase()} RISK
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Overall Score */}
        <div className="lg:col-span-1 space-y-6">
          {/* Total Score Display */}
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-8">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-4">OVERALL FRAUD SCORE</p>
                <div className="relative inline-block">
                  <svg className="w-40 h-40 transform -rotate-90">
                    {/* Background circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="14"
                      fill="none"
                      className="text-gray-700"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="14"
                      fill="none"
                      strokeLinecap="round"
                      className={getProgressColor(score.totalScore)}
                      strokeDasharray={`${2 * Math.PI * 70}`}
                      strokeDashoffset={`${2 * Math.PI * 70 * (1 - score.totalScore / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-5xl font-bold ${getScoreColor(score.totalScore)}`}>
                      {score.totalScore}
                    </span>
                    <span className="text-lg text-gray-500 font-semibold">%</span>
                  </div>
                </div>
                <p className="mt-6 text-sm text-gray-400">
                  Last updated:<br/>
                  {new Date(score.lastUpdated).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Risk Thresholds */}
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-6">
              <p className="text-sm font-semibold text-gray-300 mb-4">Risk Thresholds</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    🟢 <span className="text-gray-400">Low Risk</span>
                  </span>
                  <span className="text-xs text-gray-500">0-29%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    🟡 <span className="text-gray-400">Medium Risk</span>
                  </span>
                  <span className="text-xs text-gray-500">30-49%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    🟠 <span className="text-gray-400">High Risk</span>
                  </span>
                  <span className="text-xs text-gray-500">50-69%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    🔴 <span className="text-gray-400">Critical Risk</span>
                  </span>
                  <span className="text-xs text-gray-500">70-100%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center/Right Columns: Detection Methods */}
        <div className="lg:col-span-2">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Detection Methods
                {activeDetections.length > 0 && (
                  <Badge variant="outline" className="border-orange-500/30 text-orange-400 ml-2">
                    {activeDetections.length} Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Individual fraud indicators and their contribution to overall score
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeDetections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeDetections.map((detection) => (
                    <div
                      key={detection.key}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      {/* Method Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                          <span className="text-xl">{detection.icon}</span>
                          {detection.label}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`${getProgressColor(detection.percentage)} border-none text-sm px-2 py-1`}
                        >
                          {detection.percentage}%
                        </Badge>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Contribution</span>
                          <span>{detection.percentage}% of {detection.maxPercentage}% max</span>
                        </div>
                        <Progress 
                          value={(detection.percentage / detection.maxPercentage) * 100}
                          className="h-2"
                        />
                      </div>
                      
                      {/* Evidence */}
                      <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                        {detection.evidence}
                      </p>
                      
                      {/* Timestamp */}
                      {detection.lastDetected && (
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(detection.lastDetected).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield className="h-16 w-16 text-green-500/30 mx-auto mb-4" />
                  <p className="text-lg text-gray-400 font-medium">No Fraud Detected</p>
                  <p className="text-sm text-gray-600 mt-2">This account appears to be clean</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Linked Accounts & Score History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linked Accounts */}
        {score.linkedAccounts.length > 0 && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <Users className="h-5 w-5 text-yellow-500" />
                Linked Suspicious Accounts
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 ml-2">
                  {score.linkedAccounts.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Accounts connected to this user through fraud detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {score.linkedAccounts.map((account, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-gray-300">
                        #{idx + 1} {account.userId.substring(0, 20)}...
                      </span>
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                        {Math.round(account.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{account.matchType}</span>
                      <span className="text-gray-600">
                        {new Date(account.detectedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Score History */}
        {recentHistory.length > 0 && (
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Score History
                <Badge variant="outline" className="border-blue-500/30 text-blue-400 ml-2">
                  {recentHistory.length} Recent
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Recent changes to fraud detection score
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {recentHistory.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={entry.delta > 0 ? 'border-red-500/30 text-red-400' : 'border-green-500/30 text-green-400'}
                      >
                        {entry.delta > 0 ? '+' : ''}{entry.delta}%
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-300 mb-1">{entry.reason}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{entry.triggeredBy}</span>
                      <span className={`font-semibold ${getScoreColor(entry.score)}`}>
                        Score: {entry.score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

