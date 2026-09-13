"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
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
  Clock,
  Wifi,
  Target,
  Skull,
  OctagonX,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Test case definition
interface TradingTestCase {
  id: string;
  category:
    | "open"
    | "pnl"
    | "margin"
    | "roundtrip"
    | "validation"
    | "risk"
    | "pipvalue"
    | "market"
    | "realprice"
    | "fullflow"
    | "tpsl"
    | "liquidation"
    | "stopout";
  name: string;
  description: string;
  scenario: string;
  expectedResult: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
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
    id: "T-O1",
    category: "open",
    name: "Open Long 0.01 Lot",
    description: "Minimum lot size long position (EUR/USD)",
    scenario: "0.01 lot @ 1.10000 with 100:1 leverage",
    expectedResult: "Margin: $11.00, Position opened",
    status: "pending",
  },
  {
    id: "T-O2",
    category: "open",
    name: "Open Long 0.1 Lot",
    description: "Mini lot long position (EUR/USD)",
    scenario: "0.1 lot @ 1.10000 with 100:1 leverage",
    expectedResult: "Margin: $110.00, Position opened",
    status: "pending",
  },
  {
    id: "T-O3",
    category: "open",
    name: "Open Long 1.0 Lot",
    description: "Standard lot long position (EUR/USD)",
    scenario: "1.0 lot @ 1.10000 with 100:1 leverage",
    expectedResult: "Margin: $1100.00, Position opened",
    status: "pending",
  },
  {
    id: "T-O4",
    category: "open",
    name: "Open Short 0.5 Lot",
    description: "Short position with GBP/USD",
    scenario: "0.5 lot GBP/USD @ 1.26500 with 100:1",
    expectedResult: "Margin: $632.50, Position opened",
    status: "pending",
  },
  {
    id: "T-O5",
    category: "open",
    name: "Open with 50:1 Leverage",
    description: "Lower leverage increases margin",
    scenario: "0.1 lot @ 1.10000 with 50:1 leverage",
    expectedResult: "Margin: $220.00 (2x vs 100:1)",
    status: "pending",
  },

  // ============ PNL CALCULATION TESTS ============
  {
    id: "T-P1",
    category: "pnl",
    name: "Long +50 Pips Profit",
    description: "Long position gains 50 pips",
    scenario: "Long 1.0 lot: 1.10000 → 1.10500",
    expectedResult: "PNL: +$500.00",
    status: "pending",
  },
  {
    id: "T-P2",
    category: "pnl",
    name: "Long -30 Pips Loss",
    description: "Long position loses 30 pips",
    scenario: "Long 1.0 lot: 1.10000 → 1.09700",
    expectedResult: "PNL: -$300.00",
    status: "pending",
  },
  {
    id: "T-P3",
    category: "pnl",
    name: "Short +40 Pips Profit",
    description: "Short profits when price drops",
    scenario: "Short 1.0 lot: 1.10000 → 1.09600",
    expectedResult: "PNL: +$400.00",
    status: "pending",
  },
  {
    id: "T-P4",
    category: "pnl",
    name: "Short -20 Pips Loss",
    description: "Short loses when price rises",
    scenario: "Short 1.0 lot: 1.10000 → 1.10200",
    expectedResult: "PNL: -$200.00",
    status: "pending",
  },
  {
    id: "T-P5",
    category: "pnl",
    name: "Mini Lot PNL (0.1)",
    description: "PNL scales with lot size",
    scenario: "Long 0.1 lot: 1.10000 → 1.10500 (+50 pips)",
    expectedResult: "PNL: +$50.00 (1/10 of standard)",
    status: "pending",
  },
  {
    id: "T-P6",
    category: "pnl",
    name: "Micro Lot PNL (0.01)",
    description: "Smallest lot size PNL",
    scenario: "Long 0.01 lot: 1.10000 → 1.10500 (+50 pips)",
    expectedResult: "PNL: +$5.00 (1/100 of standard)",
    status: "pending",
  },
  {
    id: "T-P7",
    category: "pnl",
    name: "JPY Pair PNL",
    description: "Different pip size (0.01)",
    scenario: "Long 1.0 lot USD/JPY: 145.00 → 145.50",
    expectedResult: "PNL: +$50000 JPY (raw calc)",
    status: "pending",
  },

  // ============ MARGIN TESTS ============
  {
    id: "T-M1",
    category: "margin",
    name: "Margin 100:1 Leverage",
    description: "Standard leverage margin calc",
    scenario: "1.0 lot EUR/USD @ 1.10000, 100:1",
    expectedResult: "Margin: $1100.00",
    status: "pending",
  },
  {
    id: "T-M2",
    category: "margin",
    name: "Margin 50:1 Leverage",
    description: "Lower leverage = higher margin",
    scenario: "1.0 lot EUR/USD @ 1.10000, 50:1",
    expectedResult: "Margin: $2200.00",
    status: "pending",
  },
  {
    id: "T-M3",
    category: "margin",
    name: "Margin 200:1 Leverage",
    description: "Higher leverage = lower margin",
    scenario: "1.0 lot EUR/USD @ 1.10000, 200:1",
    expectedResult: "Margin: $550.00",
    status: "pending",
  },

  // ============ ROUND-TRIP TESTS ============
  {
    id: "T-RT1",
    category: "roundtrip",
    name: "Full Round-Trip Profit",
    description: "Open → Close with profit",
    scenario: "Long 0.1 lot: 1.10000 → 1.10500 (+50 pips)",
    expectedResult: "PNL: +$50, Final: $10050, Margin released",
    status: "pending",
  },
  {
    id: "T-RT2",
    category: "roundtrip",
    name: "Full Round-Trip Loss",
    description: "Open → Close with loss",
    scenario: "Long 0.1 lot: 1.10000 → 1.09500 (-50 pips)",
    expectedResult: "PNL: -$50, Final: $9950, Margin released",
    status: "pending",
  },
  {
    id: "T-RT3",
    category: "roundtrip",
    name: "Short Round-Trip Profit",
    description: "Short position profit test",
    scenario: "Short 0.1 lot: 1.10000 → 1.09500",
    expectedResult: "PNL: +$50, Final: $10050",
    status: "pending",
  },
  {
    id: "T-RT4",
    category: "roundtrip",
    name: "Short Round-Trip Loss",
    description: "Short position loss test",
    scenario: "Short 0.1 lot: 1.10000 → 1.10500",
    expectedResult: "PNL: -$50, Final: $9950",
    status: "pending",
  },
  {
    id: "T-RT5",
    category: "roundtrip",
    name: "Large Lot Round-Trip",
    description: "Standard lot with significant PNL",
    scenario: "Long 1.0 lot: 1.10000 → 1.10100 (+10 pips)",
    expectedResult: "PNL: +$100, Final: $10100",
    status: "pending",
  },
  {
    id: "T-RT6",
    category: "roundtrip",
    name: "GBP/USD Round-Trip",
    description: "Different currency pair test",
    scenario: "Long 0.1 lot GBP/USD: 1.26500 → 1.26800",
    expectedResult: "PNL: +$30, Final: $10030",
    status: "pending",
  },

  // ============ VALIDATION TESTS ============
  {
    id: "T-V1",
    category: "validation",
    name: "Valid Quantity (0.1 lot)",
    description: "Test validateQuantity() accepts valid lot",
    scenario: "validateQuantity(0.1)",
    expectedResult: "✅ Valid",
    status: "pending",
  },
  {
    id: "T-V2",
    category: "validation",
    name: "Invalid Quantity (too small)",
    description: "Test validateQuantity() rejects < 0.01",
    scenario: "validateQuantity(0.001)",
    expectedResult: "❌ Rejected (min 0.01)",
    status: "pending",
  },
  {
    id: "T-V3",
    category: "validation",
    name: "Invalid Quantity (too large)",
    description: "Test validateQuantity() rejects > 100",
    scenario: "validateQuantity(150)",
    expectedResult: "❌ Rejected (max 100)",
    status: "pending",
  },
  {
    id: "T-V4",
    category: "validation",
    name: "Valid SL/TP (Long)",
    description: "Test validateSLTP() for long position",
    scenario: "Long entry=1.10, SL=1.095, TP=1.105",
    expectedResult: "✅ Valid (SL below, TP above)",
    status: "pending",
  },
  {
    id: "T-V5",
    category: "validation",
    name: "Invalid SL (Long)",
    description: "Test validateSLTP() rejects wrong SL",
    scenario: "Long entry=1.10, SL=1.105 (above entry!)",
    expectedResult: "❌ Rejected",
    status: "pending",
  },
  {
    id: "T-V6",
    category: "validation",
    name: "Valid SL/TP (Short)",
    description: "Test validateSLTP() for short position",
    scenario: "Short entry=1.10, SL=1.105, TP=1.095",
    expectedResult: "✅ Valid (SL above, TP below)",
    status: "pending",
  },

  // ============ RISK MANAGER TESTS ============
  {
    id: "T-R1",
    category: "risk",
    name: "Order Allowed (Sufficient)",
    description: "Test validateNewOrder() allows valid order",
    scenario: "$10000 capital, $110 margin needed",
    expectedResult: "✅ Order Allowed",
    status: "pending",
  },
  {
    id: "T-R2",
    category: "risk",
    name: "Order Rejected (Insufficient)",
    description: "Test validateNewOrder() rejects low capital",
    scenario: "$5000 capital, $11000 margin needed",
    expectedResult: "❌ Order Rejected",
    status: "pending",
  },
  {
    id: "T-R3",
    category: "risk",
    name: "Margin Level Calculation",
    description: "Test getMarginStatus() calculates correctly",
    scenario: "Capital=$10000, PNL=-$500, Margin=$1100",
    expectedResult: "Margin Level: ~864%",
    status: "pending",
  },
  {
    id: "T-R4",
    category: "risk",
    name: "Margin Call Detection",
    description: "Test getMarginStatus() detects danger",
    scenario: "Capital=$2000, PNL=-$1000, Margin=$1100",
    expectedResult: "Status: Danger (~91% < 100%)",
    status: "pending",
  },

  // ============ PIP VALUE TESTS ============
  {
    id: "T-PV1",
    category: "pipvalue",
    name: "Pip Value (1.0 lot)",
    description: "Test calculatePipValue() for standard lot",
    scenario: "1.0 lot EUR/USD",
    expectedResult: "$10.00 per pip",
    status: "pending",
  },
  {
    id: "T-PV2",
    category: "pipvalue",
    name: "Pip Value (0.1 lot)",
    description: "Test calculatePipValue() for mini lot",
    scenario: "0.1 lot EUR/USD",
    expectedResult: "$1.00 per pip",
    status: "pending",
  },
  {
    id: "T-PV3",
    category: "pipvalue",
    name: "Pip Value (0.01 lot)",
    description: "Test calculatePipValue() for micro lot",
    scenario: "0.01 lot EUR/USD",
    expectedResult: "$0.10 per pip",
    status: "pending",
  },

  // ============ MARKET STATUS TESTS ============
  {
    id: "T-M1",
    category: "market",
    name: "Market Status Check",
    description: "Test isMarketOpen() production function",
    scenario: 'Call isMarketOpen("forex")',
    expectedResult: "Returns open/closed status",
    status: "pending",
  },

  // ============ REAL PRICE TESTS ============
  {
    id: "T-RP1",
    category: "realprice",
    name: "Real Price (EUR/USD)",
    description: "Test getRealPrice() production function",
    scenario: "Fetch live EUR/USD price",
    expectedResult: "Returns bid/ask/spread",
    status: "pending",
  },
  {
    id: "T-RP2",
    category: "realprice",
    name: "Real Price (GBP/USD)",
    description: "Test getRealPrice() with GBP/USD",
    scenario: "Fetch live GBP/USD price",
    expectedResult: "Returns bid/ask/spread",
    status: "pending",
  },
  {
    id: "T-RP3",
    category: "realprice",
    name: "Real Price (USD/JPY)",
    description: "Test getRealPrice() with JPY pair",
    scenario: "Fetch live USD/JPY price",
    expectedResult: "Returns bid/ask/spread",
    status: "pending",
  },

  // ============ FULL FLOW TESTS ============
  {
    id: "T-F1",
    category: "fullflow",
    name: "Full Order Flow (Open)",
    description: "Complete order with all validations",
    scenario: "0.1 lot EUR/USD, $10000 capital",
    expectedResult: "✅ All validations pass",
    status: "pending",
  },
  {
    id: "T-F2",
    category: "fullflow",
    name: "Full Order Flow (With SL/TP)",
    description: "Order with stop loss and take profit",
    scenario: "Long + SL=1.095 + TP=1.105",
    expectedResult: "✅ SL/TP validated",
    status: "pending",
  },
  {
    id: "T-F3",
    category: "fullflow",
    name: "Full Order Flow (Rejected)",
    description: "Order rejected for insufficient margin",
    scenario: "10 lots, only $5000 capital",
    expectedResult: "❌ Margin insufficient",
    status: "pending",
  },
  {
    id: "T-F4",
    category: "fullflow",
    name: "Full Close Flow",
    description: "Complete position closing with PNL",
    scenario: "Entry 1.10, Exit 1.105 (+50 pips)",
    expectedResult: "PNL: +$50, Final: $10050",
    status: "pending",
  },

  // ============ TP/SL DETECTION TESTS ============
  {
    id: "T-SL1",
    category: "tpsl",
    name: "Stop Loss Hit (Long)",
    description: "SL triggers when price drops below",
    scenario: "Long, SL=1.095, Price=1.0945",
    expectedResult: "🔴 SL TRIGGERED",
    status: "pending",
  },
  {
    id: "T-SL2",
    category: "tpsl",
    name: "Stop Loss Not Hit (Long)",
    description: "Price above SL - no trigger",
    scenario: "Long, SL=1.095, Price=1.098",
    expectedResult: "✅ SL OK",
    status: "pending",
  },
  {
    id: "T-TP1",
    category: "tpsl",
    name: "Take Profit Hit (Long)",
    description: "TP triggers when price rises above",
    scenario: "Long, TP=1.105, Price=1.1055",
    expectedResult: "🟢 TP TRIGGERED",
    status: "pending",
  },
  {
    id: "T-SL3",
    category: "tpsl",
    name: "Stop Loss Hit (Short)",
    description: "SL triggers when price rises above",
    scenario: "Short, SL=1.105, Price=1.1055",
    expectedResult: "🔴 SL TRIGGERED",
    status: "pending",
  },
  {
    id: "T-TP2",
    category: "tpsl",
    name: "Take Profit Hit (Short)",
    description: "TP triggers when price drops below",
    scenario: "Short, TP=1.095, Price=1.0945",
    expectedResult: "🟢 TP TRIGGERED",
    status: "pending",
  },
  {
    id: "T-PIPS1",
    category: "tpsl",
    name: "Pips Moved Calculation",
    description: "Test pips calculation EUR/USD",
    scenario: "Entry 1.10, Current 1.105",
    expectedResult: "50 pips",
    status: "pending",
  },
  {
    id: "T-PIPS2",
    category: "tpsl",
    name: "Pips Moved (JPY)",
    description: "Test pips for JPY pair",
    scenario: "Entry 150.00, Current 150.50",
    expectedResult: "50 pips",
    status: "pending",
  },
  {
    id: "T-RR1",
    category: "tpsl",
    name: "Risk/Reward (2:1)",
    description: "Calculate R:R ratio",
    scenario: "SL=50 pips, TP=100 pips",
    expectedResult: "2:1 ratio",
    status: "pending",
  },
  {
    id: "T-RR2",
    category: "tpsl",
    name: "Risk/Reward (1:1)",
    description: "Equal risk and reward",
    scenario: "SL=50 pips, TP=50 pips",
    expectedResult: "1:1 ratio",
    status: "pending",
  },
  {
    id: "T-PP1",
    category: "tpsl",
    name: "Potential Profit",
    description: "Calculate potential profit at TP",
    scenario: "Long 0.1 lot, TP +50 pips",
    expectedResult: "$50 potential",
    status: "pending",
  },
  {
    id: "T-PP2",
    category: "tpsl",
    name: "Potential Loss",
    description: "Calculate potential loss at SL",
    scenario: "Long 0.1 lot, SL -50 pips",
    expectedResult: "-$50 potential",
    status: "pending",
  },

  // ============ LIQUIDATION TESTS ============
  {
    id: "T-L1",
    category: "liquidation",
    name: "Should Liquidate (<50%)",
    description: "Test shouldLiquidate() below threshold",
    scenario: "Margin Level: 45%",
    expectedResult: "💀 LIQUIDATE",
    status: "pending",
  },
  {
    id: "T-L2",
    category: "liquidation",
    name: "Should NOT Liquidate (>50%)",
    description: "Test shouldLiquidate() above threshold",
    scenario: "Margin Level: 75%",
    expectedResult: "✅ No liquidation",
    status: "pending",
  },
  {
    id: "T-L3",
    category: "liquidation",
    name: "Margin Call (<100%)",
    description: "Test isMarginCall() at 90%",
    scenario: "Margin Level: 90%",
    expectedResult: "⚠️ Margin Call",
    status: "pending",
  },
  {
    id: "T-L4",
    category: "liquidation",
    name: "No Margin Call (>100%)",
    description: "Test isMarginCall() at healthy level",
    scenario: "Margin Level: 500%",
    expectedResult: "✅ Healthy",
    status: "pending",
  },
  {
    id: "T-L5",
    category: "liquidation",
    name: "Liquidation Price",
    description: "Calculate exact liquidation price",
    scenario: "1 lot, $1100 margin",
    expectedResult: "Price: ~1.089",
    status: "pending",
  },
  {
    id: "T-MM1",
    category: "liquidation",
    name: "Maintenance Margin",
    description: "Calculate maintenance margin (50%)",
    scenario: "Initial Margin: $1100",
    expectedResult: "Maintenance: $550",
    status: "pending",
  },

  // ============ STOP OUT TESTS ============
  {
    id: "T-SO1",
    category: "stopout",
    name: "Stop Out Triggered",
    description: "Full stop out simulation",
    scenario: "1 lot, price -950 pips (<50%)",
    expectedResult: "🛑 STOP OUT",
    status: "pending",
  },
  {
    id: "T-SO2",
    category: "stopout",
    name: "Stop Out Prevented",
    description: "Position should NOT be stopped out",
    scenario: "0.1 lot, price -100 pips",
    expectedResult: "✅ Position safe",
    status: "pending",
  },
];

