# 🧪 Fraud Detection System - Testing & Verification Guide

## ❓ Why You're Not Seeing Alerts (2 Accounts Same PC)

### **Most Likely Reasons:**

### **1. Default Threshold Setting**
```typescript
Default: maxAccountsPerDevice = 3
Your situation: 2 accounts

Result: NO ALERT (2 < 3)
```

**The system only creates alerts when accounts EXCEED the threshold!**

---

## 🎯 **HOW THE SYSTEM WORKS**

### **Detection Logic:**

```
Account 1 signs up
├─ Device fingerprint captured
├─ Stored in database
└─ No alert (first account)

Account 2 signs up (same device)
├─ Device fingerprint matches Account 1
├─ linkedUserIds: [Account1, Account2]
├─ Total: 2 accounts
├─ Check: 2 > maxAccountsPerDevice (3)?
└─ NO → No alert created

Account 3 signs up (same device)
├─ Device fingerprint matches Account 1 & 2
├─ linkedUserIds: [Account1, Account2, Account3]
├─ Total: 3 accounts
├─ Check: 3 > maxAccountsPerDevice (3)?
└─ NO → No alert (equal, not greater)

Account 4 signs up (same device)
├─ Device fingerprint matches Account 1, 2 & 3
├─ linkedUserIds: [Account1, Account2, Account3, Account4]
├─ Total: 4 accounts
├─ Check: 4 > maxAccountsPerDevice (3)?
└─ YES → 🚨 ALERT CREATED!
```

---

## ✅ **HOW TO VERIFY IT'S WORKING**

### **Method 1: Lower the Threshold (Recommended)**

**Step 1: Go to Admin Panel → Fraud → Settings**

**Step 2: Change "Max Accounts Per Device"**
```
Current: 3
Change to: 1
Save Changes
```

**Step 3: Create Account 3 (or use Account 2 if you deleted data)**
```
Sign up with a new account from same PC
→ Should now create an alert!
```

**Step 4: Check for Alerts**
```
Admin Panel → Fraud → Fraud Alerts tab
→ Look for "Multiple Accounts on Same Device" alert
```

---

### **Method 2: Create More Test Accounts**

**Without changing settings:**
```
Create Account 3 → No alert (3 is not > 3)
Create Account 4 → 🚨 ALERT! (4 > 3)
```

---

### **Method 3: Check Database Directly**

**Step 1: Verify Device Fingerprints Are Being Stored**

Create a test file to check the database:

```typescript
// test-fraud-detection.ts
import { connectToDatabase } from '@/database/mongoose';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';

async function checkDeviceFingerprints() {
  await connectToDatabase();
  
  // Get all device fingerprints
  const fingerprints = await DeviceFingerprint.find({});
  
  console.log('📊 Total Device Fingerprints:', fingerprints.length);
  
  fingerprints.forEach((fp, index) => {
    console.log(`\n🔍 Device ${index + 1}:`);
    console.log(`  Fingerprint ID: ${fp.fingerprintId}`);
    console.log(`  Primary User: ${fp.userId}`);
    console.log(`  Linked Users: ${fp.linkedUserIds.length} accounts`);
    console.log(`  All Users: [${fp.userId}, ...${fp.linkedUserIds.join(', ')}]`);
    console.log(`  Risk Score: ${fp.riskScore}`);
    console.log(`  IP: ${fp.ipAddress}`);
    console.log(`  Device: ${fp.deviceType} - ${fp.browser} ${fp.browserVersion}`);
    console.log(`  OS: ${fp.os} ${fp.osVersion}`);
    console.log(`  VPN: ${fp.isVPN}, Proxy: ${fp.isProxy}, Tor: ${fp.isTor}`);
  });
}

checkDeviceFingerprints();
```

---

## 🔍 **DETAILED VERIFICATION STEPS**

### **Test 1: Device Fingerprinting**

**1. Create First Account**
```
Sign Up → User A
```

**2. Check Admin Panel**
```
Admin Panel → Fraud → Suspicious Devices tab
→ Should see 1 device
→ Linked Accounts: 1
```

**3. Create Second Account (Same Browser, Same PC)**
```
Sign Out → Sign Up → User B
```

