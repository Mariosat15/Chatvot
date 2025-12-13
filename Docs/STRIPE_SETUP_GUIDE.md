# 💳 **STRIPE SETUP GUIDE**

## 🚀 **Quick Fix for Missing Stripe Popup**

The Stripe payment popup isn't showing because the environment variables are not set. Here's how to fix it:

---

## 📝 **Step 1: Get Stripe Test Keys**

### **Option A: Use Existing Stripe Account**
If you already have a Stripe account:

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Click **Developers** in the left sidebar
3. Click **API keys**
4. You'll see:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)
5. Copy both keys

### **Option B: Create New Stripe Account**
If you don't have a Stripe account:

1. Go to [https://stripe.com](https://stripe.com)
2. Click **Sign up**
3. Create your account
4. Once logged in, follow Option A steps above

---

## 📝 **Step 2: Add Keys to .env File**

Open your `.env` file (create it if it doesn't exist in the project root) and add:

```env
# STRIPE (for wallet deposits/withdrawals)
STRIPE_SECRET_KEY=sk_test_51abc123...your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51abc123...your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_secret
```

**Important:**
- Replace `sk_test_...` with your actual **Secret key**
- Replace `pk_test_...` with your actual **Publishable key**
- Leave `STRIPE_WEBHOOK_SECRET` empty for now (webhooks setup is optional for local testing)

---

## 📝 **Step 3: Restart Your Dev Server**

**Stop your current server:**
```bash
Ctrl + C
```

**Start it again:**
```bash
npm run dev
```

---

## ✅ **Step 4: Test the Payment**

1. Go to [http://localhost:3000/wallet](http://localhost:3000/wallet)
2. Click **"Deposit"** button
3. Enter amount (e.g., €50)
4. Click **"Continue to Payment"**
5. **The Stripe form should now appear!** 🎉

### **Test Card Details:**
Use Stripe's test card:
```
Card Number: 4242 4242 4242 4242
Expiry Date: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

6. Click **"Pay"**
7. Payment should succeed!
8. Check your wallet balance updated

---

## 🔧 **Troubleshooting**

### **Issue 1: "Cannot read property 'elements' of null"**
**Cause:** Stripe hasn't loaded yet  
**Fix:** 
1. Check that `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is in `.env`
2. Restart dev server
3. Hard refresh browser (Ctrl + Shift + R)

### **Issue 2: "Invalid API key"**
**Cause:** Wrong key or typo  
**Fix:**
1. Double-check you copied the full key (they're very long!)
2. Make sure it starts with `pk_test_` (publishable) or `sk_test_` (secret)
3. No extra spaces or quotes

### **Issue 3: Payment form shows but payment fails**
**Cause:** Secret key might be wrong  
**Fix:**
1. Verify `STRIPE_SECRET_KEY` in `.env`
2. Check Stripe dashboard for error logs
3. Make sure you're using test mode keys (not live keys)

### **Issue 4: Modal opens but form is blank**
**Cause:** Client secret not created  
**Fix:**
1. Check browser console for errors (F12)
2. Check `/api/stripe/create-payment-intent` is working
3. Verify `STRIPE_SECRET_KEY` is set

---

## 🎯 **What Each Key Does**

### **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** (pk_test_...)
- Used on the **frontend** (client-side)
- Loads Stripe Elements (the payment form)
- Safe to expose in browser
- **THIS IS THE KEY CAUSING YOUR ISSUE!**

### **STRIPE_SECRET_KEY** (sk_test_...)
- Used on the **backend** (server-side)
- Creates payment intents
- Processes actual payments
- **NEVER** expose this publicly

### **STRIPE_WEBHOOK_SECRET** (whsec_...)
- Used to verify webhook signatures
- Optional for local testing
- Required for production

---

## 🧪 **Testing Payment Flow**

### **Successful Payment:**
```
1. Enter €50
2. Click Continue
3. Stripe form appears ✅
4. Enter test card: 4242 4242 4242 4242
5. Enter expiry: 12/25
6. Enter CVC: 123
7. Click Pay
8. Success message appears ✅
9. Wallet balance: +€50 ✅
```

### **Failed Payment (for testing):**
Use this card to test failures:
```
Card: 4000 0000 0000 9995
Result: Payment declined
```

---

## 📚 **Full .env Example**

Your `.env` file should look like this:

```env
NODE_ENV='development'
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# FINNHUB
NEXT_PUBLIC_FINNHUB_API_KEY=your_finnhub_key
FINNHUB_BASE_URL=https://finnhub.io/api/v1

# MONGODB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# BETTER AUTH
BETTER_AUTH_SECRET=your_secret_here
BETTER_AUTH_URL=http://localhost:3000

# GEMINI
GEMINI_API_KEY=your_gemini_key

# NODEMAILER
NODEMAILER_EMAIL=your_email@gmail.com
NODEMAILER_PASSWORD=your_app_password

# STRIPE ⭐ ADD THESE! ⭐
STRIPE_SECRET_KEY=sk_test_51abc123...your_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51abc123...your_key_here
STRIPE_WEBHOOK_SECRET=whsec_...optional_for_local

# ADMIN PANEL
ADMIN_EMAIL=admin@email.com
ADMIN_PASSWORD=admin123
ADMIN_JWT_SECRET=your-super-secret-admin-key-change-in-production
```

---

## 🚀 **After Setup**

Once Stripe is working:

1. ✅ Users can deposit EUR → Credits
2. ✅ Users can enter competitions
3. ✅ Users can trade
4. ✅ Users can withdraw winnings (manual approval for now)

---

## 🔒 **Production Setup (Later)**

For production, you'll need to:

1. **Get Live Keys:**
   - Replace `pk_test_` with `pk_live_`
   - Replace `sk_test_` with `sk_live_`

2. **Set up Webhooks:**
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Copy webhook secret → `STRIPE_WEBHOOK_SECRET`

3. **Enable HTTPS:**
   - Stripe requires HTTPS in production
   - Deploy to Vercel/Netlify (automatic HTTPS)

---

## 💡 **Quick Summary**

**Problem:** Stripe popup not showing  
**Cause:** Missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  
**Solution:** 
1. Get keys from Stripe Dashboard
2. Add to `.env` file
3. Restart server
4. Refresh browser
5. Try deposit again → **IT WORKS!** 🎉

---

## 📞 **Need Help?**

If you're still stuck:

1. Check browser console (F12) for errors
2. Check terminal for server errors
3. Verify all 3 environment variables are set
4. Make sure keys start with correct prefix
5. Hard refresh browser (Ctrl + Shift + R)

---

**Once you add the keys and restart, the Stripe payment form will appear!** ✅

