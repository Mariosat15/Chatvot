'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, Minus, Loader2, CheckCircle, XCircle, 
  FileText, DollarSign, Calendar, Settings, Trophy, 
  ChevronRight, ChevronLeft, Shield, Users, TrendingUp, TrendingDown,
  Clock, Target, Award, AlertCircle, AlertTriangle, Zap
} from 'lucide-react';
import { createCompetition } from '@/lib/actions/trading/competition.actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import CompetitionRulesSection from '@/components/admin/CompetitionRulesSection';
import { useAppSettings } from '@/contexts/AppSettingsContext';

export default function CompetitionCreatorForm() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Get dynamic currency settings
  const creditName = settings?.credits?.name || 'Credits';
  const creditSymbol = settings?.credits?.symbol || '⚡';
  const currencySymbol = settings?.currency?.symbol || '€';
  const currencyCode = settings?.currency?.code || 'EUR';

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entryFeeCredits: 10,
    startingTradingPoints: 10000,
    minParticipants: 2,
    maxParticipants: 50,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    leverageAllowed: 100,
    platformFeePercentage: 10,
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

  // Reset submitted state when navigating away from step 7
  useEffect(() => {
    if (currentStep !== 7 && submitted) {
      setSubmitted(false);
    }
  }, [currentStep, submitted]);

  const [competitionRules, setCompetitionRules] = useState<{
    rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
    tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
    tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
    minimumTrades: number;
    minimumWinRate?: number;
    tiePrizeDistribution: 'split_equally' | 'split_weighted' | 'first_gets_all';
    disqualifyOnLiquidation: boolean;
  }>({
    rankingMethod: 'pnl',
    tieBreaker1: 'trades_count',
    tieBreaker2: undefined,
    minimumTrades: 1,
    minimumWinRate: undefined,
    tiePrizeDistribution: 'split_equally',
    disqualifyOnLiquidation: true,
  });

  const [levelRequirement, setLevelRequirement] = useState({
    enabled: false,
    minLevel: 1,
    maxLevel: undefined as number | undefined,
  });

  // Market status state for validation
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    status: string;
    message: string;
    warnings: string[];
    canCreateCompetition: boolean;
    loading: boolean;
  }>({
    isOpen: true,
    status: 'unknown',
    message: 'Checking market status...',
    warnings: [],
    canCreateCompetition: true,
    loading: true,
  });

  // Fetch market status on load and when dates change
  useEffect(() => {
    const fetchMarketStatus = async () => {
      try {
        let url = '/api/market-status';
        
        // Add date params if set
        if (formData.startDate && formData.endDate) {
          const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}:00Z`);
          const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '23:59'}:00Z`);
          url += `?startDate=${startDateTime.toISOString()}&endDate=${endDateTime.toISOString()}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setMarketStatus({
            isOpen: data.currentStatus?.isOpen ?? true,
            status: data.currentStatus?.status ?? 'unknown',
            message: data.currentStatus?.message ?? '',
            warnings: data.warnings ?? [],
            canCreateCompetition: data.canCreateCompetition ?? true,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch market status:', error);
        setMarketStatus(prev => ({ ...prev, loading: false }));
      }
    };

    fetchMarketStatus();
  }, [formData.startDate, formData.startTime, formData.endDate, formData.endTime]);

  // Get current UTC time for display
  const [currentUTC, setCurrentUTC] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUTC(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUTCTime = (date: Date) => {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatUTCDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes('Date') || name.includes('Time') ? value : 
              ['entryFeeCredits', 'startingTradingPoints', 'minParticipants', 'maxParticipants', 'leverageAllowed', 'platformFeePercentage'].includes(name)
                ? Number(value)
                : value,
    }));
  };

  const handlePrizeChange = (index: number, field: 'rank' | 'percentage', value: number) => {
    const newPrizes = [...prizeDistribution];
    newPrizes[index][field] = value;
    setPrizeDistribution(newPrizes);
  };

  const addPrizeRank = () => {
    const nextRank = prizeDistribution.length + 1;
    setPrizeDistribution([...prizeDistribution, { rank: nextRank, percentage: 0 }]);
  };

  const removePrizeRank = (index: number) => {
    if (prizeDistribution.length > 2) {
      setPrizeDistribution(prizeDistribution.filter((_, i) => i !== index));
    } else {
      toast.error('Minimum 2 prize ranks required');
    }
  };

  const getTotalPrizePercentage = () => {
    return prizeDistribution.reduce((sum, prize) => sum + prize.percentage, 0);
  };

  const validateAllSteps = () => {
    // Step 1: Basic Info
    if (!formData.name || !formData.description) {
      toast.error('Please complete Step 1: Enter competition name and description');
      setCurrentStep(1);
      return false;
    }

    // Validate description word count
    const descriptionWordCount = formData.description.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (descriptionWordCount > 50) {
      toast.error(`Description exceeds 50 words (currently ${descriptionWordCount} words)`);
      setCurrentStep(1);
      return false;
    }

    // Validate minimum participants (must be at least 2)
    if (formData.minParticipants < 2) {
      toast.error('Minimum participants must be at least 2');
      setCurrentStep(2);
      return false;
    }

    // Validate starting capital (must be at least 100)
    if (formData.startingTradingPoints < 100) {
      toast.error('Starting capital must be at least 100');
      setCurrentStep(2);
      return false;
    }

    // Validate prize distribution has at least 2 ranks
    if (prizeDistribution.length < 2) {
      toast.error('At least 2 prize ranks are required');
      setCurrentStep(5);
      return false;
    }

    // Step 2: Financial Settings - already validated by required fields in inputs

    // Step 3: Schedule
    if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      toast.error('Please complete Step 3: Set start and end times');
      setCurrentStep(3);
      return false;
    }

    // Step 4: Trading Settings - Asset classes
    const selectedAssets = Object.entries(assetClasses)
      .filter(([_, selected]) => selected)
      .map(([asset, _]) => asset);
    
    if (selectedAssets.length === 0) {
      toast.error('Please complete Step 4: Select at least one asset class');
      setCurrentStep(4);
      return false;
    }

    // Step 5: Prize Distribution
      const totalPrize = getTotalPrizePercentage();
      if (Math.abs(totalPrize - 100) > 0.01) {
      toast.error(`Please complete Step 5: Prize distribution must equal 100% (currently ${totalPrize}%)`);
      setCurrentStep(5);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (submitted || loading) {
      return;
    }

    // Validate all steps before submission
    if (!validateAllSteps()) {
      return;
    }

    // BLOCK competition creation when market is closed
    if (!marketStatus.isOpen) {
      toast.error('❌ Cannot create competition: Forex market is currently closed. Please wait until market opens (Sunday 10pm - Friday 10pm UTC).');
      return;
    }

    setSubmitted(true);
    setLoading(true);

    try {
      // Build start and end dates with explicit UTC timezone
      const startTime = new Date(`${formData.startDate}T${formData.startTime}:00Z`);
      const endTime = new Date(`${formData.endDate}T${formData.endTime}:00Z`);

      // Validate dates
      if (startTime <= new Date()) {
        toast.error('Start time must be in the future (UTC timezone)');
        setLoading(false);
        return;
      }

      if (endTime <= startTime) {
        toast.error('End time must be after start time');
        setLoading(false);
        return;
      }

      // Get selected asset classes
      const selectedAssets = Object.entries(assetClasses)
        .filter(([_, selected]) => selected)
        .map(([asset, _]) => asset as 'forex' | 'crypto' | 'stocks');

      // Create competition
      await createCompetition({
        name: formData.name,
        description: formData.description,
        entryFeeCredits: formData.entryFeeCredits,
        startingTradingPoints: formData.startingTradingPoints,
        minParticipants: formData.minParticipants,
        maxParticipants: formData.maxParticipants,
        startTime,
        endTime,
        assetClasses: selectedAssets,
        leverageAllowed: formData.leverageAllowed,
        prizeDistribution,
        platformFeePercentage: formData.platformFeePercentage,
        rules: competitionRules,
        levelRequirement,
        riskLimits: {
          enabled: formData.riskLimitsEnabled,
          maxDrawdownPercent: formData.maxDrawdownPercent,
          dailyLossLimitPercent: formData.dailyLossLimitPercent,
          equityCheckEnabled: formData.equityCheckEnabled,
          equityDrawdownPercent: formData.equityDrawdownPercent,
        },
      });

      setSuccess(true);
      toast.success('Competition created successfully!');

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);
    } catch (error) {
      console.error('❌ Competition creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create competition');
      setLoading(false);
      setSubmitted(false); // Reset so user can try again
    }
  };

  // Step definitions
  const steps = [
    { 
      number: 1, 
      title: 'Basic Info', 
      icon: FileText, 
      description: 'Name and description',
      color: 'blue'
    },
    { 
      number: 2, 
      title: 'Financial', 
      icon: DollarSign, 
      description: 'Entry fees and capital',
      color: 'green'
    },
    { 
      number: 3, 
      title: 'Schedule', 
      icon: Calendar, 
      description: 'Start and end times',
      color: 'purple'
    },
    { 
      number: 4, 
      title: 'Trading', 
      icon: TrendingUp, 
      description: 'Assets and leverage',
      color: 'orange'
    },
    { 
      number: 5, 
      title: 'Prizes', 
      icon: Trophy, 
      description: 'Distribution rules',
      color: 'yellow'
    },
    { 
      number: 6, 
      title: 'Rules', 
      icon: Shield, 
      description: 'Competition rules',
      color: 'red'
    },
    { 
      number: 7, 
      title: 'Launch', 
      icon: Zap, 
      description: 'Review and launch',
      color: 'green'
    },
  ];

  const getStepColor = (color: string) => {
    const colors = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      orange: 'from-orange-500 to-orange-600',
      yellow: 'from-yellow-500 to-yellow-600',
      red: 'from-red-500 to-red-600',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 shadow-2xl shadow-green-500/20 p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/50">
            <CheckCircle className="h-12 w-12 text-white" />
        </div>
          <h2 className="text-3xl font-bold text-gray-100 mb-3">Competition Created Successfully!</h2>
          <p className="text-gray-400 text-lg mb-2">
            Your competition is now live and ready for participants
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to competitions page...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Progress Sidebar */}
      <div className="lg:col-span-1">
        <div className="sticky top-8 space-y-6">
          {/* Progress Steps */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
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
                          ? 'bg-gray-700/50 hover:bg-gray-700'
                          : 'bg-gray-800/50'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          isActive
                            ? 'bg-white/20'
                            : isCompleted
                            ? 'bg-green-500/20'
                            : 'bg-gray-700/50'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <Icon
                            className={`h-5 w-5 ${
                              isActive ? 'text-white' : 'text-gray-400'
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-semibold ${
                            isActive ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-400'
                          }`}
                        >
                          {step.title}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            isActive ? 'text-white/80' : 'text-gray-500'
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
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Quick Preview
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Participants</span>
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
                  {currencySymbol}{formData.entryFeeCredits}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-gray-400">Starting Capital</span>
                </div>
                <span className="text-sm font-bold text-gray-200">
                  ${formData.startingTradingPoints.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs text-gray-400">Max Leverage</span>
                </div>
                <span className="text-sm font-bold text-gray-200">
                  1:{formData.leverageAllowed}
                </span>
              </div>
            </div>
          </div>

          {/* Market Status Indicator */}
          <div className={`p-4 rounded-xl border ${
            marketStatus.loading 
              ? 'bg-gray-700/50 border-gray-600' 
              : marketStatus.isOpen 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-3 w-3 rounded-full ${
                marketStatus.loading 
                  ? 'bg-gray-400 animate-pulse' 
                  : marketStatus.isOpen 
                    ? 'bg-green-500' 
                    : 'bg-red-500 animate-pulse'
              }`} />
              <span className={`text-xs font-semibold ${
                marketStatus.isOpen ? 'text-gray-300' : 'text-red-300'
              }`}>
                {marketStatus.loading ? 'Checking...' : marketStatus.isOpen ? 'Forex Market' : '⛔ MARKET CLOSED'}
              </span>
            </div>
            <p className={`text-xs ${
              marketStatus.isOpen ? 'text-green-400' : 'text-red-400'
            }`}>
              {marketStatus.loading ? 'Fetching market status...' : marketStatus.message}
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
            {marketStatus.warnings.length > 0 && marketStatus.isOpen && (
              <div className="mt-2 space-y-1">
                {marketStatus.warnings.slice(0, 3).map((warning, idx) => (
                  <p key={idx} className="text-xs text-yellow-300 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="lg:col-span-2">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            // Only allow submission on final step (step 7)
            if (currentStep === 7) {
              handleSubmit(e);
            }
          }}
          onKeyDown={(e) => {
            // Prevent ALL Enter key presses in the form
            if (e.key === 'Enter') {
              e.preventDefault();
              return false;
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
                    <h2 className="text-2xl font-bold text-white">Basic Information</h2>
                    <p className="text-blue-100 text-sm">Give your competition a name and description</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <Label htmlFor="name" className="text-gray-300 flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-400" />
              Competition Name *
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
                    className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Forex Friday Championship"
              required
            />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Choose a catchy name that attracts participants
                  </p>
          </div>

          <div>
                  <Label htmlFor="description" className="text-gray-300 flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-400" />
              Description *
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
                    className={`bg-gray-800 border-gray-600 text-gray-100 min-h-[160px] focus:ring-2 focus:ring-blue-500 ${
                      formData.description.trim().split(/\s+/).filter(w => w.length > 0).length >= 45 
                        ? 'border-yellow-500/50' 
                        : ''
                    } ${
                      formData.description.trim().split(/\s+/).filter(w => w.length > 0).length > 50 
                        ? 'border-red-500' 
                        : ''
                    }`}
                    placeholder="Describe the competition briefly (max 50 words)...&#10;&#10;Example:&#10;Join our weekly Forex trading competition! Test your skills against top traders and win prizes."
              required
            />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Keep it brief and clear (max 50 words)
                    </p>
                    {(() => {
                      const wordCount = formData.description.trim() ? formData.description.trim().split(/\s+/).filter(w => w.length > 0).length : 0;
                      const isOver = wordCount > 50;
                      const isWarning = wordCount >= 45 && wordCount <= 50;
                      return (
                        <p className={`text-xs font-medium ${
                          isOver ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
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
                        <h4 className="text-sm font-semibold text-blue-300">Preview</h4>
                        <p className="text-sm text-gray-300 mt-1 font-medium">{formData.name}</p>
                        {formData.description && (
                          <p className="text-xs text-gray-400 mt-2 line-clamp-3">{formData.description}</p>
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
                    <h2 className="text-2xl font-bold text-white">Financial Settings</h2>
                    <p className="text-green-100 text-sm">Configure entry fees and capital</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 text-green-400 mt-1" />
          <div>
                        <h4 className="text-sm font-semibold text-green-300 mb-1">Prize Pool Calculator</h4>
                        <p className="text-xs text-gray-400 mb-3">Based on maximum participants</p>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div className="bg-gray-800/50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500">Total Entry Fees</div>
                            <div className="text-lg font-bold text-green-400 mt-1">
                              €{(formData.entryFeeCredits * formData.maxParticipants).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-gray-800/50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500">Prize Pool ({100 - formData.platformFeePercentage}%)</div>
                            <div className="text-lg font-bold text-yellow-400 mt-1">
                              €{((formData.entryFeeCredits * formData.maxParticipants) * (100 - formData.platformFeePercentage) / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="entryFeeCredits" className="text-gray-300 flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-400" />
              Entry Fee ({currencyCode}) *
            </Label>
            <Input
              id="entryFeeCredits"
              name="entryFeeCredits"
              type="number"
              min="1"
              step="0.01"
              value={formData.entryFeeCredits}
              onChange={handleInputChange}
                      className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-green-500"
              required
            />
                    <p className="text-xs text-gray-500 mt-2">Amount users pay to enter</p>
          </div>

          <div>
                    <Label htmlFor="startingTradingPoints" className="text-gray-300 flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-green-400" />
                      Starting Capital *
            </Label>
            <Input
              id="startingTradingPoints"
              name="startingTradingPoints"
              type="number"
              min="100"
              step="100"
              value={formData.startingTradingPoints}
              onChange={(e) => {
                const value = Math.max(100, Number(e.target.value) || 100);
                setFormData(prev => ({ ...prev, startingTradingPoints: value }));
              }}
              onBlur={(e) => {
                if (Number(e.target.value) < 100) {
                  setFormData(prev => ({ ...prev, startingTradingPoints: 100 }));
                  toast.error('Starting capital cannot be less than 100');
                }
              }}
                      className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-green-500"
              required
            />
                    <p className="text-xs text-gray-500 mt-2">Minimum 100 virtual capital for trading</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                    <Label htmlFor="minParticipants" className="text-gray-300 flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-orange-400" />
              Min Participants *
            </Label>
            <Input
              id="minParticipants"
              name="minParticipants"
              type="number"
              min="2"
              step="1"
              value={formData.minParticipants}
              onChange={(e) => {
                const value = Math.max(2, Number(e.target.value) || 2);
                setFormData(prev => ({ ...prev, minParticipants: value }));
              }}
              onBlur={(e) => {
                // Ensure value is at least 2 on blur
                if (Number(e.target.value) < 2) {
                  setFormData(prev => ({ ...prev, minParticipants: 2 }));
                  toast.error('Minimum participants cannot be less than 2');
                }
              }}
                      className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-orange-500"
              required
            />
                    <p className="text-xs text-gray-500 mt-2">Minimum 2 required (or cancel & refund)</p>
          </div>
            <div>
                    <Label htmlFor="maxParticipants" className="text-gray-300 flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-green-400" />
              Max Participants *
            </Label>
            <Input
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min="2"
              step="1"
              value={formData.maxParticipants}
              onChange={handleInputChange}
                      className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-green-500"
              required
            />
                    <p className="text-xs text-gray-500 mt-2">Maximum number of traders</p>
          </div>
          </div>

          <div>
                    <Label htmlFor="platformFeePercentage" className="text-gray-300 flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-400" />
              Platform Fee (%) *
            </Label>
            <Input
              id="platformFeePercentage"
              name="platformFeePercentage"
              type="number"
              min="0"
              max="50"
              step="1"
              value={formData.platformFeePercentage}
              onChange={handleInputChange}
                      className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-green-500"
              required
            />
                    <p className="text-xs text-gray-500 mt-2">Platform commission (0-50%)</p>
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
                    <h2 className="text-2xl font-bold text-white">Schedule</h2>
                    <p className="text-purple-100 text-sm">Set start and end times</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                {/* Current UTC Time Display */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-blue-400 animate-pulse" />
          <div>
                        <div className="text-xs text-blue-300 font-semibold uppercase">Current Server Time (UTC)</div>
                        <div className="text-xl font-bold text-blue-100 tabular-nums" suppressHydrationWarning>
                          {formatUTCTime(currentUTC)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-400 tabular-nums" suppressHydrationWarning>
                      {formatUTCDate(currentUTC)}
                    </div>
                  </div>
                </div>

                {/* Duration Preview */}
                {formData.startDate && formData.startTime && formData.endDate && formData.endTime && (
                  <div className="p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-purple-400 mt-1" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-purple-300 mb-2">Competition Schedule (UTC)</h4>
                        <div className="grid grid-cols-2 gap-4">
          <div>
                            <div className="text-xs text-gray-500">Start Time (UTC)</div>
                            <div className="text-sm text-purple-300 font-bold mt-1">
                              {formData.startDate} {formData.startTime} UTC
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">End Time (UTC)</div>
                            <div className="text-sm text-purple-300 font-bold mt-1">
                              {formData.endDate} {formData.endTime} UTC
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const start = new Date(`${formData.startDate}T${formData.startTime}:00Z`);
                          const end = new Date(`${formData.endDate}T${formData.endTime}:00Z`);
                          const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
                          const days = Math.floor(hours / 24);
                          return (
                            <div className="mt-3 text-lg font-bold text-purple-400">
                              Duration: {days > 0 ? `${days} days, ` : ''}{hours % 24} hours
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-400" />
                      Start Time
                    </h3>
                    <div className="space-y-4">
              <div>
                <Label htmlFor="startDate" className="text-gray-400 text-xs">
                          Date *
                </Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <Label htmlFor="startTime" className="text-gray-400 text-xs flex items-center justify-between">
                  <span>Time (UTC) *</span>
                  <span className="text-blue-400 font-mono text-xs" suppressHydrationWarning>
                    Now: {formatUTCTime(currentUTC)}
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      id="startTimeHour"
                      min="0"
                      max="23"
                      value={formData.startTime.split(':')[0] || '12'}
                      onChange={(e) => {
                        let hour = parseInt(e.target.value) || 0;
                        if (hour < 0) hour = 0;
                        if (hour > 23) hour = 23;
                        const minute = formData.startTime.split(':')[1] || '00';
                        setFormData(prev => ({ ...prev, startTime: `${hour.toString().padStart(2, '0')}:${minute}` }));
                      }}
                      onBlur={(e) => {
                        let hour = parseInt(e.target.value) || 0;
                        if (hour < 0) hour = 0;
                        if (hour > 23) hour = 23;
                        const minute = formData.startTime.split(':')[1] || '00';
                        setFormData(prev => ({ ...prev, startTime: `${hour.toString().padStart(2, '0')}:${minute}` }));
                      }}
                      className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-purple-500 font-mono text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">0-23</span>
                  </div>
                  <span className="text-gray-400 text-xl font-bold">:</span>
                  <div className="relative">
                    <input
                      type="number"
                      id="startTimeMinute"
                      min="0"
                      max="59"
                      value={formData.startTime.split(':')[1] || '00'}
                      onChange={(e) => {
                        let minute = parseInt(e.target.value) || 0;
                        if (minute < 0) minute = 0;
                        if (minute > 59) minute = 59;
                        const hour = formData.startTime.split(':')[0] || '12';
                        setFormData(prev => ({ ...prev, startTime: `${hour}:${minute.toString().padStart(2, '0')}` }));
                      }}
                      onBlur={(e) => {
                        let minute = parseInt(e.target.value) || 0;
                        if (minute < 0) minute = 0;
                        if (minute > 59) minute = 59;
                        const hour = formData.startTime.split(':')[0] || '12';
                        setFormData(prev => ({ ...prev, startTime: `${hour}:${minute.toString().padStart(2, '0')}` }));
                      }}
                      className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-purple-500 font-mono text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">0-59</span>
                  </div>
                  <span className="text-gray-500 text-sm ml-1">UTC</span>
                </div>
                {/* Quick Time Presets */}
                <div className="flex flex-wrap gap-1 mt-6">
                  {['00:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, startTime: time }))}
                      className={`px-2 py-1 text-xs rounded ${formData.startTime === time ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

                  <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-400" />
                      End Time
                    </h3>
                    <div className="space-y-4">
              <div>
                <Label htmlFor="endDate" className="text-gray-400 text-xs">
                          Date *
                </Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <Label htmlFor="endTime" className="text-gray-400 text-xs flex items-center justify-between">
                  <span>Time (UTC) *</span>
                  <span className="text-blue-400 font-mono text-xs" suppressHydrationWarning>
                    Now: {formatUTCTime(currentUTC)}
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      id="endTimeHour"
                      min="0"
                      max="23"
                      value={formData.endTime.split(':')[0] || '12'}
                      onChange={(e) => {
                        let hour = parseInt(e.target.value) || 0;
                        if (hour < 0) hour = 0;
                        if (hour > 23) hour = 23;
                        const minute = formData.endTime.split(':')[1] || '00';
                        setFormData(prev => ({ ...prev, endTime: `${hour.toString().padStart(2, '0')}:${minute}` }));
                      }}
                      onBlur={(e) => {
                        let hour = parseInt(e.target.value) || 0;
                        if (hour < 0) hour = 0;
                        if (hour > 23) hour = 23;
                        const minute = formData.endTime.split(':')[1] || '00';
                        setFormData(prev => ({ ...prev, endTime: `${hour.toString().padStart(2, '0')}:${minute}` }));
                      }}
                      className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-purple-500 font-mono text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">0-23</span>
                  </div>
                  <span className="text-gray-400 text-xl font-bold">:</span>
                  <div className="relative">
                    <input
                      type="number"
                      id="endTimeMinute"
                      min="0"
                      max="59"
                      value={formData.endTime.split(':')[1] || '00'}
                      onChange={(e) => {
                        let minute = parseInt(e.target.value) || 0;
                        if (minute < 0) minute = 0;
                        if (minute > 59) minute = 59;
                        const hour = formData.endTime.split(':')[0] || '12';
                        setFormData(prev => ({ ...prev, endTime: `${hour}:${minute.toString().padStart(2, '0')}` }));
                      }}
                      onBlur={(e) => {
                        let minute = parseInt(e.target.value) || 0;
                        if (minute < 0) minute = 0;
                        if (minute > 59) minute = 59;
                        const hour = formData.endTime.split(':')[0] || '12';
                        setFormData(prev => ({ ...prev, endTime: `${hour}:${minute.toString().padStart(2, '0')}` }));
                      }}
                      className="bg-gray-800 border border-gray-600 text-gray-100 h-11 w-16 px-2 rounded-md focus:ring-2 focus:ring-purple-500 font-mono text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">0-59</span>
                  </div>
                  <span className="text-gray-500 text-sm ml-1">UTC</span>
                </div>
                {/* Quick Time Presets */}
                <div className="flex flex-wrap gap-1 mt-6">
                  {['00:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, endTime: time }))}
                      className={`px-2 py-1 text-xs rounded ${formData.endTime === time ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
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
                      Registration closes 1 hour before the competition starts. Make sure to set appropriate start times.
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
                    <h2 className="text-2xl font-bold text-white">Trading Settings</h2>
                    <p className="text-orange-100 text-sm">Configure assets and leverage</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
          <div>
                  <Label className="text-gray-300 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-400" />
                    Asset Classes *
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(assetClasses).map(([asset, checked]) => (
                      <div
                        key={asset}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          checked
                            ? 'bg-orange-500/20 border-orange-500'
                            : 'bg-gray-800/50 border-gray-600 hover:border-gray-500'
                        }`}
                        onClick={() => setAssetClasses((prev) => ({ ...prev, [asset]: !checked }))}
                      >
                        <div className="flex items-center gap-3">
                  <Checkbox
                    id={asset}
                    checked={checked}
                    onCheckedChange={(checked) =>
                      setAssetClasses((prev) => ({ ...prev, [asset]: checked === true }))
                    }
                            className="pointer-events-none"
                  />
                  <Label
                    htmlFor={asset}
                            className="text-sm font-semibold text-gray-200 uppercase cursor-pointer pointer-events-none"
                  >
                    {asset}
                  </Label>
                        </div>
                </div>
              ))}
            </div>
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Select at least one asset class for trading
                  </p>
          </div>

                <div>
                  <Label htmlFor="leverageAllowed" className="text-gray-300 flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-orange-400" />
              Maximum Leverage (1:X) *
            </Label>
                  <div className="flex items-center gap-4">
            <Input
              id="leverageAllowed"
              name="leverageAllowed"
                      type="range"
                      min="1"
                      max="500"
                      step="1"
                      value={formData.leverageAllowed}
                      onChange={handleInputChange}
                      className="flex-1"
                    />
                    <div className="w-24 text-right">
                      <div className="text-2xl font-bold text-orange-400">1:{formData.leverageAllowed}</div>
                    </div>
                  </div>
                  <Input
              type="number"
              min="1"
              max="500"
              step="1"
              value={formData.leverageAllowed}
              onChange={handleInputChange}
                    name="leverageAllowed"
                    className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-orange-500 mt-3"
              required
            />
                  <p className="text-xs text-gray-500 mt-2">Higher leverage = higher risk and potential reward</p>
          </div>

                {/* Risk Limits Section */}
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <Shield className="h-5 w-5 text-red-400 mt-1" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-300">Risk Limits</h4>
                      <p className="text-xs text-gray-400 mt-1">Set maximum drawdown and daily loss limits for this competition</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mb-4">
                    <Checkbox
                      id="riskLimitsEnabled"
                      checked={formData.riskLimitsEnabled}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, riskLimitsEnabled: checked === true }))
                      }
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
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <TrendingDown className="h-4 w-4 text-red-400" />
                          Max Drawdown %
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.maxDrawdownPercent}
                          onChange={(e) => setFormData((prev) => ({ ...prev, maxDrawdownPercent: Number(e.target.value) }))}
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 focus:ring-2 focus:ring-red-500"
                        />
                        <p className="text-xs text-red-400 mt-1">
                          🛑 Trading blocked when account drops {formData.maxDrawdownPercent}% below starting capital
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-orange-400" />
                          Daily Loss Limit %
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.dailyLossLimitPercent}
                          onChange={(e) => setFormData((prev) => ({ ...prev, dailyLossLimitPercent: Number(e.target.value) }))}
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 focus:ring-2 focus:ring-orange-500"
                        />
                        <p className="text-xs text-orange-400 mt-1">
                          ⚠️ Trading blocked when daily loss exceeds {formData.dailyLossLimitPercent}% of starting capital
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Equity Check - Anti-Fraud Feature */}
                  <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <div className="flex items-start gap-3 mb-4">
                      <Shield className="h-5 w-5 text-purple-400 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-semibold text-purple-300">Equity Check (Anti-Fraud)</h5>
                        <p className="text-xs text-gray-400 mt-1">
                          Checks real-time equity (balance + unrealized PnL). Helps detect mirror trading abuse where one account has large unrealized losses.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 mb-4">
                      <Checkbox
                        id="equityCheckEnabled"
                        checked={formData.equityCheckEnabled}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, equityCheckEnabled: checked === true }))
                        }
                      />
                      <label
                        htmlFor="equityCheckEnabled"
                        className="text-sm font-medium text-gray-200 cursor-pointer"
                      >
                        Enable Equity-Based Drawdown Check
                      </label>
                    </div>

                    {formData.equityCheckEnabled && (
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <TrendingDown className="h-4 w-4 text-purple-400" />
                          Max Equity Drawdown %
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.equityDrawdownPercent}
                          onChange={(e) => setFormData((prev) => ({ ...prev, equityDrawdownPercent: Number(e.target.value) }))}
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-purple-400 mt-1">
                          🛡️ Trading blocked when equity (balance + unrealized P&L) drops {formData.equityDrawdownPercent}% below starting capital
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          💡 Tip: Set this stricter than Max Drawdown (e.g., 30%) to catch mirror trading schemes early
                        </p>
                      </div>
                    )}
                  </div>
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
                    <h2 className="text-2xl font-bold text-white">Prize Distribution</h2>
                    <p className="text-yellow-100 text-sm">Set winner payouts</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div>
                    <div className="text-sm text-gray-400">Total Distribution</div>
                    <div className={`text-3xl font-bold mt-1 ${
                      getTotalPrizePercentage() === 100 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {getTotalPrizePercentage()}%
                    </div>
                    {getTotalPrizePercentage() !== 100 && (
                      <div className="text-xs text-red-400 mt-1">Must equal 100%</div>
              )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addPrizeRank}
                    className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-gray-900"
          >
                    <Plus className="h-4 w-4 mr-2" />
            Add Rank
          </Button>
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
                            <Label className="text-xs text-gray-400 mb-2 block">Rank Position</Label>
                  <Input
                    type="number"
                    min="1"
                    value={prize.rank}
                    onChange={(e) => handlePrizeChange(index, 'rank', Number(e.target.value))}
                              className="bg-gray-800 border-gray-600 text-gray-100 h-11 text-lg font-bold"
                  />
                </div>
                <div>
                            <Label className="text-xs text-gray-400 mb-2 block">Prize Percentage</Label>
                            <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={prize.percentage}
                    onChange={(e) => handlePrizeChange(index, 'percentage', Number(e.target.value))}
                                className="bg-gray-800 border-gray-600 text-gray-100 h-11 text-lg font-bold pr-8"
                  />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                </div>
              </div>
              {prizeDistribution.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePrizeRank(index)}
                            className="flex-shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove rank (min 2 required)"
                >
                            <Minus className="h-5 w-5" />
                </Button>
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
                    <h2 className="text-2xl font-bold text-white">Competition Rules</h2>
                    <p className="text-red-100 text-sm">Configure ranking and tie-breaking rules</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
      {/* Competition Rules */}
                <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-400" />
                    Competition Rules
                  </h3>
        <p className="text-sm text-gray-400 mb-6">
          Configure how winners are determined and how ties are handled
        </p>
        <CompetitionRulesSection
          rules={competitionRules}
          onChange={(newRules: any) => setCompetitionRules(newRules)}
        />
      </div>

      {/* Level Requirement */}
                <div className="p-6 bg-gray-800/50 border border-gray-600 rounded-xl">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2 flex items-center gap-2">
                    <Award className="h-5 w-5 text-red-400" />
                    Level Requirement
                  </h3>
        <p className="text-sm text-gray-400 mb-6">
          Restrict this competition to specific trader levels
        </p>
        
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="levelEnabled"
              checked={levelRequirement.enabled}
              onCheckedChange={(checked) =>
                setLevelRequirement((prev) => ({ ...prev, enabled: checked as boolean }))
              }
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
                <Label className="text-gray-200">Minimum Level Required</Label>
                <select
                  value={levelRequirement.minLevel}
                  onChange={(e) =>
                    setLevelRequirement((prev) => ({ ...prev, minLevel: Number(e.target.value) }))
                  }
                            className="w-full mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value={1}>🌱 Level 1: Novice Trader</option>
                  <option value={2}>📚 Level 2: Apprentice Trader</option>
                  <option value={3}>⚔️ Level 3: Skilled Trader</option>
                  <option value={4}>🎯 Level 4: Expert Trader</option>
                  <option value={5}>💎 Level 5: Elite Trader</option>
                  <option value={6}>👑 Level 6: Master Trader</option>
                  <option value={7}>🔥 Level 7: Grand Master</option>
                  <option value={8}>⚡ Level 8: Trading Champion</option>
                  <option value={9}>🌟 Level 9: Market Legend</option>
                  <option value={10}>👑 Level 10: Trading God</option>
                </select>
              </div>

              <div>
                <Label className="text-gray-200">Maximum Level (Optional)</Label>
                <select
                  value={levelRequirement.maxLevel || ''}
                  onChange={(e) =>
                    setLevelRequirement((prev) => ({
                      ...prev,
                      maxLevel: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                            className="w-full mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                            <option value="">No Maximum</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                    if (level < levelRequirement.minLevel) return null;
                              const levelNames = ['', '🌱 Level 1', '📚 Level 2', '⚔️ Level 3', '🎯 Level 4', '💎 Level 5', '👑 Level 6', '🔥 Level 7', '⚡ Level 8', '🌟 Level 9', '👑 Level 10'];
                              return <option key={level} value={level}>{levelNames[level]}</option>;
                  })}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
              </div>
            </div>
          )}

          {/* Step 7: Launch Competition */}
          {currentStep === 7 && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Review & Launch</h2>
                    <p className="text-green-100 text-sm">Final review before launching your competition</p>
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
                      <p className="text-xs text-gray-400 mb-1">Competition Name</p>
                      <p className="text-sm font-semibold text-gray-100">{formData.name || 'Not set'}</p>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Participants</p>
                      <p className="text-sm font-semibold text-gray-100">{formData.minParticipants} - {formData.maxParticipants}</p>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Entry Fee</p>
                      <p className="text-sm font-semibold text-gray-100">{currencySymbol}{formData.entryFeeCredits}</p>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Starting Capital</p>
                      <p className="text-sm font-semibold text-gray-100">{formData.startingTradingPoints.toLocaleString()} pts</p>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Start Time (UTC)</p>
                      <p className="text-sm font-semibold text-gray-100">{formData.startDate} {formData.startTime}</p>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">End Time (UTC)</p>
                      <p className="text-sm font-semibold text-gray-100">{formData.endDate} {formData.endTime}</p>
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
                      <div key={prize.rank} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                        <span className="text-sm text-gray-300">Rank {prize.rank}</span>
                        <span className="text-sm font-semibold text-gray-100">{prize.percentage}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400">
                      Total: {getTotalPrizePercentage()}% {getTotalPrizePercentage() === 100 ? '✓' : '⚠️ Must equal 100%'}
                </p>
              </div>
            </div>

                {/* Important Notice */}
                <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-400 mb-1">Ready to Launch?</h4>
                      <p className="text-xs text-yellow-300/80">
                        Once launched, the competition will be visible to all users and will automatically start at the scheduled time (UTC). 
                        Make sure all details are correct before proceeding.
                      </p>
        </div>
      </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-700">
        <Button
          type="button"
          variant="outline"
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep(currentStep - 1);
                } else {
                  router.push('/dashboard');
                }
              }}
              className="border-gray-600 hover:bg-gray-700"
        >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {currentStep === 1 ? 'Cancel' : 'Previous'}
        </Button>

            {currentStep < 7 ? (
              <Button
                type="button"
                onClick={() => {
                  // Validate step 1: Basic Info
                  if (currentStep === 1) {
                    if (!formData.name.trim()) {
                      toast.error('Please enter a competition name');
                      return;
                    }
                    if (!formData.description.trim()) {
                      toast.error('Please enter a description');
                      return;
                    }
                    const wordCount = formData.description.trim().split(/\s+/).filter(w => w.length > 0).length;
                    if (wordCount > 50) {
                      toast.error(`Description exceeds 50 words (currently ${wordCount} words). Please shorten it.`);
                      return;
                    }
                  }
                  // Validate step 2: Financial Settings
                  if (currentStep === 2) {
                    if (formData.entryFeeCredits < 1) {
                      toast.error('Entry fee must be at least 1');
                      return;
                    }
                    if (formData.startingTradingPoints < 100) {
                      toast.error('Starting capital must be at least 100');
                      return;
                    }
                    if (formData.minParticipants < 2) {
                      toast.error('Minimum participants must be at least 2');
                      return;
                    }
                    if (formData.maxParticipants < formData.minParticipants) {
                      toast.error('Max participants must be greater than or equal to min participants');
                      return;
                    }
                  }
                  // Validate step 3: Schedule
                  if (currentStep === 3) {
                    if (!formData.startDate) {
                      toast.error('Please select a start date');
                      return;
                    }
                    if (!formData.startTime) {
                      toast.error('Please select a start time');
                      return;
                    }
                    if (!formData.endDate) {
                      toast.error('Please select an end date');
                      return;
                    }
                    if (!formData.endTime) {
                      toast.error('Please select an end time');
                      return;
                    }
                    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}:00Z`);
                    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}:00Z`);
                    if (startDateTime <= new Date()) {
                      toast.error('Start time must be in the future');
                      return;
                    }
                    if (endDateTime <= startDateTime) {
                      toast.error('End time must be after start time');
                      return;
                    }
                  }
                  // Validate step 4: Trading Settings
                  if (currentStep === 4) {
                    const selectedAssets = Object.values(assetClasses).filter(Boolean).length;
                    if (selectedAssets === 0) {
                      toast.error('Please select at least one asset class');
                      return;
                    }
                  }
                  // Validate step 5: Prize Distribution
                  if (currentStep === 5) {
                    if (prizeDistribution.length < 2) {
                      toast.error('At least 2 prize ranks are required');
                      return;
                    }
                    const total = getTotalPrizePercentage();
                    if (Math.abs(total - 100) > 0.01) {
                      toast.error(`Prize distribution must equal 100% (currently ${total}%)`);
                      return;
                    }
                  }
                  setCurrentStep(currentStep + 1);
                }}
                disabled={
                  (currentStep === 1 && (
                    !formData.name.trim() || 
                    !formData.description.trim() || 
                    formData.description.trim().split(/\s+/).filter(w => w.length > 0).length > 50
                  )) ||
                  (currentStep === 2 && (
                    formData.entryFeeCredits < 1 ||
                    formData.startingTradingPoints < 100 ||
                    formData.minParticipants < 2 ||
                    formData.maxParticipants < formData.minParticipants
                  )) ||
                  (currentStep === 3 && (
                    !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime
                  )) ||
                  (currentStep === 4 && Object.values(assetClasses).filter(Boolean).length === 0) ||
                  (currentStep === 5 && (prizeDistribution.length < 2 || Math.abs(getTotalPrizePercentage() - 100) > 0.01))
                }
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
        <Button
          type="submit"
          disabled={loading || submitted || getTotalPrizePercentage() !== 100}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold shadow-lg shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Competition...
            </>
          ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Launch Competition
                  </>
          )}
        </Button>
            )}
            
            {/* Debug Helper - Show why button is disabled */}
            {currentStep === 7 && (loading || submitted || getTotalPrizePercentage() !== 100) && (
              <div className="text-sm text-amber-400 mt-2">
                {loading && '⏳ Creating competition...'}
                {!loading && submitted && '✅ Competition submitted'}
                {!loading && !submitted && getTotalPrizePercentage() !== 100 && 
                  `⚠️ Prize distribution must total 100% (currently ${getTotalPrizePercentage()}%)`
                }
              </div>
            )}
      </div>
    </form>
      </div>
    </div>
  );
}

