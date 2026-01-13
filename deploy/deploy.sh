#!/bin/bash
# ============================================
# CHARTVOLT DEPLOYMENT SCRIPT
# ============================================
# 
# Run this to deploy updates to the server.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           CHARTVOLT DEPLOYMENT                            ║"
echo "╚══════════════════════════════════════════════════════════╝"

cd /var/www/chartvolt

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Create logs directory if it doesn't exist
echo "📁 Ensuring logs directory exists..."
mkdir -p logs

# Install dependencies
echo "📦 Installing main app dependencies..."
npm install

# Install admin dependencies
echo "📦 Installing admin dependencies..."
cd apps/admin && npm install && cd ../..

# Install API server dependencies
echo "📦 Installing API server dependencies..."
cd api-server && npm install && cd ..

# Install WebSocket server dependencies
echo "📦 Installing WebSocket server dependencies..."
cd websocket-server && npm install && cd ..

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

# Check if current config has SSL (certbot added it)
if grep -q "listen 443" /etc/nginx/sites-available/chartvolt 2>/dev/null; then
  echo "🔒 SSL detected in nginx config - preserving certbot settings"
  echo "   Only updating client_max_body_size if needed..."
  
  # Check if admin block has client_max_body_size
  if ! grep -A20 "server_name admin.chartvolt.com" /etc/nginx/sites-available/chartvolt | grep -q "client_max_body_size"; then
    echo "📝 Adding client_max_body_size to admin server block..."
    # Use sed to add client_max_body_size after admin server_name line
    sudo sed -i '/server_name admin.chartvolt.com/a\    client_max_body_size 10M;' /etc/nginx/sites-available/chartvolt
    
    echo "🔍 Testing nginx config..."
    if sudo nginx -t; then
      echo "✅ Nginx config valid, reloading..."
      sudo systemctl reload nginx
    else
      echo "❌ Nginx config invalid after modification!"
      echo "   Please check /etc/nginx/sites-available/chartvolt manually."
    fi
  else
    echo "✅ client_max_body_size already configured"
  fi
else
  # No SSL - safe to copy our base config
  echo "📝 No SSL detected, copying base nginx config..."
  sudo cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt
  
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

# Reload PM2
echo "🔄 Reloading PM2 apps..."
pm2 reload ecosystem.config.js

# Check status
echo "📊 Current status:"
pm2 status

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

