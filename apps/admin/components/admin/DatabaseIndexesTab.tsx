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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Zap,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IndexInfo {
  collection: string;
  name: string;
  keys: Record<string, number>;
  required: boolean;
  exists: boolean;
  unique?: boolean;
  ttl?: number;
}

interface CollectionStatus {
  collection: string;
  totalRequired: number;
  existing: number;
  missing: number;
  indexes: IndexInfo[];
}

interface IndexSummary {
  totalCollections: number;
  totalRequired: number;
  totalExisting: number;
  totalMissing: number;
  healthScore: number;
}

export default function DatabaseIndexesTab() {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState<IndexSummary | null>(null);
  const [collections, setCollections] = useState<CollectionStatus[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set(),
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkIndexes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/database/indexes");
      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setCollections(data.collections);
        setLastChecked(new Date());

        if (data.summary.totalMissing > 0) {
          toast.warning(
            `${data.summary.totalMissing} missing indexes detected`,
          );
        } else {
          toast.success("All indexes are present!");
        }
      } else {
        toast.error(data.error || "Failed to check indexes");
      }
    } catch (error) {
      toast.error("Failed to check indexes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const createMissingIndexes = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/admin/database/indexes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createAll: true }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(
          `Created ${data.summary.created} indexes, ${data.summary.existed} already existed`,
        );
        // Refresh the status
        await checkIndexes();
      } else {
        toast.error(data.error || "Failed to create indexes");
      }
    } catch (error) {
      toast.error("Failed to create indexes");
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const toggleCollection = (collection: string) => {
    setExpandedCollections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(collection)) {
        newSet.delete(collection);
      } else {
        newSet.add(collection);
      }
      return newSet;
    });
  };

  useEffect(() => {
    checkIndexes();
  }, []);

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getHealthBg = (score: number) => {
    if (score >= 90) return "bg-green-500/20";
    if (score >= 70) return "bg-yellow-500/20";
    return "bg-red-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-500" />
            Database Indexes
          </h2>
          <p className="text-muted-foreground">
            Monitor and manage MongoDB indexes for optimal performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkIndexes} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button
            onClick={createMissingIndexes}
            disabled={creating || loading || !summary?.totalMissing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Create Missing Indexes
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Health Score */}
          <Card className={cn("border-2", getHealthBg(summary.healthScore))}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Health Score</p>
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      getHealthColor(summary.healthScore),
                    )}
                  >
                    {summary.healthScore}%
                  </p>
                </div>
                <Shield
                  className={cn(
                    "w-10 h-10",
                    getHealthColor(summary.healthScore),
                  )}
                />
              </div>
              <Progress value={summary.healthScore} className="mt-2 h-2" />
            </CardContent>
          </Card>

          {/* Total Indexes */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Required
                  </p>
                  <p className="text-3xl font-bold">{summary.totalRequired}</p>
                </div>
                <Database className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          {/* Existing */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Existing</p>
                  <p className="text-3xl font-bold text-green-500">
                    {summary.totalExisting}
                  </p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          {/* Missing */}
          <Card
            className={cn(
              summary.totalMissing > 0
                ? "border-red-500/30 bg-red-500/5"
                : "border-green-500/30 bg-green-500/5",
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missing</p>
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      summary.totalMissing > 0
                        ? "text-red-500"
                        : "text-green-500",
                    )}
                  >
                    {summary.totalMissing}
                  </p>
                </div>
                {summary.totalMissing > 0 ? (
                  <XCircle className="w-10 h-10 text-red-500" />
                ) : (
                  <CheckCircle className="w-10 h-10 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Collections List */}
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>
            {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {collections.map((col) => (
                <div
                  key={col.collection}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Collection Header */}
                  <button
                    onClick={() => toggleCollection(col.collection)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors",
                      col.missing > 0 && "bg-red-500/10",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {expandedCollections.has(col.collection) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">{col.collection}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-500"
                      >
                        {col.existing} ✓
                      </Badge>
                      {col.missing > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-red-500/10 text-red-500"
                        >
                          {col.missing} missing
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Expanded Index List */}
                  {expandedCollections.has(col.collection) && (
                    <div className="border-t bg-muted/30 p-3 space-y-2">
                      {col.indexes.map((idx) => (
                        <div
                          key={idx.name}
                          className={cn(
                            "flex items-center justify-between p-2 rounded",
                            idx.exists ? "bg-green-500/10" : "bg-red-500/10",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {idx.exists ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <code className="text-sm">{idx.name}</code>
                            {idx.unique && (
                              <Badge variant="secondary" className="text-xs">
                                unique
                              </Badge>
                            )}
                            {idx.ttl && (
                              <Badge variant="secondary" className="text-xs">
                                TTL: {idx.ttl}s
                              </Badge>
                            )}
                          </div>
                          <code className="text-xs text-muted-foreground">
                            {JSON.stringify(idx.keys)}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Warning if missing indexes */}
      {summary && summary.totalMissing > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-yellow-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-500">
                  Performance Warning
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Missing indexes can significantly impact database performance,
                  especially during high load. Queries without proper indexes
                  result in full collection scans, which become slower as data
                  grows.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Recommendation:</strong> Click &quot;Create Missing
                  Indexes&quot; to automatically create all required indexes.
                  This operation runs in the background and won&apos;t block
                  your database.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
