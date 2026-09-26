"use client";

import { motion } from "framer-motion";
import {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy,
  Settings, Lock, Server, Headphones, Code, Star, Building2,
  Briefcase, TrendingUp, Mail, Phone, Layers, Database,
  Bell, CreditCard, FileText, PieChart, Target, Award, Crown,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy,
  Settings, Lock, Server, Headphones, Code, Star, Building2,
  Briefcase, TrendingUp, Mail, Phone, Layers, Database,
  Bell, CreditCard, FileText, PieChart, Target, Award, Crown,
};

interface CompetitionType {
  id: string;
  icon: string;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
}

interface GameMasterBenefit {
  id: string;
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  order: number;
}

interface EnterprisePlatformSectionProps {
  showCapabilities: boolean;
  competitionTypes?: CompetitionType[];
  showGameMaster: boolean;
  gameMasterBenefits?: GameMasterBenefit[];
}

export default function EnterprisePlatformSection({
  showCapabilities,
  competitionTypes,
  showGameMaster,
  gameMasterBenefits,
}: EnterprisePlatformSectionProps) {
  return (
    <>
      {/* Platform Capabilities — Competition Types */}
      {showCapabilities &&
        competitionTypes &&
        competitionTypes.length > 0 && (
          <section id="capabilities" className="py-24 relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at top, rgba(168, 85, 247, 0.06), transparent 60%)",
              }}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6">
                  <Trophy className="h-4 w-4" />
                  Built for Engagement
                </div>
                <h2 className="text-4xl md:text-5xl font-black mb-4">
                  <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    6 Competition Formats
                  </span>
                </h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                  Your users get access to diverse competition types — from
                  P&amp;L and ROI challenges to Win Rate and Profit Factor
                  battles. Every format tests a different trading edge.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {competitionTypes.map((type, index) => {
                  const IconComponent = iconMap[type.icon] || Trophy;
                  return (
                    <motion.div
                      key={type.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      viewport={{ once: true }}
                      whileHover={{ y: -5 }}
                      className="group p-6 rounded-2xl bg-gray-900/60 border border-gray-800/50 hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${type.color}20` }}
                        >
                          <IconComponent
                            className="h-6 w-6"
                            style={{ color: type.color }}
                          />
                        </div>
                        <div
                          className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                          style={{
                            backgroundColor: `${type.color}15`,
                            color: type.color,
                          }}
                        >
                          {type.id.replace("_", " ")}
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        {type.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {type.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6"
              >
                {[
                  { label: "1v1 Challenges", icon: "⚔️" },
                  { label: "Custom Tiebreakers", icon: "🎯" },
                  { label: "Flexible Leverage", icon: "📊" },
                  { label: "Auto Prize Distribution", icon: "🏆" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="text-center p-4 rounded-xl bg-gray-900/40 border border-gray-800/30"
                  >
                    <span className="text-2xl block mb-2">{item.icon}</span>
                    <span className="text-sm text-gray-400">{item.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </section>
        )}

      {/* Game Master Program */}
      {showGameMaster &&
        gameMasterBenefits &&
        gameMasterBenefits.length > 0 && (
          <section className="py-24 relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at bottom right, rgba(236, 72, 153, 0.06), transparent 60%)",
              }}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium mb-6">
                  <Crown className="h-4 w-4" />
                  Organic Growth Engine
                </div>
                <h2 className="text-4xl md:text-5xl font-black mb-4">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    Game Master Program
                  </span>
                </h2>
                <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                  Empower your power users to become Game Masters — they host
                  competitions, attract players, and earn referral fees from
                  every prize pool. A built-in growth loop that pays for itself.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {gameMasterBenefits.map((benefit, index) => {
                  const IconComponent = iconMap[benefit.icon] || Crown;
                  return (
                    <motion.div
                      key={benefit.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      whileHover={{ y: -5 }}
                      className="group p-6 rounded-2xl bg-gray-900/60 border border-gray-800/50 hover:border-yellow-500/30 transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <IconComponent className="h-6 w-6 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">
                        {benefit.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {benefit.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Revenue Model Highlight */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-8 rounded-2xl bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border border-yellow-500/20"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-black text-yellow-400 mb-1">
                      0%
                    </div>
                    <div className="text-sm text-gray-400">
                      Upfront Cost for GMs
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-yellow-400 mb-1">
                      ∞
                    </div>
                    <div className="text-sm text-gray-400">
                      Competitions They Can Host
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-yellow-400 mb-1">
                      Auto
                    </div>
                    <div className="text-sm text-gray-400">
                      Referral Fee Distribution
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}
    </>
  );
}
