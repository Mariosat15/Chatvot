# 📊 Heatmap Settings Guide

## Overview

The Stock Heatmap now includes **comprehensive customizable settings** based on TradingView's official Stock Heatmap widget API, allowing you to visualize market data in countless ways.

---

## 🎯 **How to Access Settings**

1. Navigate to the **Dashboard** (home page)
2. Look for the **"Customize"** button (yellow) in the top-right corner of the heatmap
   - On **Desktop**: Shows "⚙️ Customize"
   - On **Mobile**: Shows "⚙️ Edit" (compact version)
3. Click to open the full settings panel with all available options

---

## 📱 **Mobile Navigation**

### **Opening Settings on Mobile:**
- Tap the **"⚙️ Edit"** button in the top-right corner of the heatmap
- Settings panel slides in from the right side, taking up the full screen

### **Navigating Back:**
- **Tap the ← (Back) button** in the top-left of the settings panel
- Or tap the **"Apply Changes"** button at the bottom
- Changes are applied automatically

### **Mobile Bottom Action Bar:**
The mobile view includes a sticky bottom bar with two buttons:
- **"Reset"** - Restore all settings to defaults
- **"Apply Changes"** - Close panel and apply your customizations

### **Touch-Friendly Design:**
- ✅ All buttons are large enough for easy tapping (44px minimum)
- ✅ Smooth scrolling through all settings
- ✅ Full-width controls for easy interaction
- ✅ Optimized spacing for thumb-friendly navigation

---

## ⚙️ **Available Settings**

The settings are organized into **3 main sections** for better usability:

### 🔷 **1. Data Source** - What data to display
### 🔷 **2. Visualization** - How to display it  
### 🔷 **3. Display Options** - Interactive features

---

## 📊 **Section 1: Data Source**

### **Market Index** 📈

Controls which market index or region to display.

| Option | Description |
|--------|-------------|
| **S&P 500** | Top 500 US companies by market cap |
| **NASDAQ 100** | Top 100 NASDAQ-listed companies (tech-heavy) |
| **Dow Jones Industrial** | 30 major US blue-chip companies |
| **Russell 2000** | 2000 small-cap US companies |
| **TSX (Canada)** | Toronto Stock Exchange |
| **FTSE 100 (UK)** | Top 100 UK companies |
| **DAX (Germany)** | 40 major German companies |
| **CAC 40 (France)** | 40 largest French companies |
| **IBEX 35 (Spain)** | 35 most liquid Spanish stocks |
| **World Stocks** | Global stocks across all markets |
| **Americas** | Stocks from North & South America |
| **Europe** | All European markets combined |
| **Asia** | Asian markets (China, Japan, India, etc.) |
| **Australia** | Australian Stock Exchange |

**Example Use Cases:**
- Track large-cap US tech stocks → **NASDAQ 100**
- View global market sentiment → **World Stocks**
- Focus on US blue-chip companies → **Dow Jones Industrial**
- Monitor European markets → **Europe** or specific country indices

---

### **Show Top Bar** 🔝

**Toggle:** ON/OFF  
**Description:** Displays a market selector bar at the top of the heatmap  
**Use Case:** Allow users to quickly switch between different markets without opening settings

---

### **Dataset Selector** 📋

**Toggle:** ON/OFF  
**Description:** Enables a dropdown that lets users switch between different datasets  
**Use Case:** Provides additional flexibility for users to explore different data sources

---

---

## 🎨 **Section 2: Visualization**

### **Block Size By** 📐

Determines how large each stock block appears on the heatmap.

| Option | Description |
|--------|-------------|
| **Market Capitalization** | Larger companies = bigger blocks |
| **Trading Volume** | Higher trading volume = bigger blocks |
| **Relative Volume (10D)** | Unusual volume activity (vs 10-day avg) = bigger blocks |
| **Price Change** | Larger price movements = bigger blocks |
| **Value Traded** | Dollar value of shares traded = bigger blocks |
| **Shares Outstanding** | Total shares issued = bigger blocks |

**Example Use Cases:**
- See which companies dominate the market → **Market Capitalization**
- Find highly traded stocks → **Trading Volume**
- Spot unusual trading activity → **Relative Volume (10D)**
- Identify momentum stocks → **Price Change**
- Track institutional activity → **Value Traded**

---

---

### **Block Color By** 🎨

Determines the color intensity and what metric it represents.

| Option | Description | Color Scale |
|--------|-------------|-------------|
| **Price Change %** | Today's percentage change | 🟩 Green (gains) / 🟥 Red (losses) |
| **Price Change (Absolute)** | Dollar amount change | Same as above |
| **Performance (1 Week)** | 1-week performance | Same as above |
| **Performance (1 Month)** | 1-month performance | Same as above |
| **Performance (3 Months)** | 3-month performance | Same as above |
| **Performance (6 Months)** | 6-month performance | Same as above |
| **Performance (1 Year)** | 1-year performance | Same as above |
| **Performance (YTD)** | Year-to-date performance | Same as above |
| **Gap %** | Overnight gap percentage | Same as above |
| **Volume** | Trading volume | Darker = higher volume |
| **Relative Volume (10D)** | Volume vs. 10-day average | Darker = higher relative vol |
| **Value Traded** | Dollar value of trades | Darker = higher value |
| **Volatility** | Price volatility | Darker = more volatile |

