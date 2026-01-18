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
  Trophy,
  Swords,
  Loader2,
  RefreshCw,
  Clock,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Test case definition
interface TestCase {
  id: string;
  category: 'competition-early' | 'competition-normal' | 'competition-prize' | 'competition-distribution' | 'competition-journey' | 'competition-ties' | 'competition-edge' | 'challenge-early' | 'challenge-normal' | 'challenge-prize' | 'challenge-ties';
  name: string;
  description: string;
  disqualifyOnLiquidation: boolean;
  scenario: string;
  expectedResult: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  isLegacy?: boolean; // For tests that cover legacy/locked scenarios
  result?: {
    success: boolean;
    message: string;
    prizeDistribution?: {
      winnerId?: string;
      winnerPrize?: number;
      unclaimedPool?: number;
    };
    actualOutcome?: string;
  };
}

// All 26 test cases
const TEST_CASES: TestCase[] = [
  // ============ COMPETITION EARLY END TESTS ============
  {
    id: 'C-E1',
    category: 'competition-early',
    name: 'All Liquidated (Flag ON)',
    description: 'All players liquidated with disqualifyOnLiquidation=true',
    disqualifyOnLiquidation: true,
    scenario: 'All players LIQUIDATED',
    expectedResult: 'End early → All lost → Unclaimed Pools',
    status: 'pending',
  },
  {
    id: 'C-E2',
    category: 'competition-early',
    name: 'All Disqualified (Flag ON)',
    description: 'All players disqualified with disqualifyOnLiquidation=true',
    disqualifyOnLiquidation: true,
    scenario: 'All players DISQUALIFIED',
    expectedResult: 'End early → Unclaimed Pools',
    status: 'pending',
  },
  {
    id: 'C-E3',
    category: 'competition-early',
    name: 'Mix Liquidated+Disqualified (Flag ON)',
    description: 'Some liquidated, some disqualified with disqualifyOnLiquidation=true',
    disqualifyOnLiquidation: true,
    scenario: 'Mix LIQUIDATED + DISQUALIFIED',
    expectedResult: 'End early → All out (liq=disq) → Unclaimed Pools',
    status: 'pending',
  },
  {
    id: 'C-E4',
    category: 'competition-early',
    name: 'All Liquidated (Flag OFF)',
    description: 'All players liquidated with disqualifyOnLiquidation=false',
    disqualifyOnLiquidation: false,
    scenario: 'All players LIQUIDATED',
    expectedResult: 'Continue to end time (liquidated still eligible)',
    status: 'pending',
  },
  {
    id: 'C-E5',
    category: 'competition-early',
    name: 'All Disqualified (Flag OFF)',
    description: 'All players disqualified with disqualifyOnLiquidation=false',
    disqualifyOnLiquidation: false,
    scenario: 'All players DISQUALIFIED',
    expectedResult: 'End early → Prize to Unclaimed Pools',
    status: 'pending',
  },
  {
    id: 'C-E6',
    category: 'competition-early',
    name: 'Mix Liquidated+Disqualified (Flag OFF)',
    description: 'Some liquidated, some disqualified with disqualifyOnLiquidation=false',
    disqualifyOnLiquidation: false,
    scenario: 'Mix LIQUIDATED + DISQUALIFIED',
    expectedResult: 'Continue to end time (liquidated can win)',
    status: 'pending',
  },

  // ============ COMPETITION NORMAL END TESTS ============
  {
    id: 'C-N1',
    category: 'competition-normal',
    name: 'Active+Liquidated (Flag ON)',
    description: 'Some active, some liquidated at end time',
    disqualifyOnLiquidation: true,
    scenario: 'Some ACTIVE, some LIQUIDATED',
    expectedResult: 'Rank active only',
    status: 'pending',
  },
  {
    id: 'C-N2',
    category: 'competition-normal',
    name: 'Active+Disqualified (Flag ON)',
    description: 'Some active, some disqualified at end time',
    disqualifyOnLiquidation: true,
    scenario: 'Some ACTIVE, some DISQUALIFIED',
    expectedResult: 'Rank active only',
    status: 'pending',
  },
  {
    id: 'C-N3',
    category: 'competition-normal',
    name: 'Active+Liquidated (Flag OFF)',
    description: 'Some active, some liquidated at end time',
    disqualifyOnLiquidation: false,
    scenario: 'Some ACTIVE, some LIQUIDATED',
    expectedResult: 'Rank ALL (liquidated included)',
    status: 'pending',
  },
  {
    id: 'C-N4',
    category: 'competition-normal',
    name: 'All Liquidated (Flag OFF)',
    description: 'All players liquidated at end time',
    disqualifyOnLiquidation: false,
    scenario: 'All LIQUIDATED',
    expectedResult: 'Rank all by final equity',
    status: 'pending',
  },

  // ============ CHALLENGE EARLY END TESTS ============
  {
    id: 'CH-E1',
    category: 'challenge-early',
    name: 'A Liquidated, B Active (Flag ON)',
    description: 'Challenger liquidated, opponent active',
    disqualifyOnLiquidation: true,
    scenario: 'A=Liquidated, B=Active',
    expectedResult: 'B wins immediately',
    status: 'pending',
  },
  {
    id: 'CH-E2',
    category: 'challenge-early',
    name: 'A Active, B Liquidated (Flag ON)',
    description: 'Challenger active, opponent liquidated',
    disqualifyOnLiquidation: true,
    scenario: 'A=Active, B=Liquidated',
    expectedResult: 'A wins immediately',
    status: 'pending',
  },
  {
    id: 'CH-E3',
    category: 'challenge-early',
    name: 'Both Liquidated (Flag ON)',
    description: 'Both players liquidated',
    disqualifyOnLiquidation: true,
    scenario: 'A=Liquidated, B=Liquidated',
    expectedResult: 'Higher equity wins',
    status: 'pending',
  },
  {
    id: 'CH-E4',
    category: 'challenge-early',
    name: 'A Disqualified, B Active (Flag ON)',
    description: 'Challenger disqualified, opponent active',
    disqualifyOnLiquidation: true,
    scenario: 'A=Disqualified, B=Active',
    expectedResult: 'B wins immediately',
    status: 'pending',
  },
  {
    id: 'CH-E5',
    category: 'challenge-early',
    name: 'Both Disqualified (Flag ON)',
    description: 'Both players disqualified',
    disqualifyOnLiquidation: true,
    scenario: 'A=Disqualified, B=Disqualified',
    expectedResult: 'Prize to Unclaimed Pools',
    status: 'pending',
  },
  {
    id: 'CH-E6',
    category: 'challenge-early',
    name: 'A Liquidated, B Disqualified (Flag ON)',
    description: 'Challenger liquidated, opponent disqualified',
    disqualifyOnLiquidation: true,
    scenario: 'A=Liquidated, B=Disqualified',
    expectedResult: 'A wins (played fair)',
    status: 'pending',
  },
  {
    id: 'CH-E7',
    category: 'challenge-early',
    name: 'A Liquidated, B Active (Flag OFF)',
    description: 'Challenger liquidated, opponent active - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Liquidated, B=Active',
    expectedResult: 'Continue to end time',
    status: 'pending',
  },
  {
    id: 'CH-E8',
    category: 'challenge-early',
    name: 'Both Liquidated (Flag OFF)',
    description: 'Both players liquidated - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Liquidated, B=Liquidated',
    expectedResult: 'Continue to end time',
    status: 'pending',
  },
  {
    id: 'CH-E9',
    category: 'challenge-early',
    name: 'A Disqualified, B Active (Flag OFF)',
    description: 'Challenger disqualified, opponent active - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Disqualified, B=Active',
    expectedResult: 'B wins immediately',
    status: 'pending',
  },
  {
    id: 'CH-E10',
    category: 'challenge-early',
    name: 'Both Disqualified (Flag OFF)',
    description: 'Both players disqualified - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Disqualified, B=Disqualified',
    expectedResult: 'Prize to Unclaimed Pools',
    status: 'pending',
  },
  {
    id: 'CH-E11',
    category: 'challenge-early',
    name: 'A Liquidated, B Disqualified (Flag OFF)',
    description: 'Challenger liquidated, opponent disqualified - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Liquidated, B=Disqualified',
    expectedResult: 'A wins immediately',
    status: 'pending',
  },

  // ============ CHALLENGE NORMAL END TESTS ============
  {
    id: 'CH-N1',
    category: 'challenge-normal',
    name: 'Both Active (Flag ON)',
    description: 'Both active, compare equity',
    disqualifyOnLiquidation: true,
    scenario: 'A=Active $5000, B=Active $6000',
    expectedResult: 'B wins (higher equity)',
    status: 'pending',
  },
  {
    id: 'CH-N2',
    category: 'challenge-normal',
    name: 'A Liquidated, B Active (Flag ON)',
    description: 'Challenger liquidated at end time',
    disqualifyOnLiquidation: true,
    scenario: 'A=Liquidated, B=Active',
    expectedResult: 'B wins (A disqualified)',
    status: 'pending',
  },
  {
    id: 'CH-N3',
    category: 'challenge-normal',
    name: 'Both Liquidated (Flag ON)',
    description: 'Both liquidated at end time',
    disqualifyOnLiquidation: true,
    scenario: 'A=Liquidated, B=Liquidated',
    expectedResult: 'Higher equity wins',
    status: 'pending',
  },
  {
    id: 'CH-N4',
    category: 'challenge-normal',
    name: 'A Liquidated Higher, B Active Lower (Flag OFF)',
    description: 'Liquidated has higher equity - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Liquidated $3000, B=Active $2000',
    expectedResult: 'A wins (higher equity)',
    status: 'pending',
  },
  {
    id: 'CH-N5',
    category: 'challenge-normal',
    name: 'Both Liquidated (Flag OFF)',
    description: 'Both liquidated at end time - flag off',
    disqualifyOnLiquidation: false,
    scenario: 'A=Liquidated, B=Liquidated',
    expectedResult: 'Higher equity wins',
    status: 'pending',
    isLegacy: true, // NOTE: In production, challenges always have disqualifyOnLiquidation=true
  },

  // ============ PRIZE DISTRIBUTION TESTS ============
  {
    id: 'C-P1',
    category: 'competition-prize',
    name: 'Winner Gets Prize',
    description: 'Verify winner receives correct prize amount',
    disqualifyOnLiquidation: true,
    scenario: '3 active players, winner highest equity',
    expectedResult: '$240 prize (pool $300 - 20% fee)',
    status: 'pending',
  },
  {
    id: 'C-P2',
    category: 'competition-prize',
    name: 'All Disqualified → Unclaimed',
    description: 'Verify all disqualified = pool goes to platform',
    disqualifyOnLiquidation: true,
    scenario: 'All disqualified (no trades)',
    expectedResult: '$160 to unclaimed pools',
    status: 'pending',
  },
  {
    id: 'CH-P1',
    category: 'challenge-prize',
    name: 'Challenge Winner Prize',
    description: 'Verify challenge winner receives full prize',
    disqualifyOnLiquidation: true,
    scenario: 'Challenger wins with higher equity',
    expectedResult: '$200 prize (full pool)',
    status: 'pending',
  },
  {
    id: 'CH-P2',
    category: 'challenge-prize',
    name: 'Both Disqualified → Unclaimed',
    description: 'Verify both disqualified = pool goes to platform',
    disqualifyOnLiquidation: true,
    scenario: 'Both disqualified (no trades)',
    expectedResult: '$200 to unclaimed pools',
    status: 'pending',
  },

  // ============ MULTI-WINNER DISTRIBUTION TESTS ============
  // Prize split: 1st=70%, 2nd=20%, 3rd=10%
  {
    id: 'C-D1',
    category: 'competition-distribution',
    name: '5 Active → Top 3 Prizes',
    description: 'Verify 70/20/10 split with 5 active players',
    disqualifyOnLiquidation: true,
    scenario: '5 active players ranked by equity',
    expectedResult: '1st: $280 (70%), 2nd: $80 (20%), 3rd: $40 (10%)',
    status: 'pending',
  },
  {
    id: 'C-D2',
    category: 'competition-distribution',
    name: '3 Active + 2 Disqualified',
    description: 'Only active players get prizes',
    disqualifyOnLiquidation: true,
    scenario: '3 active (lower equity) vs 2 disqualified (higher equity)',
    expectedResult: '3 active get all prizes, disqualified excluded',
    status: 'pending',
  },
  {
    id: 'C-D3',
    category: 'competition-distribution',
    name: '2 Active + 4 Liquidated (Flag OFF)',
    description: 'Liquidated player can win 3rd place!',
    disqualifyOnLiquidation: false,
    scenario: '2 active + 4 liquidated, ranked by equity',
    expectedResult: '1st: Active, 2nd: Active, 3rd: Liquidated! ($48)',
    status: 'pending',
  },
  {
    id: 'C-D4',
    category: 'competition-distribution',
    name: '1 Active + 5 Liquidated (Flag OFF)',
    description: 'Liquidated compete for 2nd and 3rd',
    disqualifyOnLiquidation: false,
    scenario: '1 active + 5 liquidated, all ranked by equity',
    expectedResult: '1st: Active, 2nd: Liquidated ($96), 3rd: Liquidated ($48)',
    status: 'pending',
  },
  {
    id: 'C-D5',
    category: 'competition-distribution',
    name: '3 Active + 3 Liquidated (Flag ON)',
    description: 'Liquidated excluded even with higher equity',
    disqualifyOnLiquidation: true,
    scenario: '3 active (lower equity) vs 3 liquidated (higher equity)',
    expectedResult: 'Only active players get prizes',
    status: 'pending',
  },
  {
    id: 'C-D6',
    category: 'competition-distribution',
    name: 'Only 2 Winners → 3rd Unclaimed',
    description: 'Missing winners → prize to unclaimed pool',
    disqualifyOnLiquidation: true,
    scenario: '2 active only, no 3rd winner',
    expectedResult: '1st: $224, 2nd: $64, 3rd: $32 → unclaimed',
    status: 'pending',
  },

  // ============ FULL JOURNEY TESTS ============
  {
    id: 'C-J1',
    category: 'competition-journey',
    name: 'Liquidated Win Journey',
    description: 'Verify: no early end → finalize → liquidated wins',
    disqualifyOnLiquidation: false,
    scenario: 'All liquidated, flag OFF',
    expectedResult: 'Step 1: No early end → Step 2: Finalize → Higher equity wins $160',
    status: 'pending',
  },
  {
    id: 'C-J2',
    category: 'competition-journey',
    name: 'Liq vs Disq Journey',
    description: 'Verify: liquidated beats disqualified after full journey',
    disqualifyOnLiquidation: false,
    scenario: 'One liquidated, one disqualified, flag OFF',
    expectedResult: 'Step 1: No early end → Step 2: Finalize → Liquidated wins $160',
    status: 'pending',
  },

  // ============ TIE SCENARIO TESTS ============
  {
    id: 'C-T1',
    category: 'competition-ties',
    name: 'Two Players Tied - Tie-breaker',
    description: 'Same PNL, different trades - tie-breaker decides',
    disqualifyOnLiquidation: true,
    scenario: 'Two players with exact same equity, different trade count',
    expectedResult: 'Player with FEWER trades wins (more efficient trader)',
    status: 'pending',
  },
  {
    id: 'C-T2',
    category: 'competition-ties',
    name: 'Three-Way Tie - Equal Split',
    description: 'All same stats - split prize equally',
    disqualifyOnLiquidation: true,
    scenario: 'Three players with identical stats',
    expectedResult: 'Prize split equally: $80 each (240 ÷ 3)',
    status: 'pending',
  },
  {
    id: 'C-T3',
    category: 'competition-ties',
    name: 'Two Tied for 2nd Place',
    description: 'Clear winner, but 2nd place tied',
    disqualifyOnLiquidation: true,
    scenario: 'P0 wins, P1 & P2 tied for 2nd',
    expectedResult: '1st: $224, 2nd tied: $48 each (split 20%+10%)',
    status: 'pending',
  },

  // ============ EDGE CASE TESTS ============
  {
    id: 'C-EC1',
    category: 'competition-edge',
    name: 'All Negative PNL',
    description: 'Everyone loses money - least negative wins',
    disqualifyOnLiquidation: true,
    scenario: 'All players have negative PNL',
    expectedResult: 'Least negative PNL wins (-1000 beats -2000)',
    status: 'pending',
  },
  {
    id: 'C-EC2',
    category: 'competition-edge',
    name: 'Single Participant',
    description: 'Only one player - auto wins',
    disqualifyOnLiquidation: true,
    scenario: 'Single participant in competition',
    expectedResult: 'Single player wins full prize ($80)',
    status: 'pending',
  },
  {
    id: 'C-EC3',
    category: 'competition-edge',
    name: 'All Liquidated Compete (Flag OFF)',
    description: 'Everyone liquidated but still compete',
    disqualifyOnLiquidation: false,
    scenario: 'All liquidated, flag OFF - they compete by equity',
    expectedResult: 'Highest equity liquidated player wins',
    status: 'pending',
  },

  // ============ CHALLENGE TIE TESTS ============
  {
    id: 'CH-T1',
    category: 'challenge-ties',
    name: 'Exact Tie - Split Equally',
    description: 'Both same equity - prize split 50/50 (admin default)',
    disqualifyOnLiquidation: true,
    scenario: 'Both players have exact same equity',
    expectedResult: 'Tie - both players split prize (default admin setting)',
    status: 'pending',
  },
];

