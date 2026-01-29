'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Users, Trophy, DollarSign, TrendingUp, Zap, Target } from 'lucide-react';
import { LandingTheme } from '@/lib/themes/landing-themes';

interface StatsData {
  totalUsers: number;
  activeTraders: number;
  activeCompetitions: number;
  totalPrizesPaid: number;
  totalTrades: number;
  tradesToday: number;
  formatted: {
    totalUsers: string;
    activeTraders: string;
    activeCompetitions: string;
    totalPrizesPaid: string;
    totalTrades: string;
    tradesToday: string;
  };
}

interface LiveStatsBarProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  customStats?: Array<{
    id: string;
    label: string;
    value: string;
    suffix: string;
    icon: string;
    enabled: boolean;
  }>;
  animated?: boolean;
}

// Animated counter component
function AnimatedCounter({ 
  value, 
  suffix = '',
  color,
}: { 
  value: number; 
  suffix?: string;
  color: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView && value > 0) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <span ref={ref} style={{ color }} className="font-black">
      {count.toLocaleString()}{suffix}
    </span>
  );
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, Trophy, DollarSign, TrendingUp, Zap, Target,
};

export default function LiveStatsBar({
  theme,
  effectiveColors: propColors,
  customStats,
  animated = true,
}: LiveStatsBarProps) {
  // Ensure effectiveColors has defaults
  const effectiveColors = {
    primary: propColors.primary || '#00f0ff',
    secondary: propColors.secondary || '#ff00ff',
    accent: propColors.accent || '#ffd700',
    text: propColors.text || '#ffffff',
  };
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/landing/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Default stats to show
  const defaultStats = [
    { 
      icon: 'Users', 
      label: 'Active Traders', 
      value: stats?.activeTraders || 0,
      formatted: stats?.formatted?.activeTraders || '0',
      suffix: '+',
      themeIcon: theme?.themeIcons?.users || '👥',
    },
    { 
      icon: 'Trophy', 
      label: 'Competitions', 
      value: stats?.activeCompetitions || 0,
      formatted: stats?.formatted?.activeCompetitions || '0',
      suffix: ' Live',
      themeIcon: theme?.themeIcons?.trophy || '🏆',
    },
    { 
      icon: 'DollarSign', 
      label: 'Prizes Paid', 
      value: stats?.totalPrizesPaid || 0,
      formatted: stats?.formatted?.totalPrizesPaid || '$0',
      suffix: '',
      themeIcon: theme?.themeIcons?.currency || '💰',
    },
    { 
      icon: 'TrendingUp', 
      label: 'Trades Today', 
      value: stats?.tradesToday || 0,
      formatted: stats?.formatted?.tradesToday || '0',
      suffix: '',
      themeIcon: theme?.themeIcons?.stats || '📈',
    },
  ];

  // Use custom stats if provided, otherwise use defaults
  const displayStats = customStats && customStats.length > 0 
    ? customStats.filter(s => s.enabled).map(s => ({
        icon: s.icon,
        label: s.label,
        value: parseInt(s.value.replace(/\D/g, '')) || 0,
        formatted: s.value,
        suffix: s.suffix,
        themeIcon: theme?.themeIcons?.[s.icon.toLowerCase()] || '📊',
      }))
    : defaultStats;

  if (loading) {
    return (
      <div 
        className="py-6 border-y"
        style={{ 
          backgroundColor: `${effectiveColors.primary}05`,
          borderColor: `${effectiveColors.primary}20`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center items-center gap-2">
            <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: effectiveColors.primary }} />
            <span style={{ color: theme?.colors?.textMuted }}>Loading live stats...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="py-6 border-y"
      style={{ 
        backgroundColor: `${effectiveColors.primary}08`,
        borderColor: `${effectiveColors.primary}20`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {displayStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="text-center group"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {stat.themeIcon}
                </span>
              </div>
              <div 
                className="text-2xl md:text-3xl font-black mb-1"
                style={{ fontFamily: theme?.fonts?.heading }}
              >
                {animated ? (
                  <AnimatedCounter 
                    value={stat.value} 
                    suffix={stat.suffix}
                    color={effectiveColors.primary}
                  />
                ) : (
                  <span style={{ color: effectiveColors.primary }}>
                    {stat.formatted}{stat.suffix}
                  </span>
                )}
              </div>
              <div 
                className="text-xs md:text-sm uppercase tracking-wider font-medium"
                style={{ color: theme?.colors?.textMuted }}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Live indicator */}
        <div className="flex justify-center mt-4">
          <div 
            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
            style={{ 
              backgroundColor: `${theme?.colors?.success || '#22c55e'}20`,
              color: theme?.colors?.success || '#22c55e',
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme?.colors?.success || '#22c55e' }} />
            Live Data
          </div>
        </div>
      </div>
    </motion.div>
  );
}
