<div align="center">
  <br />
  
  <br />

  <div>
    <img src="https://img.shields.io/badge/-Next.js_15-black?style=for-the-badge&logoColor=white&logo=next.js&color=000000"/>
    <img src="https://img.shields.io/badge/-TypeScript-black?style=for-the-badge&logoColor=white&logo=typescript&color=3178C6"/>
    <img src="https://img.shields.io/badge/-MongoDB-black?style=for-the-badge&logoColor=white&logo=mongodb&color=00A35C"/>
    <img src="https://img.shields.io/badge/-TailwindCSS-black?style=for-the-badge&logoColor=white&logo=tailwindcss&color=38B2AC"/>
  </div>
  <div>
    <img src="https://img.shields.io/badge/-Better_Auth-black?style=for-the-badge&logoColor=white&logo=shield&color=6366F1"/>
    <img src="https://img.shields.io/badge/-Inngest-black?style=for-the-badge&logoColor=white&logo=inngest&color=5865F2"/>
    <img src="https://img.shields.io/badge/-Shadcn/UI-black?style=for-the-badge&logoColor=white&logo=shadcnui&color=000000"/>
    <img src="https://img.shields.io/badge/-Stripe-black?style=for-the-badge&logoColor=white&logo=stripe&color=635BFF"/>
  </div>

  <h1 align="center">⚡ Chartvolt</h1>
  <h3 align="center">The Ultimate Trading Competition Platform</h3>

  <p align="center">
    A full-featured, white-label trading competition platform where traders compete in real-time using virtual credits.
    <br />
    Host competitions, 1v1 challenges, sell trading tools, and manage everything from a powerful admin dashboard.
  </p>

  <div align="center">
    <a href="#features"><strong>Explore Features »</strong></a>
    ·
    <a href="#quick-start"><strong>Quick Start »</strong></a>
    ·
    <a href="#admin-dashboard"><strong>Admin Panel »</strong></a>
  </div>
</div>

---

## 📋 Table of Contents

