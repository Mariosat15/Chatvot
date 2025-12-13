# Payment Processing Fees System

## Overview

The payment processing fee system allows admins to set a percentage fee for each payment provider. This fee is deducted from the credits given to users after payment, not from the amount they pay.

---

## How It Works

### Example
- **User pays:** €50
- **Processing fee:** 1%
- **Gross credits:** 50 (1 EUR = 1 Credit)
- **Fee deducted:** 0.50 credits (1% of 50)
- **User receives:** 49.50 credits

---

## Admin Setup

### 1. Access Payment Providers Settings
```
Admin Panel → Settings → Payment Providers
```

### 2. Configure Processing Fee
1. Click **"Configure"** on any payment provider (e.g., Stripe)
2. Find the **"Processing Fee (%)"** field
3. Enter the fee percentage (e.g., `1.5` for 1.5%)
4. See live calculation example: **"€50 → 49.25 credits"**
5. Click **"Save Configuration"**

### Features
- **Range:** 0% to 100% (validated)
- **Decimal support:** Can use `1.5`, `2.75`, etc.
- **Live preview:** Shows calculation as you type
- **Per-provider:** Different fees for Stripe, PayPal, etc.

---

## User Experience

### Deposit Modal (Buy Volts)
When users try to buy credits, they see:

#### Without Fee (0%)
```
€50 → 50 Volts
```

#### With Fee (1%)
```
€50 → 49.50 Volts

Breakdown:
├─ Gross Credits: 50.00 Volts
├─ Processing Fee (1%): -0.50 Volts
└─ You Receive: 49.50 Volts

ℹ️ A 1% processing fee is charged by the payment
   provider and will be deducted from your credits.
```

### Key Points
✅ **User pays the full amount** (€50)
✅ **Fee is deducted from credits**, not EUR
✅ **Transparent display** with full breakdown
✅ **Clear messaging** about where the fee comes from

---

## Technical Implementation

### 1. Database Schema

#### PaymentProvider Model
```typescript
{
  name: string;
  slug: string;
  processingFee: number; // Percentage (0-100)
  // ... other fields
}
```

#### WalletTransaction Model
```typescript
{
  amount: number; // Net credits (after fee)
  metadata: {
    eurAmount: number;         // Original EUR paid
    grossCredits: number;      // Before fee
    processingFeePercentage: number;
    feeAmount: number;         // Credits deducted
    netCredits: number;        // After fee (= amount)
  }
}
```

### 2. Flow

#### Step 1: User Initiates Deposit
```typescript
// Frontend: DepositModal.tsx
const { grossCredits, feeAmount, netCredits } = calculateCreditsAfterFee(amountEur);

// Display breakdown to user
```

#### Step 2: Create Payment Intent
```typescript
// Backend: lib/actions/trading/wallet.actions.ts
export const initiateDeposit = async (amount: number) => {
  // Get provider fee
  const paymentProvider = await PaymentProvider.findOne({ slug: 'stripe' });
  const processingFeePercentage = paymentProvider?.processingFee || 0;
  
  // Calculate net credits
  const grossCredits = amount; // 1 EUR = 1 Credit
  const feeAmount = (grossCredits * processingFeePercentage) / 100;
  const netCredits = grossCredits - feeAmount;
  
  // Store transaction with net amount
  await WalletTransaction.create({
    amount: netCredits, // What user will receive
    metadata: {
      eurAmount: amount,
      grossCredits,
      processingFeePercentage,
      feeAmount,
      netCredits,
    },
  });
};
```

#### Step 3: Complete Payment
```typescript
// Webhook or Manual: app/api/admin/complete-pending-payment/route.ts
// Or: lib/actions/trading/wallet.actions.ts (completeDeposit)

// Credit user with net amount
wallet.creditBalance += transaction.amount; // Already has fee deducted
wallet.totalDeposited += transaction.metadata.eurAmount; // Track EUR, not credits
```

### 3. Key Files Modified

1. **`database/models/payment-provider.model.ts`**
   - Added `processingFee` field (0-100%)

2. **`app/api/payment-config/route.ts`**
   - Returns `processingFee` to frontend

