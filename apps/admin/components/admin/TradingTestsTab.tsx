'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calculator,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Test case definition
interface TradingTestCase {
  id: string;
  category: 'open' | 'pnl' | 'margin' | 'roundtrip';
  name: string;
  description: string;
  scenario: string;
  expectedResult: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  result?: {
    passed: boolean;
    message: string;
    actualOutcome?: string;
    details?: Record<string, unknown>;
  };
}

// All trading test cases
const TEST_CASES: TradingTestCase[] = [
  // ============ OPEN POSITION TESTS ============
  {
    id: 'T-O1',
    category: 'open',
    name: 'Open Long 0.01 Lot',
    description: 'Minimum lot size long position (EUR/USD)',
    scenario: '0.01 lot @ 1.10000 with 100:1 leverage',
    expectedResult: 'Margin: $11.00, Position opened',
    status: 'pending',
  },
  {
    id: 'T-O2',
    category: 'open',
    name: 'Open Long 0.1 Lot',
    description: 'Mini lot long position (EUR/USD)',
    scenario: '0.1 lot @ 1.10000 with 100:1 leverage',
    expectedResult: 'Margin: $110.00, Position opened',
    status: 'pending',
  },
  {
    id: 'T-O3',
    category: 'open',
    name: 'Open Long 1.0 Lot',
    description: 'Standard lot long position (EUR/USD)',
    scenario: '1.0 lot @ 1.10000 with 100:1 leverage',
    expectedResult: 'Margin: $1100.00, Position opened',
    status: 'pending',
  },
  {
    id: 'T-O4',
    category: 'open',
    name: 'Open Short 0.5 Lot',
    description: 'Short position with GBP/USD',
    scenario: '0.5 lot GBP/USD @ 1.26500 with 100:1',
    expectedResult: 'Margin: $632.50, Position opened',
    status: 'pending',
  },
  {
    id: 'T-O5',
    category: 'open',
    name: 'Open with 50:1 Leverage',
    description: 'Lower leverage increases margin',
    scenario: '0.1 lot @ 1.10000 with 50:1 leverage',
    expectedResult: 'Margin: $220.00 (2x vs 100:1)',
    status: 'pending',
  },

  // ============ PNL CALCULATION TESTS ============
  {
    id: 'T-P1',
    category: 'pnl',
    name: 'Long +50 Pips Profit',
    description: 'Long position gains 50 pips',
    scenario: 'Long 1.0 lot: 1.10000 → 1.10500',
    expectedResult: 'PNL: +$500.00',
    status: 'pending',
  },
  {
    id: 'T-P2',
    category: 'pnl',
    name: 'Long -30 Pips Loss',
    description: 'Long position loses 30 pips',
    scenario: 'Long 1.0 lot: 1.10000 → 1.09700',
    expectedResult: 'PNL: -$300.00',
    status: 'pending',
  },
  {
    id: 'T-P3',
    category: 'pnl',
    name: 'Short +40 Pips Profit',
    description: 'Short profits when price drops',
    scenario: 'Short 1.0 lot: 1.10000 → 1.09600',
    expectedResult: 'PNL: +$400.00',
    status: 'pending',
  },
  {
    id: 'T-P4',
    category: 'pnl',
    name: 'Short -20 Pips Loss',
    description: 'Short loses when price rises',
    scenario: 'Short 1.0 lot: 1.10000 → 1.10200',
    expectedResult: 'PNL: -$200.00',
    status: 'pending',
  },
  {
    id: 'T-P5',
    category: 'pnl',
    name: 'Mini Lot PNL (0.1)',
    description: 'PNL scales with lot size',
    scenario: 'Long 0.1 lot: 1.10000 → 1.10500 (+50 pips)',
    expectedResult: 'PNL: +$50.00 (1/10 of standard)',
    status: 'pending',
  },
  {
    id: 'T-P6',
    category: 'pnl',
    name: 'Micro Lot PNL (0.01)',
    description: 'Smallest lot size PNL',
    scenario: 'Long 0.01 lot: 1.10000 → 1.10500 (+50 pips)',
    expectedResult: 'PNL: +$5.00 (1/100 of standard)',
    status: 'pending',
  },
  {
    id: 'T-P7',
    category: 'pnl',
    name: 'JPY Pair PNL',
    description: 'Different pip size (0.01)',
    scenario: 'Long 1.0 lot USD/JPY: 145.00 → 145.50',
    expectedResult: 'PNL: +$50000 JPY (raw calc)',
    status: 'pending',
  },

  // ============ MARGIN TESTS ============
  {
    id: 'T-M1',
    category: 'margin',
    name: 'Margin 100:1 Leverage',
    description: 'Standard leverage margin calc',
    scenario: '1.0 lot EUR/USD @ 1.10000, 100:1',
    expectedResult: 'Margin: $1100.00',
    status: 'pending',
  },
  {
    id: 'T-M2',
    category: 'margin',
    name: 'Margin 50:1 Leverage',
    description: 'Lower leverage = higher margin',
    scenario: '1.0 lot EUR/USD @ 1.10000, 50:1',
    expectedResult: 'Margin: $2200.00',
    status: 'pending',
  },
  {
    id: 'T-M3',
    category: 'margin',
    name: 'Margin 200:1 Leverage',
    description: 'Higher leverage = lower margin',
    scenario: '1.0 lot EUR/USD @ 1.10000, 200:1',
    expectedResult: 'Margin: $550.00',
    status: 'pending',
  },

  // ============ ROUND-TRIP TESTS ============
  {
    id: 'T-RT1',
    category: 'roundtrip',
    name: 'Full Round-Trip Profit',
    description: 'Open → Close with profit',
    scenario: 'Long 0.1 lot: 1.10000 → 1.10500 (+50 pips)',
    expectedResult: 'PNL: +$50, Final: $10050, Margin released',
    status: 'pending',
  },
  {
    id: 'T-RT2',
    category: 'roundtrip',
    name: 'Full Round-Trip Loss',
    description: 'Open → Close with loss',
    scenario: 'Long 0.1 lot: 1.10000 → 1.09500 (-50 pips)',
    expectedResult: 'PNL: -$50, Final: $9950, Margin released',
    status: 'pending',
  },
  {
    id: 'T-RT3',
    category: 'roundtrip',
    name: 'Short Round-Trip Profit',
    description: 'Short position profit test',
    scenario: 'Short 0.1 lot: 1.10000 → 1.09500',
    expectedResult: 'PNL: +$50, Final: $10050',
    status: 'pending',
  },
  {
    id: 'T-RT4',
    category: 'roundtrip',
    name: 'Short Round-Trip Loss',
    description: 'Short position loss test',
    scenario: 'Short 0.1 lot: 1.10000 → 1.10500',
    expectedResult: 'PNL: -$50, Final: $9950',
    status: 'pending',
  },
  {
    id: 'T-RT5',
    category: 'roundtrip',
    name: 'Large Lot Round-Trip',
    description: 'Standard lot with significant PNL',
    scenario: 'Long 1.0 lot: 1.10000 → 1.10100 (+10 pips)',
    expectedResult: 'PNL: +$100, Final: $10100',
    status: 'pending',
  },
  {
    id: 'T-RT6',
    category: 'roundtrip',
    name: 'GBP/USD Round-Trip',
    description: 'Different currency pair test',
    scenario: 'Long 0.1 lot GBP/USD: 1.26500 → 1.26800',
    expectedResult: 'PNL: +$30, Final: $10030',
    status: 'pending',
  },
];

