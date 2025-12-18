'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updatePositionTPSL } from '@/lib/actions/trading/position.actions';
import { toast } from 'sonner';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Target, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateUnrealizedPnL, FOREX_PAIRS, ForexSymbol } from '@/lib/services/pnl-calculator.service';

interface Position {
  _id: string;
  symbol: ForexSymbol;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  marginUsed: number;
}

interface EditPositionModalProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedData: { takeProfit?: number; stopLoss?: number }) => void;
}

const EditPositionModal = ({ position, isOpen, onClose, onSuccess }: EditPositionModalProps) => {
  const [loading, setLoading] = useState(false);
  
  // TP/SL Input Modes
  const [tpMode, setTpMode] = useState<'price' | 'pips'>('pips');
  const [slMode, setSlMode] = useState<'price' | 'pips'>('pips');
  
  // TP/SL Values
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>('');
  const [takeProfitPips, setTakeProfitPips] = useState<string>('');
  const [stopLossPrice, setStopLossPrice] = useState<string>('');
  const [stopLossPips, setStopLossPips] = useState<string>('');
  
  // Enable/Disable TP/SL
  const [enableTP, setEnableTP] = useState(false);
  const [enableSL, setEnableSL] = useState(false);

  useEffect(() => {
    if (position) {
      // Initialize TP
      if (position.takeProfit) {
        setEnableTP(true);
        setTakeProfitPrice(position.takeProfit.toFixed(5));
        const pipValue = FOREX_PAIRS[position.symbol].pip;
        const pips = Math.abs((position.takeProfit - position.entryPrice) / pipValue);
        setTakeProfitPips(pips.toFixed(1));
      } else {
        setEnableTP(false);
        setTakeProfitPrice('');
        setTakeProfitPips('50'); // Default 50 pips
      }
      
      // Initialize SL
      if (position.stopLoss) {
        setEnableSL(true);
        setStopLossPrice(position.stopLoss.toFixed(5));
        const pipValue = FOREX_PAIRS[position.symbol].pip;
        const pips = Math.abs((position.stopLoss - position.entryPrice) / pipValue);
        setStopLossPips(pips.toFixed(1));
      } else {
        setEnableSL(false);
        setStopLossPrice('');
        setStopLossPips('30'); // Default 30 pips
      }
    }
  }, [position]);

  if (!position) return null;

  const pipValue = FOREX_PAIRS[position.symbol].pip;

  // Calculate TP price from pips
  const calculateTPFromPips = (pips: number): number => {
    if (position.side === 'long') {
      return position.entryPrice + (pips * pipValue);
    } else {
      return position.entryPrice - (pips * pipValue);
    }
  };

  // Calculate SL price from pips
  const calculateSLFromPips = (pips: number): number => {
    if (position.side === 'long') {
      return position.entryPrice - (pips * pipValue);
    } else {
      return position.entryPrice + (pips * pipValue);
    }
  };

  // Get effective TP price
  const getEffectiveTPPrice = (): number | null => {
    if (!enableTP) return null;
    if (tpMode === 'price') {
      return takeProfitPrice ? parseFloat(takeProfitPrice) : null;
    } else {
      return takeProfitPips ? calculateTPFromPips(parseFloat(takeProfitPips)) : null;
    }
  };

  // Get effective SL price
  const getEffectiveSLPrice = (): number | null => {
    if (!enableSL) return null;
    if (slMode === 'price') {
      return stopLossPrice ? parseFloat(stopLossPrice) : null;
    } else {
      return stopLossPips ? calculateSLFromPips(parseFloat(stopLossPips)) : null;
    }
  };

  // Calculate potential P&L for TP
  const calculateTPPnL = (): number | null => {
    const tpPrice = getEffectiveTPPrice();
    if (!tpPrice) return null;
    
    return calculateUnrealizedPnL(
      position.side,
      position.entryPrice,
      tpPrice,
      position.quantity,
      position.symbol
    );
  };

  // Calculate potential P&L for SL
  const calculateSLPnL = (): number | null => {
    const slPrice = getEffectiveSLPrice();
    if (!slPrice) return null;
    
    return calculateUnrealizedPnL(
      position.side,
      position.entryPrice,
      slPrice,
      position.quantity,
      position.symbol
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const tpPrice = getEffectiveTPPrice();
      const slPrice = getEffectiveSLPrice();

      // Validation
      if (enableTP && tpPrice) {
        const isValid = position.side === 'long' ? tpPrice > position.currentPrice : tpPrice < position.currentPrice;
        if (!isValid) {
          toast.error('Invalid Take Profit', {
            description: position.side === 'long' 
              ? 'Take Profit must be above current price for long positions'
              : 'Take Profit must be below current price for short positions'
          });
          setLoading(false);
          return;
        }
      }

      if (enableSL && slPrice) {
        const isValid = position.side === 'long' ? slPrice < position.currentPrice : slPrice > position.currentPrice;
        if (!isValid) {
          toast.error('Invalid Stop Loss', {
            description: position.side === 'long' 
              ? 'Stop Loss must be below current price for long positions'
              : 'Stop Loss must be above current price for short positions'
          });
          setLoading(false);
          return;
        }
      }

      const result = await updatePositionTPSL(position._id, tpPrice, slPrice);

      if (result.success) {
        toast.success('Position updated successfully!', {
          description: 'Your TP/SL levels have been set'
        });
        // Pass updated TP/SL values back to parent for immediate UI update
        onSuccess({
          takeProfit: result.position?.takeProfit,
          stopLoss: result.position?.stopLoss
        });
        onClose();
      } else {
        throw new Error(result.error || 'Failed to update position');
      }
    } catch (error) {
      toast.error('Failed to update position', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const tpPnL = calculateTPPnL();
  const slPnL = calculateSLPnL();
  const tpPrice = getEffectiveTPPrice();
  const slPrice = getEffectiveSLPrice();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#1e222d] border-[#2b2b43] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Edit Position - {position.symbol}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Position Info */}
          <div className="bg-[#131722] rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-dark-600">Side</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs font-semibold',
                position.side === 'long' ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'
              )}>
                {position.side === 'long' ? (
                  <><TrendingUp className="inline size-3 mr-1" />LONG</>
                ) : (
                  <><TrendingDown className="inline size-3 mr-1" />SHORT</>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-dark-600">Entry Price</span>
              <span className="text-white font-mono">{position.entryPrice.toFixed(5)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-dark-600">Current Price</span>
              <span className="text-white font-mono">{position.currentPrice.toFixed(5)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-dark-600">Quantity</span>
              <span className="text-white font-mono">{position.quantity} lots</span>
            </div>
          </div>

          {/* Take Profit Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                <Label className="text-base font-semibold text-white">Take Profit</Label>
              </div>
              <Switch checked={enableTP} onCheckedChange={setEnableTP} />
            </div>

            {enableTP && (
              <div className="space-y-4 pl-7">
                <Tabs value={tpMode} onValueChange={(v) => setTpMode(v as 'price' | 'pips')}>
                  <TabsList className="grid w-full grid-cols-2 bg-[#131722]">
                    <TabsTrigger value="pips">Pips</TabsTrigger>
                    <TabsTrigger value="price">Price</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pips" className="mt-4">
                    <Label className="text-sm text-dark-600">Pips from Entry</Label>
                    <Input
                      type="number"
                      value={takeProfitPips}
                      onChange={(e) => setTakeProfitPips(e.target.value)}
                      placeholder="50"
                      className="bg-[#131722] border-[#2b2b43] text-white mt-2"
                    />
                    {takeProfitPips && (
                      <p className="text-xs text-dark-600 mt-1">
                        Price: {calculateTPFromPips(parseFloat(takeProfitPips)).toFixed(5)}
                      </p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="price" className="mt-4">
                    <Label className="text-sm text-dark-600">Target Price</Label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={takeProfitPrice}
                      onChange={(e) => setTakeProfitPrice(e.target.value)}
                      placeholder={position.entryPrice.toFixed(5)}
                      className="bg-[#131722] border-[#2b2b43] text-white mt-2"
                    />
                  </TabsContent>
                </Tabs>

                {tpPnL !== null && tpPrice && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-400 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Potential Profit
                      </span>
                      <span className="text-lg font-bold text-green-400">
                        +${tpPnL.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-dark-600 mt-1">
                      At price: {tpPrice.toFixed(5)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stop Loss Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                <Label className="text-base font-semibold text-white">Stop Loss</Label>
              </div>
              <Switch checked={enableSL} onCheckedChange={setEnableSL} />
            </div>

            {enableSL && (
              <div className="space-y-4 pl-7">
                <Tabs value={slMode} onValueChange={(v) => setSlMode(v as 'price' | 'pips')}>
                  <TabsList className="grid w-full grid-cols-2 bg-[#131722]">
                    <TabsTrigger value="pips">Pips</TabsTrigger>
                    <TabsTrigger value="price">Price</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pips" className="mt-4">
                    <Label className="text-sm text-dark-600">Pips from Entry</Label>
                    <Input
                      type="number"
                      value={stopLossPips}
                      onChange={(e) => setStopLossPips(e.target.value)}
                      placeholder="30"
                      className="bg-[#131722] border-[#2b2b43] text-white mt-2"
                    />
                    {stopLossPips && (
                      <p className="text-xs text-dark-600 mt-1">
                        Price: {calculateSLFromPips(parseFloat(stopLossPips)).toFixed(5)}
                      </p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="price" className="mt-4">
                    <Label className="text-sm text-dark-600">Stop Price</Label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(e.target.value)}
                      placeholder={position.entryPrice.toFixed(5)}
                      className="bg-[#131722] border-[#2b2b43] text-white mt-2"
                    />
                  </TabsContent>
                </Tabs>

                {slPnL !== null && slPrice && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-400 flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Potential Loss
                      </span>
                      <span className="text-lg font-bold text-red-400">
                        {slPnL.toFixed(2) > '0' ? '+' : ''}${slPnL.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-dark-600 mt-1">
                      At price: {slPrice.toFixed(5)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 bg-[#131722] border-[#2b2b43] hover:bg-[#1a1e2e]"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditPositionModal;

