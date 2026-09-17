"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, Wand2, Play, CheckCircle, AlertTriangle, AlertCircle,
  Trophy, Target, Map, BarChart3, Zap, Shield,
  ArrowRight, ArrowLeft, RefreshCw, Download, Loader2,
  Eye, Wrench, Settings, Star,
  Trash2,
} from "lucide-react";
import {
  ALL_GAMIFICATION_RESET_SCOPES,
  GAMIFICATION_REBUILD_WARNING,
  GAMIFICATION_RESET_CONFIRMATION,
  GAMIFICATION_RESET_PROGRESS_WARNING,
  GAMIFICATION_RESET_SCOPE_COPY,
  type GamificationResetScope,
} from "@/lib/admin/gamification-reset-copy";
// Reason: `gamification-economy.ts` is model-free and client-reachable by
// requirement (R58), so a `"use client"` component may import the default from
// it rather than carrying a second copy of the number.
import { DEFAULT_TARGET_BADGE_TOTAL } from "@/lib/services/games/gamification-economy";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SystemStatus {
  badges: {
    total: number;
    byCategory: Record<string, Record<string, number>>;
    byRarity: Record<string, number>;
    levelGating: { withGate: number; withoutGate: number };
    zeroBaselineRisks: string[];
  };
  milestones: {
    total: number;
    byMap: Record<string, number>;
    withBadgeGate: number;
  };
  maps: {
    total: number;
    list: Array<{ mapId: string; name: string; theme: string; difficulty: number; sequenceOrder: number; totalMilestones: number }>;
  };
  xp: {
    configured: boolean;
    badgeXP: { common: number; rare: number; epic: number; legendary: number };
  };
}

interface EvaluationResult {
  overallScore: number;
  scores: Record<string, number>;
  issues: Array<{
    severity: string;
    area: string;
    description: string;
    recommendation: string;
    targetAgent?: string; // "badge_agent" | "milestone_agent" | "manual"
    autoFixable?: boolean;
  }>;
  strengths: string[];
  summary: string;
}

/**
 * A badge row as the wizard's badge stage reports it.
 *
 * Reason: every field is optional because a preview row is whatever the stage
 * has decided so far — a fix proposal carries `_changes`, a candidate carries
 * `_isNew`, and neither is guaranteed to be a complete badge document.
 */
interface WizardBadge {
  id?: string;
  name?: string;
  category?: string;
  rarity?: string;
  minLevel?: number;
  condition?: {
    type?: string;
    value?: number;
    comparison?: string;
    minTrades?: number;
    minCompletedCompetitions?: number;
  };
  _changes?: string;
  _isNew?: boolean;
}

interface BadgeAgentResult {
  applied?: boolean;
  totalBadges?: number;
  fixedCount?: number;
  newCount?: number;
  summary?: string;
  error?: string;
  badges?: WizardBadge[];
}

interface WizardMilestone {
  id?: string;
  mapId?: string;
  name?: string;
  nodeType?: string;
  rewards?: { xp?: number };
  requiredBadgeIds?: string[];
  completeCondition?: { type?: string; value?: number };
  _changes?: string;
}

interface MilestoneAgentResult {
  applied?: boolean;
  totalMilestones?: number;
  fixedCount?: number;
  badgeGatesAdded?: number;
  summary?: string;
  milestones?: WizardMilestone[];
}

/** One line of the full-setup progress list. */
interface FullSetupStep {
  name: string;
  success: boolean;
  summary?: string;
  fixedCount?: number;
  newCount?: number;
  overallScore?: number;
  issueCount?: number;
}

// ─── Wizard Steps ───────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: "overview", label: "System Overview", icon: BarChart3, description: "Current state of all gamification systems" },
  { id: "levels", label: "XP & Levels", icon: Star, description: "Configure level progression and XP values" },
  { id: "badges", label: "Badge Agent", icon: Trophy, description: "AI audits, fixes, and generates badges" },
  { id: "milestones", label: "Milestone Agent", icon: Map, description: "AI audits milestone progression and badge-gating" },
  { id: "evaluate", label: "Evaluate & Fix", icon: Shield, description: "Instant rule-based scoring with one-click auto-fix" },
] as const;

