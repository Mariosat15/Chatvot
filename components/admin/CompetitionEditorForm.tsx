'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, Save, AlertCircle, FileText, DollarSign, 
  Calendar, Trophy, Shield, Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CompetitionEditorFormProps {
  competitionId: string;
}

export default function CompetitionEditorForm({ competitionId }: CompetitionEditorFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [competition, setCompetition] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entryFee: 0,
    startingCapital: 0,
    maxParticipants: 0,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    leverageAllowed: 0,
    platformFeePercentage: 0,
  });

  // Get current UTC time for display
  const [currentUTC, setCurrentUTC] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentUTC(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUTCTime = (date: Date) => {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatUTCDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [assetClasses, setAssetClasses] = useState({
    forex: false,
    crypto: false,
    stocks: false,
  });

  const [prizeDistribution, setPrizeDistribution] = useState<Array<{ rank: number; percentage: number }>>([]);

  const [levelRequirement, setLevelRequirement] = useState({
    enabled: false,
    minLevel: 1,
    maxLevel: undefined as number | undefined,
  });

  useEffect(() => {
    fetchCompetition();
  }, [competitionId]);

  const fetchCompetition = async () => {
    try {
      const response = await fetch(`/api/admin/competitions/${competitionId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      const comp = data.competition;
      
      setCompetition(comp);
      
      // Convert dates to separate date and time fields in UTC
      const startDate = new Date(comp.startTime);
      const endDate = new Date(comp.endTime);
      
      // Extract UTC date and time
      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const startTimeStr = startDate.toISOString().split('T')[1].slice(0, 5); // HH:MM
      const endDateStr = endDate.toISOString().split('T')[0];
      const endTimeStr = endDate.toISOString().split('T')[1].slice(0, 5);
      
      setFormData({
        name: comp.name || '',
        description: comp.description || '',
        entryFee: comp.entryFee || comp.entryFeeCredits || 0,
        startingCapital: comp.startingCapital || comp.startingTradingPoints || 0,
        maxParticipants: comp.maxParticipants || 0,
        startDate: startDateStr,
        startTime: startTimeStr,
        endDate: endDateStr,
        endTime: endTimeStr,
        leverageAllowed: comp.leverageAllowed || 0,
        platformFeePercentage: comp.platformFeePercentage || 0,
      });

      // Set asset classes
      const assets = comp.assetClasses || [];
      setAssetClasses({
        forex: assets.includes('forex'),
        crypto: assets.includes('crypto'),
        stocks: assets.includes('stocks'),
      });

      // Set prize distribution
      setPrizeDistribution(comp.prizeDistribution || []);

      // Set level requirement
      if (comp.levelRequirement) {
        setLevelRequirement({
          enabled: comp.levelRequirement.enabled || false,
          minLevel: comp.levelRequirement.minLevel || 1,
          maxLevel: comp.levelRequirement.maxLevel,
        });
      }

    } catch (error) {
      console.error('Error fetching competition:', error);
      toast.error('Failed to load competition data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['entryFee', 'startingCapital', 'maxParticipants', 'leverageAllowed', 'platformFeePercentage'].includes(name)
        ? Number(value)
        : value,
    }));
  };

  const handlePrizeChange = (index: number, field: 'rank' | 'percentage', value: number) => {
    const newPrizes = [...prizeDistribution];
    newPrizes[index][field] = value;
    setPrizeDistribution(newPrizes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const totalPrizePercentage = prizeDistribution.reduce((sum, p) => sum + p.percentage, 0);
    if (totalPrizePercentage !== 100) {
      toast.error(`Prize distribution must total 100% (currently ${totalPrizePercentage}%)`);
      return;
    }

    const selectedAssets = Object.entries(assetClasses)
      .filter(([_, checked]) => checked)
      .map(([asset]) => asset);

    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset class');
      return;
    }

    setSaving(true);

    try {
      // Build start and end dates with explicit UTC timezone
      const startTime = new Date(`${formData.startDate}T${formData.startTime}:00Z`);
      const endTime = new Date(`${formData.endDate}T${formData.endTime}:00Z`);

      const updatePayload = {
        name: formData.name,
        description: formData.description,
        entryFee: formData.entryFee,
        entryFeeCredits: formData.entryFee,
        startingCapital: formData.startingCapital,
        startingTradingPoints: formData.startingCapital,
        maxParticipants: formData.maxParticipants,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        leverageAllowed: formData.leverageAllowed,
        platformFeePercentage: formData.platformFeePercentage,
        assetClasses: selectedAssets,
        prizeDistribution,
        levelRequirement,
      };

      const response = await fetch(`/api/admin/competitions/${competitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update competition');
      }

      toast.success('Competition updated successfully!');
      router.push('/admin/dashboard?activeTab=competitions');
      router.refresh();
    } catch (error) {
      console.error('Error updating competition:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update competition');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-yellow-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading competition data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-red-500/50 rounded-2xl p-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-100 mb-2">Competition Not Found</h2>
          <p className="text-gray-400 mb-6">The competition you're trying to edit doesn't exist.</p>
          <Button onClick={() => router.push('/admin/dashboard?activeTab=competitions')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Check if competition can be edited
  if (competition.status === 'active' && competition.currentParticipants > 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl p-12 text-center">
          <AlertCircle className="h-12 w-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-100 mb-2">Cannot Edit Active Competition</h2>
          <p className="text-gray-400 mb-6">
            This competition is active and has participants. It cannot be edited to maintain fairness.
          </p>
          <Button onClick={() => router.push('/admin/dashboard?activeTab=competitions')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getTotalPrizePercentage = () => {
    return prizeDistribution.reduce((sum, prize) => sum + prize.percentage, 0);
  };

  const levelNames = [
    '',
    '🌱 Novice Trader',
    '📚 Apprentice Trader',
    '⚔️ Skilled Trader',
    '🎯 Expert Trader',
    '💎 Elite Trader',
    '👑 Master Trader',
    '🔥 Grand Master',
    '⚡ Trading Champion',
    '🌟 Market Legend',
    '👑 Trading God',
  ];

  return (
    <form 
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Prevent form submission on Enter key
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'submit') {
          e.preventDefault();
        }
      }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Basic Info */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Basic Information</h2>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <Label htmlFor="name" className="text-gray-300">Competition Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-gray-300">Description *</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              rows={3}
              required
            />
          </div>
        </div>
      </div>

      {/* Financial Settings */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Financial Settings</h2>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="entryFee" className="text-gray-300">Entry Fee (€) *</Label>
            <Input
              id="entryFee"
              name="entryFee"
              type="number"
              min="0"
              step="0.01"
              value={formData.entryFee}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="startingCapital" className="text-gray-300">Starting Capital ($) *</Label>
            <Input
              id="startingCapital"
              name="startingCapital"
              type="number"
              min="100"
              value={formData.startingCapital}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="maxParticipants" className="text-gray-300">Max Participants *</Label>
            <Input
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min="2"
              value={formData.maxParticipants}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="platformFeePercentage" className="text-gray-300">Platform Fee (%) *</Label>
            <Input
              id="platformFeePercentage"
              name="platformFeePercentage"
              type="number"
              min="0"
              max="50"
              value={formData.platformFeePercentage}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              required
            />
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Schedule</h2>
          </div>
        </div>
        
        {/* Current UTC Clock */}
        <div className="p-4 mx-6 mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-400 animate-pulse" />
              <div>
                <div className="text-xs text-blue-300 font-semibold uppercase">Current Server Time (UTC)</div>
                <div className="text-xl font-bold text-blue-100 tabular-nums" suppressHydrationWarning>
                  {formatUTCTime(currentUTC)}
                </div>
              </div>
            </div>
            <div className="text-xs text-blue-400 tabular-nums" suppressHydrationWarning>
              {formatUTCDate(currentUTC)}
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date & Time */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="startDate" className="text-gray-300">Start Date *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleInputChange}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
                required
              />
            </div>
            <div>
              <Label htmlFor="startTime" className="text-gray-300 flex items-center justify-between">
                <span>Start Time (UTC) *</span>
                <span className="text-blue-400 font-mono text-xs" suppressHydrationWarning>
                  Now: {formatUTCTime(currentUTC)}
                </span>
              </Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleInputChange}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100 font-mono"
                required
              />
              <p className="text-xs text-yellow-400 mt-1.5">⚠️ Enter time in UTC</p>
            </div>
          </div>

          {/* End Date & Time */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="endDate" className="text-gray-300">End Date *</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleInputChange}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime" className="text-gray-300 flex items-center justify-between">
                <span>End Time (UTC) *</span>
                <span className="text-blue-400 font-mono text-xs" suppressHydrationWarning>
                  Now: {formatUTCTime(currentUTC)}
                </span>
              </Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={handleInputChange}
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100 font-mono"
                required
              />
              <p className="text-xs text-yellow-400 mt-1.5">⚠️ Enter time in UTC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Settings */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Trading Settings</h2>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <Label htmlFor="leverageAllowed" className="text-gray-300">Max Leverage (1:X) *</Label>
            <Input
              id="leverageAllowed"
              name="leverageAllowed"
              type="number"
              min="1"
              max="500"
              value={formData.leverageAllowed}
              onChange={handleInputChange}
              className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
              required
            />
          </div>

          <div>
            <Label className="text-gray-300 mb-2 block">Asset Classes *</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={assetClasses.forex}
                  onCheckedChange={(checked) => setAssetClasses(prev => ({ ...prev, forex: !!checked }))}
                />
                <span className="text-gray-100">Forex</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={assetClasses.crypto}
                  onCheckedChange={(checked) => setAssetClasses(prev => ({ ...prev, crypto: !!checked }))}
                />
                <span className="text-gray-100">Crypto</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={assetClasses.stocks}
                  onCheckedChange={(checked) => setAssetClasses(prev => ({ ...prev, stocks: !!checked }))}
                />
                <span className="text-gray-100">Stocks</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Prize Distribution */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/50 rounded-2xl shadow-2xl shadow-yellow-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-gray-900" />
            <h2 className="text-2xl font-bold text-gray-900">Prize Distribution</h2>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {prizeDistribution.map((prize, index) => (
            <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-lg">
              <div>
                <Label className="text-gray-300">Rank #{prize.rank}</Label>
              </div>
              <div>
                <Label className="text-gray-300">Percentage</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={prize.percentage}
                  onChange={(e) => handlePrizeChange(index, 'percentage', Number(e.target.value))}
                  className="mt-1 bg-gray-700 border-gray-600 text-gray-100"
                />
              </div>
            </div>
          ))}
          
          <div className={`p-3 rounded-lg ${getTotalPrizePercentage() === 100 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <p className={`text-sm font-semibold ${getTotalPrizePercentage() === 100 ? 'text-green-400' : 'text-red-400'}`}>
              Total: {getTotalPrizePercentage()}% {getTotalPrizePercentage() === 100 ? '✓' : '(must be 100%)'}
            </p>
          </div>
        </div>
      </div>

      {/* Level Requirement */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Level Requirement</h2>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={levelRequirement.enabled}
              onCheckedChange={(checked) => setLevelRequirement(prev => ({ ...prev, enabled: !!checked }))}
            />
            <span className="text-gray-100 font-semibold">Enable Level Requirement</span>
          </label>

          {levelRequirement.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <Label className="text-gray-300">Minimum Level *</Label>
                <select
                  value={levelRequirement.minLevel}
                  onChange={(e) => setLevelRequirement(prev => ({ ...prev, minLevel: Number(e.target.value) }))}
                  className="mt-2 w-full bg-gray-700 border-gray-600 text-gray-100 rounded-lg px-3 py-2"
                >
                  {levelNames.slice(1).map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-gray-300">Maximum Level (Optional)</Label>
                <select
                  value={levelRequirement.maxLevel || ''}
                  onChange={(e) => setLevelRequirement(prev => ({ 
                    ...prev, 
                    maxLevel: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  className="mt-2 w-full bg-gray-700 border-gray-600 text-gray-100 rounded-lg px-3 py-2"
                >
                  <option value="">No Maximum</option>
                  {levelNames.slice(levelRequirement.minLevel + 1).map((name, idx) => {
                    const level = levelRequirement.minLevel + idx + 1;
                    return <option key={level} value={level}>{name}</option>;
                  })}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/dashboard?activeTab=competitions')}
          className="flex-1 border-gray-600 text-gray-300"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || getTotalPrizePercentage() !== 100}
          className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Update Competition
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

