"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  Trophy, Swords, Users, TrendingUp, DollarSign, Zap, Award,
  BarChart3, ShoppingBag, Star, Crown, Medal, Target, Rocket,
  Gift, Flame, Shield, Timer, Coins, Globe, Lock, CreditCard,
  Bell, FileText, PieChart, Headphones, Server, Database, Code,
  Mail, Phone,
} from "lucide-react";
import { LandingTheme } from "@/lib/themes/landing-themes";

// Icon mapping — maps icon name strings from DB to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Swords, Users, TrendingUp, DollarSign, Zap, Award,
  BarChart3, ShoppingBag, Star, Crown, Medal, Target, Rocket,
  Gift, Flame, Shield, Timer, Coins, Globe, Lock, CreditCard,
  Bell, FileText, PieChart, Headphones, Server, Database, Code,
  Mail, Phone,
};

interface Stat {
  id: string;
  label: string;
  value: string;
  icon: string;
  enabled: boolean;
}

export interface StatsCounterProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    text?: string;
  };
  effectiveHeadingFont: string;
  stats: Stat[];
  animated?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseStatValue(value: string): {
  prefix: string;
  number: number;
  suffix: string;
} {
  const cleaned = value.replace(/,/g, "");
  const match = cleaned.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (match) {
    return {
      prefix: match[1],
      number: parseFloat(match[2]),
      suffix: match[3],
    };
  }
  return { prefix: "", number: 0, suffix: value };
}

// Reason: Self-contained animated counter so StatsCounter doesn't need one
// passed as a prop. This makes it usable directly in the section registry.
function AnimatedCounter({
  end,
  prefix = "",
  suffix = "",
  duration = 2000,
}: {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StatsCounter({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  stats,
  animated = true,
}: StatsCounterProps) {
  const enabledStats = stats.filter((s) => s.enabled);
  if (enabledStats.length === 0) return null;

  return (
    <section className="py-20 relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${effectiveColors.primary}08, ${effectiveColors.secondary}08)`,
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {enabledStats.map((stat, index) => {
            const { prefix, number, suffix } = parseStatValue(stat.value);
            // eslint-disable-next-line security/detect-object-injection
            const IconComp = iconMap[stat.icon];

            return (
              <motion.div
                key={stat.id}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, type: "spring" }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <motion.div
                  whileHover={{ y: -4, scale: 1.05 }}
                  className="p-6 rounded-2xl transition-all"
                  style={{
                    backgroundColor: theme?.colors.backgroundCard,
                    border: `1px solid ${theme?.colors.border}`,
                  }}
                >
                  <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">
                    {IconComp ? (
                      <IconComp className="h-10 w-10 mx-auto" />
                    ) : (
                      stat.icon
                    )}
                  </span>
                  <div
                    className="text-3xl md:text-4xl font-black mb-2"
                    style={{
                      fontFamily: effectiveHeadingFont,
                      color: effectiveColors.primary,
                    }}
                  >
                    {animated ? (
                      <AnimatedCounter
                        end={number}
                        prefix={prefix}
                        suffix={suffix}
                      />
                    ) : (
                      `${prefix}${number.toLocaleString()}${suffix}`
                    )}
                  </div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: theme?.colors.textMuted }}
                  >
                    {stat.label}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