type StepId = typeof WIZARD_STEPS[number]["id"];

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function GamificationWizardSection() {
  const [currentStep, setCurrentStep] = useState<StepId>("overview");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState<string | null>(null);

  // Badge Agent state
  const [badgeResult, setBadgeResult] = useState<BadgeAgentResult | null>(null);
  const [badgeGenCount, setBadgeGenCount] = useState(5);

  /**
   * How many badges the full setup should aim for in total.
   *
   * Reason: this used to share `badgeGenCount` with the AI Badge Agent card,
   * and that is why a full run produced five badges. The two numbers answer
   * different questions and cannot share a control: the agent's count is how
   * many extra badges to ask a language model for in one call, so it is small
   * by necessity (token budget) and capped at 20, while this is the size of the
   * whole catalogue, built deterministically at no per-badge cost. Sharing them
   * silently caps the catalogue at the agent's limit.
   */
  const [setupBadgeTarget, setSetupBadgeTarget] = useState(
    DEFAULT_TARGET_BADGE_TOTAL,
  );

  // Milestone Agent state
  const [milestoneResult, setMilestoneResult] = useState<MilestoneAgentResult | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string>("all");

  // Evaluation state
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // Full setup progress
  const [fullSetupProgress, setFullSetupProgress] = useState<{ step: number; label: string; steps: FullSetupStep[] } | null>(null);

  // Rebuild-from-scratch controls. Default is "add": the destructive mode must
  // be chosen deliberately, never arrived at by leaving a control alone.
  const [setupMode, setSetupMode] = useState<"add" | "rebuild">("add");
  const [resetScopes, setResetScopes] = useState<GamificationResetScope[]>([
    ...ALL_GAMIFICATION_RESET_SCOPES,
  ]);
  const [resetIncludeProgress, setResetIncludeProgress] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");

  // Dialogs
  const [showBadgeDetails, setShowBadgeDetails] = useState(false);
  const [showMilestoneDetails, setShowMilestoneDetails] = useState(false);

  // ─── API Calls ──────────────────────────────────────────────────────────────

  const callWizardAPI = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/ai/gamification-wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callWizardAPI({ action: "get_status" });
      if (data.success) {
        setStatus(data.status);
      } else {
        toast.error("Failed to load system status");
      }
    } catch {
      toast.error("Failed to connect to wizard API");
    }
    setLoading(false);
  }, [callWizardAPI]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ─── Step Navigation ────────────────────────────────────────────────────────

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
  const canGoNext = stepIndex < WIZARD_STEPS.length - 1;
  const canGoPrev = stepIndex > 0;

  const goNext = () => {
    if (canGoNext) setCurrentStep(WIZARD_STEPS[stepIndex + 1].id);
  };

  const goPrev = () => {
    if (canGoPrev) setCurrentStep(WIZARD_STEPS[stepIndex - 1].id);
  };

  // ─── Agent Actions ──────────────────────────────────────────────────────────

  const runBadgeAgent = async (autoApply: boolean) => {
    setStepLoading("badges");
    try {
      const data = await callWizardAPI({
        action: "agent_badges",
        generateCount: badgeGenCount,
        autoApply,
      });
      if (data.success) {
        setBadgeResult(data);
        if (autoApply) {
          toast.success(`Badge agent: ${data.fixedCount} fixed, ${data.newCount} generated — applied to DB`);
          loadStatus();
        } else {
          toast.success(`Badge agent: ${data.fixedCount} to fix, ${data.newCount} new — review before applying`);
        }
      } else {
        toast.error(data.error || "Badge agent failed");
      }
    } catch {
      toast.error("Badge agent error");
    }
    setStepLoading(null);
  };

  const runMilestoneAgent = async (autoApply: boolean) => {
    setStepLoading("milestones");
    try {
      const data = await callWizardAPI({
        action: "agent_milestones",
        mapId: selectedMapId === "all" ? undefined : selectedMapId,
        autoApply,
      });
      if (data.success) {
        setMilestoneResult(data);
        if (autoApply) {
          toast.success(`Milestone agent: ${data.fixedCount} fixed, ${data.badgeGatesAdded} badge-gates — applied to DB`);
          loadStatus();
        } else {
          toast.success(`Milestone agent: ${data.fixedCount} to fix — review before applying`);
        }
      } else {
        toast.error(data.error || "Milestone agent failed");
      }
    } catch {
      toast.error("Milestone agent error");
    }
    setStepLoading(null);
  };

  const runEvaluationAgent = async () => {
    setStepLoading("evaluate");
    try {
      const data = await callWizardAPI({
        action: "agent_evaluate",
      });
      if (data.success && data.evaluation) {
        setEvaluation(data.evaluation);
        toast.success(`Evaluation: Score ${data.evaluation.overallScore}/10 — ${data.evaluation.issues?.length || 0} issues found`);
      } else {
        toast.error(data.error || "Evaluation failed");
      }
    } catch {
      toast.error("Evaluation error");
    }
    setStepLoading(null);
  };

  const runAutoFix = async () => {
    setStepLoading("autofix");
    try {
      const data = await callWizardAPI({ action: "auto_fix" });
      if (data.success) {
        const bp = data.badgeWriteResults;
        const mp = data.milestoneWriteResults;
        const parts: string[] = [];
        if (bp) parts.push(`${bp.applied} badges fixed`);
        if (mp) parts.push(`${mp.applied} milestones fixed`);
        toast.success(`Auto-fix: ${parts.join(", ") || "no fixes needed"}`);
        // Re-run evaluation to show updated scores
        loadStatus();
        const evalData = await callWizardAPI({ action: "agent_evaluate" });
        if (evalData.success && evalData.evaluation) {
          setEvaluation(evalData.evaluation);
        }
      } else {
        toast.error(data.error || "Auto-fix failed");
      }
    } catch {
      toast.error("Auto-fix error");
    }
    setStepLoading(null);
  };

  /**
   * Runs the whole pipeline in ONE server call.
   *
   * Reason (R96b): the browser used to chain four actions in a fixed order,
   * which made the client a second owner of the sequence and of the add-only
   * rule. `run_full` owns both, and it also does the two steps the client
   * version could not: propose a neutral level ladder when none exists, and
   * size badge generation from the measured per-game gap rather than from a
   * number typed into this form.
   */
  const runFullSetup = async () => {
    const rebuilding = setupMode === "rebuild";

    // Reason: refuse here as well as on the server. Sending a request the
    // server will refuse spends an AI call's worth of waiting to be told the
    // operator mistyped a phrase that is on screen in front of them.
    if (rebuilding && resetConfirmation !== GAMIFICATION_RESET_CONFIRMATION) {
      toast.error(`Type "${GAMIFICATION_RESET_CONFIRMATION}" to confirm the rebuild.`);
      return;
    }
    if (rebuilding && resetScopes.length === 0) {
      toast.error("Choose at least one thing to delete, or switch back to Add.");
      return;
    }

    setStepLoading("full");
    setFullSetupProgress({
      step: 1,
      label: rebuilding
        ? "Deleting the existing system, then rebuilding..."
        : "Running full setup (levels, badges, milestones, evaluation)...",
      steps: [],
    });

    try {
      const data = await callWizardAPI({
        action: "run_full",
        generateCount: setupBadgeTarget > 0 ? setupBadgeTarget : undefined,
        mode: setupMode,
        ...(rebuilding
          ? {
              resetScopes,
              confirmation: resetConfirmation,
              includePlayerProgress: resetIncludeProgress,
            }
          : {}),
      });

      if (!data.success) {
        toast.error(data.error || "Full setup failed");
        setFullSetupProgress(null);
        setStepLoading(null);
        return;
      }

      const s = data.steps || {};
      const reset = typeof s.reset === "object" && s.reset !== null ? s.reset : null;
      const xp = s.badgeXp?.badgeXP;
      const steps: FullSetupStep[] = [
        // Reason: the wipe is reported as a step of its own, with counts. A
        // rebuild that silently deleted nothing — a wrong scope, an empty
        // collection — is otherwise indistinguishable from one that worked.
        ...(reset
          ? [
              {
                name: "Rebuild (deleted)",
                success: true,
                summary:
                  Object.entries(reset.deleted || {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ") || "nothing to delete",
              },
            ]
          : []),
        {
          name: "Badge XP values",
          success: true,
          summary:
            s.badgeXp?.action === "kept"
              ? `Kept existing (${xp ? `C${xp.common}/R${xp.rare}/E${xp.epic}/L${xp.legendary}` : "unchanged"})`
              : `Wrote ${s.badgeXp?.action || "xp"}: C${xp?.common ?? "?"}/R${xp?.rare ?? "?"}/E${xp?.epic ?? "?"}/L${xp?.legendary ?? "?"}`,
        },
        {
          name: "Level ladder",
          success: true,
          summary:
            s.levels?.action === "created" || s.levels?.action === "rebuilt"
              ? `${s.levels.action === "rebuilt" ? "Rebuilt" : "Created"} ${s.levels.levelCount} levels (top ${s.levels.topLevelMinXP?.toLocaleString?.() ?? s.levels.topLevelMinXP} XP)`
              : `Kept ${s.levels?.levelCount ?? 0} existing levels`,
        },
        {
          name: "Badges (blueprint)",
          success: !s.badges?.error,
          summary:
            s.badges?.action === "blueprint"
              ? `Generated ${s.badges.generated ?? 0} / target ${s.badges.target ?? "?"} across ${(s.badges.scopes || []).length} scopes`
              : s.badges?.summary || s.badges?.error || "",
          fixedCount: s.badges?.fixedCount || 0,
          newCount: s.badges?.generated || s.badges?.newCount || 0,
        },
        {
          name: "Journeys & milestones",
          success: true,
          summary:
            s.milestones?.action === "blueprint"
              ? `${(s.milestones.mapIds || []).length} maps, milestones written`
              : typeof s.milestones === "string"
                ? s.milestones
                : "skipped",
        },
        {
          name: "Auto-Fix Engine",
          success: true,
          summary: `${s.autoFix?.fixes?.totalFixes || 0} fixes applied`,
        },
        {
          name: "Evaluation Engine",
          success: true,
          overallScore: s.evaluation?.evaluation?.overallScore,
          issueCount: s.evaluation?.evaluation?.issues?.length || 0,
        },
      ];

      if (s.evaluation?.evaluation) setEvaluation(s.evaluation.evaluation);
      if (s.badges && !s.badges.error) setBadgeResult(s.badges);

      setFullSetupProgress({ step: 5, label: "Complete!", steps });

      if (rebuilding) {
        // Reason: back to Add and clear the phrase. Leaving the panel armed
        // means the next press of the same button wipes the system that was
        // just built, which is the one outcome nobody would expect twice.
        setSetupMode("add");
        setResetConfirmation("");
        setResetIncludeProgress(false);
        const orphaned = Object.entries(reset?.orphanedPlayerProgress || {})
          .filter(([, v]) => Number(v) > 0)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ");
        if (orphaned) {
          toast.warning(
            `Kept player-earned rows that now point at deleted content: ${orphaned}`,
          );
        }
      }

      loadStatus();
      setCurrentStep("evaluate");

      const missing = data.coverage?.badgeCoverage?.missingTotal ?? 0;
      toast.success(
        missing > 0
          ? `Full setup complete \u2014 ${missing} badge gap(s) still open, run again to fill them`
          : "Full setup complete \u2014 every game is covered",
      );
    } catch {
      toast.error("Full setup error \u2014 check your connection");
      setFullSetupProgress(null);
    }
    setStepLoading(null);
  };

  const applyChanges = async (badges?: WizardBadge[], milestones?: WizardMilestone[]) => {
    setStepLoading("apply");
    try {
      const data = await callWizardAPI({
        action: "apply_changes",
        badges,
        milestones,
      });
      if (data.success) {
        const parts = [];
        if (data.results.badges) parts.push(`Badges: ${data.results.badges.created} new, ${data.results.badges.updated} updated`);
        if (data.results.milestones) parts.push(`Milestones: ${data.results.milestones.created} new, ${data.results.milestones.updated} updated`);
        toast.success(parts.join(" | ") || "Changes applied");
        loadStatus();
      } else {
        toast.error(data.error || "Apply failed");
      }
    } catch {
      toast.error("Apply error");
    }
    setStepLoading(null);
  };

  const applyLevelPreset = async (preset: string) => {
    setStepLoading("levels");
    try {
      const data = await callWizardAPI({ action: "setup_levels", preset });
      if (data.success) {
        toast.success(data.message);
        loadStatus();
      } else {
        toast.error(data.error || "Failed to apply preset");
      }
    } catch {
      toast.error("Failed to apply preset");
    }
    setStepLoading(null);
  };

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400";
    if (score >= 6) return "text-yellow-400";
    if (score >= 4) return "text-orange-400";
    return "text-red-400";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const isStepLoading = (step: string) => stepLoading === step || stepLoading === "full" || stepLoading === "apply" || stepLoading === "autofix";

  // ─── Render: Overview Step ──────────────────────────────────────────────────

  const renderOverview = () => {
    if (!status) return <div className="text-gray-400 text-center py-8">Loading system status...</div>;

    return (
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{status.badges.total}</div>
              <div className="text-xs text-gray-400">Badges</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{status.milestones.total}</div>
              <div className="text-xs text-gray-400">Milestones</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Map className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{status.maps.total}</div>
              <div className="text-xs text-gray-400">Maps</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">20</div>
              <div className="text-xs text-gray-400">Levels</div>
            </CardContent>
          </Card>
        </div>

        {/* Health Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Badge Health */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-400" /> Badge Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Level-gated</span>
                <span className={status.badges.levelGating.withGate > 0 ? "text-green-400" : "text-red-400"}>
                  {status.badges.levelGating.withGate}/{status.badges.total}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">No gate (minLevel=0)</span>
                <span className={status.badges.levelGating.withoutGate > status.badges.total * 0.5 ? "text-orange-400" : "text-green-400"}>
                  {status.badges.levelGating.withoutGate}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Zero-baseline risks</span>
                <span className={status.badges.zeroBaselineRisks.length > 0 ? "text-red-400" : "text-green-400"}>
                  {status.badges.zeroBaselineRisks.length}
                </span>
              </div>
              <Separator className="bg-gray-700" />
              <div className="flex flex-wrap gap-1">
                {Object.entries(status.badges.byRarity).map(([rarity, count]) => (
                  <Badge
                    key={rarity}
                    variant="outline"
                    className={
                      rarity === "common" ? "border-gray-500 text-gray-400" :
                        rarity === "rare" ? "border-blue-500 text-blue-400" :
                          rarity === "epic" ? "border-purple-500 text-purple-400" :
                            "border-yellow-500 text-yellow-400"
                    }
                  >
                    {rarity}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Milestone Health */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-400" /> Milestone Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Badge-gated</span>
                <span className={status.milestones.withBadgeGate > 0 ? "text-green-400" : "text-orange-400"}>
                  {status.milestones.withBadgeGate}
                </span>
              </div>
              <Separator className="bg-gray-700" />
              <div className="text-xs text-gray-400">Milestones per map:</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(status.milestones.byMap).sort().slice(0, 10).map(([mapId, count]) => (
                  <div key={mapId} className="flex justify-between text-xs">
                    <span className="text-gray-500 truncate">{mapId}</span>
                    <span className="text-gray-300">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* XP Health */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" /> XP Economy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Badge XP configured</span>
                <span className={status.xp.configured ? "text-green-400" : "text-orange-400"}>
                  {status.xp.configured ? "Yes" : "Defaults"}
                </span>
              </div>
              <Separator className="bg-gray-700" />
              <div className="space-y-1">
                {Object.entries(status.xp.badgeXP).map(([rarity, xp]) => (
                  <div key={rarity} className="flex justify-between text-xs">
                    <span className="text-gray-500 capitalize">{rarity}</span>
                    <span className="text-gray-300">{xp} XP</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* One-Click Full Setup */}
        <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-700/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-purple-400" /> One-Click Full Setup
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Level ladder → AI Badge Agent → AI Milestone Agent → Evaluate → Auto-Fix, in one pass. Choose whether to add to what you already have, or delete it and start again.
                </p>
              </div>
              <Button
                onClick={runFullSetup}
                disabled={isStepLoading("full")}
                className={
                  setupMode === "rebuild"
                    ? "bg-red-600 hover:bg-red-500 text-white px-6"
                    : "bg-purple-600 hover:bg-purple-500 text-white px-6"
                }
              >
                {isStepLoading("full") ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
                ) : setupMode === "rebuild" ? (
                  <><Trash2 className="h-4 w-4 mr-2" /> Delete & Rebuild</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" /> Run All Agents</>
                )}
              </Button>
            </div>

            {/* ── Add vs Rebuild ───────────────────────────────────────────── */}
            <div className="space-y-3 pt-2 border-t border-purple-700/30">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSetupMode("add")}
                  className={`text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                    setupMode === "add"
                      ? "border-purple-500 bg-purple-900/30"
                      : "border-gray-700 bg-gray-900/40 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Play className="h-4 w-4 text-purple-400" /> Add to what exists
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Keeps everything you already have and writes only what is
                    missing for each game. Your edits are never overwritten.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSetupMode("rebuild")}
                  className={`text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                    setupMode === "rebuild"
                      ? "border-red-500 bg-red-900/30"
                      : "border-gray-700 bg-gray-900/40 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Trash2 className="h-4 w-4 text-red-400" /> Start from scratch
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Deletes the selected content first, then builds a fresh
                    system in the same run. There is no undo.
                  </p>
                </button>
              </div>

              <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-3">
                <Label htmlFor="setup-badge-target" className="text-gray-300">
                  How many badges in total
                </Label>
                <Input
                  id="setup-badge-target"
                  type="number"
                  min={20}
                  max={1000}
                  value={setupBadgeTarget}
                  onChange={(e) => setSetupBadgeTarget(Number(e.target.value))}
                  className="bg-gray-900 border-gray-600 text-white mt-1 max-w-[10rem]"
                />
                <p className="text-xs text-gray-400 mt-2">
                  {setupMode === "rebuild"
                    ? "The size of the catalogue to build. It is shared out across trading, every game in your catalogue, and the badges everybody can earn, so raising it adds badges to all of them rather than only to trading."
                    : "The size the catalogue should reach. Only the shortfall is written, so a number at or below what you already have adds nothing."}
                </p>
              </div>

              {setupMode === "rebuild" && (
                <div className="rounded-lg border border-red-700/60 bg-red-950/30 p-4 space-y-3">
                  <p className="text-xs text-red-200">{GAMIFICATION_REBUILD_WARNING}</p>

                  <div className="space-y-2">
                    {GAMIFICATION_RESET_SCOPE_COPY.map((scope) => {
                      const checked = resetScopes.includes(scope.id);
                      return (
                        <label
                          key={scope.id}
                          className="flex gap-3 items-start cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 accent-red-500 cursor-pointer"
                            checked={checked}
                            onChange={(e) =>
                              setResetScopes((prev) =>
                                e.target.checked
                                  ? [...prev, scope.id]
                                  : prev.filter((s) => s !== scope.id),
                              )
                            }
                          />
                          <span>
                            <span className="text-sm text-white">{scope.label}</span>
                            <span className="block text-xs text-gray-400">
                              {scope.consequence}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <Separator className="bg-red-800/50" />

                  <label className="flex gap-3 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 accent-red-500 cursor-pointer"
                      checked={resetIncludeProgress}
                      onChange={(e) => setResetIncludeProgress(e.target.checked)}
                    />
                    <span className="text-xs text-red-200">
                      {GAMIFICATION_RESET_PROGRESS_WARNING}
                    </span>
                  </label>

                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">
                      Type{" "}
                      <span className="font-mono text-red-300">
                        {GAMIFICATION_RESET_CONFIRMATION}
                      </span>{" "}
                      to confirm
                    </Label>
                    <Input
                      value={resetConfirmation}
                      onChange={(e) => setResetConfirmation(e.target.value)}
                      placeholder={GAMIFICATION_RESET_CONFIRMATION}
                      className="bg-gray-900 border-gray-700 text-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Live Progress */}
            {fullSetupProgress && (
              <div className="space-y-3 pt-2 border-t border-purple-700/30">
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <Progress value={(fullSetupProgress.step / 5) * 100} className="h-2 bg-gray-700 flex-1" />
                  <span className="text-xs text-purple-300 whitespace-nowrap">
                    {fullSetupProgress.step <= 4 ? `${fullSetupProgress.step}/4` : "Done"}
                  </span>
                </div>

                {/* Current step label */}
                <div className="flex items-center gap-2 text-sm">
                  {fullSetupProgress.step <= 4 ? (
                    <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  )}
                  <span className="text-gray-300">{fullSetupProgress.label}</span>
                </div>

                {/* Completed steps */}
                {fullSetupProgress.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {s.success ? (
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-400" />
                    )}
                    <span className={s.success ? "text-green-400" : "text-red-400"}>
                      {s.name}: {s.summary || (s.overallScore ? `Score ${s.overallScore}/10` : s.success ? "Done" : "Failed")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Render: Levels Step ────────────────────────────────────────────────────

  const renderLevels = () => (
    <div className="space-y-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-400" /> XP Presets
          </CardTitle>
          <CardDescription className="text-gray-400">
            Choose a preset to configure how much XP badges award. This affects how fast players level up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: "conservative", name: "Conservative", desc: "Slower progression. Players need more effort.", badgeXP: { common: 5, rare: 15, epic: 35, legendary: 75 }, color: "border-blue-500/50" },
              { id: "balanced", name: "Balanced", desc: "Default balanced progression.", badgeXP: { common: 10, rare: 25, epic: 50, legendary: 100 }, color: "border-green-500/50" },
              { id: "aggressive", name: "Aggressive", desc: "Faster progression. Good for smaller user bases.", badgeXP: { common: 15, rare: 35, epic: 75, legendary: 150 }, color: "border-orange-500/50" },
            ].map((preset) => (
              <Card key={preset.id} className={`bg-gray-900/50 ${preset.color} cursor-pointer hover:bg-gray-900/80 transition-colors`}>
                <CardContent className="p-4">
                  <h4 className="text-white font-semibold mb-1">{preset.name}</h4>
                  <p className="text-xs text-gray-400 mb-3">{preset.desc}</p>
                  <div className="space-y-1 mb-3">
                    {Object.entries(preset.badgeXP).map(([rarity, xp]) => (
                      <div key={rarity} className="flex justify-between text-xs">
                        <span className="text-gray-500 capitalize">{rarity}</span>
                        <span className="text-gray-300">{xp} XP</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:text-white"
                    disabled={isStepLoading("levels")}
                    onClick={() => applyLevelPreset(preset.id)}
                  >
                    {isStepLoading("levels") ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply Preset"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Level Progression Table */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Level Progression (20 Levels)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { lvl: 1, title: "Novice Trader", xp: 0 },
              { lvl: 2, title: "Apprentice", xp: 50 },
              { lvl: 3, title: "Trainee", xp: 125 },
              { lvl: 4, title: "Junior Trader", xp: 250 },
              { lvl: 5, title: "Rising Trader", xp: 375 },
              { lvl: 6, title: "Skilled Trader", xp: 500 },
              { lvl: 7, title: "Competent Trader", xp: 750 },
              { lvl: 8, title: "Proficient Trader", xp: 1100 },
              { lvl: 9, title: "Expert Trader", xp: 1450 },
              { lvl: 10, title: "Senior Trader", xp: 1800 },
              { lvl: 11, title: "Elite Trader", xp: 2000 },
              { lvl: 12, title: "Master Trader", xp: 2500 },
              { lvl: 13, title: "Grand Master", xp: 3000 },
              { lvl: 14, title: "Trading Virtuoso", xp: 3500 },
              { lvl: 15, title: "Trading Champion", xp: 4000 },
              { lvl: 16, title: "Market Legend", xp: 5000 },
              { lvl: 17, title: "Trading Titan", xp: 6000 },
              { lvl: 18, title: "Market Overlord", xp: 7500 },
              { lvl: 19, title: "Trading Immortal", xp: 10000 },
              { lvl: 20, title: "Trading God", xp: 15000 },
            ].map((l) => (
              <div key={l.lvl} className="flex items-center gap-2 text-xs p-2 rounded bg-gray-900/50">
                <span className={`font-bold w-6 ${l.lvl <= 5 ? "text-green-400" : l.lvl <= 10 ? "text-blue-400" : l.lvl <= 15 ? "text-purple-400" : "text-yellow-400"}`}>
                  {l.lvl}
                </span>
                <span className="text-gray-300 truncate flex-1">{l.title}</span>
                <span className="text-gray-500">{l.xp.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─── Render: Badges Step ────────────────────────────────────────────────────

  const renderBadges = () => (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" /> Badge Agent
          </CardTitle>
          <CardDescription className="text-gray-400">
            The Badge Agent reads all badges from the database, sends them to AI for audit, fixes issues (minLevel, conditions, zero-baseline), and optionally generates new ones. It knows about milestones too, so it protects badge-gated connections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-gray-400 text-xs">New badges to generate</Label>
              <Input
                type="number"
                min={0}
                max={20}
                value={badgeGenCount}
                onChange={(e) => setBadgeGenCount(Number(e.target.value))}
                className="bg-gray-900 border-gray-600 text-white mt-1"
              />
            </div>
            <Button
              onClick={() => runBadgeAgent(false)}
              disabled={isStepLoading("badges")}
              variant="outline"
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
            >
              {isStepLoading("badges") ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" /> Preview Changes</>
              )}
            </Button>
            <Button
              onClick={() => runBadgeAgent(true)}
              disabled={isStepLoading("badges")}
              className="bg-yellow-600 hover:bg-yellow-500 text-white"
            >
              {isStepLoading("badges") ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
              ) : (
                <><Wrench className="h-4 w-4 mr-2" /> Audit, Fix & Apply</>
              )}
            </Button>
          </div>

          {/* Status */}
          {status && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-gray-600 text-gray-400">
                {status.badges.total} total badges
              </Badge>
              <Badge variant="outline" className={status.badges.zeroBaselineRisks.length > 0 ? "border-red-600 text-red-400" : "border-green-600 text-green-400"}>
                {status.badges.zeroBaselineRisks.length} zero-baseline risks
              </Badge>
              <Badge variant="outline" className={status.badges.levelGating.withoutGate > status.badges.total * 0.5 ? "border-orange-600 text-orange-400" : "border-green-600 text-green-400"}>
                {status.badges.levelGating.withGate} level-gated
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {badgeResult && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm">Badge Agent Results</CardTitle>
              <div className="flex gap-2">
                {!badgeResult.applied && (badgeResult.badges?.length ?? 0) > 0 && (
                  <Button
                    size="sm"
                    onClick={() => applyChanges(badgeResult.badges)}
                    disabled={isStepLoading("apply")}
                    className="bg-green-600 hover:bg-green-500 text-white"
                  >
                    {isStepLoading("apply") ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Download className="h-3 w-3 mr-1" /> Apply to DB</>}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-400"
                  onClick={() => setShowBadgeDetails(true)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded bg-gray-900/50">
                <div className="text-xl font-bold text-white">{badgeResult.totalBadges}</div>
                <div className="text-xs text-gray-400">Total in DB</div>
              </div>
              <div className="text-center p-3 rounded bg-orange-900/20">
                <div className="text-xl font-bold text-orange-400">{badgeResult.fixedCount}</div>
                <div className="text-xs text-gray-400">Need Fixes</div>
              </div>
              <div className="text-center p-3 rounded bg-green-900/20">
                <div className="text-xl font-bold text-green-400">{badgeResult.newCount}</div>
                <div className="text-xs text-gray-400">New Generated</div>
              </div>
              <div className="text-center p-3 rounded bg-blue-900/20">
                <div className="text-xl font-bold text-blue-400">
                  {badgeResult.applied ? "Applied" : "Preview"}
                </div>
                <div className="text-xs text-gray-400">Status</div>
              </div>
            </div>
            {badgeResult.summary && (
              <p className="text-sm text-gray-400 mt-3">{badgeResult.summary}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Badge Details Dialog */}
      <Dialog open={showBadgeDetails} onOpenChange={setShowBadgeDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Badge Agent — Detailed Results</DialogTitle>
            <DialogDescription className="text-gray-400">
              Badges marked with changes were fixed by the AI agent.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {badgeResult?.badges?.map((b, i) => (
                <div
                  key={b.id || i}
                  className={`p-3 rounded border ${b._changes ? "border-orange-500/30 bg-orange-900/10" : b._isNew ? "border-green-500/30 bg-green-900/10" : "border-gray-700/30 bg-gray-800/30"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{b.name}</span>
                      <Badge variant="outline" className={
                        b.rarity === "common" ? "border-gray-500 text-gray-400 text-[10px]" :
                          b.rarity === "rare" ? "border-blue-500 text-blue-400 text-[10px]" :
                            b.rarity === "epic" ? "border-purple-500 text-purple-400 text-[10px]" :
                              "border-yellow-500 text-yellow-400 text-[10px]"
                      }>{b.rarity}</Badge>
                      {(b.minLevel ?? 0) > 0 && (
                        <Badge variant="outline" className="border-cyan-500 text-cyan-400 text-[10px]">Lv.{b.minLevel}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{b.category}</span>
                  </div>
                  {b._changes && (
                    <div className="mt-1 text-xs text-orange-400 flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> {b._changes}
                    </div>
                  )}
                  {b._isNew && (
                    <div className="mt-1 text-xs text-green-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> New badge
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {b.condition?.type}: {b.condition?.value} ({b.condition?.comparison || "gte"})
                    {b.condition?.minTrades ? ` | minTrades: ${b.condition.minTrades}` : ""}
                    {b.condition?.minCompletedCompetitions ? ` | minComps: ${b.condition.minCompletedCompetitions}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );

  // ─── Render: Milestones Step ────────────────────────────────────────────────

  const renderMilestones = () => {
    if (!status) return <div className="text-gray-400 text-center py-8">Loading system status...</div>;

    return (
    <div className="space-y-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Map className="h-5 w-5 text-blue-400" /> Milestone Agent
          </CardTitle>
          <CardDescription className="text-gray-400">
            The Milestone Agent processes one map at a time for speed. It checks progression consistency, adds badge-gating at strategic checkpoints, and fixes reward values. Select a map or let it auto-pick.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-gray-400 text-xs">Target map (or audit all)</Label>
              <Select value={selectedMapId} onValueChange={setSelectedMapId}>
                <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="all">All Maps</SelectItem>
                  {status?.maps?.list?.map((m) => (
                    <SelectItem key={m.mapId} value={m.mapId}>
                      {m.name} (#{m.sequenceOrder})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => runMilestoneAgent(false)}
              disabled={isStepLoading("milestones")}
              variant="outline"
              className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
            >
              {isStepLoading("milestones") ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" /> Preview Changes</>
              )}
            </Button>
            <Button
              onClick={() => runMilestoneAgent(true)}
              disabled={isStepLoading("milestones")}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isStepLoading("milestones") ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
              ) : (
                <><Wrench className="h-4 w-4 mr-2" /> Audit, Fix & Apply</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {milestoneResult && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm">Milestone Agent Results</CardTitle>
              <div className="flex gap-2">
                {!milestoneResult.applied && (milestoneResult.milestones?.length ?? 0) > 0 && (
                  <Button
                    size="sm"
                    onClick={() => applyChanges(undefined, milestoneResult.milestones)}
                    disabled={isStepLoading("apply")}
                    className="bg-green-600 hover:bg-green-500 text-white"
                  >
                    {isStepLoading("apply") ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Download className="h-3 w-3 mr-1" /> Apply to DB</>}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-400"
                  onClick={() => setShowMilestoneDetails(true)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded bg-gray-900/50">
                <div className="text-xl font-bold text-white">{milestoneResult.totalMilestones}</div>
                <div className="text-xs text-gray-400">Total</div>
              </div>
              <div className="text-center p-3 rounded bg-orange-900/20">
                <div className="text-xl font-bold text-orange-400">{milestoneResult.fixedCount}</div>
                <div className="text-xs text-gray-400">Fixed</div>
              </div>
              <div className="text-center p-3 rounded bg-purple-900/20">
                <div className="text-xl font-bold text-purple-400">{milestoneResult.badgeGatesAdded}</div>
                <div className="text-xs text-gray-400">Badge Gates</div>
              </div>
              <div className="text-center p-3 rounded bg-blue-900/20">
                <div className="text-xl font-bold text-blue-400">
                  {milestoneResult.applied ? "Yes" : "No"}
                </div>
                <div className="text-xs text-gray-400">Applied</div>
              </div>
            </div>
            {milestoneResult.summary && (
              <p className="text-sm text-gray-400 mt-3">{milestoneResult.summary}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Milestone Details Dialog */}
      <Dialog open={showMilestoneDetails} onOpenChange={setShowMilestoneDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Milestone Agent — Detailed Results</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {milestoneResult?.milestones?.map((m, i) => (
                <div
                  key={m.id || i}
                  className={`p-3 rounded border ${m._changes ? "border-orange-500/30 bg-orange-900/10" : "border-gray-700/30 bg-gray-800/30"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{m.mapId}</span>
                      <span className="text-sm font-semibold text-white">{m.name}</span>
                      <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-400">
                        {m.nodeType}
                      </Badge>
                    </div>
                    <span className="text-xs text-purple-400">{m.rewards?.xp || 0} XP</span>
                  </div>
                  {(m.requiredBadgeIds?.length ?? 0) > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                      <Shield className="h-3 w-3 text-cyan-400" />
                      <span className="text-xs text-cyan-400">Requires: {(m.requiredBadgeIds ?? []).join(", ")}</span>
                    </div>
                  )}
                  {m._changes && (
                    <div className="mt-1 text-xs text-orange-400 flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> {m._changes}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {m.completeCondition?.type}: {m.completeCondition?.value}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
  };

  // ─── Render: Evaluate Step ──────────────────────────────────────────────────

  const renderEvaluate = () => (
    <div className="space-y-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" /> Evaluation Engine
            <Badge variant="outline" className="border-green-600 text-green-400 text-[10px] ml-2">INSTANT</Badge>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Local rule-based engine — <strong className="text-white">no AI, no timeouts</strong>. Scores 10 criteria (progression, difficulty, zero-baseline, level gating, etc.) using deterministic rules.
            Auto-Fix applies targeted corrections: sets minLevel, minTrades, minCompletedCompetitions, and removes invalid badge references.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            onClick={() => runEvaluationAgent()}
            disabled={isStepLoading("evaluate")}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            {isStepLoading("evaluate") ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Evaluating...</>
            ) : (
              <><BarChart3 className="h-4 w-4 mr-2" /> Run Evaluation</>
            )}
          </Button>
          <Button
            onClick={() => runAutoFix()}
            disabled={isStepLoading("autofix") || isStepLoading("evaluate")}
            className="bg-orange-600 hover:bg-orange-500 text-white"
          >
            {isStepLoading("autofix") ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fixing...</>
            ) : (
              <><Wrench className="h-4 w-4 mr-2" /> Auto-Fix All Issues</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Score Display */}
      {evaluation && (
        <>
          {/* Overall Score */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                    {evaluation.overallScore}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">/ 10</div>
                </div>
                <div className="flex-1">
                  <Progress value={evaluation.overallScore * 10} className="h-3 bg-gray-700" />
                  <p className="text-sm text-gray-400 mt-2">{evaluation.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {evaluation.scores && Object.entries(evaluation.scores).map(([key, score]) => (
                  <div key={key} className="text-center p-3 rounded bg-gray-900/50">
                    <div className={`text-lg font-bold ${getScoreColor(score as number)}`}>
                      {score as number}
                    </div>
                    <div className="text-[10px] text-gray-400 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Strengths */}
          {evaluation.strengths?.length > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" /> Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">+</span> {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Issues (Recommendations) */}
          {(evaluation.issues?.length ?? 0) > 0 && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" /> Issues ({evaluation.issues.length})
                      {evaluation.issues.filter((i) => i.autoFixable).length > 0 && (
                        <Badge variant="outline" className="border-orange-500 text-orange-400 text-[10px] ml-1">
                          {evaluation.issues.filter((i) => i.autoFixable).length} auto-fixable
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-500 text-xs mt-1">
                      Auto-fixable issues are resolved by the &quot;Auto-Fix All Issues&quot; button above.
                    </CardDescription>
                  </div>
                  {evaluation.issues.filter((i) => i.autoFixable).length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => runAutoFix()}
                      disabled={isStepLoading("autofix")}
                      className="bg-orange-600 hover:bg-orange-500 text-white"
                    >
                      {isStepLoading("autofix") ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wrench className="h-3 w-3 mr-1" /> Fix {evaluation.issues.filter((i) => i.autoFixable).length} Issues</>}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {evaluation.issues.map((issue, i) => (
                    <div key={i} className={`p-3 rounded border ${getSeverityColor(issue.severity)}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getSeverityColor(issue.severity) + " text-[10px]"}>
                            {issue.severity}
                          </Badge>
                          <Badge variant="outline" className="border-gray-600 text-gray-400 text-[10px]">
                            {issue.area}
                          </Badge>
                          {issue.targetAgent && (
                            <Badge variant="outline" className="border-cyan-600 text-cyan-400 text-[10px]">
                              {issue.targetAgent === "badge_agent" ? "Badge Agent"
                                : issue.targetAgent === "milestone_agent" ? "Milestone Agent"
                                : "Manual"}
                            </Badge>
                          )}
                          {issue.autoFixable && (
                            <Badge variant="outline" className="border-orange-500 text-orange-400 text-[10px]">
                              auto-fixable
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">{issue.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="text-gray-400">Fix:</span> {issue.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Wand2 className="h-7 w-7 text-purple-400" />
            Gamification Wizard
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Unified system for XP, Badges, and Milestones — powered by specialized AI agents
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadStatus}
          disabled={loading}
          className="border-gray-600 text-gray-400 hover:text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700 overflow-x-auto">
        {WIZARD_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isPast = i < stepIndex;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/30"
                  : isPast
                    ? "text-green-400 hover:bg-gray-700/50"
                    : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {step.label}
              {isPast && <CheckCircle className="h-3 w-3 text-green-400" />}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {(() => {
          try {
            if (currentStep === "overview") return renderOverview();
            if (currentStep === "levels") return renderLevels();
            if (currentStep === "badges") return renderBadges();
            if (currentStep === "milestones") return renderMilestones();
            if (currentStep === "evaluate") return renderEvaluate();
            return null;
          } catch (err) {
            console.error("[GamificationWizard] Render error on step:", currentStep, err);
            return (
              <div className="text-center py-12 space-y-4">
                <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
                <p className="text-red-400 font-medium">Something went wrong rendering this step</p>
                <p className="text-gray-500 text-sm">{err instanceof Error ? err.message : "Unknown error"}</p>
                <Button variant="outline" onClick={() => { setCurrentStep("overview"); loadStatus(); }} className="border-gray-600 text-gray-400">
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset to Overview
                </Button>
              </div>
            );
          }
        })()}
      </div>

      {/* Step Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={!canGoPrev}
          className="border-gray-600 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Previous
        </Button>
        <div className="text-sm text-gray-500">
          Step {stepIndex + 1} of {WIZARD_STEPS.length}
        </div>
        <Button
          onClick={goNext}
          disabled={!canGoNext}
          className="bg-purple-600 hover:bg-purple-500 text-white"
        >
          Next <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
