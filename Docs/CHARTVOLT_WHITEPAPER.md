# CHARTVOLT

## The Next-Generation Trading Competition Platform

**Whitepaper v1.0**

**January 2026**

---

<div align="center">

*Transforming the way traders compete, learn, and earn*

*A White-Label Social Trading Competition Platform*

</div>

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [The Solution: Chartvolt](#3-the-solution-chartvolt)
4. [Platform Architecture](#4-platform-architecture)
5. [Core Features](#5-core-features)
6. [Trading Engine](#6-trading-engine)
7. [Security & Fraud Prevention](#7-security--fraud-prevention)
8. [Business Model](#8-business-model)
9. [Technology Stack](#9-technology-stack)
10. [Compliance & Risk Management](#10-compliance--risk-management)
11. [Roadmap](#11-roadmap)
12. [Conclusion](#12-conclusion)

---

## 1. Executive Summary

### Vision

Chartvolt is a comprehensive, production-ready trading competition platform that gamifies the trading experience while providing real market exposure without financial risk. Our platform enables operators to host trading competitions where users compete using virtual credits while trading with real-time market data from global exchanges.

### Mission

To democratize access to professional trading tools and create an engaging environment where traders of all skill levels can compete, learn, and improve—without risking real capital.

### Key Value Propositions

| For Platform Operators | For Traders |
|------------------------|-------------|
| Turnkey white-label solution | Risk-free trading with real market data |
| Multiple revenue streams | Competitive gamified experience |
| Enterprise-grade security | Professional-grade charting tools |
| Complete customization | Fair and transparent competitions |
| Built-in fraud prevention | Earn real money through skill |

### Platform Highlights

- **100+ Trading Pairs**: Forex, Crypto, Stocks, Commodities, Indices
- **Real-Time Data**: Sub-50ms price updates from institutional feeds
- **Unified Pipeline**: Single source of truth for all candle data
- **White-Label Ready**: Complete branding customization
- **Enterprise Security**: Multi-layer fraud detection system
- **Scalable Architecture**: Built for thousands of concurrent users

---

## 2. The Problem

### 2.1 Barriers to Trading Education

The global retail trading market has grown exponentially, yet new traders face significant challenges:

- **High Risk of Capital Loss**: 70-80% of retail traders lose money when trading CFDs and forex
- **Expensive Learning Curve**: Traditional trading education costs thousands of dollars
- **Lack of Practical Experience**: Paper trading feels disconnected from real markets
- **No Competitive Environment**: Solo trading lacks community and motivation

### 2.2 Platform Operator Challenges

Businesses looking to enter the trading space face their own obstacles:

- **Complex Regulatory Landscape**: Building a compliant platform is expensive and time-consuming
- **Technical Complexity**: Real-time trading systems require specialized expertise
- **Fraud Prevention**: Multi-accounting and manipulation are constant threats
- **User Acquisition**: Generic trading apps struggle to retain users

### 2.3 Market Opportunity

| Metric | Value |
|--------|-------|
| Global Online Trading Market (2025) | $12.2 Billion |
| Expected CAGR (2026-2031) | 6.8% |
| Global Gamification Market (2025) | $15.4 Billion |
| Expected CAGR (2026-2030) | 27.4% |

The intersection of trading and gamification represents a massive untapped opportunity.

---

## 3. The Solution: Chartvolt

### 3.1 Platform Overview

Chartvolt is a complete ecosystem that transforms trading into a competitive, engaging, and educational experience:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CHARTVOLT ECOSYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │ COMPETITIONS │   │  CHALLENGES  │   │ MARKETPLACE  │            │
│  │  Multi-User  │   │    1v1       │   │   Signals    │            │
│  │  Tournaments │   │   Battles    │   │  Indicators  │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│           │                │                   │                    │
│           └────────────────┼───────────────────┘                    │
│                            ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     TRADING ENGINE                            │  │
│  │  • Real-Time Prices  • Margin Trading  • Risk Management     │  │
│  │  • Position Tracking • P&L Calculation • Liquidation         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                            │                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     WALLET SYSTEM                             │  │
│  │  • Credit Deposits  • Stripe/Nuvei  • KYC  • Withdrawals     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 How It Works

1. **Registration**: Users sign up and complete optional KYC verification
2. **Deposit**: Add credits to wallet via Stripe or Nuvei payment processors
3. **Join Competition**: Pay entry fee to join a trading tournament
4. **Trade**: Execute trades using real market prices and virtual capital
5. **Compete**: Climb the live leaderboard based on performance metrics
6. **Win**: Top performers receive prize pool payouts to their wallets
7. **Withdraw**: Convert winnings back to real money

### 3.3 Competition Types

| Type | Description | Best For |
|------|-------------|----------|
| **P&L (Profit & Loss)** | Highest absolute profit wins | Aggressive traders |
| **ROI (Return on Investment)** | Best percentage return wins | Strategic traders |
| **Sharpe Ratio** | Risk-adjusted returns | Risk-conscious traders |
| **Win Rate** | Highest % of winning trades | Consistent traders |
| **Risk-Adjusted Return** | Balanced performance | All-round traders |

---

## 4. Platform Architecture

### 4.1 System Overview

Chartvolt employs a modern microservices architecture designed for reliability, scalability, and real-time performance:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Web Browser    │  │  Mobile (PWA)   │  │  Admin Panel    │     │
│  │  (React/Next.js)│  │  (Responsive)   │  │  (Separate App) │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Next.js 15 API Routes  │  Express API Server  │  Auth API  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  Trading   │  │  Wallet    │  │  Fraud     │  │  Market    │    │
│  │  Engine    │  │  Service   │  │  Detection │  │  Data      │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  MongoDB Atlas  │  │  Redis Cache    │  │  WebSocket      │     │
│  │  (Primary DB)   │  │  (Price Cache)  │  │  (Real-Time)    │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Massive.com│  │  Stripe    │  │  Nuvei     │  │ Nodemailer │    │
│  │ (Prices)   │  │ (Payments) │  │ (Payments) │  │ (Email)    │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Unified Candle Pipeline

Chartvolt implements a **Single Source of Truth** architecture for market data:

```
External Price Feed (Massive.com)
         │ ~50ms ticks
         ▼
┌─────────────────────────────────────────────┐
│         WebSocket Price Streamer            │
│  • Builds ALL timeframe candles (1m-1M)     │
│  • Saves completed candles to MongoDB       │
│  • Broadcasts forming + completed candles   │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│           WebSocket Server                  │
│  • Distributes to all connected clients     │
│  • Filters by user subscriptions            │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│           Browser Charts                    │
│  • Historical data via API                  │
│  • Real-time updates via WebSocket          │
│  • No divergence between charts             │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ All charts show identical data
- ✅ Server restart safe (augmented from 1m data)
- ✅ Real-time sync across all clients
- ✅ No manual refresh needed

### 4.3 Process Architecture

| Process | Port | Purpose |
|---------|------|---------|
| `chartvolt-web` | 3000 | Next.js main application |
| `chartvolt-admin` | 3001 | Admin panel (separate app) |
| `chartvolt-websocket` | 3002 | WebSocket server for clients |
| `chartvolt-api` | 3003 | Express API server (auth) |
| `chartvolt-worker` | - | Background jobs (Inngest) |

---

## 5. Core Features

### 5.1 Trading Competitions

Multi-user tournaments where traders compete for prize pools:

**Competition Lifecycle:**
```
📝 REGISTRATION → ⏳ PENDING → 🟢 ACTIVE → 🏁 COMPLETED
                       ↓
                  ❌ CANCELLED (if min participants not met)
```

**Features:**
- Configurable entry fees and platform fees
- Automatic prize pool calculation and distribution
- Minimum participant requirements with auto-refund
- Real-time leaderboards with tie-breaking logic
- Multiple ranking methods (P&L, ROI, Sharpe, etc.)
- Asset class restrictions
- Minimum trade requirements

### 5.2 1v1 Challenges

Head-to-head trading battles between two traders:

**Flow:**
1. Find online opponent via leaderboard
2. Set entry fee, duration, and rules
3. Opponent accepts/declines
4. Entry fees locked from both wallets
5. Trade under same conditions
6. Winner takes all (minus platform fee)

**Features:**
- Real-time presence detection (2-second heartbeat)
- Same competition types available
- Automatic result finalization
- VS screen with fighter-style presentation

### 5.3 Marketplace

Trading tools and signals ecosystem:

| Category | Items |
|----------|-------|
| **Technical Indicators** | SMA, EMA, Bollinger Bands, RSI, MACD, Support/Resistance |
| **Trading Strategies** | Custom multi-indicator strategies with buy/sell signals |
| **Chart Themes** | Premium visual customizations |

**Revenue Model:**
- Platform earns commission on each sale
- Creators can monetize their strategies
- Items automatically appear on user charts

### 5.4 Gamification System

**Badges & Achievements:**
- First Trade, First Win, Competition Champion
- Trading Streak badges
- Leaderboard positions
- Community contributions

**XP & Leveling:**
- Earn XP for trading activity
- Progressive levels unlock features
- Visible rank on profile and leaderboard

**Global Leaderboard:**
- Platform-wide ranking of all traders
- Multiple leaderboard categories
- Historical performance tracking

### 5.5 Notification System

**Channels:**
- In-app notifications (real-time bell)
- Email notifications
- Push notifications (PWA)

**Notification Types:**
- Competition updates (start, end, results)
- Challenge invitations
- Trade executions
- Price alerts
- Margin warnings
- System announcements

---

## 6. Trading Engine

### 6.1 Overview

The Chartvolt Trading Engine provides a realistic trading experience using virtual capital and real market prices:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TRADING ENGINE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │   ORDER      │   │  POSITION    │   │    RISK      │            │
│  │  MANAGEMENT  │──▶│  TRACKING    │──▶│ MANAGEMENT   │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    P&L CALCULATION                            │  │
│  │  Unrealized P&L = (Current Price - Entry Price) × Position   │  │
│  │  With spread, leverage, and commission factored in           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Supported Asset Classes

| Asset Class | Examples | Data Source |
|-------------|----------|-------------|
| **Forex** | EUR/USD, GBP/JPY | Massive.com |
| **Crypto** | BTC/USD, ETH/USD | Massive.com |
| **Stocks** | AAPL, TSLA, GOOGL | Finnhub |
| **Commodities** | XAUUSD, XAGUSD | Massive.com |
| **Indices** | US30, US500 | Massive.com |

### 6.3 Order Types

| Order Type | Description |
|------------|-------------|
| **Market** | Execute immediately at current price |
| **Limit** | Execute when price reaches target (planned) |

### 6.4 Risk Management

**Admin-Configurable Settings:**
- Maximum leverage (1x - 100x)
- Maximum position size
- Margin requirements
- Auto-liquidation thresholds

**User-Level Features:**
- Stop Loss (automatic exit on loss)
- Take Profit (automatic exit on gain)
- Position notifications
- Margin warnings

**System Safeguards:**
- Margin call alerts at 80% margin usage
- Auto-liquidation at 100% margin
- Position limits per competition
- Negative balance protection

### 6.5 Real-Time Price Feed

**Data Pipeline:**
```
Massive.com WebSocket → Price Streamer → MongoDB + Cache → Client Charts
```

**Performance Metrics:**
- Tick frequency: ~50ms
- Broadcast interval: 50ms
- End-to-end latency: <100ms
- 99.9% uptime target

---

## 7. Security & Fraud Prevention

### 7.1 Multi-Layer Security Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 1: AUTHENTICATION                                            │
│  ├─ Better Auth with session management                             │
│  ├─ Password hashing (bcrypt)                                       │
│  ├─ Email verification                                              │
│  └─ Rate limiting (account lockout)                                 │
│                                                                      │
│  Layer 2: DEVICE FINGERPRINTING                                     │
│  ├─ FingerprintJS integration                                       │
│  ├─ 50+ browser/device parameters                                   │
│  ├─ Canvas and WebGL fingerprinting                                 │
│  └─ Cross-device tracking                                           │
│                                                                      │
│  Layer 3: FRAUD DETECTION                                           │
│  ├─ Multi-account detection                                         │
│  ├─ VPN/Proxy/Tor detection                                         │
│  ├─ High-risk device scoring                                        │
│  └─ Behavioral analysis (planned)                                   │
│                                                                      │
│  Layer 4: KYC VERIFICATION                                          │
│  ├─ Identity document verification                                  │
│  ├─ Selfie verification                                             │
│  ├─ Address verification                                            │
│  └─ Required for withdrawals                                        │
│                                                                      │
│  Layer 5: ADMIN CONTROLS                                            │
│  ├─ User restrictions (ban, limit)                                  │
│  ├─ Competition disqualification                                    │
│  ├─ Audit logging                                                   │
│  └─ Manual review workflows                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Fraud Detection System

**Detection Methods:**

| Method | Description | Status |
|--------|-------------|--------|
| Same Device | Multiple accounts on same device | ✅ Live |
| VPN Usage | VPN/Proxy/Tor detected | ✅ Live |
| High-Risk Device | Device with elevated risk score | ✅ Live |
| Mirror Trading | Opposite trades at same time | 🔜 Planned |
| Same Payment | Same payment method used | 🔜 Planned |
| Coordinated Entry | Accounts created simultaneously | 🔜 Planned |

**Risk Scoring:**
- Each device receives a risk score (0-100)
- Scores update based on suspicious activity
- High-risk users flagged for review
- Automatic restrictions at critical thresholds

**Alert System:**
- Real-time fraud alerts in admin dashboard
- Severity levels: Low, Medium, High, Critical
- One-click investigation workflow
- Evidence aggregation per alert

### 7.3 Audit Logging

Complete audit trail for compliance and investigation:

| Event Type | Data Captured |
|------------|---------------|
| User Actions | Login, logout, trades, deposits |
| Admin Actions | Settings changes, user modifications |
| System Events | Errors, security incidents |
| Financial | All wallet transactions |

---

## 8. Business Model

### 8.1 Revenue Streams

```
┌─────────────────────────────────────────────────────────────────────┐
│                       REVENUE MODEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  1. COMPETITION FEES                                       │     │
│  │     Platform Fee = Entry Fee × Platform Fee %              │     │
│  │     Example: €20 entry × 10% = €2 per participant          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  2. CHALLENGE FEES                                         │     │
│  │     Platform takes % of winner's prize                     │     │
│  │     Example: (€10 × 2) × 5% = €1 per challenge             │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  3. MARKETPLACE SALES                                      │     │
│  │     Commission on indicator/strategy sales                 │     │
│  │     Example: €50 strategy × 30% = €15 per sale             │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  4. DEPOSIT FEES (Optional)                                │     │
│  │     Transaction fee on credit purchases                    │     │
│  │     Example: €100 deposit × 2.5% = €2.50 per deposit       │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Financial Dashboard

Platform operators have complete visibility into revenue:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FINANCIAL DASHBOARD                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  💰 Total Revenue    │  🏆 Competition Fees  │  ⚔️ Challenge Fees    │
│     €12,450.00       │      €8,200.00        │      €2,100.00        │
│                                                                      │
│  🛒 Marketplace      │  📊 VAT Collected     │  💵 Net Earnings      │
│     €2,150.00        │      €2,365.50        │     €10,084.50        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Pricing Flexibility

All fees are fully configurable:

| Setting | Range | Default |
|---------|-------|---------|
| Competition Platform Fee | 0% - 50% | 10% |
| Challenge Platform Fee | 0% - 50% | 5% |
| Marketplace Commission | 0% - 100% | 30% |
| Minimum Deposit | €1 - €1000 | €10 |
| Minimum Withdrawal | €1 - €1000 | €20 |

---

## 9. Technology Stack

### 9.1 Core Technologies

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 15 | React framework with App Router |
| **Language** | TypeScript | Type-safe development |
| **UI Library** | React 19 | Component-based UI |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Components** | Shadcn/UI | Accessible component library |

### 9.2 Data & Backend

| Category | Technology | Purpose |
|----------|------------|---------|
| **Database** | MongoDB Atlas | Primary data store |
| **Cache** | Redis | Price cache, sessions |
| **Auth** | Better Auth | Authentication system |
| **Jobs** | Inngest | Background task processing |
| **WebSocket** | ws | Real-time communication |

### 9.3 Charting & Visualization

| Category | Technology | Purpose |
|----------|------------|---------|
| **Trading Charts** | Lightweight Charts | Professional candlestick charts |
| **Dashboard Charts** | Recharts | Analytics visualizations |
| **Animations** | Framer Motion | UI animations |
| **Icons** | Lucide Icons | Icon library |

### 9.4 Payments & Communication

| Category | Technology | Purpose |
|----------|------------|---------|
| **Payments** | Stripe, Nuvei | Payment processing |
| **Email** | Nodemailer | Email notifications |
| **PDF** | pdf-lib | Invoice generation |

### 9.5 External APIs

| Provider | Data | Usage |
|----------|------|-------|
| **Massive.com** | Forex, Crypto, Commodities | Primary price feed |
| **Finnhub** | Stocks, ETFs | Stock market data |

---

## 10. Compliance & Risk Management

### 10.1 Platform Safeguards

**Virtual Currency Model:**
- Users trade with virtual credits, not real money
- No direct trading of financial instruments
- Competition model reduces regulatory burden
- Clear terms of service and user agreements

**KYC Requirements:**
- Identity verification before withdrawals
- Document verification via integrated providers
- Address verification
- Ongoing monitoring

### 10.2 Risk Disclosure

All users must acknowledge:
- Trading involves risk of loss
- Past performance doesn't guarantee future results
- Virtual credits have no inherent value
- Withdrawal requires KYC verification

### 10.3 Responsible Gaming

**Features:**
- Deposit limits (user-configurable)
- Self-exclusion options
- Activity tracking
- Admin intervention tools

---

## 11. Roadmap

### Phase 1: Foundation ✅ (Completed)

- [x] Core trading engine
- [x] Competition system
- [x] 1v1 challenges
- [x] Credit wallet with Stripe
- [x] Basic fraud detection
- [x] Admin dashboard
- [x] Unified candle pipeline

### Phase 2: Enhancement (Current)

- [x] Advanced fraud detection
- [x] KYC integration
- [x] Marketplace system
- [x] Badge & XP system
- [x] TradingView-style charts
- [ ] Mobile optimization (PWA)
- [ ] Push notifications

### Phase 3: Scale (Upcoming)

- [ ] Mirror trading detection
- [ ] Advanced analytics
- [ ] API for third-party integrations
- [ ] Multi-language support
- [ ] Additional payment providers
- [ ] Social features (follow, copy)

### Phase 4: Expansion (Future)

- [ ] Native mobile apps (iOS/Android)
- [ ] Live streaming integration
- [ ] Educational content platform
- [ ] Affiliate/referral system
- [ ] White-label marketplace

---

## 12. Conclusion

### Summary

Chartvolt represents the next evolution in trading platforms, combining:

- **Real Market Data** with virtual credit trading
- **Gamification** with professional-grade tools
- **Security** with enterprise-grade fraud prevention
- **Flexibility** with complete white-label customization
- **Revenue** through multiple monetization streams

### Why Chartvolt?

| Traditional Platforms | Chartvolt |
|----------------------|-----------|
| High regulatory burden | Competition model |
| Users risk real money | Virtual credit system |
| Boring, utility-focused | Gamified, engaging |
| Generic, one-size-fits-all | Complete white-label |
| Limited fraud prevention | Multi-layer security |

### Get Started

Chartvolt is production-ready and fully documented. Platform operators can deploy and customize within days, not months.

---

<div align="center">

**Chartvolt**

*Trade. Compete. Win.*

---

**Contact:** [Your Contact Information]

**Website:** [Your Website]

**Documentation:** `/Docs` folder in repository

---

*Copyright © 2026 Chartvolt. All rights reserved.*

*This whitepaper is for informational purposes only and does not constitute financial advice.*

</div>
