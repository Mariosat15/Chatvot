"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Award,
  Trophy,
  Shield,
  TrendingUp,
  Clock,
  Users,
  Star,
  Zap,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeCondition {
  type: string;
  value?: number;
  comparison?: string;
  minTrades?: number;
  minCompletedCompetitions?: number;
}

interface BadgeTestResult {
  badgeId: string;
  badgeName: string;
  category: string;
  rarity: string;
  condition: BadgeCondition;
  mockStats: Record<string, unknown>;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  reason: string;
  duration: number;
}

interface SimulatorSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: string;
  byCategory: Record<string, { passed: number; failed: number; total: number }>;
}

interface BadgeInfo {
  id: string;
  name: string;
  category: string;
  rarity: string;
  conditionType: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Competition: <Trophy className="h-4 w-4" />,
  Trading: <TrendingUp className="h-4 w-4" />,
  Profit: <Zap className="h-4 w-4" />,
  Risk: <Shield className="h-4 w-4" />,
  Speed: <Clock className="h-4 w-4" />,
  Consistency: <RefreshCw className="h-4 w-4" />,
  Strategy: <Star className="h-4 w-4" />,
  Social: <Users className="h-4 w-4" />,
  Legendary: <Award className="h-4 w-4" />,
};

const RARITY_COLORS: Record<string, string> = {
  common: "bg-zinc-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

export default function BadgeSimulatorTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BadgeTestResult[]>([]);
  const [summary, setSummary] = useState<SimulatorSummary | null>(null);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [includeFailTests, setIncludeFailTests] = useState(false);

  // Load available badges on mount
  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const response = await fetch("/api/admin/badge-simulator/run");
      const data = await response.json();
      
      if (data.success) {
        setBadges(data.badges || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to load badges:", error);
    }
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    setSummary(null);

    try {
      // Simulate progress while waiting
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 2, 90));
      }, 100);

      const response = await fetch("/api/admin/badge-simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory === "all" ? undefined : selectedCategory,
          includeFailTests,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);
        
        if (data.summary.failed > 0) {
          toast.error(`${data.summary.failed} badge tests failed`);
        } else {
          toast.success(`All ${data.summary.passed} badge tests passed!`);
        }
      } else {
        toast.error(data.error || "Simulation failed");
      }
    } catch (error) {
      toast.error("Failed to run simulation");
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  const resetSimulation = () => {
    setResults([]);
    setSummary(null);
    setProgress(0);
    setExpandedRows(new Set());
  };

  const toggleRowExpansion = (badgeId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(badgeId)) {
        newSet.delete(badgeId);
      } else {
        newSet.add(badgeId);
      }
      return newSet;
    });
  };

  // Filter results
  const filteredResults = results.filter((result) => {
    if (selectedCategory !== "all" && result.category !== selectedCategory) {
      return false;
    }
    if (selectedStatus === "passed" && !result.passed) {
      return false;
    }
    if (selectedStatus === "failed" && result.passed) {
      return false;
    }
    if (searchQuery && !result.badgeName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !result.badgeId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !result.condition.type.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            Badge Simulator
          </h2>
          <p className="text-zinc-400 mt-1">
            Test badge conditions against mock user stats using production evaluation code
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={resetSimulation}
            disabled={isRunning || results.length === 0}
            className="border-zinc-700"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={runSimulation}
            disabled={isRunning}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Configuration */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-zinc-400" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        {CATEGORY_ICONS[cat]}
                        {cat}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status Filter</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="passed">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Passed Only
                    </span>
                  </SelectItem>
                  <SelectItem value="failed">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Failed Only
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Badge name or condition..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>

            {/* Include Fail Tests */}
            <div className="space-y-2">
              <Label>Include Negative Tests</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={includeFailTests}
                  onCheckedChange={setIncludeFailTests}
                />
                <span className="text-sm text-zinc-400">
                  Test that invalid stats don&apos;t pass
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {isRunning && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Running badge tests...</span>
                <span className="text-zinc-300">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{summary.total}</div>
                <div className="text-zinc-400 text-sm">Total Tests</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{summary.passed}</div>
                <div className="text-zinc-400 text-sm">Passed</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{summary.failed}</div>
                <div className="text-zinc-400 text-sm">Failed</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className={cn(
                  "text-3xl font-bold",
                  parseFloat(summary.passRate) === 100 ? "text-green-400" :
                  parseFloat(summary.passRate) >= 80 ? "text-yellow-400" : "text-red-400"
                )}>
                  {summary.passRate}
                </div>
                <div className="text-zinc-400 text-sm">Pass Rate</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      {summary && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Results by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(summary.byCategory).map(([category, stats]) => (
                <div
                  key={category}
                  className={cn(
                    "p-3 rounded-lg bg-zinc-800/50 border",
                    stats.failed === 0 ? "border-green-500/30" : "border-red-500/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {CATEGORY_ICONS[category]}
                    <span className="font-medium text-sm">{category}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-400">{stats.passed} passed</span>
                    <span className="text-red-400">{stats.failed} failed</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Test Results ({filteredResults.length})</span>
              {filteredResults.length !== results.length && (
                <Badge variant="outline" className="text-xs">
                  Showing {filteredResults.length} of {results.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-zinc-800">
                {filteredResults.map((result) => (
                  <Collapsible
                    key={result.badgeId}
                    open={expandedRows.has(result.badgeId)}
                    onOpenChange={() => toggleRowExpansion(result.badgeId)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between p-4 hover:bg-zinc-800/50 cursor-pointer",
                          !result.passed && "bg-red-500/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          {expandedRows.has(result.badgeId) ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500" />
                          )}
                          
                          {result.passed ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {result.badgeName}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  RARITY_COLORS[result.rarity],
                                  "text-white border-0"
                                )}
                              >
                                {result.rarity}
                              </Badge>
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {result.condition.type}
                              {result.condition.value !== undefined && (
                                <span> = {result.condition.value}</span>
                              )}
                              {result.condition.comparison && (
                                <span> ({result.condition.comparison})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {CATEGORY_ICONS[result.category]}
                            <span className="text-sm text-zinc-400">{result.category}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              result.passed
                                ? "border-green-500/50 text-green-400"
                                : "border-red-500/50 text-red-400"
                            )}
                          >
                            {result.passed ? "PASSED" : "FAILED"}
                          </Badge>
                          <span className="text-xs text-zinc-500 w-16 text-right">
                            {result.duration}ms
                          </span>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 bg-zinc-800/30 border-t border-zinc-800">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Reason */}
                          <div>
                            <Label className="text-xs text-zinc-500">Result</Label>
                            <p className={cn(
                              "text-sm mt-1",
                              result.passed ? "text-green-400" : "text-red-400"
                            )}>
                              {result.reason}
                            </p>
                          </div>

                          {/* Condition Details */}
                          <div>
                            <Label className="text-xs text-zinc-500">Condition</Label>
                            <pre className="text-xs mt-1 p-2 bg-zinc-900 rounded overflow-x-auto">
                              {JSON.stringify(result.condition, null, 2)}
                            </pre>
                          </div>

                          {/* Mock Stats */}
                          <div className="col-span-2">
                            <Label className="text-xs text-zinc-500">Mock Stats Used</Label>
                            <pre className="text-xs mt-1 p-2 bg-zinc-900 rounded overflow-x-auto max-h-40">
                              {JSON.stringify(result.mockStats, null, 2)}
                            </pre>
                          </div>

                          {/* Expected vs Actual */}
                          <div className="col-span-2 flex gap-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-zinc-500">Expected:</Label>
                              <Badge variant="outline" className={result.expected ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}>
                                {result.expected ? "TRUE" : "FALSE"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-zinc-500">Actual:</Label>
                              <Badge variant="outline" className={result.actual ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}>
                                {result.actual ? "TRUE" : "FALSE"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {results.length === 0 && !isRunning && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-12 text-center">
            <Award className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              No Tests Run Yet
            </h3>
            <p className="text-zinc-400 mb-4">
              Click &quot;Run Simulation&quot; to test all badge conditions against mock user stats.
              <br />
              This uses the actual production evaluation code to identify issues.
            </p>
            <div className="text-sm text-zinc-500">
              {badges.length} badges available across {categories.length} categories
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