3. **`components/trading/DepositModal.tsx`**
   - Fetches and displays processing fee
   - Shows detailed breakdown with fee calculation
   - Adds info message when fee > 0

4. **`lib/actions/trading/wallet.actions.ts`**
   - `initiateDeposit()`: Calculates and stores net credits
   - `completeDeposit()`: Credits user with net amount

5. **`app/api/admin/complete-pending-payment/route.ts`**
   - Manual completion applies net credits correctly

6. **`components/admin/PaymentProvidersSection.tsx`**
   - UI to set processing fee per provider
   - Live calculation preview

7. **`database/models/trading/wallet-transaction.model.ts`**
   - Added `withdrawal_fee` transaction type

---

## Testing

### Test the Full Flow

1. **Set a Processing Fee**
   ```
   Admin Panel → Settings → Payment Providers → Stripe
   Set Processing Fee: 1%
   Save
   ```

2. **Make a Test Deposit**
   ```
   User Account → Wallet → Deposit
   Enter: €50
   
   Expected Display:
   - Gross: 50 Volts
   - Fee (1%): -0.50 Volts
   - You Receive: 49.50 Volts
   ```

3. **Complete Payment**
   ```
   Option A (Webhook): Payment auto-completes
   Option B (Manual): Admin Panel → Payments → Complete Payment
   ```

4. **Verify**
   ```
   User Wallet: +49.50 Volts (not 50)
   Transaction History: Shows full breakdown
   ```

### Test Different Fees

| Fee % | User Pays | Gross | Fee    | Net Receives |
|-------|-----------|-------|--------|--------------|
| 0%    | €50       | 50    | 0      | 50.00        |
| 1%    | €50       | 50    | 0.50   | 49.50        |
| 2.5%  | €50       | 50    | 1.25   | 48.75        |
| 5%    | €50       | 50    | 2.50   | 47.50        |
| 10%   | €100      | 100   | 10.00  | 90.00        |

---

## Admin Features

### 1. Pending Payments Tab
```
Admin Panel → Payments
```
- View all pending deposits
- See EUR amount and net credits
- Complete manually if webhooks fail
- Bulk complete all pending

### 2. Payment Provider Settings
```
Admin Panel → Settings → Payment Providers
```
- Set different fees for each provider
- Live preview of fee calculation
- Test mode toggle
- Webhook URL configuration

---

## Important Notes

### ⚠️ Fee Application
- **Fees are NOT refundable** once applied
- **Fees are deducted from credits**, not EUR
- **Users always pay the full EUR amount** they enter
- **Transparent**: Full breakdown shown before payment

### 💡 Best Practices
1. **Set realistic fees** based on actual provider costs
2. **Inform users** about fees in Terms of Service
3. **Test thoroughly** before going live
4. **Monitor transactions** in admin panel
5. **Keep fees low** to encourage deposits

### 🔒 Security
- Fee cannot be negative
- Fee cannot exceed 100%
- Fee is set by admin only
- Transaction metadata stores audit trail

---

## Troubleshooting

### Issue: User received full amount without fee deduction
**Cause:** Fee was set to 0% or transaction was created before fee system
**Solution:** Check provider fee setting in admin panel

### Issue: Fee calculation seems wrong
**Cause:** Using old transaction or cached data
**Solution:** 
1. Check `transaction.metadata` for fee details
2. Verify provider `processingFee` value
3. Clear browser cache and retry

### Issue: Payment stuck in pending
**Cause:** Webhook not configured or failed
**Solution:** Use manual completion in Admin Panel → Payments

---

## Future Enhancements

Possible improvements:
- [ ] Different fees for different deposit amounts (tiers)
- [ ] Time-limited promotional fee rates
- [ ] Fee exemptions for VIP users
- [ ] Platform fee separate from payment provider fee
- [ ] Monthly fee revenue reports for admin

---

## Summary

✅ **Flexible**: Per-provider fee configuration  
✅ **Transparent**: Full breakdown shown to users  
✅ **Fair**: Fee deducted from credits, not EUR paid  
✅ **Auditable**: Full metadata stored in transactions  
✅ **Admin-friendly**: Easy to configure and test  

The payment processing fee system gives you full control over payment costs while maintaining transparency with users!

