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
      script: 'dist/index.js',
      cwd: __dirname + '/api-server',
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
  ],

  // ============================================
  // DEPLOYMENT CONFIGURATION
  // ============================================
  deploy: {
    production: {
      // SSH connection
      user: 'your-username',
      host: 'your-hostinger-ip',
      ref: 'origin/main',
      repo: 'git@github.com:Mariosat15/Chatvot.git',
      path: '/var/www/chartvolt',
      
      // Commands to run after pulling code
      'post-deploy': `
        npm install &&
        npm run build &&
        npm run worker:build &&
        mkdir -p logs &&
        pm2 reload ecosystem.config.js --env production
      `.trim().replace(/\s+/g, ' '),
      
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};

