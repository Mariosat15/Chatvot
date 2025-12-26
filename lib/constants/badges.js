"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBadgeById = exports.getBadgesByRarity = exports.getBadgesByCategory = exports.BADGES = void 0;
exports.BADGES = [
    // COMPETITION BADGES (20)
    { id: 'comp_first_entry', name: 'First Competition', description: 'Joined first competition', category: 'Competition', icon: '🎯', rarity: 'common', condition: { type: 'competitions_entered', value: 1, comparison: 'gte' } },
    { id: 'comp_5_entries', name: 'Competition Regular', description: 'Joined 5 competitions', category: 'Competition', icon: '🎪', rarity: 'common', condition: { type: 'competitions_entered', value: 5, comparison: 'gte' } },
    { id: 'comp_10_entries', name: 'Competition Veteran', description: 'Joined 10 competitions', category: 'Competition', icon: '🎭', rarity: 'rare', condition: { type: 'competitions_entered', value: 10, comparison: 'gte' } },
    { id: 'comp_25_entries', name: 'Competition Master', description: 'Joined 25 competitions', category: 'Competition', icon: '🎬', rarity: 'epic', condition: { type: 'competitions_entered', value: 25, comparison: 'gte' } },
    { id: 'comp_50_entries', name: 'Competition Legend', description: 'Joined 50 competitions', category: 'Competition', icon: '🏛️', rarity: 'legendary', condition: { type: 'competitions_entered', value: 50, comparison: 'gte' } },
    { id: 'comp_first_win', name: 'First Victory', description: 'Won first place', category: 'Competition', icon: '🥇', rarity: 'rare', condition: { type: 'first_place_finishes', value: 1, comparison: 'gte' } },
    { id: 'comp_3_wins', name: 'Champion', description: 'Won 3 times', category: 'Competition', icon: '👑', rarity: 'epic', condition: { type: 'first_place_finishes', value: 3, comparison: 'gte' } },
    { id: 'comp_10_wins', name: 'Dominator', description: 'Won 10 times', category: 'Competition', icon: '⚡', rarity: 'legendary', condition: { type: 'first_place_finishes', value: 10, comparison: 'gte' } },
    { id: 'comp_podium', name: 'Podium Finisher', description: 'Top 3 finish', category: 'Competition', icon: '🏆', rarity: 'common', condition: { type: 'podium_finishes', value: 1, comparison: 'gte' } },
    { id: 'comp_10_podiums', name: 'Podium Regular', description: '10 podium finishes', category: 'Competition', icon: '🎖️', rarity: 'rare', condition: { type: 'podium_finishes', value: 10, comparison: 'gte' } },
    { id: 'comp_25_podiums', name: 'Podium Legend', description: '25 podium finishes', category: 'Competition', icon: '🌟', rarity: 'epic', condition: { type: 'podium_finishes', value: 25, comparison: 'gte' } },
    { id: 'comp_perfect_run', name: 'Perfect Run', description: '100% win rate', category: 'Competition', icon: '💯', rarity: 'legendary', condition: { type: 'perfect_competition_win_rate', value: 100, comparison: 'eq' } },
    { id: 'comp_comeback', name: 'Comeback King', description: 'Won from behind', category: 'Competition', icon: '🔄', rarity: 'rare', condition: { type: 'comeback_victory' } },
    { id: 'comp_wire_to_wire', name: 'Wire to Wire', description: 'Led entire competition', category: 'Competition', icon: '🚀', rarity: 'epic', condition: { type: 'wire_to_wire_win' } },
    { id: 'comp_giant_killer', name: 'Giant Killer', description: 'Beat top traders', category: 'Competition', icon: '⚔️', rarity: 'epic', condition: { type: 'beat_top_trader' } },
    { id: 'comp_underdog', name: 'Underdog Victory', description: 'Won as underdog', category: 'Competition', icon: '🐕', rarity: 'rare', condition: { type: 'underdog_win' } },
    { id: 'comp_clean_sweep', name: 'Clean Sweep', description: 'Won all trades', category: 'Competition', icon: '🧹', rarity: 'legendary', condition: { type: 'perfect_competition_trades' } },
    { id: 'comp_marathon', name: 'Marathon Runner', description: 'Lasted full competition', category: 'Competition', icon: '🏃', rarity: 'common', condition: { type: 'survived_full_competition' } },
    { id: 'comp_early_bird', name: 'Early Bird', description: 'First to trade', category: 'Competition', icon: '🐦', rarity: 'common', condition: { type: 'first_trade_in_comp' } },
    { id: 'comp_night_owl', name: 'Night Owl', description: 'Traded late nights', category: 'Competition', icon: '🦉', rarity: 'common', condition: { type: 'late_night_trader' } },
    // TRADING VOLUME BADGES (15)
    { id: 'trade_first', name: 'First Trade', description: 'Placed first trade', category: 'Volume', icon: '📈', rarity: 'common', condition: { type: 'total_trades', value: 1, comparison: 'gte' } },
    { id: 'trade_10', name: 'Active Trader', description: 'Placed 10 trades', category: 'Volume', icon: '📊', rarity: 'common', condition: { type: 'total_trades', value: 10, comparison: 'gte' } },
    { id: 'trade_50', name: 'Frequent Trader', description: 'Placed 50 trades', category: 'Volume', icon: '💹', rarity: 'common', condition: { type: 'total_trades', value: 50, comparison: 'gte' } },
    { id: 'trade_100', name: 'Century Mark', description: 'Placed 100 trades', category: 'Volume', icon: '💯', rarity: 'rare', condition: { type: 'total_trades', value: 100, comparison: 'gte' } },
    { id: 'trade_500', name: 'Heavy Trader', description: 'Placed 500 trades', category: 'Volume', icon: '🔥', rarity: 'epic', condition: { type: 'total_trades', value: 500, comparison: 'gte' } },
    { id: 'trade_1000', name: 'Trading Machine', description: 'Placed 1000 trades', category: 'Volume', icon: '🤖', rarity: 'legendary', condition: { type: 'total_trades', value: 1000, comparison: 'gte' } },
    { id: 'trade_2500', name: 'High Volume', description: 'Placed 2500 trades', category: 'Volume', icon: '📡', rarity: 'legendary', condition: { type: 'total_trades', value: 2500, comparison: 'gte' } },
    { id: 'trade_5000', name: 'Ultra Trader', description: 'Placed 5000 trades', category: 'Volume', icon: '🌠', rarity: 'legendary', condition: { type: 'total_trades', value: 5000, comparison: 'gte' } },
    { id: 'trade_day_trader', name: 'Day Trader', description: '10+ trades daily', category: 'Volume', icon: '☀️', rarity: 'rare', condition: { type: 'daily_trade_volume', value: 10, comparison: 'gte' } },
    { id: 'trade_scalper', name: 'Scalper', description: '50+ trades daily', category: 'Volume', icon: '⚡', rarity: 'epic', condition: { type: 'daily_trade_volume', value: 50, comparison: 'gte' } },
    { id: 'trade_marathon_session', name: 'Marathon Session', description: '100+ trades single day', category: 'Volume', icon: '🏃‍♂️', rarity: 'legendary', condition: { type: 'single_day_trades', value: 100, comparison: 'gte' } },
    { id: 'trade_busy_week', name: 'Busy Week', description: '100+ trades weekly', category: 'Volume', icon: '📅', rarity: 'rare', condition: { type: 'weekly_trade_volume', value: 100, comparison: 'gte' } },
    { id: 'trade_monthly_grind', name: 'Monthly Grinder', description: '500+ trades monthly', category: 'Volume', icon: '🗓️', rarity: 'epic', condition: { type: 'monthly_trade_volume', value: 500, comparison: 'gte' } },
    { id: 'trade_diverse', name: 'Diverse Trader', description: 'Traded 10+ pairs', category: 'Volume', icon: '🌍', rarity: 'rare', condition: { type: 'unique_pairs_traded', value: 10, comparison: 'gte' } },
    { id: 'trade_specialist', name: 'Pair Specialist', description: '100+ trades one pair', category: 'Volume', icon: '🎯', rarity: 'rare', condition: { type: 'single_pair_focus', value: 100, comparison: 'gte' } },
    // PROFIT & LOSS BADGES (20)
    { id: 'profit_first', name: 'First Profit', description: 'First winning trade', category: 'Profit', icon: '💚', rarity: 'common', condition: { type: 'winning_trades', value: 1, comparison: 'gte' } },
    { id: 'profit_positive', name: 'In The Green', description: 'Positive total P&L', category: 'Profit', icon: '🟢', rarity: 'common', condition: { type: 'total_pnl_positive' } },
    { id: 'profit_1k', name: 'Thousand Club', description: '+1,000 total P&L', category: 'Profit', icon: '💵', rarity: 'rare', condition: { type: 'total_pnl', value: 1000, comparison: 'gte' } },
    { id: 'profit_5k', name: 'Five K Club', description: '+5,000 total P&L', category: 'Profit', icon: '💰', rarity: 'epic', condition: { type: 'total_pnl', value: 5000, comparison: 'gte' } },
    { id: 'profit_10k', name: 'Ten K Club', description: '+10,000 total P&L', category: 'Profit', icon: '💎', rarity: 'legendary', condition: { type: 'total_pnl', value: 10000, comparison: 'gte' } },
    { id: 'profit_big_win', name: 'Big Winner', description: '+500 single trade', category: 'Profit', icon: '🎰', rarity: 'rare', condition: { type: 'single_trade_profit', value: 500, comparison: 'gte' } },
    { id: 'profit_huge_win', name: 'Huge Winner', description: '+1000 single trade', category: 'Profit', icon: '🏅', rarity: 'epic', condition: { type: 'single_trade_profit', value: 1000, comparison: 'gte' } },
    { id: 'profit_massive_win', name: 'Massive Winner', description: '+2500 single trade', category: 'Profit', icon: '🌟', rarity: 'legendary', condition: { type: 'single_trade_profit', value: 2500, comparison: 'gte' } },
    { id: 'profit_win_streak_5', name: 'Win Streak', description: '5 wins streak', category: 'Profit', icon: '🔥', rarity: 'common', condition: { type: 'win_streak', value: 5, comparison: 'gte' } },
    { id: 'profit_win_streak_10', name: 'Hot Streak', description: '10 wins streak', category: 'Profit', icon: '🌡️', rarity: 'rare', condition: { type: 'win_streak', value: 10, comparison: 'gte' } },
    { id: 'profit_win_streak_20', name: 'Unstoppable', description: '20 wins streak', category: 'Profit', icon: '🚀', rarity: 'epic', condition: { type: 'win_streak', value: 20, comparison: 'gte' } },
    { id: 'profit_win_streak_50', name: 'Legendary Streak', description: '50 wins streak', category: 'Profit', icon: '👑', rarity: 'legendary', condition: { type: 'win_streak', value: 50, comparison: 'gte' } },
    { id: 'profit_roi_50', name: 'Good Returns', description: '50%+ ROI', category: 'Profit', icon: '📈', rarity: 'rare', condition: { type: 'average_roi', value: 50, comparison: 'gte' } },
    { id: 'profit_roi_100', name: 'Double Up', description: '100%+ ROI', category: 'Profit', icon: '💹', rarity: 'epic', condition: { type: 'average_roi', value: 100, comparison: 'gte' } },
    { id: 'profit_roi_200', name: 'Triple Threat', description: '200%+ ROI', category: 'Profit', icon: '🎯', rarity: 'legendary', condition: { type: 'average_roi', value: 200, comparison: 'gte' } },
    { id: 'profit_factor_2', name: 'Profitable Trader', description: '2.0+ profit factor', category: 'Profit', icon: '✨', rarity: 'rare', condition: { type: 'profit_factor', value: 2, comparison: 'gte' } },
    { id: 'profit_factor_3', name: 'Elite Trader', description: '3.0+ profit factor', category: 'Profit', icon: '⭐', rarity: 'epic', condition: { type: 'profit_factor', value: 3, comparison: 'gte' } },
    { id: 'profit_factor_5', name: 'Master Trader', description: '5.0+ profit factor', category: 'Profit', icon: '🌟', rarity: 'legendary', condition: { type: 'profit_factor', value: 5, comparison: 'gte' } },
    { id: 'profit_daily_green', name: 'Daily Green', description: 'Profitable every day', category: 'Profit', icon: '🌱', rarity: 'epic', condition: { type: 'consecutive_profitable_days', value: 7, comparison: 'gte' } },
    { id: 'profit_recovery', name: 'Recovery Master', description: 'Recovered from loss', category: 'Profit', icon: '🔄', rarity: 'rare', condition: { type: 'drawdown_recovery' } },
    // RISK MANAGEMENT BADGES (15)
    { id: 'risk_survivor', name: 'Survivor', description: 'Avoided liquidation once', category: 'Risk', icon: '🛡️', rarity: 'common', condition: { type: 'no_liquidations', value: 1, comparison: 'eq' } },
    { id: 'risk_iron_man', name: 'Iron Defense', description: 'Never liquidated ever', category: 'Risk', icon: '🦾', rarity: 'epic', condition: { type: 'zero_liquidations_lifetime' } },
    { id: 'risk_low_drawdown', name: 'Controlled Risk', description: 'Max 10% drawdown', category: 'Risk', icon: '📉', rarity: 'rare', condition: { type: 'max_drawdown', value: 10, comparison: 'lte' } },
    { id: 'risk_minimal_loss', name: 'Minimal Losses', description: 'Small average loss', category: 'Risk', icon: '🔒', rarity: 'rare', condition: { type: 'average_loss_small' } },
    { id: 'risk_stop_master', name: 'Stop Loss Master', description: 'Always uses stops', category: 'Risk', icon: '🛑', rarity: 'rare', condition: { type: 'always_uses_sl' } },
    { id: 'risk_tp_master', name: 'Take Profit Pro', description: 'Always uses TPs', category: 'Risk', icon: '🎯', rarity: 'rare', condition: { type: 'always_uses_tp' } },
    { id: 'risk_disciplined', name: 'Disciplined Trader', description: 'Follows risk rules', category: 'Risk', icon: '📏', rarity: 'epic', condition: { type: 'risk_discipline' } },
    { id: 'risk_low_leverage', name: 'Conservative', description: 'Low leverage use', category: 'Risk', icon: '🐢', rarity: 'common', condition: { type: 'average_leverage_low' } },
    { id: 'risk_balanced', name: 'Balanced Trader', description: 'Optimal risk/reward', category: 'Risk', icon: '⚖️', rarity: 'rare', condition: { type: 'balanced_risk_reward' } },
    { id: 'risk_sharp', name: 'Sharp Trader', description: 'High Sharpe ratio', category: 'Risk', icon: '🔪', rarity: 'epic', condition: { type: 'sharpe_ratio_high' } },
    { id: 'risk_steady', name: 'Steady Eddie', description: 'Low volatility', category: 'Risk', icon: '🧘', rarity: 'rare', condition: { type: 'low_volatility' } },
    { id: 'risk_calculated', name: 'Calculated Risk', description: 'Smart position sizing', category: 'Risk', icon: '🧮', rarity: 'rare', condition: { type: 'optimal_position_sizing' } },
    { id: 'risk_diversified', name: 'Diversified', description: 'Multiple strategies', category: 'Risk', icon: '🌈', rarity: 'rare', condition: { type: 'strategy_diversity' } },
    { id: 'risk_hedger', name: 'Hedge Master', description: 'Uses hedging', category: 'Risk', icon: '🧩', rarity: 'epic', condition: { type: 'hedging_strategy' } },
    { id: 'risk_safe_haven', name: 'Safe Haven', description: 'Low max drawdown', category: 'Risk', icon: '⚓', rarity: 'epic', condition: { type: 'exceptional_dd_control' } },
    // SPEED & EXECUTION BADGES (12)
    { id: 'speed_quick', name: 'Quick Draw', description: 'Fast order entry', category: 'Speed', icon: '⚡', rarity: 'common', condition: { type: 'fast_order_execution' } },
    { id: 'speed_lightning', name: 'Lightning Fast', description: 'Sub-second execution', category: 'Speed', icon: '🌩️', rarity: 'rare', condition: { type: 'ultra_fast_execution' } },
    { id: 'speed_scalp_master', name: 'Scalp Master', description: 'Sub-minute trades', category: 'Speed', icon: '⏱️', rarity: 'epic', condition: { type: 'quick_scalps' } },
    { id: 'speed_day_closer', name: 'Day Closer', description: 'Closes all daily', category: 'Speed', icon: '🌙', rarity: 'rare', condition: { type: 'closes_all_daily' } },
    { id: 'speed_swing_trader', name: 'Swing Trader', description: 'Multi-day holds', category: 'Speed', icon: '🏌️', rarity: 'common', condition: { type: 'swing_trading_style' } },
    { id: 'speed_position_trader', name: 'Position Trader', description: 'Week+ holds', category: 'Speed', icon: '🏰', rarity: 'rare', condition: { type: 'position_trading_style' } },
    { id: 'speed_sniper', name: 'Sniper', description: 'Precise entries', category: 'Speed', icon: '🎯', rarity: 'epic', condition: { type: 'precise_entry_timing' } },
    { id: 'speed_ninja', name: 'Trading Ninja', description: 'In-out quickly', category: 'Speed', icon: '🥷', rarity: 'rare', condition: { type: 'ninja_trading' } },
    { id: 'speed_patient', name: 'Patient Trader', description: 'Waits for setup', category: 'Speed', icon: '🧘‍♂️', rarity: 'rare', condition: { type: 'patient_trading' } },
    { id: 'speed_market_open', name: 'Market Opener', description: 'Trades at open', category: 'Speed', icon: '🔔', rarity: 'common', condition: { type: 'trades_at_open' } },
    { id: 'speed_market_close', name: 'Market Closer', description: 'Trades at close', category: 'Speed', icon: '🔕', rarity: 'common', condition: { type: 'trades_at_close' } },
    { id: 'speed_24_7', name: '24/7 Trader', description: 'All hours trading', category: 'Speed', icon: '🌍', rarity: 'epic', condition: { type: 'trades_all_hours' } },
    // CONSISTENCY BADGES (10)
    { id: 'consist_daily', name: 'Daily Consistency', description: 'Trades every day', category: 'Consistency', icon: '📅', rarity: 'rare', condition: { type: 'daily_trading_streak', value: 7, comparison: 'gte' } },
    { id: 'consist_weekly', name: 'Weekly Warrior', description: '4 weeks straight', category: 'Consistency', icon: '📆', rarity: 'epic', condition: { type: 'weekly_trading_streak', value: 4, comparison: 'gte' } },
    { id: 'consist_monthly', name: 'Monthly Grinder', description: '3 months straight', category: 'Consistency', icon: '🗓️', rarity: 'legendary', condition: { type: 'monthly_trading_streak', value: 3, comparison: 'gte' } },
    { id: 'consist_win_rate_60', name: 'Consistent Winner', description: '60%+ win rate', category: 'Consistency', icon: '✅', rarity: 'rare', condition: { type: 'win_rate', value: 60, comparison: 'gte' } },
    { id: 'consist_win_rate_70', name: 'Elite Winner', description: '70%+ win rate', category: 'Consistency', icon: '🎖️', rarity: 'epic', condition: { type: 'win_rate', value: 70, comparison: 'gte' } },
    { id: 'consist_win_rate_80', name: 'Master Winner', description: '80%+ win rate', category: 'Consistency', icon: '👑', rarity: 'legendary', condition: { type: 'win_rate', value: 80, comparison: 'gte' } },
    { id: 'consist_stable', name: 'Stable Returns', description: 'Low variance', category: 'Consistency', icon: '📊', rarity: 'rare', condition: { type: 'low_return_variance' } },
    { id: 'consist_reliable', name: 'Reliable Trader', description: 'Predictable results', category: 'Consistency', icon: '🎯', rarity: 'epic', condition: { type: 'predictable_results' } },
    { id: 'consist_never_miss', name: 'Never Miss', description: 'Always active', category: 'Consistency', icon: '🔥', rarity: 'legendary', condition: { type: 'perfect_attendance' } },
    { id: 'consist_grind', name: 'The Grind', description: '30+ day streak', category: 'Consistency', icon: '💪', rarity: 'legendary', condition: { type: 'daily_trading_streak', value: 30, comparison: 'gte' } },
    // STRATEGY BADGES (10)
    { id: 'strat_trend', name: 'Trend Follower', description: 'Follows trends', category: 'Strategy', icon: '📈', rarity: 'common', condition: { type: 'trend_following' } },
    { id: 'strat_counter', name: 'Counter Trader', description: 'Trades reversals', category: 'Strategy', icon: '🔄', rarity: 'rare', condition: { type: 'counter_trend' } },
    { id: 'strat_breakout', name: 'Breakout King', description: 'Breakout specialist', category: 'Strategy', icon: '💥', rarity: 'rare', condition: { type: 'breakout_trading' } },
    { id: 'strat_range', name: 'Range Trader', description: 'Range bound', category: 'Strategy', icon: '📏', rarity: 'common', condition: { type: 'range_trading' } },
    { id: 'strat_momentum', name: 'Momentum Trader', description: 'Rides momentum', category: 'Strategy', icon: '🚀', rarity: 'rare', condition: { type: 'momentum_trading' } },
    { id: 'strat_mean_reversion', name: 'Mean Reverter', description: 'Mean reversion', category: 'Strategy', icon: '⚖️', rarity: 'rare', condition: { type: 'mean_reversion' } },
    { id: 'strat_news', name: 'News Trader', description: 'Trades news', category: 'Strategy', icon: '📰', rarity: 'epic', condition: { type: 'news_trading' } },
    { id: 'strat_technical', name: 'Technical Analyst', description: 'TA focused', category: 'Strategy', icon: '📊', rarity: 'common', condition: { type: 'technical_analysis' } },
    { id: 'strat_versatile', name: 'Versatile Trader', description: 'Multiple strategies', category: 'Strategy', icon: '🎭', rarity: 'epic', condition: { type: 'multiple_strategies' } },
    { id: 'strat_original', name: 'Original Style', description: 'Unique approach', category: 'Strategy', icon: '🎨', rarity: 'legendary', condition: { type: 'unique_strategy' } },
    // SOCIAL & ACHIEVEMENT BADGES (8)
    { id: 'social_early_adopter', name: 'Early Adopter', description: 'Joined early', category: 'Social', icon: '🌟', rarity: 'rare', condition: { type: 'early_adopter' } },
    { id: 'social_veteran', name: 'Platform Veteran', description: '6 months active', category: 'Social', icon: '🎖️', rarity: 'epic', condition: { type: 'platform_age', value: 180, comparison: 'gte' } },
    { id: 'social_og', name: 'OG Trader', description: '1 year active', category: 'Social', icon: '👴', rarity: 'legendary', condition: { type: 'platform_age', value: 365, comparison: 'gte' } },
    { id: 'social_deposit', name: 'First Deposit', description: 'Made first deposit', category: 'Social', icon: '💳', rarity: 'common', condition: { type: 'first_deposit' } },
    { id: 'social_whale', name: 'High Roller', description: 'Large deposits', category: 'Social', icon: '🐋', rarity: 'epic', condition: { type: 'total_deposited', value: 1000, comparison: 'gte' } },
    { id: 'social_cashout', name: 'Cash Out King', description: 'Withdrew profits', category: 'Social', icon: '💰', rarity: 'rare', condition: { type: 'withdrawal_made' } },
    { id: 'social_big_cashout', name: 'Big Winner Cashout', description: 'Large withdrawal', category: 'Social', icon: '💎', rarity: 'epic', condition: { type: 'large_withdrawal' } },
    { id: 'social_net_positive', name: 'Net Positive', description: 'Withdrew more deposited', category: 'Social', icon: '📈', rarity: 'legendary', condition: { type: 'net_profit_lifetime' } },
    // LEGENDARY BADGES (10)
    { id: 'legend_perfect_month', name: 'Perfect Month', description: 'Flawless 30 days', category: 'Legendary', icon: '👑', rarity: 'legendary', condition: { type: 'perfect_month' } },
    { id: 'legend_million', name: 'Millionaire', description: '1M total profit', category: 'Legendary', icon: '💰', rarity: 'legendary', condition: { type: 'total_pnl', value: 1000000, comparison: 'gte' } },
    { id: 'legend_rank_1', name: 'Global Champion', description: 'Rank #1 global', category: 'Legendary', icon: '🌟', rarity: 'legendary', condition: { type: 'global_rank', value: 1, comparison: 'eq' } },
    { id: 'legend_top_10', name: 'Top 10 Trader', description: 'Top 10 global', category: 'Legendary', icon: '⭐', rarity: 'legendary', condition: { type: 'global_rank', value: 10, comparison: 'lte' } },
    { id: 'legend_top_100', name: 'Elite 100', description: 'Top 100 global', category: 'Legendary', icon: '✨', rarity: 'legendary', condition: { type: 'global_rank', value: 100, comparison: 'lte' } },
    { id: 'legend_undefeated', name: 'Undefeated', description: '100% competition wins', category: 'Legendary', icon: '🛡️', rarity: 'legendary', condition: { type: 'undefeated_in_comps' } },
    { id: 'legend_comeback', name: 'Phoenix Trader', description: 'Epic recovery', category: 'Legendary', icon: '🔥', rarity: 'legendary', condition: { type: 'epic_comeback' } },
    { id: 'legend_perfect_year', name: 'Perfect Year', description: 'Profitable 365 days', category: 'Legendary', icon: '🏆', rarity: 'legendary', condition: { type: 'perfect_year' } },
    { id: 'legend_hall_of_fame', name: 'Hall of Fame', description: 'All-time great', category: 'Legendary', icon: '🏛️', rarity: 'legendary', condition: { type: 'hall_of_fame_status' } },
    { id: 'legend_immortal', name: 'Immortal Trader', description: 'Ultimate achievement', category: 'Legendary', icon: '👑', rarity: 'legendary', condition: { type: 'all_legendary_badges' } },
];
// Helper function to get badges by category
const getBadgesByCategory = (category) => {
    return exports.BADGES.filter(badge => badge.category === category);
};
exports.getBadgesByCategory = getBadgesByCategory;
// Helper function to get badges by rarity
const getBadgesByRarity = (rarity) => {
    return exports.BADGES.filter(badge => badge.rarity === rarity);
};
exports.getBadgesByRarity = getBadgesByRarity;
// Helper to get badge by ID
const getBadgeById = (id) => {
    return exports.BADGES.find(badge => badge.id === id);
};
exports.getBadgeById = getBadgeById;
//# sourceMappingURL=badges.js.map