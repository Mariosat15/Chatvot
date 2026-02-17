#!/bin/bash
# ============================================
# CHARTVOLT WHITE LABEL SETUP SCRIPT
# ============================================
#
# Complete automated setup for a new white-label customer.
# Run this on a fresh Hostinger VPS (Ubuntu/Debian).
#
# This script will:
#   1. Install all server software (Node.js, PM2, NGINX, Redis, Certbot)
#   2. Clone the repository
#   3. Generate .env automatically from your inputs
#   4. Install dependencies and build all apps
#   5. Set up the database
#   6. Configure NGINX with your domain (including rate limiting)
#   7. Start all services with PM2
#   8. Set up SSL certificates
#   9. Print a summary with all credentials
#
# Usage:
#   chmod +x deploy/setup-new-customer.sh
#   sudo ./deploy/setup-new-customer.sh
#
# Prerequisites:
#   - Fresh Ubuntu/Debian server (Hostinger VPS)
#   - Root or sudo access
#   - Domain name with DNS A records pointing to this server's IP
#   - MongoDB Atlas connection string ready
#   - Git repository URL ready
#

set -e

# ============================================
# COLORS
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  $1${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# ============================================
# PRE-FLIGHT CHECKS
# ============================================

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     CHARTVOLT WHITE LABEL SETUP                          ║${NC}"
echo -e "${BLUE}║     Complete automated installation                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
  print_error "This script must be run as root (use sudo)"
  exit 1
fi

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "Server IP: ${SERVER_IP}"
echo ""

# ============================================
# COLLECT INPUTS
# ============================================

print_header "COLLECTING CONFIGURATION"

echo "Please provide the following information:"
echo ""

# Domain
read -p "Main domain (e.g. myapp.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  print_error "Domain is required"
  exit 1
fi

# Admin subdomain prefix
read -p "Admin subdomain prefix [admin]: " ADMIN_PREFIX
ADMIN_PREFIX=${ADMIN_PREFIX:-admin}
ADMIN_DOMAIN="${ADMIN_PREFIX}.${DOMAIN}"

echo "  Admin domain will be: ${ADMIN_DOMAIN}"
echo ""

# Git repo
read -p "Git repository URL (HTTPS): " REPO_URL
if [ -z "$REPO_URL" ]; then
  print_error "Repository URL is required"
  exit 1
fi

# MongoDB
read -p "MongoDB connection string (mongodb+srv://...): " MONGODB_URI
if [ -z "$MONGODB_URI" ]; then
  print_error "MongoDB URI is required"
  exit 1
fi

# Admin credentials
read -p "Admin email: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
  print_error "Admin email is required"
  exit 1
fi

read -s -p "Admin password: " ADMIN_PASSWORD
echo ""
if [ -z "$ADMIN_PASSWORD" ]; then
  print_error "Admin password is required"
  exit 1
fi

echo ""
echo "Configuration summary:"
echo "  Domain:       https://${DOMAIN}"
echo "  Admin:        https://${ADMIN_DOMAIN}"
echo "  Repository:   ${REPO_URL}"
echo "  Admin email:  ${ADMIN_EMAIL}"
echo ""
read -p "Continue with these settings? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# Generate secrets
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
ADMIN_JWT_SECRET=$(openssl rand -hex 32)

# ============================================
# STEP 1: SERVER SETUP
# ============================================

print_header "STEP 1/10: SERVER SOFTWARE INSTALLATION"

echo "Updating system packages..."
apt update && apt upgrade -y

echo "Installing build-essential, git, curl..."
apt install -y build-essential git curl wget

echo "Installing Node.js v20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js $(node -v) installed"

echo "Installing PM2..."
npm install -g pm2
print_success "PM2 installed"

echo "Installing NGINX..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx
print_success "NGINX installed"

echo "Installing Certbot..."
apt install -y certbot python3-certbot-nginx
print_success "Certbot installed"

# ============================================
# STEP 2: INSTALL AND CONFIGURE REDIS
# ============================================

print_header "STEP 2/10: REDIS INSTALLATION"

apt install -y redis-server

REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
REDIS_CONF="/etc/redis/redis.conf"

cp "$REDIS_CONF" "${REDIS_CONF}.bak"

# Bind to localhost only
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

# Memory limit
if grep -q "^maxmemory " "$REDIS_CONF"; then
  sed -i 's/^maxmemory .*/maxmemory 8gb/' "$REDIS_CONF"
else
  echo "maxmemory 8gb" >> "$REDIS_CONF"
fi

# Eviction policy
if grep -q "^maxmemory-policy " "$REDIS_CONF"; then
  sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
else
  echo "maxmemory-policy allkeys-lru" >> "$REDIS_CONF"
fi

# Performance tuning
echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true

if [ ! -f /etc/rc.local ] || ! grep -q "transparent_hugepage" /etc/rc.local 2>/dev/null; then
  cat > /etc/rc.local << 'RCEOF'
#!/bin/bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
exit 0
RCEOF
  chmod +x /etc/rc.local
fi

if ! grep -q "net.core.somaxconn" /etc/sysctl.conf 2>/dev/null; then
  echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
fi
if ! grep -q "vm.overcommit_memory" /etc/sysctl.conf 2>/dev/null; then
  echo "vm.overcommit_memory = 1" >> /etc/sysctl.conf
fi
sysctl -p > /dev/null 2>&1 || true

systemctl enable redis-server
systemctl restart redis-server

if redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
  print_success "Redis installed and secured"
else
  print_warning "Redis may not have started correctly. Check: systemctl status redis-server"
fi

# ============================================
# STEP 3: FIREWALL
# ============================================

print_header "STEP 3/10: FIREWALL CONFIGURATION"

ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable
print_success "Firewall configured (HTTP, HTTPS, SSH)"

# ============================================
# STEP 4: CLONE REPOSITORY
# ============================================

print_header "STEP 4/10: CLONE REPOSITORY"

mkdir -p /var/www/chartvolt
cd /var/www/chartvolt

if [ -d ".git" ]; then
  echo "Repository exists, pulling latest..."
  git pull origin main
else
  echo "Cloning repository..."
  git clone "$REPO_URL" .
fi

mkdir -p logs
print_success "Repository ready"

# ============================================
# STEP 5: GENERATE .env FILE
# ============================================

print_header "STEP 5/10: GENERATE ENVIRONMENT FILE"

cat > /var/www/chartvolt/.env << ENVEOF
# ============================================
# CHARTVOLT ENVIRONMENT - Auto-generated
# Generated: $(date)
# Domain: ${DOMAIN}
# ============================================

# Node Environment
NODE_ENV=production

# App URLs
NEXT_PUBLIC_BASE_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
ADMIN_URL=https://${ADMIN_DOMAIN}

# MongoDB
MONGODB_URI=${MONGODB_URI}

# Authentication
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=https://${DOMAIN}

# Admin Panel
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}

