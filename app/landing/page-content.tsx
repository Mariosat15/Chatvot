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
      
      {/* Sticky Header - Theme Aware */}
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
                    <div className="absolute inset-0 blur-lg opacity-50" style={{ backgroundColor: effectiveColors.primary }} />
                    <div 
                      className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: theme?.effects.gradientStyle || `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})` }}
                    >
                      <span className="text-xl">{theme?.themeIcons?.special || '⚡'}</span>
                    </div>
                  </div>
                  <span className="text-xl font-bold hidden sm:block" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>{settings.siteName}</span>
                </>
              )}
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="transition-colors text-sm font-medium" style={{ color: theme?.colors.textMuted }} onMouseOver={(e) => e.currentTarget.style.color = effectiveColors.primary || ''} onMouseOut={(e) => e.currentTarget.style.color = theme?.colors.textMuted || ''}>Features</a>
              <a href="#competitions" className="transition-colors text-sm font-medium" style={{ color: theme?.colors.textMuted }} onMouseOver={(e) => e.currentTarget.style.color = effectiveColors.primary || ''} onMouseOut={(e) => e.currentTarget.style.color = theme?.colors.textMuted || ''}>Competitions</a>
              <a href="#challenges" className="transition-colors text-sm font-medium" style={{ color: theme?.colors.textMuted }} onMouseOver={(e) => e.currentTarget.style.color = effectiveColors.primary || ''} onMouseOut={(e) => e.currentTarget.style.color = theme?.colors.textMuted || ''}>Challenges</a>
              <Link href="/enterprise" className="transition-colors text-sm font-medium" style={{ color: theme?.colors.textMuted }}>Enterprise</Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/sign-in">
                <Button variant="ghost" className="hidden sm:flex" style={{ color: theme?.colors.textMuted }}>
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button 
                  className="font-bold"
                  style={{ 
                    background: theme?.effects.gradientStyle || `linear-gradient(135deg, ${effectiveColors.primary}, ${effectiveColors.secondary})`,
                    color: theme?.colors.background || '#030712',
                    boxShadow: `0 10px 30px ${theme?.colors.accentGlow || 'rgba(234, 179, 8, 0.3)'}`,
                  }}
                >
                  <span className="mr-2">{theme?.themeIcons?.power || '⚡'}</span>
                  Get Started
                </Button>
              </Link>
              
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2" style={{ color: theme?.colors.textMuted }}>
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t backdrop-blur-xl"
            style={{ backgroundColor: theme?.colors.backgroundOverlay, borderColor: theme?.colors.border }}
          >
            <nav className="px-4 py-4 space-y-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 rounded-lg" style={{ color: theme?.colors.textMuted }}>Features</a>
              <a href="#competitions" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 rounded-lg" style={{ color: theme?.colors.textMuted }}>Competitions</a>
              <a href="#challenges" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 rounded-lg" style={{ color: theme?.colors.textMuted }}>Challenges</a>
              <Link href="/enterprise" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 rounded-lg" style={{ color: theme?.colors.textMuted }}>Enterprise</Link>
              <Link href="/sign-in" className="block py-3 px-4 rounded-lg" style={{ color: theme?.colors.textMuted }}>Sign In</Link>
            </nav>
          </motion.div>
        )}
      </motion.header>

      {/* EPIC Hero Section - Fully Theme Aware */}
      {settings.sectionVisibility.hero && (
        <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
          {/* Theme-specific animated background */}
          <ThemedBackground theme={theme} />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              {/* Theme-specific badge with icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full text-sm font-bold mb-8"
                style={{ 
                  background: `linear-gradient(135deg, ${effectiveColors.primary}15, ${effectiveColors.secondary}15)`,
                  border: `1px solid ${effectiveColors.primary}40`,
                  color: effectiveColors.primary,
                  fontFamily: theme?.fonts.accent,
                }}
              >
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  {theme?.heroTextStyle?.titlePrefix || theme?.themeIcons?.trophy || '🏆'}
                </motion.span>
                <span className={theme?.heroTextStyle?.subtitleStyle}>{settings.heroSubtitle}</span>
                <span>{theme?.themeIcons?.power || '⚡'}</span>
              </motion.div>

              {/* EPIC Title with Theme Glow */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tight"
                style={{ fontFamily: effectiveHeadingFont }}
              >
                <span className="relative">
                  {/* Glow layer */}
                  <span 
                    className="absolute inset-0 bg-clip-text text-transparent blur-2xl opacity-60"
                    style={{ backgroundImage: theme?.effects.gradientStyle }}
                  >
                    {theme?.heroTextStyle?.titlePrefix} {settings.heroTitle}
                  </span>
                  {/* Main text */}
                  <span 
                    className={`relative bg-clip-text text-transparent bg-[length:200%_auto] ${theme?.effects.animationStyle === 'dynamic' || theme?.effects.animationStyle === 'intense' ? 'animate-gradient' : ''}`}
                    style={{ backgroundImage: theme?.effects.gradientStyle }}
                  >
                    {settings.heroTitle}
                  </span>
                </span>
              </motion.h1>

              {/* Description with theme muted color */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed"
                style={{ color: theme?.colors.textMuted }}
              >
                {settings.heroDescription}
              </motion.p>

              {/* CTA Buttons with theme styling */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                {settings.heroCTAButtons.filter(btn => btn.enabled).map((btn) => {
                  const isPrimary = btn.style === 'primary';
                  return (
                    <Link key={btn.id} href={btn.href}>
                      <Button
                        size="lg"
                        className={`text-lg px-8 py-7 font-bold transition-all duration-300 hover:scale-105 ${isPrimary ? '' : 'border-2'}`}
                        style={isPrimary ? { 
                          background: theme?.effects.gradientStyle,
                          color: theme?.colors.background,
                          boxShadow: `0 25px 50px -12px ${theme?.colors.accentGlow}`,
                          fontFamily: effectiveHeadingFont,
                        } : {
                          backgroundColor: theme?.colors.backgroundCard,
                          borderColor: effectiveColors.primary,
                          color: effectiveColors.primary,
                        }}
                      >
                        <span className="mr-2">{isPrimary ? (theme?.heroTextStyle?.ctaIcon || theme?.themeIcons?.power || '🚀') : ''}</span>
                        {btn.text}
                        {!isPrimary && <ArrowRight className="h-5 w-5 ml-2" />}
                      </Button>
                    </Link>
                  );
                })}
              </motion.div>

              {/* Quick Stats with theme icons */}
              {settings.stats && settings.stats.filter(s => s.enabled).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-16 grid grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto"
                >
                  {settings.stats.filter(s => s.enabled).slice(0, 3).map((stat, i) => {
                    const statIcons = [theme?.themeIcons?.users, theme?.themeIcons?.currency, theme?.themeIcons?.stats];
                    return (
                      <motion.div
                        key={stat.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + i * 0.1 }}
                        className="text-center p-4 rounded-xl"
                        style={{ 
                          backgroundColor: `${effectiveColors.primary}08`,
                          border: `1px solid ${effectiveColors.primary}20`,
                        }}
                      >
                        <div className="text-2xl mb-2">{statIcons[i] || ['👥', '💰', '📈'][i]}</div>
                        <div 
                          className="text-2xl md:text-4xl font-black mb-1"
                          style={{ color: effectiveColors.primary, fontFamily: effectiveHeadingFont }}
                        >
                          {settings.statsAnimated ? (
                            <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                          ) : (
                            `${stat.value}${stat.suffix}`
                          )}
                        </div>
                        <div style={{ color: theme?.colors.textMuted }} className="text-xs md:text-sm">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>

            {/* Scroll Indicator with theme color */}
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
                <span className="text-xs uppercase tracking-widest" style={{ color: theme?.colors.textMuted }}>Scroll</span>
                <div className="w-6 h-10 rounded-full border-2 flex items-start justify-center pt-2" style={{ borderColor: `${effectiveColors.primary}40` }}>
                  <motion.div
                    animate={{ y: [0, 12, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-1.5 h-3 rounded-full"
                    style={{ backgroundColor: effectiveColors.primary }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Stats Section - Theme Aware */}
      {settings.sectionVisibility.stats && settings.stats.length > 0 && (
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${effectiveColors.primary}08, transparent, ${effectiveColors.secondary}08)` }} />
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
                    className="text-5xl md:text-6xl font-black bg-clip-text text-transparent mb-2"
                    style={{ backgroundImage: theme?.effects.gradientStyle, fontFamily: effectiveHeadingFont }}
                  >
                    {settings.statsAnimated ? (
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    ) : (
                      `${stat.value}${stat.suffix}`
                    )}
                  </motion.div>
                  <p className="text-sm font-medium transition-colors" style={{ color: theme?.colors.textMuted }}>{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section - Theme Aware */}
      {settings.sectionVisibility.features && settings.features.length > 0 && (
        <section id="features" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-6xl font-black mb-4" style={{ fontFamily: effectiveHeadingFont }}>
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${effectiveColors.text}, ${effectiveColors.primary}, ${effectiveColors.text})` }}>
                  {settings.featuresTitle}
                </span>
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: theme?.colors.textMuted }}>{settings.featuresSubtitle}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {settings.features.filter(f => f.enabled).map((feature, index) => {
                const IconComponent = iconMap[feature.icon];
                const featureIcons = [theme?.themeIcons?.trophy, theme?.themeIcons?.battle, theme?.themeIcons?.users, theme?.themeIcons?.currency, theme?.themeIcons?.power, theme?.themeIcons?.achievement];
                return (
                  <motion.div
                    key={feature.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="group relative p-8 rounded-2xl transition-all duration-300 overflow-hidden"
                    style={{ 
                      backgroundColor: theme?.colors.backgroundCard,
                      border: `1px solid ${theme?.colors.border}`,
                    }}
                  >
                    {/* Glow effect on hover */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500" 
                      style={{ background: `linear-gradient(135deg, ${effectiveColors.primary}08, ${effectiveColors.secondary}08)` }}
                    />
                    
                    <div className="relative z-10">
                      <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300"
                        style={{ background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.secondary}30)` }}
                      >
                        {featureIcons[index % 6] ? (
                          <span className="text-3xl">{featureIcons[index % 6]}</span>
                        ) : IconComponent ? (
                          <span style={{ color: effectiveColors.primary }}><IconComponent className="h-8 w-8" /></span>
                        ) : (
                          <span className="text-3xl">{theme?.themeIcons?.special || '⭐'}</span>
                        )}
                      </div>
                      <h3 
                        className="text-xl font-bold mb-3 transition-colors" 
                        style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}
                      >
                        {feature.title}
                      </h3>
                      <p className="leading-relaxed" style={{ color: theme?.colors.textMuted }}>{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* How It Works - Theme Aware */}
      {settings.sectionVisibility.howItWorks && settings.howItWorksSteps.length > 0 && (
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent, ${effectiveColors.secondary}08, transparent)` }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-6xl font-black mb-4" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>{settings.howItWorksTitle}</h2>
              <p className="text-lg" style={{ color: theme?.colors.textMuted }}>{settings.howItWorksSubtitle}</p>
            </motion.div>

            <div className="relative">
              {/* Connection line with theme color */}
              <div className="absolute top-16 left-0 right-0 h-1 hidden lg:block" style={{ background: `linear-gradient(90deg, transparent, ${effectiveColors.primary}40, transparent)` }} />
              
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
                      className="w-28 h-28 rounded-3xl mx-auto mb-6 flex items-center justify-center text-4xl font-black"
                      style={{ 
                        background: theme?.effects.gradientStyle,
                        color: theme?.colors.background,
                        boxShadow: `0 25px 50px -12px ${theme?.colors.accentGlow}`,
                        fontFamily: effectiveHeadingFont,
                      }}
                    >
                      {step.step}
                    </motion.div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>{step.title}</h3>
                    <p style={{ color: theme?.colors.textMuted }}>{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Competitions Section - Theme Aware */}
      {settings.sectionVisibility.competitions && (
        <section id="competitions" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at left, ${effectiveColors.primary}15, transparent)` }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
                  style={{ 
                    backgroundColor: `${effectiveColors.primary}15`,
                    border: `1px solid ${effectiveColors.primary}30`,
                    color: effectiveColors.primary,
                  }}
                >
                  <span>{theme?.themeIcons?.trophy || '🏆'}</span>
                  {settings.competitionsSubtitle}
                </div>
                <h2 className="text-4xl md:text-5xl font-black mb-6" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>{settings.competitionsTitle}</h2>
                <p className="text-lg mb-8 leading-relaxed" style={{ color: theme?.colors.textMuted }}>{settings.competitionsDescription}</p>
                <Link href={settings.competitionsCTALink}>
                  <Button 
                    size="lg" 
                    className="font-bold hover:scale-105 transition-all"
                    style={{ 
                      background: theme?.effects.gradientStyle,
                      color: theme?.colors.background,
                      boxShadow: `0 10px 30px ${theme?.colors.accentGlow}`,
                    }}
                  >
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
                ].map((comp) => (
                  <motion.div
                    key={comp.name}
                    whileHover={{ scale: 1.02, x: 10 }}
                    className="p-6 rounded-2xl transition-all"
                    style={{ 
                      backgroundColor: theme?.colors.backgroundCard,
                      border: `1px solid ${theme?.colors.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                          style={{ background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.secondary}30)` }}
                        >
                          {theme?.themeIcons?.trophy || '🏆'}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg" style={{ color: effectiveColors.text }}>{comp.name}</h4>
                          <p className="text-sm" style={{ color: theme?.colors.textMuted }}>Prize: {comp.prize} • {comp.participants} traders</p>
                        </div>
                      </div>
                      <div 
                        className="px-3 py-1.5 rounded-full text-xs font-bold"
                        style={{ 
                          backgroundColor: comp.status === 'LIVE' ? `${theme?.colors.success}20` : comp.status === 'STARTING' ? `${effectiveColors.accent}20` : `${effectiveColors.secondary}20`,
                          color: comp.status === 'LIVE' ? theme?.colors.success : comp.status === 'STARTING' ? effectiveColors.accent : effectiveColors.secondary,
                        }}
                      >
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

      {/* Challenges Section - Theme Aware */}
      {settings.sectionVisibility.challenges && (
        <section id="challenges" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at right, ${effectiveColors.secondary}15, transparent)` }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:order-2">
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
                  style={{ 
                    backgroundColor: `${effectiveColors.secondary}15`,
                    border: `1px solid ${effectiveColors.secondary}30`,
                    color: effectiveColors.secondary,
                  }}
                >
                  <span>{theme?.themeIcons?.battle || '⚔️'}</span>
                  {settings.challengesSubtitle}
                </div>
                <h2 className="text-4xl md:text-5xl font-black mb-6" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>{settings.challengesTitle}</h2>
                <p className="text-lg mb-8 leading-relaxed" style={{ color: theme?.colors.textMuted }}>{settings.challengesDescription}</p>
                <Link href={settings.challengesCTALink}>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="font-bold hover:scale-105 transition-all border-2"
                    style={{ 
                      borderColor: `${effectiveColors.secondary}80`,
                      color: effectiveColors.secondary,
                    }}
                  >
                    {settings.challengesCTAText}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:order-1">
                <div 
                  className="relative p-8 rounded-3xl overflow-hidden"
                  style={{ 
                    backgroundColor: theme?.colors.backgroundCard,
                    border: `1px solid ${theme?.colors.border}`,
                  }}
                >
                  {/* Decorative glow */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: `${effectiveColors.secondary}30` }} />
                  
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="text-center flex-1">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl border-2"
                        style={{ 
                          background: `linear-gradient(135deg, ${effectiveColors.primary}30, ${effectiveColors.accent}30)`,
                          borderColor: `${effectiveColors.primary}40`,
                        }}
                      >
                        {theme?.themeIcons?.special || '👑'}
                      </motion.div>
                      <p className="font-bold text-lg" style={{ color: effectiveColors.text }}>You</p>
                      <p className="text-sm" style={{ color: theme?.colors.textMuted }}>Score: 0</p>
                    </div>
                    
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-5xl font-black bg-clip-text text-transparent"
                      style={{ backgroundImage: theme?.effects.gradientStyle, fontFamily: effectiveHeadingFont }}
                    >
                      VS
                    </motion.div>
                    
                    <div className="text-center flex-1">
                      <div 
                        className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl border-2"
                        style={{ 
                          background: `linear-gradient(135deg, ${effectiveColors.secondary}30, ${effectiveColors.accent}30)`,
                          borderColor: `${effectiveColors.secondary}40`,
                        }}
                      >
                        {theme?.themeIcons?.battle || '🎯'}
                      </div>
                      <p className="font-bold text-lg" style={{ color: effectiveColors.text }}>Opponent</p>
                      <p className="text-sm" style={{ color: theme?.colors.textMuted }}>Score: 0</p>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-center gap-4">
                    <div className="px-4 py-2 rounded-xl text-sm" style={{ backgroundColor: `${theme?.colors.backgroundSecondary}`, color: theme?.colors.textMuted }}>
                      <span style={{ color: effectiveColors.primary }}>⏱️</span> Duration: 24h
                    </div>
                    <div className="px-4 py-2 rounded-xl text-sm" style={{ backgroundColor: `${theme?.colors.backgroundSecondary}`, color: theme?.colors.textMuted }}>
                      <span style={{ color: effectiveColors.primary }}>{theme?.themeIcons?.currency || '💰'}</span> Stake: 100 Credits
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA - Theme Aware */}
      {settings.sectionVisibility.cta && (
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${effectiveColors.primary}15, ${effectiveColors.accent}08, ${effectiveColors.secondary}15)` }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${effectiveColors.primary}15, transparent)` }} />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <motion.h2
                initial={{ scale: 0.9 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-black mb-6"
                style={{ fontFamily: effectiveHeadingFont }}
              >
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: theme?.effects.gradientStyle }}>
                  {settings.ctaTitle}
                </span>
              </motion.h2>
              <p className="text-xl mb-4" style={{ color: effectiveColors.text }}>{settings.ctaSubtitle}</p>
              <p className="mb-12 max-w-2xl mx-auto" style={{ color: theme?.colors.textMuted }}>{settings.ctaDescription}</p>
              <Link href={settings.ctaButtonLink}>
                <Button
                  size="lg"
                  className="text-xl px-14 py-8 font-black hover:scale-110 transition-all duration-300"
                  style={{ 
                    background: theme?.effects.gradientStyle,
                    color: theme?.colors.background,
                    boxShadow: `0 25px 50px -12px ${theme?.colors.accentGlow}`,
                    fontFamily: effectiveHeadingFont,
                  }}
                >
                  {settings.ctaButtonText}
                  <span className="ml-3 text-2xl">{theme?.heroTextStyle?.ctaIcon || '🚀'}</span>
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      )}

      {/* Footer - Theme Aware */}
      <footer style={{ backgroundColor: theme?.colors.backgroundSecondary, borderTop: `1px solid ${theme?.colors.border}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer */}
          <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center gap-3 mb-4">
                {settings.logo ? (
                  <Image src={settings.logo} alt={settings.siteName} width={120} height={28} className="h-7 w-auto" />
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: theme?.effects.gradientStyle }}>
                      <span>{theme?.themeIcons?.special || '⚡'}</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: effectiveColors.text, fontFamily: effectiveHeadingFont }}>{settings.siteName}</span>
                  </>
                )}
              </Link>
              <p className="text-sm" style={{ color: theme?.colors.textMuted }}>{settings.tagline}</p>
            </div>

            {/* Platform Menu */}
            <div>
              <h4 className="font-semibold mb-4" style={{ color: effectiveColors.text }}>Platform</h4>
              <ul className="space-y-2">
                {(settings.footerMenus?.platform || [
                  { label: 'Competitions', href: '/competitions', enabled: true },
                  { label: 'Challenges', href: '/challenges', enabled: true },
                  { label: 'Leaderboard', href: '/leaderboard', enabled: true },
                  { label: 'Marketplace', href: '/marketplace', enabled: true },
                ]).filter(item => item.enabled).map((item, i) => (
                  <li key={i}>
                    <Link href={item.href} className="text-sm transition-colors hover:opacity-80" style={{ color: theme?.colors.textMuted }}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Menu */}
            <div>
              <h4 className="font-semibold mb-4" style={{ color: effectiveColors.text }}>Support</h4>
              <ul className="space-y-2">
                {(settings.footerMenus?.support || [
                  { label: 'Help Center', href: '/help', enabled: true },
                  { label: 'Contact Us', href: 'mailto:support@chartvolt.com', enabled: true },
                  { label: 'Terms of Service', href: '/terms', enabled: true },
                  { label: 'Privacy Policy', href: '/privacy', enabled: true },
                ]).filter(item => item.enabled).map((item, i) => (
                  <li key={i}>
                    {item.href.startsWith('mailto:') ? (
                      <a href={item.href} className="text-sm transition-colors hover:opacity-80" style={{ color: theme?.colors.textMuted }}>
                        {item.label}
                      </a>
                    ) : (
                      <Link href={item.href} className="text-sm transition-colors hover:opacity-80" style={{ color: theme?.colors.textMuted }}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Business Menu */}
            <div>
              <h4 className="font-semibold mb-4" style={{ color: effectiveColors.text }}>Business</h4>
              <ul className="space-y-2">
                {(settings.footerMenus?.business || [
                  { label: 'Enterprise Solutions', href: '/enterprise', enabled: true },
                  { label: 'Pricing', href: '/enterprise#pricing', enabled: true },
                  { label: 'Contact Sales', href: '/enterprise#contact', enabled: true },
                ]).filter(item => item.enabled).map((item, i) => (
                  <li key={i}>
                    <Link href={item.href} className="text-sm transition-colors hover:opacity-80" style={{ color: theme?.colors.textMuted }}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risk Disclaimer */}
          <div className="py-6" style={{ borderTop: `1px solid ${theme?.colors.border}` }}>
            <p className="text-xs leading-relaxed" style={{ color: theme?.colors.textMuted }}>
              <strong style={{ color: effectiveColors.text }}>Risk Disclaimer:</strong>{' '}
              {settings.footerRiskDisclaimer || 'Trading in financial markets involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and as a result, traders may lose more than their original investment. Past performance is not indicative of future results. All trading strategies are used at your own risk. This platform is for educational and entertainment purposes only. Virtual currency used on this platform has no real monetary value.'}
              {settings.footerDisclaimer && ` ${settings.footerDisclaimer}`}
            </p>
          </div>

          {/* Copyright */}
          <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: `1px solid ${theme?.colors.border}` }}>
            <p className="text-sm" style={{ color: theme?.colors.textMuted }}>{settings.footerCopyright}</p>
            <div className="flex items-center gap-4">
              <span className="text-xs" style={{ color: theme?.colors.textMuted }}>Powered by</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: theme?.effects.gradientStyle }}>
                  <span className="text-xs">{theme?.themeIcons?.power || '⚡'}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: theme?.colors.textMuted }}>ChartVolt</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

