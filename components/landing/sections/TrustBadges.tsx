'use client';

import { motion } from 'framer-motion';
import { Shield, Award, BadgeCheck, Newspaper, Building2 } from 'lucide-react';
import { LandingTheme } from '@/lib/themes/landing-themes';

interface TrustBadge {
  id: string;
  type: 'security' | 'partner' | 'press' | 'award';
  name: string;
  logo: string;
  url?: string;
  enabled: boolean;
}

interface TrustBadgesProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  badges?: TrustBadge[];
  title?: string;
}

const typeIcons = {
  security: Shield,
  partner: Building2,
  press: Newspaper,
  award: Award,
};

const typeLabels = {
  security: 'Security Certified',
  partner: 'Trusted Partners',
  press: 'As Seen In',
  award: 'Awards & Recognition',
};

export default function TrustBadges({
  theme,
  effectiveColors: propColors,
  badges = [],
  title = "Trusted By Traders Worldwide",
}: TrustBadgesProps) {
  const effectiveColors = {
    primary: propColors?.primary || '#00f0ff',
    secondary: propColors?.secondary || '#ff00ff',
    accent: propColors?.accent || '#ffd700',
    text: propColors?.text || '#ffffff',
  };
  const enabledBadges = badges.filter(b => b.enabled);
  
  if (enabledBadges.length === 0) {
    return null;
  }

  // Group badges by type
  const badgesByType = enabledBadges.reduce((acc, badge) => {
    if (!acc[badge.type]) acc[badge.type] = [];
    acc[badge.type].push(badge);
    return acc;
  }, {} as Record<string, TrustBadge[]>);

  const types = Object.keys(badgesByType) as Array<keyof typeof typeIcons>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-12 border-y"
      style={{ 
        backgroundColor: `${effectiveColors.primary}03`,
        borderColor: `${theme?.colors?.border}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BadgeCheck className="h-5 w-5" style={{ color: effectiveColors.primary }} />
            <span 
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: theme?.colors?.textMuted }}
            >
              {title}
            </span>
          </div>
        </div>

        {/* Badge Sections */}
        {types.length > 1 ? (
          // Multiple types - show categorized
          <div className="space-y-8">
            {types.map((type, typeIndex) => {
              const Icon = typeIcons[type];
              const badgesInType = badgesByType[type];
              
              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: typeIndex * 0.1 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Icon className="h-4 w-4" style={{ color: theme?.colors?.textMuted }} />
                    <span 
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: theme?.colors?.textMuted }}
                    >
                      {typeLabels[type]}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
                    {badgesInType.map((badge, index) => (
                      <BadgeItem 
                        key={badge.id}
                        badge={badge}
                        theme={theme}
                        effectiveColors={effectiveColors}
                        delay={index * 0.05}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          // Single type or mixed - show all together
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
            {enabledBadges.map((badge, index) => (
              <BadgeItem 
                key={badge.id}
                badge={badge}
                theme={theme}
                effectiveColors={effectiveColors}
                delay={index * 0.05}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function BadgeItem({ 
  badge, 
  theme, 
  effectiveColors,
  delay,
}: { 
  badge: TrustBadge; 
  theme?: LandingTheme;
  effectiveColors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  };
  delay: number;
}) {
  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ scale: 1.05 }}
      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all cursor-pointer"
      style={{ 
        backgroundColor: 'transparent',
      }}
    >
      {badge.logo ? (
        <img 
          src={badge.logo} 
          alt={badge.name}
          className="h-8 md:h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
        />
      ) : (
        <div 
          className="h-10 px-4 flex items-center justify-center rounded-lg font-bold text-sm"
          style={{ 
            backgroundColor: `${effectiveColors.primary}10`,
            color: effectiveColors.primary,
          }}
        >
          {badge.name}
        </div>
      )}
      {!badge.logo && (
        <span 
          className="text-xs font-medium"
          style={{ color: theme?.colors?.textMuted }}
        >
          {badge.name}
        </span>
      )}
    </motion.div>
  );

  if (badge.url) {
    return (
      <a href={badge.url} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
