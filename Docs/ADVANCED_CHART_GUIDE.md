# 📊 Advanced Chart Guide

## Overview

The **Advanced Chart** widget provides a powerful, professional-grade trading chart with full technical analysis capabilities. It includes comprehensive customization options for symbol selection, chart styles, timeframes, and toolbar features.

**Reference**: [TradingView Advanced Chart Widget Documentation](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/)

---

## 📍 Location

The Advanced Chart is positioned in the **right column, below Market Data**, and sits next to the Economic Calendar.

```
┌──────────────────────────────────────────────────────┐
│  📈 Ticker Tape (Full Width)                         │
├─────────────────┬────────────────────────────────────┤
│ Market Overview │  Stock Heatmap (with settings)     │
├─────────────────┼────────────────────────────────────┤
│  Top Stories    │                                    │
├─────────────────┤  Market Data                       │
│  📅 Economic    ├────────────────────────────────────┤
│    Calendar     │  📊 Advanced Chart                 │
│  (with settings)│     (with settings)                │
└─────────────────┴────────────────────────────────────┘
```

---

## 🎯 Key Features

### **Professional Trading Tools** 📈
- ✅ **Multiple Chart Types** - Candlesticks, Bars, Line, Area, Heikin Ashi, Renko
- ✅ **Drawing Tools** - Trendlines, Fibonacci, shapes, annotations
- ✅ **Technical Indicators** - 100+ built-in indicators (Moving Averages, RSI, MACD, etc.)
- ✅ **Timeframe Selection** - From 1-minute to monthly charts
- ✅ **Multiple Overlays** - Compare symbols, add indicators

### **Customizable Interface** ⚙️
- ✅ **Symbol Search** - Quick access to any stock, crypto, forex, or index
- ✅ **Toolbar Control** - Show/hide top and side toolbars
- ✅ **Legend Display** - Toggle OHLC values
- ✅ **Timezone Selection** - 12+ global timezones
- ✅ **Theme Options** - Dark/Light mode

### **Advanced Functionality** 🚀
- ✅ **Save Charts** - Persistent layouts and drawings
- ✅ **Screenshot Export** - Download chart images
- ✅ **Fullscreen Mode** - Pop-out to new window
- ✅ **Watchlists** - Quick symbol switching
- ✅ **Economic Calendar Integration** - Event markers on chart

---

## ⚙️ Comprehensive Settings

Click the **"Customize"** button (yellow) in the top-right corner to access all settings:

---

## 📊 **Section 1: Symbol Selection**

### **Quick Select Dropdown**

Choose from 12 popular pre-configured symbols:

#### **Technology Stocks:**
- 🍎 **Apple (AAPL)** - NASDAQ:AAPL
- 🪟 **Microsoft (MSFT)** - NASDAQ:MSFT
- 🔍 **Google (GOOGL)** - NASDAQ:GOOGL
- 📦 **Amazon (AMZN)** - NASDAQ:AMZN
- 🚗 **Tesla (TSLA)** - NASDAQ:TSLA
- 📘 **Meta (META)** - NASDAQ:META
- 🎮 **NVIDIA (NVDA)** - NASDAQ:NVDA

#### **Financial Stocks:**
- 🏦 **JPMorgan (JPM)** - NYSE:JPM
- 💳 **Visa (V)** - NYSE:V

#### **Cryptocurrencies:**
- ₿ **Bitcoin (BTC)** - BINANCE:BTCUSDT
- Ξ **Ethereum (ETH)** - BINANCE:ETHUSDT

#### **Market Indices:**
- 📊 **S&P 500** - FOREXCOM:SPXUSD

---

### **Custom Symbol Input**

Enter any symbol in the format: **EXCHANGE:SYMBOL**

**Examples:**
```
NASDAQ:TSLA    → Tesla on NASDAQ
NYSE:DIS       → Disney on NYSE
BINANCE:ADAUSDT → Cardano crypto
FX:EURUSD      → Euro/Dollar forex
```

**How to Use:**
1. Type symbol in input field
2. Click "Apply" button or press Enter
3. Chart updates immediately

**Current Symbol Display:**
- Shows which symbol is currently loaded
- Updates in real-time when changed

---

## 🎨 **Section 2: Chart Style**

### **Chart Type** (8 Options)

Control how price data is visualized:

| Style | Description | Best For |
|-------|-------------|----------|
| **Candlesticks** | Classic OHLC candles | Most traders (default) |
| **Hollow Candles** | Colored by close vs. open | Cleaner view |
| **Bars** | OHLC bars | Professional traders |
| **Line** | Close-to-close line | Simple trend view |
| **Area** | Filled area chart | Presentations |
| **Heikin Ashi** | Smoothed candles | Trend identification |
| **Baseline** | Above/below baseline | Relative performance |
| **Renko** | Brick-based chart | Noise filtering |

