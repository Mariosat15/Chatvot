"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Crown,
  Trophy,
  ArrowLeft,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Shield,
  Users,
  Clock,
  Target,
  Award,
  AlertCircle,
  AlertTriangle,
  Zap,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Gauge,
  Lock,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GMSubscription {
  limits: {
    maxCompetitionsPerDay: number;
    maxUsersPerCompetition: number;
    referralFeePercentage: number;
  };
  currentPeriodCompetitionsCreated: number;
  packageName: string;
}

interface CompetitionRules {
  rankingMethod:
    | "pnl"
    | "roi"
    | "total_capital"
    | "win_rate"
    | "total_wins"
    | "profit_factor";
  tieBreaker1:
    | "trades_count"
    | "win_rate"
    | "total_capital"
    | "roi"
    | "join_time"
    | "split_prize";
  tieBreaker2?:
    | "trades_count"
    | "win_rate"
    | "total_capital"
    | "roi"
    | "join_time"
    | "split_prize";
  minimumTrades: number;
  minimumWinRate?: number;
  tiePrizeDistribution: "split_equally" | "split_weighted" | "first_gets_all";
  disqualifyOnLiquidation: boolean;
}

interface LevelRequirement {
  enabled: boolean;
  minLevel: number;
  maxLevel?: number;
}

interface DifficultySettings {
  mode: "auto" | "manual";
  manualLevel?: "beginner" | "intermediate" | "advanced" | "expert" | "extreme";
}

