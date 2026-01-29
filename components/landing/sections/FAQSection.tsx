'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { LandingTheme } from '@/lib/themes/landing-themes';
import SectionWrapper from './SectionWrapper';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  enabled: boolean;
}

interface FAQSectionProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  effectiveHeadingFont?: string;
  faqItems?: FAQItem[];
  title?: string;
  subtitle?: string;
}

export default function FAQSection({
  theme,
  effectiveColors: propColors,
  effectiveHeadingFont: propFont,
  faqItems = [],
  title = "Frequently Asked Questions",
  subtitle = "Got Questions? We've Got Answers",
}: FAQSectionProps) {
  const effectiveColors = {
    primary: propColors?.primary || '#00f0ff',
    secondary: propColors?.secondary || '#ff00ff',
    accent: propColors?.accent || '#ffd700',
    text: propColors?.text || '#ffffff',
  };
  const effectiveHeadingFont = propFont || 'inherit';
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const enabledFAQs = faqItems
    .filter(item => item.enabled)
    .sort((a, b) => a.order - b.order);

  // Get unique categories
  const categories = ['all', ...new Set(enabledFAQs.map(item => item.category))];

  const filteredFAQs = selectedCategory === 'all' 
    ? enabledFAQs 
    : enabledFAQs.filter(item => item.category === selectedCategory);

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (enabledFAQs.length === 0) {
    return null;
  }

  return (
    <SectionWrapper id="faq">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
          style={{ 
            backgroundColor: `${effectiveColors.primary}15`,
            border: `1px solid ${effectiveColors.primary}30`,
            color: effectiveColors.primary,
          }}
        >
          <HelpCircle className="h-4 w-4" />
          {subtitle}
        </div>
        
        <h2 
          className="text-4xl md:text-5xl font-black"
          style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
        >
          {title}
        </h2>
      </div>

      {/* Category Filter */}
      {categories.length > 2 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{ 
                backgroundColor: selectedCategory === category 
                  ? effectiveColors.primary 
                  : `${effectiveColors.primary}10`,
                color: selectedCategory === category 
                  ? theme?.colors?.background 
                  : effectiveColors.primary,
                border: `1px solid ${selectedCategory === category ? effectiveColors.primary : effectiveColors.primary + '30'}`,
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* FAQ Accordion */}
      <div className="max-w-3xl mx-auto space-y-4">
        {filteredFAQs.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl overflow-hidden"
            style={{ 
              backgroundColor: theme?.colors?.backgroundCard,
              border: `1px solid ${openItems.has(item.id) ? effectiveColors.primary : theme?.colors?.border}`,
            }}
          >
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full p-5 md:p-6 flex items-center justify-between text-left transition-colors"
              style={{ 
                backgroundColor: openItems.has(item.id) ? `${effectiveColors.primary}08` : 'transparent',
              }}
            >
              <span 
                className="font-bold text-lg pr-4"
                style={{ color: effectiveColors.text }}
              >
                {item.question}
              </span>
              <motion.div
                animate={{ rotate: openItems.has(item.id) ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0"
              >
                <ChevronDown 
                  className="h-5 w-5" 
                  style={{ color: effectiveColors.primary }} 
                />
              </motion.div>
            </button>
            
            <AnimatePresence>
              {openItems.has(item.id) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div 
                    className="px-5 md:px-6 pb-5 md:pb-6 leading-relaxed"
                    style={{ 
                      color: theme?.colors?.textMuted,
                      borderTop: `1px solid ${theme?.colors?.border}`,
                      paddingTop: '1.25rem',
                    }}
                  >
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Help CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mt-12"
      >
        <p className="text-lg mb-4" style={{ color: theme?.colors?.textMuted }}>
          Still have questions?
        </p>
        <a 
          href="/help"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all hover:scale-105"
          style={{ 
            backgroundColor: `${effectiveColors.primary}15`,
            color: effectiveColors.primary,
            border: `1px solid ${effectiveColors.primary}30`,
          }}
        >
          <HelpCircle className="h-5 w-5" />
          Visit Help Center
        </a>
      </motion.div>
    </SectionWrapper>
  );
}
