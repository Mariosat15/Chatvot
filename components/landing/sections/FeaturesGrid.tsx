"use client";

import { motion } from "framer-motion";
import {
  Trophy, Swords, Users, TrendingUp, DollarSign, Zap, Award,
  BarChart3, ShoppingBag, Star, Crown, Medal, Target, Rocket,
  Gift, Flame, Shield, Timer, Coins, Globe, Lock, CreditCard,
  Bell, FileText, PieChart, Headphones, Server, Database, Code,
  Mail, Phone,
} from "lucide-react";
import { LandingTheme } from "@/lib/themes/landing-themes";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Swords, Users, TrendingUp, DollarSign, Zap, Award,
  BarChart3, ShoppingBag, Star, Crown, Medal, Target, Rocket,
  Gift, Flame, Shield, Timer, Coins, Globe, Lock, CreditCard,
  Bell, FileText, PieChart, Headphones, Server, Database, Code,
  Mail, Phone,
};

interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  enabled: boolean;
}

interface FeaturesGridProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    text?: string;
  };
  effectiveHeadingFont: string;
  title: string;
  subtitle: string;
  features: Feature[];
}

export default function FeaturesGrid({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  title,
  subtitle,
  features,
}: FeaturesGridProps) {
  const enabledFeatures = features.filter((f) => f.enabled);
  if (enabledFeatures.length === 0) return null;

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2
            className="text-4xl md:text-6xl font-black mb-4"
            style={{ fontFamily: effectiveHeadingFont }}
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${effectiveColors.text}, ${effectiveColors.primary}, ${effectiveColors.text})`,
              }}
            >
              {title}
            </span>
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: theme?.colors.textMuted }}
          >
            {subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enabledFeatures.map((feature, index) => {
            const IconComponent = iconMap[feature.icon];
            const featureIcons = [
              theme?.themeIcons?.trophy,
              theme?.themeIcons?.battle,
              theme?.themeIcons?.users,
              theme?.themeIcons?.currency,
              theme?.themeIcons?.power,
              theme?.themeIcons?.achievement,
            ];
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative p-8 rounded-2xl transition-all duration-300 overflow-hidden"
                style={{
                  backgroundColor: theme?.colors.backgroundCard,
                  border: `1px solid ${theme?.colors.border}`,
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500"
                  style={{
                    background: `linear-gradient(135deg, ${effectiveColors.primary}08, ${effectiveColors.secondary}08)`,
                  }}
                />
                <div className="relative z-10">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.secondary}30)`,
                    }}
                  >
                    {featureIcons[index % 6] ? (
                      <span className="text-3xl">
                        {featureIcons[index % 6]}
                      </span>
                    ) : IconComponent ? (
                      <span style={{ color: effectiveColors.primary }}>
                        <IconComponent className="h-8 w-8" />
                      </span>
                    ) : (
                      <span className="text-3xl">
                        {theme?.themeIcons?.special || "⭐"}
                      </span>
                    )}
                  </div>
                  <h3
                    className="text-xl font-bold mb-3 transition-colors"
                    style={{
                      color: effectiveColors.text,
                      fontFamily: effectiveHeadingFont,
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="leading-relaxed"
                    style={{ color: theme?.colors.textMuted }}
                  >
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
