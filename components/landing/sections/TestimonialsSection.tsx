'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { LandingTheme } from '@/lib/themes/landing-themes';
import SectionWrapper from './SectionWrapper';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
  enabled: boolean;
  order: number;
}

interface TestimonialsSectionProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
  testimonials?: Testimonial[];
  title?: string;
  subtitle?: string;
}

export default function TestimonialsSection({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  testimonials = [],
  title = "What Our Traders Say",
  subtitle = "Real Stories from Real Winners",
}: TestimonialsSectionProps) {
  const effectiveColors = {
    primary: propColors?.primary || '#00f0ff',
    secondary: propColors?.secondary || '#ff00ff',
    accent: propColors?.accent || '#ffd700',
    text: propColors?.text || '#ffffff',
  };
  const effectiveHeadingFont = propFont || 'inherit';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const enabledTestimonials = testimonials
    .filter(t => t.enabled)
    .sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!autoPlay || enabledTestimonials.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % enabledTestimonials.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [autoPlay, enabledTestimonials.length]);

  const handlePrev = () => {
    setAutoPlay(false);
    setCurrentIndex(prev => 
      prev === 0 ? enabledTestimonials.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setAutoPlay(false);
    setCurrentIndex(prev => (prev + 1) % enabledTestimonials.length);
  };

  if (enabledTestimonials.length === 0) {
    return null;
  }

  const currentTestimonial = enabledTestimonials[currentIndex];

  return (
    <SectionWrapper
      id="testimonials"
      backgroundStyle={{
        background: `linear-gradient(135deg, ${effectiveColors.primary}08, transparent 50%, ${effectiveColors.secondary}08)`,
      }}
    >
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
          style={{ 
            backgroundColor: `${effectiveColors.accent}15`,
            border: `1px solid ${effectiveColors.accent}30`,
            color: effectiveColors.accent,
          }}
        >
          <Quote className="h-4 w-4" />
          {subtitle}
        </div>
        
        <h2 
          className="text-4xl md:text-5xl font-black"
          style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
        >
          {title}
        </h2>
      </div>

      {/* Main Testimonial Display */}
      <div className="max-w-4xl mx-auto relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTestimonial.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="relative p-8 md:p-12 rounded-3xl"
            style={{ 
              backgroundColor: theme?.colors?.backgroundCard,
              border: `1px solid ${theme?.colors?.border}`,
              boxShadow: `0 20px 50px ${effectiveColors.primary}10`,
            }}
          >
            {/* Quote decoration */}
            <div 
              className="absolute top-4 left-6 text-6xl opacity-20"
              style={{ color: effectiveColors.primary }}
            >
              "
            </div>

            {/* Content */}
            <div className="text-center">
              {/* Rating */}
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-6 w-6"
                    fill={i < currentTestimonial.rating ? '#FFD700' : 'transparent'}
                    stroke={i < currentTestimonial.rating ? '#FFD700' : theme?.colors?.textMuted}
                    strokeWidth={1.5}
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote 
                className="text-xl md:text-2xl font-medium mb-8 leading-relaxed"
                style={{ color: effectiveColors.text }}
              >
                "{currentTestimonial.content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center justify-center gap-4">
                <div 
                  className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-2xl"
                  style={{ 
                    background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.secondary}30)`,
                    border: `2px solid ${effectiveColors.primary}40`,
                  }}
                >
                  {currentTestimonial.avatar ? (
                    <img 
                      src={currentTestimonial.avatar} 
                      alt={currentTestimonial.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-lg" style={{ color: effectiveColors.text }}>
                    {currentTestimonial.name}
                  </h4>
                  <p className="text-sm" style={{ color: theme?.colors?.textMuted }}>
                    {currentTestimonial.role}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        {enabledTestimonials.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ 
                backgroundColor: theme?.colors?.backgroundCard,
                border: `1px solid ${theme?.colors?.border}`,
                color: effectiveColors.primary,
              }}
            >
              <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ 
                backgroundColor: theme?.colors?.backgroundCard,
                border: `1px solid ${theme?.colors?.border}`,
                color: effectiveColors.primary,
              }}
            >
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </>
        )}
      </div>

      {/* Dots Navigation */}
      {enabledTestimonials.length > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {enabledTestimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setAutoPlay(false);
                setCurrentIndex(index);
              }}
              className="w-3 h-3 rounded-full transition-all"
              style={{ 
                backgroundColor: index === currentIndex 
                  ? effectiveColors.primary 
                  : `${effectiveColors.primary}30`,
                transform: index === currentIndex ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      )}

      {/* Small testimonial cards preview */}
      {enabledTestimonials.length > 3 && (
        <div className="hidden lg:grid grid-cols-3 gap-4 mt-12">
          {enabledTestimonials.slice(0, 3).map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              onClick={() => {
                setAutoPlay(false);
                setCurrentIndex(index);
              }}
              className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
              style={{ 
                backgroundColor: index === currentIndex 
                  ? `${effectiveColors.primary}15`
                  : theme?.colors?.backgroundCard,
                border: `1px solid ${index === currentIndex ? effectiveColors.primary : theme?.colors?.border}`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${effectiveColors.primary}20` }}
                >
                  {testimonial.avatar ? (
                    <img src={testimonial.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                <span className="font-bold text-sm" style={{ color: effectiveColors.text }}>
                  {testimonial.name}
                </span>
              </div>
              <p 
                className="text-xs line-clamp-2"
                style={{ color: theme?.colors?.textMuted }}
              >
                "{testimonial.content}"
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </SectionWrapper>
  );
}
