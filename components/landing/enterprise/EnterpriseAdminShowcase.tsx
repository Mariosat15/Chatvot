"use client";

import { motion } from "framer-motion";
import {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy,
  Settings, Lock, Server, Headphones, Code, Star, Building2,
  Briefcase, TrendingUp, Mail, Phone, Layers, Database,
  Bell, CreditCard, FileText, PieChart, Target, Award, Crown,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield, Zap, Globe, Palette, BarChart3, Users, Trophy,
  Settings, Lock, Server, Headphones, Code, Star, Building2,
  Briefcase, TrendingUp, Mail, Phone, Layers, Database,
  Bell, CreditCard, FileText, PieChart, Target, Award, Crown,
};

interface AdminFeature {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  enabled: boolean;
  order: number;
}

interface EnterpriseAdminShowcaseProps {
  adminTitle: string;
  adminSubtitle: string;
  adminDescription: string;
  adminFeatures: AdminFeature[];
}

export default function EnterpriseAdminShowcase({
  adminTitle,
  adminSubtitle,
  adminDescription,
  adminFeatures,
}: EnterpriseAdminShowcaseProps) {
  return (
    <section
      id="admin"
      className="py-24 bg-gradient-to-b from-gray-900/50 to-gray-950 relative overflow-hidden"
    >
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
            {adminSubtitle}
          </div>
          <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">
            {adminTitle}
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {adminDescription}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {adminFeatures.map((feature, index) => {
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
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`}
                />
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}
                >
                  {IconComponent && (
                    <IconComponent className="h-6 w-6 text-white" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400">
                  {feature.description}
                </p>
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
              <span className="ml-4 text-sm text-gray-400">
                admin.yourplatform.com
              </span>
            </div>
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 mb-4">
                <Settings className="h-10 w-10 text-gray-900" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Admin Dashboard
              </h3>
              <p className="text-gray-400 mb-6">
                Full-featured admin panel with real-time analytics
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">
                  Users: 15,847
                </div>
                <div className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">
                  Active: 2,341
                </div>
                <div className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300">
                  Revenue: $124,567
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
