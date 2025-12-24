'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Save,
  RefreshCw,
  Palette,
  Layout,
  Type,
  Image as ImageIcon,
  Settings,
  Eye,
  Sparkles,
  Monitor,
  Smartphone,
  Upload,
  Trash2,
  Plus,
  GripVertical,
  Check,
  X,
  ExternalLink,
  Code,
  Search,
  Zap,
  Trophy,
  Users,
  BarChart3,
  Shield,
  Globe,
  Loader2,
  FileText,
  Building2,
  CreditCard,
  Mail,
  Phone,
} from 'lucide-react';

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  fontFamily: string;
  buttonStyle: string;
  cardStyle: string;
  animationStyle: string;
}

interface HeroSettings {
  // All the settings from our model
  siteName: string;
  tagline: string;
  description: string;
  logo: string;
  favicon: string;
  activeTheme: string;
  customTheme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
    fontFamily: string;
    headingFont: string;
    buttonRadius: string;
    cardRadius: string;
    shadowIntensity: string;
    glowIntensity: string;
  };
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBackgroundImage: string;
  heroBackgroundVideo: string;
  heroBackgroundType: string;
  heroParticlesConfig: {
    enabled: boolean;
    color: string;
    count: number;
    speed: number;
    shape: string;
  };
  heroCTAButtons: Array<{
    id: string;
    text: string;
    href: string;
    style: string;
    icon: string;
    enabled: boolean;
  }>;
  heroAnimationType: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    order: number;
    enabled: boolean;
  }>;
  featuresLayout: string;
  featuresColumns: number;
  statsTitle: string;
  statsSubtitle: string;
  stats: Array<{
    id: string;
    label: string;
    value: string;
    suffix: string;
    icon: string;
    color: string;
    enabled: boolean;
    order: number;
  }>;
  statsBackground: string;
  statsAnimated: boolean;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: Array<{
    id: string;
    step: number;
    title: string;
    description: string;
    icon: string;
    enabled: boolean;
  }>;
  howItWorksLayout: string;
  competitionsTitle: string;
  competitionsSubtitle: string;
  competitionsDescription: string;
  competitionsCTAText: string;
  competitionsCTALink: string;
  challengesTitle: string;
  challengesSubtitle: string;
  challengesDescription: string;
  challengesCTAText: string;
  challengesCTALink: string;
  leaderboardTitle: string;
  leaderboardSubtitle: string;
  leaderboardShowTop: number;
  leaderboardStyle: string;
  marketplaceTitle: string;
  marketplaceSubtitle: string;
  marketplaceShowItems: number;
  adminShowcaseTitle: string;
  adminShowcaseSubtitle: string;
  adminShowcaseDescription: string;
  adminShowcaseFeatures: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    enabled: boolean;
    order: number;
  }>;
  adminShowcaseScreenshots: string[];
  adminShowcaseCTAText: string;
  adminShowcaseCTALink: string;
  whiteLabelTitle: string;
  whiteLabelSubtitle: string;
  whiteLabelDescription: string;
  whiteLabelFeatures: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    enabled: boolean;
    order: number;
  }>;
  whiteLabelCTAText: string;
  whiteLabelCTALink: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  ctaBackground: string;
  ctaStyle: string;
  footerCopyright: string;
  footerDisclaimer: string;
  sectionVisibility: {
    hero: boolean;
    features: boolean;
    stats: boolean;
    howItWorks: boolean;
    competitions: boolean;
    challenges: boolean;
    leaderboard: boolean;
    marketplace: boolean;
    testimonials: boolean;
    adminShowcase: boolean;
    whiteLabel: boolean;
    pricing: boolean;
    faq: boolean;
    cta: boolean;
    footer: boolean;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string[];
    ogImage: string;
    ogTitle: string;
    ogDescription: string;
  };
  customCSS: string;
  customJS: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
  // Enterprise Page Settings
  enterpriseHeroTitle: string;
  enterpriseHeroSubtitle: string;
  enterpriseHeroDescription: string;
  enterpriseHeroBadge: string;
  enterpriseHeroCTAText: string;
  enterpriseHeroCTALink: string;
  enterpriseHeroSecondaryCTAText: string;
  enterpriseHeroSecondaryCTALink: string;
  enterpriseTrustBadges: Array<{ id: string; icon: string; text: string; enabled: boolean; }>;
  enterpriseWhiteLabelTitle: string;
  enterpriseWhiteLabelSubtitle: string;
  enterpriseWhiteLabelFeatures: Array<{ id: string; icon: string; title: string; description: string; enabled: boolean; order: number; }>;
  enterpriseAdminTitle: string;
  enterpriseAdminSubtitle: string;
  enterpriseAdminDescription: string;
  enterpriseAdminFeatures: Array<{ id: string; icon: string; title: string; description: string; color: string; enabled: boolean; order: number; }>;
  enterprisePricingTitle: string;
  enterprisePricingSubtitle: string;
  enterprisePricingTiers: Array<{ id: string; name: string; price: string; period: string; description: string; features: string[]; ctaText: string; highlighted: boolean; enabled: boolean; order: number; }>;
  enterpriseContactTitle: string;
  enterpriseContactSubtitle: string;
  enterpriseContactEmail: string;
  enterpriseContactPhone: string;
  enterpriseContactCTAText: string;
  enterpriseSectionVisibility: {
    hero: boolean;
    trustBadges: boolean;
    whiteLabel: boolean;
    adminShowcase: boolean;
    pricing: boolean;
    contact: boolean;
    footer: boolean;
  };
}

