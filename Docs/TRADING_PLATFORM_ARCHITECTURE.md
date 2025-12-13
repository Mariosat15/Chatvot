# 🏗️ Trading Competition Platform - Complete Architecture

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CHARTVOLT PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  EXISTING APP    │         │  TRADING PLATFORM │         │
│  │  (PostgreSQL)    │         │  (MongoDB Atlas)  │         │
│  ├──────────────────┤         ├──────────────────┤         │
│  │ • Authentication │◄────────┤ • Competitions    │         │
│  │ • Watchlist      │ user_id │ • Credit Wallet   │         │
│  │ • Alerts         │         │ • Trading Engine  │         │
│  │ • Dashboard      │         │ • Leaderboards    │         │
│  │ • Admin Panel    │         │ • Orders/Positions│         │
│  └──────────────────┘         └──────────────────┘         │
│           │                             │                    │
│           │                             │                    │
│           ▼                             ▼                    │
│  ┌────────────────────────────────────────────┐            │
│  │         NEXT.JS 15 FRONTEND                │            │
│  ├────────────────────────────────────────────┤            │
│  │ • Dashboard (TradingView Widgets)          │            │
│  │ • Competition Lobby                        │            │
│  │ • Trading Interface (Lightweight Charts™)  │            │
│  │ • Credit Wallet                            │            │
│  │ • Real-time Leaderboard                    │            │
│  └────────────────────────────────────────────┘            │
│           │                             │                    │
│           ▼                             ▼                    │
│  ┌─────────────────┐         ┌──────────────────┐          │
│  │  TradingView    │         │   WebSocket      │          │
│  │  Widgets        │         │   Server         │          │
│  │  (Read Only)    │         │  (Socket.IO)     │          │
│  └─────────────────┘         └──────────────────┘          │
│                                       │                      │
│                                       ▼                      │
│                            ┌──────────────────┐             │
│                            │ Market Data Feeds│             │
│                            ├──────────────────┤             │
│                            │ • Massive.com    │             │
│                            │   (Forex WS)     │             │
│                            │ • Finnhub        │             │
│                            │   (Stocks/Crypto)│             │
│                            │ • Polygon.io     │             │
│                            │   (Optional)     │             │
│                            └──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Architecture

### **MongoDB Atlas Database: "chatvolt"**

#### **Existing Collections (UNTOUCHED):**
```javascript
{
  // Better Auth & Admin
  users: { /* PostgreSQL via Better Auth */ },
  admins: { /* MongoDB - admin panel */ },
  whitelabel: { /* MongoDB - branding */ },
  
  // Trading App Features
  alerts: { /* MongoDB - price alerts */ },
  watchlist: { /* MongoDB - saved stocks */ },
  dashboardPreferences: { /* MongoDB - user settings */ },
}
```

