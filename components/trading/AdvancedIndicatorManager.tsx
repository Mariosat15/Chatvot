'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Activity, Plus, Trash2, Edit2, Copy, Palette, Settings, Layers, TrendingUp, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

// Disable debug logging
const DEBUG = false;
const log = (...args: unknown[]): void => { if (DEBUG) log(...args); };

export interface CustomIndicator {
  id: string;
  type: string;
  name: string;
  displayType: 'overlay' | 'oscillator';
  enabled: boolean;
  color: string;
  lineWidth: number;
  lineStyle: number;
  parameters: Record<string, number>;
  // Advanced customization options
  opacity?: number; // 0-100
  customLabel?: string;
  priceSource?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
  offset?: number; // Shift indicator forward/backward
  precision?: number; // Decimal places
  showLabel?: boolean;
  // Multi-color support for bands/channels
  colors?: {
    upper?: string;
    middle?: string;
    lower?: string;
    signal?: string;
    histogram?: string;
    positive?: string;
    negative?: string;
  };
  // Oscillator levels
  levels?: {
    overbought?: number;
    oversold?: number;
    threshold?: number;
  };
  // Component visibility
  visibility?: {
    main?: boolean;
    signal?: boolean;
    histogram?: boolean;
    upper?: boolean;
    middle?: boolean;
    lower?: boolean;
  };
}

export const INDICATOR_TEMPLATES = {
  // Moving Averages
  sma: {
    name: 'Simple Moving Average',
    displayType: 'overlay' as const,
    defaultParams: { period: 20 },
    paramLabels: { period: 'Period' }
  },
  ema: {
    name: 'Exponential Moving Average',
    displayType: 'overlay' as const,
    defaultParams: { period: 12 },
    paramLabels: { period: 'Period' }
  },
  wma: {
    name: 'Weighted Moving Average',
    displayType: 'overlay' as const,
    defaultParams: { period: 20 },
    paramLabels: { period: 'Period' }
  },
  
  // Bollinger & Bands
  bb: {
    name: 'Bollinger Bands',
    displayType: 'overlay' as const,
    defaultParams: { period: 20, stdDev: 2 },
    paramLabels: { period: 'Period', stdDev: 'Std Dev' }
  },
  keltner: {
    name: 'Keltner Channels',
    displayType: 'overlay' as const,
    defaultParams: { period: 20, multiplier: 2 },
    paramLabels: { period: 'Period', multiplier: 'Multiplier' }
  },
  
  // Oscillators
  rsi: {
    name: 'RSI',
    displayType: 'oscillator' as const,
    defaultParams: { period: 14 },
    paramLabels: { period: 'Period' }
  },
  macd: {
    name: 'MACD',
    displayType: 'oscillator' as const,
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramLabels: { fast: 'Fast', slow: 'Slow', signal: 'Signal' }
  },
  stoch: {
    name: 'Stochastic',
    displayType: 'oscillator' as const,
    defaultParams: { kPeriod: 14, dPeriod: 3 },
    paramLabels: { kPeriod: '%K', dPeriod: '%D' }
  },
  williamsR: {
    name: 'Williams %R',
    displayType: 'oscillator' as const,
    defaultParams: { period: 14 },
    paramLabels: { period: 'Period' }
  },
  cci: {
    name: 'CCI',
    displayType: 'oscillator' as const,
    defaultParams: { period: 20 },
    paramLabels: { period: 'Period' }
  },
  mfi: {
    name: 'Money Flow Index',
    displayType: 'oscillator' as const,
    defaultParams: { period: 14 },
    paramLabels: { period: 'Period' }
  },
  adx: {
    name: 'ADX',
    displayType: 'oscillator' as const,
    defaultParams: { period: 14 },
    paramLabels: { period: 'Period' }
  },
  
  // Other
  vwap: {
    name: 'VWAP',
    displayType: 'overlay' as const,
    defaultParams: {},
    paramLabels: {}
  },
  atr: {
    name: 'ATR',
    displayType: 'oscillator' as const,
    defaultParams: { period: 14 },
    paramLabels: { period: 'Period' }
  },
  sar: {
    name: 'Parabolic SAR',
    displayType: 'overlay' as const,
    defaultParams: { acceleration: 0.02, maximum: 0.2 },
    paramLabels: { acceleration: 'Acceleration', maximum: 'Maximum' }
  },
  pivots: {
    name: 'Pivot Points',
    displayType: 'overlay' as const,
    defaultParams: {},
    paramLabels: {}
  },
};