# API Server
API_PORT=4000

# WebSocket Server
WEBSOCKET_PORT=3003
NEXT_PUBLIC_WEBSOCKET_URL=wss://${DOMAIN}/ws
WEBSOCKET_INTERNAL_URL=http://localhost:3003
ENVEOF

print_success ".env file generated"

# Create .env symlink for admin app
ln -sf /var/www/chartvolt/.env /var/www/chartvolt/apps/admin/.env
print_success ".env symlink created for admin app"

# ============================================
# STEP 6: INSTALL DEPENDENCIES & BUILD
# ============================================

print_header "STEP 6/10: INSTALL DEPENDENCIES & BUILD"

cd /var/www/chartvolt

echo "Installing main app dependencies..."
npm install

echo "Installing admin dependencies..."
cd apps/admin && npm install && cd ../..

echo "Installing API server dependencies..."
cd api-server && npm install && cd ..

echo "Installing WebSocket server dependencies..."
cd websocket-server && npm install && cd ..

echo "Building main app..."
npm run build

echo "Building admin app..."
npm run build:admin

echo "Building API server..."
npm run build:api

echo "Building WebSocket server..."
cd websocket-server && npm run build && cd ..

echo "Building worker..."
npm run worker:build

print_success "All apps built successfully"

# ============================================
# STEP 7: DATABASE SETUP
# ============================================

print_header "STEP 7/10: DATABASE SETUP"

cd /var/www/chartvolt

echo "Setting up database (creating indexes, seeding data)..."
node scripts/setup-database.js

if [ $? -ne 0 ]; then
  print_error "Database setup failed!"
  exit 1
fi

print_success "Database setup complete"

# ============================================
# STEP 8: NGINX CONFIGURATION
# ============================================

print_header "STEP 8/10: NGINX CONFIGURATION"

NGINX_SITE="/etc/nginx/sites-available/chartvolt"

# Copy template and replace domain placeholders
cp deploy/nginx.conf "$NGINX_SITE"
sed -i "s/ADMIN_DOMAIN_PLACEHOLDER/${ADMIN_DOMAIN}/g" "$NGINX_SITE"
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "$NGINX_SITE"

