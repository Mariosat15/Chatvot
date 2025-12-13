'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ChevronDown,
  ChevronUp,
  LineChart,
  Loader2,
  Sparkles,
  BarChart3,
  RefreshCw,
  Target,
  TrendingUp,
  Activity,
  Layers,
  ExternalLink,
  Info,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { useTradingArsenal, marketplaceItemToIndicator, marketplaceItemToStrategy } from '@/contexts/TradingArsenalContext';

interface MarketplaceItem {
  _id: string;
  name: string;
  shortDescription: string;
  category: 'indicator' | 'strategy';
  indicatorType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategyConfig?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultSettings?: Record<string, any>;
}

interface Purchase {
  purchaseId: string;
  itemId: string;
  item: MarketplaceItem;
  isEnabled: boolean;
  customSettings: Record<string, any>;
}

interface TradingArsenalPanelProps {
  contestType: 'competition' | 'challenge';
  contestId: string;
  participantId: string;
  currentAsset?: string;
}

const INDICATOR_ICONS: Record<string, any> = {
  sma: TrendingUp,
  ema: Activity,
  bb: Layers,
  rsi: BarChart3,
  macd: Activity,
  support_resistance: LineChart,
};

const INDICATOR_COLORS: Record<string, string> = {
  sma: 'text-blue-400',
  ema: 'text-cyan-400',
  bb: 'text-purple-400',
  rsi: 'text-green-400',
  macd: 'text-pink-400',
  support_resistance: 'text-yellow-400',
};

