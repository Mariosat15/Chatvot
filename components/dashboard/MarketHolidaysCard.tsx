'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  Zap,
  Globe,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'automatic' | 'manual';
  affectedAssets?: string[];
  exchange?: string;
  status?: string;
  isRecurring?: boolean;
  daysUntil?: number;
}

interface HolidaysData {
  holidays: Holiday[];
  mode: 'automatic' | 'manual';
  totalAutomatic: number;
  totalManual: number;
}

export default function MarketHolidaysCard() {
  const [data, setData] = useState<HolidaysData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/trading/market-holidays');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setError(null);
      } else {
        setError('Failed to load holidays');
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError('Unable to load market holidays');
    } finally {
      setLoading(false);
    }
  };

  // Get the next upcoming holiday
  const getNextHoliday = () => {
    if (!data?.holidays.length) return null;
    return data.holidays.find(h => h.daysUntil !== undefined && h.daysUntil >= 0);
  };

  const nextHoliday = getNextHoliday();
  const upcomingHolidays = data?.holidays.filter(h => h.daysUntil !== undefined && h.daysUntil >= 0) || [];
  const displayHolidays = showAll ? upcomingHolidays : upcomingHolidays.slice(0, 4);

  // Don't show if no holidays
  if (!loading && (!data?.holidays.length || upcomingHolidays.length === 0)) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-gray-950 border border-gray-700/50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/[0.02]" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
      
      {/* Header */}
      <div className="relative p-5 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg shadow-red-500/20">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Market Holidays
                {data?.mode === 'automatic' && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] font-medium ml-1">
                    <Zap className="h-3 w-3 mr-1" />
                    Live
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-gray-400">
                {upcomingHolidays.length} upcoming {upcomingHolidays.length === 1 ? 'holiday' : 'holidays'}
              </p>
            </div>
          </div>
          
          <button
            onClick={fetchHolidays}
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-gray-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Featured Next Holiday */}
            {nextHoliday && nextHoliday.daysUntil !== undefined && nextHoliday.daysUntil <= 7 && (
              <div className={`relative overflow-hidden rounded-xl p-4 ${
                nextHoliday.daysUntil === 0 
                  ? 'bg-gradient-to-r from-red-500/20 to-rose-600/10 border border-red-500/30'
                  : nextHoliday.daysUntil <= 2
                  ? 'bg-gradient-to-r from-orange-500/20 to-amber-600/10 border border-orange-500/30'
                  : 'bg-gradient-to-r from-yellow-500/10 to-amber-600/5 border border-yellow-500/20'
              }`}>
                {nextHoliday.daysUntil === 0 && (
                  <div className="absolute top-2 right-2">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${
                    nextHoliday.daysUntil === 0 
                      ? 'bg-red-500/30 text-red-300'
                      : nextHoliday.daysUntil <= 2
                      ? 'bg-orange-500/30 text-orange-300'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    <span className="text-lg font-black">
                      {new Date(nextHoliday.date).getDate()}
                    </span>
                    <span className="text-[10px] font-bold uppercase">
                      {new Date(nextHoliday.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{nextHoliday.name}</h4>
                    <p className="text-sm text-gray-400">
                      {nextHoliday.daysUntil === 0 ? (
                        <span className="text-red-400 font-medium">Markets closed today</span>
                      ) : nextHoliday.daysUntil === 1 ? (
                        <span className="text-orange-400 font-medium">Tomorrow</span>
                      ) : (
                        <span>In {nextHoliday.daysUntil} days</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {nextHoliday.type === 'automatic' ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 px-1.5">
                          <Globe className="h-2.5 w-2.5 mr-1" />
                          {nextHoliday.exchange || 'API'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 px-1.5">
                          Custom
                        </Badge>
                      )}
                      {nextHoliday.affectedAssets && nextHoliday.affectedAssets.length > 0 && (
                        <div className="flex gap-1">
                          {nextHoliday.affectedAssets.slice(0, 2).map(asset => (
                            <Badge key={asset} variant="secondary" className="text-[10px] capitalize px-1.5">
                              {asset}
                            </Badge>
                          ))}
                          {nextHoliday.affectedAssets.length > 2 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              +{nextHoliday.affectedAssets.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Holiday List */}
            {displayHolidays.length > 0 && (
              <div className="space-y-2">
                {displayHolidays
                  .filter(h => !(nextHoliday && h.id === nextHoliday.id && nextHoliday.daysUntil !== undefined && nextHoliday.daysUntil <= 7))
                  .map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-white">
                        {new Date(holiday.date).getDate()}
                      </span>
                      <span className="text-[9px] font-medium text-gray-400 uppercase">
                        {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-white truncate">{holiday.name}</h4>
                        {holiday.type === 'automatic' && (
                          <Zap className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {holiday.daysUntil !== undefined && holiday.daysUntil === 0 ? 'Today' :
                           holiday.daysUntil === 1 ? 'Tomorrow' :
                           `In ${holiday.daysUntil} days`}
                        </span>
                        {holiday.exchange && (
                          <span className="text-xs text-gray-600">• {holiday.exchange}</span>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* Show More Button */}
            {upcomingHolidays.length > 4 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showAll ? 'Show less' : `Show ${upcomingHolidays.length - 4} more holidays`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {data?.mode === 'automatic' && (
        <div className="relative px-5 pb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="h-3 w-3 text-emerald-500" />
            <span>Holiday data from live market API</span>
          </div>
        </div>
      )}
    </section>
  );
}