**4. Check Admin Panel Again**
```
Admin Panel → Fraud → Suspicious Devices tab
→ Should STILL see 1 device (same fingerprint)
→ Linked Accounts: 2 ⬅️ THIS SHOULD INCREASE!
```

**5. If Linked Accounts DIDN'T Increase:**
```
Problem: Device fingerprinting not working
Cause: Browser cleared cookies/cache OR using incognito
Solution: Use normal browser window, don't clear data
```

---

### **Test 2: VPN Detection**

**1. Create Account with VPN OFF**
```
Sign Up → User A (normal IP)
```

**2. Check Admin Panel**
```
Admin Panel → Fraud → Fraud Alerts
→ Should see NO alerts (normal IP)
```

**3. Create Account with VPN ON**
```
Connect to NordVPN/ExpressVPN/any VPN
Sign Up → User B (VPN IP)
```

**4. Check Admin Panel**
```
Admin Panel → Fraud → Fraud Alerts
→ Should see "VPN Usage Detected" alert 🚨
```

---

### **Test 3: Risk Score Calculation**

**Scenario 1: Low Risk (Normal User)**
```
Device: New, single account
VPN: No
Proxy: No
Tor: No

Risk Score: 0
Action: No alert
```

**Scenario 2: Medium Risk (Multiple Accounts)**
```
Device: 3 accounts
VPN: No
Proxy: No
Tor: No

Risk Score: 20-40 (depends on settings)
Action: Alert if > alertThreshold (default 40)
```

**Scenario 3: High Risk (Multiple Accounts + VPN)**
```
Device: 4 accounts
VPN: Yes (Risk +30)
Proxy: No
Tor: No

Risk Score: 60-70
Action: Alert created + Entry may be blocked
```

**Scenario 4: Critical Risk (Tor Network)**
```
Device: Any
VPN: No
Proxy: No
Tor: Yes (Risk +50)

Risk Score: 50+
Action: Critical alert + Entry blocked
```

---

## 🎯 **RECOMMENDED TESTING PROCEDURE**

### **Phase 1: Basic Device Detection (5 minutes)**

```bash
# Test Setup
1. Clear browser cache (optional, for clean test)
2. Go to Admin Panel → Fraud → Settings
3. Set "Max Accounts Per Device" to 1
4. Set "Alert Threshold" to 20
5. Save Changes

# Test Execution
6. Sign out of admin
7. Create Account A from browser
8. Check Admin Panel → Fraud → Suspicious Devices
   → Should show 1 device, 1 account

9. Sign out
10. Create Account B from SAME browser, SAME PC
11. Check Admin Panel → Fraud
    → Suspicious Devices: 1 device, 2 accounts ✅
    → Fraud Alerts: "Multiple Accounts" alert ✅

# Expected Result
✅ Alert created for Account B
✅ Risk score increased
✅ Both accounts linked to same device
```

---

### **Phase 2: VPN Detection (2 minutes)**

```bash
# Test Setup
1. Ensure VPN detection enabled in settings
2. Set alert threshold to 30

# Test Execution (if you have VPN)
3. Connect to any VPN (NordVPN, ExpressVPN, etc.)
4. Create Account C from browser with VPN
5. Check Admin Panel → Fraud → Alerts
   → Should see "VPN Usage Detected" ✅

# Expected Result
✅ VPN detected and flagged
✅ Alert created with ISP details
✅ Risk score includes VPN penalty (+30)
```

---

### **Phase 3: Entry Blocking (2 minutes)** — ⚠️ REWRITTEN 2 September 2026

> **The old version of this phase tested behaviour that has been deliberately removed.**
> A suspicion score no longer blocks entry on its own. Crossing the threshold (now called
> **Review Threshold**) escalates the account for investigation and blocks nothing.
>
> Why: the old block created no `UserRestriction`, so it showed on no admin screen,
> notified nobody, could not be lifted, and fired even with Auto-Suspend switched off. It
> locked a real player out. See **Prerequisite B** in
> `New games plan/00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.
>
> **If the old test passes, that is a regression.** The automated version of this is
> `__tests__/services/fraud-entry-block.test.ts`.

```bash
# Test A - a high score must NOT block
1. Go to Admin Panel → Fraud → Settings
2. Set "Review Threshold" to 40, and confirm Auto-Suspend is OFF
3. Save Changes
4. Log in as an account with risk score > 40
5. Enter a competition

