# Chartvolt Deployment Guide

Complete guide for deploying Chartvolt to production servers.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Single VPS Deployment](#single-vps-deployment)
3. [Multi-VPS Deployment (Scaling)](#multi-vps-deployment)
4. [SSL Setup](#ssl-setup)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Single VPS Setup
```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR VPS                                │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  PM2 Process Manager                                │   │
│   │  ├── chartvolt-web (Port 3000) - Next.js UI        │   │
│   │  ├── chartvolt-api (Port 4000) - API Server        │   │
│   │  ├── chartvolt-admin (Port 3001) - Admin Panel     │   │
│   │  └── chartvolt-worker - Background Jobs            │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Nginx Reverse Proxy                                │   │
│   │  ├── yourdomain.com → Port 3000 (UI + most API)    │   │
│   │  ├── yourdomain.com/api/auth/* → Port 4000 (bcrypt)│   │
│   │  └── admin.yourdomain.com → Port 3001              │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │    MongoDB Atlas        │
              └─────────────────────────┘
```

### Multi-VPS Setup (Future Scaling)
```
                ┌─────────────────────┐
                │   Cloudflare        │
                │   (Load Balancer)   │
                └──────────┬──────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  VPS 1   │    │  VPS 2   │    │  Redis   │
    │  (Apps)  │    │  (Apps)  │    │ (Upstash)│
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                ┌─────────────────────┐
                │    MongoDB Atlas    │
                └─────────────────────┘
```

---

## Single VPS Deployment

### Step 1: Prepare Your VPS

1. **Get a VPS from Hostinger** (or similar provider)
   - Recommended: KVM 2 or KVM 4 (4GB+ RAM, 2+ CPU cores)
   - OS: Ubuntu 22.04 LTS

2. **SSH into your server**
   ```bash
   ssh root@YOUR_VPS_IP
   ```

3. **Run the setup script**
   ```bash
   # Download and run setup script
   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-server.sh | sudo bash
   ```

   Or manually:
   ```bash
   # Clone repo first, then run setup
   cd /var/www
   git clone https://github.com/YOUR_USERNAME/chartvolt.git
   cd chartvolt
   chmod +x deploy/setup-server.sh
   sudo ./deploy/setup-server.sh
   ```

### Step 2: Configure Environment

1. **Create .env file**
   ```bash
   cd /var/www/chartvolt
   nano .env
   ```

2. **Add your environment variables**
   ```env
   # Database
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chartvolt

   # Auth
   BETTER_AUTH_SECRET=your-secret-key
   BETTER_AUTH_URL=https://yourdomain.com

   # App
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ADMIN_URL=https://admin.yourdomain.com

   # API Server
   API_PORT=4000

   # Optional: OpenAI for AI features
   OPENAI_API_KEY=sk-...
   OPENAI_ENABLED=true
   ```

### Step 3: Install Dependencies and Build

```bash
cd /var/www/chartvolt

# Install all dependencies
npm run setup

# Build all apps
npm run build:all
```

### Step 4: Configure Nginx

```bash
# STEP 1: Add rate limiting to main nginx.conf
sudo nano /etc/nginx/nginx.conf

# Add these lines inside the http {} block (before any server blocks):
# limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=1r/s;
# limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
# limit_req_status 429;

# STEP 2: Copy site config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt

# STEP 3: Edit domain names in the config
sudo nano /etc/nginx/sites-available/chartvolt
# Replace chartvolt.com with your domain

# STEP 4: Enable the site
sudo ln -sf /etc/nginx/sites-available/chartvolt /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# STEP 5: Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Start the Apps

```bash
cd /var/www/chartvolt

# Start all apps with PM2
pm2 start ecosystem.config.js

# Save PM2 state (auto-restart on reboot)
pm2 save

# Check status
pm2 status
```

### Step 6: Verify Deployment

```bash
# Check if apps are running
pm2 status

# Check logs
pm2 logs chartvolt-web
pm2 logs chartvolt-api
pm2 logs chartvolt-admin
pm2 logs chartvolt-worker

# Test health endpoint
curl http://localhost:4000/api/health
```

---

## SSL Setup

After your DNS is configured (domain points to VPS IP):

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com
```

Certbot will automatically:
- Obtain SSL certificates
- Configure Nginx for HTTPS
- Set up auto-renewal

---

## Deploying Updates

### Single VPS

From your local machine:
```bash
# SSH into server and deploy
ssh root@YOUR_VPS_IP 'cd /var/www/chartvolt && ./deploy/deploy.sh'
```

Or from the server:
```bash
cd /var/www/chartvolt
./deploy/deploy.sh
```

### Multi-VPS (Rolling Update)

1. **Configure the script**
   ```bash
   nano deploy/deploy-multi.sh
   # Edit VPS_SERVERS array with your IPs
   ```

2. **Run deployment**
   ```bash
   ./deploy/deploy-multi.sh
   ```

The script will:
1. Deploy to VPS 2 first (can fail without affecting users)
2. Verify VPS 2 is healthy
3. Deploy to VPS 1 (main server)
4. Verify VPS 1 is healthy

---

## Multi-VPS Deployment

### When to Scale

Scale to 2+ VPS when:
- Consistent CPU usage > 80%
- Response times increasing
- 2000+ concurrent users

### Steps to Scale

1. **Set up VPS 2**
   ```bash
   # SSH into new VPS
   ssh root@VPS2_IP
   
   # Run setup script
   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-server.sh | sudo bash
   
   # Clone and configure
   cd /var/www
   git clone https://github.com/YOUR_USERNAME/chartvolt.git
   # Copy .env from VPS 1
   # Build and start apps
   ```

2. **Enable Redis (Upstash)**
   - Go to [upstash.com](https://upstash.com)
   - Create a Redis database
   - Copy credentials to Admin Panel → Dev Zone → Redis Cache

3. **Configure Cloudflare Load Balancing**
   - Add both VPS IPs to Cloudflare
   - Enable Load Balancing
   - Configure health checks

4. **Update deploy script**
   ```bash
   nano deploy/deploy-multi.sh
   # Add both VPS IPs
   ```

---

## Monitoring

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Status
pm2 status

# Logs
pm2 logs

# Specific app logs
pm2 logs chartvolt-api
```

### Check Server Health

```bash
# API health
curl http://localhost:4000/api/health

# Detailed health
curl http://localhost:4000/api/health/detailed
```

### Check Resource Usage

```bash
# CPU and memory
htop

# Disk usage
df -h

# PM2 metrics
pm2 show chartvolt-api
```

---

## Troubleshooting

### App Won't Start

```bash
# Check logs
pm2 logs chartvolt-web --lines 100

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :4000
sudo lsof -i :3001

# Restart all
pm2 restart all
```

### Nginx Issues

```bash
# Test config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/chartvolt-error.log

# Reload
sudo systemctl reload nginx
```

### Database Connection Issues

```bash
# Check if MongoDB URI is correct
cat .env | grep MONGODB

# Test connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Connected!')).catch(console.error)"
```

### Out of Memory

```bash
# Check memory
free -m

# Add swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `pm2 status` | Check app status |
| `pm2 logs` | View all logs |
| `pm2 restart all` | Restart all apps |
| `pm2 reload ecosystem.config.js` | Zero-downtime reload |
| `./deploy/deploy.sh` | Deploy updates |
| `nginx -t` | Test Nginx config |
| `systemctl reload nginx` | Reload Nginx |

---

## Support

- Check the logs first: `pm2 logs`
- Common issues are usually in Nginx config or .env file
- For database issues, check MongoDB Atlas dashboard

