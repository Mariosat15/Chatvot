'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  Globe,
  Palette,
  BarChart3,
  Users,
  Trophy,
  Settings,
  Lock,
  Server,
  Headphones,
  Code,
  ArrowRight,
  Check,
  Star,
  Building2,
  Briefcase,
  TrendingUp,
  Mail,
  Phone,
  ChevronRight,
  Layers,
  Database,
  Bell,
  CreditCard,
  FileText,
  PieChart,
  Target,
  Award,
  Crown,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy, Settings, Lock, Server,
  Headphones, Code, Star, Building2, Briefcase, TrendingUp, Mail, Phone, Layers,
  Database, Bell, CreditCard, FileText, PieChart, Target, Award, Crown,
};

interface EnterpriseSettings {
  siteName: string;
  logo: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBadge: string;
  heroCTAText: string;
  heroCTALink: string;
  heroSecondaryCTAText: string;
  heroSecondaryCTALink: string;
  trustBadges: Array<{ id: string; icon: string; text: string; enabled: boolean; }>;
  whiteLabelTitle: string;
  whiteLabelSubtitle: string;
  whiteLabelFeatures: Array<{ id: string; icon: string; title: string; description: string; enabled: boolean; order: number; }>;
  adminTitle: string;
  adminSubtitle: string;
  adminDescription: string;
  adminFeatures: Array<{ id: string; icon: string; title: string; description: string; color: string; enabled: boolean; order: number; }>;
  pricingTitle: string;
  pricingSubtitle: string;
  pricingTiers: Array<{ id: string; name: string; price: string; period: string; description: string; features: string[]; ctaText: string; highlighted: boolean; enabled: boolean; order: number; }>;
  contactTitle: string;
  contactSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  contactCTAText: string;
  sectionVisibility: {
    hero: boolean;
    trustBadges: boolean;
    whiteLabel: boolean;
    adminShowcase: boolean;
    pricing: boolean;
    contact: boolean;
    footer: boolean;
  };
  footerCopyright: string;
}

