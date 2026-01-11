/**
 * Competition Difficulty Calculator
 * 
 * Analyzes competition parameters to determine difficulty level
 * Uses trader level names for consistency with user progression system
 */

// Difficulty levels mapped to trader levels
export type DifficultyLevel = 
  | 'Novice'        // Level 1-2 equivalent
  | 'Apprentice'    // Level 2-3 equivalent
  | 'Skilled'       // Level 3-4 equivalent
  | 'Expert'        // Level 4-5 equivalent
  | 'Elite'         // Level 5-6 equivalent
  | 'Master'        // Level 6-7 equivalent
  | 'Grand Master'  // Level 7-8 equivalent
  | 'Champion'      // Level 8-9 equivalent
  | 'Legend'        // Level 9-10 equivalent
  | 'Trading God';  // Level 10 equivalent

export interface DifficultyFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  score: number;
}

export interface DifficultyAnalysis {
  level: DifficultyLevel;
  label: string; // Human-readable label (e.g., "Novice Trader")
  score: number; // 0-100
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  recommendedLevels: string;
  factors: DifficultyFactor[];
  tips: string[]; // Tips for this difficulty level
}

// Difficulty configuration matching trader levels
const DIFFICULTY_CONFIG: Record<DifficultyLevel, {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  minScore: number;
  maxScore: number;
  recommendedLevels: string;
  tips: string[];
}> = {
  'Novice': {
    label: 'Novice Trader',
    emoji: '🌱',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    minScore: 0,
    maxScore: 10,
    recommendedLevels: 'Level 1-2',
    tips: ['Great for beginners', 'Low risk environment', 'Learn the basics'],
  },
  'Apprentice': {
    label: 'Apprentice Trader',
    emoji: '📚',
    color: 'text-green-300',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    minScore: 11,
    maxScore: 20,
    recommendedLevels: 'Level 2-3',
    tips: ['Build your skills', 'Moderate risk', 'Practice strategies'],
  },
  'Skilled': {
    label: 'Skilled Trader',
    emoji: '⚔️',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    minScore: 21,
    maxScore: 30,
    recommendedLevels: 'Level 3-4',
    tips: ['Requires trading experience', 'Medium difficulty', 'Test your strategies'],
  },
  'Expert': {
    label: 'Expert Trader',
    emoji: '🎯',
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    minScore: 31,
    maxScore: 40,
    recommendedLevels: 'Level 4-5',
    tips: ['For experienced traders', 'Higher stakes', 'Strategy is key'],
  },
  'Elite': {
    label: 'Elite Trader',
    emoji: '💎',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    minScore: 41,
    maxScore: 50,
    recommendedLevels: 'Level 5-6',
    tips: ['Challenging competition', 'High skill required', 'Manage risk carefully'],
  },
  'Master': {
    label: 'Master Trader',
    emoji: '👑',
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    minScore: 51,
    maxScore: 60,
    recommendedLevels: 'Level 6-7',
    tips: ['Professional level', 'Strong competition', 'Discipline is essential'],
  },
  'Grand Master': {
    label: 'Grand Master',
    emoji: '🔥',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    minScore: 61,
    maxScore: 70,
    recommendedLevels: 'Level 7-8',
    tips: ['Very challenging', 'Expert risk management needed', 'Not for beginners'],
  },
  'Champion': {
    label: 'Trading Champion',
    emoji: '⚡',
    color: 'text-orange-300',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    minScore: 71,
    maxScore: 80,
    recommendedLevels: 'Level 8-9',
    tips: ['Elite competition', 'High pressure', 'Prove your skills'],
  },
  'Legend': {
    label: 'Market Legend',
    emoji: '🌟',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    minScore: 81,
    maxScore: 90,
    recommendedLevels: 'Level 9-10',
    tips: ['Extreme difficulty', 'Only for the best', 'High risk, high reward'],
  },
  'Trading God': {
    label: 'Trading God',
    emoji: '👑',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    minScore: 91,
    maxScore: 100,
    recommendedLevels: 'Level 10 only',
    tips: ['Ultimate challenge', 'Brutal conditions', 'Only legends survive'],
  },
};