const defaultSettings: HeroSettings = {
  siteName: 'TradingArena',
  tagline: 'Where Champions Trade',
  description: 'The ultimate competitive trading platform',
  logo: '',
  favicon: '',
  activeTheme: 'cyber-neon',
  customTheme: {
    primaryColor: '#00f0ff',
    secondaryColor: '#ff00ff',
    accentColor: '#ffd700',
    backgroundColor: '#0a0a0f',
    textColor: '#ffffff',
    gradientFrom: '#00f0ff',
    gradientTo: '#ff00ff',
    gradientAngle: 135,
    fontFamily: 'Orbitron',
    headingFont: 'Orbitron',
    buttonRadius: '0.75rem',
    cardRadius: '1rem',
    shadowIntensity: 'medium',
    glowIntensity: 'medium',
  },
  heroTitle: 'DOMINATE THE MARKETS',
  heroSubtitle: 'Compete • Trade • Win',
  heroDescription: 'Join the world\'s most exciting trading competitions.',
  heroBackgroundImage: '',
  heroBackgroundVideo: '',
  heroBackgroundType: 'particles',
  heroParticlesConfig: {
    enabled: true,
    color: '#00f0ff',
    count: 50,
    speed: 2,
    shape: 'circle',
  },
  heroCTAButtons: [],
  heroAnimationType: 'glitch',
  featuresTitle: 'UNLEASH YOUR POTENTIAL',
  featuresSubtitle: 'Everything you need to dominate',
  features: [],
  featuresLayout: 'grid',
  featuresColumns: 3,
  statsTitle: 'THE NUMBERS SPEAK',
  statsSubtitle: 'Join the fastest growing trading community',
  stats: [],
  statsBackground: 'gradient',
  statsAnimated: true,
  howItWorksTitle: 'START WINNING IN 4 STEPS',
  howItWorksSubtitle: 'From zero to champion',
  howItWorksSteps: [],
  howItWorksLayout: 'timeline',
  competitionsTitle: 'LIVE COMPETITIONS',
  competitionsSubtitle: 'Enter the arena',
  competitionsDescription: 'Real-time trading battles with live leaderboards',
  competitionsCTAText: 'View All Competitions',
  competitionsCTALink: '/competitions',
  challengesTitle: '1V1 CHALLENGES',
  challengesSubtitle: 'Prove your skills',
  challengesDescription: 'Challenge any trader to a head-to-head battle',
  challengesCTAText: 'Start a Challenge',
  challengesCTALink: '/challenges',
  leaderboardTitle: 'TOP TRADERS',
  leaderboardSubtitle: 'The elite of the elite',
  leaderboardShowTop: 5,
  leaderboardStyle: 'podium',
  marketplaceTitle: 'TRADING ARSENAL',
  marketplaceSubtitle: 'Upgrade your style',
  marketplaceShowItems: 4,
  adminShowcaseTitle: 'POWERFUL ADMIN PANEL',
  adminShowcaseSubtitle: 'Total control at your fingertips',
  adminShowcaseDescription: 'Manage every aspect of your trading platform',
  adminShowcaseFeatures: [],
  adminShowcaseScreenshots: [],
  adminShowcaseCTAText: 'See Admin Features',
  adminShowcaseCTALink: '#admin-features',
  whiteLabelTitle: 'WHITE LABEL SOLUTION',
  whiteLabelSubtitle: 'Your brand, your platform',
  whiteLabelDescription: 'Launch your own branded trading platform',
  whiteLabelFeatures: [],
  whiteLabelCTAText: 'Get Started',
  whiteLabelCTALink: '/contact',
  ctaTitle: 'READY TO DOMINATE?',
  ctaSubtitle: 'Join thousands of traders already winning',
  ctaDescription: 'Create your free account and start competing today',
  ctaButtonText: 'START TRADING NOW',
  ctaButtonLink: '/sign-up',
  ctaBackground: '',
  ctaStyle: 'animated',
  footerCopyright: '© 2024 TradingArena. All rights reserved.',
  footerDisclaimer: '',
  sectionVisibility: {
    hero: true,
    features: true,
    stats: true,
    howItWorks: true,
    competitions: true,
    challenges: true,
    leaderboard: true,
    marketplace: true,
    testimonials: false,
    adminShowcase: true,
    whiteLabel: true,
    pricing: false,
    faq: true,
    cta: true,
    footer: true,
  },
  seo: {
    metaTitle: '',
    metaDescription: '',
    metaKeywords: [],
    ogImage: '',
    ogTitle: '',
    ogDescription: '',
  },
  customCSS: '',
  customJS: '',
  googleAnalyticsId: '',
  facebookPixelId: '',
  // Enterprise Page Settings Defaults
  enterpriseHeroTitle: 'Launch Your Own Trading Platform',
  enterpriseHeroSubtitle: 'Enterprise Solutions',
  enterpriseHeroDescription: 'Complete white-label solution with powerful admin panel, fraud detection, payment processing, and everything you need.',
  enterpriseHeroBadge: 'Enterprise Solutions',
  enterpriseHeroCTAText: 'Request Demo',
  enterpriseHeroCTALink: '#contact',
  enterpriseHeroSecondaryCTAText: 'See Admin Panel',
  enterpriseHeroSecondaryCTALink: '#admin',
  enterpriseTrustBadges: [],
  enterpriseWhiteLabelTitle: 'White Label Solution',
  enterpriseWhiteLabelSubtitle: 'Launch your own branded trading platform without writing a single line of code',
  enterpriseWhiteLabelFeatures: [],
  enterpriseAdminTitle: 'Complete Control Center',
  enterpriseAdminSubtitle: 'Powerful Admin Panel',
  enterpriseAdminDescription: 'Everything you need to manage your platform, users, competitions, and revenue in one place',
  enterpriseAdminFeatures: [],
  enterprisePricingTitle: 'Simple, Transparent Pricing',
  enterprisePricingSubtitle: 'Choose the plan that fits your needs. All plans include core features.',
  enterprisePricingTiers: [],
  enterpriseContactTitle: 'Ready to Get Started?',
  enterpriseContactSubtitle: 'Contact our sales team for a personalized demo and quote',
  enterpriseContactEmail: 'enterprise@chartvolt.com',
  enterpriseContactPhone: '+1 (234) 567-890',
  enterpriseContactCTAText: 'Schedule Demo',
  enterpriseSectionVisibility: {
    hero: true,
    trustBadges: true,
    whiteLabel: true,
    adminShowcase: true,
    pricing: true,
    contact: true,
    footer: true,
  },
};