// Category info
const CATEGORIES = [
  {
    id: "open",
    name: "📂 Open Position",
    icon: TrendingUp,
    color: "text-green-400",
  },
  {
    id: "pnl",
    name: "📊 PNL Calculation",
    icon: Calculator,
    color: "text-blue-400",
  },
  {
    id: "margin",
    name: "💰 Margin",
    icon: DollarSign,
    color: "text-yellow-400",
  },
  {
    id: "roundtrip",
    name: "🔄 Round-Trip",
    icon: ArrowRightLeft,
    color: "text-purple-400",
  },
  {
    id: "validation",
    name: "✅ Validation",
    icon: CheckCircle,
    color: "text-cyan-400",
  },
  {
    id: "risk",
    name: "⚠️ Risk Manager",
    icon: AlertCircle,
    color: "text-orange-400",
  },
  {
    id: "pipvalue",
    name: "📈 Pip Value",
    icon: TrendingUp,
    color: "text-pink-400",
  },
  {
    id: "market",
    name: "🕐 Market Status",
    icon: Clock,
    color: "text-emerald-400",
  },
  {
    id: "realprice",
    name: "📡 Real Prices",
    icon: Wifi,
    color: "text-rose-400",
  },
  {
    id: "fullflow",
    name: "🚀 Full Flow",
    icon: Play,
    color: "text-indigo-400",
  },
  {
    id: "tpsl",
    name: "🎯 TP/SL Detection",
    icon: Target,
    color: "text-red-400",
  },
  {
    id: "liquidation",
    name: "💀 Liquidation",
    icon: Skull,
    color: "text-red-600",
  },
  {
    id: "stopout",
    name: "🛑 Stop Out",
    icon: OctagonX,
    color: "text-orange-600",
  },
];