interface CompetitionParams {
  entryFee?: number;
  entryFeeCredits?: number;
  startingCapital?: number;
  leverageAllowed?: number;
  maxLeverage?: number;
  duration?: number; // in minutes
  durationHours?: number;
  maxParticipants?: number;
  participantCount?: number;
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
  levelRequirement?: {
    enabled?: boolean;
    minLevel?: number;
    maxLevel?: number;
  };
}

/**
 * Calculate difficulty level for a competition
 */
export function calculateCompetitionDifficulty(params: CompetitionParams): DifficultyAnalysis {
  let score = 0;
  const factors: DifficultyFactor[] = [];

  // 1. Entry Fee Analysis (0-15 points)
  const entryFee = params.entryFee || params.entryFeeCredits || 0;
  if (entryFee > 0) {
    if (entryFee <= 5) {
      score += 2;
      factors.push({ factor: 'Low entry fee', impact: 'low', score: 2 });
    } else if (entryFee <= 20) {
      score += 5;
      factors.push({ factor: 'Moderate entry fee', impact: 'low', score: 5 });
    } else if (entryFee <= 50) {
      score += 10;
      factors.push({ factor: 'Higher entry fee', impact: 'medium', score: 10 });
    } else if (entryFee <= 100) {
      score += 12;
      factors.push({ factor: 'Premium entry fee', impact: 'medium', score: 12 });
    } else {
      score += 15;
      factors.push({ factor: 'High-stakes entry', impact: 'high', score: 15 });
    }
  }

  // 2. Starting Capital Analysis (0-10 points)
  const capital = params.startingCapital || 10000;
  if (capital <= 1000) {
    score += 10;
    factors.push({ factor: 'Limited capital', impact: 'high', score: 10 });
  } else if (capital <= 5000) {
    score += 6;
    factors.push({ factor: 'Moderate capital', impact: 'medium', score: 6 });
  } else if (capital <= 10000) {
    score += 3;
    factors.push({ factor: 'Comfortable capital', impact: 'low', score: 3 });
  }

  // 3. Leverage Analysis (0-15 points)
  const leverage = params.maxLeverage || params.leverageAllowed || 100;
  if (leverage <= 10) {
    score += 2;
    factors.push({ factor: 'Conservative leverage', impact: 'low', score: 2 });
  } else if (leverage <= 50) {
    score += 5;
    factors.push({ factor: 'Moderate leverage', impact: 'low', score: 5 });
  } else if (leverage <= 100) {
    score += 8;
    factors.push({ factor: 'Standard leverage', impact: 'medium', score: 8 });
  } else if (leverage <= 200) {
    score += 12;
    factors.push({ factor: 'High leverage', impact: 'medium', score: 12 });
  } else {
    score += 15;
    factors.push({ factor: 'Extreme leverage', impact: 'high', score: 15 });
  }

  // 4. Competition Size (0-10 points)
  const participants = params.participantCount || params.maxParticipants || 10;
  if (participants <= 5) {
    score += 2;
    factors.push({ factor: 'Small field', impact: 'low', score: 2 });
  } else if (participants <= 20) {
    score += 4;
    factors.push({ factor: 'Medium field', impact: 'low', score: 4 });
  } else if (participants <= 50) {
    score += 7;
    factors.push({ factor: 'Large field', impact: 'medium', score: 7 });
  } else {
    score += 10;
    factors.push({ factor: 'Massive field', impact: 'high', score: 10 });
  }

  // 5. Duration Analysis (0-10 points)
  const hours = params.durationHours || (params.duration ? params.duration / 60 : 24);
  if (hours <= 1) {
    score += 10;
    factors.push({ factor: 'Sprint format', impact: 'high', score: 10 });
  } else if (hours <= 4) {
    score += 8;
    factors.push({ factor: 'Short duration', impact: 'medium', score: 8 });
  } else if (hours <= 24) {
    score += 5;
    factors.push({ factor: 'Day-long', impact: 'medium', score: 5 });
  } else if (hours <= 72) {
    score += 3;
    factors.push({ factor: 'Multi-day', impact: 'low', score: 3 });
  }

  // 6. Rules Complexity (0-20 points)
  if (params.rules) {
    if (params.rules.minimumTrades && params.rules.minimumTrades >= 10) {
      score += 8;
      factors.push({ factor: `${params.rules.minimumTrades}+ trades required`, impact: 'high', score: 8 });
    } else if (params.rules.minimumTrades && params.rules.minimumTrades >= 5) {
      score += 4;
      factors.push({ factor: `${params.rules.minimumTrades} trades required`, impact: 'medium', score: 4 });
    } else if (params.rules.minimumTrades && params.rules.minimumTrades >= 1) {
      score += 2;
      factors.push({ factor: `${params.rules.minimumTrades} trade required`, impact: 'low', score: 2 });
    }

    if (params.rules.minimumWinRate) {
      score += 6;
      factors.push({ factor: `${params.rules.minimumWinRate}% win rate`, impact: 'medium', score: 6 });
    }

    if (params.rules.disqualifyOnLiquidation) {
      score += 6;
      factors.push({ factor: 'Liquidation = DQ', impact: 'medium', score: 6 });
    }
  }

  // 7. Risk Management Rules (0-10 points)
  if (params.riskLimits?.enabled) {
    if (params.riskLimits.maxDrawdownPercent && params.riskLimits.maxDrawdownPercent <= 30) {
      score += 5;
      factors.push({ factor: 'Strict drawdown', impact: 'medium', score: 5 });
    } else if (params.riskLimits.maxDrawdownPercent) {
      score += 2;
      factors.push({ factor: 'Drawdown limits', impact: 'low', score: 2 });
    }

    if (params.riskLimits.dailyLossLimitPercent && params.riskLimits.dailyLossLimitPercent <= 10) {
      score += 3;
      factors.push({ factor: 'Tight daily loss', impact: 'medium', score: 3 });
    }

    if (params.riskLimits.equityCheckEnabled) {
      score += 2;
      factors.push({ factor: 'Equity monitoring', impact: 'low', score: 2 });
    }
  }

  // 8. Level Requirements (0-10 points)
  if (params.levelRequirement?.enabled && params.levelRequirement.minLevel) {
    if (params.levelRequirement.minLevel >= 8) {
      score += 10;
      factors.push({ factor: `Level ${params.levelRequirement.minLevel}+ only`, impact: 'high', score: 10 });
    } else if (params.levelRequirement.minLevel >= 5) {
      score += 6;
      factors.push({ factor: `Level ${params.levelRequirement.minLevel}+ required`, impact: 'medium', score: 6 });
    } else if (params.levelRequirement.minLevel >= 3) {
      score += 3;
      factors.push({ factor: `Level ${params.levelRequirement.minLevel}+ required`, impact: 'low', score: 3 });
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine difficulty level based on score
  let level: DifficultyLevel = 'Novice';
  for (const [key, config] of Object.entries(DIFFICULTY_CONFIG)) {
    if (score >= config.minScore && score <= config.maxScore) {
      level = key as DifficultyLevel;
      break;
    }
  }

  const config = DIFFICULTY_CONFIG[level];

  return {
    level,
    label: config.label,
    score,
    emoji: config.emoji,
    color: config.color,
    bgColor: config.bgColor,
    borderColor: config.borderColor,
    recommendedLevels: config.recommendedLevels,
    factors,
    tips: config.tips,
  };
}

/**
 * Get all difficulty levels for legend/filter
 */
export function getAllDifficultyLevels(): { value: DifficultyLevel; label: string; emoji: string; color: string; bgColor: string; borderColor: string; recommendedLevels: string }[] {
  return Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => ({
    value: key as DifficultyLevel,
    label: config.label,
    emoji: config.emoji,
    color: config.color,
    bgColor: config.bgColor,
    borderColor: config.borderColor,
    recommendedLevels: config.recommendedLevels,
  }));
}
