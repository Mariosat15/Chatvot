# 🚀 Quick Start Guide - Trading Competition Platform

## ✅ What's Already Done

Based on your MongoDB Atlas URL (`https://cloud.mongodb.com/.../chatvolt/user`), you have:

1. ✅ **MongoDB Atlas Account** - Active cluster
2. ✅ **Database "chatvolt"** - Running
3. ✅ **Mongoose Connection** - `database/mongoose.ts`
4. ✅ **Existing Models** - admin, alert, dashboard-preferences, watchlist, whitelabel
5. ✅ **Better Auth** - User authentication working
6. ✅ **Next.js 15** - Modern app structure
7. ✅ **TradingView Widgets** - Market visualization

## 🎯 What We're Adding

**NEW Collections** (Same database, separate from existing):
- `creditWallets` - User credit balances
- `walletTransactions` - All credit movements
- `competitions` - Competition details
- `competitionParticipants` - Who's in each competition
- `tradingOrders` - User orders
- `tradingPositions` - Open positions
- `tradeHistory` - Closed trades

**Existing collections UNTOUCHED!** Your watchlist, alerts, etc. keep working.

---

## 📝 Step 1: Add Environment Variables

Add these to your `.env` file:

```bash
# ============================================
# TRADING PLATFORM (NEW)
# ============================================

# Market Data Feeds
MASSIVE_API_KEY=your_massive_api_key_here
MASSIVE_WS_URL=wss://api.massive.com/v1/ws

# Payment Processing (Stripe Test Mode)
STRIPE_SECRET_KEY=sk_test_your_test_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Trading Configuration
TRADING_ENGINE_ENABLED=true
COMPETITION_PLATFORM_FEE=0.20
DEFAULT_LEVERAGE=1
MAX_LEVERAGE=100

# WebSocket Server
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Feature Flags
ENABLE_TRADING_COMPETITIONS=true
ENABLE_CREDIT_WALLET=true
```

---

## 📦 Step 2: Install Required Packages

Run this command:

```bash
npm install socket.io socket.io-client stripe @stripe/stripe-js lightweight-charts ws uuid decimal.js && npm install -D @types/ws
```

**What each package does:**
- `socket.io` - Real-time WebSocket server
- `socket.io-client` - WebSocket client for frontend
- `stripe` - Payment processing
- `@stripe/stripe-js` - Stripe frontend SDK
- `lightweight-charts` - TradingView Lightweight Charts™ for trading
- `ws` - WebSocket client for market data feeds
- `uuid` - Generate unique IDs
- `decimal.js` - Precise decimal calculations (important for money!)

---

## 🗄️ Step 3: Verify MongoDB Connection

Your existing `database/mongoose.ts` is perfect! Just make sure your `.env` has:

```bash
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/chatvolt?retryWrites=true&w=majority
```

Test the connection:

```bash
# In your terminal
node -e "require('./database/mongoose').connectToDatabase().then(() => console.log('✅ Connected to MongoDB!')).catch(console.error)"
```

---

## 📊 Step 4: Database Models

I've created these models in `database/models/trading/`:

1. ✅ `credit-wallet.model.ts` - User credit balances
2. ✅ `wallet-transaction.model.ts` - All credit transactions
3. ✅ `competition.model.ts` - Competition structure

**To create the remaining models**, would you like me to:
- A) Create all models now (4 more: participant, order, position, trade-history)?
- B) Create them as we build each feature?

---

## 🔍 Step 5: Verify Everything Works

### Test 1: MongoDB Connection
```bash
npm run dev
# Check console for: "Connected to database development - mongodb+srv://..."
```

### Test 2: Create a Test Wallet (Optional)
Create `scripts/test-wallet.ts`:

```typescript
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';

async function testWallet() {
  await connectToDatabase();
  
  // Create test wallet
  const wallet = await CreditWallet.create({
    userId: 'test_user_123',
    creditBalance: 100,
    totalDeposited: 100,
  });
  
  console.log('✅ Test wallet created:', wallet);
  
  // Fetch it back
  const found = await CreditWallet.findOne({ userId: 'test_user_123' });
  console.log('✅ Wallet found:', found);
  
  // Clean up
  await CreditWallet.deleteOne({ userId: 'test_user_123' });
  console.log('✅ Test wallet deleted');
}

testWallet().catch(console.error);
```

Run:
```bash
npx ts-node scripts/test-wallet.ts
```

---

