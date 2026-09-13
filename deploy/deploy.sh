#!/bin/bash
# ============================================
# CHARTVOLT DEPLOYMENT SCRIPT
# ============================================
# 
# Run this to deploy updates to the server.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh              # Normal deployment (update existing)
#   ./deploy.sh --new        # New customer setup (includes DB setup)
#   ./deploy.sh --db-only    # Only run database setup
#
# Options:
#   --new       Initialize database for new white label customer
#   --db-only   Only run database setup, skip code deployment
#   --force-db  Force re-seed database data (use with caution!)
#

set -e

# Parse arguments
NEW_INSTALL=false
DB_ONLY=false
FORCE_DB=""

for arg in "$@"; do
  case $arg in
    --new)
      NEW_INSTALL=true
      ;;
    --db-only)
      DB_ONLY=true
      ;;
    --force-db)
      FORCE_DB="--force"
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           CHARTVOLT DEPLOYMENT                            ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ "$NEW_INSTALL" = true ]; then
  echo "🆕 Mode: NEW CUSTOMER SETUP"
elif [ "$DB_ONLY" = true ]; then
  echo "🗄️  Mode: DATABASE ONLY"
else
  echo "🔄 Mode: UPDATE EXISTING"
fi
echo ""

cd /var/www/chartvolt

# Skip code deployment if --db-only
if [ "$DB_ONLY" = false ]; then

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Create logs directory if it doesn't exist
echo "📁 Ensuring logs directory exists..."
mkdir -p logs

# Ensure admin .env symlink exists
if [ ! -L "apps/admin/.env" ]; then
  echo "🔗 Creating .env symlink for admin app..."
  ln -sf /var/www/chartvolt/.env /var/www/chartvolt/apps/admin/.env
fi

# Install dependencies
#
# Reason: --no-audit --no-fund is worth ~13 minutes of a deploy. Even when every package
# is already up to date, `npm install` still calls the registry for advisory and funding
# metadata, and npmjs has begun retiring the endpoint npm uses for it - the tell in the
# log is "npm notice This endpoint is being retired". When that call is throttled it
# stalls for minutes per project and reports nothing useful. Measured 4 Sep 2026 on a
# tree with no dependency changes at all: root 15s (bulk endpoint, succeeded), apps/admin
# 6m and api-server 7m (old endpoint, stalled).
#
# This does not reduce security cover. Auditing during a production deploy is the wrong
# place for it anyway - the answer arrives after the code is already live and nobody
# reads it. Run `npm audit` deliberately instead, or in CI where it can block a merge.
#
# --prefer-offline uses the local cache for anything already downloaded and only hits the
# network for genuinely missing packages, which is the common case on a redeploy.
NPM_FLAGS="--no-audit --no-fund --prefer-offline"

echo "📦 Installing main app dependencies..."
npm install $NPM_FLAGS

# Install admin dependencies
echo "📦 Installing admin dependencies..."
cd apps/admin && npm install $NPM_FLAGS && cd ../..

# Install API server dependencies
echo "📦 Installing API server dependencies..."
cd api-server && npm install $NPM_FLAGS && cd ..

# Install WebSocket server dependencies
echo "📦 Installing WebSocket server dependencies..."
cd websocket-server && npm install $NPM_FLAGS && cd ..

# Build all apps
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

# Update nginx config (smart - preserves SSL)
echo "🌐 Checking nginx configuration..."

NGINX_CONF="/etc/nginx/sites-available/chartvolt"
NGINX_CHANGED=false

