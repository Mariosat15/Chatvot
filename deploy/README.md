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

```bash
cp env_minimal_example.txt .env
nano .env
```

Fill in these required values:

```env
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ADMIN_URL=https://admin.yourdomain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=https://yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password
ADMIN_JWT_SECRET=your-admin-jwt-secret-min-32-chars
API_PORT=4000
WEBSOCKET_PORT=3003
NEXT_PUBLIC_WEBSOCKET_URL=wss://yourdomain.com/ws
WEBSOCKET_INTERNAL_URL=http://localhost:3003
```

Generate random secrets with:
```bash
openssl rand -hex 32
```

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

### Step 7: Payment Provider (IF accepting payments)

Only needed if the client will sell marketplace items, Game Master subscriptions, etc.

1. In admin panel: **Settings > Payment Providers**
2. Configure **Stripe** (recommended):
   - `STRIPE_SECRET_KEY` — starts with `sk_live_...`
   - `STRIPE_PUBLISHABLE_KEY` — starts with `pk_live_...`
   - `STRIPE_WEBHOOK_SECRET` — starts with `whsec_...`

**Stripe Webhook Setup:**
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the webhook signing secret to admin panel

### Step 8: Optional Configuration

These are nice-to-have but not required for the app to function:

| Setting | Where | Purpose |
|---------|-------|---------|
| OpenAI API Key | Settings > Environment Variables | AI-powered email personalization |
| Inngest Keys | Settings > Environment Variables | Event-driven email delivery (cloud mode) |
| Competition Settings | Settings > Competitions | Default rules, durations, prize structures |
| Risk Management | Settings > Trading | Max leverage, margin requirements |
| Currency Settings | Settings > General | Display currency (EUR, USD, etc.) |

### Step 9: Final Verification

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

### MongoDB

MongoDB Atlas provides automatic backups. For manual backup:
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