# Expected Result
✅ Entry SUCCEEDS - the score alone blocks nothing
✅ The account is escalated for review, and an alert appears for the admin
✅ The player has a notification saying their account is under review

# Test B - a restriction MUST block, and must be liftable
6. As admin, suspend that account (Fraud → alert → Suspend), ticking competitions
   and 1v1 challenges
7. As the player, try to enter a competition, then a challenge

# Expected Result
✅ Both refused, with a reason the player can read at /account/review
✅ The account appears on Restricted Users
✅ "Lift" releases them, and entry works again immediately

# Test C - Auto-Suspend is the only automatic block
8. Turn Auto-Suspend ON, threshold 90. Drive an account above 90.

# Expected Result
✅ A restriction is created automatically - not a bare refusal
✅ It expires after 7 days (check expiresAt is set, NOT empty)
✅ The player is notified and an admin can lift it
```

---

## 📊 **WHERE TO SEE RESULTS**

### **1. Fraud Alerts Tab**
```
Admin Panel → Fraud → Fraud Alerts

Shows:
- Alert type (same_device, vpn_usage, etc.)
- Severity (low, medium, high, critical)
- Involved users
- Evidence (device info, IP, etc.)
- Status (pending, investigating, resolved)
```

### **2. Suspicious Devices Tab**
```
Admin Panel → Fraud → Suspicious Devices

Shows:
- Device fingerprint ID
- Device type, browser, OS
- IP address
- Risk score
- Linked accounts (THIS IS KEY!)
- VPN/Proxy/Tor flags
- Number of times used
```

### **3. Individual User View**
```
Admin Panel → Users → Select User

Shows:
- User's device fingerprint
- Associated alerts
- Risk score
- Fraud history
```

---

## 🐛 **TROUBLESHOOTING**

### **Problem 1: No Alerts with 2 Accounts**

**Why:**
```
Default maxAccountsPerDevice = 3
Alert only triggers when > 3
```

**Solution:**
```
Admin Panel → Fraud → Settings
→ Set "Max Accounts Per Device" to 1
→ Save
→ Create new account
→ Alert should appear!
```

---

### **Problem 2: Linked Accounts Not Increasing**

**Possible Causes:**

**A. Using Incognito/Private Mode**
```
Incognito creates new fingerprint each time
Solution: Use normal browser window
```

**B. Browser Data Cleared**
```
Clearing cookies/cache resets fingerprint
Solution: Don't clear data between tests
```

**C. Different Browsers**
```
Chrome vs Firefox = different fingerprints
Solution: Use SAME browser for all test accounts
```

**D. Device Fingerprinting Disabled**
```
Check: Admin Panel → Fraud → Settings
→ "Enable Device Fingerprinting" = ON
```

---

### **Problem 3: VPN Not Detected**

**Possible Causes:**

**A. VPN Detection Disabled**
```
Check: Admin Panel → Fraud → Settings
→ "Enable VPN/Proxy Detection" = ON
```

**B. Free VPN Not in Database**
```
Our system knows 20+ popular VPNs
Small/unknown VPNs might not be detected
Solution: Try NordVPN, ExpressVPN, etc.
```

**C. Corporate VPN**
```
Corporate VPNs may not be flagged as suspicious
This is intentional (not always fraud)
```

---

### **Problem 4: Alerts Not Appearing**

**Check These:**

**1. Alert Threshold Too High**
```
Current threshold: Admin → Fraud → Settings
If threshold = 80, risk must be > 80
Lower to 20-40 for testing
```

**2. Multi-Account Detection Disabled**
```
Check: Admin → Fraud → Settings
→ "Enable Multi-Account Detection" = ON
```

**3. Database Not Connected**
```
Check: Admin → Settings → Database
→ Should show "Connected"
```

---

## 🎯 **QUICK TEST SCRIPT**

Run this to verify everything is working:

```bash
# 1. Adjust Settings for Testing
Admin Panel → Fraud → Settings
- Max Accounts Per Device: 1
- Alert Threshold: 20
- Review Threshold: 60
- Enable Device Fingerprinting: ON
- Enable Multi-Account Detection: ON
- Enable VPN Detection: ON
Save Changes

# 2. Create Test Accounts
- Sign out
- Create Account 1 (normal browser)
- Sign out
- Create Account 2 (same browser, same PC)
- Sign out
- Create Account 3 (same browser, same PC)

