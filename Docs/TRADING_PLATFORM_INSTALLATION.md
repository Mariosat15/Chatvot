# Trading Platform Installation Guide

## Phase 1: Install Required Packages

### 1. Install Dependencies

```bash
# Real-time communication
npm install socket.io socket.io-client

# Payment processing
npm install stripe @stripe/stripe-js

# Trading charts
npm install lightweight-charts

# WebSocket client for market data
npm install ws

# Utilities
npm install uuid decimal.js

# Dev dependencies
npm install -D @types/ws
```

### 2. Update Environment Variables

Add to your `.env` file:

```bash
# ============================================
# TRADING PLATFORM CONFIGURATION
# ============================================

# Market Data Feeds
MASSIVE_API_KEY=your_massive_api_key_here
MASSIVE_WS_URL=wss://api.massive.com/v1/ws
POLYGON_API_KEY=your_polygon_api_key_here

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Trading Engine
TRADING_ENGINE_ENABLED=true
COMPETITION_PLATFORM_FEE=0.20
DEFAULT_LEVERAGE=1
MAX_LEVERAGE=100

# WebSocket Server
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Feature Flags
ENABLE_TRADING_COMPETITIONS=true
ENABLE_CREDIT_WALLET=true
ENABLE_FOREX_TRADING=true
ENABLE_STOCK_TRADING=true
ENABLE_CRYPTO_TRADING=true
```

### 3. Update Environment Example

Add to `env_example.txt`:

```bash
# TRADING PLATFORM
MASSIVE_API_KEY=
MASSIVE_WS_URL=wss://api.massive.com/v1/ws
POLYGON_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
TRADING_ENGINE_ENABLED=true
COMPETITION_PLATFORM_FEE=0.20
NEXT_PUBLIC_WS_URL=ws://localhost:3001
ENABLE_TRADING_COMPETITIONS=true
```

## Phase 2: Database Models

All models will be created in `database/models/trading/` directory.
This keeps trading separate from your existing models.

## Phase 3: Backend Services

Services will be organized in `lib/trading/` directory:
- `lib/trading/engine/` - Trading engine
- `lib/trading/websocket/` - WebSocket server
- `lib/trading/market-data/` - Data feed connectors
- `lib/trading/competitions/` - Competition management

## Phase 4: Frontend Components

New pages and components:
- `app/(root)/competitions/` - Competition pages
- `app/(root)/wallet/` - Credit wallet
- `app/(root)/trading/` - Trading interface
- `components/trading/` - Trading-specific components

## Rollback Plan

To disable trading platform:
1. Set `ENABLE_TRADING_COMPETITIONS=false` in `.env`
2. Trading features will be hidden
3. Original app functionality remains intact

To completely remove:
1. Delete `database/models/trading/` directory
2. Delete `lib/trading/` directory
3. Delete `app/(root)/competitions/` directory
4. Delete `app/(root)/wallet/` directory
5. Delete `app/(root)/trading/` directory
6. Delete `components/trading/` directory
7. Remove trading packages from `package.json`