#### **NEW Collections (Trading Platform):**
```javascript
{
  // ===== CREDIT & WALLET =====
  creditWallets: {
    userId: "user_123", // Links to Better Auth user
    creditBalance: 150.00,
    totalDeposited: 200.00,
    totalWithdrawn: 50.00,
    totalSpentOnCompetitions: 30.00,
    totalWonFromCompetitions: 50.00,
    kycVerified: true,
    withdrawalEnabled: true,
  },
  
  walletTransactions: {
    userId: "user_123",
    transactionType: "competition_win",
    amount: 80.00,
    balanceBefore: 10.00,
    balanceAfter: 90.00,
    competitionId: "comp_456",
    status: "completed",
  },
  
  // ===== COMPETITIONS =====
  competitions: {
    _id: "comp_456",
    name: "Weekly Forex Challenge",
    slug: "weekly-forex-challenge-2025-w47",
    entryFee: 10.00, // credits
    startingCapital: 10000, // trading points
    startTime: "2025-11-25T00:00:00Z",
    endTime: "2025-12-01T23:59:59Z",
    status: "active",
    assetClasses: ["forex"],
    prizePool: 100.00, // 10 users × 10 credits
    platformFeePercentage: 20,
    prizeDistribution: [
      { rank: 1, percentage: 70 }, // Winner gets 80 credits
      { rank: 2, percentage: 20 }, // 20 credits
      { rank: 3, percentage: 10 }, // 10 credits
    ],
    currentParticipants: 10,
    maxParticipants: 100,
  },
  
  competitionParticipants: {
    competitionId: "comp_456",
    userId: "user_123",
    username: "trader_mike",
    startingCapital: 10000,
    currentCapital: 12500, // Updated real-time
    pnl: 2500,
    pnlPercentage: 25.00,
    rank: 1, // Current rank
    totalTrades: 15,
    winningTrades: 10,
    losingTrades: 5,
    status: "active",
  },
  
  // ===== TRADING ENGINE =====
  tradingOrders: {
    _id: "order_789",
    competitionId: "comp_456",
    userId: "user_123",
    symbol: "EUR/USD",
    side: "buy",
    orderType: "market",
    quantity: 1000, // 1 mini lot
    price: null, // Market order
    stopLoss: 1.0850,
    takeProfit: 1.0950,
    status: "filled",
    executedPrice: 1.0900,
    executedAt: "2025-11-25T10:30:00Z",
  },
  
  tradingPositions: {
    _id: "pos_101",
    competitionId: "comp_456",
    userId: "user_123",
    symbol: "EUR/USD",
    side: "long",
    quantity: 1000,
    entryPrice: 1.0900,
    currentPrice: 1.0925, // Updated real-time
    unrealizedPnl: 25.00,
    unrealizedPnlPercentage: 0.23,
    stopLoss: 1.0850,
    takeProfit: 1.0950,
    leverage: 10,
    marginUsed: 109.00,
    openedAt: "2025-11-25T10:30:00Z",
  },
  
  tradeHistory: {
    _id: "trade_202",
    competitionId: "comp_456",
    userId: "user_123",
    symbol: "EUR/USD",
    side: "long",
    entryPrice: 1.0900,
    exitPrice: 1.0950,
    quantity: 1000,
    realizedPnl: 50.00,
    holdingTime: 3600, // seconds
    closedAt: "2025-11-25T11:30:00Z",
  },
  
  // ===== MARKET DATA =====
  priceTicks: { // Time-series collection
    symbol: "EUR/USD",
    timestamp: "2025-11-25T10:30:15Z",
    bid: 1.0900,
    ask: 1.0902,
    mid: 1.0901,
    source: "massive",
  },
  
  // ===== LEADERBOARDS =====
  leaderboardCache: { // Pre-calculated for speed
    competitionId: "comp_456",
    rankings: [
      {
        rank: 1,
        userId: "user_123",
        username: "trader_mike",
        currentCapital: 12500,
        pnl: 2500,
        pnlPercentage: 25.00,
      },
      // ... more ranks
    ],
    lastUpdated: "2025-11-25T10:30:00Z",
  },
}
```

---

## 🔄 User Journey Flow

### **1. User Registration & Wallet Setup**

```javascript
// User signs up via Better Auth (existing)
POST /api/auth/signup
{
  email: "trader@example.com",
  password: "***",
  fullName: "Mike Trader"
}

// Response: user_123 (PostgreSQL)

// Automatically create credit wallet (MongoDB)
POST /api/wallet/create (internal)
{
  userId: "user_123",
  creditBalance: 0,
}

// Wallet created: wallet_456
```

---

### **2. Deposit Credits (EUR → Credits)**

