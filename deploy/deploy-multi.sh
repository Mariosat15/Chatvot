#!/bin/bash
# ============================================
# CHARTVOLT MULTI-VPS DEPLOYMENT SCRIPT
# ============================================
# 
# Deploys to multiple VPS servers with zero downtime.
# Uses rolling updates - deploys to VPS 2 first, verifies, then VPS 1.
#
# Usage:
#   chmod +x deploy-multi.sh
#   ./deploy-multi.sh
#
# Configuration:
#   Edit the VPS_SERVERS array below with your server IPs
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# CONFIGURATION - EDIT THESE
# ============================================

# SSH user for deployment
SSH_USER="root"

# List of VPS servers (deploy in reverse order for safety)
# VPS 2 first (new), then VPS 1 (main) - rolling update
VPS_SERVERS=(
  "YOUR_VPS2_IP"  # Deploy first (can fail without affecting users)
  "YOUR_VPS1_IP"  # Deploy last (main server)
)

# App directory on servers
APP_DIR="/var/www/chartvolt"

# Health check endpoint
HEALTH_ENDPOINT="/api/health"

# Health check timeout (seconds)
HEALTH_TIMEOUT=30

# ============================================
# FUNCTIONS
# ============================================

check_health() {
  local server=$1
  local url="http://${server}${HEALTH_ENDPOINT}"
  
  echo -e "${BLUE}🔍 Checking health: ${url}${NC}"
  
  for i in $(seq 1 $HEALTH_TIMEOUT); do
    if curl -sf "${url}" > /dev/null 2>&1; then
      echo -e "${GREEN}✅ Server ${server} is healthy${NC}"
      return 0
    fi
    sleep 1
  done
  
  echo -e "${RED}❌ Server ${server} health check failed${NC}"
  return 1
}

deploy_to_server() {
  local server=$1
  
  echo ""
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  Deploying to: ${server}${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  # Execute deployment commands via SSH
  ssh -o StrictHostKeyChecking=no "${SSH_USER}@${server}" << 'DEPLOY_SCRIPT'
    set -e
    
    cd /var/www/chartvolt
    
    echo "📥 Pulling latest code..."
    git pull origin main
    
    echo "📁 Ensuring logs directory exists..."
    mkdir -p logs
    
    echo "📦 Installing main app dependencies..."
    npm install
    
    echo "📦 Installing admin dependencies..."
    cd apps/admin && npm install && cd ../..
    
    echo "📦 Installing API server dependencies..."
    cd api-server && npm install && cd ..
    
    echo "🔨 Building main app..."
    npm run build
    
    echo "🔨 Building admin app..."
    npm run build:admin
    
    echo "🔨 Building API server..."
    npm run build:api
    
    echo "🔨 Building worker..."
    npm run worker:build
    
    echo "🔄 Reloading PM2..."
    pm2 reload ecosystem.config.js
    
    echo "📊 Status:"
    pm2 status
DEPLOY_SCRIPT

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment to ${server} successful${NC}"
    return 0
  else
    echo -e "${RED}❌ Deployment to ${server} failed${NC}"
    return 1
  fi
}

# ============================================
# MAIN DEPLOYMENT
# ============================================

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       CHARTVOLT MULTI-VPS DEPLOYMENT                     ║"
echo "║       Zero-Downtime Rolling Update                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if servers are configured
if [ "${VPS_SERVERS[0]}" == "YOUR_VPS2_IP" ]; then
  echo -e "${RED}❌ Error: VPS servers not configured!${NC}"
  echo ""
  echo "Edit this script and set your VPS IPs in the VPS_SERVERS array."
  echo ""
  exit 1
fi

echo -e "${BLUE}📋 Deployment plan:${NC}"
for i in "${!VPS_SERVERS[@]}"; do
  echo "   $((i+1)). ${VPS_SERVERS[$i]}"
done
echo ""

# Confirm deployment
read -p "Proceed with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# Deploy to each server in order
FAILED_SERVERS=()
for server in "${VPS_SERVERS[@]}"; do
  if deploy_to_server "$server"; then
    # Wait for server to be ready
    sleep 5
    
    # Health check
    if ! check_health "$server"; then
      echo -e "${RED}⚠️ Server ${server} failed health check after deployment${NC}"
      FAILED_SERVERS+=("$server")
      
      # If this is not the first server, we can continue
      # If this is the first server, abort to prevent breaking all servers
      if [ "$server" == "${VPS_SERVERS[0]}" ]; then
        echo -e "${YELLOW}⚠️ First server failed, but continuing to main server...${NC}"
      fi
    fi
  else
    FAILED_SERVERS+=("$server")
    echo -e "${YELLOW}⚠️ Deployment to ${server} failed, continuing...${NC}"
  fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       DEPLOYMENT COMPLETE                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ ${#FAILED_SERVERS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ All servers deployed successfully!${NC}"
else
  echo -e "${YELLOW}⚠️ Some servers had issues:${NC}"
  for server in "${FAILED_SERVERS[@]}"; do
    echo -e "   ${RED}• ${server}${NC}"
  done
fi

echo ""
echo "View logs on each server:"
for server in "${VPS_SERVERS[@]}"; do
  echo "  ssh ${SSH_USER}@${server} 'pm2 logs'"
done
echo ""

