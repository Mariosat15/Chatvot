'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Loader2, Medal, Crown, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingTheme } from '@/lib/themes/landing-themes';
import SectionWrapper from './SectionWrapper';

interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar?: string;
  totalWinnings: number;
  winRate: number;
  competitionsWon: number;
  challengesWon: number;
}

interface LeaderboardPreviewProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
}

const rankEmojis = ['🥇', '🥈', '🥉'];
const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardPreview({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
}: LeaderboardPreviewProps) {
  const effectiveColors = {
    primary: propColors?.primary || '#00f0ff',
    secondary: propColors?.secondary || '#ff00ff',
    accent: propColors?.accent || '#ffd700',
    text: propColors?.text || '#ffffff',
  };
  const effectiveHeadingFont = propFont || 'inherit';
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/landing/leaderboard-preview');
        if (response.ok) {
          const data = await response.json();
          setLeaderboard(data.leaderboard || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLeaderboard, 300000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  return (
    <SectionWrapper
      id="leaderboard"
      backgroundStyle={{
        background: `linear-gradient(180deg, transparent, ${effectiveColors.primary}08, transparent)`,
      }}
    >
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
          style={{ 
            backgroundColor: '#FFD70015',
            border: '1px solid #FFD70030',
            color: '#FFD700',
          }}
        >
          <Crown className="h-4 w-4" />
          Top Traders
        </div>
        
        <h2 
          className="text-4xl md:text-5xl font-black mb-6"
          style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
        >
          Meet Our{' '}
          <span 
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: theme?.effects?.gradientStyle }}
          >
            Champions
          </span>
        </h2>
        
        <p 
          className="text-lg leading-relaxed"
          style={{ color: theme?.colors?.textMuted }}
        >
          These elite traders have proven their skills in our competitions. Will you join them?
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: effectiveColors.primary }} />
        </div>
      ) : leaderboard.length === 0 ? (
        <div 
          className="max-w-md mx-auto p-8 rounded-2xl text-center"
          style={{ 
            backgroundColor: theme?.colors?.backgroundCard,
            border: `1px solid ${theme?.colors?.border}`,
          }}
        >
          <Crown className="h-12 w-12 mx-auto mb-4" style={{ color: '#FFD700' }} />
          <h4 className="font-bold text-lg mb-2" style={{ color: effectiveColors.text }}>
            Leaderboard Coming Soon!
          </h4>
          <p style={{ color: theme?.colors?.textMuted }}>
            Be one of the first champions to appear on our leaderboard.
          </p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* Podium for top 3 */}
          <div className="hidden md:flex justify-center items-end gap-4 mb-12">
            {/* 2nd Place */}
            {leaderboard[1] && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="w-64"
              >
                <div 
                  className="relative p-6 rounded-t-2xl text-center h-[200px] flex flex-col justify-end"
                  style={{ 
                    background: `linear-gradient(180deg, ${rankColors[1]}20, ${rankColors[1]}08)`,
                    border: `1px solid ${rankColors[1]}30`,
                    borderBottom: 'none',
                  }}
                >
                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-4xl">{rankEmojis[1]}</span>
                  <div 
                    className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl"
                    style={{ 
                      background: `linear-gradient(135deg, ${rankColors[1]}40, ${rankColors[1]}20)`,
                      border: `2px solid ${rankColors[1]}`,
                    }}
                  >
                    {leaderboard[1].avatar ? (
                      <img src={leaderboard[1].avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <h4 className="font-bold truncate" style={{ color: effectiveColors.text }}>
                    {leaderboard[1].username}
                  </h4>
                  <p className="text-lg font-black" style={{ color: rankColors[1] }}>
                    {formatCurrency(leaderboard[1].totalWinnings)}
                  </p>
                </div>
                <div 
                  className="h-[80px] rounded-b-xl"
                  style={{ backgroundColor: rankColors[1] }}
                />
              </motion.div>
            )}

            {/* 1st Place */}
            {leaderboard[0] && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="w-72"
              >
                <div 
                  className="relative p-6 rounded-t-2xl text-center h-[240px] flex flex-col justify-end"
                  style={{ 
                    background: `linear-gradient(180deg, ${rankColors[0]}25, ${rankColors[0]}10)`,
                    border: `2px solid ${rankColors[0]}50`,
                    borderBottom: 'none',
                    boxShadow: `0 0 50px ${rankColors[0]}30`,
                  }}
                >
                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-5xl">{rankEmojis[0]}</span>
                  <div 
                    className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl"
                    style={{ 
                      background: `linear-gradient(135deg, ${rankColors[0]}50, ${rankColors[0]}25)`,
                      border: `3px solid ${rankColors[0]}`,
                      boxShadow: `0 0 20px ${rankColors[0]}40`,
                    }}
                  >
                    {leaderboard[0].avatar ? (
                      <img src={leaderboard[0].avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <h4 className="font-bold text-lg truncate" style={{ color: effectiveColors.text }}>
                    {leaderboard[0].username}
                  </h4>
                  <p className="text-2xl font-black" style={{ color: rankColors[0] }}>
                    {formatCurrency(leaderboard[0].totalWinnings)}
                  </p>
                  <div className="mt-2 text-xs" style={{ color: theme?.colors?.textMuted }}>
                    {leaderboard[0].competitionsWon} Wins • {leaderboard[0].winRate}% Win Rate
                  </div>
                </div>
                <div 
                  className="h-[120px] rounded-b-xl"
                  style={{ backgroundColor: rankColors[0] }}
                />
              </motion.div>
            )}

            {/* 3rd Place */}
            {leaderboard[2] && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="w-64"
              >
                <div 
                  className="relative p-6 rounded-t-2xl text-center h-[180px] flex flex-col justify-end"
                  style={{ 
                    background: `linear-gradient(180deg, ${rankColors[2]}20, ${rankColors[2]}08)`,
                    border: `1px solid ${rankColors[2]}30`,
                    borderBottom: 'none',
                  }}
                >
                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-3xl">{rankEmojis[2]}</span>
                  <div 
                    className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-xl"
                    style={{ 
                      background: `linear-gradient(135deg, ${rankColors[2]}40, ${rankColors[2]}20)`,
                      border: `2px solid ${rankColors[2]}`,
                    }}
                  >
                    {leaderboard[2].avatar ? (
                      <img src={leaderboard[2].avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <h4 className="font-bold truncate" style={{ color: effectiveColors.text }}>
                    {leaderboard[2].username}
                  </h4>
                  <p className="text-lg font-black" style={{ color: rankColors[2] }}>
                    {formatCurrency(leaderboard[2].totalWinnings)}
                  </p>
                </div>
                <div 
                  className="h-[60px] rounded-b-xl"
                  style={{ backgroundColor: rankColors[2] }}
                />
              </motion.div>
            )}
          </div>

          {/* Mobile List View */}
          <div className="md:hidden space-y-3">
            {leaderboard.slice(0, 5).map((entry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ 
                  backgroundColor: theme?.colors?.backgroundCard,
                  border: `1px solid ${index < 3 ? rankColors[index] + '30' : theme?.colors?.border}`,
                }}
              >
                <span className="text-2xl">{index < 3 ? rankEmojis[index] : `#${index + 1}`}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate" style={{ color: effectiveColors.text }}>
                    {entry.username}
                  </h4>
                  <p className="text-sm" style={{ color: theme?.colors?.textMuted }}>
                    {entry.competitionsWon} wins • {entry.winRate}% rate
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black" style={{ color: index < 3 ? rankColors[index] : effectiveColors.primary }}>
                    {formatCurrency(entry.totalWinnings)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Remaining positions (desktop) */}
          <div className="hidden md:block space-y-3 mt-6">
            {leaderboard.slice(3, 5).map((entry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ 
                  backgroundColor: theme?.colors?.backgroundCard,
                  border: `1px solid ${theme?.colors?.border}`,
                }}
              >
                <span 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: `${effectiveColors.primary}20`, color: effectiveColors.primary }}
                >
                  #{index + 4}
                </span>
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl overflow-hidden"
                  style={{ backgroundColor: `${effectiveColors.primary}10` }}
                >
                  {entry.avatar ? (
                    <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold" style={{ color: effectiveColors.text }}>{entry.username}</h4>
                  <p className="text-sm" style={{ color: theme?.colors?.textMuted }}>
                    {entry.competitionsWon} Competition Wins • {entry.challengesWon} Challenge Wins
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg" style={{ color: effectiveColors.primary }}>
                    {formatCurrency(entry.totalWinnings)}
                  </p>
                  <p className="text-xs" style={{ color: theme?.colors?.textMuted }}>
                    {entry.winRate}% Win Rate
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center mt-12">
        <Link href="/leaderboard">
          <Button 
            size="lg" 
            variant="outline"
            className="font-bold hover:scale-105 transition-all"
            style={{ 
              borderColor: effectiveColors.primary,
              color: effectiveColors.primary,
            }}
          >
            View Full Leaderboard
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </Link>
      </div>
    </SectionWrapper>
  );
}