**Example Use Cases:**
- See today's biggest movers → **Price Change %**
- Identify long-term winners/losers → **Performance (1 Year)**
- Compare quarterly performance → **Performance (3 Months)**
- Track year-to-date leaders → **Performance (YTD)**
- Spot overnight gap ups/downs → **Gap %**
- Find heavily traded stocks → **Volume** or **Value Traded**
- Identify volatile stocks for trading → **Volatility**

---

---

### **Group By** 🏷️

How stocks are organized within the heatmap.

| Option | Description |
|--------|-------------|
| **Sector** | Group by industry sector (Technology, Healthcare, Finance, Energy, etc.) |
| **Industry** | Group by specific industry (Software, Biotech, Banks, Oil & Gas, etc.) |
| **No Grouping** | Display all stocks together without any grouping |

**Example Use Cases:**
- Compare sector performance → **Sector**
- Drill down to specific industries → **Industry**
- See all stocks at once (cleaner view) → **No Grouping**

---

## 👁️ **Section 3: Display Options**

Interactive features that enhance the user experience.

### **Enable Zoom** 🔍
**Toggle:** ON/OFF  
**Description:**
- **ON**: Click and drag to zoom into specific areas of the heatmap
- **OFF**: Static view, no zooming capability

**Use Case:** Zoom in to explore specific sectors or clusters in detail

---

### **Show Tooltips** 💬
**Toggle:** ON/OFF  
**Description:**
- **ON**: Hover over blocks to see detailed information (symbol, company name, price, change %, etc.)
- **OFF**: No tooltips appear on hover

**Use Case:** Quickly view stock details without leaving the heatmap

---

### **Equal Block Sizes** ⚖️
**Toggle:** ON/OFF  
**Description:**
- **ON**: All blocks are the same size (ignores "Block Size By" setting)
- **OFF**: Block sizes vary based on the selected "Block Size By" metric

**Use Case:** Focus purely on color-coded performance without size distractions

---

## 🎨 **Recommended Configurations**

### **For Day Traders**
- **Data Source**: NASDAQ 100
- **Block Size**: Relative Volume (10D)
- **Block Color**: Price Change %
- **Grouping**: Sector
- **Zoom**: ON
- **Tooltips**: ON

### **For Long-Term Investors**
- **Data Source**: S&P 500
- **Block Size**: Market Capitalization
- **Block Color**: Performance (Year)
- **Grouping**: Sector
- **Equal Sizes**: OFF

### **For Global Markets**
- **Data Source**: World Stocks
- **Block Size**: Market Capitalization
- **Block Color**: Price Change %
- **Grouping**: No Grouping

### **For Volume Analysis**
- **Data Source**: S&P 500
- **Block Size**: Volume
- **Block Color**: Relative Volume
- **Grouping**: Industry
- **Tooltips**: ON

---

## 🔄 **Reset to Default**

At any time, you can click the **"Reset to Default"** button at the bottom of the settings panel to restore the original configuration:

- Data Source: **S&P 500**
- Block Size: **Market Capitalization**
- Block Color: **Price Change %**
- Grouping: **Sector**
- Zoom: **ON**
- Tooltips: **ON**
- Equal Sizes: **OFF**

---

## 💡 **Tips & Tricks**

1. **Combine Volume + Price Change**: Set Block Size to "Volume" and Block Color to "Price Change %" to find heavily traded stocks with big moves.

2. **Spot Sector Rotation**: Use "Sector" grouping with "Performance (Month)" to see which sectors are gaining/losing momentum.

3. **Find Outliers**: Enable "Equal Block Sizes" and use "Gap %" color to quickly spot stocks with unusual overnight gaps.

4. **Compare Markets**: Switch between data sources (Americas, Europe, Asia) to see global market sentiment.

5. **Custom Analysis**: Experiment with different combinations to discover patterns that match your trading style.

---

## 🚀 **Technical Details**

### **How the Heatmap Updates**

When you change a setting:
1. The settings panel updates immediately
2. The heatmap **re-renders** with the new configuration
3. TradingView's API fetches fresh data for the new settings
4. The display updates within 1-2 seconds

### **Data Refresh Rate**

- Real-time updates during market hours
- Delayed by 15 minutes for free plans
- Instant updates with TradingView Pro subscription

### **Supported Browsers**

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

---

## 🆘 **Troubleshooting**

### **Heatmap Not Updating**
- Try clicking "Reset to Default" and changing settings again
- Refresh the page (F5)
- Clear browser cache

### **Settings Panel Not Opening**
- Check console for errors (F12 → Console tab)
- Ensure JavaScript is enabled
- Try a different browser

### **Can't Close Settings on Mobile**
- Use the **← (Back)** button in the top-left corner
- Or tap **"Apply Changes"** button at the bottom
- Panel closes automatically after applying changes

### **Blocks Overlapping or Cut Off**
- Disable "Equal Block Sizes"
- Try a different "Grouping" option
- Zoom out (if zoom is enabled)

---

## 📚 **Further Reading**

- [TradingView Heatmap Documentation](https://www.tradingview.com/widget-docs/widgets/heatmaps/)
- [Understanding Market Sectors](https://www.investopedia.com/terms/s/sector.asp)
- [Market Capitalization Explained](https://www.investopedia.com/terms/m/marketcapitalization.asp)
- [Trading Volume Analysis](https://www.investopedia.com/articles/technical/02/010702.asp)

---

## 🎉 **Enjoy Your Enhanced Heatmap!**

Experiment with different settings to find the configuration that works best for your analysis style. The flexibility of these options allows you to view market data from multiple perspectives.

