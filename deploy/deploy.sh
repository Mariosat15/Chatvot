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

# Build all apps
echo "🔨 Building main app..."
npm run build

echo "🔨 Building admin app..."
npm run build:admin

echo "🔨 Building API server..."
npm run build:api

echo "🔨 Building worker..."
npm run worker:build

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
echo "  pm2 logs chartvolt-worker"

