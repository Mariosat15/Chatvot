'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Save, Loader2, Eye, EyeOff, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Globe, Sparkles, BarChart3, Layers, Trophy, Swords, Rocket, FileText, Building2,
  Settings, Palette, ExternalLink, RefreshCw, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { allThemes, themeCategories, getThemeById, LandingTheme } from '@/lib/themes/landing-themes';

// Available icons for selection
const availableIcons = [
  'Trophy', 'Swords', 'Users', 'TrendingUp', 'DollarSign', 'Zap', 'Award',
  'BarChart3', 'ShoppingBag', 'Star', 'Crown', 'Medal', 'Target', 'Rocket',
  'Gift', 'Flame', 'Shield', 'Globe', 'Code', 'Mail', 'Phone', 'Headphones',
  'Server', 'Database', 'Lock', 'CreditCard', 'Bell', 'FileText', 'PieChart',
];

interface HolidayScheduleItem {
  id: string;
  name: string;
  themeId: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  enabled: boolean;
}

interface GlobalThemeEffects {
  particlesEnabled: boolean;
  glowEffectsEnabled: boolean;
  animationsEnabled: boolean;
  // Intensity controls (0-100)
  snowIntensity: number;
  bloodIntensity: number;
  confettiIntensity: number;
}

interface CustomTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  headingFont: string;
}

interface LandingSettings {
  // Theme
  activeTheme: string;
  holidayThemesEnabled: boolean;
  holidaySchedule: HolidayScheduleItem[];
  globalThemeEffects: GlobalThemeEffects;
  customThemeEnabled: boolean;
  customTheme: CustomTheme;
  
  // Global
  enterprisePageEnabled: boolean;
  
  // Hero Section
  heroEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBadgeText: string;
  heroPrimaryCTAText: string;
  heroPrimaryCTALink: string;
  heroSecondaryCTAText: string;
  heroSecondaryCTALink: string;
  heroParticlesEnabled: boolean;
  
  // Stats Section (Counting Numbers)
  statsEnabled: boolean;
  statsAnimated: boolean;
  stats: Array<{
    id: string;
    value: string;
    suffix: string;
    label: string;
    enabled: boolean;
  }>;
  
  // Features Section
  featuresEnabled: boolean;
  featuresTitle: string;
  featuresSubtitle: string;
  features: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
  }>;
  
  // How It Works Section
  howItWorksEnabled: boolean;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: Array<{
    id: string;
    step: number;
    title: string;
    description: string;
    enabled: boolean;
  }>;
  
  // Competitions Section
  competitionsEnabled: boolean;
  competitionsTitle: string;
  competitionsSubtitle: string;
  competitionsDescription: string;
  competitionsCTAText: string;
  competitionsCTALink: string;
  
  // Challenges Section
  challengesEnabled: boolean;
  challengesTitle: string;
  challengesSubtitle: string;
  challengesDescription: string;
  challengesCTAText: string;
  challengesCTALink: string;
  
  // Final CTA Section
  ctaEnabled: boolean;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  
  // Footer Section
  footerEnabled: boolean;
  footerCopyright: string;
  footerDisclaimer: string;
  footerRiskDisclaimer: string;
  footerMenuPlatform: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  footerMenuSupport: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  footerMenuBusiness: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  
  // ========== ENTERPRISE PAGE ==========
  enterpriseHeroTitle: string;
  enterpriseHeroSubtitle: string;
  enterpriseHeroDescription: string;
  enterpriseHeroBadge: string;
  enterpriseHeroCTAText: string;
  enterpriseHeroCTALink: string;
  
  enterpriseWhiteLabelEnabled: boolean;
  enterpriseWhiteLabelTitle: string;
  enterpriseWhiteLabelSubtitle: string;
  enterpriseWhiteLabelFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
  }>;
  
  enterpriseAdminEnabled: boolean;
  enterpriseAdminTitle: string;
  enterpriseAdminSubtitle: string;
  enterpriseAdminDescription: string;
  enterpriseAdminFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    enabled: boolean;
  }>;
  
  enterprisePricingEnabled: boolean;
  enterprisePricingTitle: string;
  enterprisePricingSubtitle: string;
  enterprisePricingTiers: Array<{
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    ctaText: string;
    highlighted: boolean;
    enabled: boolean;
  }>;
  
  enterpriseContactEnabled: boolean;
  enterpriseContactTitle: string;
  enterpriseContactSubtitle: string;
  enterpriseContactEmail: string;
  enterpriseContactPhone: string;
  enterpriseContactCTAText: string;
}

