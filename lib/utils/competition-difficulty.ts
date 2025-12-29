/**
 * Competition Difficulty Calculator
 * 
 * Analyzes competition parameters to determine difficulty level
 * and provides visual indicators for users
 */

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'extreme';

export interface DifficultyAnalysis {
  level: DifficultyLevel;
  score: number; // 0-100
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  reasons: string[];
  tips: string[];
}

interface CompetitionParams {
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
    equityCheckEnabled?: boolean;
    equityDrawdownPercent?: number;
  };
  prizePool?: number;
  levelRequirement?: {
    enabled?: boolean;
    minLevel?: number;
    maxLevel?: number;
  };
}

const DIFFICULTY_CONFIG: Record<DifficultyLevel, {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  minScore: number;
  maxScore: number;
}> = {
  beginner: {
    label: 'Beginner',
    emoji: '🌱',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    minScore: 0,
    maxScore: 20,
  },
  intermediate: {
    label: 'Intermediate',
    emoji: '📊',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    minScore: 21,
    maxScore: 40,
  },
  advanced: {
    label: 'Advanced',
    emoji: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    minScore: 41,
    maxScore: 60,
  },
  expert: {
    label: 'Expert',
    emoji: '🔥',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    minScore: 61,
    maxScore: 80,
  },
  extreme: {
    label: 'Extreme',
    emoji: '💀',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    minScore: 81,
    maxScore: 100,
  },
};

/**
 * Calculate difficulty level for a competition
 */
