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
      instances: 1, // Can increase for clustering
      exec_mode: 'fork',
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
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
    },

    // ============================================
    // BACKGROUND WORKER
    // ============================================
    {
      name: 'chartvolt-worker',
      script: 'dist/worker/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        IS_WORKER: 'true',  // CRITICAL: Prevents WebSocket connection - worker reads from MongoDB cache
      },
      instances: 1, // Only 1 worker needed
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart every 6 hours to prevent memory leaks
      cron_restart: '0 */6 * * *',
      // Graceful shutdown
      kill_timeout: 10000,
    },

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

