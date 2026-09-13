# Fractal Pulse Grid - Premium Overlay Indicator

## What It Does

The **Fractal Pulse Grid** is an adaptive market structure overlay that reveals the most important price levels on your chart — automatically. Instead of drawing support/resistance lines manually, this indicator uses a volatility-adaptive fractal algorithm to detect true swing highs and swing lows, then tracks which levels are still "alive" (untested or holding) versus broken.

Three components rendered on chart:

- **Red dashed line** = Active structural resistance (nearest unbroken swing high above price)
- **Green dashed line** = Active structural support (nearest unbroken swing low below price)
- **Golden solid line** = Pulse line — adaptive midpoint showing the structural bias direction

This is completely different from the other two premium indicators:

- **NTM** answers: "What is the trend and how strong is it?" (KAMA + ATR bands)
- **PFZ** answers: "Where is smart money buying/selling?" (volume absorption + wick zones)
- **FPG** answers: "What are the key structural levels and is the structure bullish or bearish?" (fractal swing detection + level tracking)

## How It Works (Calculation)

### 1. Adaptive Fractal Detection

Unlike basic Williams Fractals (fixed 2-bar lookback), this uses a volatility-adaptive lookback:
- Compute ATR(atrPeriod) for current volatility
- Compute a volatility ratio: current ATR / SMA(ATR, period)
- Adaptive lookback = base lookback adjusted by volatility ratio (higher vol = more confirmation needed)
- A swing high requires N bars with lower highs on each side
- A swing low requires N bars with higher lows on each side

### 2. Structure Level Tracking

Maintains a rolling list of confirmed swing highs and lows:
- Each level tracks: price, bar index, number of times tested (price approached but didn't break)
- A resistance level is "broken" when price closes above it by a tolerance (0.25 * ATR)
- A support level is "broken" when price closes below it by the same tolerance
- Broken levels are removed from the active list
- Levels older than `maxAge` bars are expired and removed

### 3. Best Level Selection

For each bar, select the most relevant resistance and support:
- **Active resistance**: Closest unbroken swing high above current price, weighted by recency and test count
- **Active support**: Closest unbroken swing low below current price, weighted by recency and test count

### 4. Pulse Line

A volume-weighted adaptive midpoint of the structure:
- Base = midpoint of active resistance and support
- Smoothed with EMA(smoothPeriod) that adapts: faster when structure is shifting, slower when stable
- Bias direction: when pulse line is rising = bullish structure, falling = bearish

### Output

`{ time, resistance, support, pulseLine, structureBias }` where:
- `resistance`: Price level of active resistance (NaN if none)
- `support`: Price level of active support (NaN if none)
- `pulseLine`: Smoothed structural midpoint
- `structureBias`: -100 to +100 score (positive = bullish structure, negative = bearish)

## Files to Modify (same 7-file pattern)

### 1. Calculation function

- **File**: lib/services/indicators.service.ts
- **Change**: Add `FractalPulseGridData` interface and `calculateFractalPulseGrid()` function at the end

### 2. IndicatorType enum (both model files)

- **Files**: database/models/marketplace/marketplace-item.model.ts and apps/admin/database/models/marketplace/marketplace-item.model.ts
- **Change**: Add `"fractal_pulse_grid"` to the IndicatorType union and the Mongoose enum array

### 3. INDICATOR_TYPE_MAP + marketplaceItemToIndicator

- **File**: contexts/TradingArsenalContext.tsx
- **Change**: Add map entry and parameter defaults (period, atrPeriod, baseLookback, maxAge, smoothPeriod, breakTolerance)

### 4. Chart rendering

- **File**: components/trading/LightweightTradingChart.tsx
- **Change**: Add rendering block with 3 LineSeries: resistance (red, dashed), support (green, dashed), pulse line (golden, solid). Add refresh handler in overlay closure.

### 5. Marketplace seed (both files)

- **Files**: lib/services/marketplace-seed.service.ts and apps/admin/lib/services/marketplace-seed.service.ts
- **Change**: Add `FRACTAL_PULSE_GRID` constant with marketplace description and add to `ALL_ITEMS`

### 6. AdvancedIndicatorManager template

- **File**: components/trading/AdvancedIndicatorManager.tsx
- **Change**: Add template entry with parameter labels

## Marketplace Item Details

- **Name**: Fractal Pulse Grid
- **Slug**: `fractal-pulse-grid`
- **Category**: `indicator`
- **IndicatorType**: `fractal_pulse_grid`
- **Price**: 139 credits (highest tier — structural analysis)
- **Risk Level**: `medium`
- **Tags**: `["structure", "fractals", "support-resistance", "swing", "adaptive", "premium", "overlay", "smart-money"]`

## Default Settings

- `period`: 20 (volatility normalization window)
- `atrPeriod`: 14 (ATR calculation period)
- `baseLookback`: 3 (minimum fractal confirmation bars per side)
- `maxAge`: 100 (maximum bars a level persists before expiring)
- `smoothPeriod`: 8 (pulse line EMA smoothing)
- `breakTolerance`: 0.25 (ATR fraction needed to confirm a level break)

## How It Differs from NTM and PFZ

| Feature | Nexus Trend Matrix | Phantom Flow Zones | Fractal Pulse Grid |
|---------|-------------------|-------------------|-------------------|
| Core method | KAMA + ATR bands | Volume absorption + wick rejection | Adaptive fractals + structure tracking |
| Answers | "What's the trend?" | "Where is smart money?" | "What are the key levels?" |
| Visual | 3 bands around price | Horizontal zones at specific levels | Resistance/support grid + pulse line |
| Data used | Price + volatility | Price + volume | Price + volatility (structure) |
| Update style | Continuous bands | Zones appear/disappear | Levels shift on structure breaks |
