"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  Award,
  Coins,
  Flame,
  Shield,
  Sparkles,
} from "lucide-react";
import { LandingTheme } from "@/lib/themes/landing-themes";

// Icon mapping for competition types
const compTypeIconMap: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  TrendingUp,
  Target,
  Award,
  Coins,
  Flame,
  Shield,
};

interface CompetitionType {
  id: string;
  icon: string;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
}

interface CompetitionTypesShowcaseProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    border?: string;
  };
  effectiveHeadingFont: string;
  title: string;
  subtitle: string;
  description: string;
  competitionTypes: CompetitionType[];
}

export default function CompetitionTypesShowcase({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  title,
  subtitle,
  description,
  competitionTypes,
}: CompetitionTypesShowcaseProps) {
  const enabledTypes = competitionTypes.filter((t) => t.enabled);

  return (
    <section id="competition-types" className="py-24 relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${effectiveColors.secondary}06 50%, transparent 100%)`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold mb-6"
            style={{
              backgroundColor: `${effectiveColors.secondary}15`,
              border: `1px solid ${effectiveColors.secondary}30`,
              color: effectiveColors.secondary,
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Multiple Formats</span>
          </motion.div>

          <h2
            className="text-4xl md:text-6xl font-black mb-6"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${effectiveColors.text}, ${effectiveColors.secondary}, ${effectiveColors.text})`,
              }}
            >
              {title}
            </span>
          </h2>
          <p
            className="text-xl max-w-3xl mx-auto mb-2 font-medium"
            style={{ color: effectiveColors.text }}
          >
            {subtitle}
          </p>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: theme?.colors.textMuted }}
          >
            {description}
          </p>
        </motion.div>

        {/* Competition Types Grid — 3x2 layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enabledTypes.map((type, index) => {
            const IconComponent =
              compTypeIconMap[type.icon] || TrendingUp;
            return (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.03 }}
                className="group relative p-8 rounded-2xl overflow-hidden transition-all duration-300 cursor-default"
                style={{
                  backgroundColor: theme?.colors.backgroundCard,
                  border: `1px solid ${theme?.colors.border}`,
                }}
              >
                {/* Animated hover border glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-2xl"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${type.color}50, 0 0 30px ${type.color}10`,
                  }}
                />

                {/* Top colored bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{
                    background: `linear-gradient(90deg, ${type.color}, ${type.color}80)`,
                    opacity: 0.7,
                  }}
                />

                <div className="relative z-10">
                  {/* Icon + Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                      style={{
                        background: `${type.color}20`,
                      }}
                    >
                      <IconComponent
                        className="h-7 w-7"
                        // @ts-expect-error style prop on SVG
                        style={{ color: type.color }}
                      />
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${type.color}15`,
                        color: type.color,
                      }}
                    >
                      {type.id.replace("_", " ")}
                    </div>
                  </div>

                  <h3
                    className="text-xl font-bold mb-3"
                    style={{
                      color: effectiveColors.text,
                      fontFamily: effectiveHeadingFont,
                    }}
                  >
                    {type.name}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: theme?.colors.textMuted }}
                  >
                    {type.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12 text-sm"
          style={{ color: theme?.colors.textMuted }}
        >
          All competition types support custom tiebreakers, leverage settings, and flexible prize distribution.
        </motion.p>
      </div>
    </section>
  );
}