// Category info
const CATEGORIES = [
  { id: 'open', name: '📂 Open Position', icon: TrendingUp, color: 'text-green-400' },
  { id: 'pnl', name: '📊 PNL Calculation', icon: Calculator, color: 'text-blue-400' },
  { id: 'margin', name: '💰 Margin', icon: DollarSign, color: 'text-yellow-400' },
  { id: 'roundtrip', name: '🔄 Round-Trip', icon: ArrowRightLeft, color: 'text-purple-400' },
];

export default function TradingTestsTab() {
  const [testCases, setTestCases] = useState<TradingTestCase[]>(TEST_CASES);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [testDataIds, setTestDataIds] = useState<string[]>([]);

  // Run single test
  const runSingleTest = async (testId: string) => {
    const testIndex = testCases.findIndex(t => t.id === testId);
    if (testIndex === -1) return;

    setCurrentTest(testId);
    setTestCases(prev => prev.map(t => 
      t.id === testId ? { ...t, status: 'running' } : t
    ));

    try {
      const response = await fetch('/api/admin/trading-tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId }),
      });

      const data = await response.json();

      if (data.success) {
        setTestCases(prev => prev.map(t => 
          t.id === testId ? { 
            ...t, 
            status: data.result.passed ? 'passed' : 'failed',
            result: data.result,
          } : t
        ));
        
        // Track created test data for cleanup
        if (data.testDataIds) {
          setTestDataIds(prev => [...prev, ...data.testDataIds]);
        }
      } else {
        setTestCases(prev => prev.map(t => 
          t.id === testId ? { 
            ...t, 
            status: 'failed',
            result: { passed: false, message: data.error || 'Test failed' },
          } : t
        ));
      }
    } catch (error) {
      setTestCases(prev => prev.map(t => 
        t.id === testId ? { 
          ...t, 
          status: 'failed',
          result: { passed: false, message: error instanceof Error ? error.message : 'Unknown error' },
        } : t
      ));
    }

    setCurrentTest(null);
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);

    // Reset all tests to pending
    setTestCases(TEST_CASES.map(t => ({ ...t, status: 'pending', result: undefined })));

    const total = testCases.length;
    let completed = 0;

    for (const test of testCases) {
      await runSingleTest(test.id);
      completed++;
      setProgress((completed / total) * 100);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsRunning(false);
    setProgress(100);

    // Show summary
    const passed = testCases.filter(t => t.status === 'passed').length;
    const failed = testCases.filter(t => t.status === 'failed').length;
    
    if (failed === 0) {
      toast.success(`All ${passed} trading tests passed! ✅`);
    } else {
      toast.error(`${failed} of ${total} tests failed`);
    }
  };

  // Run tests by category
  const runCategoryTests = async (category: string) => {
    setIsRunning(true);
    const categoryTests = testCases.filter(t => t.category === category);
    
    let completed = 0;
    for (const test of categoryTests) {
      await runSingleTest(test.id);
      completed++;
      setProgress((completed / categoryTests.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setIsRunning(false);
  };

  // Cleanup test data
  const cleanupTestData = async () => {
    try {
      const response = await fetch('/api/admin/trading-tests/cleanup', {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Cleaned up ${data.deletedCount} test documents`);
        setTestDataIds([]);
      } else {
        toast.error(data.error || 'Cleanup failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cleanup failed');
    }
  };

  // Reset tests
  const resetTests = () => {
    setTestCases(TEST_CASES.map(t => ({ ...t, status: 'pending', result: undefined })));
    setProgress(0);
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'skipped':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-500" />;
    }
  };

  // Calculate stats
  const stats = {
    total: testCases.length,
    passed: testCases.filter(t => t.status === 'passed').length,
    failed: testCases.filter(t => t.status === 'failed').length,
    pending: testCases.filter(t => t.status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-400" />
                Trading Functionality Tests
              </CardTitle>
              <CardDescription className="mt-1">
                Test open/close positions, PNL calculations, and margin requirements
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={runAllTests}
                disabled={isRunning}
                className="bg-green-600 hover:bg-green-700"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run All Tests
              </Button>
              <Button
                onClick={resetTests}
                disabled={isRunning}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={cleanupTestData}
                disabled={isRunning}
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                title="Cleanup all trading test data (including old tests)"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cleanup All Test Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-slate-400">Total</div>
            </div>
            <div className="bg-green-900/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.passed}</div>
              <div className="text-sm text-slate-400">Passed</div>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-sm text-slate-400">Failed</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-400">{stats.pending}</div>
              <div className="text-sm text-slate-400">Pending</div>
            </div>
          </div>
          
          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-slate-400">
                Running: {currentTest || 'Preparing...'} ({Math.round(progress)}%)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map(category => {
          const categoryTests = testCases.filter(t => t.category === category.id);
          const passed = categoryTests.filter(t => t.status === 'passed').length;
          const failed = categoryTests.filter(t => t.status === 'failed').length;
          const Icon = category.icon;
          
          return (
            <Card key={category.id} className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className={cn("text-lg flex items-center gap-2", category.color)}>
                    <Icon className="h-5 w-5" />
                    {category.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                      {passed}/{categoryTests.length}
                    </Badge>
                    {failed > 0 && (
                      <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/50">
                        {failed} failed
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runCategoryTests(category.id)}
                      disabled={isRunning}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {categoryTests.map(test => (
                      <div
                        key={test.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          test.status === 'passed' && "bg-green-500/10",
                          test.status === 'failed' && "bg-red-500/10",
                          test.status === 'running' && "bg-blue-500/10 animate-pulse",
                          test.status === 'pending' && "bg-slate-800/50"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getStatusIcon(test.status)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {test.id}: {test.name}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {test.scenario}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {test.result && (
                            <span className={cn(
                              "text-xs",
                              test.result.passed ? "text-green-400" : "text-red-400"
                            )}>
                              {test.result.actualOutcome || (test.result.passed ? '✓' : '✗')}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runSingleTest(test.id)}
                            disabled={isRunning || test.status === 'running'}
                            className="h-6 w-6 p-0"
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Failed Tests Detail */}
      {stats.failed > 0 && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Failed Tests ({stats.failed})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testCases.filter(t => t.status === 'failed').map(test => (
                <div key={test.id} className="bg-red-950/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{test.id}: {test.name}</div>
                    <Badge variant="outline" className="border-red-500/50">FAILED</Badge>
                  </div>
                  <div className="text-sm text-red-300 mt-1">
                    {test.result?.message}
                  </div>
                  {test.result?.details && (
                    <pre className="text-xs text-slate-400 mt-2 overflow-auto max-h-20">
                      {JSON.stringify(test.result.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formula Reference */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-slate-300 flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Formula Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">📊 PNL Calculation</div>
              <code className="text-xs text-green-400">
                Long: PNL = (Exit - Entry) × Lots × 100,000<br />
                Short: PNL = (Entry - Exit) × Lots × 100,000
              </code>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">💰 Margin Required</div>
              <code className="text-xs text-yellow-400">
                Margin = (Lots × 100,000 × Price) / Leverage
              </code>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">📈 Pip Value (EUR/USD)</div>
              <code className="text-xs text-blue-400">
                0.01 lot = $0.10/pip<br />
                0.1 lot = $1.00/pip<br />
                1.0 lot = $10.00/pip
              </code>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">⚡ Contract Size</div>
              <code className="text-xs text-purple-400">
                Standard lot = 100,000 units<br />
                Mini lot = 10,000 units (0.1)<br />
                Micro lot = 1,000 units (0.01)
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
