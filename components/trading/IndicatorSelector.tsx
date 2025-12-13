'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, TrendingUp, BarChart3, Waves } from 'lucide-react';

export interface IndicatorConfig {
  id: string;
  name: string;
  type: 'overlay' | 'oscillator';
  enabled: boolean;
  color?: string;
  parameters: Record<string, number>;
}

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  {
    id: 'sma20',
    name: 'SMA (20)',
    type: 'overlay',
    enabled: false,
    color: '#2962ff',
    parameters: { period: 20 }
  },
  {
    id: 'sma50',
    name: 'SMA (50)',
    type: 'overlay',
    enabled: false,
    color: '#f23645',
    parameters: { period: 50 }
  },
  {
    id: 'ema9',
    name: 'EMA (9)',
    type: 'overlay',
    enabled: false,
    color: '#ff6d00',
    parameters: { period: 9 }
  },
  {
    id: 'ema21',
    name: 'EMA (21)',
    type: 'overlay',
    enabled: false,
    color: '#00e676',
    parameters: { period: 21 }
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    type: 'overlay',
    enabled: false,
    color: '#9c27b0',
    parameters: { period: 20, stdDev: 2 }
  },
  {
    id: 'rsi',
    name: 'RSI (14)',
    type: 'oscillator',
    enabled: false,
    color: '#2962ff',
    parameters: { period: 14 }
  },
  {
    id: 'macd',
    name: 'MACD (12,26,9)',
    type: 'oscillator',
    enabled: false,
    color: '#2962ff',
    parameters: { fast: 12, slow: 26, signal: 9 }
  },
  {
    id: 'stoch',
    name: 'Stochastic (14,3)',
    type: 'oscillator',
    enabled: false,
    color: '#00e676',
    parameters: { kPeriod: 14, dPeriod: 3 }
  },
];

interface IndicatorSelectorProps {
  indicators: IndicatorConfig[];
  onIndicatorsChange: (indicators: IndicatorConfig[]) => void;
}

export default function IndicatorSelector({ indicators, onIndicatorsChange }: IndicatorSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleIndicator = (id: string) => {
    const updated = indicators.map(ind =>
      ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
    );
    onIndicatorsChange(updated);
  };

  const updateParameter = (id: string, param: string, value: number) => {
    const updated = indicators.map(ind =>
      ind.id === id
        ? { ...ind, parameters: { ...ind.parameters, [param]: value } }
        : ind
    );
    onIndicatorsChange(updated);
  };

  const overlayIndicators = indicators.filter(ind => ind.type === 'overlay');
  const oscillatorIndicators = indicators.filter(ind => ind.type === 'oscillator');

  const enabledCount = indicators.filter(ind => ind.enabled).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-3 text-xs hover:bg-[#2a2e39] text-[#787b86]"
        >
          <Activity className="h-4 w-4 mr-1" />
          Indicators {enabledCount > 0 && `(${enabledCount})`}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Technical Indicators
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overlay Indicators */}
          <div>
            <h3 className="text-sm font-semibold text-[#d1d4dc] mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overlay Indicators (on main chart)
            </h3>
            <div className="space-y-3">
              {overlayIndicators.map(indicator => (
                <div key={indicator.id} className="flex items-center justify-between bg-[#1e222d] p-3 rounded-lg border border-[#2b2b43]">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={indicator.id}
                      checked={indicator.enabled}
                      onCheckedChange={() => toggleIndicator(indicator.id)}
                      className="border-[#787b86]"
                    />
                    <Label htmlFor={indicator.id} className="cursor-pointer flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: indicator.color }}
                      />
                      <span className="font-medium">{indicator.name}</span>
                    </Label>
                  </div>
                  
                  {indicator.enabled && (
                    <div className="flex items-center gap-2">
                      {Object.entries(indicator.parameters).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1">
                          <Label className="text-xs text-[#787b86] capitalize">{key}:</Label>
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => updateParameter(indicator.id, key, Number(e.target.value))}
                            className="w-16 h-7 bg-[#131722] border-[#2b2b43] text-white text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Oscillator Indicators */}
          <div>
            <h3 className="text-sm font-semibold text-[#d1d4dc] mb-3 flex items-center gap-2">
              <Waves className="h-4 w-4" />
              Oscillator Indicators (separate panels)
            </h3>
            <div className="space-y-3">
              {oscillatorIndicators.map(indicator => (
                <div key={indicator.id} className="flex items-center justify-between bg-[#1e222d] p-3 rounded-lg border border-[#2b2b43]">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={indicator.id}
                      checked={indicator.enabled}
                      onCheckedChange={() => toggleIndicator(indicator.id)}
                      className="border-[#787b86]"
                    />
                    <Label htmlFor={indicator.id} className="cursor-pointer flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: indicator.color }}
                      />
                      <span className="font-medium">{indicator.name}</span>
                    </Label>
                  </div>
                  
                  {indicator.enabled && (
                    <div className="flex items-center gap-2">
                      {Object.entries(indicator.parameters).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1">
                          <Label className="text-xs text-[#787b86] capitalize">{key}:</Label>
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => updateParameter(indicator.id, key, Number(e.target.value))}
                            className="w-16 h-7 bg-[#131722] border-[#2b2b43] text-white text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-[#1e222d] p-3 rounded-lg border border-[#2b2b43] text-xs text-[#787b86]">
            <p className="mb-2"><strong>Overlay Indicators</strong> appear directly on the price chart.</p>
            <p><strong>Oscillator Indicators</strong> appear in separate panels below the chart.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

