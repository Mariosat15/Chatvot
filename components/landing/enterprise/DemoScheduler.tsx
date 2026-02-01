"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  X,
  ArrowRight,
  Clock,
  Users,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface DemoSchedulerProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
  calendlyUrl: string;
  buttonText?: string;
  inline?: boolean;
}

export default function DemoScheduler({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  calendlyUrl,
  buttonText = "Schedule a Demo",
  inline = false,
}: DemoSchedulerProps) {
  const effectiveColors = {
    primary: propColors?.primary || "#a855f7",
    secondary: propColors?.secondary || "#ec4899",
    accent: propColors?.accent || "#fbbf24",
    text: propColors?.text || "#ffffff",
  };
  const effectiveHeadingFont = propFont || "inherit";
  const [isOpen, setIsOpen] = useState(false);

  if (!calendlyUrl) {
    return null;
  }

  // Inline embed mode
  if (inline) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: theme?.colors?.backgroundCard,
          border: `1px solid ${theme?.colors?.border}`,
        }}
      >
        <div
          className="p-4 flex items-center gap-2"
          style={{ borderBottom: `1px solid ${theme?.colors?.border}` }}
        >
          <Calendar
            className="h-5 w-5"
            style={{ color: effectiveColors.primary }}
          />
          <span className="font-bold" style={{ color: effectiveColors.text }}>
            Schedule Your Demo
          </span>
        </div>
        <iframe
          src={calendlyUrl}
          width="100%"
          height="600"
          frameBorder="0"
          title="Schedule Demo"
        />
      </div>
    );
  }

  // Button + Modal mode
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="font-bold hover:scale-105 transition-all group"
        style={{
          background: theme?.effects?.gradientStyle,
          color: theme?.colors?.background,
          boxShadow: `0 10px 30px ${effectiveColors.primary}40`,
        }}
      >
        <Calendar className="h-5 w-5 mr-2" />
        {buttonText}
        <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl rounded-2xl overflow-hidden"
              style={{
                backgroundColor: theme?.colors?.backgroundCard,
                border: `1px solid ${theme?.colors?.border}`,
              }}
            >
              {/* Header */}
              <div
                className="p-4 md:p-6 flex items-center justify-between"
                style={{
                  background: `linear-gradient(135deg, ${effectiveColors.primary}15, ${effectiveColors.secondary}15)`,
                  borderBottom: `1px solid ${theme?.colors?.border}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${effectiveColors.primary}20` }}
                  >
                    <Calendar
                      className="h-5 w-5"
                      style={{ color: effectiveColors.primary }}
                    />
                  </div>
                  <div>
                    <h3
                      className="font-bold text-lg"
                      style={{
                        color: effectiveColors.text,
                        fontFamily: effectiveHeadingFont,
                      }}
                    >
                      Schedule Your Demo
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: theme?.colors?.textMuted }}
                    >
                      Book a personalized walkthrough of our platform
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ color: theme?.colors?.textMuted }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="grid md:grid-cols-3">
                {/* Left - Benefits */}
                <div
                  className="p-6 space-y-4 hidden md:block"
                  style={{ borderRight: `1px solid ${theme?.colors?.border}` }}
                >
                  <h4
                    className="font-bold mb-4"
                    style={{ color: effectiveColors.text }}
                  >
                    What to expect:
                  </h4>

                  <div className="flex items-start gap-3">
                    <CheckCircle
                      className="h-5 w-5 flex-shrink-0 mt-0.5"
                      style={{ color: theme?.colors?.success || "#22c55e" }}
                    />
                    <div>
                      <div
                        className="font-medium"
                        style={{ color: effectiveColors.text }}
                      >
                        Platform Walkthrough
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: theme?.colors?.textMuted }}
                      >
                        See all features in action
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle
                      className="h-5 w-5 flex-shrink-0 mt-0.5"
                      style={{ color: theme?.colors?.success || "#22c55e" }}
                    />
                    <div>
                      <div
                        className="font-medium"
                        style={{ color: effectiveColors.text }}
                      >
                        Custom Pricing
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: theme?.colors?.textMuted }}
                      >
                        Tailored to your needs
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle
                      className="h-5 w-5 flex-shrink-0 mt-0.5"
                      style={{ color: theme?.colors?.success || "#22c55e" }}
                    />
                    <div>
                      <div
                        className="font-medium"
                        style={{ color: effectiveColors.text }}
                      >
                        Q&A Session
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: theme?.colors?.textMuted }}
                      >
                        Get all your questions answered
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-6 p-4 rounded-xl"
                    style={{ backgroundColor: `${effectiveColors.primary}10` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock
                        className="h-4 w-4"
                        style={{ color: effectiveColors.primary }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: effectiveColors.text }}
                      >
                        30-minute call
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users
                        className="h-4 w-4"
                        style={{ color: effectiveColors.primary }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: effectiveColors.text }}
                      >
                        1-on-1 with our team
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right - Calendly Embed */}
                <div className="md:col-span-2">
                  <iframe
                    src={calendlyUrl}
                    width="100%"
                    height="550"
                    frameBorder="0"
                    title="Schedule Demo"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
