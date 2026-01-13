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

# Update nginx config if changed
echo "🌐 Checking nginx configuration..."
if ! diff -q deploy/nginx.conf /etc/nginx/sites-available/chartvolt > /dev/null 2>&1; then
  echo "📝 Nginx config has changed, updating..."
  sudo cp deploy/nginx.conf /etc/nginx/sites-available/chartvolt
  
  echo "🔍 Testing nginx config..."
  if sudo nginx -t; then
    echo "✅ Nginx config valid, reloading..."
    sudo systemctl reload nginx
  else
    echo "❌ Nginx config invalid! Not reloading."
    echo "   Please check deploy/nginx.conf for errors."
  fi
else
  echo "✅ Nginx config unchanged"
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

