#!/bin/bash
# ============================================
# CHARTVOLT WHITE LABEL SETUP SCRIPT
# ============================================
# 
# Run this script to set up Chartvolt for a new white label customer.
# This is a complete setup including server, code, and database.
#
# Usage:
#   chmod +x setup-new-customer.sh
#   sudo ./setup-new-customer.sh
#
# Prerequisites:
#   - Fresh Ubuntu/Debian server
#   - Root or sudo access
#   - .env file prepared with customer's settings
#

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     CHARTVOLT WHITE LABEL SETUP                          ║"
echo "║     Complete installation for new customer               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root (use sudo)"
  exit 1
fi

# ============================================
# STEP 1: Server Setup
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 1: SERVER SETUP                                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if setup-server.sh exists in current directory
if [ -f "./setup-server.sh" ]; then
  ./setup-server.sh
else
  # Run inline server setup
  echo "📦 Updating system packages..."
  apt update && apt upgrade -y

  echo "📦 Installing Node.js v20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs

  echo "✅ Node.js version: $(node -v)"
  echo "✅ npm version: $(npm -v)"

  echo "📦 Installing PM2..."
  npm install -g pm2

  echo "📦 Installing NGINX..."
  apt install -y nginx

  echo "📦 Installing Certbot..."
  apt install -y certbot python3-certbot-nginx

  echo "📁 Creating app directory..."
  mkdir -p /var/www/chartvolt
  mkdir -p /var/www/chartvolt/logs

  DEPLOY_USER="${SUDO_USER:-$USER}"
  echo "📁 Setting ownership to user: $DEPLOY_USER"
  chown -R $DEPLOY_USER:$DEPLOY_USER /var/www/chartvolt

  echo "🔒 Configuring firewall..."
  ufw allow 'Nginx Full'
  ufw allow OpenSSH
  ufw --force enable

  echo "🚀 Starting NGINX..."
  systemctl enable nginx
  systemctl start nginx

  echo "🚀 Setting up PM2 startup..."
  pm2 startup systemd -u root --hp /root
fi

echo ""
echo "✅ Server setup complete!"
echo ""

# ============================================
# STEP 2: Clone Repository
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 2: CLONE REPOSITORY                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd /var/www/chartvolt

# Check if repo already exists
if [ -d ".git" ]; then
  echo "📥 Repository exists, pulling latest..."
  git pull origin main
else
  echo "📥 Cloning repository..."
  read -p "Enter Git repository URL: " REPO_URL
  git clone "$REPO_URL" .
fi

echo ""
echo "✅ Repository ready!"
echo ""

# ============================================
# STEP 3: Environment Configuration
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 3: ENVIRONMENT CONFIGURATION                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
  echo "⚠️  No .env file found!"
  echo ""
  echo "Please create .env with the following required variables:"
  echo ""
  echo "  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname"
  echo "  MASSIVE_API_KEY=your_massive_api_key"
  echo "  AUTH_SECRET=your_secret_key_min_32_chars"
  echo "  NEXTAUTH_URL=https://yourdomain.com"
  echo ""
  read -p "Press Enter after creating .env file..."
  
  if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
    echo "❌ .env file still not found. Exiting."
    exit 1
  fi
fi

echo "✅ Environment file found!"
echo ""

# ============================================
# STEP 4: Install Dependencies & Build
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 4: INSTALL DEPENDENCIES & BUILD                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "📦 Installing main app dependencies..."
npm install

echo "📦 Installing admin dependencies..."
cd apps/admin && npm install && cd ../..

echo "📦 Installing API server dependencies..."
cd api-server && npm install && cd ..

echo "📦 Installing WebSocket server dependencies..."
cd websocket-server && npm install && cd ..

echo "🔨 Building main app..."
npm run build

echo "🔨 Building admin app..."
npm run build:admin

echo "🔨 Building API server..."
npm run build:api

echo "🔨 Building WebSocket server..."
cd websocket-server && npm run build && cd ..

echo "🔨 Building worker..."
npm run worker:build

echo ""
echo "✅ Build complete!"
echo ""

# ============================================
# STEP 5: Database Setup
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 5: DATABASE SETUP                                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "🗄️  Setting up database (creating indexes, seeding data)..."
node scripts/setup-database.js

if [ $? -ne 0 ]; then
  echo "❌ Database setup failed!"
  exit 1
fi

echo ""
echo "✅ Database setup complete!"
echo ""

# ============================================
# STEP 6: NGINX Configuration
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 6: NGINX CONFIGURATION                              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "📝 Copying nginx config..."
cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt

# Create symlink if doesn't exist
if [ ! -L "/etc/nginx/sites-enabled/chartvolt" ]; then
  ln -s /etc/nginx/sites-available/chartvolt /etc/nginx/sites-enabled/
fi

# Remove default site if exists
if [ -L "/etc/nginx/sites-enabled/default" ]; then
  rm /etc/nginx/sites-enabled/default
fi

echo "🔍 Testing nginx config..."
nginx -t

echo "🔄 Reloading nginx..."
systemctl reload nginx

echo ""
echo "✅ NGINX configured!"
echo ""

# ============================================
# STEP 7: Start Services
# ============================================

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  STEP 7: START SERVICES                                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "🚀 Starting PM2 services..."
pm2 start ecosystem.config.js

echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "📊 Service status:"
pm2 status

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     SETUP COMPLETE! 🎉                                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Your Chartvolt instance is now running!"
echo ""
echo "Next steps:"
echo "  1. Update DNS to point to this server's IP"
echo "  2. Run SSL setup: sudo certbot --nginx -d yourdomain.com"
echo "  3. Test: curl http://localhost:3000/health"
echo ""
echo "View logs:"
echo "  pm2 logs"
echo ""
echo "Manage services:"
echo "  pm2 status       # View status"
echo "  pm2 restart all  # Restart all services"
echo "  pm2 stop all     # Stop all services"
echo ""
