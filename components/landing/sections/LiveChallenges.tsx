'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Swords, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingTheme } from '@/lib/themes/landing-themes';
import SectionWrapper from './SectionWrapper';

interface ActiveChallenge {
  id: string;
  challenger: string;
  challenged: string;
  stake: number;
  stakeFormatted: string;
  status: string;
  statusLabel: string;
  timeRemaining: string;
}

interface CompletedChallenge {
  id: string;
  winner: string;
  loser: string;
  winnerPrize: number;
  winnerPrizeFormatted: string;
  completedAt: string;
}

interface ChallengeStats {
  totalActive: number;
  totalCompleted: number;
  activePrizePool: number;
  activePrizePoolFormatted: string;
}

interface LiveChallengesProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
}

export default function LiveChallenges({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  title = '1v1 Challenges',
  subtitle = 'Prove Your Skills',
  description = 'Challenge any trader to a head-to-head battle.',
  ctaText = 'Start a Challenge',
  ctaLink = '/challenges',
}: LiveChallengesProps) {
  const effectiveColors = {
    primary: propColors?.primary || '#00f0ff',
    secondary: propColors?.secondary || '#ff00ff',
    accent: propColors?.accent || '#ffd700',
    text: propColors?.text || '#ffffff',
  };
  const effectiveHeadingFont = propFont || 'inherit';
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const [completedChallenges, setCompletedChallenges] = useState<CompletedChallenge[]>([]);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const response = await fetch('/api/landing/challenges');
        if (response.ok) {
          const data = await response.json();
          setActiveChallenges(data.active || []);
          setCompletedChallenges(data.completed || []);
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
    const interval = setInterval(fetchChallenges, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SectionWrapper id="challenges">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
          style={{ 
            backgroundColor: `${effectiveColors.secondary}15`,
            border: `1px solid ${effectiveColors.secondary}30`,
            color: effectiveColors.secondary,
          }}
        >
          <span>{theme?.themeIcons?.challenge || '⚔️'}</span>
          {subtitle}
        </div>
        
        <h2 
          className="text-4xl md:text-5xl font-black mb-6"
          style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
        >
          {title}
        </h2>
        
        <p 
          className="text-lg leading-relaxed"
          style={{ color: theme?.colors?.textMuted }}
        >
          {description}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: effectiveColors.secondary }} />
        </div>
      ) : (
        <>
          {/* Live Battle Arena */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {activeChallenges.length > 0 ? (
              activeChallenges.slice(0, 3).map((challenge, index) => (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.03 }}
                  className="relative overflow-hidden rounded-2xl p-6"
                  style={{ 
                    backgroundColor: theme?.colors?.backgroundCard,
                    border: `1px solid ${theme?.colors?.border}`,
                  }}
                >
                  {/* Status badge */}
                  <div className="absolute top-4 right-4">
                    <span 
                      className="px-2 py-1 rounded-full text-xs font-bold"
                      style={{ 
                        backgroundColor: `${effectiveColors.secondary}20`,
                        color: effectiveColors.secondary,
                      }}
                    >
                      {challenge.statusLabel}
                    </span>
                  </div>

                  {/* VS Display */}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="text-center flex-1">
                      <div 
                        className="w-16 h-16 rounded-xl mx-auto mb-2 flex items-center justify-center text-2xl"
                        style={{ 
                          background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.primary}10)` 
                        }}
                      >
                        {theme?.themeIcons?.player || '🎮'}
                      </div>
                      <span className="font-bold text-sm" style={{ color: effectiveColors.text }}>
                        {challenge.challenger}
                      </span>
                    </div>
                    
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black"
                      style={{ 
                        background: theme?.effects?.gradientStyle,
                        color: theme?.colors?.background,
                      }}
                    >
                      VS
                    </div>
                    
                    <div className="text-center flex-1">
                      <div 
                        className="w-16 h-16 rounded-xl mx-auto mb-2 flex items-center justify-center text-2xl"
                        style={{ 
                          background: `linear-gradient(135deg, ${effectiveColors.secondary}30, ${effectiveColors.secondary}10)` 
                        }}
                      >
                        {theme?.themeIcons?.player || '🎮'}
                      </div>
                      <span className="font-bold text-sm" style={{ color: effectiveColors.text }}>
                        {challenge.challenged}
                      </span>
                    </div>
                  </div>

                  {/* Stake */}
                  <div 
                    className="text-center p-3 rounded-xl"
                    style={{ backgroundColor: `${effectiveColors.accent}15` }}
                  >
                    <span className="text-xs uppercase tracking-wider" style={{ color: theme?.colors?.textMuted }}>
                      Prize Pool
                    </span>
                    <div className="text-2xl font-black" style={{ color: effectiveColors.accent }}>
                      {challenge.stakeFormatted}
                    </div>
                    {challenge.timeRemaining && (
                      <span className="text-xs" style={{ color: theme?.colors?.textMuted }}>
                        {challenge.timeRemaining} remaining
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              // Fallback when no active challenges
              <div 
                className="col-span-full p-8 rounded-2xl text-center"
                style={{ 
                  backgroundColor: theme?.colors?.backgroundCard,
                  border: `1px solid ${theme?.colors?.border}`,
                }}
              >
                <Swords className="h-12 w-12 mx-auto mb-4" style={{ color: effectiveColors.secondary }} />
                <h4 className="font-bold text-lg mb-2" style={{ color: effectiveColors.text }}>
                  Challenge Your Friends!
                </h4>
                <p style={{ color: theme?.colors?.textMuted }}>
                  Start a 1v1 trading challenge and prove your skills.
                </p>
              </div>
            )}
          </div>

          {/* Recent Winners Ticker */}
          {completedChallenges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-4 rounded-xl mb-8 overflow-hidden"
              style={{ 
                backgroundColor: `${effectiveColors.secondary}10`,
                border: `1px solid ${effectiveColors.secondary}20`,
              }}
            >
              <div className="flex items-center gap-3 animate-marquee">
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: effectiveColors.secondary }}>
                  🏆 Recent Winners:
                </span>
                {completedChallenges.map((result, i) => (
                  <span 
                    key={i} 
                    className="flex items-center gap-2 text-sm whitespace-nowrap"
                    style={{ color: theme?.colors?.textMuted }}
                  >
                    <span className="font-bold" style={{ color: effectiveColors.text }}>{result.winner}</span>
                    defeated {result.loser} ({result.winnerPrizeFormatted})
                    {i < completedChallenges.length - 1 && (
                      <span className="mx-2" style={{ color: theme?.colors?.border }}>•</span>
                    )}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Stats Bar */}
          {stats && (
            <div 
              className="grid grid-cols-3 gap-4 p-4 rounded-xl mb-8"
              style={{ 
                backgroundColor: theme?.colors?.backgroundCard,
                border: `1px solid ${theme?.colors?.border}`,
              }}
            >
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: effectiveColors.secondary }}>
                  {stats.totalActive}
                </div>
                <div className="text-xs" style={{ color: theme?.colors?.textMuted }}>Active Battles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: effectiveColors.primary }}>
                  {stats.totalCompleted.toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: theme?.colors?.textMuted }}>Total Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: effectiveColors.accent }}>
                  {stats.activePrizePoolFormatted}
                </div>
                <div className="text-xs" style={{ color: theme?.colors?.textMuted }}>At Stake Now</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CTA */}
      <div className="text-center">
        <Link href={ctaLink}>
          <Button 
            size="lg" 
            className="font-bold hover:scale-105 transition-all"
            style={{ 
              background: `linear-gradient(135deg, ${effectiveColors.secondary}, ${effectiveColors.primary})`,
              color: theme?.colors?.background,
              boxShadow: `0 10px 30px ${effectiveColors.secondary}40`,
            }}
          >
            {ctaText}
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </Link>
      </div>
    </SectionWrapper>
  );
}
