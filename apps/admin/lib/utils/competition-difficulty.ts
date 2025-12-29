/**
 * Competition Difficulty Calculator
 * 
 * Analyzes competition parameters to determine difficulty level
 * and provides visual indicators for users
 */

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Extreme';

export interface DifficultyFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  score: number;
}

export interface DifficultyAnalysis {
  level: DifficultyLevel;
  score: number; // 0-100
  factors: DifficultyFactor[];
}

interface CompetitionParams {
  entryFee?: number;
  startingCapital?: number;
  maxLeverage?: number;
  duration?: number; // in minutes
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
  if (params.entryFee !== undefined) {
    if (params.entryFee <= 5) {
      score += 2;
      factors.push({ factor: 'Low entry fee', impact: 'low', score: 2 });
    } else if (params.entryFee <= 20) {
      score += 5;
      factors.push({ factor: 'Moderate entry fee', impact: 'low', score: 5 });
    } else if (params.entryFee <= 50) {
      score += 10;
      factors.push({ factor: 'Higher entry fee', impact: 'medium', score: 10 });
    } else if (params.entryFee <= 100) {
      score += 12;
      factors.push({ factor: 'Premium entry fee', impact: 'medium', score: 12 });
    } else {
      score += 15;
      factors.push({ factor: 'High-stakes entry', impact: 'high', score: 15 });
    }
  }

  // 2. Starting Capital Analysis (0-10 points)
  if (params.startingCapital) {
    if (params.startingCapital <= 1000) {
      score += 10;
      factors.push({ factor: 'Limited capital', impact: 'high', score: 10 });
    } else if (params.startingCapital <= 5000) {
      score += 6;
      factors.push({ factor: 'Moderate capital', impact: 'medium', score: 6 });
    } else if (params.startingCapital <= 10000) {
      score += 3;
      factors.push({ factor: 'Comfortable capital', impact: 'low', score: 3 });
    }
  }

  // 3. Leverage Analysis (0-15 points)
  if (params.maxLeverage) {
    if (params.maxLeverage <= 10) {
      score += 2;
      factors.push({ factor: 'Conservative leverage', impact: 'low', score: 2 });
    } else if (params.maxLeverage <= 50) {
      score += 5;
      factors.push({ factor: 'Moderate leverage', impact: 'low', score: 5 });
    } else if (params.maxLeverage <= 100) {
      score += 8;
      factors.push({ factor: 'Standard leverage', impact: 'medium', score: 8 });
    } else if (params.maxLeverage <= 200) {
      score += 12;
      factors.push({ factor: 'High leverage', impact: 'medium', score: 12 });
    } else {
      score += 15;
      factors.push({ factor: 'Extreme leverage', impact: 'high', score: 15 });
    }
  }

  // 4. Duration Analysis (0-10 points)
  if (params.duration) {
    const hours = params.duration / 60;
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
  }

  // 5. Rules Complexity (0-15 points)
  if (params.rules) {
    if (params.rules.minimumTrades && params.rules.minimumTrades >= 10) {
      score += 5;
      factors.push({ factor: `${params.rules.minimumTrades}+ trades required`, impact: 'medium', score: 5 });
    } else if (params.rules.minimumTrades && params.rules.minimumTrades >= 5) {
      score += 3;
      factors.push({ factor: `${params.rules.minimumTrades} trades required`, impact: 'low', score: 3 });
    }

    if (params.rules.minimumWinRate) {
      score += 5;
      factors.push({ factor: `${params.rules.minimumWinRate}% win rate`, impact: 'medium', score: 5 });
    }

    if (params.rules.disqualifyOnLiquidation) {
      score += 5;
      factors.push({ factor: 'Liquidation = DQ', impact: 'medium', score: 5 });
    }
  }

  // 6. Risk Management Rules (0-10 points)
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
      factors.push({ factor: 'Tight daily loss limit', impact: 'medium', score: 3 });
    }

    if (params.riskLimits.equityCheckEnabled) {
      score += 2;
      factors.push({ factor: 'Equity monitoring', impact: 'low', score: 2 });
    }
  }

  // 7. Level Requirements (0-10 points)
  if (params.levelRequirement?.enabled && params.levelRequirement.minLevel) {
    if (params.levelRequirement.minLevel >= 5) {
      score += 10;
      factors.push({ factor: `Level ${params.levelRequirement.minLevel}+ required`, impact: 'high', score: 10 });
    } else if (params.levelRequirement.minLevel >= 3) {
      score += 5;
      factors.push({ factor: 'Intermediate level required', impact: 'medium', score: 5 });
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine difficulty level
  let level: DifficultyLevel = 'Beginner';
  if (score <= 20) {
    level = 'Beginner';
  } else if (score <= 40) {
    level = 'Intermediate';
  } else if (score <= 60) {
    level = 'Advanced';
  } else if (score <= 80) {
    level = 'Expert';
  } else {
    level = 'Extreme';
  }

  return {
    level,
    score,
    factors,
  };
}

/**
 * Get all difficulty levels for legend/filter
 */
export function getAllDifficultyLevels(): DifficultyLevel[] {
  return ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Extreme'];
}