export default function HeroPageSection() {
  const [settings, setSettings] = useState<HeroSettings>(defaultSettings);
  const [themePresets, setThemePresets] = useState<ThemePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('themes');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hero-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
        if (data.themePresets) {
          setThemePresets(data.themePresets);
        }
      }
    } catch (error) {
      console.error('Error fetching hero settings:', error);
      toast.error('Failed to load hero settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/hero-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Hero settings saved successfully');
        setHasChanges(false);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving hero settings:', error);
      toast.error('Failed to save hero settings');
    } finally {
      setSaving(false);
    }
  };

  // Apply theme preset
  const applyTheme = async (themeId: string) => {
    try {
      const response = await fetch('/api/hero-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply-theme', themeId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({ ...defaultSettings, ...data.settings });
        toast.success(data.message);
      }
    } catch (error) {
      console.error('Error applying theme:', error);
      toast.error('Failed to apply theme');
    }
  };

  // Upload image
  const uploadImage = async (file: File, type: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/hero-settings/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.url;
      }
      return null;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      return null;
    }
  };

  // Update settings helper
  const updateSettings = (path: string, value: unknown) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: Record<string, unknown> = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      
      return newSettings;
    });
    setHasChanges(true);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layout className="h-6 w-6 text-yellow-500" />
            Hero Page Builder
          </h2>
          <p className="text-gray-400 mt-1">
            Customize your landing page with professional gaming-style design
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Preview Toggle */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`p-2 rounded ${previewMode === 'desktop' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`p-2 rounded ${previewMode === 'mobile' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          
          {/* Preview Button */}
          <Button
            variant="outline"
            className="border-gray-600 text-gray-300"
            onClick={() => window.open('/landing', '_blank')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          
          {/* Save Button */}
          <Button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-800 p-1 flex-wrap h-auto">
          <TabsTrigger value="themes" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Palette className="h-4 w-4 mr-2" />
            Themes
          </TabsTrigger>
          <TabsTrigger value="hero" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Sparkles className="h-4 w-4 mr-2" />
            Hero
          </TabsTrigger>
          <TabsTrigger value="sections" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Layout className="h-4 w-4 mr-2" />
            Sections
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <ImageIcon className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="seo" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Search className="h-4 w-4 mr-2" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="advanced" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Code className="h-4 w-4 mr-2" />
            Advanced
          </TabsTrigger>
          <TabsTrigger value="footer" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <FileText className="h-4 w-4 mr-2" />
            Footer
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white">
            <Building2 className="h-4 w-4 mr-2" />
            Enterprise
          </TabsTrigger>
        </TabsList>

        {/* Themes Tab */}
        <TabsContent value="themes" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Theme Presets</CardTitle>
              <CardDescription>
                Choose a pre-built theme or customize your own colors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {themePresets.map((theme) => (
                  <div
                    key={theme.id}
                    onClick={() => applyTheme(theme.id)}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      settings.activeTheme === theme.id
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-900'
                    }`}
                  >
                    {settings.activeTheme === theme.id && (
                      <div className="absolute top-2 right-2 bg-yellow-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-gray-900" />
                      </div>
                    )}
                    <div className="flex gap-2 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: theme.primaryColor }}
                      />
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: theme.secondaryColor }}
                      />
                      <div
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: theme.accentColor }}
                      />
                    </div>
                    <h4 className="font-bold text-white mb-1">{theme.name}</h4>
                    <p className="text-sm text-gray-400">{theme.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        {theme.buttonStyle}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        {theme.cardStyle}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Theme Colors */}
              <div className="mt-8 pt-6 border-t border-gray-700">
                <h4 className="font-bold text-white mb-4">Custom Theme Colors</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-gray-400">Primary Color</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={settings.customTheme.primaryColor}
                        onChange={(e) => updateSettings('customTheme.primaryColor', e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={settings.customTheme.primaryColor}
                        onChange={(e) => updateSettings('customTheme.primaryColor', e.target.value)}
                        className="bg-gray-900 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Secondary Color</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={settings.customTheme.secondaryColor}
                        onChange={(e) => updateSettings('customTheme.secondaryColor', e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={settings.customTheme.secondaryColor}
                        onChange={(e) => updateSettings('customTheme.secondaryColor', e.target.value)}
                        className="bg-gray-900 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Accent Color</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={settings.customTheme.accentColor}
                        onChange={(e) => updateSettings('customTheme.accentColor', e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={settings.customTheme.accentColor}
                        onChange={(e) => updateSettings('customTheme.accentColor', e.target.value)}
                        className="bg-gray-900 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400">Background Color</Label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={settings.customTheme.backgroundColor}
                        onChange={(e) => updateSettings('customTheme.backgroundColor', e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={settings.customTheme.backgroundColor}
                        onChange={(e) => updateSettings('customTheme.backgroundColor', e.target.value)}
                        className="bg-gray-900 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Font Selection */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Heading Font</Label>
                    <Select
                      value={settings.customTheme.headingFont}
                      onValueChange={(v) => updateSettings('customTheme.headingFont', v)}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="Orbitron">Orbitron (Futuristic)</SelectItem>
                        <SelectItem value="Cinzel">Cinzel (Elegant)</SelectItem>
                        <SelectItem value="Rajdhani">Rajdhani (Modern)</SelectItem>
                        <SelectItem value="Share Tech Mono">Share Tech Mono (Tech)</SelectItem>
                        <SelectItem value="Bebas Neue">Bebas Neue (Bold)</SelectItem>
                        <SelectItem value="Exo 2">Exo 2 (Clean)</SelectItem>
                        <SelectItem value="Inter">Inter (Minimal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Body Font</Label>
                    <Select
                      value={settings.customTheme.fontFamily}
                      onValueChange={(v) => updateSettings('customTheme.fontFamily', v)}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Rajdhani">Rajdhani</SelectItem>
                        <SelectItem value="Exo 2">Exo 2</SelectItem>
                        <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                        <SelectItem value="Poppins">Poppins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Effects */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Shadow Intensity</Label>
                    <Select
                      value={settings.customTheme.shadowIntensity}
                      onValueChange={(v) => updateSettings('customTheme.shadowIntensity', v)}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="heavy">Heavy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Glow Intensity</Label>
                    <Select
                      value={settings.customTheme.glowIntensity}
                      onValueChange={(v) => updateSettings('customTheme.glowIntensity', v)}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="subtle">Subtle</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="intense">Intense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hero Tab */}
        <TabsContent value="hero" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Hero Section</CardTitle>
              <CardDescription>
                Configure the main hero banner of your landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title & Subtitle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Hero Title</Label>
                  <Input
                    value={settings.heroTitle}
                    onChange={(e) => updateSettings('heroTitle', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="DOMINATE THE MARKETS"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Hero Subtitle</Label>
                  <Input
                    value={settings.heroSubtitle}
                    onChange={(e) => updateSettings('heroSubtitle', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="Compete • Trade • Win"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-400">Hero Description</Label>
                <Textarea
                  value={settings.heroDescription}
                  onChange={(e) => updateSettings('heroDescription', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={3}
                />
              </div>

              {/* Background Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Background Type</Label>
                  <Select
                    value={settings.heroBackgroundType}
                    onValueChange={(v) => updateSettings('heroBackgroundType', v)}
                  >
                    <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="color">Solid Color</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="particles">Animated Particles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400">Animation Type</Label>
                  <Select
                    value={settings.heroAnimationType}
                    onValueChange={(v) => updateSettings('heroAnimationType', v)}
                  >
                    <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="fade">Fade In</SelectItem>
                      <SelectItem value="slide">Slide Up</SelectItem>
                      <SelectItem value="zoom">Zoom In</SelectItem>
                      <SelectItem value="typewriter">Typewriter Effect</SelectItem>
                      <SelectItem value="glitch">Glitch Effect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Particles Config */}
              {settings.heroBackgroundType === 'particles' && (
                <div className="p-4 bg-gray-900 rounded-lg space-y-4">
                  <h4 className="font-medium text-white">Particles Configuration</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.heroParticlesConfig.enabled}
                        onCheckedChange={(v) => updateSettings('heroParticlesConfig.enabled', v)}
                      />
                      <Label className="text-gray-400">Enabled</Label>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Particle Color</Label>
                      <input
                        type="color"
                        value={settings.heroParticlesConfig.color}
                        onChange={(e) => updateSettings('heroParticlesConfig.color', e.target.value)}
                        className="w-full h-8 rounded cursor-pointer mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Count</Label>
                      <Input
                        type="number"
                        value={settings.heroParticlesConfig.count}
                        onChange={(e) => updateSettings('heroParticlesConfig.count', parseInt(e.target.value))}
                        className="bg-gray-800 border-gray-600 text-white mt-1"
                        min={10}
                        max={200}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Shape</Label>
                      <Select
                        value={settings.heroParticlesConfig.shape}
                        onValueChange={(v) => updateSettings('heroParticlesConfig.shape', v)}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="circle">Circle</SelectItem>
                          <SelectItem value="square">Square</SelectItem>
                          <SelectItem value="triangle">Triangle</SelectItem>
                          <SelectItem value="star">Star</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA Buttons */}
              <div>
                <Label className="text-gray-400 mb-2 block">CTA Buttons</Label>
                <div className="space-y-3">
                  {settings.heroCTAButtons.map((btn, idx) => (
                    <div key={btn.id} className="flex gap-3 items-center bg-gray-900 p-3 rounded-lg">
                      <GripVertical className="h-4 w-4 text-gray-500" />
                      <Input
                        value={btn.text}
                        onChange={(e) => {
                          const newButtons = [...settings.heroCTAButtons];
                          newButtons[idx].text = e.target.value;
                          updateSettings('heroCTAButtons', newButtons);
                        }}
                        className="bg-gray-800 border-gray-600 text-white"
                        placeholder="Button Text"
                      />
                      <Input
                        value={btn.href}
                        onChange={(e) => {
                          const newButtons = [...settings.heroCTAButtons];
                          newButtons[idx].href = e.target.value;
                          updateSettings('heroCTAButtons', newButtons);
                        }}
                        className="bg-gray-800 border-gray-600 text-white"
                        placeholder="/link"
                      />
                      <Select
                        value={btn.style}
                        onValueChange={(v) => {
                          const newButtons = [...settings.heroCTAButtons];
                          newButtons[idx].style = v;
                          updateSettings('heroCTAButtons', newButtons);
                        }}
                      >
                        <SelectTrigger className="w-32 bg-gray-800 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="outline">Outline</SelectItem>
                          <SelectItem value="ghost">Ghost</SelectItem>
                        </SelectContent>
                      </Select>
                      <Switch
                        checked={btn.enabled}
                        onCheckedChange={(v) => {
                          const newButtons = [...settings.heroCTAButtons];
                          newButtons[idx].enabled = v;
                          updateSettings('heroCTAButtons', newButtons);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newButtons = settings.heroCTAButtons.filter((_, i) => i !== idx);
                          updateSettings('heroCTAButtons', newButtons);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newButtons = [
                        ...settings.heroCTAButtons,
                        {
                          id: `btn-${Date.now()}`,
                          text: 'New Button',
                          href: '/',
                          style: 'primary',
                          icon: '',
                          enabled: true,
                        },
                      ];
                      updateSettings('heroCTAButtons', newButtons);
                    }}
                    className="border-dashed border-gray-600 text-gray-400"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Button
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sections Tab */}
        <TabsContent value="sections" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Section Visibility</CardTitle>
              <CardDescription>
                Toggle sections on/off and configure their content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(settings.sectionVisibility).map(([key, value]) => (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border ${
                      value ? 'border-green-500/50 bg-green-500/10' : 'border-gray-600 bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white capitalize font-medium">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <Switch
                        checked={value}
                        onCheckedChange={(v) => updateSettings(`sectionVisibility.${key}`, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section Configurations */}
          <Accordion type="multiple" className="space-y-4">
            {/* Features Section */}
            <AccordionItem value="features" className="bg-gray-800 border border-gray-700 rounded-lg">
              <AccordionTrigger className="px-4 text-white hover:no-underline">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Features Section
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input
                      value={settings.featuresTitle}
                      onChange={(e) => updateSettings('featuresTitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input
                      value={settings.featuresSubtitle}
                      onChange={(e) => updateSettings('featuresSubtitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Layout</Label>
                    <Select
                      value={settings.featuresLayout}
                      onValueChange={(v) => updateSettings('featuresLayout', v)}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="grid">Grid</SelectItem>
                        <SelectItem value="carousel">Carousel</SelectItem>
                        <SelectItem value="masonry">Masonry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400">Columns</Label>
                    <Select
                      value={String(settings.featuresColumns)}
                      onValueChange={(v) => updateSettings('featuresColumns', parseInt(v))}
                    >
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="2">2 Columns</SelectItem>
                        <SelectItem value="3">3 Columns</SelectItem>
                        <SelectItem value="4">4 Columns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Stats Section */}
            <AccordionItem value="stats" className="bg-gray-800 border border-gray-700 rounded-lg">
              <AccordionTrigger className="px-4 text-white hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Stats Section
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input
                      value={settings.statsTitle}
                      onChange={(e) => updateSettings('statsTitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input
                      value={settings.statsSubtitle}
                      onChange={(e) => updateSettings('statsSubtitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={settings.statsAnimated}
                    onCheckedChange={(v) => updateSettings('statsAnimated', v)}
                  />
                  <Label className="text-gray-400">Animate counters on scroll</Label>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Competitions Section */}
            <AccordionItem value="competitions" className="bg-gray-800 border border-gray-700 rounded-lg">
              <AccordionTrigger className="px-4 text-white hover:no-underline">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-orange-500" />
                  Competitions Section
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input
                      value={settings.competitionsTitle}
                      onChange={(e) => updateSettings('competitionsTitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input
                      value={settings.competitionsSubtitle}
                      onChange={(e) => updateSettings('competitionsSubtitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea
                    value={settings.competitionsDescription}
                    onChange={(e) => updateSettings('competitionsDescription', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">CTA Button Text</Label>
                    <Input
                      value={settings.competitionsCTAText}
                      onChange={(e) => updateSettings('competitionsCTAText', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">CTA Button Link</Label>
                    <Input
                      value={settings.competitionsCTALink}
                      onChange={(e) => updateSettings('competitionsCTALink', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Admin Showcase */}
            <AccordionItem value="admin" className="bg-gray-800 border border-gray-700 rounded-lg">
              <AccordionTrigger className="px-4 text-white hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-500" />
                  Admin Panel Showcase
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input
                      value={settings.adminShowcaseTitle}
                      onChange={(e) => updateSettings('adminShowcaseTitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input
                      value={settings.adminShowcaseSubtitle}
                      onChange={(e) => updateSettings('adminShowcaseSubtitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea
                    value={settings.adminShowcaseDescription}
                    onChange={(e) => updateSettings('adminShowcaseDescription', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* White Label */}
            <AccordionItem value="whitelabel" className="bg-gray-800 border border-gray-700 rounded-lg">
              <AccordionTrigger className="px-4 text-white hover:no-underline">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-cyan-500" />
                  White Label Section
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Section Title</Label>
                    <Input
                      value={settings.whiteLabelTitle}
                      onChange={(e) => updateSettings('whiteLabelTitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Section Subtitle</Label>
                    <Input
                      value={settings.whiteLabelSubtitle}
                      onChange={(e) => updateSettings('whiteLabelSubtitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400">Description</Label>
                  <Textarea
                    value={settings.whiteLabelDescription}
                    onChange={(e) => updateSettings('whiteLabelDescription', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">CTA Button Text</Label>
                    <Input
                      value={settings.whiteLabelCTAText}
                      onChange={(e) => updateSettings('whiteLabelCTAText', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">CTA Button Link</Label>
                    <Input
                      value={settings.whiteLabelCTALink}
                      onChange={(e) => updateSettings('whiteLabelCTALink', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          {/* Logo & Images Notice */}
          <Card className="bg-blue-900/20 border-blue-500/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <ImageIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-400">Logo & Images</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Your logo and images are managed in <span className="text-blue-400 font-medium">Settings → Branding</span>. 
                    The hero page automatically uses your app logo from there.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Hero Page Text</CardTitle>
              <CardDescription>
                Tagline and description for your landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-400">Tagline</Label>
                <Input
                  value={settings.tagline}
                  onChange={(e) => updateSettings('tagline', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Where Champions Trade"
                />
                <p className="text-xs text-gray-500 mt-1">Shown below the logo in the header</p>
              </div>

              <div>
                <Label className="text-gray-400">Site Description</Label>
                <Textarea
                  value={settings.description}
                  onChange={(e) => updateSettings('description', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={3}
                  placeholder="The ultimate competitive trading platform"
                />
                <p className="text-xs text-gray-500 mt-1">Used in meta tags and footer</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">SEO Settings</CardTitle>
              <CardDescription>
                Optimize your landing page for search engines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-400">Meta Title</Label>
                <Input
                  value={settings.seo.metaTitle}
                  onChange={(e) => updateSettings('seo.metaTitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Page title for search engines"
                />
              </div>
              <div>
                <Label className="text-gray-400">Meta Description</Label>
                <Textarea
                  value={settings.seo.metaDescription}
                  onChange={(e) => updateSettings('seo.metaDescription', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Description for search engines (150-160 characters)"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {settings.seo.metaDescription.length}/160 characters
                </p>
              </div>
              <div>
                <Label className="text-gray-400">Meta Keywords (comma separated)</Label>
                <Input
                  value={settings.seo.metaKeywords.join(', ')}
                  onChange={(e) => updateSettings('seo.metaKeywords', e.target.value.split(',').map(k => k.trim()))}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="trading, competitions, forex, crypto"
                />
              </div>

              <div className="pt-4 border-t border-gray-700">
                <h4 className="font-medium text-white mb-4">Open Graph (Social Sharing)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">OG Title</Label>
                    <Input
                      value={settings.seo.ogTitle}
                      onChange={(e) => updateSettings('seo.ogTitle', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">OG Description</Label>
                    <Input
                      value={settings.seo.ogDescription}
                      onChange={(e) => updateSettings('seo.ogDescription', e.target.value)}
                      className="bg-gray-900 border-gray-600 text-white mt-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Custom Code</CardTitle>
              <CardDescription>
                Add custom CSS and JavaScript
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-400">Custom CSS</Label>
                <Textarea
                  value={settings.customCSS}
                  onChange={(e) => updateSettings('customCSS', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1 font-mono"
                  rows={8}
                  placeholder="/* Your custom CSS here */"
                />
              </div>
              <div>
                <Label className="text-gray-400">Custom JavaScript</Label>
                <Textarea
                  value={settings.customJS}
                  onChange={(e) => updateSettings('customJS', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1 font-mono"
                  rows={8}
                  placeholder="// Your custom JavaScript here"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Analytics</CardTitle>
              <CardDescription>
                Connect your analytics services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-400">Google Analytics ID</Label>
                <Input
                  value={settings.googleAnalyticsId}
                  onChange={(e) => updateSettings('googleAnalyticsId', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div>
                <Label className="text-gray-400">Facebook Pixel ID</Label>
                <Input
                  value={settings.facebookPixelId}
                  onChange={(e) => updateSettings('facebookPixelId', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Your Facebook Pixel ID"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer Tab */}
        <TabsContent value="footer" className="space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Footer Settings</CardTitle>
              <CardDescription>
                Configure the footer content and legal disclaimer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-400">Copyright Text</Label>
                <Input
                  value={settings.footerCopyright}
                  onChange={(e) => updateSettings('footerCopyright', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="© 2024 YourCompany. All rights reserved."
                />
                <p className="text-xs text-gray-500 mt-1">Displayed at the bottom of the footer</p>
              </div>
              <div>
                <Label className="text-gray-400">Legal Disclaimer</Label>
                <Textarea
                  value={settings.footerDisclaimer}
                  onChange={(e) => updateSettings('footerDisclaimer', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={5}
                  placeholder="Additional legal disclaimer text (e.g., trading risks, regulatory information)..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be added after the default risk disclaimer. Use for additional legal notices specific to your jurisdiction.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Default Disclaimer</CardTitle>
              <CardDescription>
                This disclaimer is always shown on the landing page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <strong className="text-gray-300">Risk Disclaimer:</strong> Trading in financial markets involves substantial risk of loss and is not suitable for every investor. 
                  The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. 
                  Past performance is not indicative of future results. All trading strategies are used at your own risk. 
                  This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This default disclaimer cannot be removed but can be extended with your custom disclaimer above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enterprise Page Tab */}
        <TabsContent value="enterprise" className="space-y-6">
          {/* Enterprise Hero Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-400" />
                Enterprise Hero Section
              </CardTitle>
              <CardDescription>Configure the hero section of the Enterprise page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Hero Title</Label>
                  <Input
                    value={settings.enterpriseHeroTitle || ''}
                    onChange={(e) => updateSettings('enterpriseHeroTitle', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="Launch Your Own Trading Platform"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Badge Text</Label>
                  <Input
                    value={settings.enterpriseHeroBadge || ''}
                    onChange={(e) => updateSettings('enterpriseHeroBadge', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="Enterprise Solutions"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">Hero Description</Label>
                <Textarea
                  value={settings.enterpriseHeroDescription || ''}
                  onChange={(e) => updateSettings('enterpriseHeroDescription', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={3}
                  placeholder="Complete white-label solution with powerful admin panel..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Primary CTA Text</Label>
                  <Input
                    value={settings.enterpriseHeroCTAText || ''}
                    onChange={(e) => updateSettings('enterpriseHeroCTAText', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="Request Demo"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Primary CTA Link</Label>
                  <Input
                    value={settings.enterpriseHeroCTALink || ''}
                    onChange={(e) => updateSettings('enterpriseHeroCTALink', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="#contact"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Secondary CTA Text</Label>
                  <Input
                    value={settings.enterpriseHeroSecondaryCTAText || ''}
                    onChange={(e) => updateSettings('enterpriseHeroSecondaryCTAText', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="See Admin Panel"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Secondary CTA Link</Label>
                  <Input
                    value={settings.enterpriseHeroSecondaryCTALink || ''}
                    onChange={(e) => updateSettings('enterpriseHeroSecondaryCTALink', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="#admin"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* White Label Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-400" />
                White Label Section
              </CardTitle>
              <CardDescription>Configure the white label features section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input
                  value={settings.enterpriseWhiteLabelTitle || ''}
                  onChange={(e) => updateSettings('enterpriseWhiteLabelTitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="White Label Solution"
                />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Textarea
                  value={settings.enterpriseWhiteLabelSubtitle || ''}
                  onChange={(e) => updateSettings('enterpriseWhiteLabelSubtitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={2}
                  placeholder="Launch your own branded trading platform..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Admin Panel Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-yellow-400" />
                Admin Panel Showcase
              </CardTitle>
              <CardDescription>Configure the admin panel showcase section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input
                  value={settings.enterpriseAdminTitle || ''}
                  onChange={(e) => updateSettings('enterpriseAdminTitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Complete Control Center"
                />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Input
                  value={settings.enterpriseAdminSubtitle || ''}
                  onChange={(e) => updateSettings('enterpriseAdminSubtitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Powerful Admin Panel"
                />
              </div>
              <div>
                <Label className="text-gray-400">Description</Label>
                <Textarea
                  value={settings.enterpriseAdminDescription || ''}
                  onChange={(e) => updateSettings('enterpriseAdminDescription', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={2}
                  placeholder="Everything you need to manage your platform..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-400" />
                Pricing Section
              </CardTitle>
              <CardDescription>Configure the pricing section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input
                  value={settings.enterprisePricingTitle || ''}
                  onChange={(e) => updateSettings('enterprisePricingTitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Simple, Transparent Pricing"
                />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Textarea
                  value={settings.enterprisePricingSubtitle || ''}
                  onChange={(e) => updateSettings('enterprisePricingSubtitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  rows={2}
                  placeholder="Choose the plan that fits your needs..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-pink-400" />
                Contact Section
              </CardTitle>
              <CardDescription>Configure the contact section</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Section Title</Label>
                  <Input
                    value={settings.enterpriseContactTitle || ''}
                    onChange={(e) => updateSettings('enterpriseContactTitle', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="Ready to Get Started?"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">CTA Button Text</Label>
                  <Input
                    value={settings.enterpriseContactCTAText || ''}
                    onChange={(e) => updateSettings('enterpriseContactCTAText', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="Schedule Demo"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Input
                  value={settings.enterpriseContactSubtitle || ''}
                  onChange={(e) => updateSettings('enterpriseContactSubtitle', e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="Contact our sales team for a personalized demo"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">Contact Email</Label>
                  <Input
                    value={settings.enterpriseContactEmail || ''}
                    onChange={(e) => updateSettings('enterpriseContactEmail', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="enterprise@yourcompany.com"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Contact Phone</Label>
                  <Input
                    value={settings.enterpriseContactPhone || ''}
                    onChange={(e) => updateSettings('enterpriseContactPhone', e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white mt-1"
                    placeholder="+1 (234) 567-890"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Visibility */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-400" />
                Enterprise Section Visibility
              </CardTitle>
              <CardDescription>Toggle visibility of each section on the Enterprise page</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'hero', label: 'Hero' },
                  { key: 'trustBadges', label: 'Trust Badges' },
                  { key: 'whiteLabel', label: 'White Label' },
                  { key: 'adminShowcase', label: 'Admin Showcase' },
                  { key: 'pricing', label: 'Pricing' },
                  { key: 'contact', label: 'Contact' },
                  { key: 'footer', label: 'Footer' },
                ].map((section) => (
                  <div key={section.key} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <span className="text-sm text-gray-300">{section.label}</span>
                    <Switch
                      checked={settings.enterpriseSectionVisibility?.[section.key as keyof typeof settings.enterpriseSectionVisibility] ?? true}
                      onCheckedChange={(checked) => {
                        const current = settings.enterpriseSectionVisibility || {} as typeof settings.enterpriseSectionVisibility;
                        updateSettings('enterpriseSectionVisibility', { ...current, [section.key]: checked });
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview Link */}
          <Card className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-500/30">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Preview Enterprise Page</h3>
                  <p className="text-gray-400 text-sm">See how your changes look on the live page</p>
                </div>
                <a href="/enterprise" target="_blank" rel="noopener noreferrer">
                  <Button className="bg-purple-500 hover:bg-purple-400 text-white">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Enterprise Page
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