```javascript
// Frontend: User clicks "Deposit €50"
POST /api/wallet/deposit/initiate
{
  userId: "user_123",
  amount: 50.00,
  currency: "EUR"
}

// Backend: Create Stripe payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // €50.00 in cents
  currency: 'eur',
  metadata: { userId: "user_123" },
});

// User completes payment in Stripe

// Webhook: Stripe confirms payment
POST /api/webhooks/stripe
{
  event: "payment_intent.succeeded",
  paymentIntentId: "pi_123",
}

// Update wallet in MongoDB
await CreditWallet.findOneAndUpdate(
  { userId: "user_123" },
  {
    $inc: {
      creditBalance: 50.00,
      totalDeposited: 50.00,
    },
  }
);

// Create transaction record
await WalletTransaction.create({
  userId: "user_123",
  transactionType: "deposit",
  amount: 50.00,
  balanceBefore: 0,
  balanceAfter: 50.00,
  paymentMethod: "stripe",
  paymentId: "pi_123",
  status: "completed",
});

// Send confirmation email (Nodemailer)
await sendEmail({
  to: "trader@example.com",
  subject: "Deposit Successful",
  html: "You've added 50 credits to your wallet!",
});
```

---

### **3. Enter Competition**

```javascript
// Frontend: User clicks "Enter Competition" (€10 entry fee)
POST /api/competitions/enter
{
  competitionId: "comp_456",
  userId: "user_123"
}

// Backend: Validate & Process
const competition = await Competition.findById("comp_456");
const wallet = await CreditWallet.findOne({ userId: "user_123" });

// Check: Has enough credits?
if (wallet.creditBalance < competition.entryFee) {
  throw new Error("Insufficient credits");
}

// Check: Competition still open?
if (competition.status !== "upcoming" || new Date() > competition.registrationDeadline) {
  throw new Error("Registration closed");
}

// Start MongoDB Transaction (ACID)
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 1. Deduct credits from wallet
  await CreditWallet.findOneAndUpdate(
    { userId: "user_123" },
    {
      $inc: {
        creditBalance: -10.00,
        totalSpentOnCompetitions: 10.00,
      },
    },
    { session }
  );

  // 2. Add credits to competition prize pool
  await Competition.findByIdAndUpdate(
    "comp_456",
    {
      $inc: {
        prizePool: 10.00,
        currentParticipants: 1,
      },
    },
    { session }
  );

  // 3. Create competition participant record
  await CompetitionParticipant.create([
    {
      competitionId: "comp_456",
      userId: "user_123",
      startingCapital: 10000, // Virtual trading capital
      currentCapital: 10000,
      pnl: 0,
      status: "active",
    },
  ], { session });

  // 4. Create transaction record
  await WalletTransaction.create([
    {
      userId: "user_123",
      transactionType: "competition_entry",
      amount: -10.00,
      balanceBefore: 50.00,
      balanceAfter: 40.00,
      competitionId: "comp_456",
      status: "completed",
    },
  ], { session });

  // Commit transaction
  await session.commitTransaction();

  return {
    success: true,
    message: "Successfully entered competition!",
    tradingCapital: 10000,
  };
} catch (error) {
  // Rollback if any step fails
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### **4. Competition Starts - Trading Begins**

```javascript
// Scheduled job runs at competition start time
// Every minute: Check if any competition should start

const now = new Date();
const competitionsToStart = await Competition.find({
  status: "upcoming",
  startTime: { $lte: now },
  currentParticipants: { $gte: minParticipants },
});

for (const competition of competitionsToStart) {
  // Update competition status
  competition.status = "active";
  await competition.save();

  // Notify all participants via WebSocket
  io.to(`competition:${competition._id}`).emit("competition:started", {
    competitionId: competition._id,
    message: "Competition has started! Start trading now!",
  });

  // Send email notifications
  const participants = await CompetitionParticipant.find({
    competitionId: competition._id,
  });

  for (const participant of participants) {
    await sendEmail({
      to: participant.email,
      subject: `${competition.name} has started!`,
      html: "Go to your trading dashboard and start trading!",
    });
  }
}
```

---

### **5. Real-Time Trading**

```javascript
// ===== MARKET DATA FEED (Massive.com WebSocket) =====

