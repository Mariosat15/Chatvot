"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Search,
  Trophy,
  Users,
  DollarSign,
  Shield,
  Settings,
  BarChart3,
  CreditCard,
  Database,
  AlertTriangle,
  Zap,
  Target,
  CheckCircle,
  XCircle,
  Info,
  Lightbulb,
  Code,
  FileText,
  TrendingUp,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Globe,
  Cpu,
  Server,
  Activity,
  Bell,
  Mail,
  FileCheck,
  Receipt,
  Clock,
  Building,
  Key,
  RefreshCw,
  UserCog,
  Ban,
  Wallet,
  PieChart,
  Download,
  Filter,
  Calendar,
  Radio,
  Wifi,
  HardDrive,
  ArrowDown,
  ArrowRight,
  Layers,
  Timer,
  Trash2,
  Play,
  Pause,
  RefreshCcw,
  LineChart,
  CandlestickChart,
  HeartPulse,
  FileWarning,
  ShieldAlert,
  Gift,
  Scale,
  Camera,
} from "lucide-react";

interface WikiTopic {
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  category: string;
  content: React.ReactNode;
  tags: string[];
}

export default function AdminWikiSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("overview");

  const topics: WikiTopic[] = [
    // ==================== GETTING STARTED ====================
    {
      id: "overview",
      title: "Admin Panel Overview",
      icon: BookOpen,
      category: "Getting Started",
      tags: ["introduction", "overview", "basics", "dashboard"],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-blue-400 mb-3 flex items-center gap-2">
              <Zap className="h-6 w-6" />
              Welcome to Your Admin Panel
            </h2>
            <p className="text-gray-300 leading-relaxed">
              This comprehensive control center gives you complete power over
              your trading competition platform. From creating competitions to
              detecting fraud, managing payments to analyzing performance -
              everything is here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-yellow-400 flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Competitions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Create, manage, and monitor trading competitions. Set prizes,
                rules, minimum participants, entry fees, and track live
                standings.
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Manage user accounts, credit balances, view trading stats,
                suspend, ban, or edit users.
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-green-400 flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Monitor revenue, platform fees, user balances, VAT, withdrawals,
                and complete financial overview.
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-400 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Fraud Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Configure fraud detection, review alerts, investigate suspicious
                activity, and protect your platform.
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-orange-400 flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Manage notification templates, send instant notifications, and
                configure user communication.
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-purple-400 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-300">
                Configure platform branding, company info, invoice templates,
                email templates, and more.
              </CardContent>
            </Card>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  Quick Tips
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Use the sidebar to navigate between sections</li>
                  <li>• All actions are logged in the Audit Log</li>
                  <li>
                    • Database reset preserves admin credentials and users
                  </li>
                  <li>
                    • Enable Inngest for automatic competition status updates
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ==================== COMPETITIONS ====================
    {
      id: "competitions-create",
      title: "Creating Competitions",
      icon: Trophy,
      category: "Competitions",
      tags: ["competition", "create", "setup", "prizes", "entry fee"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-3">
              Creating a New Competition
            </h2>
            <p className="text-gray-300 mb-4">
              Competitions are the heart of your platform. Follow this guide to
              create compelling, fair trading contests.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Step 1: Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Competition Name
                </h4>
                <p className="text-sm mb-2">
                  Choose an exciting, descriptive name:
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>"Weekend Warriors Trading Challenge"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>"€10K Prize Pool - Forex Masters"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>"comp1" (too generic)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Description</h4>
                <p className="text-sm">
                  Write a compelling description explaining rules, prizes, and
                  what makes this competition unique.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Step 2: Participants & Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-400 mb-2">
                    Minimum Participants
                  </h4>
                  <p className="text-sm">
                    Set the minimum number of participants required to start. If
                    not met by start time:
                  </p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>
                      • Competition is <strong>automatically cancelled</strong>
                    </li>
                    <li>
                      • All entry fees are <strong>fully refunded</strong>
                    </li>
                    <li>
                      • Users receive a <strong>notification</strong>
                    </li>
                  </ul>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-green-400 mb-2">
                    Maximum Participants
                  </h4>
                  <p className="text-sm">
                    Set the cap for total participants. Once reached:
                  </p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• Registration closes automatically</li>
                    <li>• Prize pool is maximized</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">
                  💡 Entry Fee & Starting Capital Ratio
                </h4>
                <div className="text-sm space-y-1">
                  <div>
                    • Entry Fee: €10 → Starting Capital: €5,000 - €10,000
                  </div>
                  <div>
                    • Entry Fee: €50 → Starting Capital: €25,000 - €50,000
                  </div>
                  <div>• Entry Fee: €100 → Starting Capital: €100,000+</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Step 3: Competition Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Ranking Method
                </h4>
                <div className="space-y-2">
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="font-medium text-green-400">
                      💰 P&L (Profit & Loss)
                    </div>
                    <p className="text-sm mt-1">
                      Winner has highest absolute profit. Best for: Aggressive
                      traders, short competitions
                    </p>
                  </div>
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="font-medium text-blue-400">
                      📊 ROI% (Return on Investment)
                    </div>
                    <p className="text-sm mt-1">
                      Winner has highest percentage return. Best for: Fair play,
                      skill-based
                    </p>
                  </div>
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="font-medium text-purple-400">
                      💵 Total Capital
                    </div>
                    <p className="text-sm mt-1">
                      Winner has highest final balance. Best for: Conservative
                      strategies
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">
                  Minimum Trades Requirement
                </h4>
                <p className="text-sm">
                  Set minimum trades required to qualify. Users who don't meet
                  this at competition end are <strong>disqualified</strong> and
                  their portion of the prize pool is redistributed.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Tie Breakers</h4>
                <p className="text-sm mb-2">
                  Configure what happens when participants have identical
                  scores:
                </p>
                <div className="text-sm space-y-1">
                  <div>
                    • <strong>Tie Breaker 1:</strong> Trades count, Win rate,
                    ROI, Join time
                  </div>
                  <div>
                    • <strong>Tie Breaker 2:</strong> Secondary criteria if
                    first is also tied
                  </div>
                  <div>
                    • <strong>Split Prize:</strong> Divide prize equally among
                    tied participants
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Step 4: Prize Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Winner-Takes-Most (80-15-5)
                  </div>
                  <div className="text-sm">1st: 80% | 2nd: 15% | 3rd: 5%</div>
                  <div className="text-gray-500 text-xs mt-1">
                    Best for: Small competitions (10-50 participants)
                  </div>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Balanced (60-25-10-5)
                  </div>
                  <div className="text-sm">
                    1st: 60% | 2nd: 25% | 3rd: 10% | 4th: 5%
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    Best for: Medium competitions (50-100 participants)
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <h4 className="font-semibold text-yellow-400 mb-1">
                  Platform Fee
                </h4>
                <p className="text-sm">
                  Set the platform fee percentage (e.g., 10%). This is deducted
                  from the total prize pool before distribution.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-400 mb-1">
                  Important: Minimum Participants
                </h4>
                <p className="text-sm text-gray-300">
                  If a competition doesn't meet minimum participants by start
                  time, it will be <strong>automatically cancelled</strong> and
                  all participants will receive a <strong>full refund</strong>{" "}
                  including any platform fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    {
      id: "competitions-manage",
      title: "Managing Competitions",
      icon: Target,
      category: "Competitions",
      tags: ["competition", "manage", "cancel", "edit", "view"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-3">
              Managing Active Competitions
            </h2>
            <p className="text-gray-300 mb-4">
              Monitor and manage your competitions throughout their lifecycle.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Competition Statuses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 p-3 rounded border-l-4 border-gray-500">
                  <div className="font-medium text-gray-400">Draft</div>
                  <p className="text-xs mt-1">
                    Not visible to users, still being configured
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-blue-500">
                  <div className="font-medium text-blue-400">Upcoming</div>
                  <p className="text-xs mt-1">
                    Visible, accepting registrations
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-green-500">
                  <div className="font-medium text-green-400">Active</div>
                  <p className="text-xs mt-1">
                    Currently running, trading live
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-purple-500">
                  <div className="font-medium text-purple-400">Completed</div>
                  <p className="text-xs mt-1">Ended, prizes distributed</p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-red-500 col-span-2">
                  <div className="font-medium text-red-400">🚫 Cancelled</div>
                  <p className="text-xs mt-1">
                    Cancelled before start (min participants not met), all entry
                    fees refunded
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Automatic Cancellation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                When a competition's start time arrives:
              </p>
              <div className="space-y-2">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">
                    ✅ If Minimum Participants Met
                  </div>
                  <div className="text-sm">
                    Competition starts normally → Status becomes "Active"
                  </div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="font-medium text-red-400 mb-1">
                    🚫 If Below Minimum
                  </div>
                  <div className="text-sm">
                    Competition is cancelled → All participants receive full
                    refund → Status becomes "Cancelled"
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Viewing Competition Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                In the Competitions tab, click any competition to view:
              </p>
              <ul className="text-sm space-y-1">
                <li>
                  • <strong>Participants:</strong> Full list with their current
                  standings
                </li>
                <li>
                  • <strong>Leaderboard:</strong> Real-time rankings with P&L,
                  trades, win rate
                </li>
                <li>
                  • <strong>Prize Pool:</strong> Current pool size and
                  distribution breakdown
                </li>
                <li>
                  • <strong>Settings:</strong> All competition rules and
                  configuration
                </li>
                <li>
                  • <strong>Trades:</strong> All trades made by participants
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== FRAUD DETECTION ====================
    {
      id: "fraud-overview",
      title: "Fraud Detection System",
      icon: Shield,
      category: "Fraud Detection",
      tags: ["fraud", "security", "detection", "vpn", "cheating"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-3">
              Understanding Fraud Detection
            </h2>
            <p className="text-gray-300 mb-4">
              Our multi-layered fraud detection system protects your
              competitions from cheaters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gray-800 border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-400">
                  Device Fingerprinting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>
                    <strong>Detects:</strong> Multiple accounts from same device
                  </p>
                  <p>
                    <strong>Accuracy:</strong> ~85%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-orange-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-orange-400">
                  VPN/Proxy Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>
                    <strong>Detects:</strong> VPNs, proxies, Tor
                  </p>
                  <p>
                    <strong>Accuracy:</strong> 60-95%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-yellow-400">
                  Risk Scoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>
                    <strong>Range:</strong> 0-100 points
                  </p>
                  <p>
                    <strong>Action:</strong> Auto-block at threshold
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Fraud Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Entry Block Threshold
                </h4>
                <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Lenient (85):</span>
                    <span className="text-green-400">
                      Few blocks, some fraud may pass
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balanced (70):</span>
                    <span className="text-yellow-400">Recommended default</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strict (50):</span>
                    <span className="text-red-400">
                      Catches most fraud, some false positives
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">
                  Actions You Can Take
                </h4>
                <div className="text-sm space-y-2">
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-yellow-400">Investigate:</strong>{" "}
                    Mark alert for review, gather more evidence
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-orange-400">Suspend:</strong>{" "}
                    Temporarily block user from competitions
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-red-400">Ban:</strong> Permanently
                    block user from platform
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-green-400">Dismiss:</strong> Mark as
                    false positive, clear alert
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== SECURITY & PROTECTION ====================
    {
      id: "security-protection",
      title: "Security & Rate Limiting",
      icon: Shield,
      category: "Security",
      tags: [
        "security",
        "ddos",
        "rate-limit",
        "protection",
        "nginx",
        "redis",
        "bot",
      ],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">
              Security & DDoS Protection
            </h2>
            <p className="text-gray-300 mb-4">
              Your platform has multiple layers of protection against abuse,
              DDoS attacks, and malicious users. Here&apos;s what&apos;s
              configured and actively protecting your platform.
            </p>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Protection Status: ACTIVE
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-500/20 rounded-lg p-3 text-center">
                <Server className="h-6 w-6 text-green-400 mx-auto mb-1" />
                <span className="text-sm font-semibold text-green-300">
                  Nginx
                </span>
                <p className="text-xs text-gray-400">Rate Limiting</p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-3 text-center">
                <Code className="h-6 w-6 text-green-400 mx-auto mb-1" />
                <span className="text-sm font-semibold text-green-300">
                  Application
                </span>
                <p className="text-xs text-gray-400">Route Limiting</p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-3 text-center">
                <HardDrive className="h-6 w-6 text-green-400 mx-auto mb-1" />
                <span className="text-sm font-semibold text-green-300">
                  Redis
                </span>
                <p className="text-xs text-gray-400">Distributed</p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-3 text-center">
                <Shield className="h-6 w-6 text-green-400 mx-auto mb-1" />
                <span className="text-sm font-semibold text-green-300">
                  Registration
                </span>
                <p className="text-xs text-gray-400">Bot Protection</p>
              </div>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
                <Server className="h-5 w-5" />
                Layer 1: Nginx Rate Limiting
              </CardTitle>
              <CardDescription>
                First line of defense - blocks requests before they reach your
                app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left p-2 text-gray-300">Zone</th>
                      <th className="text-left p-2 text-gray-300">Limit</th>
                      <th className="text-left p-2 text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-t border-gray-700">
                      <td className="p-2 font-mono">admin_limit</td>
                      <td className="p-2">1 req/sec</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="p-2 font-mono">api_limit</td>
                      <td className="p-2">10 req/sec</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="p-2 font-mono">login/auth routes</td>
                      <td className="p-2">limit_req enabled</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">
                Config location:{" "}
                <code className="bg-gray-700 px-1 rounded">
                  nginx/chartvolt.conf
                </code>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400 flex items-center gap-2">
                <Code className="h-5 w-5" />
                Layer 2: Application Rate Limiting
              </CardTitle>
              <CardDescription>
                Intelligent per-route limits using rate-limiter.ts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="text-left p-2 text-gray-300">Action</th>
                      <th className="text-left p-2 text-gray-300">Limit</th>
                      <th className="text-left p-2 text-gray-300">Scope</th>
                      <th className="text-left p-2 text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-t border-gray-700">
                      <td className="p-2">Login Attempts</td>
                      <td className="p-2 font-mono">5/min</td>
                      <td className="p-2">per IP</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="p-2">Deposits</td>
                      <td className="p-2 font-mono">5/min</td>
                      <td className="p-2">per User</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="p-2">Withdrawals</td>
                      <td className="p-2 font-mono">3/min</td>
                      <td className="p-2">per User</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-gray-700">
                      <td className="p-2">API General</td>
                      <td className="p-2 font-mono">60/min</td>
                      <td className="p-2">per User</td>
                      <td className="p-2">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✅ Active
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">
                Config location:{" "}
                <code className="bg-gray-700 px-1 rounded">
                  lib/utils/rate-limiter.ts
                </code>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Layer 3: Redis Distributed Rate Limiting
              </CardTitle>
              <CardDescription>
                Scales across multiple server instances
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                Redis-backed rate limiting is available for horizontal scaling
                scenarios. When you run multiple Next.js instances, this ensures
                rate limits are shared across all servers.
              </p>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-400">
                  ✅ Available
                </Badge>
                <span className="text-sm text-gray-400">
                  Ready when you need to scale
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Config location:{" "}
                <code className="bg-gray-700 px-1 rounded">
                  lib/services/redis.service.ts
                </code>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400 flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Layer 4: Registration Security
              </CardTitle>
              <CardDescription>
                Advanced bot and fraud protection for new accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-white">
                      Bot Protection
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Detects automated signups
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-white">
                      Brute Force Detection
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Tracks rapid attempts</p>
                </div>
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-white">
                      Account Lockouts
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Temp blocks on failures
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-white">
                      Failed Login Tracking
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Logged in Fraud system
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Config location:{" "}
                <code className="bg-gray-700 px-1 rounded">
                  lib/services/registration-security.service.ts
                </code>
              </p>
            </CardContent>
          </Card>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-2">
                  Optional: Cloudflare (External Layer)
                </h4>
                <p className="text-sm text-gray-300 mb-2">
                  For enterprise-level DDoS protection, you can add Cloudflare
                  as an external layer:
                </p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>
                    • Absorbs network-layer DDoS attacks (millions of requests)
                  </li>
                  <li>• Global CDN caching for static assets</li>
                  <li>• Free SSL certificates</li>
                  <li>• No code changes required - just DNS change</li>
                  <li>• Free tier available for small sites</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-2">
                  What This Protects Against
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Login credential stuffing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>API abuse/spam</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Bot registrations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Withdrawal abuse</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Application-layer DDoS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Brute force attacks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    // ==================== MARKET DATA ====================
    {
      id: "market-data-setup",
      title: "Complete First-Time Setup Guide",
      icon: Play,
      category: "Market Data",
      tags: [
        "setup",
        "first-time",
        "guide",
        "configuration",
        "initial",
        "tutorial",
      ],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-green-400 mb-3 flex items-center gap-2">
              <Play className="h-6 w-6" />
              Complete First-Time Setup Guide
            </h2>
            <p className="text-gray-300">
              <strong>Goal:</strong> Aggregate only 60 minutes of 1m data for
              real-time charts, with all older data served instantly from
              pre-built historical collections.
            </p>
          </div>

          {/* Step 1 */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Configure Market Data Settings
              </CardTitle>
              <CardDescription>
                Go to: Admin → Market Data → Settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">
                        Setting
                      </th>
                      <th className="text-left py-2 px-3 text-gray-400">
                        Value
                      </th>
                      <th className="text-left py-2 px-3 text-gray-400">Why</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">Initial Load</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          60
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Load 60 candles initially (1 hour of 1m data)
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">
                        Scroll Load Batch
                      </td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          100
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Load 100 candles when scrolling left
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">
                        Auto-Seeding (Empty DB)
                      </td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          0d 1h 0m
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Only seed 1 hour if DB is empty
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">Data Source</td>
                      <td className="py-2 px-3">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✓ ON
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Use local database (fast)
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">
                        Limit Chart History
                      </td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          3650d
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        How far back users can scroll (10 years)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium">Gap Fill</td>
                      <td className="py-2 px-3">
                        <Badge className="bg-green-500/20 text-green-400">
                          ✓ ON, Auto
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Auto-fill small gaps
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                Click <strong>Save</strong> after configuring.
              </p>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400 flex items-center gap-2">
                <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  2
                </span>
                Download 1m Historical Data
              </CardTitle>
              <CardDescription>
                Go to: Admin → Market Data → Import Historical Data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">
                        Parameter
                      </th>
                      <th className="text-left py-2 px-3 text-gray-400">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">From Date</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          2024-01-01
                        </code>{" "}
                        (or how far back you want)
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">To Date</td>
                      <td className="py-2 px-3">
                        Click <strong>"Set to today →"</strong>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium">Select Symbols</td>
                      <td className="py-2 px-3">
                        Click <strong>"Select All"</strong> (or choose specific
                        ones)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-sm text-purple-300">
                  Click <strong>"Start Import"</strong> and wait for completion.
                  This downloads 1m candles into{" "}
                  <code className="bg-gray-700 px-1 rounded">
                    candles_historical_1m
                  </code>
                  .
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400 flex items-center gap-2">
                <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  3
                </span>
                Download Higher Timeframe History
              </CardTitle>
              <CardDescription>
                Go to: Admin → Market Data → Download Higher Timeframe History
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">
                        Parameter
                      </th>
                      <th className="text-left py-2 px-3 text-gray-400">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">
                        Years of History
                      </td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          1
                        </code>{" "}
                        or{" "}
                        <code className="bg-gray-700 px-2 py-0.5 rounded">
                          2
                        </code>{" "}
                        (your choice)
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3 font-medium">
                        Select Timeframes
                      </td>
                      <td className="py-2 px-3">
                        ✅ 5m, ✅ 15m, ✅ 30m, ✅ 1h, ✅ 4h, ✅ 1d, ✅ 1w, ✅ 1M
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium">Select Symbols</td>
                      <td className="py-2 px-3">
                        Click <strong>"Select All"</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-sm text-orange-300 mb-2">
                  Click <strong>"Download History"</strong> and wait for
                  completion. This downloads pre-built candles into:
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <code className="bg-gray-700 px-2 py-1 rounded">
                    candles_historical_5m
                  </code>
                  <code className="bg-gray-700 px-2 py-1 rounded">
                    candles_historical_15m
                  </code>
                  <code className="bg-gray-700 px-2 py-1 rounded">
                    candles_historical_30m
                  </code>
                  <code className="bg-gray-700 px-2 py-1 rounded">
                    candles_historical_1h
                  </code>
                  <code className="bg-gray-700 px-2 py-1 rounded">
                    candles_historical_4h
                  </code>
                  <code className="bg-gray-700 px-2 py-1 rounded">etc.</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4 */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400 flex items-center gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                  4
                </span>
                Verify Setup
              </CardTitle>
              <CardDescription>
                Test that everything works correctly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Open user dashboard</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Switch to 1h timeframe</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>
                    <strong>Initial load should be instant</strong> (from cache
                    + historical)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>
                    Scroll left - <strong>history loads smoothly</strong> from{" "}
                    <code className="bg-gray-700 px-1 rounded text-xs">
                      candles_historical_1h
                    </code>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How It Works */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              How It Works After Setup
            </h3>
            <div className="space-y-4 font-mono text-sm">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div className="text-gray-400 text-center mb-2">
                  USER REQUESTS 1H CHART
                </div>
                <div className="flex justify-center">
                  <ArrowDown className="h-4 w-4 text-gray-500" />
                </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                <div className="text-blue-400 font-bold mb-1">
                  RECENT DATA (last ~60 minutes)
                </div>
                <div className="text-gray-400 text-xs space-y-1">
                  <div>
                    Source: <code>candles_1m</code> (live)
                  </div>
                  <div>Process: Aggregate 60 × 1m candles → 1 hour candle</div>
                  <div>
                    Speed:{" "}
                    <span className="text-green-400">Fast (small dataset)</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <ArrowDown className="h-4 w-4 text-gray-500" />
              </div>
              <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                <div className="text-green-400 font-bold mb-1">
                  HISTORICAL DATA (everything older)
                </div>
                <div className="text-gray-400 text-xs space-y-1">
                  <div>
                    Source: <code>candles_historical_1h</code>
                  </div>
                  <div>Process: Direct read (NO aggregation!)</div>
                  <div>
                    Speed:{" "}
                    <span className="text-green-400 font-bold">INSTANT ⚡</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Reference Card */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quick Reference Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400">
                        What
                      </th>
                      <th className="text-left py-2 px-3 text-gray-400">
                        Collection
                      </th>
                      <th className="text-left py-2 px-3 text-gray-400">
                        How it&apos;s used
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3">Live prices</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                          candles_1m
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Aggregated for recent timeframes
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3">1m history</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                          candles_historical_1m
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Direct read when scrolling 1m chart
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3">5m history</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                          candles_historical_5m
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Direct read when scrolling 5m chart
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 px-3">1h history</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                          candles_historical_1h
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Direct read when scrolling 1h chart
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">4h history</td>
                      <td className="py-2 px-3">
                        <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                          candles_historical_4h
                        </code>
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        Direct read when scrolling 4h chart
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h3 className="text-md font-bold text-gray-300 mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Maintenance (Optional)
            </h3>
            <p className="text-gray-400 text-sm mb-3">
              The system auto-maintains itself, but you can:
            </p>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-400" />
                <strong>Re-download history</strong> anytime to fill gaps
              </li>
              <li className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-purple-400" />
                <strong>Adjust Initial Load</strong> if you want more/less data
                on first view
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <strong>Enable Auto-Seeding</strong> to automatically populate
                empty databases
              </li>
            </ul>
          </div>

          {/* Summary Checklist */}
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Summary Checklist
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-gray-300">
                <input type="checkbox" className="w-4 h-4 rounded" />
                <span>Set Initial Load to 60</span>
              </label>
              <label className="flex items-center gap-3 text-gray-300">
                <input type="checkbox" className="w-4 h-4 rounded" />
                <span>Set Auto-Seeding to 0d 1h 0m</span>
              </label>
              <label className="flex items-center gap-3 text-gray-300">
                <input type="checkbox" className="w-4 h-4 rounded" />
                <span>Download 1m history (Step 2)</span>
              </label>
              <label className="flex items-center gap-3 text-gray-300">
                <input type="checkbox" className="w-4 h-4 rounded" />
                <span>Download higher timeframe history (Step 3)</span>
              </label>
              <label className="flex items-center gap-3 text-gray-300">
                <input type="checkbox" className="w-4 h-4 rounded" />
                <span>Test chart loading speed</span>
              </label>
            </div>
            <div className="mt-4 p-3 bg-green-500/20 rounded-lg text-center">
              <p className="text-green-400 font-bold">
                🚀 Done! Your charts will now load instantly with 60 minutes of
                real-time aggregation and years of pre-built history.
              </p>
            </div>
          </div>
        </div>
      ),
    },

    {
      id: "market-data-overview",
      title: "Market Data Overview",
      icon: CandlestickChart,
      category: "Market Data",
      tags: [
        "charts",
        "prices",
        "candles",
        "architecture",
        "system",
        "unified-pipeline",
      ],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              Unified Pipeline Architecture
            </h2>
            <p className="text-gray-300 mb-4">
              Chartvolt uses a{" "}
              <strong className="text-emerald-400">
                Single Source of Truth
              </strong>{" "}
              architecture where the WebSocket Price Streamer builds and stores
              ALL candle data, ensuring perfect consistency across all charts
              and clients.
            </p>
          </div>

          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Data Flow Overview
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 px-3 py-2 rounded-lg text-blue-400 font-medium min-w-[160px]">
                  1. Massive.com
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">
                  External price feed (~50ms ticks)
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 px-3 py-2 rounded-lg text-purple-400 font-medium min-w-[160px]">
                  2. Price Streamer
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">
                  Builds ALL timeframe candles, saves completed to MongoDB
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/20 px-3 py-2 rounded-lg text-orange-400 font-medium min-w-[160px]">
                  3. WebSocket Server
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">
                  Broadcasts forming +{" "}
                  <strong className="text-green-400">completed</strong> candles
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-green-500/20 px-3 py-2 rounded-lg text-green-400 font-medium min-w-[160px]">
                  4. Browser Charts
                </div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">
                  Applies completed first, then forming candles
                </div>
              </div>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Why Unified Pipeline?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">
                    ✓ No Divergence
                  </div>
                  <p className="text-xs">
                    All charts show identical candles - no differences between
                    tabs
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">
                    ✓ Server Restart Safe
                  </div>
                  <p className="text-xs">
                    Completed candles augmented with 1m data from MongoDB
                  </p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                  <div className="font-medium text-purple-400 mb-1">
                    ✓ Real-Time Sync
                  </div>
                  <p className="text-xs">
                    Completed candles broadcast instantly to all clients
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1">
                    ✓ No Refresh Needed
                  </div>
                  <p className="text-xs">
                    Charts auto-update with authoritative historical data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Database className="h-5 w-5" />
                MongoDB Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Real-Time Collection
                </h4>
                <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <code className="text-cyan-400">candles_1m</code>
                    <span className="text-gray-400">
                      1-minute candles (~3 days, raw data for aggregation)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">
                  Historical Collections (Auto-Saved by Streamer)
                </h4>
                <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_5m
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_15m
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_30m
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_1h
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_4h
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_1d
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_1w
                      </code>
                    </div>
                    <div>
                      <code className="text-cyan-400">
                        candles_historical_1M
                      </code>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  💡 Completed candles are saved here automatically when each
                  period ends.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Timeframe Data Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">
                        Timeframe
                      </th>
                      <th className="text-left py-2 text-gray-400">
                        Historical (API Fetch)
                      </th>
                      <th className="text-left py-2 text-gray-400">
                        Forming (WebSocket)
                      </th>
                      <th className="text-left py-2 text-gray-400">
                        Completed (WebSocket)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">1m</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          candles_1m
                        </code>
                      </td>
                      <td>formingCandles</td>
                      <td className="text-gray-500">
                        N/A (saved every minute)
                      </td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">5m</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_5m
                        </code>
                      </td>
                      <td>formingCandles5m</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">15m</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_15m
                        </code>
                      </td>
                      <td>formingCandles15m</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">1h</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_1h
                        </code>
                      </td>
                      <td>formingCandles1h</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">4h</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_4h
                        </code>
                      </td>
                      <td>formingCandles4h</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">Daily</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_1d
                        </code>
                      </td>
                      <td>formingCandlesDaily</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">Weekly</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_1w
                        </code>
                      </td>
                      <td>formingCandlesWeekly</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-white">Monthly</td>
                      <td>
                        <code className="text-xs text-cyan-400">
                          historical_1M
                        </code>
                      </td>
                      <td>formingCandlesMonthly</td>
                      <td className="text-green-400">completedCandles</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">
                  Key Concept: Completed Candle Broadcast
                </h4>
                <p className="text-sm text-gray-300">
                  When a candle period ends (e.g., 12:05 for a 5m candle), the
                  server broadcasts the{" "}
                  <strong>authoritative completed candle</strong> to all
                  clients. Charts update this in their history using{" "}
                  <code className="text-cyan-400">setData()</code>, ensuring all
                  charts show identical historical data.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    {
      id: "market-data-streaming",
      title: "Price Streaming",
      icon: Radio,
      category: "Market Data",
      tags: ["websocket", "prices", "real-time", "streaming", "quotes"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              Real-Time Price Streaming
            </h2>
            <p className="text-gray-300 mb-4">
              How prices flow from Massive.com to your users' charts in
              real-time.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Step 1: Massive.com WebSocket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                The system connects to Massive.com's WebSocket server to receive
                live price quotes.
              </p>
              <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                <div>
                  <strong>Connection:</strong>{" "}
                  <code className="text-cyan-400">wss://massive.com/ws</code>
                </div>
                <div>
                  <strong>Message Type:</strong>{" "}
                  <code className="text-cyan-400">CA.*</code> (price quotes)
                </div>
                <div>
                  <strong>Frequency:</strong> ~50-200ms per symbol
                </div>
                <div>
                  <strong>Data:</strong> symbol, bid, ask, timestamp
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Step 2: Price Streamer Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                The{" "}
                <code className="text-cyan-400">
                  websocket-price-streamer.ts
                </code>{" "}
                service processes each price tick:
              </p>
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    On Each Price Tick (O(1) Operations):
                  </div>
                  <ul className="space-y-1 text-gray-300">
                    <li>✓ Update forming 1m candle cache</li>
                    <li>✓ Update forming 5m candle cache</li>
                    <li>✓ Update forming 15m candle cache</li>
                    <li>✓ Update forming 30m candle cache</li>
                    <li>✓ Update forming 1h candle cache</li>
                    <li>✓ Update forming 4h candle cache</li>
                    <li>✓ Update forming Daily candle cache</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Server className="h-5 w-5" />
                Step 3: WebSocket Server Broadcast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                The WebSocket server (Port 3003) broadcasts to all connected
                browsers:
              </p>
              <div className="bg-gray-900 p-3 rounded text-sm font-mono">
                <div className="text-gray-400 mb-2">
                  // Broadcast payload (price_update event)
                </div>
                <div className="text-cyan-400">{"{"}</div>
                <div className="ml-4 text-green-400">
                  type: &apos;price_update&apos;,
                </div>
                <div className="ml-4 text-green-400">
                  prices: [...],{" "}
                  <span className="text-gray-500">// Current bid/ask</span>
                </div>
                <div className="ml-4 text-green-400">
                  formingCandles: [...],{" "}
                  <span className="text-gray-500">// 1m forming</span>
                </div>
                <div className="ml-4 text-green-400">
                  formingCandles5m: [...],{" "}
                  <span className="text-gray-500">// 5m forming</span>
                </div>
                <div className="ml-4 text-green-400">
                  formingCandles15m: [...],{" "}
                  <span className="text-gray-500">// 15m forming</span>
                </div>
                <div className="ml-4 text-green-400">
                  formingCandles1h: [...],{" "}
                  <span className="text-gray-500">// 1h forming</span>
                </div>
                <div className="ml-4 text-green-400">
                  formingCandles4h: [...],{" "}
                  <span className="text-gray-500">// 4h forming</span>
                </div>
                <div className="ml-4 text-green-400">
                  formingCandlesDaily: [...],{" "}
                  <span className="text-gray-500">// Daily forming</span>
                </div>
                <div className="ml-4 text-yellow-400 font-bold">
                  completedCandles: [...],{" "}
                  <span className="text-gray-500">
                    // ✨ NEW: Authoritative completed candles
                  </span>
                </div>
                <div className="text-cyan-400">{"}"}</div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded p-3 text-sm mt-3">
                <strong className="text-green-400">completedCandles</strong>{" "}
                contains finalized historical candles that are sent once when a
                period ends. Clients use these to update their historical data
                with the authoritative OHLC values.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Performance Optimizations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">
                    Delta Broadcasting
                  </div>
                  <p className="text-xs">
                    Only sends data for symbols that changed
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">
                    Client Subscription
                  </div>
                  <p className="text-xs">
                    Each client only receives symbols they subscribed to
                  </p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                  <div className="font-medium text-purple-400 mb-1">
                    Skip Empty Broadcasts
                  </div>
                  <p className="text-xs">
                    No broadcast if zero clients connected
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1">
                    Cache Stringify
                  </div>
                  <p className="text-xs">
                    JSON stringified once for all unsubscribed clients
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    {
      id: "market-data-candles",
      title: "Candle Building",
      icon: BarChart3,
      category: "Market Data",
      tags: ["candles", "ohlc", "aggregation", "timeframes", "building"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              How Candles Are Built
            </h2>
            <p className="text-gray-300 mb-4">
              Understanding how OHLC candles are constructed from raw price
              data.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                1-Minute Candle Building
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                1-minute candles are the foundation. All other timeframes are
                built from them.
              </p>
              <div className="bg-gray-900 p-4 rounded space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded text-sm font-medium">
                    Price Tick
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">
                    Update forming candle's high/low/close
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-sm font-medium">
                    Minute Ends
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">
                    Save candle to MongoDB, start new candle
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-medium text-white mb-2">
                  Candle Structure (OHLCV):
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-green-400">O</strong>pen: First
                    price of the period
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-green-400">H</strong>igh: Highest
                    price of the period
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-green-400">L</strong>ow: Lowest
                    price of the period
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-green-400">C</strong>lose: Last
                    price of the period
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Higher Timeframe Aggregation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                5m, 15m, 30m, 1h, and 4h candles are aggregated from 1-minute
                data:
              </p>
              <div className="bg-gray-900 p-4 rounded text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      5-Minute Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      Combines 5 × 1m candles
                    </div>
                    <div className="text-xs mt-1">
                      Period: 0, 5, 10, 15... minutes
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      15-Minute Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      Combines 15 × 1m candles
                    </div>
                    <div className="text-xs mt-1">
                      Period: 0, 15, 30, 45 minutes
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      30-Minute Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      Combines 30 × 1m candles
                    </div>
                    <div className="text-xs mt-1">Period: 0, 30 minutes</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      1-Hour Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      Combines 60 × 1m candles
                    </div>
                    <div className="text-xs mt-1">
                      Period: Start of each hour
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      4-Hour Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      Combines 240 × 1m candles
                    </div>
                    <div className="text-xs mt-1">
                      Period: 0, 4, 8, 12, 16, 20 hours
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      Daily Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      From historical_1d or API
                    </div>
                    <div className="text-xs mt-1">Period: UTC midnight</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      Weekly Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      From historical_1w or API
                    </div>
                    <div className="text-xs mt-1">Period: Monday 00:00 UTC</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">
                      Monthly Candle
                    </div>
                    <div className="text-xs text-gray-400">
                      From historical_1M or API
                    </div>
                    <div className="text-xs mt-1">
                      Period: 1st day 00:00 UTC
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Forming Candles (Real-Time)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                &quot;Forming&quot; candles are candles currently being built.
                They update on every price tick.
              </p>
              <div className="bg-gray-900 p-3 rounded text-sm space-y-2">
                <div className="font-medium text-white">
                  Cache Update Logic (O(1) per tick):
                </div>
                <div className="font-mono text-xs text-gray-400 space-y-1">
                  <div>
                    currentPeriod = floor(now / periodSeconds) * periodSeconds
                  </div>
                  <div>if (same period):</div>
                  <div className="ml-4">
                    cache.high = max(cache.high, price)
                  </div>
                  <div className="ml-4">cache.low = min(cache.low, price)</div>
                  <div className="ml-4">cache.close = price</div>
                  <div>else:</div>
                  <div className="ml-4">
                    cache ={" "}
                    {"{ open: price, high: price, low: price, close: price }"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Completed Candles (Period End)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                When a candle period ends, the server finalizes and broadcasts
                the <strong>completed candle</strong>.
              </p>
              <div className="bg-gray-900 p-3 rounded text-sm space-y-2">
                <div className="font-medium text-white">Period End Flow:</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                      1
                    </span>
                    <span>Fetch 1m candles for the period from MongoDB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                      2
                    </span>
                    <span>
                      Augment OHLC with 1m data (ensures accuracy after restart)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                      3
                    </span>
                    <span>
                      Save to historical collection (e.g.,
                      candles_historical_5m)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                      4
                    </span>
                    <span>Broadcast to all clients via completedCandles</span>
                  </div>
                </div>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded p-3 text-sm">
                <strong className="text-green-400">Why Augment?</strong> If the
                server restarts mid-period, the forming candle cache is lost.
                Augmenting with 1m data ensures the saved candle contains the
                full period&apos;s OHLC, not just post-restart data.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400 flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Frontend Processing Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                The browser chart processes WebSocket updates in a specific
                order to prevent data conflicts:
              </p>
              <div className="bg-gray-900 p-3 rounded text-sm space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                    FIRST
                  </span>
                  <div>
                    <div className="font-medium text-green-400">
                      Process completedCandles
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Update local candleDataRef → Call setData() to refresh
                      entire chart. This uses setData() because update() cannot
                      modify historical candles.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                    SECOND
                  </span>
                  <div>
                    <div className="font-medium text-blue-400">
                      Process formingCandles
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Skip if timestamp matches a just-completed candle
                      (prevents overwrite). Otherwise, call update() to update
                      the latest candle on the chart.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
                <strong className="text-yellow-400">Note:</strong> This order
                prevents the forming candle from overwriting the authoritative
                completed candle data.
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    {
      id: "market-data-historical",
      title: "Historical Data",
      icon: HardDrive,
      category: "Market Data",
      tags: ["historical", "download", "history", "storage", "years"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              Historical Data Management
            </h2>
            <p className="text-gray-300 mb-4">
              Download and store years of historical candle data for complete
              chart history.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Download className="h-5 w-5" />
                Downloading Historical Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                In Admin Panel → Dev Zone → Market Data Settings, use the
                "Download Higher Timeframe History" section.
              </p>
              <div className="space-y-3">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Step 1: Select Timeframes
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">1m</Badge>
                    <Badge variant="outline">5m</Badge>
                    <Badge variant="outline">15m</Badge>
                    <Badge variant="outline">30m</Badge>
                    <Badge variant="outline">1h</Badge>
                    <Badge variant="outline">4h</Badge>
                    <Badge variant="outline">1d</Badge>
                    <Badge variant="outline">1w</Badge>
                    <Badge variant="outline">1M</Badge>
                  </div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Step 2: Set Years Back
                  </div>
                  <p className="text-xs text-gray-400">
                    Choose how many years of history to download (1-10 years)
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Step 3: Click Download
                  </div>
                  <p className="text-xs text-gray-400">
                    System fetches from Massive.com API and saves to MongoDB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Incremental Downloads
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                The system intelligently handles repeated downloads:
              </p>
              <div className="space-y-2 text-sm">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">
                    ✓ Incremental Fetching
                  </div>
                  <p className="text-xs">
                    Checks oldest existing candle and downloads backward from
                    that point
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">
                    ✓ No Duplicates
                  </div>
                  <p className="text-xs">
                    Uses unique index on (symbol + timestamp) to prevent
                    duplicate data
                  </p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                  <div className="font-medium text-purple-400 mb-1">
                    ✓ Batch Processing
                  </div>
                  <p className="text-xs">
                    Data is saved in batches of 1,000 candles to avoid timeouts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Storage Estimates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">
                        Timeframe
                      </th>
                      <th className="text-left py-2 text-gray-400">
                        Candles/Year
                      </th>
                      <th className="text-left py-2 text-gray-400">
                        ~Size/Symbol/Year
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-800">
                      <td className="py-2">1m</td>
                      <td>~525,600</td>
                      <td>~50 MB</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2">5m</td>
                      <td>~105,120</td>
                      <td>~10 MB</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2">15m</td>
                      <td>~35,040</td>
                      <td>~3 MB</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2">1h</td>
                      <td>~8,760</td>
                      <td>~1 MB</td>
                    </tr>
                    <tr>
                      <td className="py-2">Daily</td>
                      <td>~260</td>
                      <td>~25 KB</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  Recommendation
                </h4>
                <p className="text-sm text-gray-300">
                  Download 5m, 15m, 1h, 4h, and 1d history for complete chart
                  coverage. 1m history is optional due to large size - recent 1m
                  data is auto-collected in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    {
      id: "market-data-settings",
      title: "Market Data Settings",
      icon: Settings,
      category: "Market Data",
      tags: ["settings", "configuration", "lazy loading", "limits"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              Market Data Settings
            </h2>
            <p className="text-gray-300 mb-4">
              Configure chart behavior, loading, and data retention in Admin →
              Dev Zone → Market Data Settings.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Historical Data Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      Use Local History
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Toggle
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Charts load from downloaded historical collections
                    first. When OFF: Always fetch from Massive.com API.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      Auto Fetch History
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Toggle
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Automatically download missing historical data in
                    background. When OFF: Only use existing local data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Chart Display Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      Initial Candle Count
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Number
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    How many candles to load initially when chart opens.
                    Default: 500. Lower = faster initial load. Higher = more
                    history visible immediately.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      Lazy Load Batch Size
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Number
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    How many candles to load when user scrolls left. Default:
                    500. Charts implement lazy loading - more data loads on
                    demand.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      Chart History Limit
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Toggle + Days
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Limit how far back charts can scroll (e.g., 365
                    days). When OFF: Load all available history (may be slow
                    with years of data).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Price Update Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Update Mode</span>
                    <Badge variant="outline" className="text-xs">
                      WebSocket / Polling
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    <strong>WebSocket:</strong> Real-time updates via persistent
                    connection. Recommended.
                    <br />
                    <strong>Polling:</strong> Regular HTTP requests. Fallback if
                    WebSocket fails.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">
                      WebSocket Interval
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Milliseconds
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    Broadcast frequency to clients. Default: 50ms. Lower = more
                    responsive but more CPU. Higher = less load but slower
                    updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    {
      id: "market-data-maintenance",
      title: "Data Maintenance",
      icon: Trash2,
      category: "Market Data",
      tags: ["cleanup", "maintenance", "retention", "storage", "delete"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              Data Maintenance & Cleanup
            </h2>
            <p className="text-gray-300 mb-4">
              Manage database size by cleaning old candle data while preserving
              consistent history.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Cleanup Old Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                In Admin → Dev Zone → Market Data Settings, use the "Cleanup Old
                Data" section.
              </p>

              <div className="space-y-3">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Cleanup Type
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400">
                        Delete Oldest
                      </Badge>
                      <span className="text-gray-400">
                        Remove X days starting from the oldest data
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500/20 text-orange-400">
                        Keep Recent
                      </Badge>
                      <span className="text-gray-400">
                        Keep only the last X days, delete everything older
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Include Historical
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Also cleans{" "}
                    <code className="text-cyan-400">candles_historical_*</code>{" "}
                    collections.
                    <br />
                    When OFF: Only cleans{" "}
                    <code className="text-cyan-400">candles_1m</code> real-time
                    data.
                  </p>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">
                    Days to Process
                  </div>
                  <p className="text-xs text-gray-400">
                    Number of days to delete (Delete Oldest) or keep (Keep
                    Recent).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Cleanup Examples
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-3 text-sm">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">
                    Example 1: Delete Oldest 30 Days
                  </div>
                  <p className="text-xs">
                    If you have data from Jan 1 to Dec 31, this deletes Jan 1 -
                    Jan 30. Useful for trimming old data monthly.
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1">
                    Example 2: Keep Recent 365 Days
                  </div>
                  <p className="text-xs">
                    Keeps only the last year of data, deletes everything older.
                    Useful for maintaining a fixed database size.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Affected Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded text-xs">
                  <strong>Always cleaned:</strong> candles_1m
                </div>
                <div className="bg-gray-900 p-2 rounded text-xs">
                  <strong>If Include Historical ON:</strong>
                </div>
                <div className="col-span-2 grid grid-cols-4 gap-1 text-xs">
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_1m
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_5m
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_15m
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_30m
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_1h
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_4h
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_1d
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_1w
                  </code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">
                    historical_1M
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  Important
                </h4>
                <p className="text-sm text-gray-300">
                  Cleanup is permanent. Deleted candles cannot be recovered. You
                  can re-download historical data from Massive.com if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },

    {
      id: "market-data-troubleshooting",
      title: "Troubleshooting",
      icon: AlertTriangle,
      category: "Market Data",
      tags: ["troubleshooting", "issues", "problems", "debug", "errors"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">
              Market Data Troubleshooting
            </h2>
            <p className="text-gray-300 mb-4">
              Common issues and solutions for chart and price data problems.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Charts Not Loading
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    ❓ Symptom: Chart shows spinner forever
                  </div>
                  <div className="text-gray-400 mt-2">
                    <strong>Check:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>
                        • WebSocket server running? (pm2 status
                        chartvolt-websocket)
                      </li>
                      <li>• MongoDB connected? (Check server logs)</li>
                      <li>
                        • API returning data? (Browser DevTools → Network)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Candle Differences Between Charts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    ❓ Symptom: Same candle shows different OHLC on two charts
                  </div>
                  <div className="text-gray-400 mt-2">
                    <strong>Fixed by Unified Pipeline:</strong> This issue is
                    now resolved. All charts receive
                    <span className="text-green-400">
                      {" "}
                      completedCandles{" "}
                    </span>{" "}
                    broadcasts when periods end.
                    <ul className="mt-2 space-y-1">
                      <li>
                        ✅ If you see different candles,{" "}
                        <strong>refresh the page</strong> to fetch authoritative
                        data
                      </li>
                      <li>✅ New charts auto-sync via WebSocket broadcasts</li>
                      <li>
                        ✅ No need for manual action - system self-corrects
                      </li>
                    </ul>
                    <strong className="block mt-2 text-yellow-400">
                      If issue persists:
                    </strong>
                    <ul className="mt-1 space-y-1">
                      <li>
                        • Check browser console for WebSocket connection errors
                      </li>
                      <li>
                        • Verify chartvolt-websocket is running:{" "}
                        <code className="text-cyan-400">pm2 status</code>
                      </li>
                      <li>
                        • Check server logs for completed candle broadcast
                        errors
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Price Delays Between Charts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    ❓ Symptom: One chart updates before another
                  </div>
                  <div className="text-gray-400 mt-2">
                    <strong>Causes:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>
                        • Different WebSocket connections have slight timing
                        differences
                      </li>
                      <li>
                        • Browser tab throttling (inactive tabs may update
                        slower)
                      </li>
                    </ul>
                    <strong className="block mt-2">Solution:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>
                        • This is normal - differences should be &lt;100ms
                      </li>
                      <li>
                        • Keep charts in same browser window for best sync
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Missing Historical Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    ❓ Symptom: Charts only show recent data
                  </div>
                  <div className="text-gray-400 mt-2">
                    <strong>Fix:</strong>
                    <ol className="mt-1 space-y-1">
                      <li>1. Go to Admin → Dev Zone → Market Data Settings</li>
                      <li>
                        2. Download historical data for desired timeframes
                      </li>
                      <li>3. Enable "Use Local History" toggle</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Forming Candle Disappears
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    ❓ Symptom: Current candle briefly shows then disappears
                  </div>
                  <div className="text-gray-400 mt-2">
                    <strong>Possible Causes:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• WebSocket disconnected and reconnecting</li>
                      <li>• Server restarted and caches are being rebuilt</li>
                      <li>
                        • Historical 1m data not yet seeded for current period
                      </li>
                    </ul>
                    <strong className="block mt-2">Fix:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>
                        1. Verify chartvolt-web is running:{" "}
                        <code className="text-cyan-400">pm2 status</code>
                      </li>
                      <li>
                        2. Check server logs for &quot;Seeding higher timeframe
                        caches&quot; message
                      </li>
                      <li>
                        3. Wait 1-2 minutes after server restart for caches to
                        warm
                      </li>
                      <li>4. Refresh the chart page</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Database Growing Too Large
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    ❓ Symptom: MongoDB storage filling up
                  </div>
                  <div className="text-gray-400 mt-2">
                    <strong>Fix:</strong>
                    <ol className="mt-1 space-y-1">
                      <li>1. Use "Cleanup Old Data" with "Keep Recent" mode</li>
                      <li>2. Set reasonable retention (e.g., 365 days)</li>
                      <li>
                        3. Enable "Include Historical" to clean all collections
                      </li>
                      <li>4. Schedule monthly cleanup</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">
                Server Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <p>Check Admin → Dev Zone → Server Monitor for live stats:</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-900 p-2 rounded">
                  <strong>CPU Usage:</strong> Should be &lt;70%
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Memory:</strong> Should have headroom
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>WS Connections:</strong> Number of clients
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>DB Storage:</strong> Monitor growth
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== USER MANAGEMENT ====================
    {
      id: "user-management",
      title: "Managing Users",
      icon: Users,
      category: "Users",
      tags: ["users", "accounts", "credit", "suspend", "ban"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">
              User Management
            </h2>
            <p className="text-gray-300 mb-4">
              Comprehensive tools for managing user accounts, balances, and
              permissions.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                User Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Credit User
                  </div>
                  <p className="text-xs">
                    Add or remove credits from wallet. Use for: refunds,
                    bonuses, corrections
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1 flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Edit User
                  </div>
                  <p className="text-xs">
                    Update name, email, or other profile information
                  </p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Suspend User
                  </div>
                  <p className="text-xs">
                    Temporarily block from competitions. Can be reversed.
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="font-medium text-red-400 mb-1 flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    Ban User
                  </div>
                  <p className="text-xs">
                    Permanently block from platform. For confirmed fraud.
                  </p>
                </div>
              </div>

              <div className="bg-red-500/20 border border-red-500/40 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-400">
                    Delete User
                  </span>
                </div>
                <p className="text-sm">
                  <strong>PERMANENT ACTION!</strong> Removes user and ALL data
                  (wallet, trades, competitions). Only use for: GDPR requests,
                  confirmed fraud, duplicate accounts.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-3">
                Click any user to view their complete profile:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>• Email and registration date</div>
                <div>• Wallet balance and history</div>
                <div>• Competition participations</div>
                <div>• Win/loss record</div>
                <div>• Trading statistics</div>
                <div>• Badges and achievements</div>
                <div>• Device fingerprints</div>
                <div>• Fraud risk score</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== FINANCIAL DASHBOARD ====================
    {
      id: "financial-dashboard",
      title: "Financial Dashboard",
      icon: PieChart,
      category: "Financial",
      tags: ["financial", "revenue", "fees", "balance", "overview"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">
              Financial Dashboard
            </h2>
            <p className="text-gray-300 mb-4">
              Complete overview of platform finances, revenue, and liabilities.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="text-blue-400 font-semibold mb-1">
                    💰 What We HAVE
                  </div>
                  <p className="text-xs">
                    Total deposits - bank fees = Money in bank account
                  </p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="text-red-400 font-semibold mb-1">
                    📊 What We OWE
                  </div>
                  <p className="text-xs">
                    User balances + unpaid prizes + pending withdrawals
                  </p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="text-green-400 font-semibold mb-1">
                    ✅ NET POSITION
                  </div>
                  <p className="text-xs">
                    HAVE - OWE = Platform's actual money
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Platform Earnings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Total Earned (All Time)
                  </div>
                  <p className="text-xs text-gray-400">
                    All platform fees collected from competitions
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Already Withdrawn
                  </div>
                  <p className="text-xs text-gray-400">
                    Amount admin has withdrawn to bank
                  </p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 p-3 rounded">
                  <div className="font-medium text-green-400 mb-1">
                    Available to Withdraw
                  </div>
                  <p className="text-xs">
                    Total Earned - Already Withdrawn = Your profit to withdraw
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Dashboard Tabs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Overview:</strong> Key metrics and charts
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Transactions:</strong> All transaction history with
                  filters
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Invoices:</strong> Download user invoices (ZIP/CSV)
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>VAT:</strong> VAT collected and payment history
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== PAYMENTS ====================
    {
      id: "payments",
      title: "Payment Processing",
      icon: CreditCard,
      category: "Financial",
      tags: ["payments", "stripe", "deposits", "withdrawals"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">
              Payment Processing
            </h2>
            <p className="text-gray-300 mb-4">
              Manage payment providers, process transactions, and handle
              withdrawals.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Payment Providers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <div className="font-medium text-blue-400 mb-2">
                  Stripe (Built-in)
                </div>
                <div className="text-sm space-y-1">
                  <div>• Credit/debit cards, Apple Pay, Google Pay</div>
                  <div>• Automatic webhook processing</div>
                  <div>• PCI compliant - no card data on your server</div>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                <div className="font-medium text-purple-400 mb-2">
                  Custom Providers
                </div>
                <div className="text-sm">
                  Add any payment provider with custom credentials. Configure
                  processing fees per provider.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Manual Payment Completion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">For pending payments without webhooks:</p>
              <ol className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    1
                  </span>
                  <span>Go to Payments tab, find pending transaction</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    2
                  </span>
                  <span>Verify payment in Stripe dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    3
                  </span>
                  <span>Click "Complete Payment" to credit user's wallet</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Withdrawals
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-3">
                Admin can withdraw platform earnings:
              </p>
              <ul className="text-sm space-y-1">
                <li>• View "Available to Withdraw" in Financial Dashboard</li>
                <li>• Click "Withdraw" button</li>
                <li>• Enter amount and confirm with admin password</li>
                <li>• Transaction is recorded in audit log</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== NOTIFICATIONS ====================
    {
      id: "notifications",
      title: "Notification System",
      icon: Bell,
      category: "Settings",
      tags: ["notifications", "alerts", "messages", "templates"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-orange-400 mb-3">
              Notification System
            </h2>
            <p className="text-gray-300 mb-4">
              Configure and manage all user notifications from one place.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">
                Notification Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-green-400">💳 Purchase:</strong>{" "}
                  Deposits, withdrawals, refunds
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-yellow-400">🏆 Competition:</strong>{" "}
                  Joined, started, ended, won
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-blue-400">📊 Trading:</strong> Orders,
                  positions, margin alerts
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-purple-400">🏅 Achievement:</strong>{" "}
                  Badges, level ups
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-red-400">🔒 Security:</strong> Login
                  alerts, password changes
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-cyan-400">⚙️ System:</strong>{" "}
                  Maintenance, updates
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">
                Managing Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <ul className="text-sm space-y-2">
                <li>
                  • <strong>Enable/Disable:</strong> Toggle individual
                  notification types
                </li>
                <li>
                  • <strong>Edit Content:</strong> Customize title, message,
                  icon
                </li>
                <li>
                  • <strong>Set Priority:</strong> Normal, High, Urgent
                </li>
                <li>
                  • <strong>Preview:</strong> See how notification appears to
                  users
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">
                Sending Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">
                    Send to All Users
                  </div>
                  <p className="text-xs">
                    Platform announcements, maintenance notices, updates
                  </p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">
                    Send to Individual User
                  </div>
                  <p className="text-xs">
                    Personal messages, support responses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== EMAIL TEMPLATES ====================
    {
      id: "email-templates",
      title: "Email Templates",
      icon: Mail,
      category: "Settings",
      tags: ["email", "templates", "welcome", "customize"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Email Templates
            </h2>
            <p className="text-gray-300 mb-4">
              Customize all emails sent to users from your platform.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Available Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Welcome Email
                  </div>
                  <p className="text-xs text-gray-400">
                    Sent when user registers. Configure heading, intro text,
                    features list, CTA button.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Invoice Email
                  </div>
                  <p className="text-xs text-gray-400">
                    Sent with purchase receipts. Includes legal disclaimer from
                    invoice settings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Customization Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <ul className="text-sm space-y-1">
                <li>
                  • <strong>Subject Line:</strong> Email subject
                </li>
                <li>
                  • <strong>Heading:</strong> Main title in email body
                </li>
                <li>
                  • <strong>Intro Text:</strong> Welcome message/description
                </li>
                <li>
                  • <strong>Feature Items:</strong> Bullet points highlighting
                  features
                </li>
                <li>
                  • <strong>CTA Button:</strong> Call-to-action button text and
                  URL
                </li>
                <li>
                  • <strong>Footer:</strong> Company address and links
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                AI Personalization
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-2">
                Enable AI to generate personalized email content for each user
                based on:
              </p>
              <ul className="text-sm space-y-1">
                <li>• User's name and registration context</li>
                <li>• Platform features and current competitions</li>
                <li>• Custom prompt you provide</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== INVOICE SETTINGS ====================
    {
      id: "invoice-settings",
      title: "Invoice Settings",
      icon: Receipt,
      category: "Settings",
      tags: ["invoice", "receipt", "template", "legal", "pdf"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-400 mb-3">
              Invoice Settings
            </h2>
            <p className="text-gray-300 mb-4">
              Configure invoice appearance, branding, and legal information.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-blue-400">
                Invoice Tabs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Branding</div>
                  <p className="text-xs text-gray-400">
                    Logo, company name, tagline, colors
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Template</div>
                  <p className="text-xs text-gray-400">
                    Invoice number format, date format, header/footer text
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Legal</div>
                  <p className="text-xs text-gray-400">
                    Legal disclaimer text shown on all invoices and emails
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-blue-400">
                Legal Disclaimer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">Add a legal disclaimer that appears on:</p>
              <ul className="text-sm space-y-1">
                <li>• PDF invoices (footer section)</li>
                <li>• Invoice emails (below invoice details)</li>
              </ul>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
                <strong>Example:</strong> "All transactions are final. This is a
                digital product..."
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== COMPANY SETTINGS ====================
    {
      id: "company-settings",
      title: "Company Settings",
      icon: Building,
      category: "Settings",
      tags: ["company", "business", "address", "tax"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">
              Company Settings
            </h2>
            <p className="text-gray-300 mb-4">
              Configure your business information for invoices and legal
              compliance.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Company Name:</strong> Legal business name
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>VAT Number:</strong> Tax registration ID
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Registration Number:</strong> Business registration
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Email:</strong> Business contact email
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Phone:</strong> Business phone number
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Website:</strong> Company website URL
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">Address</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-2">
                Full business address shown on invoices:
              </p>
              <ul className="text-sm space-y-1">
                <li>• Address Line 1 & 2</li>
                <li>• City, Postal Code</li>
                <li>• Country</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== AUDIT LOGS ====================
    {
      id: "audit-logs",
      title: "Audit Logs",
      icon: FileCheck,
      category: "System",
      tags: ["audit", "logs", "history", "security", "tracking"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-indigo-400 mb-3">
              Audit Logs
            </h2>
            <p className="text-gray-300 mb-4">
              Track all admin actions for security and compliance.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-400">
                What Gets Logged
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  Admin login/logout
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  User credit adjustments
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  User suspensions/bans
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  Competition creation
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  Payment completions
                </div>
                <div className="bg-gray-900 p-2 rounded">Settings changes</div>
                <div className="bg-gray-900 p-2 rounded">
                  Database operations
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  Fraud investigations
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-400">
                Log Details
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-2">Each log entry includes:</p>
              <ul className="text-sm space-y-1">
                <li>
                  • <strong>Timestamp:</strong> When action occurred
                </li>
                <li>
                  • <strong>Admin:</strong> Who performed the action
                </li>
                <li>
                  • <strong>Action:</strong> What was done
                </li>
                <li>
                  • <strong>Target:</strong> User/competition affected
                </li>
                <li>
                  • <strong>Changes:</strong> Before/after values
                </li>
                <li>
                  • <strong>IP Address:</strong> Source of request
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-400">
                Filtering & Export
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <ul className="text-sm space-y-1">
                <li>• Filter by date range</li>
                <li>• Filter by action type</li>
                <li>• Search by admin or user</li>
                <li>• Export to CSV for reporting</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== DATABASE MANAGEMENT ====================
    {
      id: "database",
      title: "Database Management",
      icon: Database,
      category: "System",
      tags: ["database", "reset", "backup", "recovery"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Database Management
            </h2>
            <p className="text-gray-300 mb-4">
              Critical database operations for maintenance and recovery.
            </p>
          </div>

          <div className="bg-red-500/20 border-red-500/50 border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-bold text-red-400">⚠️ DANGER ZONE</h3>
            </div>
            <p className="text-gray-300 text-sm">
              These operations can permanently delete data. Always require admin
              password.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Database Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
                  <div className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Check Database Status
                  </div>
                  <p className="text-sm text-gray-300">
                    View record counts and connection health. ✅ Safe - read
                    only
                  </p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                  <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Finalize Competitions
                  </div>
                  <p className="text-sm text-gray-300">
                    Close ended competitions, distribute prizes. ⚠️ Use after
                    competitions naturally end
                  </p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-4">
                  <div className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Recover Stats
                  </div>
                  <p className="text-sm text-gray-300">
                    Recalculate all statistics. ⚠️ Use if stats appear incorrect
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                  <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Reset All Data
                  </div>
                  <div className="text-sm text-gray-300">
                    <p className="mb-2">
                      <strong>DELETES:</strong>
                    </p>
                    <ul className="space-y-1 ml-4">
                      <li>• All competitions and participants</li>
                      <li>• All trading positions and history</li>
                      <li>• All wallet balances and transactions</li>
                      <li>• All invoices and audit logs</li>
                      <li>• All notifications</li>
                    </ul>
                    <p className="mt-2">
                      <strong>PRESERVES:</strong> Users, Admin credentials,
                      Settings
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== GAME MASTER ====================
    {
      id: "gamemaster-overview",
      title: "Game Master System",
      icon: Trophy,
      category: "Game Master",
      tags: ["gamemaster", "referral", "affiliate", "subscription", "earnings"],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-purple-400 mb-3 flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              Game Master System Overview
            </h2>
            <p className="text-gray-300 leading-relaxed">
              The Game Master System allows users to become referral partners.
              They purchase a Game Master package, receive a unique referral
              link, and earn a percentage of entry fees from users they refer
              who participate in competitions and challenges.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded">
                      1
                    </span>
                    <h4 className="font-semibold text-white">
                      User Purchases Package
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    User buys a Game Master package from the Marketplace using
                    credits.
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded">
                      2
                    </span>
                    <h4 className="font-semibold text-white">
                      Activate Subscription
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    User activates the package in their Arsenal, receives unique
                    referral code.
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded">
                      3
                    </span>
                    <h4 className="font-semibold text-white">
                      Share Referral Link
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Game Master shares their link: yoursite.com/sign-up?ref=CODE
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded">
                      4
                    </span>
                    <h4 className="font-semibold text-white">
                      Earn Commissions
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    When referred users join competitions, Game Master earns %
                    of their entry fees.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Available Packages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <h4 className="font-bold text-white mb-2">Starter</h4>
                  <p className="text-yellow-400 font-bold">299 Credits</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• 1 competition/day</li>
                    <li>• 30 max users</li>
                    <li>• 5% referral fee</li>
                    <li>• 30 day duration</li>
                  </ul>
                </div>
                <div className="bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
                  <h4 className="font-bold text-purple-400 mb-2">Pro ⭐</h4>
                  <p className="text-yellow-400 font-bold">599 Credits</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• 3 competitions/day</li>
                    <li>• 75 max users</li>
                    <li>• 7.5% referral fee</li>
                    <li>• 30 day duration</li>
                  </ul>
                </div>
                <div className="bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/30">
                  <h4 className="font-bold text-yellow-400 mb-2">Elite ⭐</h4>
                  <p className="text-yellow-400 font-bold">999 Credits</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• 10 competitions/day</li>
                    <li>• 150 max users</li>
                    <li>• 10% referral fee</li>
                    <li>• 30 day duration</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  Key Points
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>
                    • Subscriptions auto-renew if enabled and user has
                    sufficient credits
                  </li>
                  <li>
                    • Referral link persists permanently - all users signed up
                    via link are tracked
                  </li>
                  <li>
                    • Earnings are credited immediately when competitions
                    finalize
                  </li>
                  <li>
                    • Game Masters can create their own competitions (within
                    daily limits)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "gamemaster-management",
      title: "Managing Game Masters",
      icon: UserCog,
      category: "Game Master",
      tags: ["gamemaster", "management", "admin", "revoke", "earnings"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Managing Game Masters
            </h2>
            <p className="text-gray-300 mb-4">
              As a Super Admin, you have full control over the Game Master
              system including viewing all Game Masters, their referrals,
              earnings, and the ability to revoke their status.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Game Master Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                Access via:{" "}
                <code className="bg-gray-900 px-2 py-1 rounded">
                  Admin Panel → Game Master Management
                </code>
              </p>
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <strong className="text-white">View All Game Masters:</strong>
                  <p className="text-gray-400 mt-1">
                    See all active, expired, and cancelled subscriptions with
                    stats.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <strong className="text-white">Referral Details:</strong>
                  <p className="text-gray-400 mt-1">
                    View which users were referred by each Game Master.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <strong className="text-white">Earnings History:</strong>
                  <p className="text-gray-400 mt-1">
                    Complete breakdown of all earnings, by
                    competition/challenge.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <strong className="text-white">Competition Created:</strong>
                  <p className="text-gray-400 mt-1">
                    Track how many competitions each Game Master has created.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400 flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Revoking Game Master Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                You may need to revoke Game Master status if:
              </p>
              <ul className="text-sm space-y-1">
                <li>• User violates terms of service</li>
                <li>• Suspicious referral activity detected</li>
                <li>• User requests cancellation</li>
              </ul>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-3">
                <p className="text-sm text-red-400">
                  <strong>Warning:</strong> Revoking status is irreversible. The
                  user would need to purchase a new package. Existing referred
                  users remain linked, but no new earnings will be generated.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Financial Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                Game Master earnings are tracked in the Financial Dashboard:
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                <div className="bg-green-500/10 border border-green-500/30 p-3 rounded">
                  <strong className="text-green-400">Total GM Earnings</strong>
                  <p className="text-gray-400 text-xs mt-1">
                    Sum of all referral fees paid to Game Masters
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded">
                  <strong className="text-blue-400">
                    Subscription Revenue
                  </strong>
                  <p className="text-gray-400 text-xs mt-1">
                    Revenue from Game Master package purchases
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "gamemaster-api",
      title: "Game Master API",
      icon: Code,
      category: "Game Master",
      tags: ["gamemaster", "api", "endpoints", "integration"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Game Master API Endpoints
            </h2>
            <p className="text-gray-300 mb-4">
              Technical reference for Game Master API endpoints.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                User Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-green-400">
                  POST /api/gamemaster/activate
                </div>
                <p className="text-gray-400 mt-1">
                  Activate a purchased Game Master package
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-blue-400">GET /api/gamemaster/status</div>
                <p className="text-gray-400 mt-1">
                  Get current subscription status
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-yellow-400">
                  POST /api/gamemaster/toggle-renewal
                </div>
                <p className="text-gray-400 mt-1">Toggle auto-renewal on/off</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Game Master Dashboard Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-green-400">
                  GET /api/gamemaster/dashboard
                </div>
                <p className="text-gray-400 mt-1">Get dashboard statistics</p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-blue-400">
                  GET /api/gamemaster/referrals
                </div>
                <p className="text-gray-400 mt-1">List all referred users</p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-yellow-400">
                  GET /api/gamemaster/earnings
                </div>
                <p className="text-gray-400 mt-1">Get earnings history</p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-cyan-400">GET /api/gamemaster/link</div>
                <p className="text-gray-400 mt-1">Get referral link</p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-orange-400">
                  POST /api/gamemaster/competitions
                </div>
                <p className="text-gray-400 mt-1">
                  Create a competition (within limits)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Admin Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-green-400">GET /api/gamemasters</div>
                <p className="text-gray-400 mt-1">
                  List all Game Masters (paginated)
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-blue-400">GET /api/gamemasters/:id</div>
                <p className="text-gray-400 mt-1">Get Game Master details</p>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono">
                <div className="text-red-400">
                  POST /api/gamemasters/:id/revoke
                </div>
                <p className="text-gray-400 mt-1">Revoke Game Master status</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== ADMIN CREDENTIALS ====================
    {
      id: "admin-credentials",
      title: "Admin Credentials",
      icon: Key,
      category: "System",
      tags: ["admin", "password", "security", "login"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-3">
              Admin Credentials
            </h2>
            <p className="text-gray-300 mb-4">
              Manage admin login credentials securely.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                Changing Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <ol className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    1
                  </span>
                  <span>Go to Settings → Admin Credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    2
                  </span>
                  <span>Enter new username and/or password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    3
                  </span>
                  <span>Confirm with current password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    4
                  </span>
                  <span>Re-login with new credentials</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/20 border-yellow-500/40">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400 flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Security Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <ul className="text-sm space-y-1">
                <li>• Use a strong, unique password (12+ characters)</li>
                <li>• Change password regularly (every 90 days)</li>
                <li>• Don't share admin credentials</li>
                <li>• Always logout when finished</li>
                <li>• Check audit logs for unauthorized access</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== PLATFORM SETTINGS ====================
    {
      id: "platform-settings",
      title: "Platform Settings",
      icon: Settings,
      category: "Settings",
      tags: ["settings", "branding", "currency", "whitelabel"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Platform Settings
            </h2>
            <p className="text-gray-300 mb-4">
              Customize your platform's appearance and behavior.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                White Label Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Platform Name:</strong> Displayed in header, emails
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Logo:</strong> Header logo (200x50px recommended)
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Favicon:</strong> Browser tab icon
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Theme:</strong> Color scheme customization
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Currency Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="text-sm space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <strong>Display Currency:</strong> EUR (€), USD ($), GBP (£)
                  <p className="text-xs text-gray-400 mt-1">
                    Affects how prices are shown to users
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <strong>Credit Name:</strong> Custom name for credits (e.g.,
                  "Volts")
                  <p className="text-xs text-gray-400 mt-1">
                    With custom symbol and decimal places
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Trading Risk Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="text-sm space-y-2">
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Default Leverage:</strong> Maximum leverage allowed
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Margin Call:</strong> % level to warn users
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Liquidation:</strong> % level to auto-close positions
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Max Positions:</strong> Concurrent open trades limit
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== FEE SETTINGS ====================
    {
      id: "fee-settings",
      title: "Fee Settings",
      icon: DollarSign,
      category: "Financial",
      tags: ["fees", "vat", "platform fee", "processing"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">
              Fee Settings
            </h2>
            <p className="text-gray-300 mb-4">
              Configure platform fees, VAT, and processing charges.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Fee Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Platform Fee
                  </div>
                  <p className="text-xs text-gray-400">
                    Percentage taken from competition prize pools (e.g., 10%)
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">VAT Rate</div>
                  <p className="text-xs text-gray-400">
                    Value Added Tax applied to purchases (e.g., 19%)
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Processing Fee
                  </div>
                  <p className="text-xs text-gray-400">
                    Payment provider fee passed to users (e.g., 2.9%)
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Withdrawal Fee
                  </div>
                  <p className="text-xs text-gray-400">
                    Fee for credit withdrawals (fixed or percentage)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                VAT Management
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-2">VAT is automatically:</p>
              <ul className="text-sm space-y-1">
                <li>• Calculated on each purchase</li>
                <li>• Shown to user before payment</li>
                <li>• Tracked separately in Financial Dashboard</li>
                <li>• Available for payment/reporting</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },

    // ==================== PRICE MONITORING & OPERATIONS ====================
    {
      id: "price-monitoring-overview",
      title: "Price Monitoring Overview",
      icon: HeartPulse,
      category: "Operations",
      tags: ["price", "monitoring", "health", "websocket", "alerts"],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-green-400 mb-3 flex items-center gap-2">
              <HeartPulse className="h-6 w-6" />
              Price Monitoring System
            </h2>
            <p className="text-gray-300 leading-relaxed">
              The Price Health Monitor continuously tracks the health of all
              price feeds in real-time. It detects issues like stale prices,
              anomalies, and connection problems to ensure fair pricing during
              competitions.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="h-4 w-4 text-green-400" />
                    <h4 className="font-semibold text-white">
                      WebSocket Connection
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Receives real-time price updates from Massive.com API via
                    WebSocket.
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <HeartPulse className="h-4 w-4 text-cyan-400" />
                    <h4 className="font-semibold text-white">Health Checks</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Runs every 5 seconds to check for stale prices and
                    anomalies.
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-4 w-4 text-yellow-400" />
                    <h4 className="font-semibold text-white">Alert System</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Triggers alerts when issues are detected (with 60s
                    cooldown).
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="h-4 w-4 text-purple-400" />
                    <h4 className="font-semibold text-white">
                      Price Snapshots
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Periodic snapshots stored for risk mitigation and emergency
                    recovery.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Health Status Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-400">Healthy</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Prices are fresh (updated within last 30 seconds), no
                  anomalies detected.
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium text-yellow-400">Degraded</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Price is stale (30-60 seconds old) OR anomaly detected (sudden
                  large price change).
                </p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-400">Critical</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Price is critically stale (60+ seconds old) or using fallback
                  data.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Configuration Defaults
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-cyan-400 font-medium">
                    Stale Threshold
                  </div>
                  <div className="text-gray-300">30 seconds</div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-cyan-400 font-medium">
                    Critical Threshold
                  </div>
                  <div className="text-gray-300">60 seconds</div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-cyan-400 font-medium">
                    Anomaly Threshold
                  </div>
                  <div className="text-gray-300">1% sudden change</div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-cyan-400 font-medium">
                    Alert Cooldown
                  </div>
                  <div className="text-gray-300">60 seconds</div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-cyan-400 font-medium">
                    Health Check Interval
                  </div>
                  <div className="text-gray-300">5 seconds</div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="text-cyan-400 font-medium">
                    Max Reconnect Attempts
                  </div>
                  <div className="text-gray-300">10 (then alerts admin)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "price-health-alerts",
      title: "Price Health Alerts",
      icon: Bell,
      category: "Operations",
      tags: ["alerts", "notifications", "price", "health", "acknowledge"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-3">
              Price Health Alerts
            </h2>
            <p className="text-gray-300 mb-4">
              The system generates alerts when price feed issues are detected.
              Understanding and managing these alerts is critical for
              maintaining fair competitions.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Alert Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  connection_lost
                </div>
                <p className="text-sm text-gray-300">
                  WebSocket connection to price feed lost. System will attempt
                  reconnection.
                </p>
                <p className="text-xs text-gray-500 mt-1">Severity: Error</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded p-4">
                <div className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  connection_restored
                </div>
                <p className="text-sm text-gray-300">
                  WebSocket connection successfully restored after disconnect.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Severity: Warning (informational)
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  price_stale
                </div>
                <p className="text-sm text-gray-300">
                  A specific symbol&apos;s price hasn&apos;t updated for 60+
                  seconds.
                </p>
                <p className="text-xs text-gray-500 mt-1">Severity: Error</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded p-4">
                <div className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  price_anomaly
                </div>
                <p className="text-sm text-gray-300">
                  Sudden large price movement detected (1%+ change in less than
                  1 second).
                </p>
                <p className="text-xs text-gray-500 mt-1">Severity: Warning</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  max_reconnect_reached
                </div>
                <p className="text-sm text-gray-300">
                  Maximum reconnection attempts (10) exhausted. Manual
                  intervention required!
                </p>
                <p className="text-xs text-gray-500 mt-1">Severity: Critical</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4" />
                  critical_health
                </div>
                <p className="text-sm text-gray-300">
                  Overall price feed health is critical - multiple symbols are
                  stale.
                </p>
                <p className="text-xs text-gray-500 mt-1">Severity: Critical</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Managing Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  How to Acknowledge Alerts
                </h4>
                <ol className="text-sm space-y-2">
                  <li>
                    1. Go to <strong>Operations → General</strong> in the admin
                    panel
                  </li>
                  <li>
                    2. View the <strong>Price Health</strong> section
                  </li>
                  <li>3. Click on unacknowledged alerts to acknowledge them</li>
                  <li>
                    4. Acknowledged alerts are logged with your admin ID and
                    timestamp
                  </li>
                </ol>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <p className="text-sm">
                    Alerts are stored in the database for audit purposes. The
                    system keeps the last 100 alerts in memory.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "symbol-management",
      title: "Symbol Management",
      icon: CandlestickChart,
      category: "Operations",
      tags: ["symbols", "forex", "enable", "disable", "pairs", "trading"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Symbol Management
            </h2>
            <p className="text-gray-300 mb-4">
              Control which forex pairs are available for trading. Only enabled
              symbols are monitored for price health and available to users in
              competitions.
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">
                  Important: Enabled vs Disabled Symbols
                </h4>
                <p className="text-sm text-gray-300">
                  When you disable a symbol, it will no longer be monitored by
                  the Price Health Monitor. This prevents false alerts for
                  symbols you don&apos;t want to offer. The change takes effect
                  immediately.
                </p>
              </div>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                How to Enable/Disable Symbols
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Individual Symbol Toggle
                </h4>
                <ol className="text-sm space-y-1">
                  <li>
                    1. Go to <strong>Admin → Symbols</strong>
                  </li>
                  <li>2. Find the symbol you want to change</li>
                  <li>
                    3. Toggle the <strong>Enabled</strong> switch
                  </li>
                  <li>4. The change is saved automatically</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">
                  Bulk Enable/Disable
                </h4>
                <ol className="text-sm space-y-1">
                  <li>
                    1. Go to <strong>Admin → Symbols</strong>
                  </li>
                  <li>2. Filter by category (Major, Cross, Exotic, Custom)</li>
                  <li>
                    3. Use <strong>Enable All</strong> or{" "}
                    <strong>Disable All</strong> buttons
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Available Symbol Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">
                    Major Pairs
                  </div>
                  <p className="text-xs text-gray-400">
                    EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD,
                    NZD/USD
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">
                    Cross Pairs
                  </div>
                  <p className="text-xs text-gray-400">
                    EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, CAD/JPY, and more
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1">
                    Exotic Pairs
                  </div>
                  <p className="text-xs text-gray-400">
                    USD/MXN, USD/ZAR, USD/TRY, USD/SEK, USD/NOK
                  </p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                  <div className="font-medium text-purple-400 mb-1">Custom</div>
                  <p className="text-xs text-gray-400">
                    Admin-added custom symbols (can be deleted)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Symbol Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Pip Value</div>
                  <p className="text-xs text-gray-400">
                    0.0001 for most pairs, 0.01 for JPY pairs
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Contract Size
                  </div>
                  <p className="text-xs text-gray-400">
                    Standard lot = 100,000 units
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Lot Size Limits
                  </div>
                  <p className="text-xs text-gray-400">
                    Min: 0.01, Max: 100, Step: 0.01
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Default Spread
                  </div>
                  <p className="text-xs text-gray-400">
                    Used when fixed spread mode is enabled
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">
                    Popular Flag
                  </div>
                  <p className="text-xs text-gray-400">
                    Shows in &quot;Popular&quot; section in market watch
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "price-snapshots",
      title: "Price Snapshots",
      icon: Camera,
      category: "Operations",
      tags: ["snapshots", "backup", "recovery", "prices", "finalization"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">
              Price Snapshots
            </h2>
            <p className="text-gray-300 mb-4">
              Price Snapshots are periodic captures of all forex prices during
              active competitions. They provide a safety net for emergency
              competition finalization if live prices become compromised.
            </p>
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-400 mb-1">
                  Automatic Cleanup
                </h4>
                <p className="text-sm text-gray-300">
                  Price snapshots are automatically deleted after{" "}
                  <strong>7 days</strong> using a MongoDB TTL index. You
                  don&apos;t need to manually clear them - the database handles
                  cleanup automatically.
                </p>
              </div>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Snapshot Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <div className="font-medium text-blue-400 mb-1">auto</div>
                <p className="text-xs text-gray-400">
                  Automatically created on a schedule during active competitions
                </p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                <div className="font-medium text-purple-400 mb-1">manual</div>
                <p className="text-xs text-gray-400">
                  Created by admin manually via the Operations panel
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                <div className="font-medium text-yellow-400 mb-1">alert</div>
                <p className="text-xs text-gray-400">
                  Automatically created when a critical health alert is
                  triggered
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Snapshot Data
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-3">Each snapshot stores:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">Timestamp</div>
                <div className="bg-gray-900 p-2 rounded">
                  Competition ID (if any)
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  All symbol prices (bid/ask/mid)
                </div>
                <div className="bg-gray-900 p-2 rounded">Spread values</div>
                <div className="bg-gray-900 p-2 rounded">
                  Price source (websocket/api/cache)
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  Health status at time
                </div>
                <div className="bg-gray-900 p-2 rounded">Connection status</div>
                <div className="bg-gray-900 p-2 rounded">
                  Stale duration for each symbol
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Emergency Finalization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                If live prices are compromised during competition finalization,
                you can use a healthy snapshot instead:
              </p>
              <ol className="text-sm space-y-2">
                <li>
                  1. Go to{" "}
                  <strong>Competitions → [Competition] → Finalize</strong>
                </li>
                <li>
                  2. If current prices show issues, click{" "}
                  <strong>Use Snapshot Prices</strong>
                </li>
                <li>
                  3. Select a snapshot from the list (sorted by health status)
                </li>
                <li>
                  4. The system will use those prices for final P&L calculations
                </li>
              </ol>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 mt-4">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <p className="text-sm">
                    Always prefer the most recent <strong>healthy</strong>{" "}
                    snapshot when using emergency finalization.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "operations-general",
      title: "Operations General Panel",
      icon: Activity,
      category: "Operations",
      tags: ["operations", "general", "monitoring", "dashboard", "status"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">
              Operations General Panel
            </h2>
            <p className="text-gray-300 mb-4">
              The Operations → General panel provides a real-time overview of
              all system operations, including price health monitoring, symbol
              status, and system diagnostics.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Panel Sections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded p-4">
                <div className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4" />
                  Price Health Status
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Overall health status (Healthy/Degraded/Critical)</li>
                  <li>• Connection status and reconnect attempts</li>
                  <li>• Count of healthy, degraded, and critical symbols</li>
                  <li>• Per-symbol health details (expandable)</li>
                </ul>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
                <div className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <CandlestickChart className="h-4 w-4" />
                  Symbol Status Grid
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Real-time prices for each enabled symbol</li>
                  <li>• Last update timestamp</li>
                  <li>• Price source (websocket/api/cache/fallback)</li>
                  <li>• Stale duration indicator</li>
                </ul>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Recent Alerts
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Last 20 price health alerts</li>
                  <li>• Alert type, severity, and timestamp</li>
                  <li>• Acknowledge/dismiss functionality</li>
                  <li>• Filter by acknowledged status</li>
                </ul>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-4">
                <div className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Snapshot Service Status
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Whether snapshot service is running</li>
                  <li>• Last snapshot timestamp</li>
                  <li>• Total snapshot count</li>
                  <li>• Manual snapshot trigger button</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Common Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-medium text-white mb-1">
                  Refresh Health Status
                </div>
                <p className="text-xs text-gray-400">
                  Click the refresh button to manually fetch latest health data
                  from the main app.
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-medium text-white mb-1">
                  Take Manual Snapshot
                </div>
                <p className="text-xs text-gray-400">
                  Creates an immediate price snapshot for backup purposes.
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-medium text-white mb-1">
                  Acknowledge All Alerts
                </div>
                <p className="text-xs text-gray-400">
                  Marks all current alerts as acknowledged (logged in audit).
                </p>
              </div>
              <div className="bg-gray-900 p-3 rounded">
                <div className="font-medium text-white mb-1">
                  Refresh Enabled Symbols
                </div>
                <p className="text-xs text-gray-400">
                  Forces the price monitor to reload which symbols to track
                  (after enabling/disabling symbols).
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-400 mb-1">
                  Connection Refused Error?
                </h4>
                <p className="text-sm text-gray-300">
                  If you see &quot;ERR_CONNECTION_REFUSED&quot; errors for the
                  price-health endpoint, it means the main app (usually on port
                  3000) is not running or not reachable from the admin app. Make
                  sure the main Chartvolt application is running before
                  accessing Operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "operations-troubleshooting",
      title: "Operations Troubleshooting",
      icon: FileWarning,
      category: "Operations",
      tags: ["troubleshooting", "errors", "debug", "issues", "fix"],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-3">
              Operations Troubleshooting
            </h2>
            <p className="text-gray-300 mb-4">
              Common issues and their solutions for the Operations/Price
              Monitoring system.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                ERR_CONNECTION_REFUSED on price-health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                <strong>Cause:</strong> The admin app cannot reach the main
                app&apos;s internal API.
              </p>
              <div>
                <p className="text-sm font-medium text-white mb-2">
                  Solutions:
                </p>
                <ol className="text-sm space-y-1">
                  <li>
                    1. Ensure the main Chartvolt app is running (usually{" "}
                    <code className="bg-gray-900 px-1 rounded">
                      npm run dev
                    </code>{" "}
                    on port 3000)
                  </li>
                  <li>
                    2. Check{" "}
                    <code className="bg-gray-900 px-1 rounded">
                      NEXT_PUBLIC_APP_URL
                    </code>{" "}
                    is correctly set in admin .env
                  </li>
                  <li>
                    3. Verify{" "}
                    <code className="bg-gray-900 px-1 rounded">
                      INTERNAL_API_KEY
                    </code>{" "}
                    matches between both apps
                  </li>
                  <li>
                    4. Check firewall/network settings if apps are on different
                    machines
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                All Symbols Showing as Critical
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                <strong>Cause:</strong> Price feed WebSocket not connected or
                API key invalid.
              </p>
              <div>
                <p className="text-sm font-medium text-white mb-2">
                  Solutions:
                </p>
                <ol className="text-sm space-y-1">
                  <li>
                    1. Check{" "}
                    <code className="bg-gray-900 px-1 rounded">
                      MASSIVE_API_KEY
                    </code>{" "}
                    is set and valid
                  </li>
                  <li>2. Verify WebSocket connection in server logs</li>
                  <li>
                    3. Check if Massive.com API is accessible (not blocked)
                  </li>
                  <li>4. Wait 60 seconds for auto-reconnection to attempt</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">
                Disabled Symbols Still Being Monitored
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                <strong>Cause:</strong> Price health monitor hasn&apos;t
                refreshed its symbol list.
              </p>
              <div>
                <p className="text-sm font-medium text-white mb-2">Solution:</p>
                <p className="text-sm">
                  The system should auto-refresh when you enable/disable
                  symbols. If not:
                </p>
                <ol className="text-sm space-y-1">
                  <li>1. Go to Operations → General</li>
                  <li>2. Click &quot;Refresh Enabled Symbols&quot;</li>
                  <li>3. Or restart the main app to reload from database</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Mongoose Duplicate Index Warning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                <strong>Message:</strong> &quot;Duplicate schema index on{" "}
                {`{timestamp:1}`} found&quot;
              </p>
              <p className="text-sm">
                <strong>Status:</strong>{" "}
                <span className="text-green-400">Fixed in latest version</span>
              </p>
              <p className="text-sm">
                This warning was caused by declaring an index both in the schema
                field and via schema.index(). It has been resolved by removing
                the redundant index declaration.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Price Snapshots Not Being Created
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                <strong>Possible Causes:</strong>
              </p>
              <ol className="text-sm space-y-1">
                <li>
                  1. No active competitions (auto-snapshots only run during
                  competitions)
                </li>
                <li>2. Snapshot service not started</li>
                <li>3. Database connection issues</li>
              </ol>
              <div className="mt-3">
                <p className="text-sm font-medium text-white mb-2">
                  To verify:
                </p>
                <p className="text-sm">
                  Check Snapshot Service Status in Operations → General. If
                  stopped, restart the main app.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-400 mb-1">Debug Tip</h4>
                <p className="text-sm text-gray-300">
                  Check the server console logs for messages starting with 🏥
                  (health monitor), 🔌 (WebSocket), or 📸 (snapshots) for
                  detailed operation information.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "competition-finalization",
      title: "Competition Finalization & Price Validation",
      icon: Target,
      category: "Operations",
      tags: [
        "finalization",
        "competition",
        "prices",
        "validation",
        "correction",
      ],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-green-400 mb-3 flex items-center gap-2">
              <Target className="h-6 w-6" />
              Competition Finalization & Price Validation
            </h2>
            <p className="text-gray-300 leading-relaxed">
              When a competition ends, the system automatically validates all
              prices before calculating final results. This ensures fair
              outcomes even when price feeds have issues.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                The Finalization Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                    STEP 1
                  </span>
                  <h4 className="font-semibold text-white">
                    Price Validation Check
                  </h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  System calls{" "}
                  <code className="bg-gray-800 px-1 rounded">
                    arePricesSafeForFinalization(symbols)
                  </code>{" "}
                  to check each symbol:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                    <div className="text-red-400 font-medium">
                      Critical Staleness
                    </div>
                    <p className="text-xs text-gray-400">
                      Price not updated for 60+ seconds
                    </p>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2">
                    <div className="text-orange-400 font-medium">
                      Price Anomaly
                    </div>
                    <p className="text-xs text-gray-400">
                      Sudden spike detected (&gt;1% in &lt;1s)
                    </p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                    <div className="text-yellow-400 font-medium">
                      Fallback Prices
                    </div>
                    <p className="text-xs text-gray-400">
                      Using cached/fallback data, not live
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                    STEP 2
                  </span>
                  <h4 className="font-semibold text-white">Decision Point</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-green-400">
                        Prices SAFE
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Use live prices for P&L calculation
                    </p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-400">
                        Prices NOT SAFE
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Attempt to use backup snapshot
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">
                    STEP 3
                  </span>
                  <h4 className="font-semibold text-white">
                    Snapshot Fallback
                  </h4>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  If prices are not safe, system retrieves the last healthy
                  snapshot:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-purple-400 mt-0.5" />
                    <span className="text-gray-300">
                      Calls{" "}
                      <code className="bg-gray-800 px-1 rounded">
                        getLastHealthySnapshot(competitionId)
                      </code>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-purple-400 mt-0.5" />
                    <span className="text-gray-300">
                      Uses snapshot prices instead of live prices
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-purple-400 mt-0.5" />
                    <span className="text-gray-300">
                      Marks snapshot as used:{" "}
                      <code className="bg-gray-800 px-1 rounded">
                        competition.usedSnapshotId
                      </code>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-purple-400 mt-0.5" />
                    <span className="text-gray-300">
                      Logs which snapshot was used for audit trail
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                    STEP 4
                  </span>
                  <h4 className="font-semibold text-white">
                    Final Calculation
                  </h4>
                </div>
                <p className="text-sm text-gray-400">
                  Using either live or snapshot prices:
                </p>
                <ol className="text-sm text-gray-300 space-y-1 mt-2">
                  <li>1. Calculate final P&L for all participants</li>
                  <li>
                    2. Rank participants by selected metric (P&L, ROI, etc.)
                  </li>
                  <li>3. Apply tie-breaking rules if needed</li>
                  <li>4. Distribute prizes to winners</li>
                  <li>5. Mark competition as COMPLETED</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">
                Visual Flow Diagram
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                <pre className="text-gray-300">{`Competition Ends
       │
       ▼
┌──────────────────────┐
│ Validate All Prices  │
│ arePricesSafe()      │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────────┐
│ SAFE ✓  │ │ NOT SAFE ✗  │
│         │ │             │
│ Use     │ │ Get Last    │
│ Live    │ │ Healthy     │
│ Prices  │ │ Snapshot    │
└────┬────┘ └──────┬──────┘
     │             │
     │       ┌─────┴─────┐
     │       │           │
     │       ▼           ▼
     │  ┌─────────┐ ┌─────────────┐
     │  │Snapshot │ │ No Snapshot │
     │  │ Found   │ │ Available   │
     │  │         │ │             │
     │  │ Use     │ │ Log         │
     │  │ Snapshot│ │ INCIDENT    │
     │  │ Prices  │ │             │
     │  └────┬────┘ └──────┬──────┘
     │       │             │
     └───────┼─────────────┘
             │
             ▼
    ┌─────────────────┐
    │ Calculate P&L   │
    │ Rank Users      │
    │ Distribute $$   │
    │ Mark COMPLETED  │
    └─────────────────┘`}</pre>
              </div>
            </CardContent>
          </Card>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">
                  Key Point
                </h4>
                <p className="text-sm text-gray-300">
                  The system{" "}
                  <strong>
                    never finalizes a competition with invalid prices
                  </strong>{" "}
                  without either using a backup snapshot or flagging it as an
                  incident for admin review. This protects users from unfair
                  results.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "incident-management",
      title: "Incident Management",
      icon: ShieldAlert,
      category: "Operations",
      tags: ["incident", "compensation", "resolution", "issue", "recovery"],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-red-400 mb-3 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" />
              Incident Management
            </h2>
            <p className="text-gray-300 leading-relaxed">
              When a serious issue occurs (e.g., no healthy snapshot available
              during finalization), the system automatically creates an Incident
              for admin review and resolution.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">
                When Incidents Are Created
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  price_feed_failure
                </div>
                <p className="text-sm text-gray-300 mb-2">Created when:</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Competition finalization detects unsafe prices</li>
                  <li>• AND no healthy snapshot is available to use</li>
                  <li>
                    • Competition proceeds with current prices (flagged for
                    review)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">
                Incident Data Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                <pre className="text-gray-300">{`{
  type: "price_feed_failure",
  severity: "critical",
  status: "open",              // open → investigating → resolved → closed
  
  // What was affected
  relatedCompetitionId: "comp_123",
  affectedUsers: ["user_1", "user_2", ...],
  
  // Evidence for investigation
  evidence: {
    healthIssues: [
      { symbol: "EUR/USD", issue: "Critically stale (65s)" },
      { symbol: "GBP/USD", issue: "Using fallback prices" }
    ],
    snapshotId: null,          // No snapshot was available
    pricesUsed: "current",     // Had to use current prices
    timestamp: "2024-01-15T14:30:00Z"
  },
  
  // Resolution tracking
  resolution: {
    actionTaken: "",           // Admin fills this
    compensationIssued: false,
    compensationAmount: 0,
    resultsAdjusted: false,
    resolvedBy: "",
    resolvedAt: null,
    notes: ""
  }
}`}</pre>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">
                Admin Resolution Process
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      1
                    </span>
                    <h4 className="font-semibold text-white">
                      View Incident in Dashboard
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Navigate to <strong>Operations → Incidents</strong> to see
                    all open incidents. Critical incidents are highlighted in
                    red and should be addressed first.
                  </p>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      2
                    </span>
                    <h4 className="font-semibold text-white">
                      Review Evidence
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    Click on the incident to see detailed evidence:
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Which symbols had issues and why</li>
                    <li>• What prices were used for finalization</li>
                    <li>• List of affected users</li>
                    <li>• Timestamp when it occurred</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      3
                    </span>
                    <h4 className="font-semibold text-white">
                      Decide on Compensation
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    Based on the evidence, decide if compensation is needed:
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                      <div className="text-green-400 text-sm font-medium">
                        No Compensation Needed
                      </div>
                      <p className="text-xs text-gray-400">
                        Prices were only slightly stale, results are fair
                      </p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                      <div className="text-yellow-400 text-sm font-medium">
                        Partial Compensation
                      </div>
                      <p className="text-xs text-gray-400">
                        Refund entry fees to affected users
                      </p>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2">
                      <div className="text-orange-400 text-sm font-medium">
                        Full Compensation
                      </div>
                      <p className="text-xs text-gray-400">
                        Refund all participants, void results
                      </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                      <div className="text-red-400 text-sm font-medium">
                        Results Adjustment
                      </div>
                      <p className="text-xs text-gray-400">
                        Recalculate with corrected prices
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      4
                    </span>
                    <h4 className="font-semibold text-white">
                      Issue Compensation (if needed)
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    If compensation is needed:
                  </p>
                  <ol className="text-sm text-gray-400 space-y-1">
                    <li>
                      1. Go to <strong>Users</strong> section
                    </li>
                    <li>2. Select affected users</li>
                    <li>
                      3. Use <strong>Add Credits</strong> to compensate
                    </li>
                    <li>4. Note the incident ID in the transaction reason</li>
                  </ol>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-blue-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      5
                    </span>
                    <h4 className="font-semibold text-white">
                      Close Incident with Notes
                    </h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    Update the incident record with resolution details:
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>
                      • Change status to <strong>resolved</strong> or{" "}
                      <strong>closed</strong>
                    </li>
                    <li>• Document what action was taken</li>
                    <li>• Record compensation amount (if any)</li>
                    <li>• Add notes explaining your decision</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">
                Incident Status Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                <div className="flex items-center gap-2 min-w-max">
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-2 text-center">
                    <div className="text-red-400 font-bold">OPEN</div>
                    <div className="text-xs text-gray-400">New incident</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-4 py-2 text-center">
                    <div className="text-yellow-400 font-bold">
                      INVESTIGATING
                    </div>
                    <div className="text-xs text-gray-400">Admin reviewing</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg px-4 py-2 text-center">
                    <div className="text-blue-400 font-bold">RESOLVED</div>
                    <div className="text-xs text-gray-400">Action taken</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2 text-center">
                    <div className="text-green-400 font-bold">CLOSED</div>
                    <div className="text-xs text-gray-400">Documented</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-3">
                All incident-related actions are logged for compliance:
              </p>
              <ul className="text-sm space-y-1">
                <li>
                  • <strong>Incident creation:</strong> Timestamp, trigger
                  event, affected competition
                </li>
                <li>
                  • <strong>Status changes:</strong> Who changed it, when, from
                  what to what
                </li>
                <li>
                  • <strong>Compensation:</strong> Amount, affected users,
                  transaction IDs
                </li>
                <li>
                  • <strong>Resolution:</strong> Decision made, justification,
                  admin who resolved
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-400 mb-1">
                  Best Practices
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Respond to critical incidents within 24 hours</li>
                  <li>
                    • Always document your reasoning in the resolution notes
                  </li>
                  <li>
                    • Communicate with affected users if compensation is issued
                  </li>
                  <li>
                    • Review incident patterns monthly to prevent recurring
                    issues
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const categories = Array.from(new Set(topics.map((t) => t.category)));

  const filteredTopics = topics.filter(
    (topic) =>
      searchQuery === "" ||
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      ) ||
      topic.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedTopicData = topics.find((t) => t.id === selectedTopic);

  return (
    <div className="h-full flex gap-6">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <Card className="bg-gray-800 border-gray-700 h-full">
          <CardHeader>
            <CardTitle className="text-xl text-gray-100 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Admin Wiki
            </CardTitle>
            <CardDescription>Complete platform documentation</CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-900 border-gray-700 text-gray-100"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[calc(100vh-280px)] overflow-y-auto">
              <div className="space-y-1 p-4">
                {categories.map((category) => {
                  const categoryTopics = filteredTopics.filter(
                    (t) => t.category === category,
                  );
                  if (categoryTopics.length === 0) return null;

                  return (
                    <div key={category} className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        {category}
                      </div>
                      {categoryTopics.map((topic) => {
                        const Icon = topic.icon;
                        return (
                          <button
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedTopic === topic.id
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "text-gray-300 hover:bg-gray-700/50"
                            }`}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm font-medium">
                              {topic.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Card className="bg-gray-800 border-gray-700 h-full">
          <CardHeader className="border-b border-gray-700">
            {selectedTopicData && (
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl">
                  {selectedTopicData.icon && (
                    <selectedTopicData.icon className="h-6 w-6 text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl text-gray-100 mb-2">
                    {selectedTopicData.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedTopicData.category}
                    </Badge>
                    {selectedTopicData.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[calc(100vh-240px)] overflow-y-auto pr-4">
              <div>
                {selectedTopicData ? (
                  selectedTopicData.content
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">
                      Select a topic to view documentation
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
