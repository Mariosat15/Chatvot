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

    // ============================================
    // CHARTVOLT GAMES (First-party Game Provider)
    // Serves the game catalogue, opens rounds, and
    // serves the board the player's iframe loads.
    // ============================================
    //
    // This is a PROVIDER, not part of the platform. It answers the same signed HTTP contract
    // an external games company would, which is the whole point of it existing (X4a) - so it
    // is deployed like a third party would be: its own process, its own database, its own
    // origin. `deploy/README.md` has the DNS and TLS steps.
    //
    // NOTHING FROM THE PLATFORM'S .env IS PASSED IN, AND THAT IS DELIBERATE. The websocket
    // entry above forwards MONGODB_URI because it reads the platform's data; this one must
    // not, because a provider with the platform's connection string is no longer a provider.
    // It reads its own `games-service/.env` via the cwd below, and its config module sets the
    // database name explicitly so even a mistyped URI cannot land its collections in the
    // platform's database.
    {
      name: 'chartvolt-games',
      script: 'dist/index.js',
      cwd: __dirname + '/games-service',
      env: {
        NODE_ENV: 'production',
        // The port only; every secret, the public origin and the frame-ancestors policy come
        // from games-service/.env. Listed there rather than here so a secret is never in a
        // file that is committed.
        PORT: 4010,
      },
      instances: 1,
      // Fork, never cluster. Round creation is idempotent on `roundId` at the database, so
      // cluster mode would be safe for that - but the callback sweeper is a singleton, and two
      // copies would race to deliver the same result and double the provider's retry traffic.
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: __dirname + '/logs/games-error.log',
      out_file: __dirname + '/logs/games-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 12s, just over the service's own 10s hard shutdown deadline. Reason: an in-flight
      // request may be a round creation whose response the platform is waiting for, and
      // killing it mid-write is how a round exists on one side and not the other.
      kill_timeout: 12000,
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
        cd games-service && npm install && npm run build && cd .. &&
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