const defaultSettings: LandingSettings = {
  // Theme
  activeTheme: 'gaming-neon',
  holidayThemesEnabled: true,
  holidaySchedule: [
    { id: 'christmas', name: 'Christmas', themeId: 'christmas', startMonth: 12, startDay: 1, endMonth: 12, endDay: 31, enabled: true },
    { id: 'halloween', name: 'Halloween', themeId: 'halloween', startMonth: 10, startDay: 15, endMonth: 11, endDay: 1, enabled: true },
    { id: 'easter', name: 'Easter', themeId: 'easter', startMonth: 3, startDay: 15, endMonth: 4, endDay: 30, enabled: true },
    { id: 'black-friday', name: 'Black Friday', themeId: 'black-friday', startMonth: 11, startDay: 20, endMonth: 11, endDay: 30, enabled: true },
  ],
  globalThemeEffects: {
    particlesEnabled: true,
    glowEffectsEnabled: true,
    animationsEnabled: true,
    snowIntensity: 30,
    bloodIntensity: 20,
    confettiIntensity: 30,
  },
  customThemeEnabled: false,
  customTheme: {
    primaryColor: '#00ff88',
    secondaryColor: '#00d4ff',
    accentColor: '#ff00ff',
    backgroundColor: '#030712',
    textColor: '#f3f4f6',
    borderColor: '#374151',
    headingFont: 'Orbitron',
  },
  
  enterprisePageEnabled: true,
  
  // Hero
  heroEnabled: true,
  heroTitle: 'DOMINATE THE MARKETS',
  heroSubtitle: 'THE ULTIMATE TRADING ARENA',
  heroDescription: 'Compete against traders worldwide in real-time competitions and 1v1 challenges.',
  heroBadgeText: '🔥 Live Trading Battles',
  heroPrimaryCTAText: 'Start Trading',
  heroPrimaryCTALink: '/sign-up',
  heroSecondaryCTAText: 'View Competitions',
  heroSecondaryCTALink: '/competitions',
  heroParticlesEnabled: true,
  
  // Stats
  statsEnabled: true,
  statsAnimated: true,
  stats: [
    { id: '1', value: '10000', suffix: '+', label: 'Active Traders', enabled: true },
    { id: '2', value: '1000000', suffix: '+', label: 'Prize Pool', enabled: true },
    { id: '3', value: '50000', suffix: '+', label: 'Trades Daily', enabled: true },
    { id: '4', value: '100', suffix: '+', label: 'Countries', enabled: true },
  ],
  
  // Features
  featuresEnabled: true,
  featuresTitle: 'Platform Features',
  featuresSubtitle: 'Everything you need to become a trading champion',
  features: [
    { id: '1', icon: 'Trophy', title: 'Competitions', description: 'Join daily, weekly, and monthly trading competitions', enabled: true },
    { id: '2', icon: 'Swords', title: '1v1 Challenges', description: 'Challenge any trader to a head-to-head battle', enabled: true },
    { id: '3', icon: 'BarChart3', title: 'Real-Time Analytics', description: 'Track your performance with detailed analytics', enabled: true },
    { id: '4', icon: 'Award', title: 'Leaderboards', description: 'Climb the ranks and earn your place at the top', enabled: true },
    { id: '5', icon: 'ShoppingBag', title: 'Marketplace', description: 'Buy and sell trading strategies and signals', enabled: true },
    { id: '6', icon: 'Gift', title: 'Rewards', description: 'Earn badges, XP, and real prizes', enabled: true },
  ],
  
  // How It Works
  howItWorksEnabled: true,
  howItWorksTitle: 'How It Works',
  howItWorksSubtitle: 'Get started in 4 simple steps',
  howItWorksSteps: [
    { id: '1', step: 1, title: 'Create Account', description: 'Sign up and verify your email', enabled: true },
    { id: '2', step: 2, title: 'Choose Competition', description: 'Pick from various competition types', enabled: true },
    { id: '3', step: 3, title: 'Start Trading', description: 'Execute trades and build your portfolio', enabled: true },
    { id: '4', step: 4, title: 'Win Prizes', description: 'Top the leaderboard and claim rewards', enabled: true },
  ],
  
  // Competitions
  competitionsEnabled: true,
  competitionsTitle: 'Trading Competitions',
  competitionsSubtitle: '🏆 Competitive Trading',
  competitionsDescription: 'Join thousands of traders in daily, weekly, and monthly competitions with real prizes.',
  competitionsCTAText: 'View Competitions',
  competitionsCTALink: '/competitions',
  
  // Challenges
  challengesEnabled: true,
  challengesTitle: '1v1 Challenges',
  challengesSubtitle: '⚔️ Head-to-Head Battles',
  challengesDescription: 'Challenge any trader to a direct duel and prove your skills.',
  challengesCTAText: 'Find Opponent',
  challengesCTALink: '/challenges',
  
  // CTA
  ctaEnabled: true,
  ctaTitle: 'Ready to Compete?',
  ctaSubtitle: 'Join the arena today',
  ctaDescription: 'Create your free account and start your trading journey',
  ctaButtonText: 'Get Started Now',
  ctaButtonLink: '/sign-up',
  
  // Footer
  footerEnabled: true,
  footerCopyright: '© 2024 ChartVolt. All rights reserved.',
  footerDisclaimer: '',
  footerRiskDisclaimer: 'Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.',
  footerMenuPlatform: [
    { id: '1', label: 'Competitions', href: '/competitions', enabled: true },
    { id: '2', label: 'Challenges', href: '/challenges', enabled: true },
    { id: '3', label: 'Leaderboard', href: '/leaderboard', enabled: true },
    { id: '4', label: 'Marketplace', href: '/marketplace', enabled: true },
  ],
  footerMenuSupport: [
    { id: '1', label: 'Help Center', href: '/help', enabled: true },
    { id: '2', label: 'Contact Us', href: 'mailto:support@chartvolt.com', enabled: true },
    { id: '3', label: 'Terms of Service', href: '/terms', enabled: true },
    { id: '4', label: 'Privacy Policy', href: '/privacy', enabled: true },
  ],
  footerMenuBusiness: [
    { id: '1', label: 'Enterprise Solutions', href: '/enterprise', enabled: true },
    { id: '2', label: 'Pricing', href: '/enterprise#pricing', enabled: true },
    { id: '3', label: 'Contact Sales', href: '/enterprise#contact', enabled: true },
  ],
  
  // Enterprise
  enterpriseHeroTitle: 'Launch Your Own Trading Platform',
  enterpriseHeroSubtitle: 'Enterprise Solutions',
  enterpriseHeroDescription: 'Complete white-label solution with powerful admin panel and everything you need.',
  enterpriseHeroBadge: 'Enterprise Solutions',
  enterpriseHeroCTAText: 'Request Demo',
  enterpriseHeroCTALink: '#contact',
  
  enterpriseWhiteLabelEnabled: true,
  enterpriseWhiteLabelTitle: 'White Label Solution',
  enterpriseWhiteLabelSubtitle: 'Launch your own branded trading platform',
  enterpriseWhiteLabelFeatures: [
    { id: '1', icon: 'Palette', title: 'Full Branding', description: 'Custom logo, colors, and styling', enabled: true },
    { id: '2', icon: 'Globe', title: 'Custom Domain', description: 'Your own domain with SSL', enabled: true },
    { id: '3', icon: 'Mail', title: 'Email Branding', description: 'Branded email templates', enabled: true },
    { id: '4', icon: 'Code', title: 'API Access', description: 'Full API for integrations', enabled: true },
    { id: '5', icon: 'Server', title: 'Dedicated Infrastructure', description: 'Your own servers', enabled: true },
    { id: '6', icon: 'Headphones', title: 'Priority Support', description: '24/7 dedicated support', enabled: true },
  ],
  
  enterpriseAdminEnabled: true,
  enterpriseAdminTitle: 'Complete Control Center',
  enterpriseAdminSubtitle: 'Powerful Admin Panel',
  enterpriseAdminDescription: 'Everything you need to manage your platform',
  enterpriseAdminFeatures: [
    { id: '1', icon: 'BarChart3', title: 'Analytics', description: 'Real-time dashboards', color: 'from-cyan-500 to-blue-600', enabled: true },
    { id: '2', icon: 'Users', title: 'User Management', description: 'Complete user control', color: 'from-purple-500 to-pink-600', enabled: true },
    { id: '3', icon: 'Trophy', title: 'Competitions', description: 'Create and manage', color: 'from-yellow-500 to-orange-600', enabled: true },
    { id: '4', icon: 'Shield', title: 'Fraud Detection', description: 'AI-powered security', color: 'from-red-500 to-rose-600', enabled: true },
  ],
  
  enterprisePricingEnabled: true,
  enterprisePricingTitle: 'Simple Pricing',
  enterprisePricingSubtitle: 'Choose the plan that fits your needs',
  enterprisePricingTiers: [
    { id: '1', name: 'Starter', price: '$499', period: '/month', description: 'For small communities', features: ['Up to 1,000 users', 'Basic admin', 'Email support'], ctaText: 'Get Started', highlighted: false, enabled: true },
    { id: '2', name: 'Professional', price: '$1,499', period: '/month', description: 'For growing platforms', features: ['Up to 10,000 users', 'Full admin', 'Priority support', 'Custom branding'], ctaText: 'Start Trial', highlighted: true, enabled: true },
    { id: '3', name: 'Enterprise', price: 'Custom', period: '', description: 'For large operations', features: ['Unlimited users', 'White label', 'Dedicated servers', '24/7 support'], ctaText: 'Contact Sales', highlighted: false, enabled: true },
  ],
  
  enterpriseContactEnabled: true,
  enterpriseContactTitle: 'Ready to Get Started?',
  enterpriseContactSubtitle: 'Contact our sales team',
  enterpriseContactEmail: 'enterprise@chartvolt.com',
  enterpriseContactPhone: '+1 (234) 567-890',
  enterpriseContactCTAText: 'Schedule Demo',
};

