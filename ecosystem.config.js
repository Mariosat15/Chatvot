/**
 * PM2 Ecosystem Configuration
 * 
 * Used for deploying to Hostinger VPS or any server.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

// Load environment variables from .env file
require('dotenv').config();

// Admin app heap: set ADMIN_HEAP_MB in .env (e.g. 8192 for 8 GB). Default 4096.
const ADMIN_HEAP_MB = Math.max(1024, parseInt(process.env.ADMIN_HEAP_MB || '4096', 10) || 4096);
const ADMIN_MAX_MEMORY_RESTART = `${Math.ceil(ADMIN_HEAP_MB / 1024)}G`;

// Multi-server support: IS_PRIMARY defaults to true (backward compatible)
// Set IS_PRIMARY=false in .env on secondary servers to skip the worker
const IS_PRIMARY = process.env.IS_PRIMARY !== 'false';

// PM2 cluster mode: set WEB_INSTANCES in .env to scale the web app (default 1)
const WEB_INSTANCES = Math.max(1, parseInt(process.env.WEB_INSTANCES || '1', 10) || 1);

// Worker config (only included on primary servers)
const workerApp = {
  name: 'chartvolt-worker',
  script: 'dist/worker/index.js',
  cwd: __dirname,
  env: {
    NODE_ENV: 'production',
    IS_WORKER: 'true',
  },
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  watch: false,
  max_memory_restart: '512M',
  error_file: './logs/worker-error.log',
  out_file: './logs/worker-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  kill_timeout: 10000,
};

module.exports = {
  apps: [
    // ============================================
    // MAIN USER APP
    // ============================================
    {
      name: 'chartvolt-web',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: WEB_INSTANCES,
      exec_mode: WEB_INSTANCES > 1 ? 'cluster' : 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },

    // ============================================
    // ADMIN APP (Separate Process)
    // ============================================
    {
      name: 'chartvolt-admin',
      script: 'npm',
      args: 'start',
      cwd: __dirname + '/apps/admin',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        IS_ADMIN: 'true',   // Prevents WebSocket connection - admin reads via API
        MAIN_APP_URL: 'http://localhost:3000',
        NODE_OPTIONS: `--max-old-space-size=${ADMIN_HEAP_MB}`,
        ADMIN_HEAP_MB: String(ADMIN_HEAP_MB),
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: ADMIN_MAX_MEMORY_RESTART,
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
    },

    // ============================================
    // BACKGROUND WORKER (only on primary server)
    // ============================================
    ...(IS_PRIMARY ? [workerApp] : []),

    // ============================================
    // API SERVER (Bcrypt Worker Threads)
    // Handles CPU-intensive auth operations
    // ============================================
    {
      name: 'chartvolt-api',
      script: 'api-server/dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        API_PORT: 4000,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
    },

    // ============================================
    // WEBSOCKET SERVER (Real-time Messaging)
    // Handles WebSocket connections for chat
    // ============================================
    {
      name: 'chartvolt-websocket',
      script: 'websocket-server/dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        WEBSOCKET_PORT: 3003,
        // Pass secrets from .env to websocket process
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        JWT_SECRET: process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET,
        AUTH_SECRET: process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET,
        MONGODB_URI: process.env.MONGODB_URI,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 10000, // Longer timeout to close connections gracefully
    },
  ],

  // ============================================
  // DEPLOYMENT CONFIGURATION
  // ============================================
  deploy: {
    production: {
      // SSH connection
      user: 'root',
      host: '148.230.124.57',
      ref: 'origin/main',
      repo: 'git@github.com:Mariosat15/Chatvot.git',
      path: '/var/www/chartvolt',
      
      // Commands to run after pulling code
      'post-deploy': `
        mkdir -p logs &&
        npm install &&
        cd apps/admin && npm install && cd ../.. &&
        cd api-server && npm install && cd .. &&
        cd websocket-server && npm install && npm run build && cd .. &&
        npm run build &&
        npm run build:admin &&
        npm run build:api &&
        npm run worker:build &&
        pm2 reload ecosystem.config.js --env production
      `.trim().replace(/\s+/g, ' '),
      
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};

