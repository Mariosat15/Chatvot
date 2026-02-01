"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Users, Clock, Trophy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";
import SectionWrapper from "./SectionWrapper";

interface Competition {
  id: string;
  name: string;
  description: string;
  prizePool: number;
  prizePoolFormatted: string;
  entryFee: number;
  entryFeeFormatted: string;
  currentParticipants: number;
  maxParticipants: number;
  participantsPercentage: number;
  status: string;
  statusBadge: string;
  statusColor: string;
  timeLabel: string;
  timeValue: string;
}

interface LiveCompetitionsProps {
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

export default function LiveCompetitions({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  title = "Live Competitions",
  subtitle = "Enter the Arena",
  description = "Real-time trading competitions with live leaderboards and massive prize pools.",
  ctaText = "View All Competitions",
  ctaLink = "/competitions",
}: LiveCompetitionsProps) {
  const effectiveColors = {
    primary: propColors?.primary || "#00f0ff",
    secondary: propColors?.secondary || "#ff00ff",
    accent: propColors?.accent || "#ffd700",
    text: propColors?.text || "#ffffff",
  };
  const effectiveHeadingFont = propFont || "inherit";
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch("/api/landing/competitions");
        if (response.ok) {
          const data = await response.json();
          // Combine active and upcoming, prioritizing active
          setCompetitions([...data.active, ...data.upcoming].slice(0, 3));
        }
      } catch (error) {
        console.error("Failed to fetch competitions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCompetitions, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string, statusColor: string) => {
    switch (statusColor) {
      case "green":
        return theme?.colors?.success || "#22c55e";
      case "yellow":
        return effectiveColors.accent;
      case "red":
        return theme?.colors?.error || "#ef4444";
      default:
        return effectiveColors.secondary;
    }
  };

  return (
    <SectionWrapper
      id="competitions"
      backgroundStyle={{
        background: `linear-gradient(135deg, ${effectiveColors.primary}10, transparent 50%, ${effectiveColors.secondary}10)`,
      }}
    >
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left - Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
            style={{
              backgroundColor: `${effectiveColors.primary}15`,
              border: `1px solid ${effectiveColors.primary}30`,
              color: effectiveColors.primary,
            }}
          >
            <span>{theme?.themeIcons?.trophy || "🏆"}</span>
            {subtitle}
          </div>

          <h2
            className="text-4xl md:text-5xl font-black mb-6"
            style={{
              color: effectiveColors.text,
              fontFamily: effectiveHeadingFont,
            }}
          >
            {title}
          </h2>

          <p
            className="text-lg mb-8 leading-relaxed"
            style={{ color: theme?.colors?.textMuted }}
          >
            {description}
          </p>

          <Link href={ctaLink}>
            <Button
              size="lg"
              className="font-bold hover:scale-105 transition-all"
              style={{
                background: theme?.effects?.gradientStyle,
                color: theme?.colors?.background,
                boxShadow: `0 10px 30px ${theme?.colors?.accentGlow}`,
              }}
            >
              {ctaText}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </motion.div>

        {/* Right - Competition Cards */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-4"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="h-8 w-8 animate-spin"
                style={{ color: effectiveColors.primary }}
              />
            </div>
          ) : competitions.length === 0 ? (
            // Fallback when no competitions
            <div
              className="p-8 rounded-2xl text-center"
              style={{
                backgroundColor: theme?.colors?.backgroundCard,
                border: `1px solid ${theme?.colors?.border}`,
              }}
            >
              <Trophy
                className="h-12 w-12 mx-auto mb-4"
                style={{ color: effectiveColors.primary }}
              />
              <h4
                className="font-bold text-lg mb-2"
                style={{ color: effectiveColors.text }}
              >
                New Competitions Coming Soon!
              </h4>
              <p style={{ color: theme?.colors?.textMuted }}>
                Check back shortly for exciting trading competitions with real
                prizes.
              </p>
            </div>
          ) : (
            competitions.map((comp, index) => (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, x: 10 }}
                className="p-6 rounded-2xl transition-all cursor-pointer"
                style={{
                  backgroundColor: theme?.colors?.backgroundCard,
                  border: `1px solid ${theme?.colors?.border}`,
                }}
              >
                <Link href={`/competitions/${comp.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                        style={{
                          background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.secondary}30)`,
                        }}
                      >
                        {theme?.themeIcons?.trophy || "🏆"}
                      </div>
                      <div>
                        <h4
                          className="font-bold text-lg"
                          style={{ color: effectiveColors.text }}
                        >
                          {comp.name}
                        </h4>
                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{ color: theme?.colors?.textMuted }}
                        >
                          <span className="flex items-center gap-1">
                            <span>{theme?.themeIcons?.currency || "💰"}</span>
                            {comp.prizePoolFormatted}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {comp.currentParticipants}/{comp.maxParticipants}
                          </span>
                          {comp.timeValue && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {comp.timeLabel} {comp.timeValue}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className="px-3 py-1.5 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${getStatusColor(comp.status, comp.statusColor)}20`,
                        color: getStatusColor(comp.status, comp.statusColor),
                      }}
                    >
                      {comp.statusBadge}
                    </div>
                  </div>

                  {/* Progress bar for participants */}
                  <div className="mt-4">
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{
                        backgroundColor: `${effectiveColors.primary}20`,
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${comp.participantsPercentage}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="h-full rounded-full"
                        style={{
                          background:
                            theme?.effects?.gradientStyle ||
                            effectiveColors.primary,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
