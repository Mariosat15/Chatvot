# 🧪 Credit Wallet System - Testing Guide

## ✅ **What We Just Built**

### **UI Components Created:**
1. ✅ **Wallet Page** (`app/(root)/wallet/page.tsx`)
   - Balance display with gradient design
   - Statistics cards (deposits, withdrawals, competitions)
   - Quick action buttons
   - Transaction history

2. ✅ **Deposit Modal** (`components/trading/DepositModal.tsx`)
   - Two-step process: Amount → Payment
   - Stripe Elements integration
   - Quick amount buttons (€10, €25, €50, €100)
   - Success/error states
   - Dark theme

3. ✅ **Withdrawal Modal** (`components/trading/WithdrawalModal.tsx`)
   - Amount input with validation
   - Quick amount buttons
   - KYC requirements notice
   - Success confirmation

4. ✅ **Transaction History** (`components/trading/TransactionHistory.tsx`)
   - All transaction types with icons
   - Status badges (completed, pending, failed)
   - Formatted dates and amounts
   - Empty state

5. ✅ **Navigation** - Added "Wallet" to nav menu

---

## 🚀 **How to Test**

### **Step 1: Start Development Server**

```bash
npm run dev
```

Should see:
```
✓ Ready in 2.3s
○ Local:   http://localhost:3000
```

---

### **Step 2: Login to Your App**

1. Open: http://localhost:3000
2. Login with your account
3. You should see "Wallet" in the navigation

---

### **Step 3: Access Wallet**

Click "Wallet" in navigation or go to: http://localhost:3000/wallet

**What you should see:**
- 🎨 **Beautiful gradient balance card** showing €0.00
- 💳 **Deposit button** (yellow/gold)
- 💸 **Withdraw button** (disabled - need balance)
- 📊 **Four statistics cards** (all showing €0)
- 📜 **Empty transaction history** with message

**Console should show:**
```
✅ Created new wallet for user {your_user_id}
```

---

### **Step 4: Test Deposit Flow**

#### **A. Open Deposit Modal**
1. Click "**Deposit**" button
2. Modal should open with dark theme

**What you should see:**
- Title: "Deposit Credits"
- Amount input field
- Quick buttons: €10, €25, €50, €100
- "Continue to Payment" button

#### **B. Enter Amount**
1. Type `50` in amount field  
   OR click "€50" quick button
2. Click "**Continue to Payment**"

**What should happen:**
- Loading spinner appears
- API call to `/api/stripe/create-payment-intent`
- Stripe Payment Element loads

#### **C. Enter Card Details**

Use **Stripe Test Cards:**

**✅ Successful Payment:**
```
Card Number: 4242 4242 4242 4242
Expiry: 12/34 (any future date)
CVC: 123 (any 3 digits)
ZIP: 12345 (any 5 digits)
```

**❌ Payment Declined:**
```
Card Number: 4000 0000 0000 0002
```

**🔐 3D Secure (requires authentication):**
```
Card Number: 4000 0027 6000 3184
```

#### **D. Complete Payment**
1. Click "**Pay €50.00**"
2. Should see loading state
3. Then success checkmark ✅
4. Modal closes after 2 seconds
5. **Balance should update to €50.00!**

---

### **Step 5: Verify Database**

#### **A. Check MongoDB Atlas**
1. Go to: https://cloud.mongodb.com
2. Click "Browse Collections"
3. Database: "chatvolt"
4. Collection: "creditwallets"

**You should see:**
```json
{
  "_id": "...",
  "userId": "your_user_id",
  "creditBalance": 50,
  "totalDeposited": 50,
  "totalWithdrawn": 0,
  "isActive": true,
  "kycVerified": false
}
```

#### **B. Check Transactions**
Collection: "wallettransactions"

**You should see:**
```json
{
  "_id": "...",
  "userId": "your_user_id",
  "transactionType": "deposit",
  "amount": 50,
  "balanceBefore": 0,
  "balanceAfter": 50,
  "status": "completed",
  "paymentMethod": "card",
  "paymentId": "pi_..."
}
```

---

