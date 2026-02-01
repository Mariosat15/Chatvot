"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Quote,
  ChevronLeft,
  ChevronRight,
  Building2,
  TrendingUp,
} from "lucide-react";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface CaseStudy {
  id: string;
  companyName: string;
  companyLogo: string;
  industry: string;
  quote: string;
  quotePerson: string;
  quoteTitle: string;
  metrics: { label: string; value: string }[];
  enabled: boolean;
  order: number;
}

interface CaseStudiesProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
  caseStudies?: CaseStudy[];
  title?: string;
  subtitle?: string;
}

export default function CaseStudies({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  caseStudies = [],
  title = "Success Stories",
  subtitle = "See how our clients are succeeding",
}: CaseStudiesProps) {
  const effectiveColors = {
    primary: propColors?.primary || "#a855f7",
    secondary: propColors?.secondary || "#ec4899",
    accent: propColors?.accent || "#fbbf24",
    text: propColors?.text || "#ffffff",
  };
  const effectiveHeadingFont = propFont || "inherit";
  const [currentIndex, setCurrentIndex] = useState(0);

  const enabledCaseStudies = caseStudies
    .filter((cs) => cs.enabled)
    .sort((a, b) => a.order - b.order);

  if (enabledCaseStudies.length === 0) {
    return null;
  }

  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? enabledCaseStudies.length - 1 : prev - 1,
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % enabledCaseStudies.length);
  };

  const currentStudy = enabledCaseStudies[currentIndex];

  return (
    <section
      className="py-20 md:py-28"
      style={{
        background: `linear-gradient(180deg, transparent, ${effectiveColors.primary}08, transparent)`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
            style={{
              backgroundColor: `${theme?.colors?.success || "#22c55e"}15`,
              border: `1px solid ${theme?.colors?.success || "#22c55e"}30`,
              color: theme?.colors?.success || "#22c55e",
            }}
          >
            <Building2 className="h-4 w-4" />
            Success Stories
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black mb-6"
            style={{
              color: effectiveColors.text,
              fontFamily: effectiveHeadingFont,
            }}
          >
            {title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg"
            style={{ color: theme?.colors?.textMuted }}
          >
            {subtitle}
          </motion.p>
        </div>

        {/* Case Study Card */}
        <div className="relative max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStudy.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl overflow-hidden"
              style={{
                backgroundColor: theme?.colors?.backgroundCard,
                border: `1px solid ${theme?.colors?.border}`,
                boxShadow: `0 25px 50px ${effectiveColors.primary}15`,
              }}
            >
              <div className="grid md:grid-cols-2 gap-0">
                {/* Left - Company Info & Quote */}
                <div className="p-8 md:p-12">
                  {/* Company Logo/Name */}
                  <div className="flex items-center gap-4 mb-8">
                    {currentStudy.companyLogo ? (
                      <img
                        src={currentStudy.companyLogo}
                        alt={currentStudy.companyName}
                        className="h-12 w-auto object-contain"
                      />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${effectiveColors.primary}20`,
                        }}
                      >
                        <Building2
                          className="h-6 w-6"
                          style={{ color: effectiveColors.primary }}
                        />
                      </div>
                    )}
                    <div>
                      <h3
                        className="font-bold text-lg"
                        style={{ color: effectiveColors.text }}
                      >
                        {currentStudy.companyName}
                      </h3>
                      <span
                        className="text-sm px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${effectiveColors.secondary}15`,
                          color: effectiveColors.secondary,
                        }}
                      >
                        {currentStudy.industry}
                      </span>
                    </div>
                  </div>

                  {/* Quote */}
                  <div className="relative mb-8">
                    <Quote
                      className="absolute -top-2 -left-2 h-8 w-8 opacity-20"
                      style={{ color: effectiveColors.primary }}
                    />
                    <blockquote
                      className="text-xl md:text-2xl font-medium leading-relaxed pl-6"
                      style={{ color: effectiveColors.text }}
                    >
                      "{currentStudy.quote}"
                    </blockquote>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        background: theme?.effects?.gradientStyle,
                        color: theme?.colors?.background,
                      }}
                    >
                      {currentStudy.quotePerson.charAt(0)}
                    </div>
                    <div>
                      <div
                        className="font-bold"
                        style={{ color: effectiveColors.text }}
                      >
                        {currentStudy.quotePerson}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: theme?.colors?.textMuted }}
                      >
                        {currentStudy.quoteTitle}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right - Metrics */}
                <div
                  className="p-8 md:p-12"
                  style={{
                    background: `linear-gradient(135deg, ${effectiveColors.primary}10, ${effectiveColors.secondary}10)`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp
                      className="h-5 w-5"
                      style={{ color: effectiveColors.primary }}
                    />
                    <span
                      className="font-bold"
                      style={{ color: effectiveColors.text }}
                    >
                      Results Achieved
                    </span>
                  </div>

                  <div className="grid gap-6">
                    {currentStudy.metrics.map((metric, index) => (
                      <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + index * 0.1 }}
                        className="p-4 rounded-xl"
                        style={{
                          backgroundColor: `${theme?.colors?.background}80`,
                          border: `1px solid ${theme?.colors?.border}`,
                        }}
                      >
                        <div
                          className="text-3xl font-black mb-1"
                          style={{ color: effectiveColors.primary }}
                        >
                          {metric.value}
                        </div>
                        <div
                          className="text-sm font-medium"
                          style={{ color: theme?.colors?.textMuted }}
                        >
                          {metric.label}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          {enabledCaseStudies.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{
                  backgroundColor: theme?.colors?.backgroundCard,
                  border: `1px solid ${theme?.colors?.border}`,
                  color: effectiveColors.primary,
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{
                  backgroundColor: theme?.colors?.backgroundCard,
                  border: `1px solid ${theme?.colors?.border}`,
                  color: effectiveColors.primary,
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Dots */}
              <div className="flex justify-center gap-2 mt-8">
                {enabledCaseStudies.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className="w-3 h-3 rounded-full transition-all"
                    style={{
                      backgroundColor:
                        index === currentIndex
                          ? effectiveColors.primary
                          : `${effectiveColors.primary}30`,
                      transform:
                        index === currentIndex ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
