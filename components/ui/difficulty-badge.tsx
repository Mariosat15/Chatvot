'use client';

import { useState } from 'react';
import { calculateCompetitionDifficulty, DifficultyAnalysis, getAllDifficultyLevels } from '@/lib/utils/competition-difficulty';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface DifficultyBadgeProps {
  /** Pre-calculated difficulty analysis */
  difficulty?: DifficultyAnalysis;
  /** Or pass competition params to calculate on-the-fly */
  competitionParams?: {
    entryFeeCredits?: number;
    startingCapital: number;
    leverageAllowed: number;
    minParticipants?: number;
    maxParticipants?: number;
    participantCount?: number;
    durationHours?: number;
    rules?: {
      minimumTrades?: number;
      minimumWinRate?: number;
      disqualifyOnLiquidation?: boolean;
      rankingMethod?: string;
    };
    riskLimits?: {
      enabled?: boolean;
      maxDrawdownPercent?: number;
      dailyLossLimitPercent?: number;
    };
  };
  /** Show tooltip with details */
  showTooltip?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show score */
  showScore?: boolean;
  /** Compact mode - just the emoji and level */
  compact?: boolean;
}

export function DifficultyBadge({
  difficulty: preCalculated,
  competitionParams,
  showTooltip = true,
  size = 'md',
  showScore = false,
  compact = false,
}: DifficultyBadgeProps) {
  const difficulty = preCalculated || (competitionParams 
    ? calculateCompetitionDifficulty(competitionParams) 
    : null);

  if (!difficulty) return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const badge = (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${difficulty.bgColor} ${difficulty.borderColor} ${difficulty.color}
        border transition-all hover:scale-105
        ${sizeClasses[size]}
      `}
    >
      <span>{difficulty.emoji}</span>
      {!compact && <span>{difficulty.label}</span>}
      {showScore && <span className="opacity-70">({difficulty.score})</span>}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-gray-900 border-gray-700 p-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`font-semibold ${difficulty.color}`}>
                {difficulty.emoji} {difficulty.label} Difficulty
              </span>
              <span className="text-xs text-gray-400">
                Score: {difficulty.score}/100
              </span>
            </div>
            
            {/* Difficulty bar */}
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  difficulty.level === 'beginner' ? 'bg-green-500' :
                  difficulty.level === 'intermediate' ? 'bg-blue-500' :
                  difficulty.level === 'advanced' ? 'bg-yellow-500' :
                  difficulty.level === 'expert' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${difficulty.score}%` }}
              />
            </div>
            
            {/* Reasons */}
            {difficulty.reasons.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-gray-400 uppercase font-medium">Why:</span>
                <ul className="text-xs text-gray-300 space-y-0.5">
                  {difficulty.reasons.slice(0, 4).map((reason, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-gray-500" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tips */}
            {difficulty.tips.length > 0 && (
              <div className="pt-2 border-t border-gray-700">
                <span className="text-xs text-yellow-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Tip: {difficulty.tips[0]}
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface DifficultyLegendProps {
  /** Show as horizontal or vertical */
  orientation?: 'horizontal' | 'vertical';
  /** Size */
  size?: 'sm' | 'md';
}

export function DifficultyLegend({ orientation = 'horizontal', size = 'sm' }: DifficultyLegendProps) {
  const levels = getAllDifficultyLevels();

  return (
    <div className={`flex ${orientation === 'vertical' ? 'flex-col gap-2' : 'flex-wrap gap-3'}`}>
      {levels.map((level) => (
        <div 
          key={level.value}
          className={`flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
        >
          <span
            className={`
              inline-flex items-center gap-1 rounded-full px-2 py-0.5
              ${level.bgColor} ${level.borderColor} ${level.color}
              border font-medium
            `}
          >
            {level.emoji}
            {orientation === 'vertical' && level.label}
          </span>
          {orientation === 'horizontal' && (
            <span className={`${level.color} font-medium`}>{level.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface DifficultyDetailsProps {
  difficulty: DifficultyAnalysis;
  expanded?: boolean;
}

export function DifficultyDetails({ difficulty, expanded: initialExpanded = false }: DifficultyDetailsProps) {
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <div className={`rounded-xl border ${difficulty.borderColor} ${difficulty.bgColor} p-4`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{difficulty.emoji}</span>
          <div>
            <div className={`font-semibold ${difficulty.color}`}>
              {difficulty.label} Difficulty
            </div>
            <div className="text-xs text-gray-400">
              Difficulty Score: {difficulty.score}/100
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 pt-4 border-t border-gray-700/50">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Difficulty</span>
              <span>{difficulty.score}%</span>
            </div>
            <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  difficulty.level === 'beginner' ? 'bg-gradient-to-r from-green-500 to-green-400' :
                  difficulty.level === 'intermediate' ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                  difficulty.level === 'advanced' ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                  difficulty.level === 'expert' ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                  'bg-gradient-to-r from-red-500 to-red-400'
                }`}
                style={{ width: `${difficulty.score}%` }}
              />
            </div>
          </div>

          {/* Factors */}
          {difficulty.reasons.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Contributing Factors:</h4>
              <ul className="space-y-1">
                {difficulty.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tips */}
          {difficulty.tips.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-400 mb-1 flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                Pro Tips
              </h4>
              <ul className="space-y-1">
                {difficulty.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-yellow-300/80">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