export default function TradingArsenalPanel({
  contestType,
  contestId,
  participantId,
  currentAsset,
}: TradingArsenalPanelProps) {
  const { 
    addIndicator, 
    removeIndicator, 
    activeIndicators,
    addStrategy,
    removeStrategy,
    activeStrategies,
  } = useTradingArsenal();
  
  const [expanded, setExpanded] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'indicators' | 'strategies'>('indicators');
  const [selectedStrategy, setSelectedStrategy] = useState<Purchase | null>(null);
  
  // Fetch all user's purchased items
  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/marketplace/purchases');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.purchases)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validPurchases = data.purchases.filter((p: any) => 
          p.item && p.item._id && p.item.name && 
          (p.item.category === 'indicator' || p.item.category === 'strategy')
        );
        setPurchases(validPurchases);
        
        // Auto-add enabled items
        validPurchases.forEach((purchase: Purchase) => {
          if (purchase.isEnabled) {
            if (purchase.item.category === 'indicator') {
              const indicatorConfig = marketplaceItemToIndicator(
                purchase.purchaseId,
                purchase.item,
                purchase.customSettings || purchase.item.defaultSettings
              );
              if (indicatorConfig) {
                addIndicator(indicatorConfig);
              }
            } else if (purchase.item.category === 'strategy') {
              const strategyConfig = marketplaceItemToStrategy(
                purchase.purchaseId,
                purchase.item
              );
              if (strategyConfig) {
                addStrategy(strategyConfig);
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  }, [addIndicator, addStrategy]);
  
  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);
  
  const handleToggle = async (purchase: Purchase) => {
    setActionLoading(purchase.purchaseId);
    const newEnabled = !purchase.isEnabled;
    
    try {
      const response = await fetch('/api/marketplace/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.purchaseId,
          isEnabled: newEnabled,
        }),
      });
      
      if (response.ok) {
        setPurchases(prev => prev.map(p => 
          p.purchaseId === purchase.purchaseId ? { ...p, isEnabled: newEnabled } : p
        ));
        
        if (purchase.item.category === 'indicator') {
          const indicatorId = `arsenal-${purchase.purchaseId}`;
          if (newEnabled) {
            const indicatorConfig = marketplaceItemToIndicator(
              purchase.purchaseId,
              purchase.item,
              purchase.customSettings || purchase.item.defaultSettings
            );
            if (indicatorConfig) {
              addIndicator(indicatorConfig);
            }
          } else {
            removeIndicator(indicatorId);
          }
        } else if (purchase.item.category === 'strategy') {
          const strategyId = `strategy-${purchase.purchaseId}`;
          if (newEnabled) {
            const strategyConfig = marketplaceItemToStrategy(
              purchase.purchaseId,
              purchase.item
            );
            if (strategyConfig) {
              addStrategy(strategyConfig);
            }
          } else {
            removeStrategy(strategyId);
          }
        }
        
        toast.success(`${purchase.item.name} ${newEnabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to toggle item');
      }
    } catch (error) {
      toast.error('Failed to toggle item');
      console.error('Toggle error:', error);
    } finally {
      setActionLoading(null);
    }
  };
  
  const indicators = purchases.filter(p => p.item.category === 'indicator');
  const strategies = purchases.filter(p => p.item.category === 'strategy');
  
  const enabledIndicators = indicators.filter(p => p.isEnabled).length;
  const enabledStrategies = strategies.filter(p => p.isEnabled).length;
  
  const isIndicatorActive = (purchaseId: string) => {
    return activeIndicators.some(i => i.id === `arsenal-${purchaseId}` && i.enabled);
  };
  
  const isStrategyActive = (purchaseId: string) => {
    return activeStrategies.some(s => s.id === `strategy-${purchaseId}` && s.enabled);
  };

  const getIndicatorIcon = (item: MarketplaceItem) => {
    const type = item.indicatorType || 'sma';
    return INDICATOR_ICONS[type] || LineChart;
  };

  const getIndicatorColor = (item: MarketplaceItem) => {
    const type = item.indicatorType || 'sma';
    return INDICATOR_COLORS[type] || 'text-emerald-400';
  };
  
  return (
    <div className="bg-gradient-to-b from-gray-900/90 to-gray-950/90 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden mb-4 shadow-xl">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-white block">Trading Arsenal</span>
            <span className="text-xs text-gray-500">
              {purchases.length === 0 
                ? 'No items purchased' 
                : `${enabledIndicators + enabledStrategies} active`}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {indicators.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
              {enabledIndicators}/{indicators.length}
            </span>
          )}
          {strategies.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
              {enabledStrategies}/{strategies.length}
            </span>
          )}
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            expanded ? "bg-gray-700/50" : "bg-transparent"
          )}>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </button>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-2" />
              <span className="text-sm text-gray-500">Loading arsenal...</span>
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800/50 mb-4">
                <LineChart className="h-8 w-8 text-gray-600" />
              </div>
              <h4 className="text-white font-medium mb-2">No Items Yet</h4>
              <p className="text-gray-500 text-sm mb-4">
                Get indicators and strategies from the marketplace
              </p>
              <Link href="/marketplace">
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Browse Marketplace
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-800/30 rounded-xl mt-4">
                <button
                  onClick={() => setActiveTab('indicators')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === 'indicators' 
                      ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 shadow-sm" 
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <LineChart className="h-4 w-4" />
                  Indicators
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs",
                    activeTab === 'indicators' ? "bg-emerald-500/20" : "bg-gray-700/50"
                  )}>
                    {indicators.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('strategies')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === 'strategies' 
                      ? "bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 shadow-sm" 
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <Target className="h-4 w-4" />
                  Strategies
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs",
                    activeTab === 'strategies' ? "bg-orange-500/20" : "bg-gray-700/50"
                  )}>
                    {strategies.length}
                  </span>
                </button>
              </div>
              
              {/* Info */}
              <p className="text-xs text-gray-500 px-1">
                {activeTab === 'indicators' 
                  ? "Toggle indicators to show them on the chart"
                  : "Enable strategies to see buy/sell signals"
                }
              </p>
              
              {/* Item List */}
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                {activeTab === 'indicators' ? (
                  indicators.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      <LineChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No indicators purchased
                    </div>
                  ) : (
                    indicators.map((purchase) => {
                      const isActive = isIndicatorActive(purchase.purchaseId);
                      const Icon = getIndicatorIcon(purchase.item);
                      const iconColor = getIndicatorColor(purchase.item);
                      
                      return (
                        <div 
                          key={purchase.purchaseId} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all",
                            purchase.isEnabled
                              ? "bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-emerald-500/20" 
                              : "bg-gray-800/30 border-gray-700/30 hover:border-gray-600/50"
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn(
                              "p-2 rounded-lg",
                              purchase.isEnabled 
                                ? "bg-emerald-500/10" 
                                : "bg-gray-700/50"
                            )}>
                              <Icon className={cn(
                                "h-4 w-4",
                                purchase.isEnabled ? iconColor : "text-gray-500"
                              )} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-white text-sm truncate">
                                {purchase.item.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {purchase.item.shortDescription}
                              </div>
                            </div>
                          </div>
                          
                          <Switch
                            checked={purchase.isEnabled}
                            onCheckedChange={() => handleToggle(purchase)}
                            disabled={actionLoading === purchase.purchaseId}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                      );
                    })
                  )
                ) : (
                  strategies.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No strategies purchased
                    </div>
                  ) : (
                    strategies.map((purchase) => {
                      const isActive = isStrategyActive(purchase.purchaseId);
                      const rulesCount = purchase.item.strategyConfig?.rules?.length || 0;
                      
                      return (
                        <div 
                          key={purchase.purchaseId} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all",
                            purchase.isEnabled
                              ? "bg-gradient-to-r from-orange-500/5 to-amber-500/5 border-orange-500/20" 
                              : "bg-gray-800/30 border-gray-700/30 hover:border-gray-600/50"
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn(
                              "p-2 rounded-lg",
                              purchase.isEnabled 
                                ? "bg-orange-500/10" 
                                : "bg-gray-700/50"
                            )}>
                              <Target className={cn(
                                "h-4 w-4",
                                purchase.isEnabled ? "text-orange-400" : "text-gray-500"
                              )} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-white text-sm truncate">
                                {purchase.item.name}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500">{rulesCount} rules</span>
                                {purchase.isEnabled && isActive && (
                                  <span className="flex items-center gap-1 text-green-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStrategy(purchase);
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                              title="View Strategy Details"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                            <Switch
                              checked={purchase.isEnabled}
                              onCheckedChange={() => handleToggle(purchase)}
                              disabled={actionLoading === purchase.purchaseId}
                              className="data-[state=checked]:bg-orange-500"
                            />
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
              
              {/* Footer Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-800/50">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchPurchases}
                  disabled={loading}
                  className="flex-1 h-9 text-xs text-gray-400 hover:text-white"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                  Refresh
                </Button>
                <Link href="/marketplace" className="flex-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full h-9 text-xs border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                  >
                    <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                    Get More
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* Strategy Details Modal */}
      {selectedStrategy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Target className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{selectedStrategy.item.name}</h3>
                  <p className="text-xs text-gray-500">Strategy Configuration</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStrategy(null)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
              {/* Description */}
              <div>
                <p className="text-sm text-gray-400">{selectedStrategy.item.shortDescription}</p>
              </div>

              {/* Rules */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-400" />
                  Strategy Rules
                </h4>
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {selectedStrategy.item.strategyConfig?.rules?.map((rule: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-semibold",
                          rule.signal?.includes('buy') ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {rule.signal?.replace('_', ' ').toUpperCase() || 'Signal'}
                        </span>
                        <span className="text-xs text-gray-500">{rule.name || `Rule ${idx + 1}`}</span>
                      </div>
                      <div className="space-y-1.5">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {rule.conditions?.map((cond: any, cidx: number) => (
                          <div key={cidx} className="text-xs text-gray-400 flex items-center gap-2">
                            <span className="text-gray-600">{cidx > 0 ? rule.logic || 'AND' : '•'}</span>
                            <span>
                              {cond.indicator?.toUpperCase() || 'Indicator'}{' '}
                              <span className="text-orange-400">{cond.operator?.replace('_', ' ')}</span>{' '}
                              {cond.compareWith === 'value' 
                                ? cond.compareValue 
                                : cond.compareIndicator?.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings */}
              {selectedStrategy.item.defaultSettings && Object.keys(selectedStrategy.item.defaultSettings).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3">Default Settings</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedStrategy.item.defaultSettings).map(([key, value]) => (
                      <div key={key} className="p-2 rounded-lg bg-gray-800/30 border border-gray-700/30">
                        <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div className="text-sm text-white font-medium">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signal Display Settings */}
              {selectedStrategy.item.strategyConfig?.signalDisplay && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3">Signal Display</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStrategy.item.strategyConfig.signalDisplay.showOnChart && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs">
                        Shows on Chart
                      </span>
                    )}
                    {selectedStrategy.item.strategyConfig.signalDisplay.showArrows && (
                      <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                        Arrow Markers
                      </span>
                    )}
                    {selectedStrategy.item.strategyConfig.signalDisplay.showLabels && (
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                        Labels
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                {selectedStrategy.isEnabled ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Currently Active
                  </span>
                ) : (
                  <span>Currently Disabled</span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => setSelectedStrategy(null)}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