**Default**: Candlesticks (style: '1')

---

### **Timeframe** (9 Options)

Set the time period for each candle/bar:

| Timeframe | Code | Usage |
|-----------|------|-------|
| **1 Minute** | '1' | Scalping, day trading |
| **5 Minutes** | '5' | Intraday trading |
| **15 Minutes** | '15' | Short-term swing trading |
| **30 Minutes** | '30' | Day trading |
| **1 Hour** | '60' | Swing trading |
| **4 Hours** | '240' | Position trading |
| **Daily** | 'D' | Most common (default) |
| **Weekly** | 'W' | Long-term analysis |
| **Monthly** | 'M' | Macro trends |

**Default**: Daily ('D')

---

### **Timezone** (12 Options)

Display times in your preferred timezone:

**Americas:**
- 🇺🇸 **New York (EST)** - America/New_York
- 🇺🇸 **Los Angeles (PST)** - America/Los_Angeles
- 🇺🇸 **Chicago (CST)** - America/Chicago

**Europe:**
- 🇬🇧 **London (GMT)** - Europe/London
- 🇫🇷 **Paris (CET)** - Europe/Paris
- 🇷🇺 **Moscow (MSK)** - Europe/Moscow

**Asia:**
- 🇯🇵 **Tokyo (JST)** - Asia/Tokyo
- 🇨🇳 **Shanghai (CST)** - Asia/Shanghai
- 🇭🇰 **Hong Kong (HKT)** - Asia/Hong_Kong
- 🇦🇪 **Dubai (GST)** - Asia/Dubai

**Pacific:**
- 🇦🇺 **Sydney (AEDT)** - Australia/Sydney

**Global:**
- 🌍 **UTC** - Etc/UTC (default)

---

## 🛠️ **Section 3: Toolbar & Features**

### **Allow Symbol Change**
- **Enabled** ✅: Users can search and change symbols
- **Disabled** ❌: Locks to current symbol
- **Default**: Enabled
- **Use Case**: Disable for specific symbol presentations

---

### **Show Top Toolbar**
- **Enabled** ✅: Displays timeframe buttons and drawing tools
- **Disabled** ❌: Hides top toolbar for clean view
- **Default**: Enabled (shown)
- **Contains**:
  - Timeframe selector (1m, 5m, 15m, 1h, 4h, D, W, M)
  - Chart type selector
  - Drawing tools
  - Indicator button
  - Settings

---

### **Show Side Toolbar**
- **Enabled** ✅: Shows left-side drawing tool panel
- **Disabled** ❌: Hides for minimal interface
- **Default**: Enabled (shown)
- **Contains**:
  - Trendlines
  - Fibonacci tools
  - Geometric shapes
  - Text annotations
  - Measurement tools

---

### **Show Legend**
- **Enabled** ✅: Displays OHLC values at top
- **Disabled** ❌: Cleaner chart view
- **Default**: Enabled (shown)
- **Shows**:
  - Open, High, Low, Close prices
  - Volume
  - Change percentage
  - Indicator values

---

### **Enable Screenshot**
- **Enabled** ✅: Allows chart image downloads
- **Disabled** ❌: Removes screenshot button
- **Default**: Enabled
- **Usage**: Click camera icon in toolbar
- **Format**: PNG image download

---

### **Show Details Panel**
- **Enabled** ✅: Shows company information sidebar
- **Disabled** ❌: Chart-only view
- **Default**: Enabled
- **Contains**:
  - Company name and sector
  - Market cap
  - P/E ratio
  - 52-week range
  - Volume
  - Description

---

### **Show Hotlist**
- **Enabled** ✅: Displays trending stocks panel
- **Disabled** ❌: Removes hotlist
- **Default**: Enabled
- **Shows**:
  - Top gainers
  - Top losers
  - Most active
  - Quick access to trending symbols

---

### **Show Calendar Button**
- **Enabled** ✅: Enables date range selection
- **Disabled** ❌: Removes calendar icon
- **Default**: Enabled
- **Usage**: Click calendar icon to select specific date range
- **Useful For**: Historical analysis

---

### **Enable Fullscreen**
- **Enabled** ✅: Shows "Open in new window" button
- **Disabled** ❌: Embedded mode only
- **Default**: Enabled
- **Opens**: Popup window (1000x650px)
- **Useful For**: Detailed analysis

---