// Category info
const CATEGORIES = [
  { id: 'competition-early', name: 'Competition Early End', icon: Trophy, color: 'text-yellow-400' },
  { id: 'competition-normal', name: 'Competition Normal End', icon: Trophy, color: 'text-blue-400' },
  { id: 'competition-prize', name: 'Competition Prize Distribution', icon: DollarSign, color: 'text-emerald-400' },
  { id: 'competition-distribution', name: 'Multi-Winner Distribution', icon: DollarSign, color: 'text-pink-400' },
  { id: 'competition-journey', name: 'Competition Full Journey', icon: Clock, color: 'text-purple-400' },
  { id: 'competition-ties', name: '🤝 Tie Scenarios', icon: Trophy, color: 'text-amber-400' },
  { id: 'competition-edge', name: '⚠️ Edge Cases', icon: AlertCircle, color: 'text-red-400' },
  { id: 'challenge-early', name: 'Challenge Early End', icon: Swords, color: 'text-orange-400' },
  { id: 'challenge-normal', name: 'Challenge Normal End', icon: Swords, color: 'text-green-400' },
  { id: 'challenge-prize', name: 'Challenge Prize Distribution', icon: DollarSign, color: 'text-cyan-400' },
  { id: 'challenge-ties', name: '🤝 Challenge Ties', icon: Swords, color: 'text-amber-400' },
];

