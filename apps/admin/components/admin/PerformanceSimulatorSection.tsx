'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Play,
  Square,
  Settings,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
  Brain,
  Cpu,
  HardDrive,
  Users,
  Trophy,
  Swords,
  TrendingUp,
  Zap,
  Activity,
  Database,
  AlertTriangle,
  Info,
  Download,
  Sparkles,
  Target,
  Wallet,
  ArrowDownToLine,
  MemoryStick,
  Timer,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Types
interface SimulatorConfig {
  _id: string;
  name: string;
  scale: 'small' | 'medium' | 'large' | 'custom';
  virtualUsers: number;
  userRegistrationRate: number;
  competitions: number;
  competitionTypes: string[];
  tradersPerCompetition: number;
  challenges: number;
  challengeStakes: number[];
  tradesPerUser: number;
  tradingDuration: number;
  tpSlPercentage: number;
  simulateAdminActions: boolean;
  paymentApprovalDelay: number;
  simulateFraud: boolean;
  fraudPercentage: number;
  useTestDatabase: boolean;
  testDatabaseUri?: string;
  enableHardwareStress: boolean;
  cpuStressLevel: number;
  memoryStressLevel: number;
  useAIPatterns: boolean;
  useAIAnalysis: boolean;
  presets: {
    small: { users: number; competitions: number; challenges: number; trades: number };
    medium: { users: number; competitions: number; challenges: number; trades: number };
    large: { users: number; competitions: number; challenges: number; trades: number };
  };
}

interface TestCaseResult {
  id: string;
  category: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  iterations: number;
  successCount: number;
  failureCount: number;
  errorMessage?: string;
  metrics?: {
    avgResponseTime?: number;
    p95ResponseTime?: number;
    throughput?: number;
    errorRate?: number;
  };
}

interface SimulatorRun {
  _id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  duration?: number;
  progress: {
    phase: string;
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message: string;
  };
  testCases: TestCaseResult[];
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    usersCreated: number;
    competitionsCreated: number;
    challengesCreated: number;
    tradesExecuted: number;
    depositsProcessed: number;
    withdrawalsProcessed: number;
  };
  hardwareMetrics: Array<{
    timestamp: string;
    cpu: { usage: number };
    memory: { percentage: number };
  }>;
  peakMetrics: {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxDbConnections: number;
    maxQueryTime: number;
  };
  aiAnalysis?: {
    summary: string;
    performanceScore: number;
    findings: Array<{
      type: 'success' | 'warning' | 'error' | 'info';
      title: string;
      description: string;
      recommendation?: string;
    }>;
    bottlenecks: Array<{
      component: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      suggestedFix?: string;
    }>;
    recommendations: string[];
  };
  cleanedUp: boolean;
  createdAt: string;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

