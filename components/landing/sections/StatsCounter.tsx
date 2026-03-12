"use client";

import React from "react";
import { motion } from "framer-motion";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface Stat {
  id: string;
  label: string;
  value: string;
  icon: string;
  enabled: boolean;
}

interface AnimatedCounterType {
  ({ end, duration, prefix, suffix }: {
    end: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
  }): React.JSX.Element;
}

interface StatsCounterProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    text?: string;
  };
  effectiveHeadingFont: string;
  stats: Stat[];
  AnimatedCounter: AnimatedCounterType;
}

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

export default function StatsCounter({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  stats,
  AnimatedCounter,
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
                    {stat.icon}
                  </span>
                  <div
                    className="text-3xl md:text-4xl font-black mb-2"
                    style={{
                      fontFamily: effectiveHeadingFont,
                      color: effectiveColors.primary,
                    }}
                  >
                    <AnimatedCounter
                      end={number}
                      prefix={prefix}
                      suffix={suffix}
                    />
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
