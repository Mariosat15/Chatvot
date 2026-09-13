# 🏷️ White-Label Stripe Setup Guide

## Complete Manual for Setting Up Individual Stripe Accounts per Customer

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Option A: Individual Stripe Accounts (Recommended)](#option-a-individual-stripe-accounts)
4. [Option B: Stripe Connect Platform](#option-b-stripe-connect-platform)
5. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
6. [Admin Panel Configuration](#admin-panel-configuration)
7. [Webhook Setup](#webhook-setup)
8. [Testing Checklist](#testing-checklist)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)

---

## Overview

This guide explains how to set up individual Stripe accounts for each white-label customer of your trading platform.

### Architecture Options:

| Option | Description | Best For |
|--------|-------------|----------|
| **A: Individual Accounts** | Each customer creates their own Stripe account | Full control, simple setup |
| **B: Stripe Connect** | You manage a platform, customers are "connected accounts" | Centralized management |

**We recommend Option A** for most white-label setups as it gives customers full control of their funds.

---

## Prerequisites

Before starting, ensure you have:

- [ ] White-label customer's domain ready (e.g., `trading.customername.com`)
- [ ] SSL certificate configured (HTTPS required for Stripe)
- [ ] Access to deploy environment variables
- [ ] Admin Panel access for the white-label instance

---

## Option A: Individual Stripe Accounts

### How It Works:

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR PLATFORM CODE                        │
│                  (Same codebase for all)                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Customer A   │    │  Customer B   │    │  Customer C   │
│ trading.a.com │    │ trading.b.com │    │ trading.c.com │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ Stripe Acct A │    │ Stripe Acct B │    │ Stripe Acct C │
│ sk_live_AAA   │    │ sk_live_BBB   │    │ sk_live_CCC   │
│ whsec_AAA     │    │ whsec_BBB     │    │ whsec_CCC     │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Benefits:
- ✅ Customer owns their Stripe account and funds
- ✅ Customer manages their own payouts
- ✅ Simple setup - no Stripe Connect complexity
- ✅ Customer can use their existing Stripe account
- ✅ Full isolation between customers

### Drawbacks:
- ❌ Customer must create/have Stripe account
- ❌ You can't centrally manage all payments
- ❌ Each customer needs separate webhook setup

---

## Step-by-Step Setup Guide

### Phase 1: Customer Creates Stripe Account

**Instructions to send to your customer:**

```markdown
## Create Your Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Create account with your business email
3. Complete business verification:
   - Business name
   - Business address
   - Bank account for payouts
   - Tax information
4. Once verified, you'll have access to API keys
```

---

### Phase 2: Get Stripe API Keys

**Customer needs to provide these keys:**

#### Get Keys from Stripe Dashboard:

1. Login to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API Keys**
3. Copy these values:

| Key Type | Example | Where to Find |
|----------|---------|---------------|
| **Publishable Key** | `pk_live_xxxxx` | Shown directly |
| **Secret Key** | `sk_live_xxxxx` | Click "Reveal" |

⚠️ **Important:** Use `pk_live_` and `sk_live_` keys for production!

---

### Phase 3: Deploy White-Label Instance

#### Environment Variables to Set:

```env
# ===================================
# STRIPE CONFIGURATION
# ===================================

# Customer's Stripe API Keys
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxx

# Webhook Secret (set after webhook creation - Phase 4)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# ===================================
# APP CONFIGURATION  
# ===================================

# The customer's domain
NEXT_PUBLIC_APP_URL=https://trading.customername.com

# Database (separate per customer recommended)
MONGODB_URI=mongodb+srv://user:pass@cluster/customername_db
```

#### Deployment Platforms:

**Vercel:**
```bash
# Via CLI
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production

# Or via Dashboard:
# Project Settings → Environment Variables
```

**Railway:**
```bash
# Via CLI
railway variables set STRIPE_SECRET_KEY=sk_live_xxx

# Or via Dashboard:
# Project → Variables
```

**Docker/VPS:**
```bash
# In docker-compose.yml or .env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

---

### Phase 4: Configure Webhook in Stripe Dashboard

This is the **most important step** - webhooks confirm payments!

#### 4.1 Create Webhook Endpoint

1. Login to customer's [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **Webhooks**
3. Click **"Add endpoint"**

#### 4.2 Configure Endpoint

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://trading.customername.com/api/stripe/webhook` |
| **Description** | Trading Platform Webhooks |
| **Listen to** | Events on your account |

#### 4.3 Select Events

Click **"Select events"** and choose:

```
✅ payment_intent.succeeded        ← REQUIRED (deposits work)
✅ payment_intent.payment_failed   ← Recommended (track failures)
✅ payment_intent.canceled         ← Optional (abandoned payments)
✅ charge.refunded                 ← Optional (track refunds)
```

#### 4.4 Get Webhook Signing Secret

After creating the endpoint:

1. Click on the endpoint you just created
2. Under **"Signing secret"**, click **"Reveal"**
3. Copy the secret: `whsec_xxxxxxxxxxxxxxxxxxxxxxxx`

#### 4.5 Add Webhook Secret to Environment

Add to your deployment:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

### Phase 5: Configure via Admin Panel (Alternative)

Instead of environment variables, you can configure Stripe via Admin Panel:

#### 5.1 Login to Admin Panel

```
https://trading.customername.com/admin
```

#### 5.2 Navigate to Payment Providers

```
Admin Dashboard → Payment Providers → Stripe
```

#### 5.3 Enter Credentials

| Field | Value |
|-------|-------|
| **Provider** | Stripe |
| **Secret Key** | `sk_live_xxxxx` |
| **Publishable Key** | `pk_live_xxxxx` |
| **Webhook Secret** | `whsec_xxxxx` |
| **Test Mode** | OFF (for production) |

#### 5.4 Save Configuration

Click **"Save"** - credentials are stored encrypted in database.

---

## Webhook Setup

### Why Webhooks are Critical

```
Without Webhooks:                    With Webhooks:
┌─────────────────┐                 ┌─────────────────┐
│ User pays €50   │                 │ User pays €50   │
│       ↓         │                 │       ↓         │
│ Stripe charges  │                 │ Stripe charges  │
│       ↓         │                 │       ↓         │
│ ??? Nothing ??? │                 │ Stripe notifies │
│       ↓         │                 │       ↓         │
│ User waits...   │                 │ Credits added!  │
│ Payment PENDING │                 │ Payment DONE ✅ │
└─────────────────┘                 └─────────────────┘
```

### Webhook URL Format

```
https://{customer-domain}/api/stripe/webhook
```

### Events Your Platform Handles

| Event | What It Does |
|-------|--------------|
| `payment_intent.succeeded` | Adds credits to user wallet |
| `payment_intent.payment_failed` | Marks deposit as failed |
| `payment_intent.canceled` | Cancels pending deposit |
| `charge.refunded` | Logs refund (manual handling) |

---

## Testing Checklist

### Before Going Live:

```
□ Test Mode Testing
  □ Use test keys (sk_test_, pk_test_)
  □ Use test card: 4242 4242 4242 4242
  □ Verify webhook receives events
  □ Verify credits are added

□ Live Mode Testing  
  □ Switch to live keys (sk_live_, pk_live_)
  □ Create new webhook endpoint for production URL
  □ Make small real payment (€1)
  □ Verify webhook signature validation
  □ Verify credits are added
  □ Test refund flow

□ Monitoring
  □ Check Stripe Dashboard → Webhooks → Logs
  □ Check server logs for webhook events
  □ Set up error alerting
```

### Test Cards (Test Mode Only):

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0027 6000 3184` | Requires authentication (3D Secure) |

---

## Troubleshooting

### Problem: Webhooks Not Received

**Symptoms:** Payment succeeds in Stripe but app shows "pending"

**Solutions:**

1. **Check webhook URL is correct:**
   ```
   https://trading.customername.com/api/stripe/webhook
   ```
   NOT: `http://` (must be HTTPS)
   NOT: `localhost` (production only)

2. **Check webhook secret matches:**
   - Dashboard secret must match `STRIPE_WEBHOOK_SECRET`

3. **Check Stripe Dashboard → Webhooks → Logs:**
   - Look for failed delivery attempts
   - Check HTTP response codes

4. **Check server logs:**
   ```
   Should see: 📨 Stripe Webhook: payment_intent.succeeded
   If missing: Webhook not reaching server
   ```

### Problem: Signature Verification Failed

**Error:** `Webhook signature verification failed`

**Solutions:**

1. Webhook secret mismatch - re-copy from Stripe Dashboard
2. Make sure using the correct endpoint's secret (each endpoint has its own)
3. Check for extra whitespace in environment variable

### Problem: Credits Not Added

**Check:**
1. `completeDeposit` function logs
2. Database transaction status
3. User wallet balance updates

---

## Security Best Practices

### API Keys

| DO | DON'T |
|----|-------|
| ✅ Store in environment variables | ❌ Commit to git |
| ✅ Use separate keys per environment | ❌ Share keys between customers |
| ✅ Rotate keys periodically | ❌ Log keys in application |
| ✅ Use restricted keys if possible | ❌ Use test keys in production |

### Webhooks

| DO | DON'T |
|----|-------|
| ✅ Always verify signatures | ❌ Trust unverified webhooks |
| ✅ Use HTTPS endpoints | ❌ Use HTTP in production |
| ✅ Handle events idempotently | ❌ Process same event twice |
| ✅ Return 200 quickly | ❌ Do heavy work before responding |

### Database

| DO | DON'T |
|----|-------|
| ✅ Separate database per customer | ❌ Share database without isolation |
| ✅ Encrypt sensitive data | ❌ Store raw card numbers |
| ✅ Regular backups | ❌ Single point of failure |

---

## Quick Reference: New Customer Setup

### Checklist for Platform Admin:

```markdown
## New White-Label Customer: [CUSTOMER NAME]

### Customer Info
- Domain: trading.customername.com
- Contact: customer@email.com
- Stripe Account: [Customer creates]

### Setup Steps

□ 1. Customer creates Stripe account at stripe.com
□ 2. Customer provides API keys:
     - Publishable Key: pk_live_____________
     - Secret Key: sk_live_____________

□ 3. Deploy application to customer domain
□ 4. Set environment variables:
     - STRIPE_SECRET_KEY
     - STRIPE_PUBLISHABLE_KEY

□ 5. Customer creates webhook in their Stripe Dashboard:
     - URL: https://trading.customername.com/api/stripe/webhook
     - Events: payment_intent.succeeded, payment_intent.payment_failed

□ 6. Get webhook secret from customer
□ 7. Set STRIPE_WEBHOOK_SECRET

□ 8. Test deposit with €1
□ 9. Verify webhook logs
□ 10. Go live! 🚀
```

---

## Email Template: Send to New Customer

```
Subject: Stripe Setup Required for Your Trading Platform

Hi [Customer Name],

Welcome to your new trading platform! To enable payments, please complete the following:

1. CREATE STRIPE ACCOUNT (if you don't have one)
   → Go to https://dashboard.stripe.com/register
   → Complete business verification

2. GET YOUR API KEYS
   → Login to Stripe Dashboard
   → Go to Developers → API Keys
   → Copy your Publishable Key (pk_live_xxx)
   → Click "Reveal" and copy Secret Key (sk_live_xxx)

3. CREATE WEBHOOK (Important!)
   → Go to Developers → Webhooks
   → Click "Add endpoint"
   → Enter URL: https://[YOUR-DOMAIN]/api/stripe/webhook
   → Select events:
     ✓ payment_intent.succeeded
     ✓ payment_intent.payment_failed
   → Click "Add endpoint"
   → Copy the "Signing secret" (whsec_xxx)

4. SEND US THE FOLLOWING:
   - Publishable Key (pk_live_xxx)
   - Secret Key (sk_live_xxx) - send securely!
   - Webhook Secret (whsec_xxx)

Once we receive these, we'll complete the setup and your users can start depositing!

Best regards,
[Your Company]
```

---

## Support

If you encounter issues:

1. Check Stripe Dashboard → Developers → Logs
2. Check your server logs for webhook events
3. Verify all keys match between Stripe and your deployment
4. Contact support with error messages and timestamps

---

*Last Updated: December 2024*