1. [✨ Introduction](#introduction)
2. [🎯 Key Features](#features)
3. [🏆 Competition System](#competition-system)
4. [⚔️ 1v1 Challenges](#challenges)
5. [🛒 Marketplace](#marketplace)
6. [👑 Admin Dashboard](#admin-dashboard)
7. [⚙️ Tech Stack](#tech-stack)
8. [🤸 Quick Start](#quick-start)
9. [📁 Project Structure](#project-structure)
10. [🔐 Environment Variables](#environment-variables)
11. [📄 License](#license)

---

## <a name="introduction">✨ Introduction</a>

**Chartvolt** is a comprehensive, production-ready trading competition platform built with modern technologies. It enables platform operators to host trading competitions where users compete using virtual credits and real market prices.

### What Makes Chartvolt Special?

- 🎮 **Gamified Trading Experience** — Users join competitions, climb leaderboards, and earn badges
- 💰 **Virtual Credit Economy** — Full wallet system with deposits, withdrawals, and invoicing
- 📊 **Real Market Data** — Live prices from major exchanges for realistic trading
- 🏢 **White-Label Ready** — Fully customizable branding, emails, and settings
- 🔒 **Enterprise Security** — Fraud detection, audit logs, and admin controls
- 💵 **Revenue Streams** — Platform fees from competitions, challenges, and marketplace sales

---

## <a name="features">🎯 Key Features</a>

### 🏆 Trading Competitions
- **Multi-format competitions** — P&L, ROI, Sharpe Ratio, Win Rate, and more
- **Automated lifecycle** — Registration, start, live trading, and finalization
- **Prize distribution** — Automatic payouts to winners with configurable prize pools
- **Minimum participants** — Automatic cancellation and refunds if minimum not met
- **Real-time leaderboards** — Live ranking with tie-breaking logic

### ⚔️ 1v1 Trader Challenges
- **Direct challenges** — Challenge any online trader
- **Winner-takes-all** — Entry fees go to the winner minus platform fee
- **Real-time presence** — See who's online and available
- **Same trading rules** — Uses competition trading engine

### 💼 Credit Wallet System
- **Virtual currency** — Users deposit real money to receive credits
- **Multiple payment methods** — Stripe integration ready
- **Transaction history** — Complete audit trail
- **Automated invoicing** — PDF invoices with VAT calculation
- **Withdrawals** — Request payouts with admin approval

### 📈 Trading Engine
- **Real market prices** — Live data from Finnhub API
- **Multiple asset classes** — Stocks, Crypto, Forex, Commodities, Indices
- **Margin trading** — Configurable leverage (1x-100x)
- **Risk management** — Stop loss, take profit, margin calls, liquidation
- **Order types** — Market orders with position tracking

### 🛒 Marketplace
- **Trading indicators** — SMA, EMA, Bollinger Bands, RSI, MACD, Support/Resistance
- **Custom strategies** — Admin-created trading strategies with buy/sell signals
- **Chart integration** — Purchased items appear directly on trading charts
- **Revenue sharing** — Platform earns from each sale

### 🏅 Gamification
- **Badge system** — Achievement badges for various accomplishments
- **XP & Levels** — Progressive leveling system
- **Global leaderboard** — Platform-wide ranking of all traders
- **Profile stats** — Win rates, total competitions, earnings

### 🔔 Notification System
- **Real-time notifications** — Bell icon with unread count
- **Email notifications** — Configurable email templates
- **User preferences** — Toggle individual notification types
- **Admin broadcasts** — Send notifications to all users

### 🛡️ Security & Fraud Detection
- **Device fingerprinting** — Track user devices
- **Multi-account detection** — Prevent cheating
- **IP monitoring** — Geographic tracking
- **Fraud alerts** — Automatic flagging of suspicious activity
- **User restrictions** — Ban or limit users

---

## <a name="competition-system">🏆 Competition System</a>

### Competition Types

| Type | Description |
|------|-------------|
| **P&L (Profit & Loss)** | Highest absolute profit wins |
| **ROI (Return on Investment)** | Best percentage return wins |
| **Sharpe Ratio** | Risk-adjusted returns |
| **Win Rate** | Highest percentage of winning trades |
| **Risk-Adjusted Return** | Balanced risk/reward performance |

### Competition Lifecycle

```
📝 REGISTRATION → ⏳ PENDING → 🟢 ACTIVE → 🏁 COMPLETED
                       ↓
                  ❌ CANCELLED (if min participants not met)
```

### Features
- **Entry fees** — Configurable entry fee + platform fee
- **Prize pools** — Automatic calculation and distribution
- **Starting capital** — Virtual trading capital for all participants
- **Duration** — From minutes to days
- **Asset restrictions** — Limit to specific asset classes
- **Minimum trades** — Disqualify inactive participants

---

## <a name="challenges">⚔️ 1v1 Challenges</a>

Challenge any online trader to a head-to-head trading battle!

### How It Works

1. 🎯 **Find Opponent** — Browse the leaderboard for online traders
2. 📝 **Create Challenge** — Set entry fee, duration, and start time
3. ✅ **Accept/Decline** — Opponent receives notification
4. 💰 **Credits Locked** — Entry fees deducted from both wallets
5. 📊 **Trade** — Both traders compete with same rules
6. 🏆 **Winner Takes All** — Prize = (2 × Entry Fee) - Platform Fee

### Challenge Features
- **Real-time presence** — 2-second heartbeat updates
- **Minimum trades** — Must make at least 1 trade
- **Same ranking methods** — All competition types available
- **Automatic finalization** — Results processed at end time

---

## <a name="marketplace">🛒 Marketplace</a>

### Trading Indicators

| Indicator | Description |
|-----------|-------------|
| **Simple Moving Average (SMA)** | Trend following with customizable period |
| **Exponential Moving Average (EMA)** | Faster trend detection |
| **Bollinger Bands** | Volatility and overbought/oversold |
| **RSI** | Momentum oscillator |
| **MACD** | Trend and momentum |
| **Support & Resistance** | Key price levels |

### Trading Strategies

Admins can create custom strategies by combining:
- Multiple indicator conditions
- Price comparisons (above/below/crosses)
- Value thresholds
- Buy/Sell signal generation

Strategies display real-time buy/sell arrows on user charts.

---

## <a name="admin-dashboard">👑 Admin Dashboard</a>

### Dashboard Sections

| Section | Features |
|---------|----------|
| **📊 Analytics** | Platform stats, user growth, revenue charts |
| **🏆 Competitions** | Create, edit, cancel, view participants |
| **⚔️ Challenges** | Configure settings, view active challenges |
| **👥 Users** | View all users, wallet balances, activity |
| **💰 Financials** | Revenue breakdown, fees, transactions |
| **🛒 Marketplace** | Create indicators, strategies, manage items |
| **🔔 Notifications** | Send broadcasts, manage templates |
| **📧 Email Templates** | Customize all platform emails |
| **⚙️ Settings** | Fees, trading rules, branding |
| **🗄️ Database** | Health checks, reset functionality |
| **🔐 Fraud Detection** | Alerts, restrictions, device tracking |
| **📝 Audit Log** | Complete action history |
| **📖 Wiki** | Built-in documentation |

### Financial Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  💰 Total Revenue    │  🏆 Competition Fees  │  ⚔️ Challenge Fees  │
│     €12,450.00       │      €8,200.00        │      €2,100.00      │
├─────────────────────────────────────────────────────────────┤
│  🛒 Marketplace      │  📊 VAT Collected     │  💵 Net Earnings    │
│     €2,150.00        │      €2,365.50        │     €10,084.50      │
└─────────────────────────────────────────────────────────────┘
```

---

## <a name="tech-stack">⚙️ Tech Stack</a>

### Core Framework
- **[Next.js 15](https://nextjs.org/)** — React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe JavaScript
- **[React 19](https://react.dev/)** — UI library

### Database & Auth
- **[MongoDB](https://www.mongodb.com/)** — NoSQL database with Mongoose ODM
- **[Better Auth](https://www.better-auth.com/)** — Authentication & authorization

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first CSS
- **[Shadcn/UI](https://ui.shadcn.com/)** — Accessible component library
- **[Framer Motion](https://www.framer.com/motion/)** — Animations
- **[Lucide Icons](https://lucide.dev/)** — Icon library

### Charts & Trading
- **[Lightweight Charts](https://www.tradingview.com/lightweight-charts/)** — Professional trading charts
- **[Recharts](https://recharts.org/)** — Dashboard charts

### Background Jobs
- **[Inngest](https://www.inngest.com/)** — Event-driven workflows & cron jobs

### Payments & Email
- **[Stripe](https://stripe.com/)** — Payment processing
- **[Nodemailer](https://nodemailer.com/)** — Email sending
- **[pdf-lib](https://pdf-lib.js.org/)** — PDF invoice generation

### External APIs
- **[Finnhub](https://finnhub.io/)** — Real-time market data

---

## <a name="quick-start">🤸 Quick Start</a>

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/atlas) (Atlas or local)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/chartvolt.git
cd chartvolt

# Install dependencies
npm install

# Set up environment variables
cp env_minimal_example.txt .env.local
# Edit .env.local with your values

# Run development server
npm run dev

# In another terminal, run Inngest dev server
npx inngest-cli@latest dev
```

### Access the Application

- **Main App**: [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard**: [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard)
- **Inngest Dashboard**: [http://localhost:8288](http://localhost:8288)

---

## <a name="project-structure">📁 Project Structure</a>

```
chartvolt/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages
│   ├── (root)/                   # Main app pages
│   │   ├── competitions/         # Competition pages
│   │   ├── challenges/           # Challenge pages
│   │   ├── marketplace/          # Marketplace pages
│   │   ├── profile/              # User profile
│   │   └── wallet/               # Wallet management
│   ├── admin/                    # Admin dashboard
│   └── api/                      # API routes
│
├── components/                   # React components
│   ├── admin/                    # Admin dashboard components
│   ├── trading/                  # Trading UI components
│   └── ui/                       # Shadcn UI components
│
├── database/                     # Database layer
│   ├── models/                   # Mongoose models
│   └── mongoose.ts               # DB connection
│
├── lib/                          # Utilities & services
│   ├── actions/                  # Server actions
│   ├── services/                 # Business logic
│   └── utils/                    # Helper functions
│
├── contexts/                     # React contexts
├── hooks/                        # Custom React hooks
├── inngest/                      # Background job definitions
└── public/                       # Static assets
```

---

## <a name="environment-variables">🔐 Environment Variables</a>

Create a `.env.local` file with the following:

```env
# App Configuration
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb+srv://...

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Finnhub (Market Data)
NEXT_PUBLIC_FINNHUB_API_KEY=your-finnhub-key
FINNHUB_BASE_URL=https://finnhub.io/api/v1

# Email (Nodemailer)
NODEMAILER_EMAIL=your-email@gmail.com
NODEMAILER_PASSWORD=your-app-password

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI (Optional - for AI features)
GEMINI_API_KEY=your-gemini-key

# Admin Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
```

---

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy!

### Docker

```bash
# Build image
docker build -t chartvolt .

# Run container
docker run -p 3000:3000 --env-file .env.local chartvolt
```

---

## 📊 API Reference

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/competitions` | GET | List all competitions |
| `/api/competitions/[id]` | GET | Get competition details |
| `/api/leaderboard` | GET | Global leaderboard |
| `/api/prices` | GET | Current market prices |

### Protected Endpoints (Require Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/wallet` | GET | Get wallet balance |
| `/api/user/wallet/transactions` | GET | Transaction history |
| `/api/user/notifications` | GET | User notifications |
| `/api/trading/order` | POST | Place trading order |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/competitions` | POST | Create competition |
| `/api/admin/users` | GET | List all users |
| `/api/admin/financials` | GET | Platform financials |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing framework
- [Shadcn](https://ui.shadcn.com/) for beautiful components
- [TradingView](https://www.tradingview.com/) for Lightweight Charts
- [Finnhub](https://finnhub.io/) for market data

---

<div align="center">
  <p>Built with ❤️ by the Chartvolt Team</p>
  <p>
    <a href="#top">⬆️ Back to Top</a>
  </p>
</div>
