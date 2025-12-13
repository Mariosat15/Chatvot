# 📈 **PHASE 3: TRADING ENGINE - ARCHITECTURE**

## 🎯 **Overview**

Building a **simulated Forex trading engine** for competition platform.

**Key Points:**
- ✅ **Simulated trading** (not real money)
- ✅ **Forex only** (EUR/USD, GBP/USD, etc.)
- ✅ **Massive.com API** for real-time data
- ✅ **WebSocket** for live price updates
- ✅ **TradingView Lightweight Charts** for visualization
- ✅ **Full risk management** (margin, liquidation)

---

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                     TRADING ENGINE                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐        ┌─────────────────┐         │
│  │   Massive.com   │───────▶│  Price Service  │         │
│  │   WebSocket     │        │   (Real-time)   │         │
│  └─────────────────┘        └─────────────────┘         │
│           │                          │                   │
│           │                          ▼                   │
│           │                 ┌─────────────────┐         │
│           │                 │  Trading Page   │         │
│           │                 │   (UI/Charts)   │         │
│           │                 └─────────────────┘         │
│           │                          │                   │
│           ▼                          ▼                   │
│  ┌─────────────────┐        ┌─────────────────┐         │
│  │  Order System   │◀──────▶│Position System  │         │
│  │  (Buy/Sell)     │        │  (Open/Close)   │         │
│  └─────────────────┘        └─────────────────┘         │
│           │                          │                   │
│           └──────────┬───────────────┘                   │
│                      ▼                                   │
│             ┌─────────────────┐                          │
│             │   P&L Engine    │                          │
│             │ (Profit/Loss)   │                          │
│             └─────────────────┘                          │
│                      │                                   │
│                      ▼                                   │
│             ┌─────────────────┐                          │
│             │ Risk Management │                          │
│             │ (Margin/Liq)    │                          │
│             └─────────────────┘                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 **Components to Build**

### **1. Market Data Service** 🌐
**File:** `lib/services/market-data.service.ts`

**Responsibilities:**
- Connect to Massive.com WebSocket
- Subscribe to Forex pairs
- Handle real-time price updates
- Reconnection logic
- Error handling

**Functions:**
```typescript
- connectToMassive()
- subscribeToPair(symbol: string)
- unsubscribeFromPair(symbol: string)
- getCurrentPrice(symbol: string)
- getPriceHistory(symbol: string, timeframe: string)
```

---

### **2. Order Actions** 📝
**File:** `lib/actions/trading/order.actions.ts`

**Functions:**
```typescript
- placeOrder(competitionId, symbol, side, quantity, type, price?, sl?, tp?)
- getOrders(competitionId, userId)
- cancelOrder(orderId)
- getOrderById(orderId)
```

**Order Flow:**
```
1. Validate order (balance, margin, limits)
2. Calculate margin required
3. Check available capital
4. Create pending order
5. Execute immediately (market) or wait (limit)
6. Create position if filled
7. Update participant capital
8. Record in database
```

---

### **3. Position Actions** 💼
**File:** `lib/actions/trading/position.actions.ts`

**Functions:**
```typescript
- getPositions(competitionId, userId)
- getPositionById(positionId)
- closePosition(positionId, price)
- updatePositionPnL(positionId, currentPrice)
- checkMarginCall(positionId)
- liquidatePosition(positionId)
```

**Position Lifecycle:**
```
1. Order filled → Create position
2. Price updates → Update unrealized P&L
3. Stop Loss hit → Auto close
4. Take Profit hit → Auto close
5. User closes → Manual close
6. Margin call → Liquidation
7. Position closed → Create trade history
8. Update participant stats
```

---

### **4. P&L Calculation** 💰
**File:** `lib/services/pnl-calculator.service.ts`

**Functions:**
```typescript
- calculateUnrealizedPnL(position, currentPrice)
- calculateRealizedPnL(position, closePrice)
- calculateMarginRequired(symbol, quantity, leverage, price)
- calculateMarginLevel(equity, usedMargin)
- isMarginCall(marginLevel)
- calculateLiquidationPrice(position)
```