export default function TradingTestsTab() {
  const [testCases, setTestCases] = useState<TradingTestCase[]>(TEST_CASES);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [testDataIds, setTestDataIds] = useState<string[]>([]);

  // Run single test
  const runSingleTest = async (testId: string) => {
    const testIndex = testCases.findIndex((t) => t.id === testId);
    if (testIndex === -1) return;

    setCurrentTest(testId);
    setTestCases((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: "running" } : t)),
    );

    try {
      const response = await fetch("/api/admin/trading-tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });

      const data = await response.json();

      if (data.success) {
        setTestCases((prev) =>
          prev.map((t) =>
            t.id === testId
              ? {
                  ...t,
                  status: data.result.passed ? "passed" : "failed",
                  result: data.result,
                }
              : t,
          ),
        );

        // Track created test data for cleanup
        if (data.testDataIds) {
          setTestDataIds((prev) => [...prev, ...data.testDataIds]);
        }
      } else {
        setTestCases((prev) =>
          prev.map((t) =>
            t.id === testId
              ? {
                  ...t,
                  status: "failed",
                  result: {
                    passed: false,
                    message: data.error || "Test failed",
                  },
                }
              : t,
          ),
        );
      }
    } catch (error) {
      setTestCases((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: "failed",
                result: {
                  passed: false,
                  message:
                    error instanceof Error ? error.message : "Unknown error",
                },
              }
            : t,
        ),
      );
    }

    setCurrentTest(null);
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);

    // Reset all tests to pending
    setTestCases(
      TEST_CASES.map((t) => ({ ...t, status: "pending", result: undefined })),
    );

    const total = testCases.length;
    let completed = 0;

    for (const test of testCases) {
      await runSingleTest(test.id);
      completed++;
      setProgress((completed / total) * 100);
      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
    setProgress(100);

    // Show summary
    const passed = testCases.filter((t) => t.status === "passed").length;
    const failed = testCases.filter((t) => t.status === "failed").length;

    if (failed === 0) {
      toast.success(`All ${passed} trading tests passed! ✅`);
    } else {
      toast.error(`${failed} of ${total} tests failed`);
    }
  };

  // Run tests by category
  const runCategoryTests = async (category: string) => {
    setIsRunning(true);
    const categoryTests = testCases.filter((t) => t.category === category);

    let completed = 0;
    for (const test of categoryTests) {
      await runSingleTest(test.id);
      completed++;
      setProgress((completed / categoryTests.length) * 100);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  };

  // Cleanup test data
  const cleanupTestData = async () => {
    try {
      const response = await fetch("/api/admin/trading-tests/cleanup", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Cleaned up ${data.deletedCount} test documents`);
        setTestDataIds([]);
      } else {
        toast.error(data.error || "Cleanup failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cleanup failed");
    }
  };

  // Reset tests
  const resetTests = () => {
    setTestCases(
      TEST_CASES.map((t) => ({ ...t, status: "pending", result: undefined })),
    );
    setProgress(0);
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "skipped":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-gray-500" />
        );
    }
  };

  // Calculate stats
  const stats = {
    total: testCases.length,
    passed: testCases.filter((t) => t.status === "passed").length,
    failed: testCases.filter((t) => t.status === "failed").length,
    pending: testCases.filter((t) => t.status === "pending").length,
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
                Test open/close positions, PNL calculations, and margin
                requirements
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
              <div className="text-2xl font-bold text-green-400">
                {stats.passed}
              </div>
              <div className="text-sm text-slate-400">Passed</div>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">
                {stats.failed}
              </div>
              <div className="text-sm text-slate-400">Failed</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-400">
                {stats.pending}
              </div>
              <div className="text-sm text-slate-400">Pending</div>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-slate-400">
                Running: {currentTest || "Preparing..."} ({Math.round(progress)}
                %)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => {
          const categoryTests = testCases.filter(
            (t) => t.category === category.id,
          );
          const passed = categoryTests.filter(
            (t) => t.status === "passed",
          ).length;
          const failed = categoryTests.filter(
            (t) => t.status === "failed",
          ).length;
          const Icon = category.icon;

          return (
            <Card
              key={category.id}
              className="bg-slate-900/50 border-slate-700/50"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className={cn(
                      "text-lg flex items-center gap-2",
                      category.color,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {category.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-green-500/20 text-green-400 border-green-500/50"
                    >
                      {passed}/{categoryTests.length}
                    </Badge>
                    {failed > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-red-500/20 text-red-400 border-red-500/50"
                      >
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
                    {categoryTests.map((test) => (
                      <div
                        key={test.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg transition-colors",
                          test.status === "passed" && "bg-green-500/10",
                          test.status === "failed" && "bg-red-500/10",
                          test.status === "running" &&
                            "bg-blue-500/10 animate-pulse",
                          test.status === "pending" && "bg-slate-800/50",
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
                            <span
                              className={cn(
                                "text-xs",
                                test.result.passed
                                  ? "text-green-400"
                                  : "text-red-400",
                              )}
                            >
                              {test.result.actualOutcome ||
                                (test.result.passed ? "✓" : "✗")}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runSingleTest(test.id)}
                            disabled={isRunning || test.status === "running"}
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
              {testCases
                .filter((t) => t.status === "failed")
                .map((test) => (
                  <div key={test.id} className="bg-red-950/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {test.id}: {test.name}
                      </div>
                      <Badge variant="outline" className="border-red-500/50">
                        FAILED
                      </Badge>
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
              <div className="font-medium text-slate-300 mb-1">
                📊 PNL Calculation
              </div>
              <code className="text-xs text-green-400">
                Long: PNL = (Exit - Entry) × Lots × 100,000
                <br />
                Short: PNL = (Entry - Exit) × Lots × 100,000
              </code>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">
                💰 Margin Required
              </div>
              <code className="text-xs text-yellow-400">
                Margin = (Lots × 100,000 × Price) / Leverage
              </code>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">
                📈 Pip Value (EUR/USD)
              </div>
              <code className="text-xs text-blue-400">
                0.01 lot = $0.10/pip
                <br />
                0.1 lot = $1.00/pip
                <br />
                1.0 lot = $10.00/pip
              </code>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="font-medium text-slate-300 mb-1">
                ⚡ Contract Size
              </div>
              <code className="text-xs text-purple-400">
                Standard lot = 100,000 units
                <br />
                Mini lot = 10,000 units (0.1)
                <br />
                Micro lot = 1,000 units (0.01)
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
