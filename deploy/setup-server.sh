#!/bin/bash
# ============================================
# CHARTVOLT SERVER SETUP SCRIPT
# ============================================
# 
# Run this on a fresh Hostinger VPS to set up the complete environment.
#
# Usage:
#   chmod +x setup-server.sh
#   sudo ./setup-server.sh
#

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           CHARTVOLT SERVER SETUP                         ║"
echo "╚══════════════════════════════════════════════════════════╝"

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js (v20 LTS)
echo "📦 Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node installation
echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install NGINX
echo "📦 Installing NGINX..."
apt install -y nginx

# Install Certbot for SSL
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /var/www/chartvolt
mkdir -p /var/www/chartvolt/logs

# Set ownership (use SUDO_USER if running with sudo, otherwise current user)
DEPLOY_USER="${SUDO_USER:-$USER}"
echo "📁 Setting ownership to user: $DEPLOY_USER"
chown -R $DEPLOY_USER:$DEPLOY_USER /var/www/chartvolt

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

# Enable and start NGINX
echo "🚀 Starting NGINX..."
systemctl enable nginx
systemctl start nginx

# Setup PM2 to start on boot
echo "🚀 Setting up PM2 startup..."
pm2 startup systemd -u root --hp /root

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           SETUP COMPLETE!                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Clone your repository to /var/www/chartvolt"
echo "2. Create .env file with your environment variables"
echo "3. Install dependencies:"
echo "   npm install"
echo "   cd apps/admin && npm install && cd ../.."
echo "   cd api-server && npm install && cd .."
echo "   cd websocket-server && npm install && cd .."
echo "4. Build all apps:"
echo "   npm run build && npm run build:admin && npm run build:api"
echo "   npm run worker:build"
echo "   cd websocket-server && npm run build && cd .."
echo "5. Copy nginx.conf to /etc/nginx/sites-available/chartvolt"
echo "6. Enable site: ln -s /etc/nginx/sites-available/chartvolt /etc/nginx/sites-enabled/"
echo "7. Test nginx: nginx -t"
echo "8. Reload nginx: systemctl reload nginx"
echo "9. Start apps: pm2 start ecosystem.config.js"
echo "10. Save PM2: pm2 save"
echo ""
echo "Services that will run:"
echo "  - chartvolt-web (port 3000) - Main user app"
echo "  - chartvolt-admin (port 3001) - Admin dashboard"
echo "  - chartvolt-api (port 4000) - API server"
echo "  - chartvolt-websocket (port 3003) - WebSocket server"
echo "  - chartvolt-worker - Background worker"
echo ""
echo "For SSL (after DNS is configured):"
echo "sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com"

