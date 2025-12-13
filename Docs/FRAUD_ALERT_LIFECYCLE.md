# Fraud Alert Lifecycle & Suppression System

## 📋 Overview

This document explains how fraud alerts are managed throughout their lifecycle, including creation, investigation, suppression, and re-enabling.

---

## 🔄 Alert Lifecycle States

### **1. Pending** 
- **What it means**: New fraud detected, awaiting admin review
- **Where it appears**: Fraud Alerts tab
- **Actions available**: Dismiss, Elevate to Investigation
- **Alert suppression**: ✅ **Active** - No new alerts for these accounts

### **2. Investigating**
- **What it means**: Alert elevated for detailed investigation
- **Where it appears**: Investigation Center tab ONLY
- **Where it doesn't appear**: ❌ Fraud Alerts tab (auto-hidden)
- **Actions available**: View Details, Confidence Breakdown, Suspend, Ban, Dismiss
- **Alert suppression**: ✅ **Active** - No new alerts for these accounts

### **3. Resolved**
- **What it means**: Case closed, action taken
- **Where it appears**: Historical records
- **Actions available**: View only
- **Alert suppression**: ✅ **Active** if users are banned/suspended
- **Alert re-enabling**: Depends on restriction status

### **4. Dismissed**
- **What it means**: False positive or case closed without action
- **Where it appears**: Historical records
- **Actions available**: View only
- **Alert suppression**: ❌ **Inactive** - New alerts CAN be created
- **Alert re-enabling**: ✅ **Immediate** - Accounts can trigger new alerts

---

## 🚫 Alert Suppression Rules

Fraud alerts are **automatically suppressed** (not created) when:

### **Rule 1: Accounts Already Under Investigation**
```
IF any account has an existing alert with status = 'pending' OR 'investigating'
THEN skip creating new alert
```

**Example:**
- User A and User B detected with same device → Alert #1 created (pending)
- User A logs in again → ⏭️ **No new alert** (already has pending alert)
- User B logs in from VPN → ⏭️ **No new alert** (already flagged)

### **Rule 2: Accounts Already Restricted**
```
IF any account has active UserRestriction (isActive = true)
THEN skip creating new alert
```

**Example:**
- User A banned for fraud → UserRestriction created
- User A creates new account (User C) on same device → ⏭️ **No new alert** (User A is banned)
- User C logs in from VPN → ⏭️ **No new alert** (linked to banned user)

### **Rule 3: Alert Already Exists for Same Accounts**
```
IF alert already exists with same set of suspiciousUserIds
THEN update existing alert (increment activity count)
INSTEAD OF creating duplicate
```

---

## ✅ Alert Re-enabling Rules

Accounts become eligible for **new alerts** again when:

### **Re-enable Scenario 1: Alert Dismissed**
```javascript
// Alert status changed to 'dismissed'
alert.status = 'dismissed';

// Result: Accounts can trigger new alerts immediately
shouldSuppressAlert([userId]) → returns false ✅
```

### **Re-enable Scenario 2: User Unrestricted**
```javascript
// Restriction deactivated
userRestriction.isActive = false;

// Result: Account can trigger new alerts immediately
shouldSuppressAlert([userId]) → returns false ✅
```

### **Re-enable Scenario 3: Suspension Expires**
```javascript
// Suspension period ends (auto-unsuspend or manual)
userRestriction.suspensionEndsAt < Date.now();
userRestriction.isActive = false;

// Result: Account can trigger new alerts immediately
shouldSuppressAlert([userId]) → returns false ✅
```

---

## 🔍 Technical Implementation

### **Client-Side Changes**

**File:** `components/admin/FraudMonitoringSection.tsx`

#### **1. Removed Direct Action Button from Alert Details**
```typescript
// BEFORE: Alert Details had "Suspend Accounts" button
<Button onClick={() => suspend()}>
  Suspend Accounts
</Button>

// AFTER: Only "Dismiss" and "Elevate to Investigation"
<Button onClick={() => handleElevateToInvestigation()}>
  Elevate to Investigation
</Button>
```