// Connect to Massive.com
const ws = new WebSocket('wss://api.massive.com/v1/ws');

ws.on('open', () => {
  // Subscribe to forex pairs
  ws.send(JSON.stringify({
    action: 'subscribe',
    params: {
      channel: 'forex.quotes',
      symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    },
  }));
});

ws.on('message', (data) => {
  const priceUpdate = JSON.parse(data);
  
  // Save to MongoDB (time-series collection)
  await PriceTick.create({
    symbol: priceUpdate.symbol,
    timestamp: new Date(),
    bid: priceUpdate.bid,
    ask: priceUpdate.ask,
    mid: (priceUpdate.bid + priceUpdate.ask) / 2,
    source: 'massive',
  });

  // Update all open positions for this symbol
  const openPositions = await TradingPosition.find({
    symbol: priceUpdate.symbol,
    status: 'open',
  });

  for (const position of openPositions) {
    const currentPrice = position.side === 'long' ? priceUpdate.bid : priceUpdate.ask;
    const unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity * (position.side === 'long' ? 1 : -1);

    // Update position
    position.currentPrice = currentPrice;
    position.unrealizedPnl = unrealizedPnl;
    position.unrealizedPnlPercentage = (unrealizedPnl / position.entryPrice) * 100;
    await position.save();

    // Update participant's capital
    await CompetitionParticipant.findOneAndUpdate(
      { 
        competitionId: position.competitionId,
        userId: position.userId,
      },
      {
        $set: {
          currentCapital: calculateTotalCapital(position.userId, position.competitionId),
          pnl: calculatePnL(position.userId, position.competitionId),
        },
      }
    );

    // Check stop loss / take profit
    if ((position.side === 'long' && currentPrice <= position.stopLoss) ||
        (position.side === 'short' && currentPrice >= position.stopLoss)) {
      await closePosition(position._id, currentPrice, 'stop_loss');
    }

    if ((position.side === 'long' && currentPrice >= position.takeProfit) ||
        (position.side === 'short' && currentPrice <= position.takeProfit)) {
      await closePosition(position._id, currentPrice, 'take_profit');
    }
  }

  // Broadcast to all connected clients via Socket.IO
  io.to('trading').emit('price:update', {
    symbol: priceUpdate.symbol,
    price: priceUpdate.mid,
    timestamp: new Date(),
  });
});


// ===== USER PLACES ORDER =====

// Frontend: User clicks "Buy EUR/USD"
POST /api/trading/order/create
{
  competitionId: "comp_456",
  userId: "user_123",
  symbol: "EUR/USD",
  side: "buy",
  orderType: "market",
  quantity: 1000, // 1 mini lot
  stopLoss: 1.0850,
  takeProfit: 1.0950,
}

// Backend: Validate & Execute
async function createOrder(orderData) {
  // 1. Validate participant is in competition
  const participant = await CompetitionParticipant.findOne({
    competitionId: orderData.competitionId,
    userId: orderData.userId,
  });

  if (!participant) throw new Error("Not in competition");

  // 2. Check available capital
  const requiredMargin = calculateMargin(orderData.quantity, orderData.symbol);
  if (participant.availableCapital < requiredMargin) {
    throw new Error("Insufficient capital");
  }

  // 3. Get current market price
  const currentPrice = await getCurrentPrice(orderData.symbol);

  // 4. Create order record
  const order = await TradingOrder.create({
    ...orderData,
    status: "filled",
    executedPrice: currentPrice.ask, // Market buy at ask price
    executedAt: new Date(),
  });

  // 5. Create position
  const position = await TradingPosition.create({
    competitionId: orderData.competitionId,
    userId: orderData.userId,
    symbol: orderData.symbol,
    side: "long",
    quantity: orderData.quantity,
    entryPrice: currentPrice.ask,
    currentPrice: currentPrice.ask,
    unrealizedPnl: 0,
    stopLoss: orderData.stopLoss,
    takeProfit: orderData.takeProfit,
    leverage: participant.leverage || 1,
    marginUsed: requiredMargin,
    status: "open",
  });

  // 6. Update participant capital
  await CompetitionParticipant.findByIdAndUpdate(participant._id, {
    $inc: {
      availableCapital: -requiredMargin,
      totalTrades: 1,
    },
  });

  // 7. Notify user via WebSocket
  io.to(`user:${orderData.userId}`).emit("order:filled", {
    orderId: order._id,
    positionId: position._id,
    message: "Order filled successfully!",
  });

  return { order, position };
}
```

---

### **6. Competition Ends - Winner Determination**

```javascript
// Scheduled job runs at competition end time