const DEFAULT_COLORS = [
  '#2962ff', '#f23645', '#00e676', '#ff6d00', '#9c27b0',
  '#fdd835', '#00bcd4', '#ff4081', '#8bc34a', '#ff9800'
];

const LINE_STYLES = [
  { value: 0, label: 'Solid' },
  { value: 2, label: 'Dashed' },
  { value: 1, label: 'Dotted' },
];

interface AdvancedIndicatorManagerProps {
  indicators: CustomIndicator[];
  onIndicatorsChange: (indicators: CustomIndicator[]) => void;
  portalContainer?: HTMLElement | null;
}

export default function AdvancedIndicatorManager({
  indicators,
  onIndicatorsChange,
  portalContainer
}: AdvancedIndicatorManagerProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('sma');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset position when dialog opens
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  // Mouse down on header - start dragging (disabled on mobile)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // Disable dragging on mobile
    
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  // Mouse move - update position while dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const addIndicator = () => {
    const template = INDICATOR_TEMPLATES[selectedType as keyof typeof INDICATOR_TEMPLATES];
    if (!template) return;

    const colorIndex = indicators.length % DEFAULT_COLORS.length;
    const newIndicator: CustomIndicator = {
      id: `${selectedType}_${Date.now()}`,
      type: selectedType,
      name: `${template.name} (${Object.values(template.defaultParams).join(',') || 'default'})`,
      displayType: template.displayType,
      enabled: true,
      color: DEFAULT_COLORS[colorIndex],
      lineWidth: 2,
      lineStyle: 0,
      parameters: { ...template.defaultParams },
      // Default advanced options
      opacity: 100,
      priceSource: 'close',
      offset: 0,
      precision: 5,
      showLabel: true,
      // Default colors for multi-component indicators
      colors: {
        upper: '#f23645',
        middle: DEFAULT_COLORS[colorIndex],
        lower: '#00e676',
        signal: '#f23645',
        histogram: '#26a69a',
        positive: '#26a69a',
        negative: '#ef5350'
      },
      // Default oscillator levels
      levels: selectedType === 'rsi' || selectedType === 'williamsR' || selectedType === 'cci' || selectedType === 'mfi'
        ? { overbought: selectedType === 'rsi' ? 70 : selectedType === 'williamsR' ? -20 : 100, oversold: selectedType === 'rsi' ? 30 : selectedType === 'williamsR' ? -80 : -100 }
        : selectedType === 'adx'
        ? { threshold: 25 }
        : undefined,
      // Default component visibility
      visibility: {
        main: true,
        signal: true,
        histogram: true,
        upper: true,
        middle: true,
        lower: true
      }
    };

    onIndicatorsChange([...indicators, newIndicator]);
  };

  const removeIndicator = (id: string) => {
    onIndicatorsChange(indicators.filter(ind => ind.id !== id));
  };

  const duplicateIndicator = (indicator: CustomIndicator) => {
    const newIndicator: CustomIndicator = {
      ...indicator,
      id: `${indicator.type}_${Date.now()}`,
      name: `${indicator.name} (Copy)`
    };
    onIndicatorsChange([...indicators, newIndicator]);
  };

  const toggleIndicator = (id: string) => {
    onIndicatorsChange(
      indicators.map(ind =>
        ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
      )
    );
  };

  const updateIndicator = (id: string, updates: Partial<CustomIndicator>) => {
    log('🔧 Updating indicator:', id, 'with updates:', updates);
    const updatedIndicators = indicators.map(ind => {
      if (ind.id === id) {
        const updated = { ...ind, ...updates };
        log('   Before:', ind);
        log('   After:', updated);
        return updated;
      }
      return ind;
    });
    log('📤 Calling onIndicatorsChange with:', updatedIndicators);
    onIndicatorsChange(updatedIndicators);
  };

  const enabledCount = indicators.filter(ind => ind.enabled).length;
  const overlayIndicators = indicators.filter(ind => ind.displayType === 'overlay');
  const oscillatorIndicators = indicators.filter(ind => ind.displayType === 'oscillator');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn(
          "hover:bg-[#2a2e39] relative",
          "h-8 w-10 p-0 text-[#787b86]"
        )}
        title={`Indicators${enabledCount > 0 ? ` (${enabledCount} active)` : ''}`}
      >
        <Activity className="h-4 w-4" />
        {enabledCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-[#2962ff] rounded-full text-[9px] flex items-center justify-center text-white font-bold">
            {enabledCount}
          </span>
        )}
      </Button>
      
      <DialogContent 
        ref={dialogRef}
        container={portalContainer}
        className="bg-[#131722] border-[#2b2b43] text-white max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col"
        style={isMobile ? undefined : {
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          cursor: isDragging ? 'grabbing' : 'default',
          left: '50%',
          top: '50%'
        }}
        onMouseDown={isMobile ? undefined : handleMouseDown}
      >
        <DialogHeader 
          className={cn(
            "select-none",
            !isMobile && "drag-handle cursor-grab active:cursor-grabbing"
          )}
        >
          <DialogTitle className="text-white flex items-center gap-2">
            {!isMobile && <Move className="h-4 w-4 text-[#787b86]" />}
            <Activity className="h-5 w-5" />
            Indicator Manager
            {!isMobile && <span className="text-xs text-[#787b86] ml-auto">Drag to move</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">Add and configure chart indicators</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 mt-4 pr-2">
          {/* Add New Indicator */}
          <div className="bg-[#1e222d] p-4 rounded-lg border border-[#2b2b43]">
            <h3 className="text-sm font-semibold text-[#d1d4dc] mb-3">Add Indicator</h3>
            <div className="flex gap-2">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="flex-1 bg-[#131722] border-[#2b2b43] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e222d] border-[#2b2b43] max-h-80" container={portalContainer}>
                  <div className="p-2 text-xs font-semibold text-[#787b86]">Moving Averages</div>
                  {['sma', 'ema', 'wma'].map(type => (
                    <SelectItem key={type} value={type} className="text-white">
                      {INDICATOR_TEMPLATES[type as keyof typeof INDICATOR_TEMPLATES].name}
                    </SelectItem>
                  ))}
                  
                  <div className="p-2 text-xs font-semibold text-[#787b86] border-t border-[#2b2b43] mt-2">Bands & Channels</div>
                  {['bb', 'keltner'].map(type => (
                    <SelectItem key={type} value={type} className="text-white">
                      {INDICATOR_TEMPLATES[type as keyof typeof INDICATOR_TEMPLATES].name}
                    </SelectItem>
                  ))}
                  
                  <div className="p-2 text-xs font-semibold text-[#787b86] border-t border-[#2b2b43] mt-2">Oscillators</div>
                  {['rsi', 'macd', 'stoch', 'williamsR', 'cci', 'mfi', 'adx'].map(type => (
                    <SelectItem key={type} value={type} className="text-white">
                      {INDICATOR_TEMPLATES[type as keyof typeof INDICATOR_TEMPLATES].name}
                    </SelectItem>
                  ))}
                  
                  <div className="p-2 text-xs font-semibold text-[#787b86] border-t border-[#2b2b43] mt-2">Other</div>
                  {['vwap', 'atr', 'sar', 'pivots'].map(type => (
                    <SelectItem key={type} value={type} className="text-white">
                      {INDICATOR_TEMPLATES[type as keyof typeof INDICATOR_TEMPLATES].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                onClick={addIndicator}
                className="bg-[#2962ff] hover:bg-[#1e4db7] text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Overlay Indicators */}
          {overlayIndicators.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#d1d4dc] mb-3">Overlay Indicators</h3>
              <div className="space-y-2">
                {overlayIndicators.map(indicator => (
                  <IndicatorItem
                    key={indicator.id}
                    indicator={indicator}
                    isEditing={editingId === indicator.id}
                    onToggle={() => toggleIndicator(indicator.id)}
                    onEdit={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                    onDuplicate={() => duplicateIndicator(indicator)}
                    onRemove={() => removeIndicator(indicator.id)}
                    onUpdate={(updates) => updateIndicator(indicator.id, updates)}
                    portalContainer={portalContainer}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Oscillator Indicators */}
          {oscillatorIndicators.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#d1d4dc] mb-3">Oscillator Indicators</h3>
              <div className="space-y-2">
                {oscillatorIndicators.map(indicator => (
                  <IndicatorItem
                    key={indicator.id}
                    indicator={indicator}
                    isEditing={editingId === indicator.id}
                    onToggle={() => toggleIndicator(indicator.id)}
                    onEdit={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                    onDuplicate={() => duplicateIndicator(indicator)}
                    onRemove={() => removeIndicator(indicator.id)}
                    onUpdate={(updates) => updateIndicator(indicator.id, updates)}
                    portalContainer={portalContainer}
                  />
                ))}
              </div>
            </div>
          )}

          {indicators.length === 0 && (
            <div className="text-center py-8 text-[#787b86]">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No indicators added yet</p>
              <p className="text-xs mt-1">Select an indicator above and click Add</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Individual Indicator Item Component
function IndicatorItem({
  indicator,
  isEditing,
  onToggle,
  onEdit,
  onDuplicate,
  onRemove,
  onUpdate,
  portalContainer
}: {
  indicator: CustomIndicator;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<CustomIndicator>) => void;
  portalContainer?: HTMLElement | null;
}) {
  const template = INDICATOR_TEMPLATES[indicator.type as keyof typeof INDICATOR_TEMPLATES];

  return (
    <div className="bg-[#1e222d] rounded-lg border border-[#2b2b43] overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="checkbox"
            checked={indicator.enabled}
            onChange={onToggle}
            className="w-4 h-4 rounded border-[#787b86] bg-[#131722]"
          />
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: indicator.color }}
          />
          <span className={cn("font-medium", !indicator.enabled && "text-[#787b86]")}>
            {indicator.name}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 p-0 hover:bg-[#2a2e39]"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDuplicate}
            className="h-7 w-7 p-0 hover:bg-[#2a2e39]"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="h-7 w-7 p-0 hover:bg-[#2a2e39] text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Advanced Edit Panel */}
      {isEditing && (
        <div className="border-t border-[#2b2b43] bg-[#131722]">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full grid grid-cols-4 bg-[#1e222d] rounded-none">
              <TabsTrigger value="basic" className="text-xs data-[state=active]:bg-[#2962ff]">
                <Settings className="h-3 w-3 mr-1" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="appearance" className="text-xs data-[state=active]:bg-[#2962ff]">
                <Palette className="h-3 w-3 mr-1" />
                Colors
              </TabsTrigger>
              <TabsTrigger value="params" className="text-xs data-[state=active]:bg-[#2962ff]">
                <TrendingUp className="h-3 w-3 mr-1" />
                Parameters
              </TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs data-[state=active]:bg-[#2962ff]">
                <Layers className="h-3 w-3 mr-1" />
                Advanced
              </TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="p-3 space-y-3">
              {/* Custom Label */}
              <div>
                <Label className="text-xs text-[#787b86] mb-1">Custom Label</Label>
                <Input
                  value={indicator.customLabel || indicator.name}
                  onChange={(e) => onUpdate({ customLabel: e.target.value })}
                  placeholder={indicator.name}
                  className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                />
              </div>

              {/* Line Properties */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#787b86] mb-1">Line Width ({indicator.lineWidth})</Label>
                  <Slider
                    value={[indicator.lineWidth]}
                    onValueChange={(value) => onUpdate({ lineWidth: value[0] })}
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-[#787b86] mb-1">Opacity ({indicator.opacity || 100}%)</Label>
                  <Slider
                    value={[indicator.opacity || 100]}
                    onValueChange={(value) => onUpdate({ opacity: value[0] })}
                    min={10}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Line Style & Show Label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#787b86] mb-1">Line Style</Label>
                  <Select
                    value={String(indicator.lineStyle)}
                    onValueChange={(value) => onUpdate({ lineStyle: Number(value) })}
                  >
                    <SelectTrigger className="h-8 bg-[#1e222d] border-[#2b2b43] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e222d] border-[#2b2b43]" container={portalContainer}>
                      {LINE_STYLES.map(style => (
                        <SelectItem key={style.value} value={String(style.value)} className="text-white">
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-[#787b86] mb-1">Show Label</Label>
                  <Select
                    value={String(indicator.showLabel !== false)}
                    onValueChange={(value) => onUpdate({ showLabel: value === 'true' })}
                  >
                    <SelectTrigger className="h-8 bg-[#1e222d] border-[#2b2b43] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e222d] border-[#2b2b43]" container={portalContainer}>
                      <SelectItem value="true" className="text-white">Yes</SelectItem>
                      <SelectItem value="false" className="text-white">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Colors Tab */}
            <TabsContent value="appearance" className="p-3 space-y-3">
              {/* Main Color */}
              <div>
                <Label className="text-xs text-[#787b86] mb-1">Main Color</Label>
                <input
                  type="color"
                  value={indicator.color}
                  onChange={(e) => onUpdate({ color: e.target.value })}
                  className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                />
              </div>

              {/* Multi-color options for bands/channels */}
              {(indicator.type === 'bb' || indicator.type === 'keltner') && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">Upper Band</Label>
                      <input
                        type="color"
                        value={indicator.colors?.upper || '#f23645'}
                        onChange={(e) => onUpdate({ 
                          colors: { ...indicator.colors, upper: e.target.value }
                        })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">Middle Band</Label>
                      <input
                        type="color"
                        value={indicator.colors?.middle || indicator.color}
                        onChange={(e) => onUpdate({ 
                          colors: { ...indicator.colors, middle: e.target.value }
                        })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">Lower Band</Label>
                      <input
                        type="color"
                        value={indicator.colors?.lower || '#00e676'}
                        onChange={(e) => onUpdate({ 
                          colors: { ...indicator.colors, lower: e.target.value }
                        })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                  </div>

                  {/* Band Visibility */}
                  <div>
                    <Label className="text-xs text-[#787b86] mb-2 block">Band Visibility</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={indicator.visibility?.upper !== false}
                          onChange={(e) => onUpdate({
                            visibility: { ...indicator.visibility, upper: e.target.checked }
                          })}
                          className="rounded"
                        />
                        Upper
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={indicator.visibility?.middle !== false}
                          onChange={(e) => onUpdate({
                            visibility: { ...indicator.visibility, middle: e.target.checked }
                          })}
                          className="rounded"
                        />
                        Middle
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={indicator.visibility?.lower !== false}
                          onChange={(e) => onUpdate({
                            visibility: { ...indicator.visibility, lower: e.target.checked }
                          })}
                          className="rounded"
                        />
                        Lower
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* MACD Colors */}
              {indicator.type === 'macd' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">MACD Line</Label>
                      <input
                        type="color"
                        value={indicator.color}
                        onChange={(e) => onUpdate({ color: e.target.value })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">Signal Line</Label>
                      <input
                        type="color"
                        value={indicator.colors?.signal || '#f23645'}
                        onChange={(e) => onUpdate({ 
                          colors: { ...indicator.colors, signal: e.target.value }
                        })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">Positive Histogram</Label>
                      <input
                        type="color"
                        value={indicator.colors?.positive || '#26a69a'}
                        onChange={(e) => onUpdate({ 
                          colors: { ...indicator.colors, positive: e.target.value }
                        })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#787b86] mb-1">Negative Histogram</Label>
                      <input
                        type="color"
                        value={indicator.colors?.negative || '#ef5350'}
                        onChange={(e) => onUpdate({ 
                          colors: { ...indicator.colors, negative: e.target.value }
                        })}
                        className="w-full h-10 rounded border border-[#2b2b43] bg-[#1e222d]"
                      />
                    </div>
                  </div>

                  {/* MACD Component Visibility */}
                  <div>
                    <Label className="text-xs text-[#787b86] mb-2 block">Component Visibility</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={indicator.visibility?.main !== false}
                          onChange={(e) => onUpdate({
                            visibility: { ...indicator.visibility, main: e.target.checked }
                          })}
                          className="rounded"
                        />
                        MACD
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={indicator.visibility?.signal !== false}
                          onChange={(e) => onUpdate({
                            visibility: { ...indicator.visibility, signal: e.target.checked }
                          })}
                          className="rounded"
                        />
                        Signal
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={indicator.visibility?.histogram !== false}
                          onChange={(e) => onUpdate({
                            visibility: { ...indicator.visibility, histogram: e.target.checked }
                          })}
                          className="rounded"
                        />
                        Histogram
                      </label>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Parameters Tab */}
            <TabsContent value="params" className="p-3 space-y-3">
              {Object.keys(indicator.parameters).length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(indicator.parameters).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs text-[#787b86] mb-1 capitalize">
                        {(template?.paramLabels as Record<string, string>)?.[key] || key}
                      </Label>
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          onUpdate({
                            parameters: {
                              ...indicator.parameters,
                              [key]: Number(e.target.value)
                            }
                          })
                        }
                        step="0.01"
                        className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#787b86] text-center py-4">
                  No parameters available for this indicator
                </p>
              )}
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="p-3 space-y-3">
              {/* Price Source */}
              <div>
                <Label className="text-xs text-[#787b86] mb-1">Price Source</Label>
                <Select
                  value={indicator.priceSource || 'close'}
                  onValueChange={(value) => onUpdate({ priceSource: value as 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4' })}
                >
                  <SelectTrigger className="h-8 bg-[#1e222d] border-[#2b2b43] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e222d] border-[#2b2b43]" container={portalContainer}>
                    <SelectItem value="close" className="text-white">Close</SelectItem>
                    <SelectItem value="open" className="text-white">Open</SelectItem>
                    <SelectItem value="high" className="text-white">High</SelectItem>
                    <SelectItem value="low" className="text-white">Low</SelectItem>
                    <SelectItem value="hl2" className="text-white">HL/2</SelectItem>
                    <SelectItem value="hlc3" className="text-white">HLC/3</SelectItem>
                    <SelectItem value="ohlc4" className="text-white">OHLC/4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Offset & Precision */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[#787b86] mb-1">Offset (Shift)</Label>
                  <Input
                    type="number"
                    value={indicator.offset || 0}
                    onChange={(e) => onUpdate({ offset: Number(e.target.value) })}
                    className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                  />
                </div>

                <div>
                  <Label className="text-xs text-[#787b86] mb-1">Precision (Decimals)</Label>
                  <Input
                    type="number"
                    value={indicator.precision || 5}
                    onChange={(e) => onUpdate({ precision: Number(e.target.value) })}
                    min={0}
                    max={8}
                    className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                  />
                </div>
              </div>

              {/* Oscillator Levels */}
              {indicator.displayType === 'oscillator' && indicator.levels && (
                <>
                  <div>
                    <Label className="text-xs text-[#787b86] mb-2 block">Custom Levels</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {indicator.levels.overbought !== undefined && (
                        <div>
                          <Label className="text-xs text-[#787b86] mb-1">Overbought</Label>
                          <Input
                            type="number"
                            value={indicator.levels.overbought}
                            onChange={(e) => onUpdate({
                              levels: { ...indicator.levels, overbought: Number(e.target.value) }
                            })}
                            className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                          />
                        </div>
                      )}
                      
                      {indicator.levels.oversold !== undefined && (
                        <div>
                          <Label className="text-xs text-[#787b86] mb-1">Oversold</Label>
                          <Input
                            type="number"
                            value={indicator.levels.oversold}
                            onChange={(e) => onUpdate({
                              levels: { ...indicator.levels, oversold: Number(e.target.value) }
                            })}
                            className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                          />
                        </div>
                      )}

                      {indicator.levels.threshold !== undefined && (
                        <div>
                          <Label className="text-xs text-[#787b86] mb-1">Threshold</Label>
                          <Input
                            type="number"
                            value={indicator.levels.threshold}
                            onChange={(e) => onUpdate({
                              levels: { ...indicator.levels, threshold: Number(e.target.value) }
                            })}
                            className="h-8 bg-[#1e222d] border-[#2b2b43] text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

