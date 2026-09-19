'use client';
// ─── ArenaIcon — Lucide Icon Wrapper for Arena Components ─────────────────────
// Reason: All arena components use inline styles (not Tailwind). This wrapper
// renders Lucide icons at the right size/color for arena use. Keeps icon imports
// centralized to avoid huge import lists in every component.
import React from 'react';
import {
  Trophy, Crown, Flame, Zap, Target, Crosshair, Rocket, Shield, ShieldCheck,
  Mountain, Swords, Timer, Users, TrendingUp, TrendingDown, BarChart3,
  Activity, Eye, Star, Medal, AlertTriangle, AlertCircle, ChevronRight,
  Wallet, ArrowUpRight, ArrowDownRight, Dog, Minus,
  CircleDot, Signal, Clock, DollarSign, BarChart, BarChart2, LineChart, Layers,
  Radio, ChevronLeft, X, Hash, ArrowLeft, Gauge, Award, Calendar,
  LayoutGrid, Loader, Sparkles, Percent, Scale, GitBranch, ArrowRight,
  Globe, Lock, Unlock, Info, Check, Ban, Skull, Heart,
  ArrowUp, ArrowDown, ShieldAlert, CheckCircle2, CircleCheck, Megaphone,
  ChevronUp, ChevronDown,
} from 'lucide-react';

// Reason: Static map avoids runtime overhead of dynamic imports.
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string; style?: React.CSSProperties }>> = {
  Trophy, Crown, Flame, Zap, Target, Crosshair, Rocket, Shield, ShieldCheck,
  Mountain, Swords, Timer, Users, TrendingUp, TrendingDown, BarChart3,
  Activity, Eye, Star, Medal, AlertTriangle, AlertCircle, ChevronRight,
  Wallet, ArrowUpRight, ArrowDownRight, Dog, Minus,
  CircleDot, Signal, Clock, DollarSign, BarChart, BarChart2, LineChart, Layers,
  Radio, ChevronLeft, X, Hash, ArrowLeft, Gauge, Award, Calendar,
  LayoutGrid, Loader, Sparkles, Percent, Scale, GitBranch, ArrowRight,
  Globe, Lock, Unlock, Info, Check, Ban, Skull, Heart,
  ArrowUp, ArrowDown, ShieldAlert, CheckCircle2, CircleCheck, Megaphone,
  ChevronUp, ChevronDown,
};

interface ArenaIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const ArenaIcon: React.FC<ArenaIconProps> = ({ name, size = 16, color, style }) => {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} style={style} />;
};

export default ArenaIcon;