const now = new Date();
const competitionsToEnd = await Competition.find({
  status: "active",
  endTime: { $lte: now },
});

for (const competition of competitionsToEnd) {
  // 1. Close all open positions
  const openPositions = await TradingPosition.find({
    competitionId: competition._id,
    status: "open",
  });

  for (const position of openPositions) {
    const currentPrice = await getCurrentPrice(position.symbol);
    await closePosition(position._id, currentPrice.mid, "competition_end");
  }

  // 2. Calculate final rankings
  const participants = await CompetitionParticipant.find({
    competitionId: competition._id,
  })
    .sort({ pnl: -1 })
    .lean();

  const leaderboard = participants.map((p, index) => ({
    rank: index + 1,
    userId: p.userId,
    username: p.username,
    finalCapital: p.currentCapital,
    pnl: p.pnl,
    pnlPercentage: p.pnlPercentage,
    totalTrades: p.totalTrades,
    winRate: (p.winningTrades / p.totalTrades) * 100,
    prizeAmount: 0, // Calculated next
  }));

  // 3. Distribute prizes
  const prizePool = competition.prizePool;
  const platformFee = prizePool * (competition.platformFeePercentage / 100);
  const netPrizePool = prizePool - platformFee;

  for (const dist of competition.prizeDistribution) {
    const winner = leaderboard.find((l) => l.rank === dist.rank);
    if (winner) {
      const prizeAmount = netPrizePool * (dist.percentage / 100);
      winner.prizeAmount = prizeAmount;

      // Add credits to winner's wallet
      await CreditWallet.findOneAndUpdate(
        { userId: winner.userId },
        {
          $inc: {
            creditBalance: prizeAmount,
            totalWonFromCompetitions: prizeAmount,
          },
        }
      );

      // Create transaction record
      await WalletTransaction.create({
        userId: winner.userId,
        transactionType: "competition_win",
        amount: prizeAmount,
        competitionId: competition._id,
        status: "completed",
        description: `Prize for Rank ${winner.rank} in ${competition.name}`,
      });

      // Send notification
      await sendEmail({
        to: winner.email,
        subject: `Congratulations! You won ${competition.name}!`,
        html: `You placed ${winner.rank} and won ${prizeAmount} credits!`,
      });
    }
  }

  // 4. Create platform fee transaction
  await WalletTransaction.create({
    userId: "platform",
    transactionType: "platform_fee",
    amount: platformFee,
    competitionId: competition._id,
    status: "completed",
  });

  // 5. Update competition
  competition.status = "completed";
  competition.winnerId = leaderboard[0].userId;
  competition.winnerPnL = leaderboard[0].pnl;
  competition.finalLeaderboard = leaderboard;
  await competition.save();

  // 6. Notify all participants
  io.to(`competition:${competition._id}`).emit("competition:ended", {
    competitionId: competition._id,
    leaderboard: leaderboard.slice(0, 10), // Top 10
  });
}
```

---

### **7. Withdraw Credits (Credits → EUR)**

```javascript
// Frontend: User clicks "Withdraw €50"
POST /api/wallet/withdraw/initiate
{
  userId: "user_123",
  amount: 50.00,
  currency: "EUR",
  bankAccount: {
    iban: "DE89370400440532013000",
    name: "Mike Trader",
  }
}