### **Step 6: Check Stripe Dashboard**

1. Go to: https://dashboard.stripe.com/test/payments
2. You should see your €50 payment
3. Status: "Succeeded"
4. Description: "Deposit 50 credits to wallet"

---

### **Step 7: Verify UI Updates**

**On Wallet Page:**
- ✅ Balance shows €50.00
- ✅ "Total Deposited" card shows €50.00
- ✅ Transaction history shows deposit
- ✅ Withdraw button is now ENABLED (have balance > €10)

**Transaction should show:**
- 🔽 Green down arrow icon
- "Deposit" label
- "Completed" badge (green)
- "+€50.00" in green
- Timestamp
- "Card" payment method

---

### **Step 8: Test Webhook (Optional)**

#### **A. Check Terminal Running `stripe listen`**

You should see:
```
[200] POST /api/stripe/webhook [payment_intent.succeeded]
```

#### **B. Check Server Console**

Should show:
```
✅ Payment succeeded: pi_...
   Amount: €50
   User: your_user_id
   Transaction: transaction_id
✅ Deposit completed for transaction transaction_id
```

---

### **Step 9: Test Multiple Deposits**

1. Click "Deposit" again
2. Enter €25
3. Complete payment
4. **Balance should become €75.00**
5. **"Total Deposited" should show €75.00**
6. **Two transactions** should appear in history

---

### **Step 10: Test Withdrawal Request**

1. Click "**Withdraw**" button
2. Enter amount: `20`
3. Click "Request Withdrawal"

**What should happen:**
- Success message appears
- Modal closes after 3 seconds
- **Balance should decrease to €55.00** (€75 - €20)
- **Withdrawal transaction** appears in history
- Status: "Pending" (yellow badge)

**Note:** Withdrawals are manual approval - they won't actually process money yet.

---

## 🎯 **Test Scenarios**

### **✅ Test Case 1: Minimum Deposit**
- Amount: €5
- **Should:** Accept and process
- **Result:** Balance +€5

### **❌ Test Case 2: Below Minimum**
- Amount: €3
- **Should:** Show error "Minimum deposit is €5"
- **Result:** Modal stays open, no payment

### **❌ Test Case 3: Above Maximum**
- Amount: €15,000
- **Should:** Show error "Maximum deposit is €10,000"
- **Result:** Modal stays open, no payment

### **✅ Test Case 4: Minimum Withdrawal**
- Amount: €10
- Balance: €20
- **Should:** Accept request
- **Result:** Balance -€10, pending transaction

### **❌ Test Case 5: Insufficient Balance**
- Amount: €100
- Balance: €50
- **Should:** Show error "Insufficient balance"
- **Result:** No transaction created

### **❌ Test Case 6: Below Minimum Withdrawal**
- Amount: €5
- **Should:** Show error "Minimum withdrawal is €10"
- **Result:** No transaction created

### **✅ Test Case 7: Payment Declined**
- Card: 4000 0000 0000 0002
- **Should:** Show Stripe error
- **Result:** No transaction created, balance unchanged

---

## 🐛 **Troubleshooting**

### **Issue: "Module not found" errors**

**Solution:** Restart dev server
```bash
# Stop server (Ctrl + C)
npm run dev
```

---

### **Issue: Stripe Elements not loading**

**Check:**
1. ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env`
2. ✅ Key starts with `pk_test_`
3. ✅ No spaces or quotes around key

**Solution:**
```bash
# Restart server after updating .env
npm run dev
```

---

### **Issue: Payment succeeds but balance doesn't update**

**Check:**
1. ✅ Webhook forwarding running: `stripe listen...`
2. ✅ `STRIPE_WEBHOOK_SECRET` in `.env`
3. ✅ Check server console for errors

**Debug:**
```bash
# In server console, look for:
✅ Payment succeeded: pi_...
✅ Deposit completed for transaction ...

