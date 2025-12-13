# 🏆 Competition & Trading Platform Guide

## 📋 Table of Contents
1. [Competition Lifecycle](#competition-lifecycle)
2. [How to Access Trading](#how-to-access-trading)
3. [Competition Status Updates](#competition-status-updates)
4. [Trading Interface](#trading-interface)
5. [Troubleshooting](#troubleshooting)

---

## 🔄 Competition Lifecycle

### **Competition Statuses**

| Status | Description | User Actions Available |
|--------|-------------|------------------------|
| **Draft** | Admin is creating the competition | ❌ Not visible to users |
| **Upcoming** | Competition is open for registration | ✅ Can enter with credits |
| **Active** | Competition is live, trading enabled | ✅ Can trade (if entered) |
| **Completed** | Competition has ended | ✅ View results & leaderboard |
| **Cancelled** | Competition was cancelled by admin | ❌ No actions available |

### **Status Transitions (Automated)**

The system automatically updates competition statuses every minute:

```
Upcoming → Active: When current time >= startTime
Active → Completed: When current time >= endTime
```

**Implementation**: Inngest cron job (`updateCompetitionStatuses`) runs every minute to check and update statuses.

---

## 🎮 How to Access Trading

### **Step-by-Step Process**

#### **1. Buy Credits**
- Go to `/wallet`
- Click "Deposit Credits"
- Enter amount (e.g., €10 = 10 credits)
- Complete Stripe payment

#### **2. Enter Competition**
- Go to `/competitions`
- Browse available competitions
- Click "View Details" on a competition
- Click "Enter Competition" button
- Entry fee is deducted from your wallet
- You receive starting capital (trading points)

#### **3. Wait for Competition to Start**
- After entering, you'll see: **"You're in this competition!"**
- If status is **Upcoming**: You'll see: **"⏰ Trading will unlock when the competition starts"**
- The competition automatically switches to **Active** at the `startTime`

#### **4. Access Trading Platform**
- Once the competition status is **Active**:
  - The **"Start Trading"** button appears (blue button)
  - Click it to go to `/competitions/{id}/trade`
  - You'll see the full trading interface with:
    - TradingView chart
    - Order form (Buy/Sell)
    - Your open positions
    - Real-time P&L updates

---

## 🔧 Competition Status Updates

### **Automatic Updates (Inngest)**

**File**: `lib/inngest/functions.ts`

```typescript
export const updateCompetitionStatuses = inngest.createFunction(
    { id: 'update-competition-statuses' },
    { cron: '* * * * *' }, // Every minute
    async ({ step }) => {
        // Updates upcoming → active
        // Updates active → completed
    }
);
```

**Registered in**: `app/api/inngest/route.ts`

### **Manual Status Update (If Needed)**

If you need to manually trigger a status update:

```bash
# Option 1: Via Inngest Dashboard (http://localhost:8288)
1. Go to Inngest Dev Server
2. Find "update-competition-statuses" function
3. Click "Trigger" button

# Option 2: Update competition directly in database
# (Use MongoDB Compass or mongosh)
db.competitions.updateOne(
  { _id: ObjectId("YOUR_COMPETITION_ID") },
  { $set: { status: "active" } }
)
```

---

## 🖥️ Trading Interface

### **Components**

#### **Trading Page**: `app/(root)/competitions/[id]/trade/page.tsx`
- Main trading interface
- Only accessible when competition is active
- Requires user to be a participant

#### **Key Components**:

1. **TradingChart** (`components/trading/TradingChart.tsx`)
   - TradingView Lightweight Charts
   - Real-time candlestick data
   - Timeframe selection

2. **OrderForm** (`components/trading/OrderForm.tsx`)
   - Buy/Sell buttons
   - Market/Limit orders
   - Quantity input
   - Leverage selector
   - Stop Loss / Take Profit

3. **PositionsTable** (`components/trading/PositionsTable.tsx`)
   - Open positions
   - Real-time P&L
   - Close position button
   - Unrealized profit/loss

4. **PriceProvider** (`contexts/PriceProvider.tsx`)
   - WebSocket-style price updates
   - Provides real-time prices to all components

---

## 🎯 Competition Flow Example

### **Example: 30-Minute Forex Competition**

| Time | Status | What Happens | User Can... |
|------|--------|--------------|-------------|
| **10:00 AM** | Upcoming | Admin creates competition<br>StartTime: 10:15 AM<br>EndTime: 10:45 AM | • View details<br>• Enter competition |
| **10:10 AM** | Upcoming | Users enter by paying entry fee | • Still can enter<br>• Trading button is hidden |
| **10:15 AM** | **Active** | Status automatically changes<br>Trading unlocks | ✅ **"Start Trading" button appears**<br>✅ Can place orders |
| **10:20 AM** | Active | Trading is live | • Buy/Sell forex pairs<br>• View leaderboard<br>• Close positions |
| **10:45 AM** | **Completed** | Status automatically changes<br>All positions auto-closed | • View final leaderboard<br>• See results<br>• Winner gets prize pool |

---

## 🔍 Troubleshooting

### **❌ "Start Trading" Button Not Showing**

**Possible Causes:**

1. **Competition Status Not Updated**
   - **Check**: Competition status is still "upcoming" even though start time passed
   - **Solution**: Wait 1 minute for Inngest cron to run, or manually trigger status update
   - **Verify**: Refresh the page after 1 minute

2. **Not Entered in Competition**
   - **Check**: Did you click "Enter Competition" and pay the entry fee?
   - **Solution**: Go back to competition details and enter

3. **Insufficient Credits**
   - **Check**: Do you have enough credits in your wallet?
   - **Solution**: Go to `/wallet` and deposit more credits

4. **Competition Time Issue**
   - **Check**: Has the start time actually passed?
   - **Solution**: Look at the "Schedule" section - if start time is in the future, button won't show

### **⏰ Competition Shows "0h 8m"**

**This is normal!** If you created a short test competition:
- Start: 10:13 AM
- End: 10:30 AM
- Duration: 17 minutes

If current time is 10:22 AM, remaining time is indeed 8 minutes.

**Solution**: Create longer competitions:
- Daily competitions: 24 hours
- Weekly competitions: 7 days
- Quick challenges: 2-4 hours

### **🔧 Force Competition Status Update**

If automatic updates aren't working:

#### **Method 1: Restart Dev Server**
```bash
npm run dev
```

#### **Method 2: Check Inngest Dev Server**
```bash
# Make sure Inngest is running
npx inngest-cli@latest dev

# Open http://localhost:8288
# Trigger "update-competition-statuses" manually
```

#### **Method 3: Database Direct Update**
```javascript
// MongoDB Compass or mongosh
use chatvolt;

// Find your competition
db.competitions.find({ name: "Your Competition Name" });

// Update status to active
db.competitions.updateOne(
  { name: "Your Competition Name" },
  { $set: { status: "active" } }
);
```

---

## 📝 Key Files Reference

### **Competition Status Logic**
- `lib/inngest/functions.ts` - Automated status updates (cron)
- `lib/actions/trading/competition.actions.ts` - Competition CRUD operations
- `database/models/trading/competition.model.ts` - Competition schema

### **Trading Platform**
- `app/(root)/competitions/[id]/trade/page.tsx` - Main trading page
- `components/trading/OrderForm.tsx` - Order placement
- `components/trading/PositionsTable.tsx` - Position management
- `components/trading/TradingChart.tsx` - Price charts
- `contexts/PriceProvider.tsx` - Real-time price updates

### **UI Components**
- `app/(root)/competitions/page.tsx` - Competition lobby
- `app/(root)/competitions/[id]/page.tsx` - Competition details
- `components/trading/CompetitionCard.tsx` - Competition preview card
- `components/trading/CompetitionEntryButton.tsx` - Entry & trading access

---

## 🚀 Quick Start Checklist

- [ ] Deposit credits to wallet
- [ ] Enter a competition
- [ ] Wait for competition start time
- [ ] Status auto-updates to "active"
- [ ] "Start Trading" button appears
- [ ] Click button → Go to trading platform
- [ ] Place your first trade!
- [ ] Monitor leaderboard
- [ ] Win the competition! 🏆

---

## 💡 Pro Tips

1. **Create Test Competitions**: Use short durations (5-10 minutes) to test the flow
2. **Check Inngest**: Always have `npx inngest-cli@latest dev` running
3. **Monitor Console**: Server logs show status updates: `✅ Competition status update: X started, Y completed`
4. **Use Dev Tools**: MongoDB Compass helps visualize competition data
5. **Test with Multiple Users**: Open incognito windows to simulate multiple traders

---

## 📞 Need Help?

- **Competition not starting?** → Check Inngest console logs
- **Trading button missing?** → Verify competition status in database
- **Positions not updating?** → Check PriceProvider WebSocket connection
- **Orders failing?** → Check available capital and margin requirements

---

**Last Updated**: November 23, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅

