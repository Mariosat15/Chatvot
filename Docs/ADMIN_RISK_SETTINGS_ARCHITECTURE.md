# Admin Risk Settings Architecture

## Overview
The admin risk settings system is designed to be **resilient and decoupled** from the trading platform. Admin panel issues will **never break live trading**.

## Architecture Principle: Graceful Degradation

```
┌─────────────────┐
│  Admin Panel    │
│  Changes Settings│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MongoDB       │ ← Stores custom settings
│ TradingRiskSettings │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Trading Platform│
│ Loads Settings  │
│ ✅ Success → Use DB settings
│ ❌ Failure → Use DEFAULT settings
└─────────────────┘
```

## Why This Design?

### ❌ Bad Design (Tightly Coupled)
```typescript
// Trading breaks if admin DB fails
const settings = await loadSettings(); // Error thrown!
// Trading page crashes ❌
```

### ✅ Good Design (Gracefully Degraded)
```typescript
// Trading continues even if admin DB fails
let settings;
try {
  settings = await loadSettings(); // Error thrown
} catch {
  settings = DEFAULT_SETTINGS; // Fallback ✅
}
// Trading page works with defaults ✅
```

## Files & Responsibilities

### 1. **Admin Panel** (Admin-Only Access)
- `components/admin/TradingRiskSection.tsx` - UI for changing settings
- `app/api/admin/trading-risk-settings/route.ts` - Admin API
- `database/models/trading-risk-settings.model.ts` - DB schema

**Purpose**: Allow admins to configure risk parameters

### 2. **Server Actions** (Server-Side Only)
- `lib/actions/trading/risk-settings.actions.ts`
  - `getMarginThresholds()` - Loads from DB, returns defaults on error
  - `getTradingRiskSettings()` - Loads all settings, returns defaults on error

**Purpose**: Safe server-side data loading with fallback

### 3. **Client-Safe Services** (Used in Client Components)
- `lib/services/margin-safety.service.ts`
  - Pure calculation functions (no DB access)
  - Default constants
  - Type definitions

**Purpose**: Calculations without database dependencies

### 4. **Trading Platform** (User-Facing)
- `app/(root)/competitions/[id]/trade/page.tsx` - Server component
  - Loads settings via server action
  - Catches errors and uses defaults
  - Passes settings as props to client components
  
- `components/trading/GameModeOrderForm.tsx` - Client component
  - Receives settings as props
  - Uses defaults if props undefined
  - Performs calculations client-side

**Purpose**: Live trading that works regardless of admin panel status

## Data Flow

### Happy Path (Admin Settings Available)
1. Admin saves settings in panel → MongoDB
2. Trading page loads → Server action reads DB
3. Settings passed to client components as props
4. Trading uses custom admin settings ✅

### Failure Path (Admin DB Unavailable)
1. Admin panel may be down/broken
2. Trading page loads → Server action tries DB
3. **Error caught** → Returns `DEFAULT_MARGIN_THRESHOLDS`
4. Trading uses default settings ✅
5. **Users can still trade normally**

## Default Settings (Fallback)

```typescript
const DEFAULT_MARGIN_THRESHOLDS = {
  LIQUIDATION: 50,    // Stopout at 50%
  MARGIN_CALL: 100,   // Warning at 100%
  WARNING: 150,       // Caution at 150%
  SAFE: 200,          // Recommended minimum
};
```

These are hardcoded in `lib/services/margin-safety.service.ts` and always available.

## Key Benefits

### 1. **Resilience** 🛡️
- Trading platform works even if admin panel breaks
- Database failures don't cascade to users
- Defaults ensure safe trading always

### 2. **Separation of Concerns** 🔀
- Admin logic isolated from trading logic
- Client components don't import server code
- Clear boundaries prevent coupling

### 3. **Type Safety** 📝
- Settings passed as strongly-typed props
- TypeScript prevents invalid configurations
- Editor autocomplete works everywhere

### 4. **Performance** ⚡
- DB query happens once on server
- Results cached in component props
- No redundant database calls

### 5. **Testability** 🧪
- Components can be tested with mock settings
- No need to mock database in tests
- Pure functions easy to unit test

## Error Handling Strategy

### Server Action (Database Layer)
```typescript
export async function getMarginThresholds() {
  try {
    await connectToDatabase();
    const settings = await TradingRiskSettings.getSingleton();
    return validateAndReturn(settings);
  } catch (error) {
    console.error('⚠️ DB failed, using defaults:', error);
    return DEFAULT_MARGIN_THRESHOLDS; // Always return valid data
  }
}
```

### Server Component (Page Layer)
```typescript
let marginThresholds;
try {
  marginThresholds = await getMarginThresholds();
} catch (error) {
  console.error('⚠️ Failed to load, using defaults:', error);
  marginThresholds = undefined; // Component will use defaults
}
```

### Client Component (UI Layer)
```typescript
function GameModeOrderForm({ 
  marginThresholds = DEFAULT_MARGIN_THRESHOLDS 
}) {
  // Always has valid thresholds (prop or default)
  const maxAmount = calculateMaxSafeTradeAmount(..., marginThresholds);
}
```

## Testing the Resilience

### Test 1: Break Admin Database
```bash
# Stop MongoDB
docker stop mongodb

# Visit trading page
# Expected: Works with default settings ✅
```

### Test 2: Invalid Admin Settings
```typescript
// Set invalid settings in admin
{ marginLiquidation: NaN }

// Visit trading page
// Expected: Falls back to defaults ✅
```

### Test 3: Admin Panel Crash
```bash
# Delete admin API route
rm app/api/admin/trading-risk-settings/route.ts

# Visit trading page (not admin!)
# Expected: Still works ✅
```

## Monitoring & Logging

Look for these console messages:

- `⚠️ Failed to load margin thresholds from database, using defaults:`
  - **Meaning**: Admin DB failed, using fallback
  - **Action**: Check MongoDB connection, but trading still works

- `⚠️ Invalid margin threshold values in database, using defaults`
  - **Meaning**: Admin saved bad data
  - **Action**: Fix admin validation, but trading still works

- `✅ Trading risk settings updated by: admin@example.com`
  - **Meaning**: Admin successfully changed settings
  - **Action**: None, working as expected

## Future Enhancements

1. **Cache Layer** - Add Redis caching for settings
2. **Real-time Updates** - WebSocket push when admin changes settings
3. **Per-Competition Settings** - Override global settings per competition
4. **A/B Testing** - Different settings for different user groups
5. **Audit Log** - Track all admin setting changes

## Summary

✅ **Admin panel can fail** → Trading continues with defaults  
✅ **Database can fail** → Trading continues with defaults  
✅ **Invalid data** → Trading continues with defaults  
✅ **No network** → Trading continues with defaults  

The trading platform is **always available** regardless of admin panel status! 🚀

