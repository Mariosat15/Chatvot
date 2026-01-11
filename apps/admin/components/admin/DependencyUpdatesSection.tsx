'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCcw, Package, AlertTriangle, CheckCircle2, Sparkles, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIAnalysis {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  breakingChanges: string[];
  recommendations: string[];
  estimatedEffort: string;
}

interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  location: string;
  type: 'dependencies' | 'devDependencies';
  isBreaking: boolean;
  aiAnalysis?: AIAnalysis;
}

interface DependencyCheckResult {
  packages: OutdatedPackage[];
  totalOutdated: number;
  lastChecked: string;
  aiEnabled: boolean;
}

const riskColors = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function PackageCard({ pkg, onAnalyze, analyzing }: {
  pkg: OutdatedPackage;
  onAnalyze: (name: string) => void;
  analyzing: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isAnalyzing = analyzing === pkg.name;

  return (
    <div className={cn(
      'border rounded-lg p-4 transition-all',
      pkg.isBreaking
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-gray-700 bg-gray-800/50'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Package className={cn(
            'h-5 w-5',
            pkg.isBreaking ? 'text-red-400' : 'text-blue-400'
          )} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{pkg.name}</span>
              {pkg.isBreaking && (
                <Badge variant="outline" className="border-red-500/50 text-red-400 text-xs">
                  Breaking
                </Badge>
              )}
              <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                {pkg.type}
              </Badge>
            </div>
            <div className="text-sm text-gray-400 mt-1">
              <span className="text-red-400">{pkg.current}</span>
              <span className="mx-2">→</span>
              <span className="text-green-400">{pkg.latest}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {pkg.aiAnalysis && (
            <Badge className={cn('text-xs', riskColors[pkg.aiAnalysis.riskLevel])}>
              {pkg.aiAnalysis.riskLevel.toUpperCase()} Risk
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          {pkg.aiAnalysis ? (
            <div className="space-y-4">
              {/* Summary */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-1">Summary</h4>
                <p className="text-sm text-gray-400">{pkg.aiAnalysis.summary}</p>
              </div>

              {/* Breaking Changes */}
              {pkg.aiAnalysis.breakingChanges.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Breaking Changes
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    {pkg.aiAnalysis.breakingChanges.map((change, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {pkg.aiAnalysis.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Recommendations
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    {pkg.aiAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Estimated Effort */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">Estimated effort:</span>
                <span className="text-gray-300">{pkg.aiAnalysis.estimatedEffort}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">No AI analysis available yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAnalyze(pkg.name)}
                disabled={isAnalyzing}
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3 w-3" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>
          )}

          {/* NPM Link */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <a
              href={`https://www.npmjs.com/package/${pkg.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View on NPM
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DependencyUpdatesSection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DependencyCheckResult | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'breaking' | 'safe'>('all');

  const fetchDependencies = async (clearCache = false) => {
    try {
      if (clearCache) {
        await fetch('/api/dev-zone/dependency-check', { method: 'DELETE' });
      }

      const response = await fetch('/api/dev-zone/dependency-check');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching dependencies:', error);
      toast.error('Failed to check dependencies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDependencies(true);
  };

  const handleAnalyzePackage = async (packageName: string) => {
    setAnalyzing(packageName);
    try {
      const response = await fetch('/api/dev-zone/dependency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to analyze');
      }

      const result = await response.json();
      if (data && result.package) {
        setData({
          ...data,
          packages: data.packages.map((p) =>
            p.name === packageName ? result.package : p
          ),
        });
      }
      toast.success(`Analyzed ${packageName}`);
    } catch (error) {
      console.error('Error analyzing package:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze package');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const response = await fetch('/api/dev-zone/dependency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyzeAll: true }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to analyze');
      }

      const result = await response.json();
      setData(result);
      toast.success('Analyzed packages with AI');
    } catch (error) {
      console.error('Error analyzing all:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze packages');
    } finally {
      setAnalyzingAll(false);
    }
  };

  const filteredPackages = data?.packages.filter((pkg) => {
    if (filter === 'breaking') return pkg.isBreaking;
    if (filter === 'safe') return !pkg.isBreaking;
    return true;
  }) || [];

  const breakingCount = data?.packages.filter((p) => p.isBreaking).length || 0;
  const safeCount = data?.packages.filter((p) => !p.isBreaking).length || 0;

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-gray-400">Checking dependencies...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-400" />
                Dependency Updates
              </CardTitle>
              <CardDescription>
                Check and analyze npm package updates with AI assistance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="border-gray-600"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </Button>
              {data?.aiEnabled && data.packages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeAll}
                  disabled={analyzingAll}
                  className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                >
                  {analyzingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analyze All with AI
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white">{data?.totalOutdated || 0}</div>
              <div className="text-sm text-gray-400">Total Outdated</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{breakingCount}</div>
              <div className="text-sm text-red-400">Breaking Changes</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{safeCount}</div>
              <div className="text-sm text-green-400">Safe Updates</div>
            </div>
          </div>

          {/* AI Status */}
          {!data?.aiEnabled && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                  AI analysis is not available. Configure OpenAI in Platform Settings to enable.
                </span>
              </div>
            </div>
          )}

          {/* Last Checked */}
          {data?.lastChecked && (
            <p className="text-sm text-gray-500">
              Last checked: {new Date(data.lastChecked).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      {data && data.packages.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-blue-600' : 'border-gray-600'}
          >
            All ({data.totalOutdated})
          </Button>
          <Button
            variant={filter === 'breaking' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('breaking')}
            className={filter === 'breaking' ? 'bg-red-600' : 'border-gray-600'}
          >
            Breaking ({breakingCount})
          </Button>
          <Button
            variant={filter === 'safe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('safe')}
            className={filter === 'safe' ? 'bg-green-600' : 'border-gray-600'}
          >
            Safe ({safeCount})
          </Button>
        </div>
      )}

      {/* Package List */}
      {filteredPackages.length > 0 ? (
        <div className="space-y-3">
          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.name}
              pkg={pkg}
              onAnalyze={handleAnalyzePackage}
              analyzing={analyzing}
            />
          ))}
        </div>
      ) : data && data.packages.length === 0 ? (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center gap-2 text-green-400">
              <CheckCircle2 className="h-12 w-12" />
              <h3 className="text-lg font-semibold">All packages are up to date!</h3>
              <p className="text-sm text-green-400/70">No outdated dependencies found.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8 text-center text-gray-400">
            No packages match the current filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