# 3. Check Results
Admin Panel → Fraud → Fraud Alerts
Expected: 2 alerts (Account 2 and Account 3)

Admin Panel → Fraud → Suspicious Devices
Expected: 1 device, 3 linked accounts

# 4. Test Blocking
- Log in as Account 3 (risk score should be 40+)
- Try to enter competition
Expected: Blocked with error message

# 5. Success Indicators
✅ Alerts created for Accounts 2 and 3
✅ Device shows 3 linked accounts
✅ Risk scores calculated correctly
✅ High-risk account blocked from entry
✅ All evidence visible in admin panel
```

---

## 🎊 **EXPECTED TEST RESULTS**

### **After Creating 3 Accounts (Same Device):**

**Suspicious Devices Tab:**
```
Device #1
├─ Fingerprint: abc123def456
├─ Device: Desktop - Chrome 120 on Windows 11
├─ IP: 192.168.1.100
├─ Risk Score: 40
├─ Linked Accounts: 3
│   ├─ user_account_1_id
│   ├─ user_account_2_id
│   └─ user_account_3_id
└─ Status: Flagged for review
```

**Fraud Alerts Tab:**
```
Alert #1
├─ Type: Multiple Accounts on Same Device
├─ Severity: Medium
├─ Users: 2 (Account 1 & 2)
├─ Created: When Account 2 signed up
└─ Evidence: Device fingerprint match

Alert #2
├─ Type: Multiple Accounts on Same Device
├─ Severity: High
├─ Users: 3 (Account 1, 2 & 3)
├─ Created: When Account 3 signed up
└─ Evidence: Device fingerprint match
```

---

## 💡 **PRO TIPS**

### **For Development/Testing:**
```
Lower all thresholds:
- Max Accounts Per Device: 1
- Alert Threshold: 20
- Review Threshold: 50

This makes testing faster and easier!
```

### **For Production:**
```
Use recommended defaults:
- Max Accounts Per Device: 3
- Alert Threshold: 40
- Review Threshold: 70

This balances security with user experience!
```

### **To See More Alerts:**
```
Lower the thresholds = More alerts
Higher thresholds = Fewer alerts, but higher quality

Adjust based on your false positive rate!
```

---

## 🚨 **COMMON MISCONCEPTION**

### **❌ WRONG:**
```
"I have 2 accounts on same PC, I should see alerts"
```

### **✅ CORRECT:**
```
"Alerts only trigger when accounts EXCEED the threshold
Default threshold = 3
So I need 4+ accounts to see alerts
OR
Lower the threshold to 1 in settings"
```

---

## ✅ **VERIFICATION CHECKLIST**

Use this to confirm your fraud detection is working:

- [ ] Device fingerprints are being stored (check Suspicious Devices)
- [ ] Linked accounts count increases with new accounts
- [ ] Risk scores are calculated
- [ ] Alerts are created when threshold exceeded
- [ ] VPN detection creates alerts (if using VPN)
- [ ] High-risk accounts are blocked from competitions
- [ ] Admin can see all evidence
- [ ] Settings changes take effect immediately
- [ ] Different browsers = different fingerprints (expected)
- [ ] Same browser + same PC = same fingerprint (expected)

---

## 🎉 **YOUR SYSTEM IS WORKING IF:**

✅ **Suspicious Devices** shows devices with multiple linked accounts
✅ **Fraud Alerts** appear when thresholds are exceeded
✅ **Risk Scores** are calculated and displayed
✅ **VPN Detection** flags VPN/Proxy users
✅ **Review Threshold** escalates high-risk users for investigation — it does **not** block
✅ **Suspensions and bans** are what block entry, and they are visible, notified and liftable
✅ **Settings Changes** apply immediately

---

## 📞 **Still Not Working?**

If after following this guide you still don't see:
1. Device fingerprints being stored
2. Linked accounts increasing
3. Any alerts at all

Then check:
- [ ] Browser allows JavaScript
- [ ] No adblockers blocking fingerprinting
- [ ] Database is connected
- [ ] Settings are saved
- [ ] Using normal browser (not incognito)
- [ ] Not clearing cache between signups

---

**Remember: The system is working correctly, you just need to exceed the thresholds to see alerts! 🎯**