# If not there, webhook isn't working
```

**Solution:**
```bash
# Restart webhook forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy new webhook secret to .env
# Restart server
```

---

### **Issue: MongoDB errors**

**Check:**
1. ✅ `MONGODB_URI` in `.env`
2. ✅ MongoDB Atlas cluster is running
3. ✅ IP address whitelisted

**Solution:** Check server console for connection errors

---

### **Issue: Wallet shows €0 after deposit**

**Check Browser Console:**
```javascript
// Open DevTools (F12) → Console
// Look for errors
```

**Check Server Console:**
```bash
# Look for:
✅ Payment Intent created: pi_...
✅ Payment succeeded: pi_...
✅ Deposit completed for transaction ...
```

**Force Refresh:**
```bash
# Browser: Ctrl + Shift + R
# Or hard refresh: Ctrl + F5
```

---

## 📊 **Expected Results Summary**

### **After Successful €50 Deposit:**

**Wallet Page:**
- Balance: €50.00 ✅
- Total Deposited: €50.00 ✅
- Total Withdrawn: €0.00 ✅
- Competition Spending: €0.00 ✅
- Competition Winnings: €0.00 ✅
- 1 transaction in history ✅
- Withdraw button enabled ✅

**MongoDB creditwallets:**
```json
{
  "creditBalance": 50,
  "totalDeposited": 50
}
```

**MongoDB wallettransactions:**
```json
[
  {
    "transactionType": "deposit",
    "amount": 50,
    "status": "completed"
  }
]
```

**Stripe Dashboard:**
- 1 successful payment
- Amount: €50.00
- Status: Succeeded

---

## 🎉 **Success Criteria**

✅ **Phase 1: UI Works**
- [x] Can navigate to /wallet
- [x] Wallet page displays properly
- [x] Deposit modal opens
- [x] Amount input works
- [x] Quick buttons work

✅ **Phase 2: Stripe Integration**
- [x] Stripe Elements loads
- [x] Can enter card details
- [x] Payment processes
- [x] Success message shows

✅ **Phase 3: Database Updates**
- [x] Wallet created automatically
- [x] Balance updates after payment
- [x] Transaction recorded
- [x] Stats update correctly

✅ **Phase 4: Webhooks**
- [x] Webhook receives event
- [x] Deposit completed automatically
- [x] No manual intervention needed

---

## 🔜 **What's Next**

### **Once Wallet Testing is Complete:**

**Phase 2: Competition System** (Next week)
1. Admin creates competitions
2. Users enter competitions (deduct credits)
3. Competition lobby
4. Competition lifecycle

**Phase 3: Trading Engine** (Week 3-4)
1. Connect Massive.com (Forex data)
2. Real-time price updates
3. Place orders
4. Track P&L

**Phase 4: Prizes** (Week 5)
1. Leaderboards
2. Winner determination
3. Automatic prize distribution

---

## 📝 **Testing Checklist**

Before moving to next phase, verify:

- [ ] Wallet page loads without errors
- [ ] Can deposit €5 minimum
- [ ] Can deposit €10,000 maximum
- [ ] Below minimum shows error
- [ ] Above maximum shows error
- [ ] Stripe test card works
- [ ] Declined card shows error
- [ ] Balance updates after payment
- [ ] Transaction appears in history
- [ ] Stats update correctly
- [ ] Can request withdrawal (€10+)
- [ ] Withdrawal shows pending status
- [ ] MongoDB has correct data
- [ ] Stripe dashboard shows payment
- [ ] Webhook logs show success

---

## 🚀 **Ready to Test!**

1. **Start server:** `npm run dev`
2. **Start webhooks:** `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. **Login** to your app
4. **Navigate** to Wallet
5. **Deposit** €50
6. **Verify** balance updated
7. **Check** MongoDB
8. **Check** Stripe Dashboard

**Everything working?** ✅  
**Then we build competitions next!** 🎯

---

## 💡 **Tips**

- **Use test cards** - Never use real cards in test mode
- **Check both consoles** - Browser DevTools AND terminal
- **Watch MongoDB** - Verify data is saving
- **Keep webhook running** - Don't close the `stripe listen` terminal
- **Hard refresh** - If UI doesn't update: Ctrl + Shift + R

---

**Questions? Issues? Let me know and I'll help debug!** 🐛