# Check if current config has SSL (certbot added it)
if grep -q "listen 443" "$NGINX_CONF" 2>/dev/null; then
  echo "🔒 SSL detected in nginx config - preserving certbot settings"
  echo "   Checking for missing directives..."

  # Reason: Back up the live nginx config before modifying so we can restore on failure.
  # The old code ran `git checkout deploy/nginx.conf` which reverted the repo template,
  # not the live /etc/nginx config.
  cp "$NGINX_CONF" "${NGINX_CONF}.bak"
  
  # Check if admin block has client_max_body_size
  if ! grep -A20 "server_name admin" "$NGINX_CONF" | grep -q "client_max_body_size"; then
    echo "📝 Adding client_max_body_size to admin server block..."
    sudo sed -i '/server_name admin/a\    client_max_body_size 10M;' "$NGINX_CONF"
    NGINX_CHANGED=true
  else
    echo "  ✅ client_max_body_size already configured"
  fi
  
  # Check if AI timeout block exists (needed for OpenAI calls >60s)
  if ! grep -q "location /api/ai/" "$NGINX_CONF" 2>/dev/null; then
    echo "📝 Adding AI route timeout blocks (proxy_read_timeout 180s)..."
    sudo sed -i '/# Root - proxy to admin app/i\
    # AI routes need longer timeout (OpenAI calls can take 30-120s)\
    location /api/ai/ {\
        proxy_pass http://admin_app;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_read_timeout 180;\
        proxy_send_timeout 180;\
        proxy_connect_timeout 30;\
    }\
\
    # Badge evaluation trigger also needs longer timeout\
    location /api/trigger-badge-evaluation {\
        proxy_pass http://admin_app;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_read_timeout 180;\
        proxy_send_timeout 180;\
    }\
' "$NGINX_CONF"
    NGINX_CHANGED=true
  else
    echo "  ✅ AI timeout blocks already configured"
  fi
  
  # Check if admin root location has proxy_read_timeout
  if ! grep -A10 "# Root - proxy to admin app" "$NGINX_CONF" | grep -q "proxy_read_timeout"; then
    echo "📝 Adding proxy_read_timeout to admin root location..."
    sudo sed -i '/# Root - proxy to admin app/,/}/ s/proxy_cache_bypass \$http_upgrade;/proxy_cache_bypass $http_upgrade;\n        proxy_read_timeout 120;/' "$NGINX_CONF"
    NGINX_CHANGED=true
  else
    echo "  ✅ Admin root proxy_read_timeout already configured"
  fi
  
  # Reload nginx if changes were made
  if [ "$NGINX_CHANGED" = true ]; then
    echo "🔍 Testing nginx config..."
    if sudo nginx -t; then
      echo "✅ Nginx config valid, reloading..."
      sudo systemctl reload nginx
    else
      echo "❌ Nginx config invalid after modification!"
      echo "   Restoring previous nginx config..."
      cp "${NGINX_CONF}.bak" "$NGINX_CONF"
      sudo nginx -t && sudo systemctl reload nginx
    fi
    rm -f "${NGINX_CONF}.bak"
  else
    rm -f "${NGINX_CONF}.bak"
    echo "  ✅ All nginx directives already up to date"
  fi
else
  # No SSL - safe to copy our base config (includes AI timeouts)
  echo "📝 No SSL detected, copying base nginx config..."
  sudo cp deploy/nginx.conf "$NGINX_CONF"
  
  echo "🔍 Testing nginx config..."
  if sudo nginx -t; then
    echo "✅ Nginx config valid, reloading..."
    sudo systemctl reload nginx
    echo "⚠️  Note: Run 'sudo certbot --nginx' to enable SSL"
  else
    echo "❌ Nginx config invalid! Not reloading."
    echo "   Please check deploy/nginx.conf for errors."
  fi
fi

fi  # End of skip for --db-only

# ============================================
# DATABASE SETUP (for new installations)
# ============================================

if [ "$NEW_INSTALL" = true ] || [ "$DB_ONLY" = true ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║           DATABASE SETUP                                  ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  
  # Check if .env exists
  if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
    echo "❌ ERROR: No .env or .env.local file found!"
    echo "   Please create one with MONGODB_URI before running database setup."
    exit 1
  fi
  
  echo "🗄️  Running database setup..."
  node scripts/setup-database.js $FORCE_DB
  
  if [ $? -ne 0 ]; then
    echo "❌ Database setup failed!"
    exit 1
  fi
  
  echo "✅ Database setup complete!"
fi

# Skip PM2 reload if --db-only
if [ "$DB_ONLY" = false ]; then
# Reload PM2
  echo ""
echo "🔄 Reloading PM2 apps..."
pm2 reload ecosystem.config.js

# Check status
  echo ""
echo "📊 Current status:"
pm2 status

# ============================================
# REDIS HEALTH CHECK
# ============================================
echo ""
echo "🔍 Checking Redis status..."
if systemctl is-active --quiet redis-server 2>/dev/null; then
  REDIS_STATUS="✅ Redis: running"
  # Try to ping (will fail without password, but that's fine - just checking the service)
  if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    REDIS_STATUS="✅ Redis: running (no auth)"
  elif redis-cli -a "$(grep -oP 'requirepass \K.*' /etc/redis/redis.conf 2>/dev/null)" ping 2>/dev/null | grep -q "PONG"; then
    REDIS_STATUS="✅ Redis: running (authenticated)"
  fi
else
  REDIS_STATUS="⚠️  Redis: not running (check: systemctl status redis-server)"
fi
echo "$REDIS_STATUS"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           DEPLOYMENT COMPLETE!                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "View logs:"
echo "  pm2 logs chartvolt-web"
echo "  pm2 logs chartvolt-admin"
echo "  pm2 logs chartvolt-api"
echo "  pm2 logs chartvolt-websocket"
echo "  pm2 logs chartvolt-worker"
echo ""
echo "Health checks:"
echo "  curl http://localhost:3000/health    # User app"
echo "  curl http://localhost:3001/health    # Admin app"
echo "  curl http://localhost:4000/api/health # API server"
echo "  curl http://localhost:3003/health    # WebSocket server"
echo "  redis-cli ping                       # Redis"
