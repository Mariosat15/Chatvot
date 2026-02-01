"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionWrapperProps {
  id?: string;
  children: ReactNode;
  className?: string;
  backgroundStyle?: React.CSSProperties;
  overlay?: boolean;
  overlayColor?: string;
  animate?: boolean;
}

export default function SectionWrapper({
  id,
  children,
  className,
  backgroundStyle,
  overlay = false,
  overlayColor,
  animate = true,
}: SectionWrapperProps) {
  const content = (
    <section
      id={id}
      className={cn("relative py-20 md:py-28 overflow-hidden", className)}
      style={backgroundStyle}
    >
      {overlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlayColor }}
        />
      )}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {content}
    </motion.div>
  );
}
