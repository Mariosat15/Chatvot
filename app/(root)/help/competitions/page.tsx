import { Trophy, Target, Users, Award, TrendingUp, BarChart3, Percent, Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function CompetitionsHelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-800 to-dark-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 shadow-2xl border border-primary-500/20">
          <div className="flex items-center gap-4 mb-4">
            <Trophy className="h-12 w-12 text-yellow-300" />
            <div>
              <h1 className="text-4xl font-bold text-white">Competition Guide</h1>
              <p className="text-primary-200 mt-2">Everything you need to know about trading competitions</p>
            </div>
          </div>
        </div>

        {/* What are Competitions */}
        <section className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <Target className="h-6 w-6 text-primary-500" />
            What are Trading Competitions?
          </h2>
          <p className="text-dark-200 mb-4">
            Trading competitions are time-limited events where traders compete against each other using virtual trading points.
            The best performers win prizes in credits, which can be used for future competitions or withdrawn to real EUR.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="text-2xl mb-2">💰</div>
              <h3 className="font-semibold text-white mb-1">Entry Fee</h3>
              <p className="text-sm text-dark-300">Pay credits to enter. Entry fees form the prize pool.</p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-semibold text-white mb-1">Virtual Trading</h3>
              <p className="text-sm text-dark-300">Trade with virtual points. Real market prices, no real money risk.</p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="text-2xl mb-2">🏆</div>
              <h3 className="font-semibold text-white mb-1">Win Prizes</h3>
              <p className="text-sm text-dark-300">Top performers split the prize pool based on rankings.</p>
            </div>
          </div>
        </section>

        {/* Ranking Methods */}
        <section className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-yellow-500" />
            Ranking Methods
          </h2>
          <p className="text-dark-200 mb-6">
            Each competition uses one of these methods to determine winners. Check the competition details before entering!
          </p>
          
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-500/10 to-green-600/5 rounded-xl p-4 border border-green-500/20">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-400 mb-1">Highest P&L (Default)</h3>
                  <p className="text-sm text-dark-200">
                    Winner has the highest <strong>Profit & Loss</strong>. Most common method.
                  </p>
                  <p className="text-xs text-green-300/60 mt-2">
                    Example: User A has +$5,000 P&L, User B has +$4,500 P&L → User A wins
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600">
              <div className="flex items-start gap-3">
                <Percent className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-400 mb-1">Highest ROI %</h3>
                  <p className="text-sm text-dark-200">
                    Winner has the highest <strong>Return on Investment percentage</strong>. Rewards efficiency over absolute gains.
                  </p>
                  <p className="text-xs text-blue-300/60 mt-2">
                    Example: User A has +50% ROI, User B has +45% ROI → User A wins
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-purple-400 mb-1">Highest Capital</h3>
                  <p className="text-sm text-dark-200">
                    Winner has the highest <strong>total capital</strong> (starting balance + P&L).
                  </p>
                  <p className="text-xs text-purple-300/60 mt-2">
                    Example: Starting with $10,000, User A has $15,000, User B has $14,500 → User A wins
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-400 mb-1">Highest Win Rate</h3>
                  <p className="text-sm text-dark-200">
                    Winner has the highest <strong>win rate percentage</strong>. Rewards consistency.
                  </p>
                  <p className="text-xs text-amber-300/60 mt-2">
                    Example: User A has 75% win rate (15W/5L), User B has 70% (14W/6L) → User A wins
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-cyan-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-cyan-400 mb-1">Most Winning Trades</h3>
                  <p className="text-sm text-dark-200">
                    Winner has the <strong>most winning trades</strong>. Rewards active trading.
                  </p>
                  <p className="text-xs text-cyan-300/60 mt-2">
                    Example: User A has 25 winning trades, User B has 20 winning trades → User A wins
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600">
              <div className="flex items-start gap-3">
                <Activity className="h-5 w-5 text-pink-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-pink-400 mb-1">Best Profit Factor</h3>
                  <p className="text-sm text-dark-200">
                    Winner has the best <strong>profit factor</strong> (total wins / total losses). Advanced metric for risk management.
                  </p>
                  <p className="text-xs text-pink-300/60 mt-2">
                    Example: User A has PF of 3.5, User B has PF of 2.8 → User A wins
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tie-Breaking Rules */}
        <section className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <Users className="h-6 w-6 text-amber-500" />
            What Happens if There&apos;s a Tie?
          </h2>
          <p className="text-dark-200 mb-6">
            When two or more traders have identical performance, the competition uses tiebreaker rules:
          </p>

          <div className="space-y-3 mb-6">
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <h3 className="font-semibold text-white mb-2">1️⃣ First Tiebreaker</h3>
              <p className="text-sm text-dark-300">
                Common options: Fewer trades (more efficient), higher win rate, higher capital, or who joined first.
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <h3 className="font-semibold text-white mb-2">2️⃣ Second Tiebreaker (Optional)</h3>
              <p className="text-sm text-dark-300">
                If still tied, a second tiebreaker is applied using a different metric.
              </p>
            </div>
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <h3 className="font-semibold text-white mb-2">💰 Prize Distribution</h3>
              <p className="text-sm text-dark-300">
                <strong>Split Equally:</strong> Tied participants split the combined prizes equally.<br/>
                <strong>Example:</strong> 2 users tied for Rank 1 (70%) and Rank 2 (20%) = 90% ÷ 2 = 45% each
              </p>
            </div>
          </div>
        </section>

        {/* Qualification Requirements */}
        <section className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Qualification Requirements
          </h2>
          <p className="text-dark-200 mb-6">
            Some competitions have minimum requirements to qualify for prizes. Check these before trading!
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-white">Minimum Trades</h3>
              </div>
              <p className="text-sm text-dark-300">
                Must complete X trades to qualify for prizes. Prevents single-trade luck.
              </p>
              <p className="text-xs text-blue-300/60 mt-2">
                Example: If minimum is 10 trades and you only made 8, you&apos;re disqualified.
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-white">Minimum Win Rate</h3>
              </div>
              <p className="text-sm text-dark-300">
                Must maintain X% win rate to qualify. Rare, but rewards consistency.
              </p>
              <p className="text-xs text-amber-300/60 mt-2">
                Example: If minimum is 40% and you have 35%, you&apos;re disqualified.
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <h3 className="font-semibold text-white">Liquidation</h3>
              </div>
              <p className="text-sm text-dark-300">
                If you get liquidated (margin call), you&apos;re usually disqualified from prizes.
              </p>
              <p className="text-xs text-red-300/60 mt-2">
                Manage your risk! Keep your margin level above the stopout threshold.
              </p>
            </div>

            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-white">Other Rules</h3>
              </div>
              <p className="text-sm text-dark-300">
                Each competition may have unique rules. Always read the full details!
              </p>
            </div>
          </div>
        </section>

        {/* How to Win */}
        <section className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 rounded-2xl p-6 shadow-xl border border-yellow-500/20">
          <h2 className="text-2xl font-bold text-yellow-400 mb-4 flex items-center gap-3">
            <Trophy className="h-6 w-6" />
            Tips to Win Competitions
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-white mb-2">✅ Do:</h3>
              <ul className="space-y-2 text-sm text-dark-200">
                <li>• Understand the ranking method before entering</li>
                <li>• Meet minimum trade requirements</li>
                <li>• Manage risk to avoid liquidation</li>
                <li>• Trade according to the competition's goals</li>
                <li>• Check the leaderboard regularly</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">❌ Don't:</h3>
              <ul className="space-y-2 text-sm text-dark-200">
                <li>• Over-leverage and risk liquidation</li>
                <li>• Ignore minimum trade requirements</li>
                <li>• Trade without a strategy</li>
                <li>• Panic trade if you&apos;re behind</li>
                <li>• Forget to close positions before end</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 shadow-2xl border border-primary-500/20 text-center">
          <Trophy className="h-16 w-16 text-yellow-300 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Ready to Compete?</h2>
          <p className="text-primary-200 mb-6">
            Browse active competitions and start trading today!
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/competitions"
              className="px-8 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-colors"
            >
              View Competitions
            </Link>
            <Link
              href="/profile"
              className="px-8 py-3 bg-primary-800 text-white font-semibold rounded-lg hover:bg-primary-900 transition-colors border border-white/20"
            >
              View Your Stats
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <div className="bg-dark-800/30 rounded-xl p-4 border border-dark-600">
          <p className="text-sm text-dark-400 text-center">
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Competition rules may vary. Always check the specific competition details before entering.
          </p>
        </div>
      </div>
    </div>
  );
}