## 📱 Mobile Navigation

### **Opening Settings on Mobile:**
- Tap the **"⚙️ Edit"** button in the top-right corner
- Settings panel slides in from the right side

### **Navigating Back:**
- **Tap the ← (Back) button** in the top-left
- Or tap **"Apply Changes"** button at the bottom
- Changes are applied automatically

### **Mobile Bottom Action Bar:**
- **"Reset"** - Restore default settings
- **"Apply Changes"** - Close panel and apply customizations

### **Touch-Friendly Design:**
- ✅ Large tap targets for all controls
- ✅ Smooth scrolling through options
- ✅ Optimized dropdown interactions
- ✅ Easy toolbar toggles

---

## 💡 Usage Examples

### **Example 1: Minimal Chart for Presentations**

**Goal**: Clean chart with no distractions

**Settings:**
```
Symbol: NASDAQ:AAPL
Chart Type: Area
Timeframe: Daily
Show Top Toolbar: ❌ Disabled
Show Side Toolbar: ❌ Disabled
Show Legend: ❌ Disabled
Show Details Panel: ❌ Disabled
Show Hotlist: ❌ Disabled
```

**Result**: Clean area chart, perfect for slides

---

### **Example 2: Full Technical Analysis Setup**

**Goal**: Professional trading workstation

**Settings:**
```
Symbol: NASDAQ:TSLA
Chart Type: Candlesticks
Timeframe: 1 Hour
Timezone: New York (EST)
Show Top Toolbar: ✅ Enabled
Show Side Toolbar: ✅ Enabled
Show Legend: ✅ Enabled
Show Details Panel: ✅ Enabled
Show Calendar: ✅ Enabled
```

**Result**: Full-featured chart with all tools

---

### **Example 3: Cryptocurrency Day Trading**

**Goal**: Fast intraday crypto trading

**Settings:**
```
Symbol: BINANCE:BTCUSDT
Chart Type: Candlesticks
Timeframe: 5 Minutes
Timezone: UTC
Show Top Toolbar: ✅ Enabled
Show Side Toolbar: ✅ Enabled
Allow Symbol Change: ✅ Enabled
```

**Result**: Quick 5-min BTC chart with tools

---

### **Example 4: Long-Term Investment View**

**Goal**: Weekly analysis for buy-and-hold

**Settings:**
```
Symbol: FOREXCOM:SPXUSD (S&P 500)
Chart Type: Line
Timeframe: Weekly
Show Legend: ✅ Enabled
Show Details Panel: ✅ Enabled
Show Hotlist: ❌ Disabled
```

**Result**: Clean weekly S&P 500 trend line

---

## 🎨 Visual Customization

### **Chart Types Visual Guide:**

**Candlesticks:**
```
  ┃     ┃     ┃
  ▓▓▓   ║     ▓▓▓
  ▓▓▓   ║     ▓▓▓
  ┃     ┃     ┃
Green  Red  Green
```

**Bars:**
```
  ┃     ┃     ┃
─ ┃ ─  ─ ┃ ─  ─ ┃ ─
  ┃     ┃     ┃
```

**Line:**
```
    /\    /\
   /  \  /  \
  /    \/    \
```

**Area:**
```
    /\    /\
   /  \  /  \
  /▓▓▓▓\/▓▓▓▓\
 /▓▓▓▓▓▓▓▓▓▓▓▓\
```

---

## 🔧 Configuration

### **Widget Settings**

Located in `lib/constants.ts`:

```typescript
export const ADVANCED_CHART_WIDGET_CONFIG = {
    symbol: 'NASDAQ:AAPL',
    interval: 'D',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1', // 1 = Candles
    locale: 'en',
    allow_symbol_change: true,
    save_image: true,
    hide_top_toolbar: false,
    hide_legend: false,
    hide_side_toolbar: false,
    details: true,
    hotlist: true,
    calendar: true,
    show_popup_button: true,
};
```

### **Style Codes Reference:**

```typescript
'0' = Bars
'1' = Candlesticks (default)
'2' = Area
'3' = Line
'4' = Baseline
'7' = Renko
'8' = Heikin Ashi
'9' = Hollow Candles
```

---

## 🚀 Performance

### **Loading Time:**
- Initial load: < 2 seconds
- Symbol change: < 1 second
- Settings update: Instant
- Chart rendering: Real-time

### **Data Updates:**
- **Market Hours**: Live updates every second
- **After Hours**: Last close prices
- **Historical**: Full access to all data

### **Resource Usage:**
- Lightweight widget
- Efficient data streaming
- Minimal bandwidth
- GPU-accelerated rendering