## 🎯 Step 6: Choose Your Path

### **Option A: Build Incrementally (RECOMMENDED)**

**Week 1: Credit Wallet System**
- Build deposit/withdrawal UI
- Integrate Stripe
- Test transactions
- **No trading yet, just wallet**

**Week 2: Competition System**
- Admin panel to create competitions
- Competition lobby
- Entry/registration
- **No trading yet, just structure**

**Week 3-4: Trading Engine**
- Connect market data
- Build order system
- Position tracking
- WebSocket real-time

**Week 5: Polish**
- Leaderboards
- Notifications
- Testing

---

### **Option B: Build All at Once (FASTER, RISKIER)**

Build everything in parallel:
- Create all models
- Build all backend APIs
- Build all frontend pages
- Connect everything
- Test end-to-end

**Time:** 2-3 weeks intensive work

---

## 🛡️ Step 7: Safety First

### **Feature Flags**
Set these to `false` to disable features:
```bash
ENABLE_TRADING_COMPETITIONS=false  # Hides all trading features
ENABLE_CREDIT_WALLET=false         # Hides wallet
```

### **Rollback Plan**
If something goes wrong:
1. Set feature flags to `false`
2. App works exactly as before
3. MongoDB collections remain (no data lost)
4. Can re-enable anytime

### **Complete Removal**
To completely remove trading platform:
```bash
# Delete trading collections from MongoDB Atlas
db.creditWallets.drop()
db.walletTransactions.drop()
db.competitions.drop()
db.competitionParticipants.drop()
db.tradingOrders.drop()
db.tradingPositions.drop()
db.tradeHistory.drop()

# Delete files
rm -rf database/models/trading
rm -rf lib/trading
rm -rf app/(root)/competitions
rm -rf app/(root)/wallet
rm -rf app/(root)/trading
rm -rf components/trading

# Remove packages
npm uninstall socket.io socket.io-client stripe @stripe/stripe-js lightweight-charts ws uuid decimal.js
```

---

## 📚 Documentation

I've created these docs for you:

1. **TRADING_PLATFORM_INSTALLATION.md** - Package installation & setup
2. **TRADING_PLATFORM_ARCHITECTURE.md** - Complete system architecture
3. **QUICK_START_TRADING_PLATFORM.md** (this file) - Getting started

---

## 🎯 Recommended Next Steps

### **Today (1 hour):**
1. ✅ Install packages (`npm install ...`)
2. ✅ Add environment variables to `.env`
3. ✅ Test MongoDB connection
4. ✅ Decide: Incremental or All-at-once?

### **This Week:**
1. Create remaining MongoDB models
2. Build credit wallet backend API
3. Build credit wallet frontend UI
4. Integrate Stripe (test mode)
5. Test deposit/withdrawal flow

### **Next Week:**
1. Build competition system
2. Admin panel for creating competitions
3. Competition lobby
4. Entry/registration

### **Week 3-4:**
1. Connect market data feeds (Massive.com)
2. Build trading engine
3. Trading interface with Lightweight Charts™
4. Real-time updates via WebSocket

---

## ❓ Questions & Decisions Needed

Before we continue, please confirm:

1. **Which path?**
   - [ ] A) Incremental (safer, step-by-step)
   - [ ] B) All at once (faster, more complex)

2. **Market data provider?**
   - [ ] Massive.com for Forex ([docs](https://massive.com/docs/websocket/forex/overview))
   - [ ] Finnhub (you already have)
   - [ ] Polygon.io (need to sign up)
   - [ ] Mix of providers

3. **Payment provider?**
   - [ ] Stripe (recommended)
   - [ ] PayPal
   - [ ] Both

4. **Initial asset classes?**
   - [ ] Forex only (simplest)
   - [ ] Stocks only
   - [ ] Both Forex + Stocks
   - [ ] All (Forex + Stocks + Crypto)

5. **Create remaining models now?**
   - [ ] Yes, create all 7 models now
   - [ ] No, create as we build

---

## 🚀 Let's Start!

**Tell me:**
1. Did packages install successfully?
2. Is MongoDB connection working?
3. Which path do you want (A or B)?
4. Should I create the remaining 4 models now?

**Ready to build the credit wallet system first?** 🎯

This is the safest entry point:
- No trading complexity yet
- Just deposits/withdrawals
- Can test Stripe integration
- Can verify MongoDB transactions work

Let me know and I'll guide you through it! 💪

