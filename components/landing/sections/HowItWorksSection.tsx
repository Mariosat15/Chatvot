"use client";

import { motion } from "framer-motion";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface HowItWorksStep {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

interface HowItWorksSectionProps {
  theme: LandingTheme | null;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    text?: string;
  };
  effectiveHeadingFont: string;
  title: string;
  subtitle: string;
  steps: HowItWorksStep[];
}

export default function HowItWorksSection({
  theme,
  effectiveColors,
  effectiveHeadingFont,
  title,
  subtitle,
  steps,
}: HowItWorksSectionProps) {
  const enabledSteps = steps.filter((s) => s.enabled);
  if (enabledSteps.length === 0) return null;

  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2
            className="text-4xl md:text-5xl font-black mb-4"
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

        <div className="relative">
          {/* Connection line */}
          <div
            className="absolute top-1/2 left-0 right-0 h-0.5 hidden lg:block"
            style={{
              background: `linear-gradient(90deg, transparent, ${effectiveColors.primary}, transparent)`,
              opacity: 0.3,
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {enabledSteps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
                className="relative text-center"
              >
                <motion.div
                  whileHover={{ y: -4, scale: 1.05 }}
                  className="relative z-10 p-8 rounded-2xl transition-all"
                  style={{
                    backgroundColor: theme?.colors.backgroundCard,
                    border: `1px solid ${theme?.colors.border}`,
                  }}
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
                    style={{
                      background: `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
                    }}
                  >
                    {step.icon}
                  </div>
                  <div
                    className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                    style={{
                      background: effectiveColors.primary,
                      color: theme?.colors.background,
                    }}
                  >
                    {step.step}
                  </div>
                  <h3
                    className="text-xl font-bold mb-3"
                    style={{
                      color: effectiveColors.text,
                      fontFamily: effectiveHeadingFont,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p style={{ color: theme?.colors.textMuted }}>
                    {step.description}
                  </p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
