"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  AlertTriangle,
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
  Wrench,
  Copy,
  ClipboardCheck,
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
  friendlyMessage: string;
  friendlyIssues: string[];
  duration: number;
  issues: string[];
  autoFixable: boolean;
  suggestedFix?: any;
}

interface SimulatorSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: string;
  issues: number;
  autoFixable: number;
  byCategory: Record<string, { passed: number; failed: number; total: number; issues: number }>;
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
  const [isFixing, setIsFixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BadgeTestResult[]>([]);
  const [summary, setSummary] = useState<SimulatorSummary | null>(null);
  const [report, setReport] = useState<string>("");
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reportCopied, setReportCopied] = useState(false);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [includeFailTests, setIncludeFailTests] = useState(false);

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
    setReport("");
    setReportCopied(false);

    try {
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
        setReport(data.report || "");
        
        if (data.summary.failed > 0) {
          toast.error(`${data.summary.failed} badge tests failed`);
        } else if (data.summary.issues > 0) {
          toast.warning(`All passed but ${data.summary.issues} issues found`);
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

  const fixBadge = async (badgeId: string, suggestedFix: any) => {
    try {
      const response = await fetch("/api/admin/badge-simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fix", badgeId, suggestedFix }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Fixed badge "${badgeId}"`);
        runSimulation(); // Re-run to verify
      } else {
        toast.error(data.error || "Fix failed");
      }
    } catch (error) {
      toast.error("Failed to fix badge");
    }
  };

  const fixAllIssues = async () => {
    const fixable = results.filter(r => r.autoFixable && r.suggestedFix);
    if (fixable.length === 0) {
      toast.info("No auto-fixable issues");
      return;
    }

    setIsFixing(true);
    try {
      const response = await fetch("/api/admin/badge-simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix",
          fixAll: true,
          fixes: fixable.map(r => ({ badgeId: r.badgeId, suggestedFix: r.suggestedFix })),
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        runSimulation(); // Re-run
      } else {
        toast.error(data.error || "Fix all failed");
      }
    } catch (error) {
      toast.error("Failed to fix all");
    } finally {
      setIsFixing(false);
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setReportCopied(true);
      toast.success("Report copied to clipboard");
      setTimeout(() => setReportCopied(false), 3000);
    } catch {
      toast.error("Failed to copy report");
    }
  };

  const resetSimulation = () => {
    setResults([]);
    setSummary(null);
    setProgress(0);
    setReport("");
    setExpandedRows(new Set());
    setReportCopied(false);
  };

  const toggleRowExpansion = (badgeId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(badgeId)) newSet.delete(badgeId);
      else newSet.add(badgeId);
      return newSet;
    });
  };

  // Filter results
  const filteredResults = results.filter((result) => {
    if (selectedCategory !== "all" && result.category !== selectedCategory) return false;
    if (selectedStatus === "passed" && !result.passed) return false;
    if (selectedStatus === "failed" && result.passed) return false;
    if (selectedStatus === "issues" && result.issues.length === 0) return false;
    if (searchQuery && !result.badgeName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !result.badgeId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !result.condition.type.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const autoFixableResults = results.filter(r => r.autoFixable && r.suggestedFix);

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
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyReport}
              className="border-zinc-700"
            >
              {reportCopied ? (
                <><ClipboardCheck className="h-4 w-4 mr-2 text-green-400" />Copied</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" />Copy Report</>
              )}
            </Button>
          )}
          {autoFixableResults.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={fixAllIssues}
              disabled={isFixing}
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            >
              {isFixing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Fixing...</>
              ) : (
                <><Wrench className="h-4 w-4 mr-2" />Fix All Issues ({autoFixableResults.length})</>
              )}
            </Button>
          )}
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
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Run Simulation</>
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
                  <SelectItem value="issues">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      With Issues
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <div className="text-3xl font-bold text-orange-400">{summary.issues}</div>
                <div className="text-zinc-400 text-sm">Issues</div>
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
                    stats.failed > 0 ? "border-red-500/30" :
                    stats.issues > 0 ? "border-orange-500/30" : "border-green-500/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {CATEGORY_ICONS[category]}
                    <span className="font-medium text-sm">{category}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-400">{stats.passed} passed</span>
                    {stats.failed > 0 && <span className="text-red-400">{stats.failed} failed</span>}
                    {stats.issues > 0 && <span className="text-orange-400">{stats.issues} issues</span>}
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
                          !result.passed && "bg-red-500/5",
                          result.passed && result.issues.length > 0 && "bg-orange-500/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          {expandedRows.has(result.badgeId) ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500" />
                          )}
                          
                          {result.passed ? (
                            result.issues.length > 0 ? (
                              <AlertTriangle className="h-5 w-5 text-orange-500" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )
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
                              {result.issues.length > 0 && (
                                <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-400">
                                  {result.issues.length} issue{result.issues.length > 1 ? "s" : ""}
                                </Badge>
                              )}
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
                          {result.autoFixable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                fixBadge(result.badgeId, result.suggestedFix);
                              }}
                              className="h-7 px-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            >
                              <Wrench className="h-3.5 w-3.5 mr-1" />
                              Fix
                            </Button>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              result.passed
                                ? result.issues.length > 0
                                  ? "border-orange-500/50 text-orange-400"
                                  : "border-green-500/50 text-green-400"
                                : "border-red-500/50 text-red-400"
                            )}
                          >
                            {result.passed ? (result.issues.length > 0 ? "WARN" : "PASSED") : "FAILED"}
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
                          {/* Friendly Message */}
                          <div className="col-span-2">
                            <Label className="text-xs text-zinc-500">Diagnosis</Label>
                            <p className={cn(
                              "text-sm mt-1 p-3 rounded-lg",
                              result.passed
                                ? result.issues.length > 0
                                  ? "bg-orange-500/10 text-orange-300 border border-orange-500/20"
                                  : "bg-green-500/10 text-green-300 border border-green-500/20"
                                : "bg-red-500/10 text-red-300 border border-red-500/20"
                            )}>
                              {result.friendlyMessage}
                            </p>
                          </div>

                          {/* Issues */}
                          {result.friendlyIssues.length > 0 && (
                            <div className="col-span-2">
                              <Label className="text-xs text-zinc-500">Issues</Label>
                              <ul className="mt-1 space-y-1">
                                {result.friendlyIssues.map((issue, i) => (
                                  <li key={i} className="text-sm text-orange-300 flex items-start gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                    {issue}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Condition Details */}
                          <div>
                            <Label className="text-xs text-zinc-500">Condition</Label>
                            <pre className="text-xs mt-1 p-2 bg-zinc-900 rounded overflow-x-auto">
                              {JSON.stringify(result.condition, null, 2)}
                            </pre>
                          </div>

                          {/* Suggested Fix */}
                          {result.suggestedFix && (
                            <div>
                              <Label className="text-xs text-zinc-500">Suggested Fix</Label>
                              <pre className="text-xs mt-1 p-2 bg-orange-500/10 border border-orange-500/20 rounded overflow-x-auto">
                                {JSON.stringify(result.suggestedFix, null, 2)}
                              </pre>
                            </div>
                          )}

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
