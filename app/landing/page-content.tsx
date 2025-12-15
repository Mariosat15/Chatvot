'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  Trophy,
  Swords,
  Users,
  TrendingUp,
  DollarSign,
  Zap,
  Award,
  BarChart3,
  ShoppingBag,
  ChevronRight,
  Star,
  ArrowRight,
  Crown,
  Medal,
  Target,
  Rocket,
  Gift,
  Menu,
  X,
  Play,
  Sparkles,
  Flame,
  Shield,
  Timer,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getThemeById, LandingTheme, getActiveHolidayTheme, defaultHolidaySchedule } from '@/lib/themes/landing-themes';
import ThemedBackground from '@/components/landing/ThemedBackground';
import GlobalThemeEffects from '@/components/theme/GlobalThemeEffects';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Swords, Users, TrendingUp, DollarSign, Zap, Award,
  BarChart3, ShoppingBag, Star, Crown, Medal, Target, Rocket, Gift, Flame, Shield,
};

interface HeroSettings {
  siteName: string;
  tagline: string;
  logo?: string;
  activeTheme?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroAnimationType: string;
  heroParticlesConfig: { enabled: boolean; color: string; count: number; };
  heroCTAButtons: Array<{ id: string; text: string; href: string; style: string; icon?: string; enabled: boolean; }>;
  featuresTitle: string;
  featuresSubtitle: string;
  features: Array<{ id: string; icon: string; title: string; description: string; color: string; enabled: boolean; }>;
  stats: Array<{ id: string; label: string; value: string; suffix: string; icon: string; color: string; enabled: boolean; }>;
  statsAnimated: boolean;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: Array<{ id: string; step: number; title: string; description: string; icon: string; enabled: boolean; }>;
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
  ctaTitle: string;
  ctaSubtitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonLink: string;
  sectionVisibility: {
    hero: boolean; features: boolean; stats: boolean; howItWorks: boolean;
    competitions: boolean; challenges: boolean; cta: boolean; footer: boolean;
  };
  footerCopyright: string;
  footerDisclaimer?: string;
  footerRiskDisclaimer?: string;
  footerMenus?: {
    platform: Array<{ label: string; href: string; enabled: boolean }>;
    support: Array<{ label: string; href: string; enabled: boolean }>;
    business: Array<{ label: string; href: string; enabled: boolean }>;
  };
  // Theme & Effects
  holidayThemesEnabled?: boolean;
  holidaySchedule?: Array<{ id: string; name: string; themeId: string; startMonth: number; startDay: number; endMonth: number; endDay: number; enabled: boolean }>;
  globalThemeEffects?: {
    particlesEnabled?: boolean;
    glowEffectsEnabled?: boolean;
    animationsEnabled?: boolean;
    snowIntensity?: number;
    bloodIntensity?: number;
    confettiIntensity?: number;
  };
  customThemeEnabled?: boolean;
  customTheme?: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    headingFont?: string;
  };
}

