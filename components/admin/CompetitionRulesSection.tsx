'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Trophy, Target, Users, AlertTriangle } from 'lucide-react';

interface CompetitionRules {
  rankingMethod: 'pnl' | 'roi' | 'total_capital' | 'win_rate' | 'total_wins' | 'profit_factor';
  tieBreaker1: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  tieBreaker2?: 'trades_count' | 'win_rate' | 'total_capital' | 'roi' | 'join_time' | 'split_prize';
  minimumTrades: number;
  minimumWinRate?: number;
  tiePrizeDistribution: 'split_equally' | 'split_weighted' | 'first_gets_all';
  disqualifyOnLiquidation: boolean;
}

interface CompetitionRulesSectionProps {
  rules: CompetitionRules;
  onChange: (rules: CompetitionRules) => void;
}

const rankingMethods = [
  { value: 'pnl', label: 'Highest P&L', description: 'Winner has the most profit/loss' },
  { value: 'roi', label: 'Highest ROI %', description: 'Winner has the highest return on investment percentage' },
  { value: 'total_capital', label: 'Highest Capital', description: 'Winner has the most total capital (balance + P&L)' },
  { value: 'win_rate', label: 'Highest Win Rate', description: 'Winner has the highest win rate percentage' },
  { value: 'total_wins', label: 'Most Wins', description: 'Winner has the most winning trades' },
  { value: 'profit_factor', label: 'Best Profit Factor', description: 'Winner has the best profit factor (wins / losses)' },
];

const tieBreakers = [
  { value: 'trades_count', label: 'Fewer Trades', description: 'More efficient trader (fewer trades)' },
  { value: 'win_rate', label: 'Higher Win Rate', description: 'Higher percentage of winning trades' },
  { value: 'total_capital', label: 'Higher Capital', description: 'More total capital' },
  { value: 'roi', label: 'Higher ROI', description: 'Better return on investment' },
  { value: 'join_time', label: 'Who Joined First', description: 'Earlier participant wins' },
  { value: 'split_prize', label: 'Split Prize', description: 'Tied participants split the prize' },
];

const tiePrizeOptions = [
  { value: 'split_equally', label: 'Split Equally', description: 'All tied participants get equal shares' },
  { value: 'split_weighted', label: 'Split Weighted', description: 'Split based on secondary metrics (capital)' },
  { value: 'first_gets_all', label: 'First Gets All', description: 'Tiebreaker determines single winner' },
];

export default function CompetitionRulesSection({ rules, onChange }: CompetitionRulesSectionProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRules = (field: keyof CompetitionRules, value: any) => {
    onChange({ ...rules, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Ranking Method */}
      <Card className="bg-dark-700/50 border-dark-600">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Ranking Method</CardTitle>
          </div>
          <CardDescription>How participants are ranked to determine winners</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Primary Ranking Criteria</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select value={rules.rankingMethod} onValueChange={(value: any) => updateRules('rankingMethod', value)}>
              <SelectTrigger className="bg-dark-800 border-dark-600 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-dark-600">
                {rankingMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value} className="hover:bg-dark-700">
                    <div>
                      <div className="font-medium">{method.label}</div>
                      <div className="text-xs text-dark-300">{method.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-300">
                <strong>Current Method:</strong>{' '}
                {rankingMethods.find((m) => m.value === rules.rankingMethod)?.description}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tie-Breaking Rules */}
      <Card className="bg-dark-700/50 border-dark-600">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">Tie-Breaking Rules</CardTitle>
          </div>
          <CardDescription>How to resolve ties when participants have equal performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>First Tiebreaker</Label>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select value={rules.tieBreaker1} onValueChange={(value: any) => updateRules('tieBreaker1', value)}>
              <SelectTrigger className="bg-dark-800 border-dark-600 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-dark-600">
                {tieBreakers.map((tb) => (
                  <SelectItem key={tb.value} value={tb.value} className="hover:bg-dark-700">
                    <div>
                      <div className="font-medium">{tb.label}</div>
                      <div className="text-xs text-dark-300">{tb.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Second Tiebreaker (Optional)</Label>
            <Select
              value={rules.tieBreaker2 || 'none'}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onValueChange={(value: any) => updateRules('tieBreaker2', value === 'none' ? undefined : value)}
            >
              <SelectTrigger className="bg-dark-800 border-dark-600 mt-2">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-dark-600">
                <SelectItem value="none" className="hover:bg-dark-700">
                  <div className="font-medium">None</div>
                </SelectItem>
                {tieBreakers.map((tb) => (
                  <SelectItem key={tb.value} value={tb.value} className="hover:bg-dark-700">
                    <div>
                      <div className="font-medium">{tb.label}</div>
                      <div className="text-xs text-dark-300">{tb.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Prize Distribution for Ties</Label>
            <Select
              value={rules.tiePrizeDistribution}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onValueChange={(value: any) => updateRules('tiePrizeDistribution', value)}
            >
              <SelectTrigger className="bg-dark-800 border-dark-600 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-dark-600">
                {tiePrizeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="hover:bg-dark-700">
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-dark-300">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Qualification Requirements */}
      <Card className="bg-dark-700/50 border-dark-600">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">Qualification Requirements</CardTitle>
          </div>
          <CardDescription>Minimum requirements to qualify for prizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Minimum Trades Required</Label>
            <Input
              type="number"
              min="0"
              value={rules.minimumTrades}
              onChange={(e) => updateRules('minimumTrades', parseInt(e.target.value) || 0)}
              className="bg-dark-800 border-dark-600 mt-2"
              placeholder="0 = No minimum"
            />
            <p className="text-xs text-dark-300 mt-1">
              Participants must complete at least this many trades to qualify for prizes
            </p>
          </div>

          <div>
            <Label>Minimum Win Rate % (Optional)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={rules.minimumWinRate || ''}
              onChange={(e) => updateRules('minimumWinRate', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="bg-dark-800 border-dark-600 mt-2"
              placeholder="Leave empty for no minimum"
            />
            <p className="text-xs text-dark-300 mt-1">
              Optional: Participants must maintain at least this win rate percentage
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg border border-dark-600">
            <Checkbox
              id="disqualifyLiquidation"
              checked={rules.disqualifyOnLiquidation}
              onCheckedChange={(checked) => updateRules('disqualifyOnLiquidation', checked)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label htmlFor="disqualifyLiquidation" className="cursor-pointer font-medium">
                Disqualify Liquidated Participants
              </Label>
              <p className="text-xs text-dark-300 mt-1">
                Participants who get liquidated (margin call) are automatically disqualified from prizes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-amber-300 mb-1">Important: Rule Transparency</h4>
            <p className="text-sm text-amber-200/80">
              All competition rules are displayed to participants before they enter. Make sure your rules are fair and
              clearly communicate how winners are determined.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

