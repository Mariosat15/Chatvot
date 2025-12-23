# Chartvolt Deployment Guide

Complete guide for deploying Chartvolt to a Hostinger VPS.

## 🌐 Production Details

| Item | Value |
|------|-------|
| **Domain** | chartvolt.com |
| **Admin Domain** | admin.chartvolt.com |
| **VPS IP** | 148.230.124.57 |
| **Provider** | Hostinger |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                HOSTINGER VPS (148.230.124.57)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NGINX (Reverse Proxy)                                   │  │
│  │  - chartvolt.com → User App (3000)                      │  │
│  │  - chartvolt.com/api/auth/* → API Server (4000)         │  │
│  │  - admin.chartvolt.com → Admin App (3001)               │  │
│  │  - SSL/TLS termination                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│    ┌──────────────────────┼──────────────────────┐             │
│    │          │           │           │          │             │
│  ┌─▼────┐  ┌──▼───┐  ┌────▼────┐  ┌───▼────┐                  │
│  │ USER │  │ADMIN │  │   API   │  │ WORKER │                  │
│  │ APP  │  │ APP  │  │ SERVER  │  │        │                  │
│  │:3000 │  │:3001 │  │ :4000   │  │(no port│                  │
│  └──┬───┘  └──┬───┘  └────┬────┘  └───┬────┘                  │
│     └─────────┴───────────┴───────────┘                        │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   MongoDB   │                              │
│                    │  (Atlas)    │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Hostinger VPS (4GB RAM minimum recommended)
- Domain name configured with DNS pointing to VPS IP (148.230.124.57)
- MongoDB Atlas account (or self-hosted MongoDB)

## Quick Start

### 1. Initial Server Setup

```bash
# Connect to your VPS
ssh root@148.230.124.57

# Download and run setup script
curl -O https://raw.githubusercontent.com/Mariosat15/Chatvot/main/deploy/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
```

### 2. Clone Repository

```bash
cd /var/www/chartvolt
git clone https://github.com/Mariosat15/Chatvot.git .
```

### 3. Configure Environment

```bash
# Copy example env file
cp env_minimal_example.txt .env

# Edit with your values
nano .env
```

Required environment variables:
```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chartvolt

# Authentication
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=https://chartvolt.com

# App URLs
NEXT_PUBLIC_APP_URL=https://chartvolt.com
ADMIN_URL=https://admin.chartvolt.com

# Admin
ADMIN_EMAIL=admin@chartvolt.com
ADMIN_PASSWORD=your-secure-password

# API Server
API_PORT=4000

# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Paddle (optional)
PADDLE_VENDOR_ID=...
PADDLE_API_KEY=...
```


Ctrl + O  →  Save
Enter     →  Confirm
Ctrl + X  →  Exit

### 4. Install Dependencies

```bash
npm install
cd apps/admin && npm install && cd ../..
```
cd apps/admin
npm install
cd ../..

cd api-server
npm install
cd ..

I Recommend Option 1 id issue with files
mv Chatvot/* .
mv Chatvot/.* . 2>/dev/null
rm -rf Chatvot
ls


### 5. Build All Apps

```bash
npm run build:all
```

### 6. Configure NGINX

> ⚠️ **IMPORTANT: Rate Limiting Must Be Added Manually**
> 
> Nginx requires rate limiting zones to be defined in the main config file BEFORE using them.

```bash
# STEP 1: Add rate limiting to main nginx.conf
sudo nano /etc/nginx/nginx.conf
```

**Add these lines inside the `http {}` block (REQUIRED):**
```nginx
http {
    # ... existing settings ...
    
    # Rate limiting zones (ADD THIS - REQUIRED!)
    limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=1r/s;
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_status 429;
    
    # ... rest of config ...
}
```

```bash
# STEP 2: Copy site config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt

# STEP 3: The config already has chartvolt.com - verify it's correct
sudo cat /etc/nginx/sites-available/chartvolt | grep server_name
# Should show: server_name chartvolt.com www.chartvolt.com;
# And: server_name admin.chartvolt.com;

# STEP 4: Enable site and disable default
sudo ln -s /etc/nginx/sites-available/chartvolt /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# STEP 5: Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Start Applications

```bash
# Start all apps with PM2
pm2 start ecosystem.config.js

if │ 3  │ chartvolt-api       │ default     │ 1.0.0   │ fork    │ 0        │ 0      │ 30   │ errored   │ 0%       │ 0b       │ root     │ disabled 
-------------
then Generate secret put it in .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 
sed -i "s/BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=$(openssl rand -hex 32)/" .env
Verify it changed:
grep BETTER_AUTH_SECRET .env

Reload and restart:
export $(grep -v '^#' .env | xargs)
pm2 delete chartvolt-api 2>/dev/null
pm2 start api-server/dist/index.js --name chartvolt-api
pm2 save
pm2 status

# Save PM2 configuration
pm2 save

# View status
pm2 status
```

### 8. SSL Certificate (Let's Encrypt)

```bash
# After DNS is propagated (chartvolt.com → 148.230.124.57)
sudo certbot --nginx -d chartvolt.com -d www.chartvolt.com -d admin.chartvolt.com

# Auto-renewal is configured automatically
# Test renewal with:
sudo certbot renew --dry-run
```

----------MongoDB Atlas IP Whitelist Issue!-------
Go to MongoDB Atlas
Select your cluster (Cluster0)
SECURITY section → Database & Network Access
Click on "Database & Network Access" - that's where you add the IP whitelist!
Select the "Network Access" tab (or "IP Access List")
Click "+ Add IP Address"
Enter: 148.230.124.57 (your VPS IP)
Click Confirm
## Management Commands

### PM2 Commands

admin not log in -------------
Quick Fix - Create Symlink:
ln -sf /var/www/chartvolt/.env /var/www/chartvolt/apps/admin/.env
Then restart:
pm2 restart chartvolt-admin

Or Copy the .env:
cp /var/www/chartvolt/.env /var/www/chartvolt/apps/admin/.env
pm2 restart chartvolt-admin
-------
this is to update the server with latest git for admin
cd /var/www/chartvolt
git pull origin main
npm run build:admin
pm2 restart chartvolt-admin


----------------------this is to update the server with latest git for worker

cd /var/www/chartvolt 
git pull origin main
npm run worker:build
pm2 restart chartvolt-worker
pm2 logs chartvolt-worker --lines 50

```bash
# View all apps status
pm2 status

# View logs
pm2 logs                    # All logs
pm2 logs chartvolt-web      # User app only
pm2 logs chartvolt-admin    # Admin app only
pm2 logs chartvolt-worker   # Worker only

# Restart apps
pm2 restart all             # Restart all
pm2 restart chartvolt-web   # Restart specific app

# Monitor resources
pm2 monit

# Stop all
pm2 stop all
```

### Deployment Updates

```bash
# Quick deploy
./deploy/deploy.sh

# Or manually:
git pull origin main
npm run build:all
pm2 reload ecosystem.config.js
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload without downtime
sudo systemctl reload nginx

# View access logs
tail -f /var/log/nginx/chartvolt-access.log

# View error logs
tail -f /var/log/nginx/chartvolt-error.log
```

## Monitoring

### Check App Health

```bash
# User app (local)
curl http://localhost:3000/health

# Admin app (local)
curl http://localhost:3001/health

# API server (local)
curl http://localhost:4000/api/health

# External (after SSL setup)
curl https://chartvolt.com/health
curl https://admin.chartvolt.com/health
```

### Resource Usage

```bash
# PM2 monitoring dashboard
pm2 monit

# System resources
htop

# Disk usage
df -h

# Memory usage
free -m
```

## Troubleshooting

### App Not Starting

```bash
# Check PM2 logs
pm2 logs chartvolt-web --lines 100

# Check if port is in use
lsof -i :3000
lsof -i :3001

# Restart app
pm2 restart chartvolt-web
```

### NGINX 502 Bad Gateway

```bash
# Check if apps are running
pm2 status

# Check nginx error log
tail -100 /var/log/nginx/chartvolt-error.log

# Verify upstream
curl http://127.0.0.1:3000
```

### Database Connection Issues

```bash
# Test connection manually
node -e "require('mongoose').connect('your-mongodb-uri').then(() => console.log('OK'))"

# Check worker logs
pm2 logs chartvolt-worker
```

### SSL Certificate Issues

```bash
# Renew certificates
sudo certbot renew --dry-run

# Check certificate status
sudo certbot certificates
```

## Backup

### MongoDB

MongoDB Atlas provides automatic backups. For self-hosted:

```bash
# Backup
mongodump --uri="your-mongodb-uri" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="your-mongodb-uri" /backup/20231218
```

### PM2 Configuration

```bash
# Already saved with:
pm2 save

# To restore:
pm2 resurrect
```

## Scaling

### Vertical Scaling

Upgrade Hostinger VPS plan for more resources.

### Horizontal Scaling

1. Increase PM2 instances:
```javascript
// ecosystem.config.js
{
  name: 'chartvolt-web',
  instances: 2, // or 'max' for all CPUs
  exec_mode: 'cluster',
}
```

2. Load balancer with multiple servers (advanced)

## Security Checklist

- [ ] SSH key authentication enabled
- [ ] Password authentication disabled
- [ ] UFW firewall configured
- [ ] Fail2ban installed (optional)
- [ ] SSL/TLS enabled
- [ ] Admin subdomain rate-limited
- [ ] Environment variables secured
- [ ] Regular security updates