export default function PerformanceSimulatorSection() {
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [currentRun, setCurrentRun] = useState<SimulatorRun | null>(null);
  const [runs, setRuns] = useState<SimulatorRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupData, setCleanupData] = useState<{ counts: Record<string, number>; totalCount: number } | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
    fetchRuns();
    checkRunningStatus();
    fetchCleanupData();
  }, []);
  
  // Fetch cleanup data counts
  const fetchCleanupData = async () => {
    try {
      const response = await fetch('/api/simulator/cleanup');
      const data = await response.json();
      if (data.success) {
        setCleanupData({ counts: data.counts, totalCount: data.totalCount });
      }
    } catch (error) {
      console.error('Failed to fetch cleanup data:', error);
    }
  };

  // Perform cleanup of all simulation data
  const performCleanup = async () => {
    setCleanupLoading(true);
    try {
      const response = await fetch('/api/simulator/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE_ALL_SIMULATION_DATA' }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Deleted ${data.totalDeleted} simulation records`, {
          description: `Users: ${data.deleted.users}, Competitions: ${data.deleted.competitions}, Positions: ${data.deleted.positions}`,
        });
        setShowCleanupConfirm(false);
        fetchCleanupData();
        fetchRuns();
      } else {
        toast.error('Cleanup failed', { description: data.error });
      }
    } catch (error) {
      toast.error('Cleanup request failed');
      console.error(error);
    } finally {
      setCleanupLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/simulator/config');
      const data = await response.json();
      if (data.success) {
        // Auto-correct tradersPerCompetition if it's less than virtualUsers
        // This ensures all users can join all competitions
        const loadedConfig = data.config;
        if (loadedConfig.tradersPerCompetition < loadedConfig.virtualUsers) {
          loadedConfig.tradersPerCompetition = loadedConfig.virtualUsers;
          toast.info(`Auto-corrected traders per competition to ${loadedConfig.virtualUsers} to match virtual users`);
        }
        setConfig(loadedConfig);
      }
    } catch (error) {
      toast.error('Failed to load configuration');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async () => {
    try {
      const response = await fetch('/api/simulator/run?limit=10');
      const data = await response.json();
      if (data.success) {
        setRuns(data.runs);
      }
    } catch (error) {
      console.error('Failed to fetch runs:', error);
    }
  };

  const completedRunIdRef = useRef<string | null>(null);
  
  const checkRunningStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/simulator/run?action=status');
      const data = await response.json();
      if (data.success) {
        if (data.run) {
          setCurrentRun(data.run);
          
          // Check if simulation completed (regardless of isRunning flag)
          if (data.run.status === 'completed' && completedRunIdRef.current !== data.run._id) {
            completedRunIdRef.current = data.run._id;
            setIsRunning(false);
            toast.success('🎉 Simulation completed successfully!', {
              description: `Completed in ${Math.round((data.run.duration || 0) / 1000)}s`,
            });
            // Switch to results tab
            setActiveTab('results');
            fetchRuns();
            fetchCleanupData();
          } else if (data.run.status === 'failed' && completedRunIdRef.current !== data.run._id) {
            completedRunIdRef.current = data.run._id;
            setIsRunning(false);
            toast.error('Simulation failed', {
              description: data.run.progress?.message || 'Unknown error',
            });
            fetchRuns();
          } else if (data.run.status === 'running') {
            setIsRunning(true);
          }
        } else {
          setIsRunning(data.isRunning);
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  }, []);

  // Poll for updates when simulation is running
  useEffect(() => {
    if (isRunning) {
      // Start polling
      pollIntervalRef.current = setInterval(checkRunningStatus, 2000);
    } else if (currentRun?.status === 'running') {
      // Keep polling if the run status is still 'running' (waiting for completion)
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(checkRunningStatus, 1000); // Check more frequently
      }
    } else {
      // Stop polling when truly done
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isRunning, currentRun?.status, checkRunningStatus]);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      // Auto-correct tradersPerCompetition before saving
      const configToSave = {
        ...config,
        tradersPerCompetition: Math.max(config.tradersPerCompetition, config.virtualUsers),
      };
      
      const response = await fetch('/api/simulator/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Configuration saved');
        setConfig(data.config);
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const startSimulation = async () => {
    let configIdToUse = config?._id;
    
    // Auto-save config if not saved yet
    if (!configIdToUse) {
      try {
        const saveResponse = await fetch('/api/simulator/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        const saveData = await saveResponse.json();
        if (saveData.success && saveData.config?._id) {
          configIdToUse = saveData.config._id;
          setConfig(saveData.config);
          toast.success('Configuration saved');
        } else {
          toast.error('Failed to save configuration');
          return;
        }
      } catch (error) {
        toast.error('Failed to save configuration');
        console.error(error);
        return;
      }
    }

    try {
      const response = await fetch('/api/simulator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', configId: configIdToUse }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Simulation started');
        setIsRunning(true);
        setActiveTab('runner');
      } else {
        toast.error(data.error || 'Failed to start simulation');
      }
    } catch (error) {
      toast.error('Failed to start simulation');
      console.error(error);
    }
  };

  const stopSimulation = async () => {
    try {
      const response = await fetch('/api/simulator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Simulation stopped');
        setIsRunning(false);
        fetchRuns();
      }
    } catch (error) {
      toast.error('Failed to stop simulation');
      console.error(error);
    }
  };

  const runAIAnalysis = async (runId: string) => {
    try {
      toast.info('🤖 Running AI analysis...', { duration: 5000 });
      const response = await fetch('/api/simulator/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze-results', data: { runId } }),
      });
      const data = await response.json();
      if (data.success && data.aiAnalysis) {
        toast.success(`✅ AI Analysis Complete! Score: ${data.aiAnalysis.performanceScore}/100`);
        // Update currentRun with the analysis
        if (currentRun?._id === runId) {
          setCurrentRun({ ...currentRun, aiAnalysis: data.aiAnalysis });
        }
        fetchRuns();
      } else {
        toast.error('AI analysis failed');
      }
    } catch (error) {
      toast.error('AI analysis failed');
      console.error(error);
    }
  };

  const cleanupTestData = async (runId: string) => {
    if (!confirm('This will delete all test data created during this simulation. Are you sure?')) {
      return;
    }

    try {
      toast.info('Cleaning up test data...');
      const response = await fetch(`/api/simulator/run/${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Cleanup complete: ${JSON.stringify(data.cleanupResult)}`);
        fetchRuns();
      } else {
        toast.error('Cleanup failed');
      }
    } catch (error) {
      toast.error('Cleanup failed');
      console.error(error);
    }
  };

  const applyPreset = (preset: 'small' | 'medium' | 'large') => {
    if (!config) return;
    const presetConfig = config.presets[preset];
    setConfig({
      ...config,
      scale: preset,
      virtualUsers: presetConfig.users,
      competitions: presetConfig.competitions,
      challenges: presetConfig.challenges,
      tradesPerUser: Math.ceil(presetConfig.trades / presetConfig.users),
    });
  };

  // Auto-calculate related settings when Virtual Users changes
  const calculateSettingsFromUsers = (users: number): Partial<SimulatorConfig> => {
    // Calculate optimal values based on user count
    const registrationRate = Math.min(users, 100); // Max 100 users/sec
    // tradersPerCompetition should be >= users so all users can join all competitions
    const tradersPerComp = users; // Allow all users to join each competition
    const competitions = Math.max(1, Math.min(Math.ceil(users / 20), 10)); // 1-10 competitions based on scale
    const challenges = Math.floor(users * 5); // Each user can have ~5 challenges
    const tradesPerUser = Math.min(Math.max(Math.ceil(100 / Math.sqrt(users)), 5), 50); // Scale inversely with users
    const tradingDuration = users <= 100 ? 30 : users <= 1000 ? 60 : 120; // Scale duration with load
    const tpSlPercentage = 70; // Keep constant
    
    return {
      userRegistrationRate: registrationRate,
      competitions,
      tradersPerCompetition: tradersPerComp,
      challenges,
      tradesPerUser,
      tradingDuration,
      tpSlPercentage,
    };
  };

  const handleVirtualUsersChange = (newUsers: number) => {
    if (!config) return;
    const calculatedSettings = calculateSettingsFromUsers(newUsers);
    setConfig({
      ...config,
      virtualUsers: newUsers,
      scale: 'custom',
      ...calculatedSettings,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'skipped':
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Clock className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'running':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'skipped':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="h-7 w-7 text-cyan-400" />
            Performance Simulator
          </h2>
          <p className="text-gray-400 mt-1">
            Comprehensive load testing and stress testing for the trading platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cleanup Button */}
          {!showCleanupConfirm ? (
            <Button
              onClick={() => {
                fetchCleanupData();
                setShowCleanupConfirm(true);
              }}
              variant="outline"
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              disabled={isRunning}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Test Data
              {cleanupData && cleanupData.totalCount > 0 && (
                <Badge className="ml-2 bg-orange-500/20 text-orange-300 text-xs">
                  {cleanupData.totalCount}
                </Badge>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-300">
                Delete {cleanupData?.totalCount || 0} records?
              </span>
              <Button
                onClick={performCleanup}
                size="sm"
                variant="destructive"
                disabled={cleanupLoading}
                className="ml-2"
              >
                {cleanupLoading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  'Confirm'
                )}
              </Button>
              <Button
                onClick={() => setShowCleanupConfirm(false)}
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          )}
          
          {/* Run/Stop Button */}
          {isRunning ? (
            <Button
              onClick={stopSimulation}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Simulation
            </Button>
          ) : (
            <Button
              onClick={startSimulation}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              disabled={showCleanupConfirm}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Simulation
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="config" className="data-[state=active]:bg-gray-700">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="runner" className="data-[state=active]:bg-gray-700">
            <Play className="h-4 w-4 mr-2" />
            Runner
            {isRunning && <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="results" className="data-[state=active]:bg-gray-700">
            <BarChart3 className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
          <TabsTrigger value="checklist" className="data-[state=active]:bg-gray-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-gray-700">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          {config && (
            <>
              {/* Presets */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400" />
                    Quick Presets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {(['small', 'medium', 'large'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all text-left",
                          config.scale === preset
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                        )}
                      >
                        <p className="font-semibold text-white capitalize mb-2">{preset}</p>
                        <div className="text-xs text-gray-400 space-y-1">
                          <p>👥 {config.presets[preset].users.toLocaleString()} users</p>
                          <p>🏆 {config.presets[preset].competitions} competitions</p>
                          <p>⚔️ {config.presets[preset].challenges} challenges</p>
                          <p>📊 {config.presets[preset].trades.toLocaleString()} trades</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Main Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Users & Traffic */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-400" />
                      Users & Traffic
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-gray-300">Virtual Users</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100000"
                        value={config.virtualUsers}
                        onChange={(e) => handleVirtualUsersChange(parseInt(e.target.value) || 10)}
                        className="mt-2 bg-gray-900 border-gray-700 text-white"
                      />
                      <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Other settings auto-adjust based on user count
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        Registration Rate (users/sec)
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Auto</Badge>
                      </Label>
                      <Slider
                        value={[config.userRegistrationRate]}
                        onValueChange={([v]) => setConfig({ ...config, userRegistrationRate: v })}
                        min={1}
                        max={100}
                        step={1}
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">{config.userRegistrationRate} users/second</p>
                    </div>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        Trades Per User
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Auto</Badge>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={config.tradesPerUser}
                        onChange={(e) => setConfig({ ...config, tradesPerUser: parseInt(e.target.value) || 10 })}
                        className="mt-2 bg-gray-900 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">TP/SL Percentage</Label>
                      <Slider
                        value={[config.tpSlPercentage]}
                        onValueChange={([v]) => setConfig({ ...config, tpSlPercentage: v })}
                        min={0}
                        max={100}
                        step={5}
                        className="mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">{config.tpSlPercentage}% of trades have TP/SL</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Competitions & Challenges */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-400" />
                      Competitions & Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        Competitions
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Auto</Badge>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="1000"
                        value={config.competitions}
                        onChange={(e) => setConfig({ ...config, competitions: parseInt(e.target.value) || 0 })}
                        className="mt-2 bg-gray-900 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        Traders Per Competition
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Auto</Badge>
                      </Label>
                      <Input
                        type="number"
                        min="2"
                        max="1000000"
                        value={config.tradersPerCompetition}
                        onChange={(e) => setConfig({ ...config, tradersPerCompetition: parseInt(e.target.value) || config.virtualUsers })}
                        className="mt-2 bg-gray-900 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        Challenges (1v1)
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Auto</Badge>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="10000"
                        value={config.challenges}
                        onChange={(e) => setConfig({ ...config, challenges: parseInt(e.target.value) || 0 })}
                        className="mt-2 bg-gray-900 border-gray-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        Trading Duration (minutes)
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">Auto</Badge>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="1440"
                        value={config.tradingDuration}
                        onChange={(e) => setConfig({ ...config, tradingDuration: parseInt(e.target.value) || 30 })}
                        className="mt-2 bg-gray-900 border-gray-700 text-white"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Hardware Stress */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-red-400" />
                      Hardware Stress Testing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300">Enable Hardware Stress</Label>
                      <Switch
                        checked={config.enableHardwareStress}
                        onCheckedChange={(v) => setConfig({ ...config, enableHardwareStress: v })}
                      />
                    </div>
                    {config.enableHardwareStress && (
                      <>
                        <div>
                          <Label className="text-gray-300">CPU Stress Level</Label>
                          <Slider
                            value={[config.cpuStressLevel]}
                            onValueChange={([v]) => setConfig({ ...config, cpuStressLevel: v })}
                            min={1}
                            max={10}
                            step={1}
                            className="mt-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Level {config.cpuStressLevel}/10</p>
                        </div>
                        <div>
                          <Label className="text-gray-300">Memory Stress Level</Label>
                          <Slider
                            value={[config.memoryStressLevel]}
                            onValueChange={([v]) => setConfig({ ...config, memoryStressLevel: v })}
                            min={1}
                            max={10}
                            step={1}
                            className="mt-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Level {config.memoryStressLevel}/10</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* AI & Advanced */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-400" />
                      AI & Advanced Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-300">AI Trading Patterns</Label>
                        <p className="text-xs text-gray-500">Generate realistic trading behavior</p>
                      </div>
                      <Switch
                        checked={config.useAIPatterns}
                        onCheckedChange={(v) => setConfig({ ...config, useAIPatterns: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-300">AI Analysis</Label>
                        <p className="text-xs text-gray-500">AI-powered result analysis</p>
                      </div>
                      <Switch
                        checked={config.useAIAnalysis}
                        onCheckedChange={(v) => setConfig({ ...config, useAIAnalysis: v })}
                      />
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-300">Simulate Admin Actions</Label>
                        <p className="text-xs text-gray-500">Payment approvals, user management</p>
                      </div>
                      <Switch
                        checked={config.simulateAdminActions}
                        onCheckedChange={(v) => setConfig({ ...config, simulateAdminActions: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-300">Simulate Fraud</Label>
                        <p className="text-xs text-gray-500">Test fraud detection with multi-accounting</p>
                      </div>
                      <Switch
                        checked={config.simulateFraud}
                        onCheckedChange={(v) => setConfig({ ...config, simulateFraud: v })}
                      />
                    </div>
                    {config.simulateFraud && (
                      <div>
                        <Label className="text-gray-300">Fraud Percentage</Label>
                        <Slider
                          value={[config.fraudPercentage]}
                          onValueChange={([v]) => setConfig({ ...config, fraudPercentage: v })}
                          min={1}
                          max={20}
                          step={1}
                          className="mt-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">{config.fraudPercentage}% of users are fraudulent</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={saveConfig}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Configuration
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Runner Tab */}
        <TabsContent value="runner" className="space-y-6">
          {currentRun ? (
            <>
              {/* Progress Card */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      {isRunning ? (
                        <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />
                      ) : currentRun.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                      {currentRun.progress.phase}
                    </CardTitle>
                    <Badge className={getStatusColor(currentRun.status)}>
                      {currentRun.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-400">
                    {currentRun.progress.message}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={currentRun.progress.percentage} className="h-3" />
                  <p className="text-sm text-gray-500 mt-2">
                    Step {currentRun.progress.currentStep} of {currentRun.progress.totalSteps} ({currentRun.progress.percentage}%)
                  </p>
                </CardContent>
              </Card>

              {/* Live Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase">Total Requests</p>
                    <p className="text-2xl font-bold text-white">{currentRun.metrics.totalRequests.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase">Success Rate</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {currentRun.metrics.totalRequests > 0 
                        ? ((currentRun.metrics.successfulRequests / currentRun.metrics.totalRequests) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase">Avg Response</p>
                    <p className="text-2xl font-bold text-blue-400">{currentRun.metrics.avgResponseTime.toFixed(0)}ms</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase">Requests/sec</p>
                    <p className="text-2xl font-bold text-amber-400">{currentRun.metrics.requestsPerSecond.toFixed(1)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Test Cases Progress */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Test Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {currentRun.testCases.map((tc) => (
                        <div
                          key={tc.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            tc.status === 'running' ? "bg-blue-500/10 border-blue-500/30" :
                            tc.status === 'passed' ? "bg-emerald-500/5 border-gray-700" :
                            tc.status === 'failed' ? "bg-red-500/5 border-gray-700" :
                            "bg-gray-800/30 border-gray-700"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(tc.status)}
                            <div>
                              <p className="text-white font-medium">{tc.name}</p>
                              <p className="text-xs text-gray-500">{tc.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">
                              {tc.successCount}/{tc.iterations} passed
                            </p>
                            {tc.metrics?.avgResponseTime && (
                              <p className="text-xs text-gray-500">{tc.metrics.avgResponseTime.toFixed(0)}ms avg</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">No simulation running</p>
                <p className="text-sm text-gray-500 mt-2">Configure and start a simulation to see live progress</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {currentRun && currentRun.status === 'completed' ? (
            <>
              {/* Quick Navigation */}
              <div className="flex flex-wrap gap-2 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                <Button variant="outline" size="sm" onClick={() => document.getElementById('section-overview')?.scrollIntoView({ behavior: 'smooth' })}>
                  📊 Overview
                </Button>
                <Button variant="outline" size="sm" onClick={() => document.getElementById('section-ai')?.scrollIntoView({ behavior: 'smooth' })}>
                  🤖 AI Analysis
                </Button>
                <Button variant="outline" size="sm" onClick={() => document.getElementById('section-charts')?.scrollIntoView({ behavior: 'smooth' })}>
                  📈 Charts
                </Button>
                <Button variant="outline" size="sm" onClick={() => document.getElementById('section-tests')?.scrollIntoView({ behavior: 'smooth' })}>
                  🧪 Test Results
                </Button>
                <Button variant="outline" size="sm" onClick={() => document.getElementById('section-hardware')?.scrollIntoView({ behavior: 'smooth' })}>
                  🖥️ Hardware
                </Button>
              </div>

              {/* SECTION: Overview Dashboard */}
              <div id="section-overview">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  📊 Performance Overview
                </h3>
                
                {/* Key Metrics - Large Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {/* Success Rate Gauge */}
                  <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30">
                    <CardContent className="p-4 text-center">
                      <div className="relative w-24 h-24 mx-auto mb-2">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle cx="48" cy="48" r="40" stroke="#374151" strokeWidth="8" fill="none" />
                          <circle 
                            cx="48" cy="48" r="40" 
                            stroke={currentRun.metrics.totalRequests > 0 
                              ? (currentRun.metrics.successfulRequests / currentRun.metrics.totalRequests) >= 0.95 
                                ? "#10b981" 
                                : (currentRun.metrics.successfulRequests / currentRun.metrics.totalRequests) >= 0.80 
                                  ? "#f59e0b" 
                                  : "#ef4444"
                              : "#6b7280"
                            }
                            strokeWidth="8" 
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${(currentRun.metrics.totalRequests > 0 ? (currentRun.metrics.successfulRequests / currentRun.metrics.totalRequests) : 0) * 251.2} 251.2`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white">
                            {currentRun.metrics.totalRequests > 0 
                              ? Math.round((currentRun.metrics.successfulRequests / currentRun.metrics.totalRequests) * 100) 
                              : 0}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">Success Rate</p>
                    </CardContent>
                  </Card>

                  {/* Throughput */}
                  <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
                    <CardContent className="p-4 text-center">
                      <Zap className="h-8 w-8 mx-auto text-blue-400 mb-2" />
                      <p className="text-3xl font-bold text-blue-400">{currentRun.metrics.requestsPerSecond.toFixed(1)}</p>
                      <p className="text-sm text-gray-400">Requests/sec</p>
                      <p className="text-xs text-gray-500 mt-1">{currentRun.metrics.totalRequests.toLocaleString()} total</p>
                    </CardContent>
                  </Card>

                  {/* Response Time */}
                  <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                    <CardContent className="p-4 text-center">
                      <Clock className="h-8 w-8 mx-auto text-amber-400 mb-2" />
                      <p className={cn(
                        "text-3xl font-bold",
                        currentRun.metrics.avgResponseTime < 500 ? "text-emerald-400" : 
                        currentRun.metrics.avgResponseTime < 1000 ? "text-amber-400" : "text-red-400"
                      )}>
                        {currentRun.metrics.avgResponseTime.toFixed(0)}ms
                      </p>
                      <p className="text-sm text-gray-400">Avg Response</p>
                      <p className="text-xs text-gray-500 mt-1">P99: {currentRun.metrics.p99ResponseTime.toFixed(0)}ms</p>
                    </CardContent>
                  </Card>

                  {/* Duration */}
                  <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
                    <CardContent className="p-4 text-center">
                      <Activity className="h-8 w-8 mx-auto text-purple-400 mb-2" />
                      <p className="text-3xl font-bold text-purple-400">
                        {currentRun.duration ? Math.round(currentRun.duration / 1000) : 0}s
                      </p>
                      <p className="text-sm text-gray-400">Total Duration</p>
                      <p className="text-xs text-gray-500 mt-1">Error: {currentRun.metrics.errorRate.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Entity Counts - Horizontal Bar */}
                <Card className="bg-gray-800/50 border-gray-700 mb-6">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap justify-around gap-4">
                      <div className="text-center min-w-[80px]">
                        <Users className="h-6 w-6 mx-auto text-blue-400" />
                        <p className="text-2xl font-bold text-white">{currentRun.metrics.usersCreated}</p>
                        <p className="text-xs text-gray-500">Users</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <Trophy className="h-6 w-6 mx-auto text-amber-400" />
                        <p className="text-2xl font-bold text-white">{currentRun.metrics.competitionsCreated}</p>
                        <p className="text-xs text-gray-500">Competitions</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <Target className="h-6 w-6 mx-auto text-purple-400" />
                        <p className="text-2xl font-bold text-white">{currentRun.metrics.challengesCreated}</p>
                        <p className="text-xs text-gray-500">Challenges</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <TrendingUp className="h-6 w-6 mx-auto text-emerald-400" />
                        <p className="text-2xl font-bold text-white">{currentRun.metrics.tradesExecuted}</p>
                        <p className="text-xs text-gray-500">Trades</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <Wallet className="h-6 w-6 mx-auto text-cyan-400" />
                        <p className="text-2xl font-bold text-white">{currentRun.metrics.depositsProcessed || 0}</p>
                        <p className="text-xs text-gray-500">Deposits</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION: AI Analysis */}
              <div id="section-ai">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🤖 AI Analysis
                  {!currentRun.aiAnalysis && (
                    <Button
                      size="sm"
                      onClick={() => runAIAnalysis(currentRun._id)}
                      className="ml-auto bg-purple-600 hover:bg-purple-700"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate Report
                    </Button>
                  )}
                </h3>

                {currentRun.aiAnalysis && currentRun.aiAnalysis.performanceScore !== undefined ? (
                  <div className="space-y-6">
                    {/* Top Row: Score, Grade, Production Readiness */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Score Card */}
                      <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30">
                        <CardContent className="p-6 text-center">
                          <div className="relative w-28 h-28 mx-auto mb-3">
                            <svg className="w-28 h-28 transform -rotate-90">
                              <circle cx="56" cy="56" r="48" stroke="#374151" strokeWidth="10" fill="none" />
                              <circle 
                                cx="56" cy="56" r="48" 
                                stroke={
                                  currentRun.aiAnalysis.performanceScore >= 80 ? "#10b981" : 
                                  currentRun.aiAnalysis.performanceScore >= 60 ? "#f59e0b" : "#ef4444"
                                }
                                strokeWidth="10" 
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={`${(currentRun.aiAnalysis.performanceScore / 100) * 301.59} 301.59`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-bold text-white">{currentRun.aiAnalysis.performanceScore}</span>
                              <span className="text-xs text-gray-400">/100</span>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-gray-400">Performance Score</p>
                        </CardContent>
                      </Card>

                      {/* Grade & Readiness Card */}
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-6 text-center space-y-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Overall Grade</p>
                            <Badge className={cn(
                              "text-2xl px-4 py-1",
                              currentRun.aiAnalysis.overallGrade === 'A' && "bg-emerald-500/20 text-emerald-300",
                              currentRun.aiAnalysis.overallGrade === 'B' && "bg-green-500/20 text-green-300",
                              currentRun.aiAnalysis.overallGrade === 'C' && "bg-amber-500/20 text-amber-300",
                              currentRun.aiAnalysis.overallGrade === 'D' && "bg-orange-500/20 text-orange-300",
                              currentRun.aiAnalysis.overallGrade === 'F' && "bg-red-500/20 text-red-300"
                            )}>
                              {currentRun.aiAnalysis.overallGrade || (currentRun.aiAnalysis.performanceScore >= 90 ? 'A' : currentRun.aiAnalysis.performanceScore >= 80 ? 'B' : currentRun.aiAnalysis.performanceScore >= 70 ? 'C' : currentRun.aiAnalysis.performanceScore >= 60 ? 'D' : 'F')}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase mb-1">Production Ready</p>
                            <Badge className={cn(
                              "text-sm",
                              currentRun.aiAnalysis.productionReadiness === 'ready' && "bg-emerald-500/20 text-emerald-300",
                              currentRun.aiAnalysis.productionReadiness === 'needs_work' && "bg-amber-500/20 text-amber-300",
                              currentRun.aiAnalysis.productionReadiness === 'not_ready' && "bg-red-500/20 text-red-300"
                            )}>
                              {currentRun.aiAnalysis.productionReadiness === 'ready' ? '✓ Ready' : 
                               currentRun.aiAnalysis.productionReadiness === 'needs_work' ? '⚠ Needs Work' : '✗ Not Ready'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Scalability Card */}
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4 space-y-2">
                          <p className="text-xs text-gray-500 uppercase font-medium">Scalability</p>
                          {currentRun.aiAnalysis.scalabilityAssessment ? (
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-gray-400">Capacity:</span>
                                <p className="text-white font-medium">{currentRun.aiAnalysis.scalabilityAssessment.currentCapacity}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Limiting Factor:</span>
                                <p className="text-amber-400 text-xs">{currentRun.aiAnalysis.scalabilityAssessment.limitingFactor}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-400 text-sm">Run AI analysis for scalability info</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Summary */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-2">📋 Executive Summary</p>
                        <p className="text-gray-300 text-sm leading-relaxed">{currentRun.aiAnalysis.summary}</p>
                      </CardContent>
                    </Card>

                    {/* Response Time & Resource Utilization */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Response Time Analysis */}
                      {currentRun.aiAnalysis.responseTimeAnalysis && (
                        <Card className="bg-gray-800/50 border-gray-700">
                          <CardContent className="p-4">
                            <p className="text-xs text-gray-500 uppercase font-medium mb-3">⚡ Response Time Analysis</p>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Assessment:</span>
                                <Badge className={cn(
                                  currentRun.aiAnalysis.responseTimeAnalysis.assessment === 'excellent' && "bg-emerald-500/20 text-emerald-300",
                                  currentRun.aiAnalysis.responseTimeAnalysis.assessment === 'good' && "bg-green-500/20 text-green-300",
                                  currentRun.aiAnalysis.responseTimeAnalysis.assessment === 'acceptable' && "bg-amber-500/20 text-amber-300",
                                  currentRun.aiAnalysis.responseTimeAnalysis.assessment === 'concerning' && "bg-red-500/20 text-red-300"
                                )}>
                                  {currentRun.aiAnalysis.responseTimeAnalysis.assessment?.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-400">{currentRun.aiAnalysis.responseTimeAnalysis.p95Analysis}</p>
                              <p className="text-xs text-gray-400">{currentRun.aiAnalysis.responseTimeAnalysis.p99Analysis}</p>
                              {currentRun.aiAnalysis.responseTimeAnalysis.outlierConcerns && (
                                <p className="text-xs text-amber-400">{currentRun.aiAnalysis.responseTimeAnalysis.outlierConcerns}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Resource Utilization */}
                      {currentRun.aiAnalysis.resourceUtilization && (
                        <Card className="bg-gray-800/50 border-gray-700">
                          <CardContent className="p-4">
                            <p className="text-xs text-gray-500 uppercase font-medium mb-3">💻 Resource Utilization</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">CPU:</span>
                                <span className="text-white">{currentRun.aiAnalysis.resourceUtilization.cpuAssessment}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Memory:</span>
                                <span className="text-white">{currentRun.aiAnalysis.resourceUtilization.memoryAssessment}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Database:</span>
                                <span className="text-white text-xs">{currentRun.aiAnalysis.resourceUtilization.databaseAssessment}</span>
                              </div>
                              <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                                <span className="text-gray-400">Headroom:</span>
                                <span className="text-cyan-400 text-xs">{currentRun.aiAnalysis.resourceUtilization.headroom}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Findings */}
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <p className="text-xs text-gray-500 uppercase font-medium mb-3">🔍 Key Findings</p>
                        <ScrollArea className="h-[200px]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {currentRun.aiAnalysis.findings?.map((finding, i) => (
                              <div key={i} className={cn(
                                "p-3 rounded-lg border text-sm",
                                finding.type === 'success' && "bg-emerald-500/10 border-emerald-500/30",
                                finding.type === 'warning' && "bg-amber-500/10 border-amber-500/30",
                                finding.type === 'error' && "bg-red-500/10 border-red-500/30",
                                finding.type === 'info' && "bg-blue-500/10 border-blue-500/30"
                              )}>
                                <div className="flex items-start gap-2">
                                  {finding.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
                                  {finding.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
                                  {finding.type === 'error' && <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                                  {finding.type === 'info' && <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-medium text-white truncate">{finding.title}</p>
                                      {finding.priority && (
                                        <Badge className={cn(
                                          "text-[10px] shrink-0",
                                          finding.priority === 'high' && "bg-red-500/20 text-red-300",
                                          finding.priority === 'medium' && "bg-amber-500/20 text-amber-300",
                                          finding.priority === 'low' && "bg-gray-500/20 text-gray-300"
                                        )}>
                                          {finding.priority}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{finding.description}</p>
                                    {finding.impact && <p className="text-xs text-cyan-400 mt-1">Impact: {finding.impact}</p>}
                                    {finding.recommendation && <p className="text-xs text-emerald-400 mt-1">→ {finding.recommendation}</p>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Bottlenecks & Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Bottlenecks */}
                      {currentRun.aiAnalysis.bottlenecks?.length > 0 && (
                        <Card className="bg-red-500/5 border-red-500/30">
                          <CardContent className="p-4">
                            <p className="text-xs text-red-400 uppercase font-medium mb-3">⚠️ Bottlenecks Detected</p>
                            <div className="space-y-3">
                              {currentRun.aiAnalysis.bottlenecks.map((b, i) => (
                                <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge className={cn(
                                      "text-xs",
                                      b.severity === 'critical' && "bg-red-500/20 text-red-300",
                                      b.severity === 'high' && "bg-orange-500/20 text-orange-300",
                                      b.severity === 'medium' && "bg-amber-500/20 text-amber-300",
                                      b.severity === 'low' && "bg-yellow-500/20 text-yellow-300"
                                    )}>
                                      {b.component} - {b.severity?.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-300">{b.description}</p>
                                  {b.evidence && <p className="text-xs text-gray-500 mt-1">Evidence: {b.evidence}</p>}
                                  {b.suggestedFix && <p className="text-xs text-emerald-400 mt-2">Fix: {b.suggestedFix}</p>}
                                  {b.estimatedEffort && <p className="text-xs text-gray-500">Effort: {b.estimatedEffort}</p>}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Recommendations */}
                      {currentRun.aiAnalysis.recommendations?.length > 0 && (
                        <Card className="bg-emerald-500/5 border-emerald-500/30">
                          <CardContent className="p-4">
                            <p className="text-xs text-emerald-400 uppercase font-medium mb-3">💡 Recommendations</p>
                            <div className="space-y-2">
                              {currentRun.aiAnalysis.recommendations.slice(0, 6).map((rec, i) => (
                                <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                                  {typeof rec === 'string' ? (
                                    <p className="text-sm text-gray-300 flex items-start gap-2">
                                      <span className="text-cyan-400 shrink-0">→</span>
                                      {rec}
                                    </p>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium text-white">{rec.title}</p>
                                        <div className="flex gap-1">
                                          <Badge className={cn(
                                            "text-[10px]",
                                            rec.priority === 'critical' && "bg-red-500/20 text-red-300",
                                            rec.priority === 'high' && "bg-orange-500/20 text-orange-300",
                                            rec.priority === 'medium' && "bg-amber-500/20 text-amber-300",
                                            rec.priority === 'low' && "bg-gray-500/20 text-gray-300"
                                          )}>
                                            {rec.priority}
                                          </Badge>
                                          <Badge className="text-[10px] bg-gray-500/20 text-gray-300">
                                            {rec.effort}
                                          </Badge>
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-400">{rec.description}</p>
                                      {rec.impact && <p className="text-xs text-cyan-400 mt-1">Impact: {rec.impact}</p>}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {/* Risk Assessment & Next Steps */}
                    {(currentRun.aiAnalysis.riskAssessment || currentRun.aiAnalysis.nextSteps) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Risk Assessment */}
                        {currentRun.aiAnalysis.riskAssessment && currentRun.aiAnalysis.riskAssessment.productionRisks?.length > 0 && (
                          <Card className="bg-orange-500/5 border-orange-500/30">
                            <CardContent className="p-4">
                              <p className="text-xs text-orange-400 uppercase font-medium mb-3">⚡ Risk Assessment</p>
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500 uppercase">Production Risks:</p>
                                <ul className="space-y-1">
                                  {currentRun.aiAnalysis.riskAssessment.productionRisks.map((risk, i) => (
                                    <li key={i} className="text-xs text-red-400 flex items-start gap-1">
                                      <span>⚠</span> {risk}
                                    </li>
                                  ))}
                                </ul>
                                {currentRun.aiAnalysis.riskAssessment.mitigations?.length > 0 && (
                                  <>
                                    <p className="text-xs text-gray-500 uppercase mt-3">Mitigations:</p>
                                    <ul className="space-y-1">
                                      {currentRun.aiAnalysis.riskAssessment.mitigations.map((m, i) => (
                                        <li key={i} className="text-xs text-emerald-400 flex items-start gap-1">
                                          <span>✓</span> {m}
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Next Steps */}
                        {currentRun.aiAnalysis.nextSteps?.length > 0 && (
                          <Card className="bg-blue-500/5 border-blue-500/30">
                            <CardContent className="p-4">
                              <p className="text-xs text-blue-400 uppercase font-medium mb-3">📝 Next Steps</p>
                              <ol className="space-y-2">
                                {currentRun.aiAnalysis.nextSteps.map((step, i) => (
                                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span className="text-blue-400 font-medium shrink-0">{i + 1}.</span>
                                    {step.replace(/^\d+\.\s*/, '')}
                                  </li>
                                ))}
                              </ol>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="py-8 text-center">
                      <Brain className="h-12 w-12 mx-auto text-gray-600 mb-4 animate-pulse" />
                      <p className="text-gray-400">AI Analysis not generated yet</p>
                      <p className="text-sm text-gray-500 mt-1">Click "Generate Report" to get AI-powered insights</p>
                      <Button
                        onClick={() => runAIAnalysis(currentRun._id)}
                        className="mt-4 bg-purple-600 hover:bg-purple-700"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate AI Report
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* SECTION: Charts */}
              <div id="section-charts">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  📈 Performance Charts
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Response Time Distribution */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Response Times</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Avg', value: currentRun.metrics.avgResponseTime },
                          { name: 'P95', value: currentRun.metrics.p95ResponseTime },
                          { name: 'P99', value: currentRun.metrics.p99ResponseTime },
                          { name: 'Max', value: currentRun.metrics.maxResponseTime },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" stroke="#9ca3af" />
                          <YAxis stroke="#9ca3af" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                            formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Time']}
                          />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Success/Failure Pie */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Request Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Success', value: currentRun.metrics.successfulRequests },
                              { name: 'Failed', value: currentRun.metrics.failedRequests },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

                {/* Response Time Distribution Chart */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm">Response Time Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {[
                        { label: 'Min', value: currentRun.metrics.minResponseTime === Infinity ? 0 : currentRun.metrics.minResponseTime, color: 'text-emerald-400' },
                        { label: 'Avg', value: currentRun.metrics.avgResponseTime, color: 'text-blue-400' },
                        { label: 'P95', value: currentRun.metrics.p95ResponseTime, color: 'text-amber-400' },
                        { label: 'P99', value: currentRun.metrics.p99ResponseTime, color: 'text-orange-400' },
                        { label: 'Max', value: currentRun.metrics.maxResponseTime, color: 'text-red-400' },
                      ].map(item => (
                        <div key={item.label} className="p-2 bg-gray-700/30 rounded">
                          <p className="text-xs text-gray-500">{item.label}</p>
                          <p className={cn("text-sm font-bold", item.color)}>{item.value.toFixed(0)}ms</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Hardware Metrics Chart */}
                {currentRun.hardwareMetrics.length > 0 && (
                  <Card className="bg-gray-800/50 border-gray-700 lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-white text-sm">System Resources Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={currentRun.hardwareMetrics.map((m, i) => ({
                            time: i,
                            cpu: m.cpu.usage,
                            memory: m.memory.percentage,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#9ca3af" domain={[0, 100]} tick={{ fontSize: 10 }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', fontSize: 12 }}
                              formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                            />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Area type="monotone" dataKey="cpu" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="CPU" />
                            <Area type="monotone" dataKey="memory" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Memory" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* SECTION: Hardware */}
              <div id="section-hardware">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🖥️ Hardware & Infrastructure
                </h3>
                
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
                        <Cpu className="h-8 w-8 mx-auto text-red-400 mb-2" />
                        <p className={cn(
                          "text-2xl font-bold",
                          currentRun.peakMetrics.maxCpuUsage > 90 ? "text-red-400" : 
                          currentRun.peakMetrics.maxCpuUsage > 70 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {currentRun.peakMetrics.maxCpuUsage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400">Peak CPU</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
                        <MemoryStick className="h-8 w-8 mx-auto text-blue-400 mb-2" />
                        <p className={cn(
                          "text-2xl font-bold",
                          currentRun.peakMetrics.maxMemoryUsage > 90 ? "text-red-400" : 
                          currentRun.peakMetrics.maxMemoryUsage > 70 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {currentRun.peakMetrics.maxMemoryUsage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-400">Peak Memory</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                        <Database className="h-8 w-8 mx-auto text-purple-400 mb-2" />
                        <p className="text-2xl font-bold text-purple-400">
                          {currentRun.peakMetrics.maxDbConnections || 0}
                        </p>
                        <p className="text-xs text-gray-400">DB Connections</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-lg border border-cyan-500/20">
                        <Timer className="h-8 w-8 mx-auto text-cyan-400 mb-2" />
                        <p className="text-2xl font-bold text-cyan-400">
                          {(currentRun.peakMetrics.maxQueryTime || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">DB Operations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION: Test Results */}
              <div id="section-tests">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🧪 Test Results by Category
                </h3>
                
                {/* Test Categories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from(new Set(currentRun.testCases.map(tc => tc.category))).map(category => {
                    const categoryTests = currentRun.testCases.filter(tc => tc.category === category);
                    const passedCount = categoryTests.filter(tc => tc.status === 'passed').length;
                    const totalCount = categoryTests.length;
                    const successRate = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;
                    
                    return (
                      <Card key={category} className={cn(
                        "bg-gray-800/50 border-l-4",
                        successRate >= 90 ? "border-l-emerald-500" :
                        successRate >= 70 ? "border-l-amber-500" : "border-l-red-500"
                      )}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-white text-sm">{category}</CardTitle>
                            <Badge className={cn(
                              successRate >= 90 ? "bg-emerald-500/20 text-emerald-300" :
                              successRate >= 70 ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"
                            )}>
                              {passedCount}/{totalCount}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {categoryTests.map(tc => (
                            <div key={tc.id} className={cn(
                              "flex items-center justify-between p-2 rounded text-xs",
                              tc.status === 'passed' && "bg-emerald-500/10",
                              tc.status === 'failed' && "bg-red-500/10",
                              tc.status === 'skipped' && "bg-gray-500/10",
                              tc.status === 'running' && "bg-blue-500/10",
                              tc.status === 'pending' && "bg-amber-500/10"
                            )}>
                              <div className="flex items-center gap-2">
                                {tc.status === 'passed' && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                                {tc.status === 'failed' && <XCircle className="h-3 w-3 text-red-400" />}
                                {tc.status === 'skipped' && <AlertCircle className="h-3 w-3 text-gray-400" />}
                                {tc.status === 'running' && <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />}
                                {tc.status === 'pending' && <Clock className="h-3 w-3 text-amber-400" />}
                                <span className="text-gray-300 truncate max-w-[150px]">{tc.name}</span>
                              </div>
                              <div className="text-gray-500">
                                {tc.iterations > 0 && `${tc.successCount}/${tc.iterations}`}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Detailed Test Table - Collapsible */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-400 hover:text-white p-2 bg-gray-800/30 rounded">
                    📋 View Detailed Test Metrics Table
                  </summary>
                  <Card className="bg-gray-800/50 border-gray-700 mt-2">
                    <CardContent className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-2 px-2 text-gray-400">Test</th>
                              <th className="text-center py-2 px-2 text-gray-400">Status</th>
                              <th className="text-center py-2 px-2 text-gray-400">Pass Rate</th>
                              <th className="text-center py-2 px-2 text-gray-400">Avg</th>
                              <th className="text-center py-2 px-2 text-gray-400">P95</th>
                              <th className="text-center py-2 px-2 text-gray-400">Errors</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentRun.testCases.map((tc, i) => (
                              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                <td className="py-2 px-2">
                                  <span className="text-white">{tc.name}</span>
                                </td>
                                <td className="text-center py-2 px-2">
                                  <Badge className={cn(
                                    "text-[10px]",
                                    tc.status === 'passed' && "bg-emerald-500/20 text-emerald-300",
                                    tc.status === 'failed' && "bg-red-500/20 text-red-300",
                                    tc.status === 'skipped' && "bg-gray-500/20 text-gray-300"
                                  )}>
                                    {tc.status}
                                  </Badge>
                                </td>
                                <td className="text-center py-2 px-2 text-white">
                                  {tc.iterations > 0 ? ((tc.successCount / tc.iterations) * 100).toFixed(0) : 0}%
                                </td>
                                <td className="text-center py-2 px-2 text-blue-400">
                                  {tc.metrics?.avgResponseTime?.toFixed(0) || '-'}ms
                                </td>
                                <td className="text-center py-2 px-2 text-amber-400">
                                  {tc.metrics?.p95ResponseTime?.toFixed(0) || '-'}ms
                                </td>
                                <td className="text-center py-2 px-2 text-red-400">
                                  {tc.metrics?.errorRate?.toFixed(1) || 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </details>
              </div>
            </>
          ) : (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">No completed simulation results</p>
                <p className="text-sm text-gray-500 mt-2">Run a simulation to see detailed results and AI analysis</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-6">
          {currentRun ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Test Checklist
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {currentRun.testCases.filter(tc => tc.status === 'passed').length} / {currentRun.testCases.length} tests passed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {/* Group by category */}
                  {Array.from(new Set(currentRun.testCases.map(tc => tc.category))).map(category => (
                    <div key={category} className="mb-6">
                      <h3 className="text-lg font-semibold text-white mb-3">{category}</h3>
                      <div className="space-y-2">
                        {currentRun.testCases
                          .filter(tc => tc.category === category)
                          .map(tc => (
                            <div
                              key={tc.id}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg border",
                                tc.status === 'passed' && "bg-emerald-500/5 border-emerald-500/30",
                                tc.status === 'failed' && "bg-red-500/5 border-red-500/30",
                                tc.status === 'running' && "bg-blue-500/10 border-blue-500/30",
                                tc.status === 'skipped' && "bg-gray-500/5 border-gray-700",
                                tc.status === 'pending' && "bg-amber-500/5 border-amber-500/30"
                              )}
                            >
                              <div className="flex items-center gap-4">
                                {getStatusIcon(tc.status)}
                                <div>
                                  <p className="text-white font-medium">{tc.name}</p>
                                  <p className="text-sm text-gray-500">{tc.description}</p>
                                  {tc.errorMessage && (
                                    <p className="text-sm text-red-400 mt-1">❌ {tc.errorMessage}</p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={getStatusColor(tc.status)}>
                                  {tc.status}
                                </Badge>
                                {tc.iterations > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {tc.successCount}/{tc.iterations} ({((tc.successCount / tc.iterations) * 100).toFixed(0)}%)
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">No test results to display</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Simulation History</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchRuns}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {runs.length > 0 ? (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <div
                      key={run._id}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-800/30 border border-gray-700 hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(run.status)}
                        <div>
                          <p className="text-white font-medium">
                            {new Date(run.createdAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {run.metrics.totalRequests.toLocaleString()} requests • {run.metrics.usersCreated} users • {run.metrics.tradesExecuted} trades
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(run.status)}>
                          {run.status}
                        </Badge>
                        {run.aiAnalysis && (
                          <Badge className="bg-purple-500/20 text-purple-300">
                            AI: {run.aiAnalysis.performanceScore}/100
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentRun(run as SimulatorRun);
                            setActiveTab('results');
                          }}
                        >
                          View
                        </Button>
                        {!run.aiAnalysis && run.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runAIAnalysis(run._id)}
                          >
                            <Brain className="h-4 w-4" />
                          </Button>
                        )}
                        {!run.cleanedUp && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cleanupTestData(run._id)}
                            className="text-amber-400 hover:text-amber-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">No simulation history</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