#### **2. Auto-Hide Investigating Alerts from Fraud Alerts Tab**
```typescript
const filteredAlerts = alerts.filter(alert => {
  // Exclude 'investigating' alerts from Fraud Alerts tab
  const statusMatch = statusFilter === 'all' 
    ? alert.status !== 'investigating' // ⏭️ Hidden from this tab
    : alert.status === statusFilter;
  
  // ... search query filter
});
```

**Result:**
- When alert is elevated, it **automatically disappears** from "Fraud Alerts" tab
- It **only appears** in "Investigation Center" tab
- No duplicate display

### **Server-Side Changes**

**File:** `app/api/fraud/track-device/route.ts`

#### **1. Alert Suppression Function**
```typescript
async function shouldSuppressAlert(userIds: string[]): Promise<boolean> {
  // Check for active alerts (pending or investigating)
  const existingAlerts = await FraudAlert.findOne({
    suspiciousUserIds: { $in: userIds },
    status: { $in: ['pending', 'investigating'] }
  });

  if (existingAlerts) {
    console.log(`🔇 Alert suppressed: Already have active alert`);
    return true; // ⛔ Suppress
  }

  // Check for active restrictions (banned/suspended)
  const restrictions = await UserRestriction.find({
    userId: { $in: userIds },
    isActive: true
  });

  if (restrictions.length > 0) {
    console.log(`🔇 Alert suppressed: ${restrictions.length} account(s) restricted`);
    return true; // ⛔ Suppress
  }

  return false; // ✅ Allow alert creation
}
```

#### **2. Applied Before Alert Creation (3 locations)**

**Location 1: Same Device Detection**
```typescript
// Before creating fraud alert for same device
const shouldSuppress = await shouldSuppressAlert(allLinkedUsers);

if (shouldSuppress) {
  console.log(`⏭️ Skipping alert - already investigating/restricted`);
  return; // Exit early, no alert created
}

await FraudAlert.create({ ... }); // Only if not suppressed
```

**Location 2: Same IP + Browser Detection**
```typescript
// Before creating fraud alert for same IP+browser
const shouldSuppress = await shouldSuppressAlert(allLinkedUserIds);

if (shouldSuppress) {
  console.log(`⏭️ Skipping IP+Browser alert - already investigating/restricted`);
  return;
}

await FraudAlert.create({ ... });
```

**Location 3: VPN/Proxy Detection**
```typescript
// Before creating fraud alert for VPN/Proxy
const shouldSuppress = await shouldSuppressAlert([userId]);

if (shouldSuppress) {
  console.log(`⏭️ Skipping VPN/Proxy alert - already investigating/restricted`);
  return;
}

await FraudAlert.create({ ... });
```

---

## 📊 Alert Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRAUD DETECTION TRIGGERED                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                   ┌──────────────────────┐
                   │  Check Suppression   │
                   │  shouldSuppressAlert │
                   └──────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
          ⛔ SUPPRESSED              ✅ ALLOWED
                    │                   │
                    ↓                   ↓
       ┌─────────────────────┐    ┌─────────────────┐
       │  Skip Alert         │    │  Create Alert   │
       │  Return Success     │    │  Status: pending│
       └─────────────────────┘    └─────────────────┘
                                           │
                                           ↓
                              ┌────────────────────────┐
                              │   FRAUD ALERTS TAB     │
                              │   (visible to admin)   │
                              └────────────────────────┘
                                           │
                              ┌────────────┴─────────────┐
                              │                          │
                       Dismiss                    Elevate
                              │                          │
                              ↓                          ↓
                  ┌──────────────────────┐   ┌──────────────────────┐
                  │ Status: 'dismissed'  │   │ Status:'investigating'│
                  │ Hidden from alerts   │   │ MOVED to Investigation│
                  │ ✅ New alerts OK     │   │ Center ONLY           │
                  └──────────────────────┘   └──────────────────────┘
                                                          │
                                        ┌─────────────────┼────────────────┐
                                        │                 │                │
                                    Suspend             Ban           Dismiss
                                        │                 │                │
                                        ↓                 ↓                ↓
                           ┌────────────────────┐  ┌────────────────┐  ┌──────────────┐
                           │ UserRestriction    │  │UserRestriction │  │Status:       │
                           │ isActive: true     │  │isActive: true  │  │'dismissed'   │
                           │ ⛔ New alerts OFF  │  │⛔ New alerts   │  │✅ Alerts OK  │
                           └────────────────────┘  │   OFF forever  │  └──────────────┘
                                     │              └────────────────┘
                                     │
                           ┌─────────┴──────────┐
                           │                    │
                    Auto-Expire          Manual Unrestrict
                           │                    │
                           └─────────┬──────────┘
                                     │
                                     ↓
                        ┌───────────────────────┐
                        │ isActive: false       │
                        │ ✅ New alerts enabled │
                        └───────────────────────┘