export default function LandingPageBuilder() {
  const [settings, setSettings] = useState<LandingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('hero-page');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/hero-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          // Map from DB model to our simplified interface
          setSettings(mapFromDbSettings(data.settings));
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapFromDbSettings = (db: Record<string, unknown>): LandingSettings => {
    return {
      activeTheme: (db.activeTheme as string) || defaultSettings.activeTheme,
      holidayThemesEnabled: (db.holidayThemesEnabled as boolean) ?? true,
      holidaySchedule: (db.holidaySchedule as HolidayScheduleItem[]) || defaultSettings.holidaySchedule,
      globalThemeEffects: (db.globalThemeEffects as GlobalThemeEffects) || defaultSettings.globalThemeEffects,
      customThemeEnabled: (db.customThemeEnabled as boolean) ?? false,
      customTheme: (db.customTheme as CustomTheme) || defaultSettings.customTheme,
      
      enterprisePageEnabled: (db.enterprisePageEnabled as boolean) ?? true,
      
      heroEnabled: (db.sectionVisibility as Record<string, boolean>)?.hero ?? true,
      heroTitle: (db.heroTitle as string) || defaultSettings.heroTitle,
      heroSubtitle: (db.heroSubtitle as string) || defaultSettings.heroSubtitle,
      heroDescription: (db.heroDescription as string) || defaultSettings.heroDescription,
      heroBadgeText: (db.heroBadgeText as string) || defaultSettings.heroBadgeText,
      heroPrimaryCTAText: ((db.heroCTAButtons as Array<{ text: string; href: string; style: string }>)?.[0]?.text) || defaultSettings.heroPrimaryCTAText,
      heroPrimaryCTALink: ((db.heroCTAButtons as Array<{ text: string; href: string; style: string }>)?.[0]?.href) || defaultSettings.heroPrimaryCTALink,
      heroSecondaryCTAText: ((db.heroCTAButtons as Array<{ text: string; href: string; style: string }>)?.[1]?.text) || defaultSettings.heroSecondaryCTAText,
      heroSecondaryCTALink: ((db.heroCTAButtons as Array<{ text: string; href: string; style: string }>)?.[1]?.href) || defaultSettings.heroSecondaryCTALink,
      heroParticlesEnabled: (db.heroParticlesConfig as Record<string, boolean>)?.enabled ?? true,
      
      statsEnabled: (db.sectionVisibility as Record<string, boolean>)?.stats ?? true,
      statsAnimated: (db.statsAnimated as boolean) ?? true,
      stats: (db.stats as LandingSettings['stats']) || defaultSettings.stats,
      
      featuresEnabled: (db.sectionVisibility as Record<string, boolean>)?.features ?? true,
      featuresTitle: (db.featuresTitle as string) || defaultSettings.featuresTitle,
      featuresSubtitle: (db.featuresSubtitle as string) || defaultSettings.featuresSubtitle,
      features: (db.features as LandingSettings['features']) || defaultSettings.features,
      
      howItWorksEnabled: (db.sectionVisibility as Record<string, boolean>)?.howItWorks ?? true,
      howItWorksTitle: (db.howItWorksTitle as string) || defaultSettings.howItWorksTitle,
      howItWorksSubtitle: (db.howItWorksSubtitle as string) || defaultSettings.howItWorksSubtitle,
      howItWorksSteps: (db.howItWorksSteps as LandingSettings['howItWorksSteps']) || defaultSettings.howItWorksSteps,
      
      competitionsEnabled: (db.sectionVisibility as Record<string, boolean>)?.competitions ?? true,
      competitionsTitle: (db.competitionsTitle as string) || defaultSettings.competitionsTitle,
      competitionsSubtitle: (db.competitionsSubtitle as string) || defaultSettings.competitionsSubtitle,
      competitionsDescription: (db.competitionsDescription as string) || defaultSettings.competitionsDescription,
      competitionsCTAText: (db.competitionsCTAText as string) || defaultSettings.competitionsCTAText,
      competitionsCTALink: (db.competitionsCTALink as string) || defaultSettings.competitionsCTALink,
      
      challengesEnabled: (db.sectionVisibility as Record<string, boolean>)?.challenges ?? true,
      challengesTitle: (db.challengesTitle as string) || defaultSettings.challengesTitle,
      challengesSubtitle: (db.challengesSubtitle as string) || defaultSettings.challengesSubtitle,
      challengesDescription: (db.challengesDescription as string) || defaultSettings.challengesDescription,
      challengesCTAText: (db.challengesCTAText as string) || defaultSettings.challengesCTAText,
      challengesCTALink: (db.challengesCTALink as string) || defaultSettings.challengesCTALink,
      
      ctaEnabled: (db.sectionVisibility as Record<string, boolean>)?.cta ?? true,
      ctaTitle: (db.ctaTitle as string) || defaultSettings.ctaTitle,
      ctaSubtitle: (db.ctaSubtitle as string) || defaultSettings.ctaSubtitle,
      ctaDescription: (db.ctaDescription as string) || defaultSettings.ctaDescription,
      ctaButtonText: (db.ctaButtonText as string) || defaultSettings.ctaButtonText,
      ctaButtonLink: (db.ctaButtonLink as string) || defaultSettings.ctaButtonLink,
      
      footerEnabled: (db.sectionVisibility as Record<string, boolean>)?.footer ?? true,
      footerCopyright: (db.footerCopyright as string) || defaultSettings.footerCopyright,
      footerDisclaimer: (db.footerDisclaimer as string) || defaultSettings.footerDisclaimer,
      footerRiskDisclaimer: (db.footerRiskDisclaimer as string) || defaultSettings.footerRiskDisclaimer,
      footerMenuPlatform: (db.footerMenuPlatform as LandingSettings['footerMenuPlatform']) || defaultSettings.footerMenuPlatform,
      footerMenuSupport: (db.footerMenuSupport as LandingSettings['footerMenuSupport']) || defaultSettings.footerMenuSupport,
      footerMenuBusiness: (db.footerMenuBusiness as LandingSettings['footerMenuBusiness']) || defaultSettings.footerMenuBusiness,
      
      enterpriseHeroTitle: (db.enterpriseHeroTitle as string) || defaultSettings.enterpriseHeroTitle,
      enterpriseHeroSubtitle: (db.enterpriseHeroSubtitle as string) || defaultSettings.enterpriseHeroSubtitle,
      enterpriseHeroDescription: (db.enterpriseHeroDescription as string) || defaultSettings.enterpriseHeroDescription,
      enterpriseHeroBadge: (db.enterpriseHeroBadge as string) || defaultSettings.enterpriseHeroBadge,
      enterpriseHeroCTAText: (db.enterpriseHeroCTAText as string) || defaultSettings.enterpriseHeroCTAText,
      enterpriseHeroCTALink: (db.enterpriseHeroCTALink as string) || defaultSettings.enterpriseHeroCTALink,
      
      enterpriseWhiteLabelEnabled: (db.enterpriseSectionVisibility as Record<string, boolean>)?.whiteLabel ?? true,
      enterpriseWhiteLabelTitle: (db.enterpriseWhiteLabelTitle as string) || defaultSettings.enterpriseWhiteLabelTitle,
      enterpriseWhiteLabelSubtitle: (db.enterpriseWhiteLabelSubtitle as string) || defaultSettings.enterpriseWhiteLabelSubtitle,
      enterpriseWhiteLabelFeatures: (db.enterpriseWhiteLabelFeatures as LandingSettings['enterpriseWhiteLabelFeatures']) || defaultSettings.enterpriseWhiteLabelFeatures,
      
      enterpriseAdminEnabled: (db.enterpriseSectionVisibility as Record<string, boolean>)?.adminShowcase ?? true,
      enterpriseAdminTitle: (db.enterpriseAdminTitle as string) || defaultSettings.enterpriseAdminTitle,
      enterpriseAdminSubtitle: (db.enterpriseAdminSubtitle as string) || defaultSettings.enterpriseAdminSubtitle,
      enterpriseAdminDescription: (db.enterpriseAdminDescription as string) || defaultSettings.enterpriseAdminDescription,
      enterpriseAdminFeatures: (db.enterpriseAdminFeatures as LandingSettings['enterpriseAdminFeatures']) || defaultSettings.enterpriseAdminFeatures,
      
      enterprisePricingEnabled: (db.enterpriseSectionVisibility as Record<string, boolean>)?.pricing ?? true,
      enterprisePricingTitle: (db.enterprisePricingTitle as string) || defaultSettings.enterprisePricingTitle,
      enterprisePricingSubtitle: (db.enterprisePricingSubtitle as string) || defaultSettings.enterprisePricingSubtitle,
      enterprisePricingTiers: (db.enterprisePricingTiers as LandingSettings['enterprisePricingTiers']) || defaultSettings.enterprisePricingTiers,
      
      enterpriseContactEnabled: (db.enterpriseSectionVisibility as Record<string, boolean>)?.contact ?? true,
      enterpriseContactTitle: (db.enterpriseContactTitle as string) || defaultSettings.enterpriseContactTitle,
      enterpriseContactSubtitle: (db.enterpriseContactSubtitle as string) || defaultSettings.enterpriseContactSubtitle,
      enterpriseContactEmail: (db.enterpriseContactEmail as string) || defaultSettings.enterpriseContactEmail,
      enterpriseContactPhone: (db.enterpriseContactPhone as string) || defaultSettings.enterpriseContactPhone,
      enterpriseContactCTAText: (db.enterpriseContactCTAText as string) || defaultSettings.enterpriseContactCTAText,
    };
  };

  const mapToDbSettings = (s: LandingSettings) => {
    return {
      activeTheme: s.activeTheme,
      holidayThemesEnabled: s.holidayThemesEnabled,
      holidaySchedule: s.holidaySchedule,
      globalThemeEffects: s.globalThemeEffects,
      customThemeEnabled: s.customThemeEnabled,
      customTheme: s.customTheme,
      
      enterprisePageEnabled: s.enterprisePageEnabled,
      
      heroTitle: s.heroTitle,
      heroSubtitle: s.heroSubtitle,
      heroDescription: s.heroDescription,
      heroBadgeText: s.heroBadgeText,
      heroCTAButtons: [
        { id: '1', text: s.heroPrimaryCTAText, href: s.heroPrimaryCTALink, style: 'primary', icon: 'Rocket', enabled: true },
        { id: '2', text: s.heroSecondaryCTAText, href: s.heroSecondaryCTALink, style: 'secondary', icon: '', enabled: true },
      ],
      heroParticlesConfig: { enabled: s.heroParticlesEnabled, color: '#eab308', count: 80, speed: 1, shape: 'circle' },
      
      statsAnimated: s.statsAnimated,
      stats: s.stats,
      
      featuresTitle: s.featuresTitle,
      featuresSubtitle: s.featuresSubtitle,
      features: s.features,
      
      howItWorksTitle: s.howItWorksTitle,
      howItWorksSubtitle: s.howItWorksSubtitle,
      howItWorksSteps: s.howItWorksSteps,
      
      competitionsTitle: s.competitionsTitle,
      competitionsSubtitle: s.competitionsSubtitle,
      competitionsDescription: s.competitionsDescription,
      competitionsCTAText: s.competitionsCTAText,
      competitionsCTALink: s.competitionsCTALink,
      
      challengesTitle: s.challengesTitle,
      challengesSubtitle: s.challengesSubtitle,
      challengesDescription: s.challengesDescription,
      challengesCTAText: s.challengesCTAText,
      challengesCTALink: s.challengesCTALink,
      
      ctaTitle: s.ctaTitle,
      ctaSubtitle: s.ctaSubtitle,
      ctaDescription: s.ctaDescription,
      ctaButtonText: s.ctaButtonText,
      ctaButtonLink: s.ctaButtonLink,
      
      footerCopyright: s.footerCopyright,
      footerDisclaimer: s.footerDisclaimer,
      footerRiskDisclaimer: s.footerRiskDisclaimer,
      footerMenuPlatform: s.footerMenuPlatform,
      footerMenuSupport: s.footerMenuSupport,
      footerMenuBusiness: s.footerMenuBusiness,
      footerMenus: {
        platform: s.footerMenuPlatform,
        support: s.footerMenuSupport,
        business: s.footerMenuBusiness,
      },
      
      sectionVisibility: {
        hero: s.heroEnabled,
        features: s.featuresEnabled,
        stats: s.statsEnabled,
        howItWorks: s.howItWorksEnabled,
        competitions: s.competitionsEnabled,
        challenges: s.challengesEnabled,
        cta: s.ctaEnabled,
        footer: s.footerEnabled,
      },
      
      enterpriseHeroTitle: s.enterpriseHeroTitle,
      enterpriseHeroSubtitle: s.enterpriseHeroSubtitle,
      enterpriseHeroDescription: s.enterpriseHeroDescription,
      enterpriseHeroBadge: s.enterpriseHeroBadge,
      enterpriseHeroCTAText: s.enterpriseHeroCTAText,
      enterpriseHeroCTALink: s.enterpriseHeroCTALink,
      
      enterpriseWhiteLabelTitle: s.enterpriseWhiteLabelTitle,
      enterpriseWhiteLabelSubtitle: s.enterpriseWhiteLabelSubtitle,
      enterpriseWhiteLabelFeatures: s.enterpriseWhiteLabelFeatures,
      
      enterpriseAdminTitle: s.enterpriseAdminTitle,
      enterpriseAdminSubtitle: s.enterpriseAdminSubtitle,
      enterpriseAdminDescription: s.enterpriseAdminDescription,
      enterpriseAdminFeatures: s.enterpriseAdminFeatures,
      
      enterprisePricingTitle: s.enterprisePricingTitle,
      enterprisePricingSubtitle: s.enterprisePricingSubtitle,
      enterprisePricingTiers: s.enterprisePricingTiers,
      
      enterpriseContactTitle: s.enterpriseContactTitle,
      enterpriseContactSubtitle: s.enterpriseContactSubtitle,
      enterpriseContactEmail: s.enterpriseContactEmail,
      enterpriseContactPhone: s.enterpriseContactPhone,
      enterpriseContactCTAText: s.enterpriseContactCTAText,
      
      enterpriseSectionVisibility: {
        hero: true,
        trustBadges: true,
        whiteLabel: s.enterpriseWhiteLabelEnabled,
        adminShowcase: s.enterpriseAdminEnabled,
        pricing: s.enterprisePricingEnabled,
        contact: s.enterpriseContactEnabled,
        footer: true,
      },
    };
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/hero-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapToDbSettings(settings)),
      });
      if (response.ok) {
        toast.success('Settings saved successfully!');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof LandingSettings>(key: K, value: LandingSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Helper to add items to arrays
  const addItem = <K extends keyof LandingSettings>(
    key: K,
    newItem: LandingSettings[K] extends Array<infer T> ? T : never
  ) => {
    const current = settings[key];
    if (Array.isArray(current)) {
      updateField(key, [...current, newItem] as LandingSettings[K]);
    }
  };

  // Helper to remove items from arrays
  const removeItem = <K extends keyof LandingSettings>(key: K, id: string) => {
    const current = settings[key];
    if (Array.isArray(current)) {
      updateField(key, current.filter((item: { id: string }) => item.id !== id) as LandingSettings[K]);
    }
  };

  // Helper to update array items
  const updateArrayItem = <K extends keyof LandingSettings>(
    key: K,
    id: string,
    updates: Partial<LandingSettings[K] extends Array<infer T> ? T : never>
  ) => {
    const current = settings[key];
    if (Array.isArray(current)) {
      updateField(key, current.map((item: { id: string }) => 
        item.id === id ? { ...item, ...updates } : item
      ) as LandingSettings[K]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Landing Page Builder</h2>
          <p className="text-gray-400">Configure your Hero and Enterprise landing pages</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchSettings} className="border-gray-600">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
          <Button onClick={saveSettings} disabled={saving} className="bg-yellow-500 hover:bg-yellow-400 text-gray-900">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Global Settings Card */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building2 className="h-8 w-8 text-purple-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">Enterprise Page</h3>
                <p className="text-sm text-gray-400">Enable or disable the /enterprise page (for white-label customers)</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={settings.enterprisePageEnabled ? "default" : "secondary"} className={settings.enterprisePageEnabled ? "bg-green-500" : ""}>
                {settings.enterprisePageEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Switch
                checked={settings.enterprisePageEnabled}
                onCheckedChange={(v) => updateField('enterprisePageEnabled', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Theme Selection */}
      <Card className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 border-cyan-500/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="h-6 w-6 text-cyan-400" />
              <div>
                <CardTitle className="text-white">🎨 Theme Selection</CardTitle>
                <CardDescription className="text-gray-400">{allThemes.length} themes available</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Theme Preview */}
          {getThemeById(settings.activeTheme) && (
            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-cyan-500/30">
              <div 
                className="w-20 h-20 rounded-lg flex-shrink-0 border-2 border-gray-600"
                style={{ background: getThemeById(settings.activeTheme)?.preview }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-lg font-bold text-white">{getThemeById(settings.activeTheme)?.name}</h5>
                  <Badge className="bg-cyan-500 text-black text-[10px]">Active</Badge>
                </div>
                <p className="text-sm text-gray-400 mb-2">{getThemeById(settings.activeTheme)?.description}</p>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-5 h-5 rounded-full border border-white/20" style={{ background: getThemeById(settings.activeTheme)?.colors.primary }} title="Primary" />
                    <div className="w-5 h-5 rounded-full border border-white/20" style={{ background: getThemeById(settings.activeTheme)?.colors.secondary }} title="Secondary" />
                    <div className="w-5 h-5 rounded-full border border-white/20" style={{ background: getThemeById(settings.activeTheme)?.colors.accent }} title="Accent" />
                    <div className="w-5 h-5 rounded-full border border-white/20" style={{ background: getThemeById(settings.activeTheme)?.colors.background }} title="Background" />
                  </div>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-400">{getThemeById(settings.activeTheme)?.fonts.heading.split(',')[0].replace(/"/g, '')}</span>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-400 capitalize">{getThemeById(settings.activeTheme)?.effects.particleType}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Theme Selector Dropdown */}
          <div>
            <Label className="text-gray-300 mb-2 block">Select Theme</Label>
            <Select value={settings.activeTheme} onValueChange={(v) => updateField('activeTheme', v)}>
              <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-12">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md flex-shrink-0" style={{ background: getThemeById(settings.activeTheme)?.preview }} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {themeCategories.map((category) => (
                  <div key={category.id}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-800/50 sticky top-0">
                      {category.icon} {category.name}
                    </div>
                    {allThemes.filter(t => t.category === category.id).map((theme) => (
                      <SelectItem key={theme.id} value={theme.id} className="py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-6 rounded flex-shrink-0 border border-gray-600" style={{ background: theme.preview }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{theme.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{theme.description}</p>
                          </div>
                          <div className="flex gap-0.5">
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.colors.primary }} />
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.colors.secondary }} />
                            <div className="w-3 h-3 rounded-full" style={{ background: theme.colors.accent }} />
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Theme Grid (expandable) */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="themes" className="border-gray-700">
              <AccordionTrigger className="text-gray-300 hover:no-underline py-2">
                <span className="text-sm">Browse All Themes ({allThemes.length})</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 pt-2">
                  {allThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateField('activeTheme', theme.id)}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        settings.activeTheme === theme.id
                          ? 'border-cyan-500 shadow-[0_0_15px_rgba(0,255,255,0.3)] scale-105'
                          : 'border-gray-700 hover:border-gray-500'
                      }`}
                      title={`${theme.name} - ${theme.description}`}
                    >
                      <div className="h-12 w-full" style={{ background: theme.preview }} />
                      <div className="p-1 bg-gray-800">
                        <p className="text-[9px] font-semibold text-white truncate text-center">{theme.name}</p>
                      </div>
                      {settings.activeTheme === theme.id && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-black" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Holiday Theme Auto-Switch */}
      <Card className="bg-gradient-to-r from-red-900/30 to-green-900/30 border-red-500/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎄</span>
              <div>
                <CardTitle className="text-white">Holiday Theme Auto-Switch</CardTitle>
                <CardDescription className="text-gray-400">Automatically switch themes based on holidays</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={settings.holidayThemesEnabled ? "default" : "secondary"} className={settings.holidayThemesEnabled ? "bg-green-500" : ""}>
                {settings.holidayThemesEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Switch
                checked={settings.holidayThemesEnabled}
                onCheckedChange={(v) => updateField('holidayThemesEnabled', v)}
              />
            </div>
          </div>
        </CardHeader>
        {settings.holidayThemesEnabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings.holidaySchedule.map((holiday) => (
                <div key={holiday.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {holiday.id === 'christmas' ? '🎄' : 
                         holiday.id === 'halloween' ? '🎃' :
                         holiday.id === 'easter' ? '🐰' :
                         holiday.id === 'black-friday' ? '🛒' : '📅'}
                      </span>
                      <span className="font-semibold text-white">{holiday.name}</span>
                    </div>
                    <Switch
                      checked={holiday.enabled}
                      onCheckedChange={(enabled) => {
                        const updated = settings.holidaySchedule.map(h => 
                          h.id === holiday.id ? { ...h, enabled } : h
                        );
                        updateField('holidaySchedule', updated);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-gray-500 text-xs">Start Date</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={holiday.startMonth}
                          onChange={(e) => {
                            const updated = settings.holidaySchedule.map(h => 
                              h.id === holiday.id ? { ...h, startMonth: parseInt(e.target.value) || 1 } : h
                            );
                            updateField('holidaySchedule', updated);
                          }}
                          className="bg-gray-900 border-gray-600 text-white w-16 text-center"
                          placeholder="MM"
                        />
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={holiday.startDay}
                          onChange={(e) => {
                            const updated = settings.holidaySchedule.map(h => 
                              h.id === holiday.id ? { ...h, startDay: parseInt(e.target.value) || 1 } : h
                            );
                            updateField('holidaySchedule', updated);
                          }}
                          className="bg-gray-900 border-gray-600 text-white w-16 text-center"
                          placeholder="DD"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-500 text-xs">End Date</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={holiday.endMonth}
                          onChange={(e) => {
                            const updated = settings.holidaySchedule.map(h => 
                              h.id === holiday.id ? { ...h, endMonth: parseInt(e.target.value) || 1 } : h
                            );
                            updateField('holidaySchedule', updated);
                          }}
                          className="bg-gray-900 border-gray-600 text-white w-16 text-center"
                          placeholder="MM"
                        />
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={holiday.endDay}
                          onChange={(e) => {
                            const updated = settings.holidaySchedule.map(h => 
                              h.id === holiday.id ? { ...h, endDay: parseInt(e.target.value) || 1 } : h
                            );
                            updateField('holidaySchedule', updated);
                          }}
                          className="bg-gray-900 border-gray-600 text-white w-16 text-center"
                          placeholder="DD"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label className="text-gray-500 text-xs">Theme</Label>
                    <Select 
                      value={holiday.themeId}
                      onValueChange={(themeId) => {
                        const updated = settings.holidaySchedule.map(h => 
                          h.id === holiday.id ? { ...h, themeId } : h
                        );
                        updateField('holidaySchedule', updated);
                      }}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allThemes.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newHoliday = {
                  id: `custom-${Date.now()}`,
                  name: 'New Holiday',
                  themeId: 'gaming-neon',
                  startMonth: 1,
                  startDay: 1,
                  endMonth: 1,
                  endDay: 7,
                  enabled: true,
                };
                updateField('holidaySchedule', [...settings.holidaySchedule, newHoliday]);
              }}
              className="border-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Custom Holiday
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Theme Effects & Customization */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-purple-400" />
            <div>
              <CardTitle className="text-white">✨ Theme Effects & Customization</CardTitle>
              <CardDescription className="text-gray-400">Configure global effects and customize your selected theme</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info about automatic effects */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h5 className="text-sm font-semibold text-blue-400 mb-2">🎯 Automatic Theme Effects</h5>
            <p className="text-xs text-gray-400">
              Each theme has its own unique effects that are applied automatically:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <span>🎄</span>
                <span className="text-gray-300">Christmas → Snow + Lights</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🎃</span>
                <span className="text-gray-300">Halloween → Blood + Fog + Ghosts</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🐰</span>
                <span className="text-gray-300">Easter → Pastel Confetti + Eggs</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🛒</span>
                <span className="text-gray-300">Black Friday → Confetti + Tags</span>
              </div>
            </div>
          </div>

          {/* Global Animation Controls */}
          <div>
            <h5 className="text-sm font-semibold text-purple-400 mb-3">Global Animation Controls</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>✨</span>
                  <span className="text-sm text-white">Particles</span>
                </div>
                <Switch
                  checked={settings.globalThemeEffects?.particlesEnabled ?? true}
                  onCheckedChange={(v) => updateField('globalThemeEffects', { ...settings.globalThemeEffects, particlesEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>💫</span>
                  <span className="text-sm text-white">Glow Effects</span>
                </div>
                <Switch
                  checked={settings.globalThemeEffects?.glowEffectsEnabled ?? true}
                  onCheckedChange={(v) => updateField('globalThemeEffects', { ...settings.globalThemeEffects, glowEffectsEnabled: v })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>🎬</span>
                  <span className="text-sm text-white">All Animations</span>
                </div>
                <Switch
                  checked={settings.globalThemeEffects?.animationsEnabled ?? true}
                  onCheckedChange={(v) => updateField('globalThemeEffects', { ...settings.globalThemeEffects, animationsEnabled: v })}
                />
              </div>
            </div>
          </div>

          {/* Effect Intensity Sliders */}
          <div>
            <h5 className="text-sm font-semibold text-purple-400 mb-3">Holiday Effect Intensity</h5>
            <p className="text-xs text-gray-500 mb-4">Control how many particles appear (lower = better performance)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-sm flex items-center gap-2">
                    <span>❄️</span> Snow Intensity
                  </Label>
                  <span className="text-cyan-400 text-sm font-mono">{settings.globalThemeEffects?.snowIntensity ?? 30}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings.globalThemeEffects?.snowIntensity ?? 30}
                  onChange={(e) => updateField('globalThemeEffects', { ...settings.globalThemeEffects, snowIntensity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[10px] text-gray-500">Used in Christmas theme</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-sm flex items-center gap-2">
                    <span>🩸</span> Blood Intensity
                  </Label>
                  <span className="text-red-400 text-sm font-mono">{settings.globalThemeEffects?.bloodIntensity ?? 20}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings.globalThemeEffects?.bloodIntensity ?? 20}
                  onChange={(e) => updateField('globalThemeEffects', { ...settings.globalThemeEffects, bloodIntensity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <p className="text-[10px] text-gray-500">Used in Halloween theme</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-sm flex items-center gap-2">
                    <span>🎊</span> Confetti Intensity
                  </Label>
                  <span className="text-yellow-400 text-sm font-mono">{settings.globalThemeEffects?.confettiIntensity ?? 30}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings.globalThemeEffects?.confettiIntensity ?? 30}
                  onChange={(e) => updateField('globalThemeEffects', { ...settings.globalThemeEffects, confettiIntensity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <p className="text-[10px] text-gray-500">Used in Easter & Black Friday themes</p>
              </div>
            </div>
          </div>

          {/* Custom Theme Override */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-semibold text-purple-400">Custom Color Override</h5>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Override theme colors</span>
                <Switch
                  checked={settings.customThemeEnabled || false}
                  onCheckedChange={(v) => updateField('customThemeEnabled', v)}
                />
              </div>
            </div>
            {settings.customThemeEnabled && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Primary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.primaryColor || '#00ff88'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.primaryColor || '#00ff88'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, primaryColor: e.target.value })}
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder="#00ff88"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Secondary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.secondaryColor || '#00d4ff'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.secondaryColor || '#00d4ff'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, secondaryColor: e.target.value })}
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder="#00d4ff"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Accent Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.accentColor || '#ff00ff'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, accentColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.accentColor || '#ff00ff'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, accentColor: e.target.value })}
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder="#ff00ff"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Background Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.backgroundColor || '#030712'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, backgroundColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.backgroundColor || '#030712'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, backgroundColor: e.target.value })}
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder="#030712"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Text Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.textColor || '#f3f4f6'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, textColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.textColor || '#f3f4f6'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, textColor: e.target.value })}
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder="#f3f4f6"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs mb-1 block">Border Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.borderColor || '#374151'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, borderColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.borderColor || '#374151'}
                      onChange={(e) => updateField('customTheme', { ...settings.customTheme, borderColor: e.target.value })}
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder="#374151"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-gray-400 text-xs mb-1 block">Heading Font</Label>
                  <Select
                    value={settings.customTheme?.headingFont || 'Orbitron'}
                    onValueChange={(v) => updateField('customTheme', { ...settings.customTheme, headingFont: v })}
                  >
                    <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Orbitron">Orbitron (Gaming/Sci-Fi)</SelectItem>
                      <SelectItem value="Rajdhani">Rajdhani (Modern Gaming)</SelectItem>
                      <SelectItem value="Press Start 2P">Press Start 2P (Retro Pixel)</SelectItem>
                      <SelectItem value="VT323">VT323 (Terminal/Retro)</SelectItem>
                      <SelectItem value="Exo 2">Exo 2 (Futuristic)</SelectItem>
                      <SelectItem value="Space Grotesk">Space Grotesk (Clean)</SelectItem>
                      <SelectItem value="Cinzel">Cinzel (Elegant)</SelectItem>
                      <SelectItem value="Bebas Neue">Bebas Neue (Bold)</SelectItem>
                      <SelectItem value="Righteous">Righteous (Retro)</SelectItem>
                      <SelectItem value="Creepster">Creepster (Horror)</SelectItem>
                      <SelectItem value="Mountains of Christmas">Mountains of Christmas (Holiday)</SelectItem>
                      <SelectItem value="Inter">Inter (System)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            💡 <strong>Tip:</strong> Holiday themes automatically enable relevant effects (e.g., Christmas enables snow, Halloween enables blood drips).
          </p>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800 p-1">
          <TabsTrigger value="hero-page" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Sparkles className="h-4 w-4 mr-2" />
            Hero Page
          </TabsTrigger>
          <TabsTrigger value="enterprise-page" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white" disabled={!settings.enterprisePageEnabled}>
            <Building2 className="h-4 w-4 mr-2" />
            Enterprise Page
          </TabsTrigger>
        </TabsList>

        {/* ==================== HERO PAGE TAB ==================== */}
        <TabsContent value="hero-page" className="space-y-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Hero Page Sections</h3>
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-gray-600">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Page
              </Button>
            </a>
          </div>

          <Accordion type="multiple" defaultValue={['hero', 'stats']} className="space-y-4">
            {/* Hero Section */}
            <AccordionItem value="hero" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.heroEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-white">Hero Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Hero Section</Label>
                  <Switch checked={settings.heroEnabled} onCheckedChange={(v) => updateField('heroEnabled', v)} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Main Title</Label>
                    <Input value={settings.heroTitle} onChange={(e) => updateField('heroTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Badge Text</Label>
                    <Input value={settings.heroBadgeText} onChange={(e) => updateField('heroBadgeText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" placeholder="🔥 Live Trading" />
                  </div>
                </div>
                
                <div>
                  <Label className="text-gray-400">Subtitle</Label>
                  <Input value={settings.heroSubtitle} onChange={(e) => updateField('heroSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                </div>
                
                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea value={settings.heroDescription} onChange={(e) => updateField('heroDescription', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Primary Button Text</Label>
                    <Input value={settings.heroPrimaryCTAText} onChange={(e) => updateField('heroPrimaryCTAText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Primary Button Link</Label>
                    <Input value={settings.heroPrimaryCTALink} onChange={(e) => updateField('heroPrimaryCTALink', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Secondary Button Text</Label>
                    <Input value={settings.heroSecondaryCTAText} onChange={(e) => updateField('heroSecondaryCTAText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Secondary Button Link</Label>
                    <Input value={settings.heroSecondaryCTALink} onChange={(e) => updateField('heroSecondaryCTALink', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Label className="text-gray-300">Enable Particle Animation</Label>
                  <Switch checked={settings.heroParticlesEnabled} onCheckedChange={(v) => updateField('heroParticlesEnabled', v)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Stats Section */}
            <AccordionItem value="stats" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.statsEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold text-white">Stats / Counter Numbers</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <div className="flex items-center gap-4">
                    <div>
                      <Label className="text-gray-300">Enable Stats Section</Label>
                      <p className="text-xs text-gray-500">Show counting numbers on hero page</p>
                    </div>
                  </div>
                  <Switch checked={settings.statsEnabled} onCheckedChange={(v) => updateField('statsEnabled', v)} />
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Animate Numbers (Count Up)</Label>
                  <Switch checked={settings.statsAnimated} onCheckedChange={(v) => updateField('statsAnimated', v)} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Stats Items</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('stats', { id: Date.now().toString(), value: '0', suffix: '+', label: 'New Stat', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Stat
                    </Button>
                  </div>

                  {settings.stats.map((stat) => (
                    <div key={stat.id} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg">
                      <Switch checked={stat.enabled} onCheckedChange={(v) => updateArrayItem('stats', stat.id, { enabled: v })} />
                      <Input value={stat.value} onChange={(e) => updateArrayItem('stats', stat.id, { value: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-24" placeholder="10000" />
                      <Input value={stat.suffix} onChange={(e) => updateArrayItem('stats', stat.id, { suffix: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-16" placeholder="+" />
                      <Input value={stat.label} onChange={(e) => updateArrayItem('stats', stat.id, { label: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Label" />
                      <Button size="icon" variant="ghost" onClick={() => removeItem('stats', stat.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Features Section */}
            <AccordionItem value="features" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.featuresEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Layers className="h-5 w-5 text-purple-500" />
                  <span className="font-semibold text-white">Features Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Features Section</Label>
                  <Switch checked={settings.featuresEnabled} onCheckedChange={(v) => updateField('featuresEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.featuresTitle} onChange={(e) => updateField('featuresTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input value={settings.featuresSubtitle} onChange={(e) => updateField('featuresSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Feature Cards</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('features', { id: Date.now().toString(), icon: 'Star', title: 'New Feature', description: 'Description here', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Feature
                    </Button>
                  </div>

                  {settings.features.map((feature) => (
                    <div key={feature.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                      <div className="flex items-center gap-3">
                        <Switch checked={feature.enabled} onCheckedChange={(v) => updateArrayItem('features', feature.id, { enabled: v })} />
                        <Select value={feature.icon} onValueChange={(v) => updateArrayItem('features', feature.id, { icon: v })}>
                          <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableIcons.map(icon => (
                              <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input value={feature.title} onChange={(e) => updateArrayItem('features', feature.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Title" />
                        <Button size="icon" variant="ghost" onClick={() => removeItem('features', feature.id)} className="text-red-500 hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea value={feature.description} onChange={(e) => updateArrayItem('features', feature.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={2} placeholder="Feature description..." />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* How It Works */}
            <AccordionItem value="howItWorks" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.howItWorksEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Settings className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-white">How It Works</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable How It Works Section</Label>
                  <Switch checked={settings.howItWorksEnabled} onCheckedChange={(v) => updateField('howItWorksEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.howItWorksTitle} onChange={(e) => updateField('howItWorksTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input value={settings.howItWorksSubtitle} onChange={(e) => updateField('howItWorksSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Steps</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('howItWorksSteps', { id: Date.now().toString(), step: settings.howItWorksSteps.length + 1, title: 'New Step', description: 'Step description', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Step
                    </Button>
                  </div>

                  {settings.howItWorksSteps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg">
                      <Switch checked={step.enabled} onCheckedChange={(v) => updateArrayItem('howItWorksSteps', step.id, { enabled: v })} />
                      <div className="w-10 h-10 rounded-full bg-yellow-500 text-gray-900 flex items-center justify-center font-bold">{step.step}</div>
                      <div className="flex-1 space-y-1">
                        <Input value={step.title} onChange={(e) => updateArrayItem('howItWorksSteps', step.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Step title" />
                        <Input value={step.description} onChange={(e) => updateArrayItem('howItWorksSteps', step.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white text-sm" placeholder="Description" />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeItem('howItWorksSteps', step.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Competitions Section */}
            <AccordionItem value="competitions" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.competitionsEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-white">Competitions Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Competitions Section</Label>
                  <Switch checked={settings.competitionsEnabled} onCheckedChange={(v) => updateField('competitionsEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.competitionsTitle} onChange={(e) => updateField('competitionsTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Badge/Subtitle</Label>
                    <Input value={settings.competitionsSubtitle} onChange={(e) => updateField('competitionsSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea value={settings.competitionsDescription} onChange={(e) => updateField('competitionsDescription', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Button Text</Label>
                    <Input value={settings.competitionsCTAText} onChange={(e) => updateField('competitionsCTAText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Button Link</Label>
                    <Input value={settings.competitionsCTALink} onChange={(e) => updateField('competitionsCTALink', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Challenges Section */}
            <AccordionItem value="challenges" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.challengesEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Swords className="h-5 w-5 text-purple-500" />
                  <span className="font-semibold text-white">Challenges Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Challenges Section</Label>
                  <Switch checked={settings.challengesEnabled} onCheckedChange={(v) => updateField('challengesEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.challengesTitle} onChange={(e) => updateField('challengesTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Badge/Subtitle</Label>
                    <Input value={settings.challengesSubtitle} onChange={(e) => updateField('challengesSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea value={settings.challengesDescription} onChange={(e) => updateField('challengesDescription', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Button Text</Label>
                    <Input value={settings.challengesCTAText} onChange={(e) => updateField('challengesCTAText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Button Link</Label>
                    <Input value={settings.challengesCTALink} onChange={(e) => updateField('challengesCTALink', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Final CTA */}
            <AccordionItem value="cta" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.ctaEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Rocket className="h-5 w-5 text-orange-500" />
                  <span className="font-semibold text-white">Final Call-to-Action</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Final CTA Section</Label>
                  <Switch checked={settings.ctaEnabled} onCheckedChange={(v) => updateField('ctaEnabled', v)} />
                </div>

                <div>
                  <Label className="text-gray-400">Title</Label>
                  <Input value={settings.ctaTitle} onChange={(e) => updateField('ctaTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                </div>

                <div>
                  <Label className="text-gray-400">Subtitle</Label>
                  <Input value={settings.ctaSubtitle} onChange={(e) => updateField('ctaSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                </div>

                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea value={settings.ctaDescription} onChange={(e) => updateField('ctaDescription', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Button Text</Label>
                    <Input value={settings.ctaButtonText} onChange={(e) => updateField('ctaButtonText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Button Link</Label>
                    <Input value={settings.ctaButtonLink} onChange={(e) => updateField('ctaButtonLink', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Footer */}
            <AccordionItem value="footer" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.footerEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span className="font-semibold text-white">Footer</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Footer</Label>
                  <Switch checked={settings.footerEnabled} onCheckedChange={(v) => updateField('footerEnabled', v)} />
                </div>

                {/* Risk Disclaimer */}
                <div className="p-4 bg-gray-900 rounded-lg space-y-3">
                  <Label className="text-yellow-500 font-semibold">⚠️ Risk Disclaimer</Label>
                  <Textarea 
                    value={settings.footerRiskDisclaimer} 
                    onChange={(e) => updateField('footerRiskDisclaimer', e.target.value)} 
                    className="bg-gray-800 border-gray-600 text-white" 
                    rows={5} 
                    placeholder="Trading involves substantial risk..."
                  />
                  <p className="text-xs text-gray-500">This is the main risk disclaimer shown in the footer.</p>
                </div>

                {/* Additional Disclaimer */}
                <div>
                  <Label className="text-gray-400">Additional Disclaimer (Optional)</Label>
                  <Textarea value={settings.footerDisclaimer} onChange={(e) => updateField('footerDisclaimer', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} placeholder="Additional legal text..." />
                </div>

                {/* Copyright */}
                <div>
                  <Label className="text-gray-400">Copyright Text</Label>
                  <Input value={settings.footerCopyright} onChange={(e) => updateField('footerCopyright', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                </div>

                {/* Platform Menu */}
                <div className="p-4 bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300 font-semibold">Platform Menu Links</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('footerMenuPlatform', { id: Date.now().toString(), label: 'New Link', href: '/', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Link
                    </Button>
                  </div>
                  {settings.footerMenuPlatform.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Switch checked={item.enabled} onCheckedChange={(v) => updateArrayItem('footerMenuPlatform', item.id, { enabled: v })} />
                      <Input value={item.label} onChange={(e) => updateArrayItem('footerMenuPlatform', item.id, { label: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Label" />
                      <Input value={item.href} onChange={(e) => updateArrayItem('footerMenuPlatform', item.id, { href: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="/path" />
                      <Button size="icon" variant="ghost" onClick={() => removeItem('footerMenuPlatform', item.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Support Menu */}
                <div className="p-4 bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300 font-semibold">Support Menu Links</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('footerMenuSupport', { id: Date.now().toString(), label: 'New Link', href: '/', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Link
                    </Button>
                  </div>
                  {settings.footerMenuSupport.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Switch checked={item.enabled} onCheckedChange={(v) => updateArrayItem('footerMenuSupport', item.id, { enabled: v })} />
                      <Input value={item.label} onChange={(e) => updateArrayItem('footerMenuSupport', item.id, { label: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Label" />
                      <Input value={item.href} onChange={(e) => updateArrayItem('footerMenuSupport', item.id, { href: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="/path or mailto:" />
                      <Button size="icon" variant="ghost" onClick={() => removeItem('footerMenuSupport', item.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Business Menu */}
                <div className="p-4 bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300 font-semibold">Business Menu Links</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('footerMenuBusiness', { id: Date.now().toString(), label: 'New Link', href: '/', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Link
                    </Button>
                  </div>
                  {settings.footerMenuBusiness.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Switch checked={item.enabled} onCheckedChange={(v) => updateArrayItem('footerMenuBusiness', item.id, { enabled: v })} />
                      <Input value={item.label} onChange={(e) => updateArrayItem('footerMenuBusiness', item.id, { label: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Label" />
                      <Input value={item.href} onChange={(e) => updateArrayItem('footerMenuBusiness', item.id, { href: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="/path" />
                      <Button size="icon" variant="ghost" onClick={() => removeItem('footerMenuBusiness', item.id)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* ==================== ENTERPRISE PAGE TAB ==================== */}
        <TabsContent value="enterprise-page" className="space-y-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Enterprise Page Sections</h3>
            <a href="/enterprise" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-gray-600">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Page
              </Button>
            </a>
          </div>

          <Accordion type="multiple" defaultValue={['ent-hero']} className="space-y-4">
            {/* Enterprise Hero */}
            <AccordionItem value="ent-hero" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <span className="font-semibold text-white">Hero Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Title</Label>
                    <Input value={settings.enterpriseHeroTitle} onChange={(e) => updateField('enterpriseHeroTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Badge Text</Label>
                    <Input value={settings.enterpriseHeroBadge} onChange={(e) => updateField('enterpriseHeroBadge', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea value={settings.enterpriseHeroDescription} onChange={(e) => updateField('enterpriseHeroDescription', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Primary Button Text</Label>
                    <Input value={settings.enterpriseHeroCTAText} onChange={(e) => updateField('enterpriseHeroCTAText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Primary Button Link</Label>
                    <Input value={settings.enterpriseHeroCTALink} onChange={(e) => updateField('enterpriseHeroCTALink', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* White Label Features */}
            <AccordionItem value="ent-whitelabel" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.enterpriseWhiteLabelEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Globe className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold text-white">White Label Features</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable White Label Section</Label>
                  <Switch checked={settings.enterpriseWhiteLabelEnabled} onCheckedChange={(v) => updateField('enterpriseWhiteLabelEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.enterpriseWhiteLabelTitle} onChange={(e) => updateField('enterpriseWhiteLabelTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input value={settings.enterpriseWhiteLabelSubtitle} onChange={(e) => updateField('enterpriseWhiteLabelSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Features</Label>
                    <Button size="sm" variant="outline" onClick={() => addItem('enterpriseWhiteLabelFeatures', { id: Date.now().toString(), icon: 'Star', title: 'New Feature', description: 'Description', enabled: true })} className="border-gray-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Feature
                    </Button>
                  </div>

                  {settings.enterpriseWhiteLabelFeatures.map((feature) => (
                    <div key={feature.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                      <div className="flex items-center gap-3">
                        <Switch checked={feature.enabled} onCheckedChange={(v) => updateArrayItem('enterpriseWhiteLabelFeatures', feature.id, { enabled: v })} />
                        <Select value={feature.icon} onValueChange={(v) => updateArrayItem('enterpriseWhiteLabelFeatures', feature.id, { icon: v })}>
                          <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableIcons.map(icon => (
                              <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input value={feature.title} onChange={(e) => updateArrayItem('enterpriseWhiteLabelFeatures', feature.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" />
                        <Button size="icon" variant="ghost" onClick={() => removeItem('enterpriseWhiteLabelFeatures', feature.id)} className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input value={feature.description} onChange={(e) => updateArrayItem('enterpriseWhiteLabelFeatures', feature.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Description" />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Admin Panel Showcase */}
            <AccordionItem value="ent-admin" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.enterpriseAdminEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <Settings className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold text-white">Admin Panel Showcase</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Admin Showcase Section</Label>
                  <Switch checked={settings.enterpriseAdminEnabled} onCheckedChange={(v) => updateField('enterpriseAdminEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.enterpriseAdminTitle} onChange={(e) => updateField('enterpriseAdminTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input value={settings.enterpriseAdminSubtitle} onChange={(e) => updateField('enterpriseAdminSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea value={settings.enterpriseAdminDescription} onChange={(e) => updateField('enterpriseAdminDescription', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Pricing */}
            <AccordionItem value="ent-pricing" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.enterprisePricingEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-white">Pricing Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Pricing Section</Label>
                  <Switch checked={settings.enterprisePricingEnabled} onCheckedChange={(v) => updateField('enterprisePricingEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.enterprisePricingTitle} onChange={(e) => updateField('enterprisePricingTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input value={settings.enterprisePricingSubtitle} onChange={(e) => updateField('enterprisePricingSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-gray-300">Pricing Tiers</Label>
                  {settings.enterprisePricingTiers.map((tier) => (
                    <div key={tier.id} className="p-4 bg-gray-900 rounded-lg space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch checked={tier.enabled} onCheckedChange={(v) => updateArrayItem('enterprisePricingTiers', tier.id, { enabled: v })} />
                        <Input value={tier.name} onChange={(e) => updateArrayItem('enterprisePricingTiers', tier.id, { name: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-32" placeholder="Plan Name" />
                        <Input value={tier.price} onChange={(e) => updateArrayItem('enterprisePricingTiers', tier.id, { price: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-24" placeholder="$499" />
                        <Input value={tier.period} onChange={(e) => updateArrayItem('enterprisePricingTiers', tier.id, { period: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-20" placeholder="/month" />
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-400">Highlight</Label>
                          <Switch checked={tier.highlighted} onCheckedChange={(v) => updateArrayItem('enterprisePricingTiers', tier.id, { highlighted: v })} />
                        </div>
                      </div>
                      <Input value={tier.description} onChange={(e) => updateArrayItem('enterprisePricingTiers', tier.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Plan description" />
                      <Input value={tier.ctaText} onChange={(e) => updateArrayItem('enterprisePricingTiers', tier.id, { ctaText: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Button text" />
                      <Textarea
                        value={tier.features.join('\n')}
                        onChange={(e) => updateArrayItem('enterprisePricingTiers', tier.id, { features: e.target.value.split('\n').filter(f => f.trim()) })}
                        className="bg-gray-800 border-gray-600 text-white"
                        rows={3}
                        placeholder="Features (one per line)"
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Contact */}
            <AccordionItem value="ent-contact" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${settings.enterpriseContactEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <FileText className="h-5 w-5 text-pink-500" />
                  <span className="font-semibold text-white">Contact Section</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                  <Label className="text-gray-300">Enable Contact Section</Label>
                  <Switch checked={settings.enterpriseContactEnabled} onCheckedChange={(v) => updateField('enterpriseContactEnabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input value={settings.enterpriseContactTitle} onChange={(e) => updateField('enterpriseContactTitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input value={settings.enterpriseContactSubtitle} onChange={(e) => updateField('enterpriseContactSubtitle', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Contact Email</Label>
                    <Input value={settings.enterpriseContactEmail} onChange={(e) => updateField('enterpriseContactEmail', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-400">Contact Phone</Label>
                    <Input value={settings.enterpriseContactPhone} onChange={(e) => updateField('enterpriseContactPhone', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-400">CTA Button Text</Label>
                  <Input value={settings.enterpriseContactCTAText} onChange={(e) => updateField('enterpriseContactCTAText', e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}