// Animated counter
function AnimatedCounter({ value, suffix = '' }: { value: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const numericValue = parseInt(value.replace(/\D/g, '')) || 0;

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = numericValue / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
          setCount(numericValue);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, numericValue]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// Epic particle background with gaming vibe
function GamingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number; y: number; size: number; speedX: number; speedY: number; opacity: number; hue: number;
    }> = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        opacity: Math.random() * 0.5 + 0.2,
        hue: Math.random() > 0.5 ? 45 : 280, // Yellow or purple
      });
    }

    let animationId: number;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((particle, index) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particle.hue}, 80%, 60%, ${particle.opacity})`;
        ctx.fill();

        // Connection lines
        particles.slice(index + 1).forEach(other => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `hsla(${particle.hue}, 80%, 60%, ${(1 - distance / 100) * 0.1})`;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

// Floating elements animation
function FloatingElement({ children, delay = 0, duration = 4 }: { children: React.ReactNode; delay?: number; duration?: number }) {
  return (
    <motion.div
      animate={{ y: [0, -15, 0] }}
      transition={{ repeat: Infinity, duration, delay, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPageContent() {
  const [settings, setSettings] = useState<HeroSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const headerBg = useTransform(scrollYProgress, [0, 0.05], ['rgba(3, 7, 18, 0)', 'rgba(3, 7, 18, 0.95)']);
  
  // Determine active theme (with holiday override support)
  const getEffectiveThemeId = (): string => {
    if (!settings) return 'gaming-neon';
    
    // Check for holiday theme override
    if (settings.holidayThemesEnabled && settings.holidaySchedule) {
      const holidayTheme = getActiveHolidayTheme(settings.holidaySchedule);
      if (holidayTheme) return holidayTheme;
    }
    
    return settings.activeTheme || 'gaming-neon';
  };
  
  const effectiveThemeId = getEffectiveThemeId();
  const theme: LandingTheme | undefined = getThemeById(effectiveThemeId);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/hero-settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Error fetching hero settings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Zap className="h-6 w-6 text-yellow-500" />
          </motion.div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>Failed to load landing page</p>
      </div>
    );
  }

  // Generate theme-based styles with custom overrides
  const customOverrides = settings?.customThemeEnabled && settings?.customTheme;
  const themeStyles = theme ? {
    '--theme-primary': customOverrides ? settings.customTheme?.primaryColor || theme.colors.primary : theme.colors.primary,
    '--theme-secondary': customOverrides ? settings.customTheme?.secondaryColor || theme.colors.secondary : theme.colors.secondary,
    '--theme-accent': customOverrides ? settings.customTheme?.accentColor || theme.colors.accent : theme.colors.accent,
    '--theme-background': customOverrides ? settings.customTheme?.backgroundColor || theme.colors.background : theme.colors.background,
    '--theme-text': customOverrides ? settings.customTheme?.textColor || theme.colors.text : theme.colors.text,
    '--theme-text-muted': theme.colors.textMuted,
    '--theme-border': customOverrides ? settings.customTheme?.borderColor || theme.colors.border : theme.colors.border,
    '--theme-glow': theme.effects.glowColor,
  } as React.CSSProperties : {};
  
  // Get effective colors (with custom overrides)
  const effectiveColors = {
    primary: customOverrides ? settings.customTheme?.primaryColor || theme?.colors.primary : theme?.colors.primary,
    secondary: customOverrides ? settings.customTheme?.secondaryColor || theme?.colors.secondary : theme?.colors.secondary,
    accent: customOverrides ? settings.customTheme?.accentColor || theme?.colors.accent : theme?.colors.accent,
    background: customOverrides ? settings.customTheme?.backgroundColor || theme?.colors.background : theme?.colors.background,
    text: customOverrides ? settings.customTheme?.textColor || theme?.colors.text : theme?.colors.text,
    border: customOverrides ? settings.customTheme?.borderColor || theme?.colors.border : theme?.colors.border,
  };
  const effectiveHeadingFont = customOverrides ? settings.customTheme?.headingFont || theme?.fonts.heading : theme?.fonts.heading;

  return (
    <div 
      className={`min-h-screen overflow-x-hidden ${theme?.customClasses.heroBackground || 'bg-gray-950'}`}
      style={{ 
        ...themeStyles, 
        backgroundColor: effectiveColors.background || '#030712',
        color: effectiveColors.text || '#f3f4f6',
        fontFamily: theme?.fonts.body || 'inherit',
        backgroundImage: theme?.effects.backgroundPattern || undefined,
      }}
    >
      {/* Theme-based custom styles */}
      {theme && (
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Press+Start+2P&family=VT323&family=Exo+2:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&family=Cinzel:wght@400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;700&family=Righteous&family=Monoton&family=Nunito:wght@300;400;500;600;700;800&family=Mountains+of+Christmas:wght@400;700&family=Great+Vibes&family=Pacifico&family=Quicksand:wght@300;400;500;600;700&family=Dancing+Script:wght@400;500;600;700&family=Bebas+Neue&family=Creepster&family=Nosifer&family=Inter:wght@300;400;500;600;700;800;900&family=Lato:wght@300;400;700;900&family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');
          
          .theme-heading { font-family: ${theme.fonts.heading}; }
          .theme-body { font-family: ${theme.fonts.body}; }
          .theme-accent-font { font-family: ${theme.fonts.accent}; }
          .theme-text-gradient { ${theme.customClasses.textGradient.includes('bg-gradient') ? '' : `color: ${theme.colors.primary};`} }
          .theme-glow { ${theme.customClasses.glowEffect} }
          .theme-button-primary { ${theme.customClasses.buttonPrimary} }
          .theme-card { ${theme.customClasses.cardBackground} }
          
          @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .animate-gradient { animation: gradient 3s ease infinite; }
        `}</style>
      )}
      
      {/* Global Theme Effects - automatically applied based on theme */}
      <GlobalThemeEffects 
        themeId={effectiveThemeId} 
        effects={settings?.globalThemeEffects || {
          particlesEnabled: true,
          glowEffectsEnabled: true,
          animationsEnabled: true,
          snowIntensity: 30,
          bloodIntensity: 20,
          confettiIntensity: 30,
        }} 
      />
      
      {/* Sticky Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
        style={{ 
          backgroundColor: headerBg,
          borderColor: theme?.colors.border || 'rgba(31, 41, 55, 0.5)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              {settings.logo ? (
                <Image src={settings.logo} alt={settings.siteName} width={140} height={32} className="h-8 w-auto" />
              ) : (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 bg-yellow-500 blur-lg opacity-50" />
                    <div className="relative w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <Zap className="h-6 w-6 text-gray-900" />
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white hidden sm:block">{settings.siteName}</span>
                </>
              )}
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm font-medium">Features</a>
              <a href="#competitions" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm font-medium">Competitions</a>
              <a href="#challenges" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm font-medium">Challenges</a>
              <Link href="/enterprise" className="text-gray-400 hover:text-yellow-500 transition-colors text-sm font-medium">Enterprise</Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/sign-in">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-gray-800 hidden sm:flex">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-gray-900 font-bold shadow-lg shadow-yellow-500/25">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Started
                </Button>
              </Link>
              
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-400">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl"
          >
            <nav className="px-4 py-4 space-y-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg">Features</a>
              <a href="#competitions" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg">Competitions</a>
              <a href="#challenges" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg">Challenges</a>
              <Link href="/enterprise" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg">Enterprise</Link>
              <Link href="/sign-in" className="block py-3 px-4 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg">Sign In</Link>
            </nav>
          </motion.div>
        )}
      </motion.header>

      {/* EPIC Hero Section */}
      {settings.sectionVisibility.hero && (
        <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
          {/* Theme-specific animated background */}
          <ThemedBackground theme={theme} />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              {/* Animated Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-bold mb-8"
              >
                <motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}>
                  <Sparkles className="h-4 w-4" />
                </motion.div>
                {settings.heroSubtitle}
                <Flame className="h-4 w-4 text-orange-500" />
              </motion.div>

              {/* EPIC Title with Glow */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tight"
                style={{ fontFamily: theme?.fonts.heading }}
              >
                <span className="relative">
                  <span 
                    className="absolute inset-0 bg-clip-text text-transparent blur-2xl opacity-50"
                    style={{ backgroundImage: theme?.effects.gradientStyle || 'linear-gradient(to right, #fbbf24, #f97316, #fbbf24)' }}
                  >
                    {settings.heroTitle}
                  </span>
                  <span 
                    className={`relative bg-clip-text text-transparent bg-[length:200%_auto] ${theme?.effects.animationStyle === 'dynamic' || theme?.effects.animationStyle === 'intense' ? 'animate-gradient' : ''}`}
                    style={{ backgroundImage: theme?.effects.gradientStyle || 'linear-gradient(to right, #fbbf24, #ffffff, #fbbf24)' }}
                  >
                    {settings.heroTitle}
                  </span>
                </span>
              </motion.h1>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed"
              >
                {settings.heroDescription}
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                {settings.heroCTAButtons.map((btn) => {
                  const IconComponent = btn.icon ? iconMap[btn.icon] : null;
                  const isPrimary = btn.style === 'primary';
                  return (
                    <Link key={btn.id} href={btn.href}>
                      <Button
                        size="lg"
                        className={`text-lg px-8 py-7 font-bold transition-all duration-300 hover:scale-105 ${
                          isPrimary 
                            ? 'shadow-2xl hover:shadow-xl'
                            : 'border-2'
                        }`}
                        style={isPrimary ? { 
                          background: theme?.effects.gradientStyle || 'linear-gradient(to right, #eab308, #f97316, #eab308)',
                          color: theme?.colors.background || '#030712',
                          boxShadow: `0 25px 50px -12px ${theme?.colors.accentGlow || 'rgba(234, 179, 8, 0.3)'}`,
                        } : {
                          backgroundColor: theme?.colors.backgroundCard || 'rgba(31, 41, 55, 0.8)',
                          borderColor: theme?.colors.primary || '#eab308',
                          color: theme?.colors.primary || '#eab308',
                        }}
                      >
                        {IconComponent && <IconComponent className="h-5 w-5 mr-2" />}
                        {btn.text}
                        {!isPrimary && <ArrowRight className="h-5 w-5 ml-2" />}
                      </Button>
                    </Link>
                  );
                })}
              </motion.div>

              {/* Quick Stats Preview - Uses first 3 enabled stats */}
              {settings.stats && settings.stats.filter(s => s.enabled).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-16 grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto"
                >
                  {settings.stats.filter(s => s.enabled).slice(0, 3).map((stat, i) => (
                    <motion.div
                      key={stat.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + i * 0.1 }}
                      className="text-center"
                    >
                      <div 
                        className="text-2xl md:text-4xl font-black mb-1"
                        style={{ color: theme?.colors.primary || '#eab308' }}
                      >
                        {settings.statsAnimated ? (
                          <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                        ) : (
                          `${stat.value}${stat.suffix}`
                        )}
                      </div>
                      <div style={{ color: theme?.colors.textMuted || '#6b7280' }} className="text-xs md:text-sm">{stat.label}</div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2"
            >
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-xs text-gray-500 uppercase tracking-widest">Scroll</span>
                <div className="w-6 h-10 rounded-full border-2 border-yellow-500/30 flex items-start justify-center pt-2">
                  <motion.div
                    animate={{ y: [0, 12, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-1.5 h-3 rounded-full bg-yellow-500"
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      {settings.sectionVisibility.stats && settings.stats.length > 0 && (
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-orange-500/5" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {settings.stats.filter(s => s.enabled).map((stat, index) => (
                <motion.div
                  key={stat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center group"
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-2"
                  >
                    {settings.statsAnimated ? (
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    ) : (
                      `${stat.value}${stat.suffix}`
                    )}
                  </motion.div>
                  <p className="text-gray-400 text-sm font-medium group-hover:text-yellow-500 transition-colors">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {settings.sectionVisibility.features && settings.features.length > 0 && (
        <section id="features" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-6xl font-black mb-4">
                <span className="bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent">
                  {settings.featuresTitle}
                </span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">{settings.featuresSubtitle}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {settings.features.filter(f => f.enabled).map((feature, index) => {
                const IconComponent = iconMap[feature.icon];
                return (
                  <motion.div
                    key={feature.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="group relative p-8 rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 hover:border-yellow-500/50 transition-all duration-300 overflow-hidden"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-orange-500/0 group-hover:from-yellow-500/5 group-hover:to-orange-500/5 transition-all duration-500" />
                    
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                        {IconComponent && <IconComponent className="h-8 w-8 text-yellow-500" />}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-yellow-400 transition-colors">{feature.title}</h3>
                      <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      {settings.sectionVisibility.howItWorks && settings.howItWorksSteps.length > 0 && (
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-6xl font-black mb-4 text-white">{settings.howItWorksTitle}</h2>
              <p className="text-gray-400 text-lg">{settings.howItWorksSubtitle}</p>
            </motion.div>

            <div className="relative">
              {/* Connection line */}
              <div className="absolute top-16 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent hidden lg:block" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {settings.howItWorksSteps.filter(s => s.enabled).sort((a, b) => a.step - b.step).map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.15 }}
                    viewport={{ once: true }}
                    className="relative text-center"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-28 h-28 rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl font-black bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/30"
                    >
                      {step.step}
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-400">{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Competitions Section */}
      {settings.sectionVisibility.competitions && (
        <section id="competitions" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm font-bold mb-6">
                  <Trophy className="h-4 w-4" />
                  {settings.competitionsSubtitle}
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white mb-6">{settings.competitionsTitle}</h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">{settings.competitionsDescription}</p>
                <Link href={settings.competitionsCTALink}>
                  <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-gray-900 font-bold shadow-lg shadow-yellow-500/25 hover:scale-105 transition-all">
                    {settings.competitionsCTAText}
                    <ChevronRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-4">
                {[
                  { name: 'Grand Championship', prize: '$50,000', status: 'LIVE', participants: 2847 },
                  { name: 'Weekly Showdown', prize: '$10,000', status: 'STARTING', participants: 1256 },
                  { name: 'Beginner League', prize: '$5,000', status: 'OPEN', participants: 892 },
                ].map((comp, i) => (
                  <motion.div
                    key={comp.name}
                    whileHover={{ scale: 1.02, x: 10 }}
                    className="p-6 rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 hover:border-yellow-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                          <Trophy className="h-7 w-7 text-yellow-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-lg">{comp.name}</h4>
                          <p className="text-sm text-gray-400">Prize: {comp.prize} • {comp.participants} traders</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        comp.status === 'LIVE' ? 'bg-green-500/20 text-green-400' :
                        comp.status === 'STARTING' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {comp.status}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Challenges Section */}
      {settings.sectionVisibility.challenges && (
        <section id="challenges" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-bold mb-6">
                  <Swords className="h-4 w-4" />
                  {settings.challengesSubtitle}
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white mb-6">{settings.challengesTitle}</h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">{settings.challengesDescription}</p>
                <Link href={settings.challengesCTALink}>
                  <Button size="lg" variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 font-bold hover:scale-105 transition-all">
                    {settings.challengesCTAText}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:order-1">
                <div className="relative p-8 rounded-3xl bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 overflow-hidden">
                  {/* Decorative elements */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
                  
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="text-center flex-1">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-24 h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-yellow-400/30 to-orange-500/30 flex items-center justify-center text-4xl border-2 border-yellow-500/30"
                      >
                        👑
                      </motion.div>
                      <p className="font-bold text-white text-lg">You</p>
                      <p className="text-sm text-gray-400">Score: 0</p>
                    </div>
                    
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent"
                    >
                      VS
                    </motion.div>
                    
                    <div className="text-center flex-1">
                      <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-4xl border-2 border-purple-500/30">
                        🎯
                      </div>
                      <p className="font-bold text-white text-lg">Opponent</p>
                      <p className="text-sm text-gray-400">Score: 0</p>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-center gap-4">
                    <div className="px-4 py-2 rounded-xl bg-gray-800/50 text-sm text-gray-300">
                      <Timer className="h-4 w-4 inline mr-2 text-yellow-500" />
                      Duration: 24h
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-gray-800/50 text-sm text-gray-300">
                      <Coins className="h-4 w-4 inline mr-2 text-yellow-500" />
                      Stake: 100 Credits
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      {settings.sectionVisibility.cta && (
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-purple-500/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <motion.h2
                initial={{ scale: 0.9 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-black mb-6"
              >
                <span className="bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent">
                  {settings.ctaTitle}
                </span>
              </motion.h2>
              <p className="text-xl text-gray-300 mb-4">{settings.ctaSubtitle}</p>
              <p className="text-gray-400 mb-12 max-w-2xl mx-auto">{settings.ctaDescription}</p>
              <Link href={settings.ctaButtonLink}>
                <Button
                  size="lg"
                  className="text-xl px-14 py-8 font-black bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 hover:from-yellow-400 hover:via-orange-400 hover:to-yellow-400 text-gray-900 shadow-2xl shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-110 transition-all duration-300"
                >
                  {settings.ctaButtonText}
                  <Rocket className="h-7 w-7 ml-3" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900/50 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer */}
          <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center gap-3 mb-4">
                {settings.logo ? (
                  <Image src={settings.logo} alt={settings.siteName} width={120} height={28} className="h-7 w-auto" />
                ) : (
                  <>
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <Zap className="h-5 w-5 text-gray-900" />
                    </div>
                    <span className="text-lg font-bold text-white">{settings.siteName}</span>
                  </>
                )}
              </Link>
              <p className="text-gray-400 text-sm">{settings.tagline}</p>
            </div>

            {/* Platform Menu */}
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2">
                {(settings.footerMenus?.platform || [
                  { label: 'Competitions', href: '/competitions', enabled: true },
                  { label: 'Challenges', href: '/challenges', enabled: true },
                  { label: 'Leaderboard', href: '/leaderboard', enabled: true },
                  { label: 'Marketplace', href: '/marketplace', enabled: true },
                ]).filter(item => item.enabled).map((item, i) => (
                  <li key={i}>
                    <Link href={item.href} className="text-gray-400 hover:text-yellow-500 text-sm transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Menu */}
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                {(settings.footerMenus?.support || [
                  { label: 'Help Center', href: '/help', enabled: true },
                  { label: 'Contact Us', href: 'mailto:support@chartvolt.com', enabled: true },
                  { label: 'Terms of Service', href: '/terms', enabled: true },
                  { label: 'Privacy Policy', href: '/privacy', enabled: true },
                ]).filter(item => item.enabled).map((item, i) => (
                  <li key={i}>
                    {item.href.startsWith('mailto:') ? (
                      <a href={item.href} className="text-gray-400 hover:text-yellow-500 text-sm transition-colors">
                        {item.label}
                      </a>
                    ) : (
                      <Link href={item.href} className="text-gray-400 hover:text-yellow-500 text-sm transition-colors">
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Business Menu */}
            <div>
              <h4 className="text-white font-semibold mb-4">Business</h4>
              <ul className="space-y-2">
                {(settings.footerMenus?.business || [
                  { label: 'Enterprise Solutions', href: '/enterprise', enabled: true },
                  { label: 'Pricing', href: '/enterprise#pricing', enabled: true },
                  { label: 'Contact Sales', href: '/enterprise#contact', enabled: true },
                ]).filter(item => item.enabled).map((item, i) => (
                  <li key={i}>
                    <Link href={item.href} className="text-gray-400 hover:text-yellow-500 text-sm transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risk Disclaimer */}
          <div className="py-6 border-t border-gray-800/50">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Risk Disclaimer:</strong>{' '}
              {settings.footerRiskDisclaimer || 'Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.'}
              {settings.footerDisclaimer && ` ${settings.footerDisclaimer}`}
            </p>
          </div>

          {/* Copyright */}
          <div className="py-6 border-t border-gray-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">{settings.footerCopyright}</p>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 text-xs">Powered by</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded flex items-center justify-center">
                  <Zap className="h-3 w-3 text-gray-900" />
                </div>
                <span className="text-gray-400 text-sm font-medium">ChartVolt</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

