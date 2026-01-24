'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Crown, 
  Trophy, 
  ArrowLeft, 
  Calendar, 
  Users, 
  Coins, 
  Zap,
  Clock,
  Target,
  Check,
  AlertCircle,
  Loader2,
  TrendingUp,
  Shield,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GMSubscription {
  limits: {
    maxCompetitionsPerDay: number;
    maxUsersPerCompetition: number;
    referralFeePercentage: number;
  };
  currentPeriodCompetitionsCreated: number;
}

export default function GMCreateCompetitionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subscription, setSubscription] = useState<GMSubscription | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entryFee: 10,
    startingCapital: 10000,
    minParticipants: 2,
    maxParticipants: 30,
    startDate: '',
    startTime: '10:00',
    endDate: '',
    endTime: '18:00',
    leverage: 30,
    platformFeePercentage: 10,
  });

  const [assetClasses, setAssetClasses] = useState({
    forex: true,
    crypto: false,
    stocks: false,
  });

  // Fetch GM subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/gamemaster/status');
        const data = await response.json();
        
        if (data.success && data.isGameMaster && data.subscription) {
          setSubscription({
            limits: data.subscription.limits,
            currentPeriodCompetitionsCreated: data.subscription.stats.currentPeriodCompetitionsCreated,
          });
          // Set max participants based on package limit
          setFormData(prev => ({
            ...prev,
            maxParticipants: Math.min(prev.maxParticipants, data.subscription.limits.maxUsersPerCompetition),
          }));
        } else {
          toast.error('You need an active Game Master subscription');
          router.push('/gamemaster');
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        toast.error('Failed to load subscription data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscription();
  }, [router]);

  // Set default dates
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    setFormData(prev => ({
      ...prev,
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: dayAfter.toISOString().split('T')[0],
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subscription) return;
    
    // Check if limit reached
    if (subscription.currentPeriodCompetitionsCreated >= subscription.limits.maxCompetitionsPerDay) {
      toast.error('Daily competition limit reached');
      return;
    }

    // Validate
    if (!formData.name.trim()) {
      toast.error('Please enter a competition name');
      return;
    }
    
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
    
    if (startDateTime <= new Date()) {
      toast.error('Start time must be in the future');
      return;
    }
    
    if (endDateTime <= startDateTime) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch('/api/gamemaster/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          entryFee: formData.entryFee,
          startingCapital: formData.startingCapital,
          minParticipants: formData.minParticipants,
          maxParticipants: formData.maxParticipants,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          leverage: formData.leverage,
          platformFeePercentage: formData.platformFeePercentage,
          assetClasses,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Competition created successfully!');
        router.push('/gamemaster');
      } else {
        toast.error(result.error || 'Failed to create competition');
      }
    } catch (error) {
      console.error('Error creating competition:', error);
      toast.error('Failed to create competition');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const remainingToday = subscription.limits.maxCompetitionsPerDay - subscription.currentPeriodCompetitionsCreated;
  const canCreate = remainingToday > 0;
  const estimatedPrizePool = formData.maxParticipants * formData.entryFee * (1 - formData.platformFeePercentage / 100);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-yellow-500/10 to-amber-500/10">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link 
            href="/gamemaster"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                <Trophy className="h-7 w-7 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Create Competition</h1>
                <p className="text-gray-400">Host a new trading competition for your community</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold',
                canCreate 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              )}>
                {remainingToday} / {subscription.limits.maxCompetitionsPerDay} remaining today
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {!canCreate && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-400">Daily Limit Reached</h3>
              <p className="text-gray-400 text-sm mt-1">
                You've created {subscription.limits.maxCompetitionsPerDay} competition(s) today. 
                Come back tomorrow to create more!
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Basic Information
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Competition Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Weekly Forex Challenge"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                  maxLength={100}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your competition..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors resize-none"
                  maxLength={500}
                />
              </div>
            </div>
          </div>

          {/* Entry & Prize */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Coins className="h-5 w-5 text-emerald-400" />
              Entry Fee & Prizes
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Entry Fee (Credits) *
                </label>
                <div className="relative">
                  <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-yellow-400" />
                  <input
                    type="number"
                    value={formData.entryFee}
                    onChange={(e) => setFormData(prev => ({ ...prev, entryFee: parseInt(e.target.value) || 0 }))}
                    min={1}
                    max={10000}
                    className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Starting Capital
                </label>
                <input
                  type="number"
                  value={formData.startingCapital}
                  onChange={(e) => setFormData(prev => ({ ...prev, startingCapital: parseInt(e.target.value) || 10000 }))}
                  min={1000}
                  max={1000000}
                  step={1000}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Platform Fee %
                </label>
                <input
                  type="number"
                  value={formData.platformFeePercentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, platformFeePercentage: parseInt(e.target.value) || 10 }))}
                  min={5}
                  max={30}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">Platform takes this % from prize pool</p>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-xl p-4 border border-emerald-500/20">
                <div className="text-sm text-gray-400 mb-1">Estimated Prize Pool</div>
                <div className="text-2xl font-bold text-emerald-400">
                  ⚡ {estimatedPrizePool.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  If {formData.maxParticipants} participants join
                </div>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Participants
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Minimum Participants
                </label>
                <input
                  type="number"
                  value={formData.minParticipants}
                  onChange={(e) => setFormData(prev => ({ ...prev, minParticipants: parseInt(e.target.value) || 2 }))}
                  min={2}
                  max={formData.maxParticipants}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Participants
                  <span className="text-yellow-400 ml-2">(max: {subscription.limits.maxUsersPerCompetition})</span>
                </label>
                <input
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    maxParticipants: Math.min(parseInt(e.target.value) || 2, subscription.limits.maxUsersPerCompetition) 
                  }))}
                  min={2}
                  max={subscription.limits.maxUsersPerCompetition}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              Schedule
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Trading Settings */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              Trading Settings
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Leverage: {formData.leverage}x
                </label>
                <input
                  type="range"
                  value={formData.leverage}
                  onChange={(e) => setFormData(prev => ({ ...prev, leverage: parseInt(e.target.value) }))}
                  min={1}
                  max={100}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1x</span>
                  <span>50x</span>
                  <span>100x</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Asset Classes
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'forex', label: 'Forex', color: 'emerald' },
                    { key: 'crypto', label: 'Crypto', color: 'orange' },
                    { key: 'stocks', label: 'Stocks', color: 'blue' },
                  ].map((asset) => (
                    <button
                      key={asset.key}
                      type="button"
                      onClick={() => setAssetClasses(prev => ({ ...prev, [asset.key]: !prev[asset.key as keyof typeof prev] }))}
                      className={cn(
                        'px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2',
                        assetClasses[asset.key as keyof typeof assetClasses]
                          ? `bg-${asset.color}-500/20 text-${asset.color}-400 border border-${asset.color}-500/30`
                          : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                      )}
                    >
                      {assetClasses[asset.key as keyof typeof assetClasses] && <Check className="h-4 w-4" />}
                      {asset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between">
            <Link
              href="/gamemaster"
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            
            <button
              type="submit"
              disabled={!canCreate || submitting}
              className={cn(
                'px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2',
                canCreate && !submitting
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Trophy className="h-5 w-5" />
                  Create Competition
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