export default function EnterprisePage() {
  const [settings, setSettings] = useState<EnterpriseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/enterprise-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.enabled === false) {
            // Enterprise page is disabled, redirect to home
            window.location.href = '/';
            return;
          }
          setSettings(data.settings);
        }
      } catch (error) {
        console.error('Error fetching enterprise settings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full"
        />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>Failed to load page</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              {settings.logo ? (
                <Image src={settings.logo} alt={settings.siteName} width={140} height={32} className="h-8 w-auto" />
              ) : (
                <>
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
                    <Zap className="h-6 w-6 text-gray-900" />
                  </div>
                  <span className="text-xl font-bold hidden sm:block">{settings.siteName}</span>
                </>
              )}
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-purple-400 transition-colors text-sm font-medium">Features</a>
              <a href="#admin" className="text-gray-400 hover:text-purple-400 transition-colors text-sm font-medium">Admin Panel</a>
              <a href="#pricing" className="text-gray-400 hover:text-purple-400 transition-colors text-sm font-medium">Pricing</a>
              <a href="#contact" className="text-gray-400 hover:text-purple-400 transition-colors text-sm font-medium">Contact</a>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" className="text-gray-400 hover:text-white hidden sm:flex">
                  Back to Home
                </Button>
              </Link>
              <a href="#contact">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold">
                  Get Quote
                </Button>
              </a>
              
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-400">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-gray-950/95">
            <nav className="px-4 py-4 space-y-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white rounded-lg">Features</a>
              <a href="#admin" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white rounded-lg">Admin Panel</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white rounded-lg">Pricing</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-gray-400 hover:text-white rounded-lg">Contact</a>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      {settings.sectionVisibility.hero && (
        <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(rgba(168, 85, 247, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }} />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-8"
              >
                <Building2 className="h-4 w-4" />
                {settings.heroBadge}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tight"
              >
                <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500 bg-clip-text text-transparent">
                  {settings.heroTitle}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed"
              >
                {settings.heroDescription}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <a href={settings.heroCTALink}>
                  <Button size="lg" className="text-lg px-8 py-6 font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-lg shadow-purple-500/25">
                    <Briefcase className="h-5 w-5 mr-2" />
                    {settings.heroCTAText}
                  </Button>
                </a>
                <a href={settings.heroSecondaryCTALink}>
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6 font-bold border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                    {settings.heroSecondaryCTAText}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </a>
              </motion.div>

              {/* Trust badges */}
              {settings.sectionVisibility.trustBadges && settings.trustBadges.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-500"
                >
                  {settings.trustBadges.map((badge) => {
                    const IconComponent = iconMap[badge.icon];
                    return (
                      <div key={badge.id} className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="h-5 w-5 text-purple-500" />}
                        <span className="text-sm">{badge.text}</span>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* White Label Features */}
      {settings.sectionVisibility.whiteLabel && (
        <section id="features" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                  {settings.whiteLabelTitle}
                </span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">{settings.whiteLabelSubtitle}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {settings.whiteLabelFeatures.map((feature, index) => {
                const IconComponent = iconMap[feature.icon];
                return (
                  <motion.div
                    key={feature.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="group p-8 rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-gray-800/50 hover:border-purple-500/30 transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      {IconComponent && <IconComponent className="h-7 w-7 text-purple-400" />}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-400">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Admin Panel Showcase */}
      {settings.sectionVisibility.adminShowcase && (
        <section id="admin" className="py-24 bg-gradient-to-b from-gray-900/50 to-gray-950 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm font-medium mb-6">
                <Shield className="h-4 w-4" />
                {settings.adminSubtitle}
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">{settings.adminTitle}</h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">{settings.adminDescription}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {settings.adminFeatures.map((feature, index) => {
                const IconComponent = iconMap[feature.icon];
                return (
                  <motion.div
                    key={feature.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="group relative p-6 rounded-2xl bg-gray-900/50 border border-gray-800/50 hover:border-yellow-500/30 overflow-hidden transition-all duration-300"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                      {IconComponent && <IconComponent className="h-6 w-6 text-white" />}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Admin Panel Preview */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-16 p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
            >
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-gray-700">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-4 text-sm text-gray-400">admin.yourplatform.com</span>
                </div>
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 mb-4">
                    <Settings className="h-10 w-10 text-gray-900" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h3>
                  <p className="text-gray-400 mb-6">Full-featured admin panel with real-time analytics</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <div className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">Users: 15,847</div>
                    <div className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">Active: 2,341</div>
                    <div className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">Revenue: $124,567</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Pricing Section */}
      {settings.sectionVisibility.pricing && (
        <section id="pricing" className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">{settings.pricingTitle}</h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">{settings.pricingSubtitle}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {settings.pricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className={`relative p-8 rounded-2xl ${
                    tier.highlighted 
                      ? 'bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-2 border-purple-500' 
                      : 'bg-gray-900/50 border border-gray-800'
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-black text-white">{tier.price}</span>
                    <span className="text-gray-400">{tier.period}</span>
                  </div>
                  <p className="text-gray-400 mb-6">{tier.description}</p>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-300">
                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact">
                    <Button 
                      className={`w-full font-bold ${
                        tier.highlighted 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white' 
                          : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                      size="lg"
                    >
                      {tier.ctaText}
                    </Button>
                  </a>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Section */}
      {settings.sectionVisibility.contact && (
        <section id="contact" className="py-24 bg-gradient-to-b from-gray-900/50 to-gray-950">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">{settings.contactTitle}</h2>
              <p className="text-gray-400 text-lg">{settings.contactSubtitle}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email Us</p>
                    <p className="text-white font-medium">{settings.contactEmail}</p>
                  </div>
                </a>
                <a href={`tel:${settings.contactPhone?.replace(/\D/g, '')}`} className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Call Us</p>
                    <p className="text-white font-medium">{settings.contactPhone}</p>
                  </div>
                </a>
              </div>
              <div className="text-center">
                <p className="text-gray-400 mb-4">Or schedule a demo call with our team</p>
                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold px-12">
                  {settings.contactCTAText}
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Footer */}
      {settings.sectionVisibility.footer && (
        <footer className="py-12 border-t border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                {settings.logo ? (
                  <Image src={settings.logo} alt={settings.siteName} width={100} height={24} className="h-6 w-auto opacity-70" />
                ) : (
                  <>
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                      <Zap className="h-5 w-5 text-gray-900" />
                    </div>
                  </>
                )}
                <span className="text-gray-400">{settings.footerCopyright}</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <Link href="/" className="hover:text-purple-400 transition-colors">Home</Link>
                <Link href="/terms" className="hover:text-purple-400 transition-colors">Terms</Link>
                <Link href="/privacy" className="hover:text-purple-400 transition-colors">Privacy</Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
