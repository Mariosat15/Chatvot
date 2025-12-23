# Chartvolt Deployment Guide

Complete guide for deploying Chartvolt to a Hostinger VPS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOSTINGER VPS                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NGINX (Reverse Proxy)                                   │  │
│  │  - chartvolt.com → User App (3000)                      │  │
│  │  - admin.chartvolt.com → Admin App (3001)               │  │
│  │  - SSL/TLS termination                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                  │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐          │
│  │  USER APP   │   │  ADMIN APP  │   │   WORKER    │          │
│  │  Port 3000  │   │  Port 3001  │   │  (No port)  │          │
│  │  PM2        │   │  PM2        │   │  PM2        │          │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   MongoDB   │                              │
│                    │  (Atlas)    │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Hostinger VPS (4GB RAM minimum recommended)
- Domain name configured with DNS pointing to VPS IP
- MongoDB Atlas account (or self-hosted MongoDB)

## Quick Start

### 1. Initial Server Setup

```bash
# Connect to your VPS
ssh root@your-server-ip

# Download and run setup script
curl -O https://raw.githubusercontent.com/your-repo/chartvolt/main/deploy/setup-server.sh
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
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://chartvolt.com

# Admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your-secure-password

# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
```

### 4. Install Dependencies

```bash
npm install
cd apps/admin && npm install && cd ../..
```

### 5. Build All Apps

```bash
npm run build:all
```

### 6. Configure NGINX

```bash
# STEP 1: Add rate limiting to main nginx.conf
sudo nano /etc/nginx/nginx.conf

# Add these lines inside the http {} block:
# limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=1r/s;
# limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
# limit_req_status 429;

# STEP 2: Copy site config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt

# STEP 3: Edit domain names
sudo nano /etc/nginx/sites-available/chartvolt
# Replace chartvolt.com with your actual domain

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

# Save PM2 configuration
pm2 save

# View status
pm2 status
```

### 8. SSL Certificate (Let's Encrypt)

```bash
# After DNS is propagated
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com

# Auto-renewal is configured automatically
```

## Management Commands

### PM2 Commands

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
# User app
curl http://localhost:3000/health

# Admin app
curl http://localhost:3001/health

# External (after domain setup)
curl https://yourdomain.com/health
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