export function calculateCompetitionDifficulty(params: CompetitionParams): DifficultyAnalysis {
  let score = 0;
  const reasons: string[] = [];
  const tips: string[] = [];

  // 1. Entry Fee Analysis (0-15 points)
  if (params.entryFeeCredits !== undefined) {
    if (params.entryFeeCredits <= 5) {
      score += 2;
      reasons.push('Low entry barrier');
    } else if (params.entryFeeCredits <= 20) {
      score += 5;
      reasons.push('Moderate entry fee');
    } else if (params.entryFeeCredits <= 50) {
      score += 10;
      reasons.push('Higher stake entry');
    } else if (params.entryFeeCredits <= 100) {
      score += 12;
      reasons.push('Premium entry fee');
    } else {
      score += 15;
      reasons.push('High-stakes entry');
      tips.push('Consider starting with lower-stake competitions');
    }
  }

  // 2. Starting Capital Analysis (0-10 points)
  // Lower starting capital = harder to recover from losses
  if (params.startingCapital <= 1000) {
    score += 10;
    reasons.push('Limited starting capital');
    tips.push('Each trade has significant impact');
  } else if (params.startingCapital <= 5000) {
    score += 6;
    reasons.push('Moderate starting capital');
  } else if (params.startingCapital <= 10000) {
    score += 3;
    reasons.push('Comfortable capital base');
  } else {
    score += 0;
    reasons.push('Large capital buffer');
  }

  // 3. Leverage Analysis (0-15 points)
  // Higher leverage = higher risk
  if (params.leverageAllowed <= 10) {
    score += 2;
    reasons.push('Conservative leverage limits');
  } else if (params.leverageAllowed <= 50) {
    score += 5;
    reasons.push('Moderate leverage available');
  } else if (params.leverageAllowed <= 100) {
    score += 8;
    reasons.push('Standard leverage options');
  } else if (params.leverageAllowed <= 200) {
    score += 12;
    reasons.push('High leverage enabled');
  } else {
    score += 15;
    reasons.push('Extreme leverage available');
    tips.push('High leverage amplifies both gains and losses');
  }

  // 4. Competition Size (0-15 points)
  const participantCount = params.participantCount || params.maxParticipants || 10;
  if (participantCount <= 5) {
    score += 3;
    reasons.push('Small field competition');
  } else if (participantCount <= 20) {
    score += 6;
    reasons.push('Medium-sized competition');
  } else if (participantCount <= 50) {
    score += 10;
    reasons.push('Large competition pool');
  } else {
    score += 15;
    reasons.push('Massive competition');
    tips.push('More participants means stiffer competition');
  }

  // 5. Duration Analysis (0-10 points)
  if (params.durationHours) {
    if (params.durationHours <= 1) {
      score += 10;
      reasons.push('Sprint format - very fast-paced');
      tips.push('Quick decisions required');
    } else if (params.durationHours <= 4) {
      score += 8;
      reasons.push('Short competition window');
    } else if (params.durationHours <= 24) {
      score += 5;
      reasons.push('Day-long competition');
    } else if (params.durationHours <= 72) {
      score += 3;
      reasons.push('Multi-day competition');
    } else {
      score += 1;
      reasons.push('Extended competition period');
    }
  }

  // 6. Rules Complexity (0-15 points)
  if (params.rules) {
    // Minimum trades
    if (params.rules.minimumTrades && params.rules.minimumTrades >= 10) {
      score += 5;
      reasons.push(`${params.rules.minimumTrades}+ trades required`);
      tips.push('Plan multiple trading opportunities');
    } else if (params.rules.minimumTrades && params.rules.minimumTrades >= 5) {
      score += 3;
      reasons.push(`${params.rules.minimumTrades} trades required`);
    }

    // Minimum win rate
    if (params.rules.minimumWinRate) {
      score += 5;
      reasons.push(`${params.rules.minimumWinRate}% win rate required`);
      tips.push('Focus on trade quality over quantity');
    }

    // Liquidation disqualification
    if (params.rules.disqualifyOnLiquidation) {
      score += 5;
      reasons.push('Liquidation means disqualification');
      tips.push('Use proper risk management');
    }
  }

  // 7. Risk Management Rules (0-10 points)
  if (params.riskLimits?.enabled) {
    if (params.riskLimits.maxDrawdownPercent && params.riskLimits.maxDrawdownPercent <= 30) {
      score += 5;
      reasons.push('Strict drawdown limits');
    } else if (params.riskLimits.maxDrawdownPercent) {
      score += 2;
      reasons.push('Drawdown limits in place');
    }

    if (params.riskLimits.dailyLossLimitPercent && params.riskLimits.dailyLossLimitPercent <= 10) {
      score += 3;
      reasons.push('Tight daily loss limits');
    }

    if (params.riskLimits.equityCheckEnabled) {
      score += 2;
      reasons.push('Equity monitoring active');
    }
  }

  // 8. Level Requirements (0-10 points)
  if (params.levelRequirement?.enabled) {
    if (params.levelRequirement.minLevel && params.levelRequirement.minLevel >= 5) {
      score += 10;
      reasons.push(`Level ${params.levelRequirement.minLevel}+ required`);
      tips.push('Experienced traders only');
    } else if (params.levelRequirement.minLevel && params.levelRequirement.minLevel >= 3) {
      score += 5;
      reasons.push('Intermediate level required');
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine difficulty level
  let level: DifficultyLevel = 'beginner';
  for (const [key, config] of Object.entries(DIFFICULTY_CONFIG)) {
    if (score >= config.minScore && score <= config.maxScore) {
      level = key as DifficultyLevel;
      break;
    }
  }

  const config = DIFFICULTY_CONFIG[level];

  return {
    level,
    score,
    label: config.label,
    emoji: config.emoji,
    color: config.color,
    bgColor: config.bgColor,
    borderColor: config.borderColor,
    reasons,
    tips,
  };
}

/**
 * Get difficulty badge props for display
 */
export function getDifficultyBadge(difficulty: DifficultyAnalysis) {
  return {
    label: `${difficulty.emoji} ${difficulty.label}`,
    className: `${difficulty.bgColor} ${difficulty.borderColor} ${difficulty.color} border`,
  };
}

/**
 * Get all difficulty levels for legend/filter
 */
export function getAllDifficultyLevels() {
  return Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => ({
    value: key as DifficultyLevel,
    ...config,
  }));
}