```

---

## 🧪 Testing Scenarios

### **Scenario 1: Basic Suppression**
1. ✅ Create 2 accounts on same device → Alert #1 created (pending)
2. ✅ Log in with Account 1 → ⏭️ **No new alert** (suppressed)
3. ✅ Log in with Account 2 → ⏭️ **No new alert** (suppressed)
4. ✅ Check database → Only 1 alert exists

### **Scenario 2: Investigation Suppression**
1. ✅ Create 2 accounts → Alert #1 created (pending)
2. ✅ Elevate to Investigation → Status = 'investigating'
3. ✅ Alert disappears from "Fraud Alerts" tab
4. ✅ Alert appears in "Investigation Center" tab
5. ✅ Accounts log in again → ⏭️ **No new alerts** (under investigation)

### **Scenario 3: Ban Suppression**
1. ✅ Ban accounts from Investigation Center → UserRestriction created
2. ✅ Accounts try to log in → ⏭️ **No new alerts** (banned)
3. ✅ Accounts create new devices → ⏭️ **No new alerts** (banned)

### **Scenario 4: Re-enabling After Dismiss**
1. ✅ Create alert for 2 accounts → Alert #1 (pending)
2. ✅ Dismiss alert → Status = 'dismissed'
3. ✅ Accounts log in again → ✅ **New Alert #2 created** (re-enabled)

### **Scenario 5: Re-enabling After Unsuspend**
1. ✅ Suspend accounts → UserRestriction (isActive: true)
2. ✅ Accounts log in → ⏭️ **No new alerts** (suspended)
3. ✅ Unsuspend accounts → UserRestriction (isActive: false)
4. ✅ Accounts log in → ✅ **New alert created** (re-enabled)

---

## 📝 Summary

| State | Fraud Alerts Tab | Investigation Center | New Alerts? |
|-------|-----------------|---------------------|-------------|
| **Pending** | ✅ Visible | ❌ Not visible | ⛔ Suppressed |
| **Investigating** | ❌ Hidden | ✅ Visible | ⛔ Suppressed |
| **Dismissed** | ❌ Hidden (historical) | ❌ Not visible | ✅ Allowed |
| **Resolved + Restricted** | ❌ Hidden | ❌ Not visible | ⛔ Suppressed |
| **Resolved + Unrestricted** | ❌ Hidden | ❌ Not visible | ✅ Allowed |

---

## ✅ Benefits

1. **No Duplicate Alerts**: Same accounts don't generate multiple alerts
2. **Clean Workflow**: Clear separation between new alerts and active investigations
3. **Automatic Management**: Investigating alerts auto-hide from fraud alerts tab
4. **Flexible Re-enabling**: Dismissed/unrestricted accounts can be flagged again
5. **Performance**: Reduces database clutter and alert noise
6. **Clear Actions**: All restriction actions only from Investigation Center

---

**Last Updated**: November 29, 2025
**Version**: 1.0.0
**Status**: Active

