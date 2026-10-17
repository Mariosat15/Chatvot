# 🏓 Paddle Payment Setup Guide

## Why Paddle is Easier Than Stripe

| Feature | Stripe | Paddle |
|---------|--------|--------|
| **Webhook Setup** | CLI or Dashboard + events | Dashboard only |
| **Tax Handling** | You calculate taxes | Paddle handles it |
| **Refunds** | You process them | Paddle handles it |
| **Chargebacks** | You deal with them | Paddle handles it |
| **Setup Steps** | 5-7 steps | 4 steps |

**Paddle is a "Merchant of Record"** - they handle taxes, refunds, and chargebacks!

---

## Quick Setup (4 Steps)

### Step 1: Create Paddle Account

1. Go to [paddle.com](https://paddle.com)
2. Sign up for a Paddle account
3. Complete business verification

### Step 2: Get API Credentials

1. Login to [Paddle Dashboard](https://vendors.paddle.com)
2. Go to **Developer Tools** → **Authentication**
3. Copy these values:

| Key | Where to Find | Example |
|-----|---------------|---------|
| **Vendor ID** | Settings → Business | `12345` |
| **API Key** | Developer Tools → Authentication | `pdl_live_xxx` or `pdl_test_xxx` |
| **Public Key** | Developer Tools → Authentication | Optional for inline checkout |
| **Webhook Secret** | Developer Tools → Webhooks | Optional for extra security |

### Step 3: Configure Webhooks in Paddle Dashboard

According to [Paddle's webhook documentation](https://developer.paddle.com/webhooks/overview), you need to set up a notification destination:

1. Go to **Developer Tools** → **Notifications** in Paddle Dashboard
2. Click **New destination**
3. Configure:
   - **URL**: `https://yourdomain.com/api/paddle/webhook`
   - **Description**: "Platform deposits"
4. Select these events:
   - ✅ `transaction.completed` (REQUIRED - adds credits)
   - ✅ `transaction.updated` (optional - track status)
   - ✅ `transaction.payment_failed` (optional - handle failures)
5. Click **Save**
6. Copy the **Webhook Secret** (optional but recommended)

### Step 4: Add Credentials to Admin Panel

1. Go to **Admin Panel** → **Payment Providers** → **Paddle**
2. Click **Configure**
3. Enter:
   - Vendor ID: `12345`
   - API Key: `pdl_live_xxx`
   - Public Key: (optional)
   - Webhook Secret: (from step 3)
4. Toggle **Active** to ON
5. Click **Save**

**Done!** 🎉

---

## Paddle vs Stripe Webhook Setup

| Aspect | Stripe | Paddle |
|--------|--------|--------|
| **Where** | Stripe Dashboard or CLI | Developer Tools → Notifications |
| **Events** | Multiple required events | Just `transaction.completed` |
| **Signature** | Required | Optional (but recommended) |
| **Testing** | Stripe CLI needed | Built-in webhook simulator |

Paddle's webhook setup is simpler - one place, fewer events!

---

## How It Works

```
User clicks "Deposit €50"
        ↓
Your app creates Paddle transaction
        ↓
User is redirected to Paddle checkout
        ↓
User pays (Paddle handles payment form)
        ↓
Paddle processes payment
        ↓
Paddle sends webhook to your app (automatic!)
        ↓
Your app adds credits to user's wallet
        ↓
User sees balance updated!
```

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/paddle/create-checkout` | Create a payment checkout |
| `POST /api/paddle/webhook` | Receive Paddle notifications |

---

## Environment Variables (Alternative to Admin Panel)

```env
# Paddle Configuration
PADDLE_VENDOR_ID=12345
PADDLE_API_KEY=pdl_live_xxxxxxxxxxxxxxxx
PADDLE_PUBLIC_KEY=your_public_key  # Optional
PADDLE_ENVIRONMENT=production      # or 'sandbox' for testing
PADDLE_WEBHOOK_SECRET=whsec_xxx    # Optional for extra security
```

---

## Testing with Paddle Sandbox

1. Use API key starting with `pdl_test_`
2. Use test card: `4242 4242 4242 4242`
3. Paddle sandbox auto-completes transactions

---

## Comparison: Customer Setup Time

| Provider | Steps | Time |
|----------|-------|------|
| **Paddle** | 4 | ~15 minutes |
| **Stripe** | 7 | ~30 minutes |

**Paddle is still faster** because:
- Webhook config is in one place (not CLI + Dashboard)
- Fewer events to select
- Built-in webhook simulator for testing

---

## Paddle vs Stripe Pricing

| | Paddle | Stripe |
|---|--------|--------|
| **Transaction Fee** | 5% + €0.50 | 2.9% + €0.30 |
| **Tax Handling** | Included | Extra work |
| **Chargebacks** | Included | You pay |
| **Refunds** | Included | You handle |

**Paddle costs more per transaction, but you save time and hassle!**

---

## Webhook Events Handled

Based on [Paddle's webhook events](https://developer.paddle.com/webhooks/overview):

| Event | What Happens | Required? |
|-------|--------------|-----------|
| `transaction.completed` | Credits added to user's wallet | ✅ **Yes** |
| `transaction.payment_failed` | Deposit marked as failed | Optional |
| `transaction.refunded` | Logged for admin review | Optional |

### Minimum Required Events

For deposits to work, you **only need**:
- `transaction.completed`

This is simpler than Stripe which needs `payment_intent.succeeded`.

---

## Troubleshooting

### Payment Not Completing?

1. Check Paddle Dashboard → Transactions
2. Look for any failed or pending transactions
3. Check your server logs for webhook events

### Webhook Not Received?

1. Go to **Developer Tools** → **Notifications** in Paddle Dashboard
2. Check the notification destination status
3. Look for delivery failures/retries
4. Verify the webhook URL is correct: `https://yourdomain.com/api/paddle/webhook`
5. Ensure your server is accessible from the internet

### Use Paddle's Webhook Simulator

Paddle has a built-in [webhook simulator](https://developer.paddle.com/webhooks/overview#explore-scenarios):
1. Go to **Developer Tools** → **Notifications**
2. Click **Simulate** on your notification destination
3. Select `transaction.completed` event
4. Send test webhook

### Test Mode Not Working?

Make sure your API key starts with `pdl_test_` for sandbox mode.

### Signature Verification Failed?

If you added a webhook secret:
1. Go to Paddle Dashboard → Developer Tools → Notifications
2. Find your notification destination
3. Copy the **Secret key**
4. Paste it in Admin Panel → Payment Providers → Paddle → Webhook Secret

---

## Summary: Why Choose Paddle?

✅ **Simpler webhook setup** - one place, fewer events
✅ **Handles taxes** - globally compliant (Merchant of Record)
✅ **Handles refunds** - customer service included
✅ **Handles chargebacks** - fraud protection
✅ **Built-in webhook simulator** - easy testing
✅ **4-step setup** - faster than Stripe

Perfect for white-label customers who want simplicity!

---

## References

- [Paddle Webhooks Overview](https://developer.paddle.com/webhooks/overview)
- [Create a Notification Destination](https://developer.paddle.com/webhooks/create-notification-destination)
- [Verify Webhook Signatures](https://developer.paddle.com/webhooks/verify-signatures)
- [Webhook Simulator](https://developer.paddle.com/webhooks/simulate-webhooks)

---

*Last Updated: December 2024*

