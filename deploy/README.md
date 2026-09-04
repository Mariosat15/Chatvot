# Chartvolt Deployment Guide

Complete guide for deploying Chartvolt to a Hostinger VPS (or any Ubuntu/Debian server).
This guide supports white-label deployments with custom domains.

---

## Prerequisites

Before starting, make sure you have:

- [ ] **Hostinger VPS** (Ubuntu 22.04+, 4GB RAM minimum recommended)
- [ ] **Domain name** purchased and ready to configure DNS
- [ ] **MongoDB Atlas** account with a cluster created ([mongodb.com/atlas](https://www.mongodb.com/atlas))
- [ ] **GitHub access** to the Chartvolt repository (HTTPS clone URL)
- [ ] **SSH access** to your VPS (root or sudo user)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     YOUR VPS SERVER                                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  NGINX (Reverse Proxy + SSL)                                 │  │
│  │  - yourdomain.com       → User App (3000)                    │  │
│  │  - yourdomain.com/ws    → WebSocket Server (3003)            │  │
│  │  - yourdomain.com/api/* → API Server (4000)                  │  │
│  │  - admin.yourdomain.com → Admin App (3001)                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│    ┌─────────┬───────────┬───┴──────┬───────────┬──────────┐      │
│  ┌─▼────┐  ┌─▼────┐  ┌──▼───┐  ┌───▼────┐  ┌───▼───┐             │
│  │ USER │  │ADMIN │  │ API  │  │WEBSOCK │  │WORKER │             │
│  │ APP  │  │ APP  │  │SERVER│  │ SERVER │  │       │             │
│  │:3000 │  │:3001 │  │:4000 │  │ :3003  │  │(no IP)│             │
│  └──┬───┘  └──┬───┘  └──┬───┘  └───┬────┘  └──┬────┘             │
│     └─────────┴─────────┴──────────┴──────────┘                   │
│                           │              │                         │
│                    ┌──────▼──────┐ ┌─────▼─────┐                  │
│                    │  MongoDB    │ │   Redis    │                  │
│                    │  (Atlas)    │ │ (local)    │                  │
│                    └─────────────┘ └───────────┘                  │
└────────────────────────────────────────────────────────────────────┘
```

**PM2 Processes:**

| Name                | Port | Description                       |
|---------------------|------|-----------------------------------|
| chartvolt-web       | 3000 | Main user application (Next.js)   |
| chartvolt-admin     | 3001 | Admin dashboard (Next.js)         |
| chartvolt-api       | 4000 | API server (auth, bcrypt)         |
| chartvolt-websocket | 3003 | WebSocket server (real-time)      |
| chartvolt-worker    | -    | Background worker (cron jobs)     |

---

## Option 1: Fully Automated Setup (Recommended)

Run a single script that handles everything: server software, Redis, repo clone, `.env` generation, build, database, NGINX, PM2, and SSL.


```bash
# 1. SSH into your VPS
ssh root@YOUR_SERVER_IP

# 2. Download the setup script
curl -O https://raw.githubusercontent.com/YOUR_GITHUB_USER/YOUR_REPO/main/deploy/setup-new-customer.sh
chmod +x setup-new-customer.sh

# 3. Run it (it will ask for your domain, MongoDB URI, admin email, etc.)
sudo ./setup-new-customer.sh
```

The script will:
1. Install Node.js, PM2, NGINX, Certbot, Redis
2. Configure Redis with a generated password
3. Clone your repository
4. Generate `.env` from your inputs (with random secrets)
5. Create `.env` symlink for admin app
6. Install dependencies and build all apps
7. Set up the database (indexes + seed data)
8. Configure NGINX with your domain (including rate limiting)
9. Start all services with PM2
10. Set up SSL certificates (if DNS is ready)
11. Print a summary with all credentials

**After the script completes**, configure Redis in the admin panel:
- Go to `https://admin.yourdomain.com` > Settings > Redis
- Enter: Host `127.0.0.1`, Port `6379`, Password (printed by the script)

---

## Option 2: Step-by-Step Manual Setup

### Step 1: Server Software

```bash
ssh root@YOUR_SERVER_IP

# Run the server setup script (installs Node.js, PM2, NGINX, Redis, Certbot)
curl -O https://raw.githubusercontent.com/YOUR_GITHUB_USER/YOUR_REPO/main/deploy/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
```

Save the Redis password printed at the end.

### Step 2: Clone Repository

```bash
cd /var/www/chartvolt
git clone https://github.com/YOUR_GITHUB_USER/YOUR_REPO.git .
```

### Step 3: Configure Environment

Create `.env` from the provided example and fill in your values:

```bash
cp deploy/env.example .env
nano .env
```

Generate random secrets with:
```bash
openssl rand -hex 32
```

**Required variables** (app will not start without these):

```env
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ADMIN_URL=https://admin.yourdomain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=https://yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password
ADMIN_JWT_SECRET=<openssl rand -hex 32>
INTERNAL_API_SECRET=<openssl rand -hex 32>
INTERNAL_API_KEY=<openssl rand -hex 32>
API_PORT=4000
WEBSOCKET_PORT=3003
NEXT_PUBLIC_WEBSOCKET_URL=wss://yourdomain.com/ws
WEBSOCKET_INTERNAL_URL=http://localhost:3003
SERVER_ID=<auto: uuid or hostname>
IS_PRIMARY=true
```

**Key integrations** (comment out if not using, set here OR in Admin Panel):

```env
# Trading data — https://massive.com
MASSIVE_API_KEY=
NEXT_PUBLIC_MASSIVE_API_KEY=

# Email
NODEMAILER_EMAIL=noreply@yourdomain.com
NODEMAILER_PASSWORD=your-gmail-app-password

# KYC — https://portal.veriff.com  [MUST MATCH across all servers]
VERIFF_API_KEY=
VERIFF_API_SECRET=
VERIFF_BASE_URL=https://stationapi.veriff.com
VERIFF_CALLBACK_URL=https://yourdomain.com/kyc/callback

# AI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_ENABLED=true

# Payments (choose one)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Note:** `INTERNAL_API_SECRET` and `INTERNAL_API_KEY` are auto-generated by the setup script. If you set up manually, generate them with `openssl rand -hex 32`.

> See `deploy/env.example` for the complete list of all 50+ variables with descriptions.

Create `.env` symlink for admin app:
```bash
ln -sf /var/www/chartvolt/.env /var/www/chartvolt/apps/admin/.env
```

### Step 4: Install Dependencies

```bash
cd /var/www/chartvolt

# Main app
npm install

# Admin app
cd apps/admin && npm install && cd ../..

# API server
cd api-server && npm install && cd ..

# WebSocket server
cd websocket-server && npm install && cd ..
```

> **Do not add `--legacy-peer-deps` by hand.** The root `.npmrc` sets it, because
> `better-auth` declares a peerOptional on `vitest@^4` while the test suite is pinned to
> `vitest@3.2.4`, and npm treats that as a hard `ERESOLVE` failure. Only the root project
> is affected; the three sub-projects resolve cleanly. Passing the flag manually was what
> kept `deploy/deploy.sh` from being usable — it runs a bare `npm install` and, with
> `set -e`, aborted the whole deploy on the first step.

### Step 5: Build All Apps

```bash
npm run build          # Main app
npm run build:admin    # Admin app
npm run build:api      # API server
cd websocket-server && npm run build && cd ..  # WebSocket server
npm run worker:build   # Worker
```

### Step 6: Database Setup

```bash
# Creates indexes and seeds default data
node scripts/setup-database.js
```

Options:
```bash
node scripts/setup-database.js --indexes-only  # Only create indexes
node scripts/setup-database.js --seed-only     # Only seed data
node scripts/setup-database.js --force         # Force re-seed
```

> **Note:** Only run on fresh databases. Skip for existing deployments.

### Step 7: Configure NGINX

```bash
# Copy the template config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt

# Replace domain placeholders with your actual domain
sudo sed -i 's/ADMIN_DOMAIN_PLACEHOLDER/admin.yourdomain.com/g' /etc/nginx/sites-available/chartvolt
sudo sed -i 's/DOMAIN_PLACEHOLDER/yourdomain.com/g' /etc/nginx/sites-available/chartvolt

# Add rate limiting to main nginx.conf (inside the http {} block)
sudo nano /etc/nginx/nginx.conf
```

Add these lines inside the `http {}` block:
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=1r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_status 429;
```

Then enable the site:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chartvolt /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8: Start Services

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
```

### Step 9: SSL Certificates

Make sure DNS A records are configured first (see DNS Setup section below).

```bash
sudo certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d admin.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Step 10: Configure Redis in Admin Panel

1. Go to `https://admin.yourdomain.com`
2. Login with your admin credentials
3. Go to Settings > Redis
4. Enter: Host `127.0.0.1`, Port `6379`, Password (from setup-server.sh output)
5. Click "Test Connection" then "Save"

### Step 11: MongoDB Atlas IP Whitelist

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your cluster
3. Go to Security > Network Access
4. Click "+ Add IP Address"
5. Enter your VPS IP address
6. Click Confirm

---

## DNS Setup

Configure these DNS A records at your domain registrar (e.g., Hostinger):

| Type | Name    | Value (IP)     | TTL  |
|------|---------|----------------|------|
| A    | @       | YOUR_SERVER_IP | 3600 |
| A    | www     | YOUR_SERVER_IP | 3600 |
| A    | admin   | YOUR_SERVER_IP | 3600 |

**Propagation:** DNS changes can take 5 minutes to 48 hours. Check with:
```bash
dig yourdomain.com +short
dig admin.yourdomain.com +short
```

Wait until both return your server's IP before setting up SSL.

---

## Redis Configuration

Redis is installed and configured automatically by the setup scripts. Here's what's configured:

| Setting         | Value              |
|-----------------|--------------------|
| Bind            | 127.0.0.1 (local)  |
| Port            | 6379               |
| Password        | Auto-generated      |
| Max Memory      | 8GB                |
| Eviction Policy | allkeys-lru        |

### Redis Management

```bash
# Check Redis status
systemctl status redis-server

# Restart Redis
sudo systemctl restart redis-server

# Connect to Redis CLI
redis-cli -a YOUR_REDIS_PASSWORD

# Check memory usage
redis-cli -a YOUR_REDIS_PASSWORD INFO memory

# Flush all cached data (use with caution)
redis-cli -a YOUR_REDIS_PASSWORD FLUSHALL
```

### Redis Troubleshooting

```bash
# Check if Redis is running
systemctl is-active redis-server

# View Redis logs
sudo journalctl -u redis-server --no-pager -n 50

# Test connection
redis-cli -a YOUR_REDIS_PASSWORD ping
# Should return: PONG

# Check configuration
redis-cli -a YOUR_REDIS_PASSWORD CONFIG GET maxmemory
redis-cli -a YOUR_REDIS_PASSWORD CONFIG GET bind
```

---

## White-Label Deployment

For each new client deployment:

### What Changes Per Client

| Item               | Changes To                           |
|--------------------|--------------------------------------|
| Domain             | Client's domain                      |
| Admin Domain       | admin.clientdomain.com               |
| MongoDB            | New database/cluster                 |
| Admin Credentials  | Client's admin email/password        |
| Redis Password     | Auto-generated per server            |
| SSL Certificates   | Auto-generated via Certbot           |
| Auth Secrets       | Auto-generated per deployment        |

### What Stays the Same

- All application code
- NGINX template (domains replaced by script)
- PM2 ecosystem config
- Redis configuration (auto-generated)
- Database schema and seed data

### Quick Deploy for New Client

```bash
# On a fresh VPS:
sudo ./deploy/setup-new-customer.sh
# Follow the prompts, done in ~10 minutes
```

---

## Post-Deployment Setup Checklist

After the deployment script completes, follow this checklist to make the app fully operational.
**Estimated time: 10-15 minutes.**

### What Happens Automatically (No Action Needed)

These are created by the deployment script and auto-seed on first use:

- [x] Database indexes (30+ collections indexed for fast queries)
- [x] 30+ trading symbols (EUR/USD, GBP/USD, USD/JPY, etc.)
- [x] Market data settings (WebSocket intervals, candle limits)
- [x] Marketplace items (3 premium indicators, 12 cosmetic avatars, 3 Game Master packages)
- [x] 69 notification templates (trading, competition, achievement, system)
- [x] Badges & XP configuration (50+ levels, achievement badges)
- [x] WhiteLabel settings document (created with defaults)
- [x] Worker cron jobs (margin checks, competitions, badge evaluation)
- [x] Redis installed and secured with generated password
- [x] NGINX configured with your domain and rate limiting
- [x] SSL certificates (if DNS was ready during setup)
- [x] `.env` file generated with random secrets
- [x] `.env` symlink for admin app

### Step 1: MongoDB Atlas IP Whitelist (REQUIRED)

Your new VPS server cannot connect to MongoDB until you whitelist its IP.

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your cluster
3. Go to **Security > Network Access** (left sidebar)
4. Click **"+ Add IP Address"**
5. Enter your new VPS IP address (printed by the setup script)
6. Click **Confirm**
7. Wait 1-2 minutes for the change to propagate

**Verify it works:**
```bash
# On the VPS, check if the app can connect:
pm2 logs chartvolt-web --lines 20
# Should show: "Connected to MongoDB" (not connection errors)
```

> If you have multiple white-label servers, each server's IP must be whitelisted separately. Alternatively, use `0.0.0.0/0` to allow all IPs (less secure but simpler).

### Step 2: First Admin Login (REQUIRED)

1. Open `https://admin.yourdomain.com` in your browser
2. Login with the credentials you entered during the setup script
3. Change the admin password if prompted

> If admin login fails, verify the `.env` symlink exists:
> ```bash
> ls -la /var/www/chartvolt/apps/admin/.env
> # Should show: .env -> /var/www/chartvolt/.env
> ```

### Step 3: Massive.com API Keys (REQUIRED - for trading data)

Without these, **charts won't load and prices won't stream**.

1. Go to [massive.com](https://massive.com) and get your API keys
2. In admin panel: **Settings > Environment Variables**
3. Set these two keys:
   - `massiveApiKey` — server-side API key (used for historical data, candle fetching)
   - `nextPublicMassiveApiKey` — client-side API key (used for WebSocket price streaming)
4. Save

**Verify it works:**
```bash
# Restart the web app to pick up new keys:
pm2 restart chartvolt-web

# Check for price streaming:
pm2 logs chartvolt-web --lines 30
# Should show: "WebSocket connected" and price updates
```

Then open `https://yourdomain.com`, navigate to a chart, and verify:
- Candles are loading (historical data)
- Prices are updating in real-time (WebSocket streaming)

### Step 4: Redis Configuration (REQUIRED)

1. In admin panel: **Settings > Redis**
2. Enter the credentials from the setup script output:
   - **Redis Host:** `127.0.0.1`
   - **Redis Port:** `6379`
   - **Redis Password:** (the password printed by the setup script)
3. Click **"Test Connection"** — should show "Connection successful!"
4. Toggle **"Enable Redis Cache"** ON
5. Leave **"Multi-Server Price Sync"** OFF (single server)
6. Save

> Redis provides: trade queue processing, rate limiting, and optional price caching.

### Step 5: Email Configuration (REQUIRED - for user emails)

Without this, users won't receive welcome emails, password resets, or notifications.

1. In admin panel: **Settings > Environment Variables**
2. Configure Nodemailer:
   - `nodemailerEmail` — a Gmail address (e.g., `noreply@yourdomain.com` or a Gmail account)
   - `nodemailerPassword` — a **Gmail App Password** (NOT your regular Gmail password)

**How to get a Gmail App Password:**
1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to **App passwords** (search "App passwords" in the security page)
4. Select app: "Mail", device: "Other" (enter "Chartvolt")
5. Copy the 16-character password
6. Paste it as `nodemailerPassword`

**Verify it works:**
- Register a test user on `https://yourdomain.com`
- Check if the welcome email arrives

### Step 6: Branding & White-Label Appearance (REQUIRED)

1. In admin panel: **Settings > Branding**
2. Upload:
   - **App Logo** — main logo shown in the navigation bar
   - **Favicon** — browser tab icon (recommended: 32x32 or 64x64 .ico/.png)
   - **Email Logo** — logo used in email templates
3. Set:
   - **App Name** — the client's brand name
   - **Theme Colors** — primary/secondary colors
   - **Footer Text** — copyright text

> After uploading branding images, they are automatically persisted in the database for durability across deployments.

### Step 7: KYC — Veriff (IF using identity verification)

> ⚠️ **Multi-server warning:** `VERIFF_API_SECRET` must be the same on every server — or managed only via Admin Panel (leave blank in `.env`). Mixing a blank `.env` on one server with a value in `.env` on another causes `Signature does not match` errors.

1. Get keys at [portal.veriff.com](https://portal.veriff.com)
2. In admin panel: **Settings > KYC** — enter API key and secret
3. **Do NOT also set them in `.env` unless you ensure all servers have the same values**

### Step 8: Payment Provider (IF accepting payments)

Only needed if the client will sell marketplace items, Game Master subscriptions, etc.

1. In admin panel: **Settings > Payment Providers**
2. Configure **Stripe** (recommended):
   - `STRIPE_SECRET_KEY` — starts with `sk_live_...`
   - `STRIPE_PUBLISHABLE_KEY` — starts with `pk_live_...`
   - `STRIPE_WEBHOOK_SECRET` — starts with `whsec_...`

**Stripe Webhook Setup:**
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the webhook signing secret to admin panel

### Step 10: Optional Configuration

These are nice-to-have but not required for the app to function:

| Setting | Where | Purpose |
|---------|-------|---------|
| OpenAI API Key | Settings > Environment Variables | AI-powered email personalization, strategy builder |
| Inngest Keys | Settings > Environment Variables | Event-driven background job delivery (cloud mode) |
| Competition Settings | Settings > Competitions | Default rules, durations, prize structures |
| Risk Management | Settings > Trading | Max leverage, margin requirements |
| Currency Settings | Settings > General | Display currency (EUR, USD, etc.) |

> See `deploy/env.example` for the full reference of all 50+ environment variables with descriptions, warnings, and defaults.

### Step 11: Final Verification

Run through this checklist to confirm everything works:

- [ ] **Homepage loads:** `https://yourdomain.com` shows the landing page
- [ ] **Admin loads:** `https://admin.yourdomain.com` shows the admin dashboard
- [ ] **User registration:** Register a test user, confirm welcome email arrives
- [ ] **Charts work:** Open a trading chart, candles load, prices stream in real-time
- [ ] **Marketplace:** Items are visible (avatars, indicators, Game Master packages)
- [ ] **Redis connected:** Admin > Redis shows "Connected" with green badge
- [ ] **All services running:** SSH and run `pm2 status` — all 5 services show "online"
- [ ] **Worker active:** `pm2 logs chartvolt-worker --lines 20` shows job execution
- [ ] **SSL working:** Browser shows padlock icon on both domains
- [ ] **WebSocket:** `curl https://yourdomain.com/ws-health` returns OK

```bash
# Quick health check from VPS:
curl -s http://localhost:3000/health && echo " ✅ User App"
curl -s http://localhost:3001/health && echo " ✅ Admin App"
curl -s http://localhost:4000/api/health && echo " ✅ API Server"
curl -s http://localhost:3003/health && echo " ✅ WebSocket"
systemctl is-active redis-server && echo "✅ Redis"
```

### Summary: Time Estimate Per Step

| Step | Time | Required? |
|------|------|-----------|
| 1. MongoDB IP Whitelist | 2 min | Yes |
| 2. First Admin Login | 1 min | Yes |
| 3. Massive.com API Keys | 2 min | Yes |
| 4. Redis Configuration | 1 min | Yes |
| 5. Email Configuration | 5 min | Yes |
| 6. Branding | 5 min | Yes |
| 7. Payment Provider | 5 min | If selling |
| 8. Optional Settings | 5 min | No |
| 9. Verification | 3 min | Yes |
| **Total** | **~15-25 min** | |

---

## Deploying Updates

For existing installations, use the deploy script:

```bash
./deploy/deploy.sh              # Normal update (pull, build, reload)
./deploy/deploy.sh --new        # New install (includes DB setup)
./deploy/deploy.sh --db-only    # Only run database setup
./deploy/deploy.sh --force-db   # Force re-seed database
```

Or manually:
```bash
cd /var/www/chartvolt
git pull origin main
npm install
cd apps/admin && npm install && cd ../..
cd api-server && npm install && cd ..
cd websocket-server && npm install && cd ..
npm run build
npm run build:admin
npm run build:api
cd websocket-server && npm run build && cd ..
npm run worker:build
pm2 reload ecosystem.config.js
```

### Update Individual Apps

```bash
# Update only admin app
cd /var/www/chartvolt
git pull origin main
npm run build:admin
pm2 restart chartvolt-admin

# Update only worker
cd /var/www/chartvolt
git pull origin main
npm run worker:build
pm2 restart chartvolt-worker

# Update only WebSocket server
cd /var/www/chartvolt
git pull origin main
cd websocket-server && npm run build && cd ..
pm2 restart chartvolt-websocket
```

---

## Management Commands

### PM2

```bash
pm2 status                        # View all app statuses
pm2 logs                          # All logs (live)
pm2 logs chartvolt-web            # User app logs
pm2 logs chartvolt-admin          # Admin app logs
pm2 logs chartvolt-api            # API server logs
pm2 logs chartvolt-websocket      # WebSocket server logs
pm2 logs chartvolt-worker         # Worker logs
pm2 restart all                   # Restart all apps
pm2 restart chartvolt-web         # Restart specific app
pm2 monit                         # Real-time monitoring dashboard
pm2 stop all                      # Stop all apps
pm2 save                          # Save current process list
pm2 resurrect                     # Restore saved process list
```

### NGINX

```bash
sudo nginx -t                     # Test configuration
sudo systemctl reload nginx       # Reload without downtime
sudo systemctl restart nginx      # Full restart
tail -f /var/log/nginx/app-access.log     # User app access logs
tail -f /var/log/nginx/app-error.log      # User app error logs
tail -f /var/log/nginx/admin-access.log   # Admin access logs
tail -f /var/log/nginx/admin-error.log    # Admin error logs
```

### Health Checks

```bash
# Local (on the server)
curl http://localhost:3000/health      # User app
curl http://localhost:3001/health      # Admin app
curl http://localhost:4000/api/health  # API server
curl http://localhost:3003/health      # WebSocket server
redis-cli -a YOUR_REDIS_PASSWORD ping  # Redis

# External (after SSL)
curl https://yourdomain.com/health
curl https://admin.yourdomain.com/health
curl https://yourdomain.com/ws-health
```

### System Resources

```bash
pm2 monit          # PM2 monitoring dashboard
htop               # System processes
df -h              # Disk usage
free -m            # Memory usage
```

---

---

## Environment Variable Reference

See **`deploy/env.example`** for the complete, annotated reference of every environment variable the application uses.

Quick summary of the most important ones:

| Variable | Required | Multi-server | Purpose |
|---|---|---|---|
| `MONGODB_URI` | ✅ | Match | Database connection |
| `BETTER_AUTH_SECRET` | ✅ | Match | User session JWT signing |
| `ADMIN_JWT_SECRET` | ✅ | Match | Admin panel JWT signing |
| `INTERNAL_API_SECRET` | ✅ | Match | Internal service calls |
| `INTERNAL_API_KEY` | ✅ | Match | Internal admin API protection |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Per-domain | App public URL |
| `WEBSOCKET_INTERNAL_URL` | ✅ | Per-server | WS server internal URL |
| `MASSIVE_API_KEY` | ⚠️ | Same | Trading data (charts) |
| `NODEMAILER_EMAIL` | ⚠️ | Same | Outbound email |
| `VERIFF_API_SECRET` | ⚠️ | **Match** | KYC webhook verification |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | **Match** | Payment webhook verification |
| `OPENAI_API_KEY` | Optional | Same | AI features |

---

## Troubleshooting

### App Not Starting

```bash
pm2 logs chartvolt-web --lines 100    # Check logs
lsof -i :3000                         # Check if port is in use
pm2 restart chartvolt-web             # Restart the app
```

### NGINX 502 Bad Gateway

```bash
pm2 status                             # Are apps running?
tail -100 /var/log/nginx/app-error.log # Check NGINX error log
curl http://127.0.0.1:3000             # Can you reach the app directly?
```

### Admin Can't Login

The admin app needs access to `.env`. Ensure the symlink exists:
```bash
ls -la /var/www/chartvolt/apps/admin/.env
# Should show: .env -> /var/www/chartvolt/.env

# If missing, create it:
ln -sf /var/www/chartvolt/.env /var/www/chartvolt/apps/admin/.env
pm2 restart chartvolt-admin
```

### Database Connection Issues

```bash
# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e))"

# Check if VPS IP is whitelisted in MongoDB Atlas
# Atlas > Network Access > Verify your server IP is listed
```

### Redis Not Working

```bash
systemctl status redis-server          # Check service status
redis-cli -a YOUR_PASSWORD ping        # Test connection
sudo journalctl -u redis-server -n 50  # View Redis logs
sudo systemctl restart redis-server    # Restart Redis
```

### SSL Certificate Issues

```bash
sudo certbot certificates              # Check certificate status
sudo certbot renew --dry-run           # Test auto-renewal
sudo certbot --nginx -d yourdomain.com # Re-run certbot if needed
```

### KYC / Veriff: "Signature does not match" (error 1819)

This happens when the `VERIFF_API_SECRET` used to sign/verify requests doesn't match what Veriff expects.

```bash
# Check what value the running app is using:
grep VERIFF /var/www/chartvolt/.env

# If blank, the app reads from MongoDB (Admin Panel setting) — this is fine.
# If set, it OVERRIDES the Admin Panel. Make sure it matches exactly (no trailing space/newline).

# Verify the secret is loaded correctly:
node -e "require('dotenv').config(); console.log('SECRET:', JSON.stringify(process.env.VERIFF_API_SECRET))"

# After editing .env, you MUST rebuild (not just restart):
npm run build
pm2 restart chartvolt-web
```

**Root causes:**
- `.env` on Server 2 has a wrong/blank override that doesn't match what Veriff registered
- Trailing whitespace or newline in the secret value
- Secret in `.env` doesn't match the secret configured in Veriff portal

**Fix:** Either set the correct secret in `.env` on ALL servers, or remove it from `.env` on all servers and manage it only via Admin Panel > Settings > KYC.

### Internal API calls returning 401/403

Check `INTERNAL_API_SECRET` and `INTERNAL_API_KEY` are identical across all servers:
```bash
grep -E "INTERNAL_API" /var/www/chartvolt/.env
```
These are auto-generated per server by `setup-new-customer.sh`. On secondary servers, copy the primary's values.

### WebSocket Not Connecting

```bash
# Check if WebSocket server is running
pm2 logs chartvolt-websocket --lines 50

# Test WebSocket health
curl http://localhost:3003/health

# Verify NGINX is proxying /ws correctly
grep -A5 "location /ws" /etc/nginx/sites-available/chartvolt
```

---

## Backup

### In-App Backup & Restore (Admin Panel)

The admin panel has a built-in restore-point system: **Admin > Database > Backup & Restore**.

- **Create Backup** takes a full snapshot of every collection and stores it on the
  server as a folder of gzipped Extended-JSON files (BSON types are preserved).
- **Restore** reverts the database to a chosen snapshot. It **automatically creates a
  safety snapshot first**, so any restore can itself be undone. Restore requires the
  admin password + typing `RESTORE`.
- Snapshots are saved under `<repo-root>/backups/` by default. Override the location
  with the `BACKUP_DIR` env var (e.g. a mounted volume with more disk):

  ```env
  BACKUP_DIR=/var/backups/chartvolt
  ```

- The `backups/` folder is **gitignored** and never served over HTTP because snapshots
  contain every document, including secrets stored in settings collections. Keep the
  server's disk secure and monitor free space (a snapshot is roughly the compressed
  size of the database).

> Tip: take backups during low-traffic periods for the most consistent snapshot, and
> note you may be logged out right after a restore (sessions are part of the snapshot).

### MongoDB (CLI alternative)

MongoDB Atlas also provides automatic cloud backups. For a manual CLI backup
(requires `mongodb-database-tools` installed on the server):
```bash
mongodump --uri="YOUR_MONGODB_URI" --out=/backup/$(date +%Y%m%d)
mongorestore --uri="YOUR_MONGODB_URI" /backup/20260217
```

### PM2 Configuration

```bash
pm2 save        # Save current process list
pm2 resurrect   # Restore from saved
```

---

## Scaling: PM2 Cluster Mode (Same Server)

Use all your CPU cores without adding servers. Edit `.env`:

```env
WEB_INSTANCES=4
```

Then restart PM2:
```bash
pm2 reload ecosystem.config.js
```

This runs 4 instances of the web app behind PM2's built-in load balancer. Gives you ~3-4x more capacity on the same VPS. No code changes needed.

---

## Multi-Server Deployment with Cloudflare

### PHASE 1: One-Time Setup (Do This Only Once)

Phase 1 configures Cloudflare and prepares the primary server for multi-server operation.

#### Step 1: Set Up Cloudflare (~15 minutes)

**1a. Create Cloudflare Account**

1. Go to [cloudflare.com](https://cloudflare.com) and sign up
2. Click "Connect a domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Select the Free plan (upgrade to Pro later for advanced load balancing)

**1b. Change Nameservers at Your Registrar**

Cloudflare will show you two nameservers (e.g., `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).

1. Go to your registrar (e.g., Hostinger > Domains > yourdomain.com > DNS/Nameservers)
2. Replace the existing nameservers with the Cloudflare ones
3. Save and wait ~30 minutes for propagation

**1c. Configure DNS Records in Cloudflare**

In the Cloudflare dashboard > DNS > Records, add:

| Type | Name  | Content (IP)     | Proxy                  |
|------|-------|------------------|------------------------|
| A    | @     | YOUR_PRIMARY_IP  | Proxied (orange cloud) |
| A    | www   | YOUR_PRIMARY_IP  | Proxied                |
| A    | admin | YOUR_PRIMARY_IP  | Proxied                |

**1d. Configure SSL**

1. Go to SSL/TLS in Cloudflare
2. Set mode to **Full (Strict)**
3. Turn on **"Always Use HTTPS"**

**1e. Enable WebSocket Support**

1. Go to Network in Cloudflare
2. Make sure **"WebSockets"** is ON (it's on by default)

#### Step 2: Prepare Primary Server for Multi-Server (~5 minutes)

SSH into your primary server:

```bash
ssh root@YOUR_PRIMARY_IP
```

**2a. Add IS_PRIMARY and SERVER_ID to your .env** (if not already set):

```bash
cd /var/www/chartvolt
nano .env
```

Add these lines anywhere in the file:
```env
IS_PRIMARY=true
SERVER_ID=primary-01
```

Save and exit.

**2b. Pull latest code and rebuild:**

```bash
cd /var/www/chartvolt
./deploy/deploy.sh
```

**2c. Verify the heartbeat is working:**

Wait 30 seconds, then check in admin panel:
- Go to `https://admin.yourdomain.com` > Settings > Server Fleet
- You should see your primary server listed with green "online" status

Phase 1 is done. You only do this once.

---

### PHASE 2: Add a New VPS (Each Time You Need More Capacity)

#### Step 3: Buy a New VPS (~2 minutes)

1. Buy a new VPS from your provider (same plan or bigger)
2. Note the new server's IP address (e.g., `185.xxx.xxx.xxx`)

#### Step 4: Whitelist the New IP in MongoDB Atlas (~2 minutes)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Select your cluster
3. Go to **Security > Network Access**
4. Click **"+ Add IP Address"**
5. Enter the new VPS IP
6. Click **Confirm**
7. Wait 1–2 minutes for propagation

#### Step 5: Open Redis on Your Primary Server (~3 minutes)

SSH into your **primary server**:

```bash
ssh root@YOUR_PRIMARY_IP
```

**5a.** Allow the new VPS to connect to Redis:
```bash
sudo ufw allow from NEW_VPS_IP to any port 6379
```

**5b.** Make Redis listen on the network (only needed once, for the first secondary):
```bash
sudo sed -i 's/^bind 127.0.0.1.*/bind 0.0.0.0/' /etc/redis/redis.conf
```

**5c.** Restart Redis:
```bash
sudo systemctl restart redis-server
```

**5d.** Verify it works:
```bash
redis-cli -a YOUR_REDIS_PASSWORD ping
# Should return: PONG
```

#### Step 6: Deploy the Secondary Server (~10 minutes)

SSH into the **new VPS**:

```bash
ssh root@NEW_VPS_IP
```

**6a.** Download and run the setup script:

```bash
apt update && apt install -y curl git
curl -O https://raw.githubusercontent.com/YOUR_GITHUB_USER/YOUR_REPO/main/deploy/setup-new-customer.sh
chmod +x setup-new-customer.sh
sudo ./setup-new-customer.sh --secondary
```

**6b.** The script will ask you these questions:

| Question | What to Enter |
|----------|---------------|
| Main domain | `yourdomain.com` (same as primary) |
| Admin subdomain prefix | `admin` (same as primary) |
| Git repository URL | Same HTTPS clone URL as primary |
| MongoDB connection string | Same connection string as primary |
| Admin email | Same as primary |
| Admin password | Same as primary |
| Primary Redis Host | Primary server's IP (e.g., `YOUR_PRIMARY_IP`) |
| Primary Redis Port | `6379` |
| Primary Redis Password | The Redis password from your primary server |
| Copy secrets from primary via SSH? | `y` (recommended) — the script will SSH into primary and auto-copy all shared secrets |
| DNS ready? | `y` if your Cloudflare DNS is set up |

The script will install everything, build the app, configure NGINX, and start PM2 — **without** the worker process (it only runs on primary). All shared secrets (`BETTER_AUTH_SECRET`, `ADMIN_JWT_SECRET`, `INTERNAL_API_SECRET`, `INTERNAL_API_KEY`) are automatically copied from the primary server.

#### Step 7: Add the New Server to Cloudflare DNS (~2 minutes)

Go to Cloudflare dashboard > DNS > Records. Add the new VPS IP:

| Type | Name  | Content         | Proxy                  |
|------|-------|-----------------|------------------------|
| A    | @     | NEW_VPS_IP      | Proxied (orange cloud) |
| A    | www   | NEW_VPS_IP      | Proxied                |
| A    | admin | NEW_VPS_IP      | Proxied                |

Now both IPs are listed for the same domain. Cloudflare will automatically distribute traffic between them.

#### Step 8: Install Cloudflare Origin SSL Certificate

Since Cloudflare proxies all traffic, use Cloudflare Origin Certificates instead of Let's Encrypt. These are free, last 15 years, and require no renewal.

**On Cloudflare dashboard:**

1. Go to **SSL/TLS > Origin Server**
2. Click **Create Certificate**
3. Keep the defaults (RSA 2048, 15 years)
4. Make sure hostnames include: `yourdomain.com`, `*.yourdomain.com`
5. Click **Create**
6. Copy both the **Origin Certificate** and **Private Key** (key is shown only once!)

**On the secondary server (SSH in):**

```bash
# Create the certificate files
sudo nano /etc/ssl/cloudflare-origin.pem
# Paste the Origin Certificate, save

sudo nano /etc/ssl/cloudflare-origin-key.pem
# Paste the Private Key, save

# Secure the key
sudo chmod 600 /etc/ssl/cloudflare-origin-key.pem
```

Update NGINX to use these certs — edit `/etc/nginx/sites-available/chartvolt` and replace SSL lines in **both** server blocks:

```nginx
listen 443 ssl;
listen [::]:443 ssl;
ssl_certificate /etc/ssl/cloudflare-origin.pem;
ssl_certificate_key /etc/ssl/cloudflare-origin-key.pem;
```

Remove any old Let's Encrypt/Certbot SSL lines (`include /etc/letsencrypt/...`, `ssl_dhparam`).

Then test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

> **Note:** You only need to create the Cloudflare Origin Certificate once. Use the same cert files on all secondary servers since the wildcard covers everything.

#### Step 9: Enable Price Sync (~1 minute, only once)

In admin panel: `https://admin.yourdomain.com`
1. Go to **Settings > Redis**
2. Toggle **"Multi-Server Price Sync"** ON
3. Save

This makes the primary server write prices to Redis, and all secondary servers read from Redis. Only do this once — the setting is stored in the shared database.

#### Step 10: Verify Everything Works (~2 minutes)

Check the admin fleet dashboard:
- Go to `https://admin.yourdomain.com` > Settings > Server Fleet
- You should see both servers listed:
  - Primary (green, online)
  - Secondary (green, online)

Check from the new server via SSH:
```bash
ssh root@NEW_VPS_IP
pm2 status
# Should show: web, admin, api, websocket (NO worker)
# All should be "online"
curl http://localhost:3000/health
# Should return OK
```

Done! Your app is now running on two servers.

---

### Quick Reference: Adding More Servers After the First

For every additional VPS after the first secondary, you only need:

1. **Buy VPS**, note the IP
2. **MongoDB Atlas**: add the new IP to whitelist
3. **Primary server**: `sudo ufw allow from NEW_IP to any port 6379`
4. **New VPS**: run `sudo ./setup-new-customer.sh --secondary`
5. **Cloudflare**: add 3 new A records (same names, new IP)
6. **Verify** in admin > Server Fleet

**Time per additional server: ~15 minutes.** No code changes, no rebuilds on existing servers.

---

### Removing a Secondary Server

**IMPORTANT:** Always remove DNS records BEFORE shutting down a server. Otherwise Cloudflare keeps routing traffic to a dead server and ~50% of requests will fail.

1. **Cloudflare DNS**: Delete the 3 A records pointing to the server's IP (`@`, `www`, `admin`)
2. **Wait 1–2 minutes** for DNS propagation
3. **Shut down** the server (or stop PM2: `pm2 stop all`)
4. **MongoDB Atlas**: Optionally remove the server's IP from Network Access
5. **Primary firewall**: Optionally remove the rule: `sudo ufw delete allow from OLD_VPS_IP to any port 6379`

The server will automatically disappear from the Server Fleet dashboard after 90 seconds (heartbeat timeout).

---

### Dedicated Redis Server (Optional, 50K+ users)

For very large deployments, move Redis to its own VPS:

1. Install Redis on a new VPS using `setup-server.sh`
2. Configure Redis to bind to its private IP
3. Firewall: only allow your app server IPs on port 6379
4. Update all app servers' Redis config (via admin panel) to point to the Redis VPS

---

### Cloudflare Pro: Health-Check Load Balancing (Optional)

For proper health-check-based load balancing (instead of round-robin DNS):

1. Go to **Traffic > Load Balancing** in Cloudflare
2. Create an **Origin Pool** with all your VPS IPs as origins
3. Set health check: HTTP, path `/health`, interval 30s, expect 200
4. Create a **Load Balancer**: hostname `yourdomain.com`, attach pool
5. Enable **Session Affinity** (cookie-based) — critical for WebSocket connections
6. Steering policy: "Least connections" or "Random"
7. Repeat for `admin.yourdomain.com` if needed

Cloudflare supports WebSocket proxying by default on all plans.

---

## Server Fleet Monitoring

The admin panel includes a **Server Fleet** dashboard (Settings > Server Fleet) that shows:

- All servers with their role (Primary/Secondary), status, and IP
- Real-time CPU, memory, and disk usage per server
- PM2 process statuses per server
- Redis connectivity status
- WebSocket connection count per server
- Last heartbeat timestamp

Each server sends a heartbeat every 30 seconds. If a heartbeat is missed for 90+ seconds, the server is marked as "offline" in the dashboard.

You can remove decommissioned servers from the fleet via the dashboard.

---

## Security Checklist

- [ ] SSH key authentication enabled
- [ ] Password authentication disabled in SSH
- [ ] UFW firewall enabled (HTTP, HTTPS, SSH only)
- [ ] SSL/TLS certificates installed
- [ ] Redis bound to localhost with password
- [ ] Admin subdomain rate-limited
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Strong admin password set
- [ ] Environment variables secured (not in git)
- [ ] Regular system updates applied