// Backend: Validate & Process
const wallet = await CreditWallet.findOne({ userId: "user_123" });

// Check: KYC verified?
if (!wallet.kycVerified) {
  throw new Error("KYC verification required");
}

// Check: Withdrawal enabled?
if (!wallet.withdrawalEnabled) {
  throw new Error("Withdrawals not enabled for this account");
}

// Check: Sufficient balance?
if (wallet.creditBalance < 50.00) {
  throw new Error("Insufficient balance");
}

// Create pending transaction
const transaction = await WalletTransaction.create({
  userId: "user_123",
  transactionType: "withdrawal",
  amount: -50.00,
  balanceBefore: wallet.creditBalance,
  balanceAfter: wallet.creditBalance - 50.00,
  status: "pending",
  metadata: {
    bankAccount: { /* encrypted */ },
  },
});

// Process via Stripe payout
const payout = await stripe.payouts.create({
  amount: 5000, // €50.00 in cents
  currency: 'eur',
  metadata: {
    userId: "user_123",
    transactionId: transaction._id,
  },
});

// Update transaction
transaction.paymentId = payout.id;
transaction.status = "completed";
transaction.processedAt = new Date();
await transaction.save();

// Update wallet
wallet.creditBalance -= 50.00;
wallet.totalWithdrawn += 50.00;
await wallet.save();

// Send confirmation
await sendEmail({
  to: "trader@example.com",
  subject: "Withdrawal Processed",
  html: "€50.00 has been sent to your bank account!",
});
```

---

## 🚀 Implementation Roadmap

### **Phase 1: Foundation (Weeks 1-2)**
- ✅ Install packages (Socket.IO, Stripe, Lightweight Charts)
- ✅ Create MongoDB models (wallet, transactions, competitions)
- ✅ Setup Stripe integration
- ✅ Build credit wallet UI
- ✅ Test deposit/withdrawal flow

### **Phase 2: Competition System (Weeks 3-4)**
- ✅ Admin panel: Create competitions
- ✅ Competition lobby UI
- ✅ Registration/entry system
- ✅ Competition lifecycle management

### **Phase 3: Trading Engine (Weeks 5-8)**
- ✅ Connect market data feeds (Massive.com, Finnhub)
- ✅ Build order management system
- ✅ Position tracking & P&L calculation
- ✅ WebSocket real-time updates
- ✅ Trading interface with Lightweight Charts

### **Phase 4: Polish & Launch (Weeks 9-10)**
- ✅ Real-time leaderboards
- ✅ Email notifications
- ✅ Testing & bug fixes
- ✅ Legal review
- ✅ Beta launch

---

## 🔒 Security Considerations

1. **ACID Transactions** - Use MongoDB transactions for all money movements
2. **KYC/AML** - Required for withdrawals
3. **Rate Limiting** - Prevent order spam
4. **Input Validation** - Validate all user inputs
5. **Encryption** - Encrypt sensitive data (bank details)
6. **Audit Logs** - Track all transactions
7. **Fraud Detection** - Monitor unusual patterns

---

## 📊 Performance Optimization

1. **MongoDB Indexes** - On userId, competitionId, symbol, status
2. **Redis Caching** - Cache current prices, leaderboards
3. **WebSocket Scaling** - Use Socket.IO Redis adapter for multiple servers
4. **Database Sharding** - Shard by competitionId as platform grows
5. **CDN** - Serve static assets (charts, images)

---

## 🎯 Next Steps

1. **Install packages** - Run installation script
2. **Setup MongoDB** - Add `MONGODB_URI` to `.env`
3. **Create models** - Copy models to `database/models/trading/`
4. **Build wallet** - Start with credit wallet system
5. **Test in dev** - Test deposit/withdrawal flow

Ready to start building? Let me know which phase you want to tackle first! 🚀

