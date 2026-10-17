# Chartvolt Candle Data System - Complete Workflow

## Overview

Chartvolt uses a **Unified Pipeline Architecture** where the WebSocket Price Streamer is the **Single Source of Truth** for all candle data. This ensures consistency across all charts and clients.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHARTVOLT CANDLE DATA FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  Massive.com │  ← External price feed (real-time ticks)
    │   Price API  │
    └──────┬───────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHARTVOLT-WEB (Next.js App)                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    WebSocket Price Streamer                           │  │
│  │  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐   │  │
│  │  │ Price Ticks │───▶│ 1m Candle    │───▶│ Higher TF Aggregation   │   │  │
│  │  │  (50ms)     │    │ Builder      │    │ (5m, 15m, 30m, 1h, etc.)│   │  │
│  │  └─────────────┘    └──────┬───────┘    └───────────┬─────────────┘   │  │
│  │                            │                        │                  │  │
│  │                            ▼                        ▼                  │  │
│  │                    ┌──────────────┐         ┌──────────────┐          │  │
│  │                    │   MongoDB    │         │   MongoDB    │          │  │
│  │                    │  candles_1m  │         │  historical  │          │  │
│  │                    │ (raw ticks)  │         │ collections  │          │  │
│  │                    └──────────────┘         └──────────────┘          │  │
│  │                                                                        │  │
│  │  Broadcasts via POST /internal/prices:                                │  │
│  │  • formingCandles (all timeframes)                                    │  │
│  │  • completedCandles (when period ends)                                │  │
│  │  • prices (bid/ask)                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CHARTVOLT-WEBSOCKET (Express/WS)                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    WebSocket Server                                   │  │
│  │  • Receives data from chartvolt-web                                   │  │
│  │  • Filters by client subscriptions                                    │  │
│  │  • Broadcasts to connected clients                                    │  │
│  │                                                                        │  │
│  │  Events sent to clients:                                              │  │
│  │  {                                                                     │  │
│  │    type: "price_update",                                              │  │
│  │    data: {                                                            │  │
│  │      prices: [...],                                                   │  │
│  │      formingCandles: [...],      // 1m forming                        │  │
│  │      formingCandles5m: [...],    // 5m forming                        │  │
│  │      formingCandles15m: [...],   // etc.                              │  │
│  │      completedCandles: [...]     // Authoritative completed candles   │  │
│  │    }                                                                   │  │
│  │  }                                                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React Frontend)                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   LightweightTradingChart.tsx                         │  │
│  │                                                                        │  │
│  │  Initial Load:                                                        │  │
│  │  1. Fetch /api/trading/candles → historical data from MongoDB         │  │
│  │  2. candleDataRef stores all candle data locally                      │  │
│  │  3. candlestickSeriesRef.setData() renders chart                      │  │
│  │                                                                        │  │
│  │  WebSocket Updates:                                                   │  │
│  │  1. Receive price_update event                                        │  │
│  │  2. Process completedCandles FIRST:                                   │  │
│  │     - Update candleDataRef with authoritative data                    │  │
│  │     - Call setData() to refresh entire chart                          │  │
│  │  3. Process formingCandles:                                           │  │
│  │     - Skip if timestamp matches just-completed candle                 │  │
│  │     - Otherwise, update() the latest candle                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Data Collection Layer

### 1.1 Price Tick Collection

**File:** `lib/services/websocket-price-streamer.ts`

```
External API (Massive.com)
         │
         ▼
┌─────────────────────┐
│  connectToProvider  │  ← WebSocket connection to price feed
│  (price ticks)      │
└─────────┬───────────┘
          │ Every tick (~50ms)
          ▼
┌─────────────────────┐
│  handlePriceTick()  │  ← Updates forming candles for ALL timeframes
└─────────────────────┘
```

**What happens on each tick:**
1. Update `prices` Map with latest bid/ask
2. Update `formingCandles` Map (1m) - merge tick into current 1m candle
3. Update `formingCandles5m` Map - merge tick into current 5m candle
4. Update `formingCandles15m`, `formingCandles30m`, `formingCandles1h`, etc.

### 1.2 Candle Boundary Detection

Every minute (at :00 seconds), the system:

1. **Saves 1m candles** to `candles_1m` collection
2. **Checks higher timeframe boundaries:**
   - At :00, :05, :10, etc. → 5m candle completes
   - At :00, :15, :30, :45 → 15m candle completes
   - At :00, :30 → 30m candle completes
   - At :00 → 1h candle completes
   - etc.

3. **For completed higher TF candles:**
   - Augment with 1m data from MongoDB (ensures accuracy after server restart)
   - Save to `candles_historical_*` collection
   - Queue for broadcast to clients

