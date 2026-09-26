"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────
interface FraudAlert {
  _id: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "pending" | "investigating" | "resolved" | "dismissed";
  primaryUserId: string;
  suspiciousUserIds: string[];
  confidence: number;
  title: string;
  description: string;
  detectedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidence: Array<{ type: string; description: string; data: any }>;
  resolution?: string;
  actionTaken?: string;
  detectionCount?: number;
  detectionHistory?: Array<{
    timestamp: string;
    triggeredBy: string;
    ipAddress?: string;
    details?: string;
  }>;
}

interface AIInvestigationReportProps {
  alert: FraudAlert;
}

interface ReportUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// ─── Markdown-like renderer ─────────────────────────────────
// Reason: We render the AI's markdown report into styled HTML
// without pulling in a full markdown library. Handles headers,
// bold, bullet lists, numbered lists, and inline code.
function renderMarkdown(text: string): JSX.Element[] {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let keyCounter = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, i) => (
      <li key={i} className="text-sm text-gray-300 leading-relaxed">
        <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
      </li>
    ));
    if (listType === "ol") {
      elements.push(
        <ol
          key={`list-${keyCounter++}`}
          className="list-decimal list-inside space-y-1 my-2 pl-2"
        >
          {items}
        </ol>,
      );
    } else {
      elements.push(
        <ul
          key={`list-${keyCounter++}`}
          className="list-disc list-inside space-y-1 my-2 pl-2"
        >
          {items}
        </ul>,
      );
    }
    listBuffer = [];
    listType = null;
  };

  const inlineFormat = (str: string): string => {
    return str
      .replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="text-gray-100 font-semibold">$1</strong>',
      )
      .replace(
        /`(.+?)`/g,
        '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs font-mono text-yellow-400">$1</code>',
      );
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${keyCounter++}`}
          className="text-base font-bold text-gray-100 mt-5 mb-2 flex items-center gap-2"
        >
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(4)) }} />
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${keyCounter++}`}
          className="text-lg font-bold text-gray-100 mt-6 mb-2"
        >
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(3)) }} />
        </h2>,
      );
      continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ")) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(trimmed.slice(2));
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(numberedMatch[1]);
      continue;
    }

    // Empty line
    if (trimmed === "") {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p
        key={`p-${keyCounter++}`}
        className="text-sm text-gray-300 leading-relaxed my-1.5"
      >
        <span dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
      </p>,
    );
  }

  flushList();
  return elements;
}

// ─── Main Component ─────────────────────────────────────────
export default function AIInvestigationReport({
  alert,
}: AIInvestigationReportProps) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ReportUsage | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/fraud/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Failed to generate report");
        return;
      }

      setReport(data.report);
      setUsage(data.usage || null);
      toast.success("AI report generated successfully");
    } catch (err) {
      console.error("AI report error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [alert]);

  const copyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("Report copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Not yet generated — show the trigger button
  if (!report && !loading && !error) {
    return (
      <div className="p-4 bg-gradient-to-br from-violet-900/20 to-blue-900/20 rounded-lg border border-violet-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">
                AI Investigation Report
              </p>
              <p className="text-xs text-gray-400">
                Generate a detailed analysis with recommended actions
              </p>
            </div>
          </div>
          <Button
            onClick={generateReport}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-500/30 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 bg-gradient-to-r from-violet-900/30 to-blue-900/30 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              AI Investigation Report
              {loading && (
                <Badge className="bg-violet-500/20 text-violet-400 text-[10px]">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Generating...
                </Badge>
              )}
              {report && !loading && (
                <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                  ✓ Generated
                </Badge>
              )}
            </p>
            {usage && (
              <p className="text-[10px] text-gray-500">
                Model: {usage.model} · Tokens: {usage.inputTokens} in /{" "}
                {usage.outputTokens} out
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-gray-400 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  copyReport();
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-gray-400 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  generateReport();
                }}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 bg-gray-900/60">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-12 w-12 bg-violet-500/20 rounded-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
              </div>
              <p className="text-sm text-gray-400">
                Analyzing {alert.evidence?.length || 0} evidence items across{" "}
                {alert.suspiciousUserIds?.length || 0} accounts...
              </p>
              <p className="text-xs text-gray-500">This may take 10-30 seconds</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={generateReport}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Report content */}
          {report && !loading && (
            <div className="prose prose-invert max-w-none">
              {renderMarkdown(report)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
