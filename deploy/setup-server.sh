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
chown -R $USER:$USER /var/www/chartvolt

# Create logs directory
mkdir -p /var/www/chartvolt/logs

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
echo "3. Run: npm install"
echo "4. Run: npm run build:all"
echo "5. Copy nginx.conf to /etc/nginx/sites-available/chartvolt"
echo "6. Enable site: ln -s /etc/nginx/sites-available/chartvolt /etc/nginx/sites-enabled/"
echo "7. Test nginx: nginx -t"
echo "8. Reload nginx: systemctl reload nginx"
echo "9. Start apps: pm2 start ecosystem.config.js"
echo "10. Save PM2: pm2 save"
echo ""
echo "For SSL (after DNS is configured):"
echo "sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com"