**Forex P&L Formula:**
```
For Long (Buy):
P&L = (Close Price - Open Price) × Position Size

For Short (Sell):
P&L = (Open Price - Close Price) × Position Size

Position Size = Quantity (lots) × Contract Size (100,000 for standard lot)

Example:
- Buy 0.1 lots EUR/USD at 1.1000
- Current price: 1.1050
- P&L = (1.1050 - 1.1000) × 0.1 × 100,000
- P&L = 0.0050 × 10,000 = $50
```

---

### **5. Trading Page** 🎨
**File:** `app/(root)/competitions/[id]/trade/page.tsx`

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Competition: Forex Friday | Balance: $9,850        │
│  P&L: +150 (+1.5%) | Rank: #3                        │
└──────────────────────────────────────────────────────┘
┌──────────────────────┬───────────────────────────────┐
│                      │                               │
│   TradingView Chart  │      Order Form               │
│   (EUR/USD)          │                               │
│                      │  Symbol: EUR/USD              │
│   Real-time prices   │  Type: Market/Limit           │
│   Candlesticks       │  Side: Buy/Sell               │
│   Indicators         │  Quantity: 0.1 lots           │
│                      │  Stop Loss: 1.0950            │
│                      │  Take Profit: 1.1100          │
│                      │                               │
│                      │  [Place Order]                │
│                      │                               │
├──────────────────────┴───────────────────────────────┤
│                                                       │
│   Open Positions                                      │
│   ┌───────────────────────────────────────────────┐  │
│   │ EUR/USD | Buy | 0.1 | 1.1000 | +50 (+0.5%)  │  │
│   │ GBP/USD | Sell| 0.05| 1.2500 | -20 (-0.4%)  │  │
│   └───────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

### **6. WebSocket Context** 🔌
**File:** `contexts/PriceProvider.tsx`

**Responsibilities:**
- Maintain WebSocket connection
- Subscribe to multiple symbols
- Broadcast price updates to components
- Handle reconnection
- Error recovery

**Usage:**
```typescript
const { subscribe, unsubscribe, prices } = usePriceContext();

useEffect(() => {
  subscribe('EUR/USD');
  return () => unsubscribe('EUR/USD');
}, []);

const currentPrice = prices['EUR/USD'];
```

---

### **7. Order Form Component** 📋
**File:** `components/trading/OrderForm.tsx`

**Features:**
- Symbol selection dropdown
- Market/Limit order type
- Buy/Sell buttons
- Quantity input (lots)
- Leverage selection
- Stop Loss input
- Take Profit input
- Margin calculation display
- Balance check
- Submit button

---

### **8. Positions Display** 📊
**File:** `components/trading/PositionsTable.tsx`

**Features:**
- List all open positions
- Real-time P&L updates
- Symbol, side, quantity
- Entry price, current price
- Stop Loss, Take Profit
- Close button
- Color coding (green profit, red loss)
- Liquidation warning

---

### **9. Chart Component** 📈
**File:** `components/trading/TradingChart.tsx`

**Uses:** TradingView Lightweight Charts

**Features:**
- Real-time candlestick chart
- Multiple timeframes (1m, 5m, 15m, 1h)
- Volume display
- Position markers (entry, SL, TP)
- Crosshair with price/time
- Responsive design

---

### **10. Risk Manager** ⚠️
**File:** `lib/services/risk-manager.service.ts`

**Responsibilities:**
- Monitor margin levels
- Check for margin calls (< 100% margin level)
- Auto-liquidate positions if margin < 50%
- Send warnings to users
- Update competition participant status

**Margin Levels:**
```
Margin Level = (Equity / Used Margin) × 100

Equity = Current Capital + Unrealized P&L

100%+ : Safe
50-100%: Margin Call Warning
<50%: Liquidation

Example:
- Current Capital: $9,500
- Open Position: EUR/USD, 0.5 lots
- Unrealized P&L: -$300
- Equity: $9,500 - $300 = $9,200
- Used Margin: $500
- Margin Level: ($9,200 / $500) × 100 = 1,840%
- Status: Safe ✅
```

---

## 🔧 **Technical Specifications**

### **Massive.com API:**
```
WebSocket Endpoint:
wss://api.massive.com/v1/forex/stream

Authentication:
- API Key: process.env.MASSIVE_API_KEY

Subscribe Message:
{
  "action": "subscribe",
  "symbols": ["EUR/USD", "GBP/USD"]
}

Price Update Format:
{
  "symbol": "EUR/USD",
  "bid": 1.10450,
  "ask": 1.10452,
  "timestamp": 1700000000000
}
```