---

## 2. Storage Layer

### 2.1 MongoDB Collections

| Collection | Purpose | Retention |
|------------|---------|-----------|
| `candles_1m` | Raw 1-minute candles | ~3 days (configurable) |
| `candles_historical_5m` | Completed 5m candles | 1+ year |
| `candles_historical_15m` | Completed 15m candles | 1+ year |
| `candles_historical_30m` | Completed 30m candles | 1+ year |
| `candles_historical_1h` | Completed 1h candles | 1+ year |
| `candles_historical_4h` | Completed 4h candles | 1+ year |
| `candles_historical_1d` | Completed daily candles | 10+ years |
| `candles_historical_1w` | Completed weekly candles | 10+ years |
| `candles_historical_1M` | Completed monthly candles | 10+ years |

### 2.2 Candle Document Structure

```typescript
{
  symbol: "EUR/USD",
  time: 1706011200,      // Unix timestamp (seconds)
  open: 1.17350,
  high: 1.17400,
  low: 1.17320,
  close: 1.17380,
  volume: 12500,         // Optional
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

**Index:** `{ symbol: 1, time: -1 }` (compound, for fast queries)

---

## 3. Broadcasting Layer

### 3.1 Broadcast Interval

**File:** `lib/services/websocket-price-streamer.ts` → `broadcastFormingCandles()`

```
Every 50ms:
┌─────────────────────────────────────┐
│  1. Collect all forming candles     │
│  2. Collect pending completed       │
│  3. POST to WebSocket server        │
│  4. Clear completed queue           │
└─────────────────────────────────────┘
```

### 3.2 Completed Candle Flow

```
Period End (e.g., 12:05:00)
         │
         ▼
┌─────────────────────────────────────┐
│  saveCompletedHigherTimeframeCandle │
│  1. Fetch 1m candles for period     │
│  2. Augment OHLC with 1m data       │
│  3. Save to historical collection   │
│  4. Push to completedCandlesToBroadcast queue
└─────────────────────────────────────┘
         │
         ▼ (Next broadcast tick)
┌─────────────────────────────────────┐
│  broadcastFormingCandles()          │
│  - Includes completedCandles array  │
│  - Sends to WebSocket server        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  WebSocket Server                   │
│  - Filters by client subscriptions  │
│  - Sends to all connected clients   │
└─────────────────────────────────────┘
```

---

## 4. API Layer

### 4.1 Candle Fetch API

**Endpoint:** `GET /api/trading/candles`

**File:** `app/api/trading/candles/route.ts`

```
Request: ?symbol=EUR/USD&timeframe=5&count=500&before=1706011200
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. For 1m timeframe:                                           │
│     - Query candles_1m directly                                 │
│                                                                 │
│  2. For higher timeframes (5m, 15m, 1h, etc.):                 │
│     - Query candles_historical_* collection                     │
│     - Get forming candle from WebSocket cache                   │
│     - If collection is empty, fetch from Massive.com API        │
│                                                                 │
│  3. Return:                                                     │
│     - candles: [...historical data...]                          │
│     - formingCandle: {...current forming candle...}            │
│     - hasMore: true/false (for lazy loading)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Lazy Loading (Scroll Left)

When user scrolls to see older data:

```
Frontend detects scroll near oldest candle
         │
         ▼
GET /api/trading/candles?before=<oldest_candle_time>
         │
         ▼
API returns older candles from historical collection
         │
         ▼
Frontend prepends to candleDataRef
         │
         ▼
candlestickSeriesRef.setData(allCandles)
```

---

## 5. Frontend Chart Layer

### 5.1 Chart Initialization

**File:** `components/trading/LightweightTradingChart.tsx`

```typescript
useEffect(() => {
  // 1. Create Lightweight Charts instance
  const chart = createChart(container, options);
  const series = chart.addCandlestickSeries();
  
  // 2. Fetch initial data from API
  const response = await fetch('/api/trading/candles?...');
  const { candles, formingCandle } = await response.json();
  
  // 3. Store in local ref
  candleDataRef.current = candles;
  
  // 4. Render on chart
  series.setData(candles);
  
  // 5. Connect WebSocket for real-time updates
  connectWebSocket();
}, [symbol, timeframe]);
```

### 5.2 WebSocket Message Handling

