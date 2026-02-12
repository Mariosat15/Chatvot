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
  Loader2,
  Map,
  Flag,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  RotateCcw,
  Target,
  Wrench,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MilestoneTestResult {
  milestoneId: string;
  milestoneName: string;
  mapId: string;
  mapName: string;
  order: number;
  condition: any;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  reason: string;
  currentValue?: number;
  targetValue?: number;
  conditionType: string;
  duration: number;
  issues: string[];
  autoFixable: boolean;
  suggestedFix?: any;
}

interface SimulatorSummary {
  total: number;
  passed: number;
  failed: number;
  issues: number;
  autoFixable: number;
  passRate: string;
  byMap: Record<string, { passed: number; failed: number; total: number; issues: number }>;
  byConditionType: Record<string, { passed: number; failed: number; total: number }>;
  mapsIncluded: number;
}

interface MapInfo {
  mapId: string;
  name: string;
  sequenceOrder: number;
  milestoneCount: number;
}

export default function MilestoneSimulatorTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<MilestoneTestResult[]>([]);
  const [summary, setSummary] = useState<SimulatorSummary | null>(null);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [conditionTypes, setConditionTypes] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filters
  const [selectedMap, setSelectedMap] = useState<string>("all");
  const [selectedConditionType, setSelectedConditionType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadMilestones();
  }, []);

  const loadMilestones = async () => {
    try {
      const response = await fetch("/api/admin/milestone-simulator/run");
      const data = await response.json();
      if (data.success) {
        setMaps(data.maps || []);
        setConditionTypes(data.conditionTypes || []);
      }
    } catch (error) {
      console.error("Failed to load milestones:", error);
    }
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);
    setSummary(null);

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 2, 90));
      }, 100);

      const response = await fetch("/api/admin/milestone-simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId: selectedMap === "all" ? undefined : selectedMap,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        setSummary(data.summary);

        const issueCount = data.summary.issues || 0;
        const failCount = data.summary.failed || 0;

        if (failCount > 0 || issueCount > 0) {
          toast.error(`${failCount} failed, ${issueCount} input issues found`);
        } else {
          toast.success(`All ${data.summary.passed} milestone tests passed!`);
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

  const fixAllIssues = async () => {
    const fixable = results.filter(r => r.autoFixable);
    if (fixable.length === 0) {
      toast.info("No auto-fixable issues found");
      return;
    }

    setIsFixing(true);
    try {
      toast.loading(`Fixing ${fixable.length} milestones...`, { id: "fix" });

      const response = await fetch("/api/admin/milestone-simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix",
          fixAll: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Fixed ${data.fixedCount} milestones. Re-run simulation to verify.`, {
          id: "fix",
          duration: 5000,
        });
        // Auto re-run
        setTimeout(() => runSimulation(), 500);
      } else {
        toast.error(`Fix failed: ${data.error}`, { id: "fix" });
      }
    } catch (error) {
      toast.error(`Fix error: ${error}`, { id: "fix" });
    } finally {
      setIsFixing(false);
    }
  };

  const fixSingleMilestone = async (milestoneId: string) => {
    try {
      toast.loading(`Fixing ${milestoneId}...`, { id: `fix-${milestoneId}` });

      const response = await fetch("/api/admin/milestone-simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix",
          milestoneIds: [milestoneId],
        }),
      });

      const data = await response.json();

      if (data.success && data.fixedCount > 0) {
        toast.success(`Fixed! ${data.fixes[0]?.fixes.join(", ")}`, {
          id: `fix-${milestoneId}`,
          duration: 4000,
        });
      } else {
        toast.info("No fixes needed", { id: `fix-${milestoneId}` });
      }
    } catch (error) {
      toast.error(`Fix error: ${error}`, { id: `fix-${milestoneId}` });
    }
  };

  const resetSimulation = () => {
    setResults([]);
    setSummary(null);
    setProgress(0);
    setExpandedRows(new Set());
  };

  const toggleRowExpansion = (milestoneId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) newSet.delete(milestoneId);
      else newSet.add(milestoneId);
      return newSet;
    });
  };

  // Filter results
  const filteredResults = results.filter((result) => {
    if (selectedMap !== "all" && result.mapId !== selectedMap) return false;
    if (selectedConditionType !== "all" && result.conditionType !== selectedConditionType) return false;
    if (selectedStatus === "passed" && !result.passed) return false;
    if (selectedStatus === "failed" && result.passed) return false;
    if (selectedStatus === "issues" && result.issues.length === 0) return false;
    if (searchQuery &&
      !result.milestoneName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !result.milestoneId.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !result.conditionType.toLowerCase().includes(searchQuery.toLowerCase())
    ) return false;
    return true;
  });

  const totalMilestones = maps.reduce((sum, m) => sum + m.milestoneCount, 0);
  const fixableCount = results.filter(r => r.autoFixable).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="h-6 w-6 text-green-400" />
            Milestone Simulator
          </h2>
          <p className="text-zinc-400 mt-1">
            Tests milestone conditions using production evaluation logic. Detects broken inputs and unsupported types.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {fixableCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={fixAllIssues}
              disabled={isFixing}
              className="border-amber-600 text-amber-400 hover:bg-amber-600/10"
            >
              {isFixing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fixing...</>
              ) : (
                <><Wrench className="h-4 w-4 mr-2" /> Fix All Issues ({fixableCount})</>
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
            className="bg-green-600 hover:bg-green-700"
          >
            {isRunning ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Run Simulation</>
            )}
          </Button>
        </div>
      </div>

      {/* Configuration */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-zinc-400" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Journey Map</Label>
              <Select value={selectedMap} onValueChange={setSelectedMap}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Maps ({maps.length})</SelectItem>
                  {maps.map((map) => (
                    <SelectItem key={map.mapId} value={map.mapId}>
                      <span className="flex items-center gap-2">
                        <Map className="h-3 w-3" />
                        {map.name} ({map.milestoneCount})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condition Type</Label>
              <Select value={selectedConditionType} onValueChange={setSelectedConditionType}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {conditionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="passed">Passed Only</SelectItem>
                  <SelectItem value="failed">Failed Only</SelectItem>
                  <SelectItem value="issues">With Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Name, ID, or condition..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800 border-zinc-700"
                />
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
                <span className="text-zinc-400">Testing milestones with production logic...</span>
                <span className="text-zinc-300">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-white">{summary.total}</div>
              <div className="text-zinc-400 text-sm">Total</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-400">{summary.passed}</div>
              <div className="text-zinc-400 text-sm">Passed</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-red-400">{summary.failed}</div>
              <div className="text-zinc-400 text-sm">Failed</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-amber-400">{summary.issues}</div>
              <div className="text-zinc-400 text-sm">Input Issues</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-blue-400">{summary.autoFixable}</div>
              <div className="text-zinc-400 text-sm">Auto-Fixable</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 text-center">
              <div className={cn(
                "text-3xl font-bold",
                parseFloat(summary.passRate) === 100 ? "text-green-400" :
                parseFloat(summary.passRate) >= 80 ? "text-yellow-400" : "text-red-400"
              )}>
                {summary.passRate}
              </div>
              <div className="text-zinc-400 text-sm">Pass Rate</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Breakdown */}
      {summary && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Results by Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(summary.byMap).map(([mapId, stats]) => {
                const mapInfo = maps.find(m => m.mapId === mapId);
                return (
                  <div
                    key={mapId}
                    className={cn(
                      "p-3 rounded-lg bg-zinc-800/50 border",
                      stats.failed === 0 && stats.issues === 0
                        ? "border-green-500/30"
                        : stats.failed > 0
                          ? "border-red-500/30"
                          : "border-amber-500/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Map className="h-4 w-4 text-blue-400" />
                      <span className="font-medium text-sm truncate" title={mapInfo?.name || mapId}>
                        {mapInfo?.name || mapId}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400">{stats.passed} ok</span>
                      {stats.failed > 0 && <span className="text-red-400">{stats.failed} fail</span>}
                      {stats.issues > 0 && <span className="text-amber-400">{stats.issues} issues</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Condition Type Breakdown */}
      {summary && Object.keys(summary.byConditionType).length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Results by Condition Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(summary.byConditionType)
                .sort((a, b) => b[1].failed - a[1].failed)
                .map(([type, stats]) => (
                  <div
                    key={type}
                    className={cn(
                      "p-2 rounded-lg bg-zinc-800/50 border text-xs",
                      stats.failed === 0 ? "border-green-500/20" : "border-red-500/30"
                    )}
                  >
                    <div className="font-mono truncate mb-1" title={type}>
                      {type.replace(/_/g, " ")}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400">{stats.passed}</span>
                      {stats.failed > 0 && <span className="text-red-400">{stats.failed}</span>}
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
                    key={result.milestoneId}
                    open={expandedRows.has(result.milestoneId)}
                    onOpenChange={() => toggleRowExpansion(result.milestoneId)}
                  >
                    <CollapsibleTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between p-4 hover:bg-zinc-800/50 cursor-pointer",
                          !result.passed && "bg-red-500/5",
                          result.issues.length > 0 && result.passed && "bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          {expandedRows.has(result.milestoneId) ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500" />
                          )}

                          {result.passed ? (
                            result.issues.length > 0 ? (
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {result.milestoneName}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                #{result.order}
                              </Badge>
                              {result.issues.length > 0 && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                                  {result.issues.length} issue{result.issues.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {result.conditionType || "no condition"}
                              {result.targetValue !== undefined && (
                                <span> = {result.targetValue}</span>
                              )}
                              {result.condition?.comparison && (
                                <span> ({result.condition.comparison})</span>
                              )}
                              {result.currentValue !== undefined && (
                                <span className="text-zinc-400 ml-2">
                                  mock: {result.currentValue}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-zinc-400 max-w-[100px] truncate hidden md:inline">
                            {result.mapName}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              result.passed
                                ? result.issues.length > 0
                                  ? "border-amber-500/50 text-amber-400"
                                  : "border-green-500/50 text-green-400"
                                : "border-red-500/50 text-red-400"
                            )}
                          >
                            {result.passed ? (result.issues.length > 0 ? "WARN" : "PASS") : "FAIL"}
                          </Badge>
                          {result.autoFixable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-600/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                fixSingleMilestone(result.milestoneId);
                              }}
                            >
                              <Wrench className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 bg-zinc-800/30 border-t border-zinc-800 space-y-3">
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

                        {/* Issues */}
                        {result.issues.length > 0 && (
                          <div>
                            <Label className="text-xs text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Input Issues
                            </Label>
                            <ul className="text-sm mt-1 space-y-1">
                              {result.issues.map((issue, i) => (
                                <li key={i} className="text-amber-300 flex items-start gap-2">
                                  <span className="text-amber-500 mt-0.5">•</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Suggested Fix */}
                        {result.suggestedFix && (
                          <div>
                            <Label className="text-xs text-blue-400 flex items-center gap-1">
                              <Info className="h-3 w-3" /> Suggested Fix
                            </Label>
                            <pre className="text-xs mt-1 p-2 bg-zinc-900 rounded text-blue-300">
                              {JSON.stringify(result.suggestedFix, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Condition Details */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-zinc-500">Condition</Label>
                            <pre className="text-xs mt-1 p-2 bg-zinc-900 rounded overflow-x-auto">
                              {result.condition
                                ? JSON.stringify(result.condition, null, 2)
                                : "No condition (auto-pass)"}
                            </pre>
                          </div>
                          <div>
                            <Label className="text-xs text-zinc-500">Expected vs Actual</Label>
                            <div className="mt-1 flex gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">Expected:</span>
                                <Badge variant="outline" className={result.expected ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}>
                                  {result.expected ? "TRUE" : "FALSE"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">Actual:</span>
                                <Badge variant="outline" className={result.actual ? "border-green-500 text-green-400" : "border-red-500 text-red-400"}>
                                  {result.actual ? "TRUE" : "FALSE"}
                                </Badge>
                              </div>
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
            <Target className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              No Tests Run Yet
            </h3>
            <p className="text-zinc-400 mb-4">
              Click &quot;Run Simulation&quot; to test all milestone conditions using production evaluation logic.
              <br />
              Issues with missing fields, unsupported types, and bad inputs will be detected automatically.
            </p>
            <div className="text-sm text-zinc-500">
              {totalMilestones} milestones across {maps.length} journey maps
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