# Add rate limiting to main nginx.conf if not present
NGINX_MAIN="/etc/nginx/nginx.conf"
if ! grep -q "admin_limit" "$NGINX_MAIN" 2>/dev/null; then
  echo "Adding rate limiting zones to nginx.conf..."
  sed -i '/http {/a\
\n    # Rate limiting zones (added by setup script)\
    limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=1r/s;\
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;\
    limit_req_status 429;\n' "$NGINX_MAIN"
  print_success "Rate limiting added to nginx.conf"
else
  echo "Rate limiting already configured"
fi

# Create symlink if doesn't exist
if [ ! -L "/etc/nginx/sites-enabled/chartvolt" ]; then
  ln -s "$NGINX_SITE" /etc/nginx/sites-enabled/
fi

# Remove default site
if [ -L "/etc/nginx/sites-enabled/default" ]; then
  rm /etc/nginx/sites-enabled/default
fi

echo "Testing nginx configuration..."
if nginx -t; then
  systemctl reload nginx
  print_success "NGINX configured for ${DOMAIN} and ${ADMIN_DOMAIN}"
else
  print_error "NGINX config invalid! Please check ${NGINX_SITE}"
  exit 1
fi

# ============================================
# STEP 9: START SERVICES
# ============================================

print_header "STEP 9/10: START SERVICES"

cd /var/www/chartvolt

echo "Starting PM2 services..."
pm2 start ecosystem.config.js

echo "Saving PM2 configuration..."
pm2 save

echo "Setting up PM2 startup..."
pm2 startup systemd -u root --hp /root > /dev/null 2>&1

echo ""
echo "Service status:"
pm2 status

print_success "All services started"

# ============================================
# STEP 10: SSL CERTIFICATES
# ============================================

print_header "STEP 10/10: SSL CERTIFICATES"

echo "Attempting to obtain SSL certificates..."
echo "Make sure DNS A records point to this server (${SERVER_IP}):"
echo "  ${DOMAIN}       → ${SERVER_IP}"
echo "  www.${DOMAIN}   → ${SERVER_IP}"
echo "  ${ADMIN_DOMAIN} → ${SERVER_IP}"
echo ""

read -p "Are DNS records configured and propagated? (y/n): " DNS_READY
if [ "$DNS_READY" = "y" ] || [ "$DNS_READY" = "Y" ]; then
  certbot --nginx \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" \
    -d "${ADMIN_DOMAIN}" \
    --non-interactive \
    --agree-tos \
    --email "${ADMIN_EMAIL}" \
    --redirect \
    && print_success "SSL certificates installed" \
    || print_warning "SSL setup failed. Run manually later: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${ADMIN_DOMAIN}"
else
  print_warning "Skipping SSL. Run this after DNS propagation:"
  echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${ADMIN_DOMAIN}"
fi

# ============================================
# DONE - PRINT SUMMARY
# ============================================

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     SETUP COMPLETE!                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "============================================================"
echo "                    SAVE THESE CREDENTIALS"
echo "============================================================"
echo ""
echo "  App URL:         https://${DOMAIN}"
echo "  Admin URL:       https://${ADMIN_DOMAIN}"
echo "  Server IP:       ${SERVER_IP}"
echo ""
echo "  Admin Email:     ${ADMIN_EMAIL}"
echo "  Admin Password:  (the one you entered)"
echo ""
echo "  Redis Host:      127.0.0.1"
echo "  Redis Port:      6379"
echo "  Redis Password:  ${REDIS_PASSWORD}"
echo ""
echo "  Auth Secret:     ${BETTER_AUTH_SECRET}"
echo "  Admin JWT:       ${ADMIN_JWT_SECRET}"
echo ""
echo "============================================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "  1. Configure Redis in admin panel:"
echo "     Go to ${ADMIN_DOMAIN} > Settings > Redis"
echo "     Host: 127.0.0.1, Port: 6379, Password: (above)"
echo ""
echo "  2. Configure API keys in admin panel:"
echo "     Settings > Environment Variables"
echo "     - Massive API Key (forex data)"
echo "     - Gemini API Key (AI features)"
echo "     - Email settings (Nodemailer)"
echo ""
echo "  3. Configure payment provider (if needed):"
echo "     Settings > Payment Providers"
echo ""
echo "  4. If SSL was skipped, run after DNS propagation:"
echo "     sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} -d ${ADMIN_DOMAIN}"
echo ""
echo "  5. Add MongoDB Atlas IP whitelist:"
echo "     MongoDB Atlas > Network Access > Add IP: ${SERVER_IP}"
echo ""
echo "USEFUL COMMANDS:"
echo "  pm2 status          # View service status"
echo "  pm2 logs            # View all logs"
echo "  pm2 restart all     # Restart all services"
echo "  ./deploy/deploy.sh  # Deploy updates"
echo ""