```typescript
ws.onmessage = (event) => {
  const { completedCandles, formingCandles5m, ... } = JSON.parse(event.data);
  
  // STEP 1: Process COMPLETED candles first (authoritative)
  if (completedCandles?.length > 0) {
    for (const completed of completedCandles) {
      if (completed.symbol === symbol && completed.timeframe === currentTf) {
        // Update local data
        const idx = candleDataRef.current.findIndex(c => c.time === completed.time);
        if (idx >= 0) {
          candleDataRef.current[idx] = completed;  // Update existing
        } else {
          candleDataRef.current.push(completed);   // Add new
          candleDataRef.current.sort((a, b) => a.time - b.time);
        }
        
        // Refresh chart with setData() (can update ANY candle)
        series.setData(candleDataRef.current);
        
        // Track as finalized
        completedTimestamps.add(completed.time);
      }
    }
  }
  
  // STEP 2: Process FORMING candles (skip if just completed)
  const candle = formingCandles5m?.find(c => c.symbol === symbol);
  if (candle && !completedTimestamps.has(candle.time)) {
    updateChartWithCandle(candle);  // Uses series.update() for latest candle
  }
};
```

### 5.3 Why setData() vs update()

| Method | Use Case | Can Update Historical? |
|--------|----------|------------------------|
| `series.update(candle)` | Latest candle only | ❌ No |
| `series.setData(allCandles)` | Any candle | ✅ Yes |

**Problem:** When a candle completes, the forming candle for the NEXT period may already be added. `update()` cannot modify "older" candles.

**Solution:** Use `setData()` for completed candles, which refreshes the entire dataset.

---

## 6. Admin Data Management

### 6.1 Gap Detection & Filling

**Endpoint:** `POST /api/admin/market-data/gap-fill`

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Scan each historical collection for gaps                    │
│  2. Identify missing time ranges                                │
│  3. Fetch missing data from Massive.com API                     │
│  4. Save to historical collections                              │
│  5. Return gap report                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Download History

**Endpoint:** `POST /api/admin/market-data/download-history`

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Fetch historical candles from Massive.com API               │
│  2. Align timestamps to proper intervals                        │
│  3. Save to appropriate historical collection                   │
│  4. Supports: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Data Cleanup

**Modes:**
- **Delete Oldest:** Remove data older than X days from the absolute start
- **Keep Recent:** Keep only the last X days of data

**Collections cleaned:** All `candles_historical_*` collections

---

## 7. Process Summary

### 7.1 PM2 Processes

| Process | Port | Purpose |
|---------|------|---------|
| `chartvolt-web` | 3000 | Next.js app, API routes, WebSocket streamer |
| `chartvolt-websocket` | 3002 | WebSocket server for client connections |
| `chartvolt-admin` | 3001 | Admin panel (separate Next.js app) |
| `chartvolt-worker` | - | Background jobs (challenges, competitions, etc.) |
| `chartvolt-api` | 3003 | Express API server (auth, etc.) |

### 7.2 Data Flow Summary

```
Massive.com API
      │
      ▼ (price ticks)
chartvolt-web (WebSocket Price Streamer)
      │
      ├──▶ MongoDB (1m candles, historical collections)
      │
      └──▶ chartvolt-websocket (POST /internal/prices)
                  │
                  ▼ (WebSocket broadcast)
           Browser Clients
                  │
                  ▼
           Lightweight Charts
```

---

## 8. Key Files Reference

| File | Purpose |
|------|---------|
| `lib/services/websocket-price-streamer.ts` | Price collection, candle building, broadcasting |
| `websocket-server/index.ts` | WebSocket server, client management |
| `app/api/trading/candles/route.ts` | Candle fetch API |
| `components/trading/LightweightTradingChart.tsx` | Chart component, WebSocket handling |
| `lib/services/candle-aggregator.service.ts` | Aggregation utilities (cache warming) |
| `apps/admin/app/api/market-data/*` | Admin data management endpoints |

---

## 9. Troubleshooting

### Charts Show Different Candles

1. **Completed candle failed to apply:** Check browser console for `❌ FAILED` logs
2. **Old data before fix:** Refresh the page to get fresh data from database
3. **WebSocket disconnected:** Check for reconnection logs

### Missing Historical Data

1. Run "Detect Gaps" in Admin → Market Data
2. Use "Gap Fill" to fetch missing data
3. Or use "Download History" for bulk data

### Forming Candle Disappears

1. Check if WebSocket is connected
2. Verify server is running and broadcasting
3. Check browser console for errors

---

## 10. Architecture Benefits

1. **Single Source of Truth:** WebSocket streamer builds all candles, ensuring consistency
2. **Real-time Sync:** Completed candles broadcast to all clients instantly
3. **Resilient to Restarts:** Completed candles augmented with 1m data from MongoDB
4. **Efficient Updates:** `setData()` for historical, `update()` for forming candles
5. **Lazy Loading:** Scroll to load more history without loading everything upfront
