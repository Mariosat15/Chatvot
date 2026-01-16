'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Search, Trophy, Users, DollarSign, Shield, Settings, 
  BarChart3, CreditCard, Database, AlertTriangle, Zap, Target,
  CheckCircle, XCircle, Info, Lightbulb, Code, FileText, TrendingUp,
  Lock, Unlock, Eye, EyeOff, Globe, Cpu, Server, Activity,
  Bell, Mail, FileCheck, Receipt, Clock, Building, Key, RefreshCw,
  UserCog, Ban, Wallet, PieChart, Download, Filter, Calendar,
  Radio, Wifi, HardDrive, ArrowDown, ArrowRight, Layers, Timer,
  Trash2, Play, Pause, RefreshCcw, LineChart, CandlestickChart
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('overview');

  const topics: WikiTopic[] = [
    // ==================== GETTING STARTED ====================
    {
      id: 'overview',
      title: 'Admin Panel Overview',
      icon: BookOpen,
      category: 'Getting Started',
      tags: ['introduction', 'overview', 'basics', 'dashboard'],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-blue-400 mb-3 flex items-center gap-2">
              <Zap className="h-6 w-6" />
              Welcome to Your Admin Panel
            </h2>
            <p className="text-gray-300 leading-relaxed">
              This comprehensive control center gives you complete power over your trading competition platform. 
              From creating competitions to detecting fraud, managing payments to analyzing performance - everything is here.
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
                Create, manage, and monitor trading competitions. Set prizes, rules, minimum participants, entry fees, and track live standings.
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
                Manage user accounts, credit balances, view trading stats, suspend, ban, or edit users.
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
                Monitor revenue, platform fees, user balances, VAT, withdrawals, and complete financial overview.
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
                Configure fraud detection, review alerts, investigate suspicious activity, and protect your platform.
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
                Manage notification templates, send instant notifications, and configure user communication.
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
                Configure platform branding, company info, invoice templates, email templates, and more.
              </CardContent>
            </Card>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">Quick Tips</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Use the sidebar to navigate between sections</li>
                  <li>• All actions are logged in the Audit Log</li>
                  <li>• Database reset preserves admin credentials and users</li>
                  <li>• Enable Inngest for automatic competition status updates</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // ==================== COMPETITIONS ====================
    {
      id: 'competitions-create',
      title: 'Creating Competitions',
      icon: Trophy,
      category: 'Competitions',
      tags: ['competition', 'create', 'setup', 'prizes', 'entry fee'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-3">Creating a New Competition</h2>
            <p className="text-gray-300 mb-4">
              Competitions are the heart of your platform. Follow this guide to create compelling, fair trading contests.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Step 1: Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">Competition Name</h4>
                <p className="text-sm mb-2">Choose an exciting, descriptive name:</p>
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
                  Write a compelling description explaining rules, prizes, and what makes this competition unique.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Step 2: Participants & Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-400 mb-2">Minimum Participants</h4>
                  <p className="text-sm">
                    Set the minimum number of participants required to start. If not met by start time:
                  </p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• Competition is <strong>automatically cancelled</strong></li>
                    <li>• All entry fees are <strong>fully refunded</strong></li>
                    <li>• Users receive a <strong>notification</strong></li>
                  </ul>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-green-400 mb-2">Maximum Participants</h4>
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
                <h4 className="font-semibold text-blue-400 mb-2">💡 Entry Fee & Starting Capital Ratio</h4>
                <div className="text-sm space-y-1">
                  <div>• Entry Fee: €10 → Starting Capital: €5,000 - €10,000</div>
                  <div>• Entry Fee: €50 → Starting Capital: €25,000 - €50,000</div>
                  <div>• Entry Fee: €100 → Starting Capital: €100,000+</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Step 3: Competition Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">Ranking Method</h4>
                <div className="space-y-2">
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="font-medium text-green-400">💰 P&L (Profit & Loss)</div>
                    <p className="text-sm mt-1">Winner has highest absolute profit. Best for: Aggressive traders, short competitions</p>
                  </div>
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="font-medium text-blue-400">📊 ROI% (Return on Investment)</div>
                    <p className="text-sm mt-1">Winner has highest percentage return. Best for: Fair play, skill-based</p>
                  </div>
                  <div className="bg-gray-900 p-3 rounded">
                    <div className="font-medium text-purple-400">💵 Total Capital</div>
                    <p className="text-sm mt-1">Winner has highest final balance. Best for: Conservative strategies</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Minimum Trades Requirement</h4>
                <p className="text-sm">
                  Set minimum trades required to qualify. Users who don't meet this at competition end are <strong>disqualified</strong> and their portion of the prize pool is redistributed.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Tie Breakers</h4>
                <p className="text-sm mb-2">Configure what happens when participants have identical scores:</p>
                <div className="text-sm space-y-1">
                  <div>• <strong>Tie Breaker 1:</strong> Trades count, Win rate, ROI, Join time</div>
                  <div>• <strong>Tie Breaker 2:</strong> Secondary criteria if first is also tied</div>
                  <div>• <strong>Split Prize:</strong> Divide prize equally among tied participants</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Step 4: Prize Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Winner-Takes-Most (80-15-5)</div>
                  <div className="text-sm">1st: 80% | 2nd: 15% | 3rd: 5%</div>
                  <div className="text-gray-500 text-xs mt-1">Best for: Small competitions (10-50 participants)</div>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Balanced (60-25-10-5)</div>
                  <div className="text-sm">1st: 60% | 2nd: 25% | 3rd: 10% | 4th: 5%</div>
                  <div className="text-gray-500 text-xs mt-1">Best for: Medium competitions (50-100 participants)</div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <h4 className="font-semibold text-yellow-400 mb-1">Platform Fee</h4>
                <p className="text-sm">
                  Set the platform fee percentage (e.g., 10%). This is deducted from the total prize pool before distribution.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-400 mb-1">Important: Minimum Participants</h4>
                <p className="text-sm text-gray-300">
                  If a competition doesn't meet minimum participants by start time, it will be <strong>automatically cancelled</strong> and all participants will receive a <strong>full refund</strong> including any platform fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },

    {
      id: 'competitions-manage',
      title: 'Managing Competitions',
      icon: Target,
      category: 'Competitions',
      tags: ['competition', 'manage', 'cancel', 'edit', 'view'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-3">Managing Active Competitions</h2>
            <p className="text-gray-300 mb-4">
              Monitor and manage your competitions throughout their lifecycle.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Competition Statuses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900 p-3 rounded border-l-4 border-gray-500">
                  <div className="font-medium text-gray-400">Draft</div>
                  <p className="text-xs mt-1">Not visible to users, still being configured</p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-blue-500">
                  <div className="font-medium text-blue-400">Upcoming</div>
                  <p className="text-xs mt-1">Visible, accepting registrations</p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-green-500">
                  <div className="font-medium text-green-400">Active</div>
                  <p className="text-xs mt-1">Currently running, trading live</p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-purple-500">
                  <div className="font-medium text-purple-400">Completed</div>
                  <p className="text-xs mt-1">Ended, prizes distributed</p>
                </div>
                <div className="bg-gray-900 p-3 rounded border-l-4 border-red-500 col-span-2">
                  <div className="font-medium text-red-400">🚫 Cancelled</div>
                  <p className="text-xs mt-1">Cancelled before start (min participants not met), all entry fees refunded</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Automatic Cancellation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                When a competition's start time arrives:
              </p>
              <div className="space-y-2">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">✅ If Minimum Participants Met</div>
                  <div className="text-sm">Competition starts normally → Status becomes "Active"</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="font-medium text-red-400 mb-1">🚫 If Below Minimum</div>
                  <div className="text-sm">Competition is cancelled → All participants receive full refund → Status becomes "Cancelled"</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-400">Viewing Competition Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">In the Competitions tab, click any competition to view:</p>
              <ul className="text-sm space-y-1">
                <li>• <strong>Participants:</strong> Full list with their current standings</li>
                <li>• <strong>Leaderboard:</strong> Real-time rankings with P&L, trades, win rate</li>
                <li>• <strong>Prize Pool:</strong> Current pool size and distribution breakdown</li>
                <li>• <strong>Settings:</strong> All competition rules and configuration</li>
                <li>• <strong>Trades:</strong> All trades made by participants</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== FRAUD DETECTION ====================
    {
      id: 'fraud-overview',
      title: 'Fraud Detection System',
      icon: Shield,
      category: 'Fraud Detection',
      tags: ['fraud', 'security', 'detection', 'vpn', 'cheating'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-3">Understanding Fraud Detection</h2>
            <p className="text-gray-300 mb-4">
              Our multi-layered fraud detection system protects your competitions from cheaters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gray-800 border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-400">Device Fingerprinting</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-300 space-y-1">
                  <p><strong>Detects:</strong> Multiple accounts from same device</p>
                  <p><strong>Accuracy:</strong> ~85%</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-orange-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-orange-400">VPN/Proxy Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-300 space-y-1">
                  <p><strong>Detects:</strong> VPNs, proxies, Tor</p>
                  <p><strong>Accuracy:</strong> 60-95%</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-yellow-400">Risk Scoring</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-300 space-y-1">
                  <p><strong>Range:</strong> 0-100 points</p>
                  <p><strong>Action:</strong> Auto-block at threshold</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Fraud Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">Entry Block Threshold</h4>
                <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Lenient (85):</span>
                    <span className="text-green-400">Few blocks, some fraud may pass</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balanced (70):</span>
                    <span className="text-yellow-400">Recommended default</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strict (50):</span>
                    <span className="text-red-400">Catches most fraud, some false positives</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Actions You Can Take</h4>
                <div className="text-sm space-y-2">
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-yellow-400">Investigate:</strong> Mark alert for review, gather more evidence
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-orange-400">Suspend:</strong> Temporarily block user from competitions
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-red-400">Ban:</strong> Permanently block user from platform
                  </div>
                  <div className="bg-gray-900 p-2 rounded">
                    <strong className="text-green-400">Dismiss:</strong> Mark as false positive, clear alert
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== MARKET DATA ====================
    {
      id: 'market-data-overview',
      title: 'Market Data Overview',
      icon: CandlestickChart,
      category: 'Market Data',
      tags: ['charts', 'prices', 'candles', 'architecture', 'system'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">Market Data System Architecture</h2>
            <p className="text-gray-300 mb-4">
              Complete overview of how real-time prices and candle data flow through the Chartvolt platform.
            </p>
          </div>

          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5" />
              System Flow Overview
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 px-3 py-2 rounded-lg text-blue-400 font-medium min-w-[140px]">Massive.com</div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">External price feed provider (WebSocket)</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/20 px-3 py-2 rounded-lg text-purple-400 font-medium min-w-[140px]">Price Streamer</div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">Receives quotes, builds candles, updates caches</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/20 px-3 py-2 rounded-lg text-orange-400 font-medium min-w-[140px]">WebSocket Server</div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">Broadcasts to connected browsers (Port 3003)</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-green-500/20 px-3 py-2 rounded-lg text-green-400 font-medium min-w-[140px]">Browser Charts</div>
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <div className="text-gray-300">Displays historical + real-time data</div>
              </div>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                <Database className="h-5 w-5" />
                MongoDB Collections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div>
                <h4 className="font-semibold text-white mb-2">Real-Time Collections (Auto-Built)</h4>
                <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <code className="text-cyan-400">candles_1m</code>
                    <span className="text-gray-400">1-minute candles (~30 days retention)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">Historical Collections (Downloaded)</h4>
                <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><code className="text-cyan-400">candles_historical_1m</code></div>
                    <div><code className="text-cyan-400">candles_historical_5m</code></div>
                    <div><code className="text-cyan-400">candles_historical_15m</code></div>
                    <div><code className="text-cyan-400">candles_historical_30m</code></div>
                    <div><code className="text-cyan-400">candles_historical_1h</code></div>
                    <div><code className="text-cyan-400">candles_historical_4h</code></div>
                    <div><code className="text-cyan-400">candles_historical_1d</code></div>
                    <div><code className="text-cyan-400">candles_historical_1w</code></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Timeframe Data Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">Timeframe</th>
                      <th className="text-left py-2 text-gray-400">Historical Data</th>
                      <th className="text-left py-2 text-gray-400">Forming Candle</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">1m</td>
                      <td><code className="text-xs text-cyan-400">candles_1m</code> + historical_1m</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">5m</td>
                      <td>Aggregated from 1m + historical_5m</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">15m</td>
                      <td>Aggregated from 1m + historical_15m</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">30m</td>
                      <td>Aggregated from 1m + historical_30m</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">1h</td>
                      <td>Aggregated from 1m + historical_1h</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">4h</td>
                      <td>Aggregated from 1m + historical_4h</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr className="border-b border-gray-800">
                      <td className="py-2 font-medium text-white">Daily</td>
                      <td><code className="text-xs text-cyan-400">historical_1d</code> or Massive.com API</td>
                      <td>WebSocket cache (live)</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-white">Weekly</td>
                      <td><code className="text-xs text-cyan-400">historical_1w</code> or Massive.com API</td>
                      <td>WebSocket cache (live)</td>
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
                <h4 className="font-semibold text-blue-400 mb-1">Key Concept: Hybrid Data Loading</h4>
                <p className="text-sm text-gray-300">
                  Charts load data from multiple sources: <strong>Recent data</strong> is aggregated from 1-minute candles in real-time. 
                  <strong>Older data</strong> comes from pre-downloaded historical collections. This ensures fast chart loading with complete history.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },

    {
      id: 'market-data-streaming',
      title: 'Price Streaming',
      icon: Radio,
      category: 'Market Data',
      tags: ['websocket', 'prices', 'real-time', 'streaming', 'quotes'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">Real-Time Price Streaming</h2>
            <p className="text-gray-300 mb-4">
              How prices flow from Massive.com to your users' charts in real-time.
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
                The system connects to Massive.com's WebSocket server to receive live price quotes.
              </p>
              <div className="bg-gray-900 p-3 rounded space-y-2 text-sm">
                <div><strong>Connection:</strong> <code className="text-cyan-400">wss://massive.com/ws</code></div>
                <div><strong>Message Type:</strong> <code className="text-cyan-400">CA.*</code> (price quotes)</div>
                <div><strong>Frequency:</strong> ~50-200ms per symbol</div>
                <div><strong>Data:</strong> symbol, bid, ask, timestamp</div>
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
                The <code className="text-cyan-400">websocket-price-streamer.ts</code> service processes each price tick:
              </p>
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">On Each Price Tick (O(1) Operations):</div>
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
                The WebSocket server (Port 3003) broadcasts to all connected browsers:
              </p>
              <div className="bg-gray-900 p-3 rounded text-sm font-mono">
                <div className="text-gray-400 mb-2">// Broadcast payload</div>
                <div className="text-cyan-400">{'{'}</div>
                <div className="ml-4 text-green-400">type: 'prices',</div>
                <div className="ml-4 text-green-400">prices: [...],              <span className="text-gray-500">// Current bid/ask</span></div>
                <div className="ml-4 text-green-400">formingCandles: [...],      <span className="text-gray-500">// 1m forming</span></div>
                <div className="ml-4 text-green-400">formingCandles5m: [...],    <span className="text-gray-500">// 5m forming</span></div>
                <div className="ml-4 text-green-400">formingCandles15m: [...],   <span className="text-gray-500">// 15m forming</span></div>
                <div className="ml-4 text-green-400">formingCandles30m: [...],   <span className="text-gray-500">// 30m forming</span></div>
                <div className="ml-4 text-green-400">formingCandles1h: [...],    <span className="text-gray-500">// 1h forming</span></div>
                <div className="ml-4 text-green-400">formingCandles4h: [...],    <span className="text-gray-500">// 4h forming</span></div>
                <div className="ml-4 text-green-400">formingCandlesDaily: [...]  <span className="text-gray-500">// Daily forming</span></div>
                <div className="text-cyan-400">{'}'}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Performance Optimizations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">Delta Broadcasting</div>
                  <p className="text-xs">Only sends data for symbols that changed</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">Client Subscription</div>
                  <p className="text-xs">Each client only receives symbols they subscribed to</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                  <div className="font-medium text-purple-400 mb-1">Skip Empty Broadcasts</div>
                  <p className="text-xs">No broadcast if zero clients connected</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1">Cache Stringify</div>
                  <p className="text-xs">JSON stringified once for all unsubscribed clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    {
      id: 'market-data-candles',
      title: 'Candle Building',
      icon: BarChart3,
      category: 'Market Data',
      tags: ['candles', 'ohlc', 'aggregation', 'timeframes', 'building'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">How Candles Are Built</h2>
            <p className="text-gray-300 mb-4">
              Understanding how OHLC candles are constructed from raw price data.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">1-Minute Candle Building</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                1-minute candles are the foundation. All other timeframes are built from them.
              </p>
              <div className="bg-gray-900 p-4 rounded space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded text-sm font-medium">Price Tick</div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">Update forming candle's high/low/close</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded text-sm font-medium">Minute Ends</div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                  <div className="text-sm">Save candle to MongoDB, start new candle</div>
                </div>
              </div>

              <div className="text-sm">
                <div className="font-medium text-white mb-2">Candle Structure (OHLCV):</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-900 p-2 rounded"><strong className="text-green-400">O</strong>pen: First price of the period</div>
                  <div className="bg-gray-900 p-2 rounded"><strong className="text-green-400">H</strong>igh: Highest price of the period</div>
                  <div className="bg-gray-900 p-2 rounded"><strong className="text-green-400">L</strong>ow: Lowest price of the period</div>
                  <div className="bg-gray-900 p-2 rounded"><strong className="text-green-400">C</strong>lose: Last price of the period</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Higher Timeframe Aggregation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <p className="text-sm">
                5m, 15m, 30m, 1h, and 4h candles are aggregated from 1-minute data:
              </p>
              <div className="bg-gray-900 p-4 rounded text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">5-Minute Candle</div>
                    <div className="text-xs text-gray-400">Combines 5 × 1m candles</div>
                    <div className="text-xs mt-1">Period: 0, 5, 10, 15... minutes</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">15-Minute Candle</div>
                    <div className="text-xs text-gray-400">Combines 15 × 1m candles</div>
                    <div className="text-xs mt-1">Period: 0, 15, 30, 45 minutes</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">30-Minute Candle</div>
                    <div className="text-xs text-gray-400">Combines 30 × 1m candles</div>
                    <div className="text-xs mt-1">Period: 0, 30 minutes</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">1-Hour Candle</div>
                    <div className="text-xs text-gray-400">Combines 60 × 1m candles</div>
                    <div className="text-xs mt-1">Period: Start of each hour</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">4-Hour Candle</div>
                    <div className="text-xs text-gray-400">Combines 240 × 1m candles</div>
                    <div className="text-xs mt-1">Period: 0, 4, 8, 12, 16, 20 hours</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">Daily Candle</div>
                    <div className="text-xs text-gray-400">From historical_1d or API</div>
                    <div className="text-xs mt-1">Period: UTC midnight</div>
                  </div>
                  <div>
                    <div className="font-medium text-cyan-400 mb-2">Weekly Candle</div>
                    <div className="text-xs text-gray-400">From historical_1w or API</div>
                    <div className="text-xs mt-1">Period: Monday 00:00 UTC</div>
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
                "Forming" candles are candles currently being built. They update on every price tick.
              </p>
              <div className="bg-gray-900 p-3 rounded text-sm space-y-2">
                <div className="font-medium text-white">Cache Update Logic (O(1) per tick):</div>
                <div className="font-mono text-xs text-gray-400 space-y-1">
                  <div>currentPeriod = floor(now / periodSeconds) * periodSeconds</div>
                  <div>if (same period):</div>
                  <div className="ml-4">cache.high = max(cache.high, price)</div>
                  <div className="ml-4">cache.low = min(cache.low, price)</div>
                  <div className="ml-4">cache.close = price</div>
                  <div>else:</div>
                  <div className="ml-4">cache = {'{ open: price, high: price, low: price, close: price }'}</div>
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
                <strong className="text-yellow-400">Note:</strong> Forming candles are calculated server-side and broadcast to all clients.
                This ensures all users see the same candle data.
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    {
      id: 'market-data-historical',
      title: 'Historical Data',
      icon: HardDrive,
      category: 'Market Data',
      tags: ['historical', 'download', 'history', 'storage', 'years'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">Historical Data Management</h2>
            <p className="text-gray-300 mb-4">
              Download and store years of historical candle data for complete chart history.
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
                In Admin Panel → Dev Zone → Market Data Settings, use the "Download Higher Timeframe History" section.
              </p>
              <div className="space-y-3">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Step 1: Select Timeframes</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">1m</Badge>
                    <Badge variant="outline">5m</Badge>
                    <Badge variant="outline">15m</Badge>
                    <Badge variant="outline">30m</Badge>
                    <Badge variant="outline">1h</Badge>
                    <Badge variant="outline">4h</Badge>
                    <Badge variant="outline">1d</Badge>
                    <Badge variant="outline">1w</Badge>
                  </div>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Step 2: Set Years Back</div>
                  <p className="text-xs text-gray-400">Choose how many years of history to download (1-10 years)</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Step 3: Click Download</div>
                  <p className="text-xs text-gray-400">System fetches from Massive.com API and saves to MongoDB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Incremental Downloads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                The system intelligently handles repeated downloads:
              </p>
              <div className="space-y-2 text-sm">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">✓ Incremental Fetching</div>
                  <p className="text-xs">Checks oldest existing candle and downloads backward from that point</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">✓ No Duplicates</div>
                  <p className="text-xs">Uses unique index on (symbol + timestamp) to prevent duplicate data</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                  <div className="font-medium text-purple-400 mb-1">✓ Batch Processing</div>
                  <p className="text-xs">Data is saved in batches of 1,000 candles to avoid timeouts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Storage Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">Timeframe</th>
                      <th className="text-left py-2 text-gray-400">Candles/Year</th>
                      <th className="text-left py-2 text-gray-400">~Size/Symbol/Year</th>
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
                <h4 className="font-semibold text-yellow-400 mb-1">Recommendation</h4>
                <p className="text-sm text-gray-300">
                  Download 5m, 15m, 1h, 4h, and 1d history for complete chart coverage. 
                  1m history is optional due to large size - recent 1m data is auto-collected in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },

    {
      id: 'market-data-settings',
      title: 'Market Data Settings',
      icon: Settings,
      category: 'Market Data',
      tags: ['settings', 'configuration', 'lazy loading', 'limits'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">Market Data Settings</h2>
            <p className="text-gray-300 mb-4">
              Configure chart behavior, loading, and data retention in Admin → Dev Zone → Market Data Settings.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Historical Data Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Use Local History</span>
                    <Badge variant="outline" className="text-xs">Toggle</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Charts load from downloaded historical collections first.
                    When OFF: Always fetch from Massive.com API.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Auto Fetch History</span>
                    <Badge variant="outline" className="text-xs">Toggle</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Automatically download missing historical data in background.
                    When OFF: Only use existing local data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Chart Display Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Initial Candle Count</span>
                    <Badge variant="outline" className="text-xs">Number</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    How many candles to load initially when chart opens. Default: 500.
                    Lower = faster initial load. Higher = more history visible immediately.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Lazy Load Batch Size</span>
                    <Badge variant="outline" className="text-xs">Number</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    How many candles to load when user scrolls left. Default: 500.
                    Charts implement lazy loading - more data loads on demand.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Chart History Limit</span>
                    <Badge variant="outline" className="text-xs">Toggle + Days</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    When ON: Limit how far back charts can scroll (e.g., 365 days).
                    When OFF: Load all available history (may be slow with years of data).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Price Update Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">Update Mode</span>
                    <Badge variant="outline" className="text-xs">WebSocket / Polling</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    <strong>WebSocket:</strong> Real-time updates via persistent connection. Recommended.
                    <br />
                    <strong>Polling:</strong> Regular HTTP requests. Fallback if WebSocket fails.
                  </p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">WebSocket Interval</span>
                    <Badge variant="outline" className="text-xs">Milliseconds</Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    Broadcast frequency to clients. Default: 50ms.
                    Lower = more responsive but more CPU. Higher = less load but slower updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    {
      id: 'market-data-maintenance',
      title: 'Data Maintenance',
      icon: Trash2,
      category: 'Market Data',
      tags: ['cleanup', 'maintenance', 'retention', 'storage', 'delete'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">Data Maintenance & Cleanup</h2>
            <p className="text-gray-300 mb-4">
              Manage database size by cleaning old candle data while preserving consistent history.
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
                In Admin → Dev Zone → Market Data Settings, use the "Cleanup Old Data" section.
              </p>

              <div className="space-y-3">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Cleanup Type</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400">Delete Oldest</Badge>
                      <span className="text-gray-400">Remove X days starting from the oldest data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500/20 text-orange-400">Keep Recent</Badge>
                      <span className="text-gray-400">Keep only the last X days, delete everything older</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Include Historical</div>
                  <p className="text-xs text-gray-400">
                    When ON: Also cleans <code className="text-cyan-400">candles_historical_*</code> collections.
                    <br />
                    When OFF: Only cleans <code className="text-cyan-400">candles_1m</code> real-time data.
                  </p>
                </div>

                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-2">Days to Process</div>
                  <p className="text-xs text-gray-400">
                    Number of days to delete (Delete Oldest) or keep (Keep Recent).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Cleanup Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-3 text-sm">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">Example 1: Delete Oldest 30 Days</div>
                  <p className="text-xs">
                    If you have data from Jan 1 to Dec 31, this deletes Jan 1 - Jan 30.
                    Useful for trimming old data monthly.
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1">Example 2: Keep Recent 365 Days</div>
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
              <CardTitle className="text-lg text-emerald-400">Affected Collections</CardTitle>
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
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_1m</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_5m</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_15m</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_30m</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_1h</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_4h</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_1d</code>
                  <code className="bg-gray-900 p-1 rounded text-cyan-400">historical_1w</code>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-1">Important</h4>
                <p className="text-sm text-gray-300">
                  Cleanup is permanent. Deleted candles cannot be recovered.
                  You can re-download historical data from Massive.com if needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },

    {
      id: 'market-data-troubleshooting',
      title: 'Troubleshooting',
      icon: AlertTriangle,
      category: 'Market Data',
      tags: ['troubleshooting', 'issues', 'problems', 'debug', 'errors'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-3">Market Data Troubleshooting</h2>
            <p className="text-gray-300 mb-4">
              Common issues and solutions for chart and price data problems.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Charts Not Loading</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">❓ Symptom: Chart shows spinner forever</div>
                  <div className="text-gray-400 mt-2">
                    <strong>Check:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• WebSocket server running? (pm2 status chartvolt-websocket)</li>
                      <li>• MongoDB connected? (Check server logs)</li>
                      <li>• API returning data? (Browser DevTools → Network)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Price Delays Between Charts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">❓ Symptom: One chart updates before another</div>
                  <div className="text-gray-400 mt-2">
                    <strong>Causes:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• Different WebSocket connections have slight timing differences</li>
                      <li>• Browser tab throttling (inactive tabs may update slower)</li>
                    </ul>
                    <strong className="block mt-2">Solution:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• This is normal - differences should be &lt;100ms</li>
                      <li>• Keep charts in same browser window for best sync</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Missing Historical Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">❓ Symptom: Charts only show recent data</div>
                  <div className="text-gray-400 mt-2">
                    <strong>Fix:</strong>
                    <ol className="mt-1 space-y-1">
                      <li>1. Go to Admin → Dev Zone → Market Data Settings</li>
                      <li>2. Download historical data for desired timeframes</li>
                      <li>3. Enable "Use Local History" toggle</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Database Growing Too Large</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <div className="space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">❓ Symptom: MongoDB storage filling up</div>
                  <div className="text-gray-400 mt-2">
                    <strong>Fix:</strong>
                    <ol className="mt-1 space-y-1">
                      <li>1. Use "Cleanup Old Data" with "Keep Recent" mode</li>
                      <li>2. Set reasonable retention (e.g., 365 days)</li>
                      <li>3. Enable "Include Historical" to clean all collections</li>
                      <li>4. Schedule monthly cleanup</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400">Server Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300 text-sm">
              <p>
                Check Admin → Dev Zone → Server Monitor for live stats:
              </p>
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
      )
    },

    // ==================== USER MANAGEMENT ====================
    {
      id: 'user-management',
      title: 'Managing Users',
      icon: Users,
      category: 'Users',
      tags: ['users', 'accounts', 'credit', 'suspend', 'ban'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">User Management</h2>
            <p className="text-gray-300 mb-4">
              Comprehensive tools for managing user accounts, balances, and permissions.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">User Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Credit User
                  </div>
                  <p className="text-xs">Add or remove credits from wallet. Use for: refunds, bonuses, corrections</p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1 flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Edit User
                  </div>
                  <p className="text-xs">Update name, email, or other profile information</p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <div className="font-medium text-orange-400 mb-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Suspend User
                  </div>
                  <p className="text-xs">Temporarily block from competitions. Can be reversed.</p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="font-medium text-red-400 mb-1 flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    Ban User
                  </div>
                  <p className="text-xs">Permanently block from platform. For confirmed fraud.</p>
                </div>
              </div>

              <div className="bg-red-500/20 border border-red-500/40 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-400">Delete User</span>
                </div>
                <p className="text-sm">
                  <strong>PERMANENT ACTION!</strong> Removes user and ALL data (wallet, trades, competitions).
                  Only use for: GDPR requests, confirmed fraud, duplicate accounts.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">User Information</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-3">Click any user to view their complete profile:</p>
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
      )
    },

    // ==================== FINANCIAL DASHBOARD ====================
    {
      id: 'financial-dashboard',
      title: 'Financial Dashboard',
      icon: PieChart,
      category: 'Financial',
      tags: ['financial', 'revenue', 'fees', 'balance', 'overview'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">Financial Dashboard</h2>
            <p className="text-gray-300 mb-4">
              Complete overview of platform finances, revenue, and liabilities.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Financial Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="text-blue-400 font-semibold mb-1">💰 What We HAVE</div>
                  <p className="text-xs">Total deposits - bank fees = Money in bank account</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <div className="text-red-400 font-semibold mb-1">📊 What We OWE</div>
                  <p className="text-xs">User balances + unpaid prizes + pending withdrawals</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="text-green-400 font-semibold mb-1">✅ NET POSITION</div>
                  <p className="text-xs">HAVE - OWE = Platform's actual money</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Platform Earnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Total Earned (All Time)</div>
                  <p className="text-xs text-gray-400">All platform fees collected from competitions</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Already Withdrawn</div>
                  <p className="text-xs text-gray-400">Amount admin has withdrawn to bank</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 p-3 rounded">
                  <div className="font-medium text-green-400 mb-1">Available to Withdraw</div>
                  <p className="text-xs">Total Earned - Already Withdrawn = Your profit to withdraw</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Dashboard Tabs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Overview:</strong> Key metrics and charts
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong>Transactions:</strong> All transaction history with filters
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
      )
    },

    // ==================== PAYMENTS ====================
    {
      id: 'payments',
      title: 'Payment Processing',
      icon: CreditCard,
      category: 'Financial',
      tags: ['payments', 'stripe', 'deposits', 'withdrawals'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">Payment Processing</h2>
            <p className="text-gray-300 mb-4">
              Manage payment providers, process transactions, and handle withdrawals.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Payment Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-300">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <div className="font-medium text-blue-400 mb-2">Stripe (Built-in)</div>
                <div className="text-sm space-y-1">
                  <div>• Credit/debit cards, Apple Pay, Google Pay</div>
                  <div>• Automatic webhook processing</div>
                  <div>• PCI compliant - no card data on your server</div>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                <div className="font-medium text-purple-400 mb-2">Custom Providers</div>
                <div className="text-sm">
                  Add any payment provider with custom credentials. Configure processing fees per provider.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Manual Payment Completion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">For pending payments without webhooks:</p>
              <ol className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">1</span>
                  <span>Go to Payments tab, find pending transaction</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">2</span>
                  <span>Verify payment in Stripe dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">3</span>
                  <span>Click "Complete Payment" to credit user's wallet</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Withdrawals</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-3">Admin can withdraw platform earnings:</p>
              <ul className="text-sm space-y-1">
                <li>• View "Available to Withdraw" in Financial Dashboard</li>
                <li>• Click "Withdraw" button</li>
                <li>• Enter amount and confirm with admin password</li>
                <li>• Transaction is recorded in audit log</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== NOTIFICATIONS ====================
    {
      id: 'notifications',
      title: 'Notification System',
      icon: Bell,
      category: 'Settings',
      tags: ['notifications', 'alerts', 'messages', 'templates'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-orange-400 mb-3">Notification System</h2>
            <p className="text-gray-300 mb-4">
              Configure and manage all user notifications from one place.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">Notification Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-green-400">💳 Purchase:</strong> Deposits, withdrawals, refunds
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-yellow-400">🏆 Competition:</strong> Joined, started, ended, won
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-blue-400">📊 Trading:</strong> Orders, positions, margin alerts
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-purple-400">🏅 Achievement:</strong> Badges, level ups
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-red-400">🔒 Security:</strong> Login alerts, password changes
                </div>
                <div className="bg-gray-900 p-2 rounded">
                  <strong className="text-cyan-400">⚙️ System:</strong> Maintenance, updates
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">Managing Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <ul className="text-sm space-y-2">
                <li>• <strong>Enable/Disable:</strong> Toggle individual notification types</li>
                <li>• <strong>Edit Content:</strong> Customize title, message, icon</li>
                <li>• <strong>Set Priority:</strong> Normal, High, Urgent</li>
                <li>• <strong>Preview:</strong> See how notification appears to users</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-orange-400">Sending Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <div className="font-medium text-blue-400 mb-1">Send to All Users</div>
                  <p className="text-xs">Platform announcements, maintenance notices, updates</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="font-medium text-green-400 mb-1">Send to Individual User</div>
                  <p className="text-xs">Personal messages, support responses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== EMAIL TEMPLATES ====================
    {
      id: 'email-templates',
      title: 'Email Templates',
      icon: Mail,
      category: 'Settings',
      tags: ['email', 'templates', 'welcome', 'customize'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">Email Templates</h2>
            <p className="text-gray-300 mb-4">
              Customize all emails sent to users from your platform.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">Available Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Welcome Email</div>
                  <p className="text-xs text-gray-400">Sent when user registers. Configure heading, intro text, features list, CTA button.</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Invoice Email</div>
                  <p className="text-xs text-gray-400">Sent with purchase receipts. Includes legal disclaimer from invoice settings.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">Customization Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <ul className="text-sm space-y-1">
                <li>• <strong>Subject Line:</strong> Email subject</li>
                <li>• <strong>Heading:</strong> Main title in email body</li>
                <li>• <strong>Intro Text:</strong> Welcome message/description</li>
                <li>• <strong>Feature Items:</strong> Bullet points highlighting features</li>
                <li>• <strong>CTA Button:</strong> Call-to-action button text and URL</li>
                <li>• <strong>Footer:</strong> Company address and links</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">AI Personalization</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-2">
                Enable AI to generate personalized email content for each user based on:
              </p>
              <ul className="text-sm space-y-1">
                <li>• User's name and registration context</li>
                <li>• Platform features and current competitions</li>
                <li>• Custom prompt you provide</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== INVOICE SETTINGS ====================
    {
      id: 'invoice-settings',
      title: 'Invoice Settings',
      icon: Receipt,
      category: 'Settings',
      tags: ['invoice', 'receipt', 'template', 'legal', 'pdf'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-400 mb-3">Invoice Settings</h2>
            <p className="text-gray-300 mb-4">
              Configure invoice appearance, branding, and legal information.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-blue-400">Invoice Tabs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Branding</div>
                  <p className="text-xs text-gray-400">Logo, company name, tagline, colors</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Template</div>
                  <p className="text-xs text-gray-400">Invoice number format, date format, header/footer text</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Legal</div>
                  <p className="text-xs text-gray-400">Legal disclaimer text shown on all invoices and emails</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-blue-400">Legal Disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <p className="text-sm">
                Add a legal disclaimer that appears on:
              </p>
              <ul className="text-sm space-y-1">
                <li>• PDF invoices (footer section)</li>
                <li>• Invoice emails (below invoice details)</li>
              </ul>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
                <strong>Example:</strong> "All transactions are final. This is a digital product..."
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== COMPANY SETTINGS ====================
    {
      id: 'company-settings',
      title: 'Company Settings',
      icon: Building,
      category: 'Settings',
      tags: ['company', 'business', 'address', 'tax'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">Company Settings</h2>
            <p className="text-gray-300 mb-4">
              Configure your business information for invoices and legal compliance.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-cyan-400">Business Information</CardTitle>
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
      )
    },

    // ==================== AUDIT LOGS ====================
    {
      id: 'audit-logs',
      title: 'Audit Logs',
      icon: FileCheck,
      category: 'System',
      tags: ['audit', 'logs', 'history', 'security', 'tracking'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-indigo-400 mb-3">Audit Logs</h2>
            <p className="text-gray-300 mb-4">
              Track all admin actions for security and compliance.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-400">What Gets Logged</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-900 p-2 rounded">Admin login/logout</div>
                <div className="bg-gray-900 p-2 rounded">User credit adjustments</div>
                <div className="bg-gray-900 p-2 rounded">User suspensions/bans</div>
                <div className="bg-gray-900 p-2 rounded">Competition creation</div>
                <div className="bg-gray-900 p-2 rounded">Payment completions</div>
                <div className="bg-gray-900 p-2 rounded">Settings changes</div>
                <div className="bg-gray-900 p-2 rounded">Database operations</div>
                <div className="bg-gray-900 p-2 rounded">Fraud investigations</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-400">Log Details</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="text-sm mb-2">Each log entry includes:</p>
              <ul className="text-sm space-y-1">
                <li>• <strong>Timestamp:</strong> When action occurred</li>
                <li>• <strong>Admin:</strong> Who performed the action</li>
                <li>• <strong>Action:</strong> What was done</li>
                <li>• <strong>Target:</strong> User/competition affected</li>
                <li>• <strong>Changes:</strong> Before/after values</li>
                <li>• <strong>IP Address:</strong> Source of request</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-400">Filtering & Export</CardTitle>
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
      )
    },

    // ==================== DATABASE MANAGEMENT ====================
    {
      id: 'database',
      title: 'Database Management',
      icon: Database,
      category: 'System',
      tags: ['database', 'reset', 'backup', 'recovery'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">Database Management</h2>
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
              These operations can permanently delete data. Always require admin password.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">Database Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
                  <div className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Check Database Status
                  </div>
                  <p className="text-sm text-gray-300">View record counts and connection health. ✅ Safe - read only</p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
                  <div className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Finalize Competitions
                  </div>
                  <p className="text-sm text-gray-300">Close ended competitions, distribute prizes. ⚠️ Use after competitions naturally end</p>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-4">
                  <div className="font-semibold text-orange-400 mb-2 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Recover Stats
                  </div>
                  <p className="text-sm text-gray-300">Recalculate all statistics. ⚠️ Use if stats appear incorrect</p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                  <div className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Reset All Data
                  </div>
                  <div className="text-sm text-gray-300">
                    <p className="mb-2"><strong>DELETES:</strong></p>
                    <ul className="space-y-1 ml-4">
                      <li>• All competitions and participants</li>
                      <li>• All trading positions and history</li>
                      <li>• All wallet balances and transactions</li>
                      <li>• All invoices and audit logs</li>
                      <li>• All notifications</li>
                    </ul>
                    <p className="mt-2"><strong>PRESERVES:</strong> Users, Admin credentials, Settings</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    },

    // ==================== ADMIN CREDENTIALS ====================
    {
      id: 'admin-credentials',
      title: 'Admin Credentials',
      icon: Key,
      category: 'System',
      tags: ['admin', 'password', 'security', 'login'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-red-400 mb-3">Admin Credentials</h2>
            <p className="text-gray-300 mb-4">
              Manage admin login credentials securely.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-red-400">Changing Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <ol className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">1</span>
                  <span>Go to Settings → Admin Credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">2</span>
                  <span>Enter new username and/or password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">3</span>
                  <span>Confirm with current password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">4</span>
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
      )
    },

    // ==================== PLATFORM SETTINGS ====================
    {
      id: 'platform-settings',
      title: 'Platform Settings',
      icon: Settings,
      category: 'Settings',
      tags: ['settings', 'branding', 'currency', 'whitelabel'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-purple-400 mb-3">Platform Settings</h2>
            <p className="text-gray-300 mb-4">
              Customize your platform's appearance and behavior.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">White Label Settings</CardTitle>
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
              <CardTitle className="text-lg text-purple-400">Currency Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="text-sm space-y-2">
                <div className="bg-gray-900 p-3 rounded">
                  <strong>Display Currency:</strong> EUR (€), USD ($), GBP (£)
                  <p className="text-xs text-gray-400 mt-1">Affects how prices are shown to users</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <strong>Credit Name:</strong> Custom name for credits (e.g., "Volts")
                  <p className="text-xs text-gray-400 mt-1">With custom symbol and decimal places</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-purple-400">Trading Risk Settings</CardTitle>
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
      )
    },

    // ==================== FEE SETTINGS ====================
    {
      id: 'fee-settings',
      title: 'Fee Settings',
      icon: DollarSign,
      category: 'Financial',
      tags: ['fees', 'vat', 'platform fee', 'processing'],
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400 mb-3">Fee Settings</h2>
            <p className="text-gray-300 mb-4">
              Configure platform fees, VAT, and processing charges.
            </p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">Fee Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-300">
              <div className="space-y-2 text-sm">
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Platform Fee</div>
                  <p className="text-xs text-gray-400">Percentage taken from competition prize pools (e.g., 10%)</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">VAT Rate</div>
                  <p className="text-xs text-gray-400">Value Added Tax applied to purchases (e.g., 19%)</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Processing Fee</div>
                  <p className="text-xs text-gray-400">Payment provider fee passed to users (e.g., 2.9%)</p>
                </div>
                <div className="bg-gray-900 p-3 rounded">
                  <div className="font-medium text-white mb-1">Withdrawal Fee</div>
                  <p className="text-xs text-gray-400">Fee for credit withdrawals (fixed or percentage)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-green-400">VAT Management</CardTitle>
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
      )
    }
  ];

  const categories = Array.from(new Set(topics.map(t => t.category)));
  
  const filteredTopics = topics.filter(topic => 
    searchQuery === '' || 
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
    topic.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTopicData = topics.find(t => t.id === selectedTopic);

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
            <CardDescription>
              Complete platform documentation
            </CardDescription>
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
                {categories.map(category => {
                  const categoryTopics = filteredTopics.filter(t => t.category === category);
                  if (categoryTopics.length === 0) return null;
                  
                  return (
                    <div key={category} className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                        {category}
                      </div>
                      {categoryTopics.map(topic => {
                        const Icon = topic.icon;
                        return (
                          <button
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              selectedTopic === topic.id
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm font-medium">{topic.title}</span>
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
                  {selectedTopicData.icon && <selectedTopicData.icon className="h-6 w-6 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl text-gray-100 mb-2">
                    {selectedTopicData.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedTopicData.category}
                    </Badge>
                    {selectedTopicData.tags.slice(0, 3).map(tag => (
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
                {selectedTopicData ? selectedTopicData.content : (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">Select a topic to view documentation</p>
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