export default function EndLogicTestsTab() {
  const [testCases, setTestCases] = useState<TestCase[]>(TEST_CASES);
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
      const response = await fetch('/api/admin/end-logic-tests/run', {
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
            result: { success: false, message: data.error || 'Test failed' },
          } : t
        ));
      }
    } catch (error) {
      setTestCases(prev => prev.map(t => 
        t.id === testId ? { 
          ...t, 
          status: 'failed',
          result: { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
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
      await new Promise(r => setTimeout(r, 500));
    }

    setIsRunning(false);
    toast.success('All tests completed!');
  };

  // Run category tests
  const runCategoryTests = async (category: string) => {
    setIsRunning(true);
    
    const categoryTests = testCases.filter(t => t.category === category);
    const total = categoryTests.length;
    let completed = 0;

    // Reset category tests to pending
    setTestCases(prev => prev.map(t => 
      t.category === category ? { ...t, status: 'pending', result: undefined } : t
    ));

    for (const test of categoryTests) {
      await runSingleTest(test.id);
      completed++;
      setProgress((completed / total) * 100);
      await new Promise(r => setTimeout(r, 500));
    }

    setIsRunning(false);
    toast.success(`${category} tests completed!`);
  };

  // Cleanup test data
  const cleanupTestData = async () => {
    try {
      const response = await fetch('/api/admin/end-logic-tests/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testDataIds }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Cleaned up ${data.deletedCount} test records`);
        setTestDataIds([]);
        // Reset all tests
        setTestCases(TEST_CASES.map(t => ({ ...t, status: 'pending', result: undefined })));
      } else {
        toast.error(data.error || 'Cleanup failed');
      }
    } catch (error) {
      toast.error('Cleanup failed');
    }
  };

  // Get stats
  const stats = {
    total: testCases.length,
    passed: testCases.filter(t => t.status === 'passed').length,
    failed: testCases.filter(t => t.status === 'failed').length,
    pending: testCases.filter(t => t.status === 'pending').length,
  };

  // Get status icon
  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            End Logic Tests
          </CardTitle>
          <CardDescription>
            Test all competition and challenge end scenarios to verify correct behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              className="bg-green-600 hover:bg-green-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All Tests ({stats.total})
                </>
              )}
            </Button>

            <Button
              onClick={cleanupTestData}
              disabled={isRunning || testDataIds.length === 0}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cleanup Test Data ({testDataIds.length})
            </Button>

            <Button
              onClick={() => setTestCases(TEST_CASES.map(t => ({ ...t, status: 'pending', result: undefined })))}
              disabled={isRunning}
              variant="outline"
              className="border-gray-600"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>

            {/* Stats */}
            <div className="flex items-center gap-4 ml-auto">
              <Badge className="bg-green-500/20 text-green-300">
                ✓ {stats.passed} Passed
              </Badge>
              <Badge className="bg-red-500/20 text-red-300">
                ✗ {stats.failed} Failed
              </Badge>
              <Badge className="bg-gray-500/20 text-gray-300">
                ○ {stats.pending} Pending
              </Badge>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Progress</span>
                <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CATEGORIES.map(category => {
          const categoryTests = testCases.filter(t => t.category === category.id);
          const categoryStats = {
            passed: categoryTests.filter(t => t.status === 'passed').length,
            failed: categoryTests.filter(t => t.status === 'failed').length,
            total: categoryTests.length,
          };
          const Icon = category.icon;

          return (
            <Card key={category.id} className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className={cn('h-5 w-5', category.color)} />
                    {category.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {categoryStats.passed}/{categoryStats.total}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runCategoryTests(category.id)}
                      disabled={isRunning}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {categoryTests.map(test => (
                      <div
                        key={test.id}
                        className={cn(
                          'p-3 rounded-lg border transition-colors',
                          test.status === 'passed' && 'bg-green-500/10 border-green-500/30',
                          test.status === 'failed' && 'bg-red-500/10 border-red-500/30',
                          test.status === 'running' && 'bg-blue-500/10 border-blue-500/30',
                          test.status === 'pending' && 'bg-gray-700/30 border-gray-600/30',
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(test.status)}
                              <span className="font-medium text-sm text-white">
                                {test.id}: {test.name}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  'text-xs',
                                  test.disqualifyOnLiquidation 
                                    ? 'border-orange-500/50 text-orange-300' 
                                    : 'border-gray-500/50 text-gray-400'
                                )}
                              >
                                Flag: {test.disqualifyOnLiquidation ? 'ON' : 'OFF'}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{test.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="text-gray-500">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {test.scenario}
                              </span>
                              <span className="text-gray-500">→</span>
                              <span className="text-cyan-400">{test.expectedResult}</span>
                            </div>
                            
                            {/* Result details */}
                            {test.result && (
                              <div className="mt-2 pt-2 border-t border-gray-600/50">
                                <div className="flex items-center gap-2">
                                  {test.result.success ? (
                                    <CheckCircle className="h-3 w-3 text-green-400" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-400" />
                                  )}
                                  <span className={cn(
                                    'text-xs',
                                    test.result.success ? 'text-green-400' : 'text-red-400'
                                  )}>
                                    {test.result.message}
                                  </span>
                                </div>
                                {test.result.actualOutcome && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Actual: {test.result.actualOutcome}
                                  </p>
                                )}
                                {test.result.prizeDistribution && (
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                    <DollarSign className="h-3 w-3" />
                                    {test.result.prizeDistribution.winnerId && (
                                      <span>Winner: {test.result.prizeDistribution.winnerId.slice(-6)}</span>
                                    )}
                                    {test.result.prizeDistribution.winnerPrize && (
                                      <span>Prize: ${test.result.prizeDistribution.winnerPrize}</span>
                                    )}
                                    {test.result.prizeDistribution.unclaimedPool && (
                                      <span className="text-amber-400">
                                        Unclaimed: ${test.result.prizeDistribution.unclaimedPool}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runSingleTest(test.id)}
                            disabled={isRunning}
                            className="ml-2"
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

      {/* Summary */}
      {(stats.passed > 0 || stats.failed > 0) && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Test Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-700/30 rounded-lg">
                <div className="text-3xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-gray-400">Total Tests</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="text-3xl font-bold text-green-400">{stats.passed}</div>
                <div className="text-sm text-gray-400">Passed</div>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
              <div className="text-center p-4 bg-gray-700/30 rounded-lg">
                <div className="text-3xl font-bold text-gray-400">{stats.pending}</div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
            
            {stats.passed === stats.total && stats.total > 0 && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">All tests passed! 🎉</p>
              </div>
            )}
            
            {stats.failed > 0 && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 font-medium mb-2">Failed Tests:</p>
                <ul className="space-y-1">
                  {testCases.filter(t => t.status === 'failed').map(t => (
                    <li key={t.id} className="text-sm text-gray-300">
                      • {t.id}: {t.name} - {t.result?.message || 'Unknown error'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