### **Forex Pairs Supported:**
```javascript
const FOREX_PAIRS = [
  { symbol: 'EUR/USD', name: 'Euro vs US Dollar', pip: 0.0001 },
  { symbol: 'GBP/USD', name: 'British Pound vs US Dollar', pip: 0.0001 },
  { symbol: 'USD/JPY', name: 'US Dollar vs Japanese Yen', pip: 0.01 },
  { symbol: 'USD/CHF', name: 'US Dollar vs Swiss Franc', pip: 0.0001 },
  { symbol: 'AUD/USD', name: 'Australian Dollar vs US Dollar', pip: 0.0001 },
  { symbol: 'USD/CAD', name: 'US Dollar vs Canadian Dollar', pip: 0.0001 },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar vs US Dollar', pip: 0.0001 },
];
```

### **Order Types:**
```
1. Market Order
   - Execute immediately at best available price
   - Instant fill
   - Slight slippage possible

2. Limit Order
   - Execute at specific price or better
   - Pending until price reached
   - No slippage

3. Stop Order (Future)
   - Trigger when price reaches level
   - Then execute as market order
```

### **Leverage:**
```
Standard: 1:100 (default)
Max: 1:500 (per competition settings)

Example with 1:100 leverage:
- Position Size: 0.1 lots = $10,000
- Margin Required: $10,000 / 100 = $100
- Can open $10,000 position with only $100
```

---

## 📊 **Database Updates**

### **TradingOrder Model** (Already Created) ✅
Fields needed:
- competitionId, userId, participantId
- symbol, side, orderType, quantity
- requestedPrice, executedPrice
- stopLoss, takeProfit
- leverage, marginRequired
- status, filledQuantity

### **TradingPosition Model** (Already Created) ✅
Fields needed:
- competitionId, userId, participantId
- symbol, side, quantity
- entryPrice, currentPrice
- unrealizedPnl, unrealizedPnlPercentage
- stopLoss, takeProfit
- leverage, marginUsed
- status, closeReason

### **TradeHistory Model** (Already Created) ✅
For closed positions:
- All position data
- realizedPnl
- holdingTime
- closeReason

---

## 🔄 **Real-time Updates Flow**

```
1. User opens trading page
2. WebSocket connects to Massive.com
3. Subscribe to selected pairs
4. Price updates stream in real-time
5. Chart updates every second
6. Open positions P&L recalculates
7. Participant data updates
8. Leaderboard refreshes
9. Check margin levels
10. Trigger margin calls if needed
```

---

## ⚡ **Performance Considerations**

**WebSocket:**
- Single connection per user
- Subscribe only to trading pairs
- Unsubscribe when leaving page
- Reconnect on disconnect

**Database:**
- Index on competitionId + userId
- Cache participant data (Redis future)
- Batch P&L updates (every 5 seconds)
- Use MongoDB Change Streams for leaderboard

**UI:**
- Throttle chart updates (max 1/second)
- Debounce P&L calculations
- Virtual scrolling for large position lists
- Lazy load trade history

---

## 🧪 **Testing Strategy**

**Unit Tests:**
- P&L calculations
- Margin calculations
- Risk management rules
- Order validation

**Integration Tests:**
- Order placement → Position creation
- Position close → Trade history
- Margin call → Liquidation
- P&L → Leaderboard update

**E2E Tests:**
- Full trading flow
- WebSocket connection
- Real-time updates
- Competition completion

---

## 📝 **Implementation Order**

### **Day 1-2: Core Services**
1. ✅ Market data service
2. ✅ P&L calculator
3. ✅ Risk manager

### **Day 3-4: Server Actions**
4. ✅ Order placement
5. ✅ Position management
6. ✅ Trade history

### **Day 5-6: UI Components**
7. ✅ Trading page layout
8. ✅ Order form
9. ✅ Positions table
10. ✅ TradingView chart

### **Day 7: Integration**
11. ✅ WebSocket context
12. ✅ Real-time P&L updates
13. ✅ Leaderboard sync
14. ✅ Testing

---

## 🚀 **Let's Start Building!**

**First:** Market Data Service + P&L Calculator  
**Then:** Order & Position Actions  
**Finally:** Trading UI + Charts

Ready? Let's code! 💪