---

## 📱 Responsive Design

### **Desktop (≥ 1024px):**
- Full chart with all toolbars
- Side-by-side panels
- Large clickable areas
- Full indicator library

### **Tablet (768px - 1024px):**
- Optimized toolbar layout
- Touch-friendly controls
- Swipe gestures enabled

### **Mobile (< 768px):**
- Stacked layout
- Touch-optimized drawing
- Pinch-to-zoom
- Essential tools prioritized

---

## 🎓 Trading with the Advanced Chart

### **Day Trading Setup:**
1. Select **5-minute or 15-minute** timeframe
2. Enable **all toolbars**
3. Add indicators: Moving Averages, RSI, Volume
4. Use **drawing tools** for support/resistance
5. Set **timezone** to your market

### **Swing Trading Setup:**
1. Select **4-hour or Daily** timeframe
2. Enable **top toolbar** only
3. Add indicators: MACD, Bollinger Bands
4. Use **Fibonacci retracement** tool
5. Enable **calendar** for earnings dates

### **Long-Term Investment:**
1. Select **Weekly or Monthly** timeframe
2. Use **Line or Area** chart style
3. Enable **details panel** for fundamentals
4. Minimal toolbars for clean view
5. Focus on major trend lines

---

## 🆘 Troubleshooting

### **Chart Not Loading**
**Solutions:**
1. Check internet connection
2. Verify symbol format (EXCHANGE:SYMBOL)
3. Refresh the page
4. Check TradingView status

---

### **Symbol Not Found**
**Causes:**
- Incorrect exchange prefix
- Delisted stock
- Typo in symbol

**Solutions:**
1. Verify exchange (NASDAQ, NYSE, etc.)
2. Check symbol spelling
3. Try alternative exchange
4. Search on TradingView.com first

---

### **Toolbars Missing**
**Check Settings:**
- Show Top Toolbar: Must be enabled
- Show Side Toolbar: Must be enabled
- Screen too small: Some features hide on mobile

---

### **Slow Performance**
**Solutions:**
1. Close other tabs
2. Disable unused features
3. Reduce timeframe complexity
4. Clear browser cache

---

### **Can't Save Drawings**
**Note:**
- Drawings are session-based
- Browser cookies must be enabled
- Private/Incognito mode resets on close
- Use TradingView account for persistent saves

---

## 📚 Symbol Format Guide

### **Stock Symbols:**
```
NASDAQ:AAPL     → Apple on NASDAQ
NYSE:JPM        → JPMorgan on NYSE
LSE:VOD         → Vodafone on London Stock Exchange
TSE:7203        → Toyota on Tokyo Stock Exchange
```

### **Crypto Symbols:**
```
BINANCE:BTCUSDT  → Bitcoin/USDT on Binance
COINBASE:ETHUSD  → Ethereum/USD on Coinbase
KRAKEN:XRPUSD    → Ripple/USD on Kraken
```

### **Forex Pairs:**
```
FX:EURUSD       → Euro/US Dollar
FX:GBPJPY       → British Pound/Japanese Yen
FX:AUDUSD       → Australian Dollar/US Dollar
```

### **Indices:**
```
FOREXCOM:SPXUSD  → S&P 500
FOREXCOM:NSXUSD  → NASDAQ 100
FOREXCOM:DJI     → Dow Jones Industrial Average
```

### **Commodities:**
```
TVC:GOLD        → Gold spot price
TVC:SILVER      → Silver spot price
NYMEX:CL1!      → Crude Oil futures
```

---

## ✅ Summary

The Advanced Chart provides:
- ✅ **Professional trading tools** with 100+ indicators
- ✅ **8 chart types** (Candles, Bars, Line, Area, etc.)
- ✅ **9 timeframes** (1-minute to monthly)
- ✅ **12+ timezones** for global trading
- ✅ **Custom symbol input** for any asset
- ✅ **Full toolbar control** (show/hide all elements)
- ✅ **Screenshot export** capability
- ✅ **Fullscreen mode** for detailed analysis
- ✅ **Mobile-responsive** with back button
- ✅ **Dark theme** integration

**Perfect for traders, analysts, and investors who need professional-grade charting tools!** 📊🚀

---

## 🔗 Additional Resources

- [TradingView Advanced Chart Documentation](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/)
- [TradingView Chart Features](https://www.tradingview.com/chart-features/)
- [Available Markets](https://www.tradingview.com/widget-docs/available-markets/)
- [Symbol Search](https://www.tradingview.com/symbols/)
- [Technical Indicators Guide](https://www.tradingview.com/support/solutions/43000502344/)