export default function GMCreateCompetitionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [subscription, setSubscription] = useState<GMSubscription | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState({
    platformFeePercentage: 10,
    creditName: "Credits",
    creditSymbol: "⚡",
    currencySymbol: "€",
    currencyCode: "EUR",
  });

  // Risk settings from database
  const [riskSettings, setRiskSettings] = useState<{
    maxLeverage: number;
    minLeverage: number;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    entryFeeCredits: 10,
    startingTradingPoints: 10000,
    minParticipants: 2,
    maxParticipants: 50,
    startDate: "",
    startTime: "12:00",
    endDate: "",
    endTime: "18:00",
    leverageAllowed: 30,
    // Risk Limits
    riskLimitsEnabled: false,
    maxDrawdownPercent: 50,
    dailyLossLimitPercent: 20,
    // Equity-based check (anti-fraud)
    equityCheckEnabled: false,
    equityDrawdownPercent: 30,
  });

  const [assetClasses, setAssetClasses] = useState({
    forex: true,
    crypto: false,
    stocks: false,
  });

  const [prizeDistribution, setPrizeDistribution] = useState([
    { rank: 1, percentage: 70 },
    { rank: 2, percentage: 20 },
    { rank: 3, percentage: 10 },
  ]);

  const [competitionRules, setCompetitionRules] = useState<CompetitionRules>({
    rankingMethod: "pnl",
    tieBreaker1: "trades_count",
    tieBreaker2: undefined,
    minimumTrades: 1,
    minimumWinRate: undefined,
    tiePrizeDistribution: "split_equally",
    disqualifyOnLiquidation: true,
  });

  const [levelRequirement, setLevelRequirement] = useState<LevelRequirement>({
    enabled: false,
    minLevel: 1,
    maxLevel: undefined,
  });

  const [difficultySettings, setDifficultySettings] =
    useState<DifficultySettings>({
      mode: "auto",
      manualLevel: undefined,
    });

  // Market status state
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    status: string;
    message: string;
    warnings: string[];
    canCreateCompetition: boolean;
    loading: boolean;
  }>({
    isOpen: true,
    status: "unknown",
    message: "Checking market status...",
    warnings: [],
    canCreateCompetition: true,
    loading: true,
  });

  // Current UTC time for display
  const [currentUTC, setCurrentUTC] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUTC(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUTCTime = (date: Date) => {
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    const seconds = date.getUTCSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatUTCDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Fetch GM subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/gamemaster/status");
        const data = await response.json();

        if (data.success && data.isGameMaster && data.subscription) {
          setSubscription({
            limits: data.subscription.limits,
            currentPeriodCompetitionsCreated:
              data.subscription.stats?.currentPeriodCompetitionsCreated || 0,
            packageName: data.subscription.packageName || "Game Master",
          });
          // Set max participants based on package limit
          setFormData((prev) => ({
            ...prev,
            maxParticipants: Math.min(
              prev.maxParticipants,
              data.subscription.limits.maxUsersPerCompetition,
            ),
          }));
        } else {
          toast.error("You need an active Game Master subscription");
          router.push("/gamemaster");
        }
      } catch (error) {
        console.error("Error fetching subscription:", error);
        toast.error("Failed to load subscription data");
        router.push("/gamemaster");
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [router]);

  // Fetch risk settings and platform settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings/trading-risk");
        if (response.ok) {
          const data = await response.json();
          const settings = data.settings || data;
          setRiskSettings({
            maxLeverage: settings.maxLeverage || 100,
            minLeverage: settings.minLeverage || 1,
          });
          setFormData((prev) => ({
            ...prev,
            leverageAllowed: Math.min(settings.maxLeverage || 100, 30),
          }));
        }
      } catch (error) {
        console.error("Failed to fetch risk settings:", error);
      }
    };

    const fetchPlatformSettings = async () => {
      try {
        const response = await fetch("/api/settings/app");
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setPlatformSettings((prev) => ({
              ...prev,
              creditName: data.settings.credits?.name || "Credits",
              creditSymbol: data.settings.credits?.symbol || "⚡",
              currencySymbol: data.settings.currency?.symbol || "€",
              currencyCode: data.settings.currency?.code || "EUR",
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch platform settings:", error);
      }
    };

    fetchSettings();
    fetchPlatformSettings();
  }, []);

  // Fetch market status
  useEffect(() => {
    const fetchMarketStatus = async () => {
      try {
        let url = "/api/market-status";

        if (formData.startDate && formData.endDate) {
          const startDateTime = new Date(
            `${formData.startDate}T${formData.startTime || "00:00"}:00Z`,
          );
          const endDateTime = new Date(
            `${formData.endDate}T${formData.endTime || "23:59"}:00Z`,
          );
          url += `?startDate=${startDateTime.toISOString()}&endDate=${endDateTime.toISOString()}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setMarketStatus({
            isOpen: data.currentStatus?.isOpen ?? true,
            status: data.currentStatus?.status ?? "unknown",
            message: data.currentStatus?.message ?? "",
            warnings: data.warnings ?? [],
            canCreateCompetition: data.canCreateCompetition ?? true,
            loading: false,
          });
        }
      } catch (error) {
        console.error("Failed to fetch market status:", error);
        setMarketStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchMarketStatus();
  }, [
    formData.startDate,
    formData.startTime,
    formData.endDate,
    formData.endTime,
  ]);

  // Set default dates
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    setFormData((prev) => ({
      ...prev,
      startDate: tomorrow.toISOString().split("T")[0],
      endDate: dayAfter.toISOString().split("T")[0],
    }));
  }, []);

  // Calculate difficulty
  const autoCalculatedDifficulty = useMemo(() => {
    const start = formData.startTime
      ? new Date(`${formData.startDate}T${formData.startTime}:00Z`)
      : new Date();
    const end = formData.endTime
      ? new Date(`${formData.endDate}T${formData.endTime}:00Z`)
      : new Date(Date.now() + 60 * 60 * 1000);
    const durationMinutes = Math.max(
      1,
      (end.getTime() - start.getTime()) / (1000 * 60),
    );

    // Simple difficulty calculation
    let score = 50;

    // Entry fee impact
    if (formData.entryFeeCredits >= 100) score += 15;
    else if (formData.entryFeeCredits >= 50) score += 10;
    else if (formData.entryFeeCredits >= 20) score += 5;

    // Leverage impact
    if (formData.leverageAllowed >= 100) score += 15;
    else if (formData.leverageAllowed >= 50) score += 10;
    else if (formData.leverageAllowed >= 30) score += 5;

    // Duration impact (shorter = harder)
    const hours = durationMinutes / 60;
    if (hours <= 2) score += 15;
    else if (hours <= 8) score += 10;
    else if (hours <= 24) score += 5;

    // Risk limits make it easier
    if (formData.riskLimitsEnabled) score -= 10;

    // Cap score
    score = Math.min(100, Math.max(0, score));

    let level: "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Extreme" =
      "Intermediate";
    if (score < 30) level = "Beginner";
    else if (score < 50) level = "Intermediate";
    else if (score < 70) level = "Advanced";
    else if (score < 85) level = "Expert";
    else level = "Extreme";

    return { score, level, factors: [] };
  }, [formData]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.includes("Date") || name.includes("Time")
          ? value
          : [
                "entryFeeCredits",
                "startingTradingPoints",
                "minParticipants",
                "maxParticipants",
                "leverageAllowed",
              ].includes(name)
            ? Number(value)
            : value,
    }));
  };

  const handlePrizeChange = (
    index: number,
    field: "rank" | "percentage",
    value: number,
  ) => {
    const newPrizes = [...prizeDistribution];
    newPrizes[index][field] = value;
    setPrizeDistribution(newPrizes);
  };

  const addPrizeRank = () => {
    const nextRank = prizeDistribution.length + 1;
    setPrizeDistribution([
      ...prizeDistribution,
      { rank: nextRank, percentage: 0 },
    ]);
  };

  const removePrizeRank = (index: number) => {
    if (prizeDistribution.length > 2) {
      setPrizeDistribution(prizeDistribution.filter((_, i) => i !== index));
    } else {
      toast.error("Minimum 2 prize ranks required");
    }
  };

  const getTotalPrizePercentage = () => {
    return prizeDistribution.reduce((sum, prize) => sum + prize.percentage, 0);
  };

  const validateAllSteps = () => {
    // Step 1
    if (!formData.name || !formData.description) {
      toast.error(
        "Please complete Step 1: Enter competition name and description",
      );
      setCurrentStep(1);
      return false;
    }

    const descriptionWordCount = formData.description
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    if (descriptionWordCount > 50) {
      toast.error(
        `Description exceeds 50 words (currently ${descriptionWordCount} words)`,
      );
      setCurrentStep(1);
      return false;
    }

    // Step 2
    if (formData.minParticipants < 2) {
      toast.error("Minimum participants must be at least 2");
      setCurrentStep(2);
      return false;
    }

    if (formData.startingTradingPoints < 100) {
      toast.error("Starting capital must be at least 100");
      setCurrentStep(2);
      return false;
    }

    // Step 3
    if (
      !formData.startDate ||
      !formData.startTime ||
      !formData.endDate ||
      !formData.endTime
    ) {
      toast.error("Please complete Step 3: Set start and end times");
      setCurrentStep(3);
      return false;
    }

    // Step 4
    const selectedAssets = Object.entries(assetClasses)
      .filter(([_, selected]) => selected)
      .map(([asset, _]) => asset);

    if (selectedAssets.length === 0) {
      toast.error("Please complete Step 4: Select at least one asset class");
      setCurrentStep(4);
      return false;
    }

    // Step 5
    if (prizeDistribution.length < 2) {
      toast.error("At least 2 prize ranks are required");
      setCurrentStep(5);
      return false;
    }

    const totalPrize = getTotalPrizePercentage();
    if (Math.abs(totalPrize - 100) > 0.01) {
      toast.error(
        `Prize distribution must equal 100% (currently ${totalPrize}%)`,
      );
      setCurrentStep(5);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subscription || submitting || success) return;

    // Check daily limit
    const remainingToday =
      subscription.limits.maxCompetitionsPerDay -
      subscription.currentPeriodCompetitionsCreated;
    if (remainingToday <= 0) {
      toast.error("Daily competition limit reached");
      return;
    }

    if (!validateAllSteps()) return;

    // Block if market is closed
    if (!marketStatus.isOpen) {
      toast.error(
        "❌ Cannot create competition: Forex market is currently closed",
      );
      return;
    }

    setSubmitting(true);

    try {
      const startTime = new Date(
        `${formData.startDate}T${formData.startTime}:00Z`,
      );
      const endTime = new Date(`${formData.endDate}T${formData.endTime}:00Z`);

      if (startTime <= new Date()) {
        toast.error("Start time must be in the future (UTC timezone)");
        setSubmitting(false);
        return;
      }

      if (endTime <= startTime) {
        toast.error("End time must be after start time");
        setSubmitting(false);
        return;
      }

      const selectedAssets = Object.entries(assetClasses)
        .filter(([_, selected]) => selected)
        .map(([asset, _]) => asset);

      const response = await fetch("/api/gamemaster/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          entryFee: formData.entryFeeCredits,
          startingCapital: formData.startingTradingPoints,
          minParticipants: formData.minParticipants,
          maxParticipants: Math.min(
            formData.maxParticipants,
            subscription.limits.maxUsersPerCompetition,
          ),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          leverage: formData.leverageAllowed,
          platformFeePercentage: platformSettings.platformFeePercentage,
          assetClasses: selectedAssets,
          prizeDistribution,
          rules: competitionRules,
          levelRequirement,
          riskLimits: {
            enabled: formData.riskLimitsEnabled,
            maxDrawdownPercent: formData.maxDrawdownPercent,
            dailyLossLimitPercent: formData.dailyLossLimitPercent,
            equityCheckEnabled: formData.equityCheckEnabled,
            equityDrawdownPercent: formData.equityDrawdownPercent,
          },
          difficulty: difficultySettings,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        toast.success("Competition created successfully!");
        setTimeout(() => {
          router.push("/gamemaster");
        }, 2000);
      } else {
        toast.error(result.error || "Failed to create competition");
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Error creating competition:", error);
      toast.error("Failed to create competition");
      setSubmitting(false);
    }
  };

  // Step definitions
  const steps = [
    {
      number: 1,
      title: "Basic Info",
      icon: FileText,
      description: "Name and description",
      color: "blue",
    },
    {
      number: 2,
      title: "Financial",
      icon: DollarSign,
      description: "Entry fees and capital",
      color: "green",
    },
    {
      number: 3,
      title: "Schedule",
      icon: Calendar,
      description: "Start and end times",
      color: "purple",
    },
    {
      number: 4,
      title: "Trading",
      icon: TrendingUp,
      description: "Assets and leverage",
      color: "orange",
    },
    {
      number: 5,
      title: "Prizes",
      icon: Trophy,
      description: "Distribution rules",
      color: "yellow",
    },
    {
      number: 6,
      title: "Rules",
      icon: Shield,
      description: "Competition rules",
      color: "red",
    },
    {
      number: 7,
      title: "Launch",
      icon: Zap,
      description: "Review and launch",
      color: "green",
    },
  ];

  const getStepColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: "from-blue-500 to-blue-600",
      green: "from-green-500 to-green-600",
      purple: "from-purple-500 to-purple-600",
      orange: "from-orange-500 to-orange-600",
      yellow: "from-yellow-500 to-yellow-600",
      red: "from-red-500 to-red-600",
    };
    return colors[color] || colors.blue;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 pb-20 lg:pb-4">
        <div className="max-w-2xl w-full rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 shadow-2xl shadow-green-500/20 p-6 sm:p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/50">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
            Competition Created Successfully!
          </h2>
          <p className="text-gray-400 text-lg mb-2">
            Your competition is now live and ready for participants
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to Game Master Dashboard...
          </div>
        </div>
      </div>
    );
  }

  const remainingToday =
    subscription.limits.maxCompetitionsPerDay -
    subscription.currentPeriodCompetitionsCreated;
  const canCreate = remainingToday > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-16 lg:pb-0">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-yellow-500/10 to-amber-500/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Link
            href="/gamemaster"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-3 sm:mb-4 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Create Competition
                </h1>
                <p className="text-gray-400 text-sm truncate">
                  {subscription.packageName} • {remainingToday} /{" "}
                  {subscription.limits.maxCompetitionsPerDay} remaining today
                </p>
              </div>
            </div>

            <div className="hidden md:block text-right">
              <div
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-semibold",
                  canCreate
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30",
                )}
              >
                {canCreate
                  ? `${remainingToday} competition(s) available`
                  : "Daily limit reached"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Limit Warning */}
      {!canCreate && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-4 sm:mt-8">
          <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 sm:gap-4">
            <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-400">
                Daily Limit Reached
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                You've created {subscription.limits.maxCompetitionsPerDay}{" "}
                competition(s) today. Come back tomorrow to create more!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4 sm:space-y-6">
              {/* Progress Steps */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-4 sm:p-6 shadow-2xl">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
                  Creation Progress
                </h3>
                <div className="space-y-4">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.number;
                    const isCompleted = currentStep > step.number;

                    return (
                      <div key={step.number}>
                        <div
                          className={`flex items-start gap-4 p-3 rounded-xl transition-all duration-300 ${
                            isActive
                              ? `bg-gradient-to-r ${getStepColor(step.color)} shadow-lg`
                              : isCompleted
                                ? "bg-gray-700/50 hover:bg-gray-700 cursor-pointer"
                                : "bg-gray-800/50"
                          }`}
                          onClick={() =>
                            isCompleted && setCurrentStep(step.number)
                          }
                        >
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                              isActive
                                ? "bg-white/20"
                                : isCompleted
                                  ? "bg-green-500/20"
                                  : "bg-gray-700/50"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-400" />
                            ) : (
                              <Icon
                                className={`h-5 w-5 ${
                                  isActive ? "text-white" : "text-gray-400"
                                }`}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-semibold ${
                                isActive
                                  ? "text-white"
                                  : isCompleted
                                    ? "text-gray-300"
                                    : "text-gray-400"
                              }`}
                            >
                              {step.title}
                            </div>
                            <div
                              className={`text-xs mt-0.5 ${
                                isActive ? "text-white/80" : "text-gray-500"
                              }`}
                            >
                              {step.description}
                            </div>
                          </div>
                        </div>
                        {index < steps.length - 1 && (
                          <div className="ml-8 h-4 w-px bg-gray-700"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Stats Preview */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-4 sm:p-6 shadow-2xl">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Quick Preview
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-xs text-gray-400">
                        Participants
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-200">
                      {formData.minParticipants} - {formData.maxParticipants}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-gray-400">Entry Fee</span>
                    </div>
                    <span className="text-sm font-bold text-gray-200">
                      {platformSettings.currencySymbol}
                      {formData.entryFeeCredits}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-400" />
                      <span className="text-xs text-gray-400">
                        Starting Capital
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-200">
                      ${formData.startingTradingPoints.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs text-gray-400">
                        Max Leverage
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-200">
                      1:{formData.leverageAllowed}
                    </span>
                  </div>
                </div>
              </div>

              {/* GM Package Info */}
              <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-300">
                    Your Package Limits
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Max Participants:</span>
                    <span className="text-yellow-400 font-semibold">
                      {subscription.limits.maxUsersPerCompetition}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Daily Competitions:</span>
                    <span className="text-yellow-400 font-semibold">
                      {subscription.limits.maxCompetitionsPerDay}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Your Referral Fee:</span>
                    <span className="text-green-400 font-semibold">
                      {subscription.limits.referralFeePercentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Market Status */}
              <div
                className={`p-4 rounded-xl border ${
                  marketStatus.loading
                    ? "bg-gray-700/50 border-gray-600"
                    : marketStatus.isOpen
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      marketStatus.loading
                        ? "bg-gray-400 animate-pulse"
                        : marketStatus.isOpen
                          ? "bg-green-500"
                          : "bg-red-500 animate-pulse"
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      marketStatus.isOpen ? "text-gray-300" : "text-red-300"
                    }`}
                  >
                    {marketStatus.loading
                      ? "Checking..."
                      : marketStatus.isOpen
                        ? "Forex Market"
                        : "⛔ MARKET CLOSED"}
                  </span>
                </div>
                <p
                  className={`text-xs ${
                    marketStatus.isOpen ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {marketStatus.loading
                    ? "Fetching market status..."
                    : marketStatus.message}
                </p>
                {!marketStatus.loading && !marketStatus.isOpen && (
                  <div className="mt-3 p-2 bg-red-500/20 rounded-lg">
                    <p className="text-xs text-red-300 font-semibold">
                      ❌ Competition creation is BLOCKED
                    </p>
                    <p className="text-xs text-red-400 mt-1">
                      Market hours: Sun 10pm - Fri 10pm UTC
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              className="space-y-6"
            >
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Basic Information
                        </h2>
                        <p className="text-blue-100 text-sm">
                          Give your competition a name and description
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    <div>
                      <label
                        htmlFor="name"
                        className="text-gray-300 flex items-center gap-2 mb-2"
                      >
                        <FileText className="h-4 w-4 text-blue-400" />
                        Competition Name *
                      </label>
                      <input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-12 text-lg rounded-lg px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Forex Friday Championship"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Choose a catchy name that attracts participants
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="description"
                        className="text-gray-300 flex items-center gap-2 mb-2"
                      >
                        <FileText className="h-4 w-4 text-blue-400" />
                        Description *
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className={`w-full bg-gray-800 border text-gray-100 min-h-[160px] rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formData.description
                            .trim()
                            .split(/\s+/)
                            .filter((w) => w.length > 0).length >= 45
                            ? "border-yellow-500/50"
                            : "border-gray-600"
                        } ${
                          formData.description
                            .trim()
                            .split(/\s+/)
                            .filter((w) => w.length > 0).length > 50
                            ? "border-red-500"
                            : ""
                        }`}
                        placeholder={`Describe the competition briefly (max 50 words)...\n\nExample:\nJoin our weekly Forex trading competition! Test your skills against top traders and win prizes.`}
                        required
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Keep it brief and clear (max 50 words)
                        </p>
                        {(() => {
                          const wordCount = formData.description.trim()
                            ? formData.description
                                .trim()
                                .split(/\s+/)
                                .filter((w) => w.length > 0).length
                            : 0;
                          const isOver = wordCount > 50;
                          const isWarning = wordCount >= 45 && wordCount <= 50;
                          return (
                            <p
                              className={`text-xs font-medium ${
                                isOver
                                  ? "text-red-400"
                                  : isWarning
                                    ? "text-yellow-400"
                                    : "text-gray-400"
                              }`}
                            >
                              {wordCount}/50 words
                              {isOver && (
                                <span className="ml-1 text-red-500 font-bold">
                                  ({wordCount - 50} over limit!)
                                </span>
                              )}
                            </p>
                          );
                        })()}
                      </div>
                    </div>

                    {formData.name && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-blue-300">
                              Preview
                            </h4>
                            <p className="text-sm text-gray-300 mt-1 font-medium">
                              {formData.name}
                            </p>
                            {formData.description && (
                              <p className="text-xs text-gray-400 mt-2 line-clamp-3">
                                {formData.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Financial Settings */}
              {currentStep === 2 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Financial Settings
                        </h2>
                        <p className="text-green-100 text-sm">
                          Configure entry fees and capital
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Prize Pool Calculator */}
                      <div className="md:col-span-2 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Award className="h-5 w-5 text-green-400 mt-1" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-green-300 mb-1">
                              Prize Pool Calculator
                            </h4>
                            <p className="text-xs text-gray-400 mb-3">
                              Based on maximum participants
                            </p>
                            <div className="grid grid-cols-2 gap-4 mt-3">
                              <div className="bg-gray-800/50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500">
                                  Total Entry Fees
                                </div>
                                <div className="text-lg font-bold text-green-400 mt-1">
                                  {platformSettings.currencySymbol}
                                  {(
                                    formData.entryFeeCredits *
                                    formData.maxParticipants
                                  ).toFixed(2)}
                                </div>
                              </div>
                              <div className="bg-gray-800/50 p-3 rounded-lg">
                                <div className="text-xs text-gray-500">
                                  Prize Pool (
                                  {100 - platformSettings.platformFeePercentage}
                                  %)
                                </div>
                                <div className="text-lg font-bold text-yellow-400 mt-1">
                                  {platformSettings.currencySymbol}
                                  {(
                                    (formData.entryFeeCredits *
                                      formData.maxParticipants *
                                      (100 -
                                        platformSettings.platformFeePercentage)) /
                                    100
                                  ).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="entryFeeCredits"
                          className="text-gray-300 flex items-center gap-2 mb-2"
                        >
                          <DollarSign className="h-4 w-4 text-green-400" />
                          Entry Fee ({platformSettings.currencyCode}) *
                        </label>
                        <input
                          id="entryFeeCredits"
                          name="entryFeeCredits"
                          type="number"
                          min="1"
                          step="0.01"
                          value={formData.entryFeeCredits}
                          onChange={handleInputChange}
                          className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-12 text-lg rounded-lg px-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Amount users pay to enter
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="startingTradingPoints"
                          className="text-gray-300 flex items-center gap-2 mb-2"
                        >
                          <Target className="h-4 w-4 text-green-400" />
                          Starting Capital *
                        </label>
                        <input
                          id="startingTradingPoints"
                          name="startingTradingPoints"
                          type="number"
                          min="100"
                          step="100"
                          value={formData.startingTradingPoints}
                          onChange={(e) => {
                            const value = Math.max(
                              100,
                              Number(e.target.value) || 100,
                            );
                            setFormData((prev) => ({
                              ...prev,
                              startingTradingPoints: value,
                            }));
                          }}
                          className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-12 text-lg rounded-lg px-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Minimum 100 virtual capital for trading
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="minParticipants"
                            className="text-gray-300 flex items-center gap-2 mb-2"
                          >
                            <Users className="h-4 w-4 text-orange-400" />
                            Min Participants *
                          </label>
                          <input
                            id="minParticipants"
                            name="minParticipants"
                            type="number"
                            min="2"
                            step="1"
                            value={formData.minParticipants}
                            onChange={(e) => {
                              const value = Math.max(
                                2,
                                Number(e.target.value) || 2,
                              );
                              setFormData((prev) => ({
                                ...prev,
                                minParticipants: value,
                              }));
                            }}
                            className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-12 text-lg rounded-lg px-4 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Minimum 2 required
                          </p>
                        </div>
                        <div>
                          <label
                            htmlFor="maxParticipants"
                            className="text-gray-300 flex items-center gap-2 mb-2"
                          >
                            <Users className="h-4 w-4 text-green-400" />
                            Max Participants *
                          </label>
                          <input
                            id="maxParticipants"
                            name="maxParticipants"
                            type="number"
                            min="2"
                            step="1"
                            max={subscription.limits.maxUsersPerCompetition}
                            value={formData.maxParticipants}
                            onChange={(e) => {
                              const value = Math.min(
                                Number(e.target.value) || 2,
                                subscription.limits.maxUsersPerCompetition,
                              );
                              setFormData((prev) => ({
                                ...prev,
                                maxParticipants: value,
                              }));
                            }}
                            className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-12 text-lg rounded-lg px-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            required
                          />
                          <p className="text-xs text-yellow-400 mt-2">
                            Max: {subscription.limits.maxUsersPerCompetition}{" "}
                            (package limit)
                          </p>
                        </div>
                      </div>

                      {/* Platform Fee - LOCKED */}
                      <div className="md:col-span-2 p-4 bg-gray-700/50 border border-gray-600 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-600 rounded-lg">
                              <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-300">
                                Platform Fee
                              </h4>
                              <p className="text-xs text-gray-500">
                                Set by platform administrators
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-300">
                              {platformSettings.platformFeePercentage}%
                            </div>
                            <div className="text-xs text-gray-500">
                              of prize pool
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Referral Fee Info */}
                      <div className="md:col-span-2 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                          <Crown className="h-5 w-5 text-yellow-400 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-yellow-300">
                              Your Referral Earnings
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                              When participants you referred join this
                              competition, you'll earn
                              <span className="text-green-400 font-bold mx-1">
                                {subscription.limits.referralFeePercentage}%
                              </span>
                              of their entry fees from the platform's share.
                            </p>
                            <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                              <div className="text-xs text-gray-500 mb-1">
                                Example: If 10 of your referrals join (
                                {platformSettings.currencySymbol}
                                {formData.entryFeeCredits} each)
                              </div>
                              <div className="text-lg font-bold text-green-400">
                                You earn: {platformSettings.currencySymbol}
                                {(
                                  (10 *
                                    formData.entryFeeCredits *
                                    subscription.limits.referralFeePercentage) /
                                  100
                                ).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Schedule */}
              {currentStep === 3 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Schedule
                        </h2>
                        <p className="text-purple-100 text-sm">
                          Set start and end times
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* Current UTC Time */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-blue-400 animate-pulse" />
                          <div>
                            <div className="text-xs text-blue-300 font-semibold uppercase">
                              Current Server Time (UTC)
                            </div>
                            <div
                              className="text-xl font-bold text-blue-100 tabular-nums"
                              suppressHydrationWarning
                            >
                              {formatUTCTime(currentUTC)}
                            </div>
                          </div>
                        </div>
                        <div
                          className="text-xs text-blue-400 tabular-nums"
                          suppressHydrationWarning
                        >
                          {formatUTCDate(currentUTC)}
                        </div>
                      </div>
                    </div>

                    {/* Duration Preview */}
                    {formData.startDate &&
                      formData.startTime &&
                      formData.endDate &&
                      formData.endTime && (
                        <div className="p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-purple-400 mt-1" />
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-purple-300 mb-2">
                                Competition Schedule (UTC)
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-xs text-gray-500">
                                    Start Time (UTC)
                                  </div>
                                  <div className="text-sm text-purple-300 font-bold mt-1">
                                    {formData.startDate} {formData.startTime}{" "}
                                    UTC
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">
                                    End Time (UTC)
                                  </div>
                                  <div className="text-sm text-purple-300 font-bold mt-1">
                                    {formData.endDate} {formData.endTime} UTC
                                  </div>
                                </div>
                              </div>
                              {(() => {
                                const start = new Date(
                                  `${formData.startDate}T${formData.startTime}:00Z`,
                                );
                                const end = new Date(
                                  `${formData.endDate}T${formData.endTime}:00Z`,
                                );
                                const hours = Math.round(
                                  (end.getTime() - start.getTime()) /
                                    (1000 * 60 * 60),
                                );
                                const days = Math.floor(hours / 24);
                                return (
                                  <div className="mt-3 text-lg font-bold text-purple-400">
                                    Duration: {days > 0 ? `${days} days, ` : ""}
                                    {hours % 24} hours
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Start Time */}
                      <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-400" />
                          Start Time
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor="startDate"
                              className="text-gray-400 text-xs"
                            >
                              Date *
                            </label>
                            <input
                              id="startDate"
                              name="startDate"
                              type="date"
                              value={formData.startDate}
                              onChange={handleInputChange}
                              className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                              required
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="startTime"
                              className="text-gray-400 text-xs flex items-center justify-between"
                            >
                              <span>Time (UTC) *</span>
                              <span
                                className="text-blue-400 font-mono text-xs"
                                suppressHydrationWarning
                              >
                                Now: {formatUTCTime(currentUTC)}
                              </span>
                            </label>
                            <input
                              id="startTime"
                              name="startTime"
                              type="time"
                              value={formData.startTime}
                              onChange={handleInputChange}
                              className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                              required
                            />
                            {/* Quick Time Presets */}
                            <div className="flex flex-wrap gap-1 mt-3">
                              {[
                                "00:00",
                                "06:00",
                                "09:00",
                                "12:00",
                                "15:00",
                                "18:00",
                                "21:00",
                              ].map((time) => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      startTime: time,
                                    }))
                                  }
                                  className={`px-2 py-1 text-xs rounded ${formData.startTime === time ? "bg-purple-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                                >
                                  {time}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* End Time */}
                      <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-400" />
                          End Time
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor="endDate"
                              className="text-gray-400 text-xs"
                            >
                              Date *
                            </label>
                            <input
                              id="endDate"
                              name="endDate"
                              type="date"
                              value={formData.endDate}
                              onChange={handleInputChange}
                              min={formData.startDate}
                              className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                              required
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="endTime"
                              className="text-gray-400 text-xs flex items-center justify-between"
                            >
                              <span>Time (UTC) *</span>
                              <span
                                className="text-blue-400 font-mono text-xs"
                                suppressHydrationWarning
                              >
                                Now: {formatUTCTime(currentUTC)}
                              </span>
                            </label>
                            <input
                              id="endTime"
                              name="endTime"
                              type="time"
                              value={formData.endTime}
                              onChange={handleInputChange}
                              className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                              required
                            />
                            {/* Quick Time Presets */}
                            <div className="flex flex-wrap gap-1 mt-3">
                              {[
                                "00:00",
                                "06:00",
                                "09:00",
                                "12:00",
                                "15:00",
                                "18:00",
                                "21:00",
                              ].map((time) => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      endTime: time,
                                    }))
                                  }
                                  className={`px-2 py-1 text-xs rounded ${formData.endTime === time ? "bg-purple-500 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                                >
                                  {time}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                        <p className="text-xs text-gray-400">
                          Registration closes 1 hour before the competition
                          starts. Make sure to set appropriate start times.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Trading Settings */}
              {currentStep === 4 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Trading Settings
                        </h2>
                        <p className="text-orange-100 text-sm">
                          Configure assets and leverage
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* Asset Classes */}
                    <div>
                      <label className="text-gray-300 mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-orange-400" />
                        Asset Classes *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        {Object.entries(assetClasses).map(
                          ([asset, checked]) => (
                            <div
                              key={asset}
                              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                checked
                                  ? "bg-orange-500/20 border-orange-500"
                                  : "bg-gray-800/50 border-gray-600 hover:border-gray-500"
                              }`}
                              onClick={() =>
                                setAssetClasses((prev) => ({
                                  ...prev,
                                  [asset]: !checked,
                                }))
                              }
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setAssetClasses((prev) => ({
                                      ...prev,
                                      [asset]: !checked,
                                    }))
                                  }
                                  className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 bg-gray-800"
                                />
                                <span className="text-sm font-semibold text-gray-200 uppercase">
                                  {asset}
                                </span>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Select at least one asset class for trading
                      </p>
                    </div>

                    {/* Leverage */}
                    <div>
                      <label
                        htmlFor="leverageAllowed"
                        className="text-gray-300 flex items-center gap-2 mb-2"
                      >
                        <Zap className="h-4 w-4 text-orange-400" />
                        Maximum Leverage (1:X) *
                      </label>
                      {riskSettings && (
                        <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <p className="text-xs text-blue-400">
                            📊 Platform limit: 1:{riskSettings.minLeverage} to
                            1:{riskSettings.maxLeverage}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={riskSettings?.minLeverage || 1}
                          max={riskSettings?.maxLeverage || 100}
                          step="1"
                          value={formData.leverageAllowed}
                          onChange={handleInputChange}
                          name="leverageAllowed"
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <div className="w-24 text-right">
                          <div className="text-2xl font-bold text-orange-400">
                            1:{formData.leverageAllowed}
                          </div>
                        </div>
                      </div>
                      <input
                        type="number"
                        min={riskSettings?.minLeverage || 1}
                        max={riskSettings?.maxLeverage || 100}
                        step="1"
                        value={formData.leverageAllowed}
                        onChange={handleInputChange}
                        name="leverageAllowed"
                        className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-12 text-lg rounded-lg px-4 focus:ring-2 focus:ring-orange-500 focus:border-transparent mt-3"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Higher leverage = higher risk and potential reward
                      </p>
                    </div>

                    {/* Risk Limits */}
                    <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="flex items-start gap-3 mb-4">
                        <Shield className="h-5 w-5 text-red-400 mt-1" />
                        <div>
                          <h4 className="text-sm font-semibold text-red-300">
                            Risk Limits
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">
                            Set maximum drawdown and daily loss limits for this
                            competition
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 mb-4">
                        <input
                          type="checkbox"
                          id="riskLimitsEnabled"
                          checked={formData.riskLimitsEnabled}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              riskLimitsEnabled: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 bg-gray-800"
                        />
                        <label
                          htmlFor="riskLimitsEnabled"
                          className="text-sm font-medium text-gray-200 cursor-pointer"
                        >
                          Enable Risk Limits for this Competition
                        </label>
                      </div>

                      {formData.riskLimitsEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="text-gray-300 flex items-center gap-2 mb-2">
                              <TrendingDown className="h-4 w-4 text-red-400" />
                              Max Drawdown %
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.maxDrawdownPercent}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  maxDrawdownPercent: Number(e.target.value),
                                }))
                              }
                              className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                            <p className="text-xs text-red-400 mt-1">
                              🛑 Trading blocked when account drops{" "}
                              {formData.maxDrawdownPercent}% below starting
                              capital
                            </p>
                          </div>

                          <div>
                            <label className="text-gray-300 flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-orange-400" />
                              Daily Loss Limit %
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.dailyLossLimitPercent}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  dailyLossLimitPercent: Number(e.target.value),
                                }))
                              }
                              className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <p className="text-xs text-orange-400 mt-1">
                              ⚠️ Trading blocked when daily loss exceeds{" "}
                              {formData.dailyLossLimitPercent}% of starting
                              capital
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Prize Distribution */}
              {currentStep === 5 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/50 rounded-2xl shadow-2xl shadow-yellow-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Prize Distribution
                        </h2>
                        <p className="text-yellow-100 text-sm">
                          Set winner payouts
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div>
                        <div className="text-sm text-gray-400">
                          Total Distribution
                        </div>
                        <div
                          className={`text-3xl font-bold mt-1 ${
                            getTotalPrizePercentage() === 100
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {getTotalPrizePercentage()}%
                        </div>
                        {getTotalPrizePercentage() !== 100 && (
                          <div className="text-xs text-red-400 mt-1">
                            Must equal 100%
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={addPrizeRank}
                        className="px-4 py-2 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-gray-900 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Rank
                      </button>
                    </div>

                    <div className="space-y-4">
                      {prizeDistribution.map((prize, index) => (
                        <div
                          key={index}
                          className="group p-6 rounded-xl bg-gray-800/50 border border-gray-600 hover:border-yellow-500/50 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                              <Trophy className="h-6 w-6 text-yellow-500" />
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-gray-400 mb-2 block">
                                  Rank Position
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={prize.rank}
                                  onChange={(e) =>
                                    handlePrizeChange(
                                      index,
                                      "rank",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 text-lg font-bold rounded-lg px-4 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 mb-2 block">
                                  Prize Percentage
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={prize.percentage}
                                    onChange={(e) =>
                                      handlePrizeChange(
                                        index,
                                        "percentage",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 text-lg font-bold rounded-lg px-4 pr-8 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>
                            {prizeDistribution.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removePrizeRank(index)}
                                className="flex-shrink-0 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Minus className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: Competition Rules */}
              {currentStep === 6 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-500 to-red-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Competition Rules
                        </h2>
                        <p className="text-red-100 text-sm">
                          Configure ranking and tie-breaking rules
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* Ranking Method */}
                    <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                        <Award className="h-5 w-5 text-red-400" />
                        Ranking Method
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          {
                            value: "pnl",
                            label: "P&L",
                            emoji: "💰",
                            desc: "Net profit/loss",
                          },
                          {
                            value: "roi",
                            label: "ROI %",
                            emoji: "📈",
                            desc: "Return on investment",
                          },
                          {
                            value: "total_capital",
                            label: "Total Capital",
                            emoji: "🏦",
                            desc: "Final account value",
                          },
                          {
                            value: "win_rate",
                            label: "Win Rate",
                            emoji: "🎯",
                            desc: "Winning trade %",
                          },
                          {
                            value: "total_wins",
                            label: "Total Wins",
                            emoji: "🏆",
                            desc: "Number of winning trades",
                          },
                          {
                            value: "profit_factor",
                            label: "Profit Factor",
                            emoji: "⚖️",
                            desc: "Gross profit / loss",
                          },
                        ].map((method) => (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() =>
                              setCompetitionRules((prev) => ({
                                ...prev,
                                rankingMethod: method.value as any,
                              }))
                            }
                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                              competitionRules.rankingMethod === method.value
                                ? "bg-red-500/20 border-red-500 text-red-300"
                                : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
                            }`}
                          >
                            <div className="text-xl mb-1">{method.emoji}</div>
                            <div className="font-semibold text-sm">
                              {method.label}
                            </div>
                            <div className="text-xs opacity-70 mt-1">
                              {method.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tie Breaker */}
                    <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-100 mb-4">
                        Tie Breaker Rules
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-gray-300 text-sm mb-2 block">
                            Primary Tie Breaker
                          </label>
                          <select
                            value={competitionRules.tieBreaker1}
                            onChange={(e) =>
                              setCompetitionRules((prev) => ({
                                ...prev,
                                tieBreaker1: e.target.value as any,
                              }))
                            }
                            className="w-full bg-gray-800 border border-gray-600 text-gray-100 rounded-lg h-11 px-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          >
                            <option value="trades_count">
                              Number of Trades
                            </option>
                            <option value="win_rate">Win Rate</option>
                            <option value="total_capital">Total Capital</option>
                            <option value="roi">ROI</option>
                            <option value="join_time">First to Join</option>
                            <option value="split_prize">Split Prize</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-300 text-sm mb-2 block">
                            Minimum Trades Required
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={competitionRules.minimumTrades}
                            onChange={(e) =>
                              setCompetitionRules((prev) => ({
                                ...prev,
                                minimumTrades: Number(e.target.value),
                              }))
                            }
                            className="w-full bg-gray-800 border border-gray-600 text-gray-100 rounded-lg h-11 px-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="disqualifyOnLiquidation"
                          checked={competitionRules.disqualifyOnLiquidation}
                          onChange={(e) =>
                            setCompetitionRules((prev) => ({
                              ...prev,
                              disqualifyOnLiquidation: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 bg-gray-800"
                        />
                        <label
                          htmlFor="disqualifyOnLiquidation"
                          className="text-sm text-gray-200 cursor-pointer"
                        >
                          Disqualify participants who get liquidated
                        </label>
                      </div>
                    </div>

                    {/* Difficulty */}
                    <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-purple-400" />
                        Difficulty Level
                      </h3>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <button
                          type="button"
                          onClick={() =>
                            setDifficultySettings({
                              mode: "auto",
                              manualLevel: undefined,
                            })
                          }
                          className={`p-4 rounded-xl border-2 transition-all ${
                            difficultySettings.mode === "auto"
                              ? "bg-purple-500/20 border-purple-500 text-purple-300"
                              : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
                          }`}
                        >
                          <div className="text-2xl mb-2">🤖</div>
                          <div className="font-semibold">Auto Calculate</div>
                          <div className="text-xs mt-1 opacity-70">
                            Based on competition settings
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDifficultySettings({
                              mode: "manual",
                              manualLevel: "intermediate",
                            })
                          }
                          className={`p-4 rounded-xl border-2 transition-all ${
                            difficultySettings.mode === "manual"
                              ? "bg-purple-500/20 border-purple-500 text-purple-300"
                              : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
                          }`}
                        >
                          <div className="text-2xl mb-2">✋</div>
                          <div className="font-semibold">Manual Select</div>
                          <div className="text-xs mt-1 opacity-70">
                            Choose specific level
                          </div>
                        </button>
                      </div>

                      {difficultySettings.mode === "auto" && (
                        <div
                          className={`p-4 rounded-xl border-2 ${
                            autoCalculatedDifficulty.level === "Beginner"
                              ? "bg-green-500/10 border-green-500/40"
                              : autoCalculatedDifficulty.level ===
                                  "Intermediate"
                                ? "bg-blue-500/10 border-blue-500/40"
                                : autoCalculatedDifficulty.level === "Advanced"
                                  ? "bg-yellow-500/10 border-yellow-500/40"
                                  : autoCalculatedDifficulty.level === "Expert"
                                    ? "bg-orange-500/10 border-orange-500/40"
                                    : "bg-red-500/10 border-red-500/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">
                                {autoCalculatedDifficulty.level === "Beginner"
                                  ? "🌱"
                                  : autoCalculatedDifficulty.level ===
                                      "Intermediate"
                                    ? "📊"
                                    : autoCalculatedDifficulty.level ===
                                        "Advanced"
                                      ? "⚡"
                                      : autoCalculatedDifficulty.level ===
                                          "Expert"
                                        ? "🔥"
                                        : "💀"}
                              </div>
                              <div>
                                <div className="text-xs text-gray-400 mb-0.5">
                                  Auto-Calculated:
                                </div>
                                <div
                                  className={`text-xl font-black ${
                                    autoCalculatedDifficulty.level ===
                                    "Beginner"
                                      ? "text-green-400"
                                      : autoCalculatedDifficulty.level ===
                                          "Intermediate"
                                        ? "text-blue-400"
                                        : autoCalculatedDifficulty.level ===
                                            "Advanced"
                                          ? "text-yellow-400"
                                          : autoCalculatedDifficulty.level ===
                                              "Expert"
                                            ? "text-orange-400"
                                            : "text-red-400"
                                  }`}
                                >
                                  {autoCalculatedDifficulty.level.toUpperCase()}
                                </div>
                              </div>
                            </div>
                            <div
                              className={`px-4 py-2 rounded-xl font-mono text-lg font-bold ${
                                autoCalculatedDifficulty.level === "Beginner"
                                  ? "bg-green-500/20 text-green-400"
                                  : autoCalculatedDifficulty.level ===
                                      "Intermediate"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : autoCalculatedDifficulty.level ===
                                        "Advanced"
                                      ? "bg-yellow-500/20 text-yellow-400"
                                      : autoCalculatedDifficulty.level ===
                                          "Expert"
                                        ? "bg-orange-500/20 text-orange-400"
                                        : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {autoCalculatedDifficulty.score}/100
                            </div>
                          </div>
                        </div>
                      )}

                      {difficultySettings.mode === "manual" && (
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            {
                              value: "beginner",
                              label: "Beginner",
                              emoji: "🌱",
                              color: "green",
                            },
                            {
                              value: "intermediate",
                              label: "Intermediate",
                              emoji: "📊",
                              color: "blue",
                            },
                            {
                              value: "advanced",
                              label: "Advanced",
                              emoji: "⚡",
                              color: "yellow",
                            },
                            {
                              value: "expert",
                              label: "Expert",
                              emoji: "🔥",
                              color: "orange",
                            },
                            {
                              value: "extreme",
                              label: "Extreme",
                              emoji: "💀",
                              color: "red",
                            },
                          ].map((level) => (
                            <button
                              key={level.value}
                              type="button"
                              onClick={() =>
                                setDifficultySettings({
                                  mode: "manual",
                                  manualLevel: level.value as any,
                                })
                              }
                              className={`p-3 rounded-xl border-2 transition-all text-center ${
                                difficultySettings.manualLevel === level.value
                                  ? level.color === "green"
                                    ? "bg-green-500/20 border-green-500 text-green-300"
                                    : level.color === "blue"
                                      ? "bg-blue-500/20 border-blue-500 text-blue-300"
                                      : level.color === "yellow"
                                        ? "bg-yellow-500/20 border-yellow-500 text-yellow-300"
                                        : level.color === "orange"
                                          ? "bg-orange-500/20 border-orange-500 text-orange-300"
                                          : "bg-red-500/20 border-red-500 text-red-300"
                                  : "bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-500"
                              }`}
                            >
                              <div className="text-xl mb-1">{level.emoji}</div>
                              <div className="text-xs font-medium">
                                {level.label}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Level Requirement */}
                    <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                        <Award className="h-5 w-5 text-red-400" />
                        Level Requirement
                      </h3>

                      <div className="flex items-center space-x-3 mb-4">
                        <input
                          type="checkbox"
                          id="levelEnabled"
                          checked={levelRequirement.enabled}
                          onChange={(e) =>
                            setLevelRequirement((prev) => ({
                              ...prev,
                              enabled: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 bg-gray-800"
                        />
                        <label
                          htmlFor="levelEnabled"
                          className="text-sm font-medium text-gray-200 cursor-pointer"
                        >
                          Enable Level Restrictions
                        </label>
                      </div>

                      {levelRequirement.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                          <div>
                            <label className="text-gray-200 text-sm">
                              Minimum Level Required
                            </label>
                            <select
                              value={levelRequirement.minLevel}
                              onChange={(e) =>
                                setLevelRequirement((prev) => ({
                                  ...prev,
                                  minLevel: Number(e.target.value),
                                }))
                              }
                              className="w-full mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <option value={1}>
                                🌱 Level 1: Novice Trader
                              </option>
                              <option value={2}>
                                📚 Level 2: Apprentice Trader
                              </option>
                              <option value={3}>
                                ⚔️ Level 3: Skilled Trader
                              </option>
                              <option value={4}>
                                🎯 Level 4: Expert Trader
                              </option>
                              <option value={5}>
                                💎 Level 5: Elite Trader
                              </option>
                              <option value={6}>
                                👑 Level 6: Master Trader
                              </option>
                              <option value={7}>
                                🔥 Level 7: Grand Master
                              </option>
                              <option value={8}>
                                ⚡ Level 8: Trading Champion
                              </option>
                              <option value={9}>
                                🌟 Level 9: Market Legend
                              </option>
                              <option value={10}>
                                👑 Level 10: Trading God
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="text-gray-200 text-sm">
                              Maximum Level (Optional)
                            </label>
                            <select
                              value={levelRequirement.maxLevel || ""}
                              onChange={(e) =>
                                setLevelRequirement((prev) => ({
                                  ...prev,
                                  maxLevel: e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                }))
                              }
                              className="w-full mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <option value="">No Maximum</option>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                                if (level < levelRequirement.minLevel)
                                  return null;
                                const levelNames = [
                                  "",
                                  "🌱 Level 1",
                                  "📚 Level 2",
                                  "⚔️ Level 3",
                                  "🎯 Level 4",
                                  "💎 Level 5",
                                  "👑 Level 6",
                                  "🔥 Level 7",
                                  "⚡ Level 8",
                                  "🌟 Level 9",
                                  "👑 Level 10",
                                ];
                                return (
                                  <option key={level} value={level}>
                                    {levelNames[level]}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7: Launch */}
              {currentStep === 7 && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                          Review & Launch
                        </h2>
                        <p className="text-green-100 text-sm">
                          Final review before launching your competition
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* Competition Summary */}
                    <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-green-400" />
                        Competition Summary
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            Competition Name
                          </p>
                          <p className="text-sm font-semibold text-gray-100">
                            {formData.name || "Not set"}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            Participants
                          </p>
                          <p className="text-sm font-semibold text-gray-100">
                            {formData.minParticipants} -{" "}
                            {formData.maxParticipants}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            Entry Fee
                          </p>
                          <p className="text-sm font-semibold text-gray-100">
                            {platformSettings.currencySymbol}
                            {formData.entryFeeCredits}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            Starting Capital
                          </p>
                          <p className="text-sm font-semibold text-gray-100">
                            {formData.startingTradingPoints.toLocaleString()}{" "}
                            pts
                          </p>
                        </div>
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            Start Time (UTC)
                          </p>
                          <p className="text-sm font-semibold text-gray-100">
                            {formData.startDate} {formData.startTime}
                          </p>
                        </div>
                        <div className="p-4 bg-gray-900/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">
                            End Time (UTC)
                          </p>
                          <p className="text-sm font-semibold text-gray-100">
                            {formData.endDate} {formData.endTime}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Prize Distribution Summary */}
                    <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                        <Award className="h-5 w-5 text-green-400" />
                        Prize Distribution
                      </h3>
                      <div className="space-y-2">
                        {prizeDistribution.map((prize) => (
                          <div
                            key={prize.rank}
                            className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                          >
                            <span className="text-sm text-gray-300">
                              Rank {prize.rank}
                            </span>
                            <span className="text-sm font-semibold text-gray-100">
                              {prize.percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-xs text-green-400">
                          Total: {getTotalPrizePercentage()}%{" "}
                          {getTotalPrizePercentage() === 100
                            ? "✓"
                            : "⚠️ Must equal 100%"}
                        </p>
                      </div>
                    </div>

                    {/* Your Earnings Info */}
                    <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Crown className="h-5 w-5 text-yellow-400 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-yellow-300">
                            Your Referral Earnings
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">
                            You'll earn{" "}
                            <span className="text-green-400 font-bold">
                              {subscription.limits.referralFeePercentage}%
                            </span>{" "}
                            of entry fees from participants you referred.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Important Notice */}
                    <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-yellow-400 mb-1">
                            Ready to Launch?
                          </h4>
                          <p className="text-xs text-yellow-300/80">
                            Once launched, the competition will be visible to
                            all users and will automatically start at the
                            scheduled time (UTC). Make sure all details are
                            correct before proceeding.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    } else {
                      router.push("/gamemaster");
                    }
                  }}
                  className="px-4 sm:px-6 py-3 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-xl font-semibold flex items-center gap-2 transition-colors min-h-[44px] text-sm sm:text-base"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {currentStep === 1 ? "Cancel" : "Previous"}
                </button>

                {currentStep < 7 ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Validate current step before proceeding
                      if (currentStep === 1) {
                        if (!formData.name.trim()) {
                          toast.error("Please enter a competition name");
                          return;
                        }
                        if (!formData.description.trim()) {
                          toast.error("Please enter a description");
                          return;
                        }
                        const wordCount = formData.description
                          .trim()
                          .split(/\s+/)
                          .filter((w) => w.length > 0).length;
                        if (wordCount > 50) {
                          toast.error(
                            `Description exceeds 50 words (currently ${wordCount} words)`,
                          );
                          return;
                        }
                      }
                      if (currentStep === 2) {
                        if (formData.entryFeeCredits < 1) {
                          toast.error("Entry fee must be at least 1");
                          return;
                        }
                        if (formData.startingTradingPoints < 100) {
                          toast.error("Starting capital must be at least 100");
                          return;
                        }
                        if (formData.minParticipants < 2) {
                          toast.error(
                            "Minimum participants must be at least 2",
                          );
                          return;
                        }
                      }
                      if (currentStep === 3) {
                        if (
                          !formData.startDate ||
                          !formData.startTime ||
                          !formData.endDate ||
                          !formData.endTime
                        ) {
                          toast.error("Please complete all schedule fields");
                          return;
                        }
                        const startDateTime = new Date(
                          `${formData.startDate}T${formData.startTime}:00Z`,
                        );
                        const endDateTime = new Date(
                          `${formData.endDate}T${formData.endTime}:00Z`,
                        );
                        if (startDateTime <= new Date()) {
                          toast.error("Start time must be in the future");
                          return;
                        }
                        if (endDateTime <= startDateTime) {
                          toast.error("End time must be after start time");
                          return;
                        }
                      }
                      if (currentStep === 4) {
                        const selectedAssets =
                          Object.values(assetClasses).filter(Boolean).length;
                        if (selectedAssets === 0) {
                          toast.error("Please select at least one asset class");
                          return;
                        }
                      }
                      if (currentStep === 5) {
                        if (prizeDistribution.length < 2) {
                          toast.error("At least 2 prize ranks are required");
                          return;
                        }
                        const total = getTotalPrizePercentage();
                        if (Math.abs(total - 100) > 0.01) {
                          toast.error(
                            `Prize distribution must equal 100% (currently ${total}%)`,
                          );
                          return;
                        }
                      }
                      setCurrentStep(currentStep + 1);
                    }}
                    disabled={!canCreate}
                    className="px-4 sm:px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 rounded-xl font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base"
                  >
                    Next Step
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      !canCreate ||
                      submitting ||
                      success ||
                      getTotalPrizePercentage() !== 100 ||
                      !marketStatus.isOpen
                    }
                    className="px-5 sm:px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Competition...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Launch Competition
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
