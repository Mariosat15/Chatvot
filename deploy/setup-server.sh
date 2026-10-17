#!/bin/bash
# ============================================
# CHARTVOLT SERVER SETUP SCRIPT
# ============================================
# 
# Run this on a fresh Hostinger VPS (Ubuntu/Debian) to install
# all required software: Node.js, PM2, NGINX, Certbot, Redis, etc.
#
# Usage:
#   chmod +x setup-server.sh
#   sudo ./setup-server.sh
#

set -e

echo "============================================================"
echo "           CHARTVOLT SERVER SETUP"
echo "============================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root (use sudo)"
  exit 1
fi

# ============================================
# STEP 1: System Update
# ============================================

echo "[1/8] Updating system packages..."
apt update && apt upgrade -y

# ============================================
# STEP 2: Install build tools
# ============================================

echo "[2/8] Installing build-essential (needed for native npm modules)..."
apt install -y build-essential git curl wget

# ============================================
# STEP 3: Install Node.js v20 LTS
# ============================================

echo "[3/8] Installing Node.js v20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "  Node.js version: $(node -v)"
echo "  npm version: $(npm -v)"

# ============================================
# STEP 4: Install PM2 globally
# ============================================

echo "[4/8] Installing PM2..."
npm install -g pm2

# ============================================
# STEP 5: Install NGINX
# ============================================

echo "[5/8] Installing NGINX..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# ============================================
# STEP 6: Install Certbot for SSL
# ============================================

echo "[6/8] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ============================================
# STEP 7: Install and Configure Redis
# ============================================

echo "[7/8] Installing and configuring Redis..."
apt install -y redis-server

# Generate a random Redis password
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

# Configure Redis
REDIS_CONF="/etc/redis/redis.conf"

# Backup original config
cp "$REDIS_CONF" "${REDIS_CONF}.bak"

# Ensure bind to localhost only
if grep -q "^bind " "$REDIS_CONF"; then
  sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$REDIS_CONF"
else
  echo "bind 127.0.0.1 ::1" >> "$REDIS_CONF"
fi

# Set password
if grep -q "^requirepass " "$REDIS_CONF"; then
  sed -i "s/^requirepass .*/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"
elif grep -q "^# requirepass " "$REDIS_CONF"; then
  sed -i "s/^# requirepass .*/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"
else
  echo "requirepass ${REDIS_PASSWORD}" >> "$REDIS_CONF"
fi

# Set memory limit (8GB - adjust based on VPS plan)
if grep -q "^maxmemory " "$REDIS_CONF"; then
  sed -i 's/^maxmemory .*/maxmemory 8gb/' "$REDIS_CONF"
else
  echo "maxmemory 8gb" >> "$REDIS_CONF"
fi

# Set eviction policy
if grep -q "^maxmemory-policy " "$REDIS_CONF"; then
  sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
else
  echo "maxmemory-policy allkeys-lru" >> "$REDIS_CONF"
fi

# Performance tuning: disable Transparent Huge Pages
echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true

# Make THP disable persistent across reboots
if [ ! -f /etc/rc.local ] || ! grep -q "transparent_hugepage" /etc/rc.local 2>/dev/null; then
  cat > /etc/rc.local << 'RCEOF'
#!/bin/bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
exit 0
RCEOF
  chmod +x /etc/rc.local
fi

# Increase connection limits
if ! grep -q "net.core.somaxconn" /etc/sysctl.conf 2>/dev/null; then
  echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
fi
if ! grep -q "vm.overcommit_memory" /etc/sysctl.conf 2>/dev/null; then
  echo "vm.overcommit_memory = 1" >> /etc/sysctl.conf
fi
sysctl -p > /dev/null 2>&1 || true

# Enable and restart Redis
systemctl enable redis-server
systemctl restart redis-server

# Verify Redis
if redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
  echo "  Redis is running and secured with password"
else
  echo "  WARNING: Redis may not have started correctly. Check with: systemctl status redis-server"
fi

# ============================================
# STEP 8: Create App Directory and Firewall
# ============================================

echo "[8/8] Setting up app directory and firewall..."

# Create app directory
mkdir -p /var/www/chartvolt
mkdir -p /var/www/chartvolt/logs

# Set ownership
DEPLOY_USER="${SUDO_USER:-$USER}"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" /var/www/chartvolt

# Configure firewall
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

# Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root > /dev/null 2>&1

# ============================================
# DONE
# ============================================

echo ""
echo "============================================================"
echo "           SERVER SETUP COMPLETE"
echo "============================================================"
echo ""
echo "Installed software:"
echo "  - Node.js $(node -v)"
echo "  - npm $(npm -v)"
echo "  - PM2 $(pm2 -v 2>/dev/null || echo 'installed')"
echo "  - NGINX $(nginx -v 2>&1 | cut -d'/' -f2)"
echo "  - Certbot $(certbot --version 2>&1 | head -1)"
echo "  - Redis $(redis-server --version | awk '{print $3}' | cut -d'=' -f2)"
echo ""
echo "Redis credentials (SAVE THIS):"
echo "  Host:     127.0.0.1"
echo "  Port:     6379"
echo "  Password: ${REDIS_PASSWORD}"
echo ""
echo "Next steps:"
echo "  1. Clone your repository to /var/www/chartvolt"
echo "  2. Create .env file with your environment variables"
echo "  3. Run: ./deploy/setup-new-customer.sh  (for full automated setup)"
echo "  4. Or follow the manual steps in deploy/README.md"
echo ""
