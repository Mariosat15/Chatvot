/**
 * Chartvolt API Server
 * 
 * Lightweight Express server for CPU-intensive operations only.
 * Specifically handles bcrypt password hashing via worker threads.
 * 
 * All other routes (trading, competitions, challenges, positions)
 * are handled by the main Next.js app to avoid complex dependencies.
 * 
 * Features:
 * - Worker threads for bcrypt (non-blocking password hashing)
 * - Gzip compression
 * - Rate limiting
 * - Security headers (Helmet)
 * - CORS configured for main app
 * 
 * Port: 4000 (default)
 * 
 * Routes handled:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/register-batch (simulator)
 * - GET  /api/health
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from root .env
// When compiled: api-server/dist/index.js → ../../.env (project root)
// When running ts directly: api-server/index.ts → ../.env (project root)
const isCompiledBuild = __dirname.includes('dist');
const ROOT_ENV_PATH = isCompiledBuild 
  ? path.resolve(__dirname, '../../.env')  // From dist/ folder
  : path.resolve(__dirname, '../.env');     // From api-server/ folder
dotenv.config({ path: ROOT_ENV_PATH });

import { bcryptPool } from './workers/worker-pool';
import { connectToDatabase } from './config/database';

// Import routes - ONLY auth and health (minimal dependencies)
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';

const app = express();
const PORT = process.env.API_PORT || 4000;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - Allow requests from Next.js app
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.NEXT_PUBLIC_APP_URL || '',
    process.env.ADMIN_URL || '',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Gzip compression - reduces response size by 70%
app.use(compression({
  level: 6, // Balance between compression ratio and CPU usage
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't accept it
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.log(`🐢 SLOW: ${req.method} ${req.path} - ${duration}ms`);
      }
    });
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Health check (no auth required)
app.use('/api/health', healthRoutes);

// Auth routes (bcrypt worker threads for password hashing)
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found on API server`,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ API Error:', err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
});

// ============================================
// STARTUP
// ============================================

import fs from 'fs';
import crypto from 'crypto';

// Auto-generate secret in development if missing or weak
function autoGenerateSecret(): string | null {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) return null;
  
  try {
    const newSecret = crypto.randomBytes(32).toString('hex');
    // Use ROOT_ENV_PATH (defined at top of file) for consistency
    // This ensures we read/write the same .env file regardless of cwd
    
    if (fs.existsSync(ROOT_ENV_PATH)) {
      let content = fs.readFileSync(ROOT_ENV_PATH, 'utf-8');
      
      if (content.includes('BETTER_AUTH_SECRET=')) {
        content = content.replace(/BETTER_AUTH_SECRET=.*/, `BETTER_AUTH_SECRET=${newSecret}`);
      } else {
        content += `\n# Auto-generated by api-server\nBETTER_AUTH_SECRET=${newSecret}\n`;
      }
      
      fs.writeFileSync(ROOT_ENV_PATH, content);
    }
    
    process.env.BETTER_AUTH_SECRET = newSecret;
    console.log('🔐 Auto-generated BETTER_AUTH_SECRET (development only)');
    return newSecret;
  } catch (error) {
    console.warn('⚠️  Could not auto-generate secret');
    return null;
  }
}

// Validate auth secret security
function validateAuthSecret(): void {
  let secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check for common placeholder VALUES (exact matches or very short secrets)
  // Don't use substring matching - a 64-char hex could accidentally contain "test" or "secret"
  const commonPlaceholders = [
    'your-secret-key', 'your-auth-secret', 'change-me', 'changeme', 
    'secret', 'password', 'test', 'example', 'placeholder',
    'xxx', 'abc123', '123456', 'default', 'supersecret'
  ];
  const lowerSecret = secret?.toLowerCase().trim() || '';
  
  // Secret is insecure if:
  // 1. Missing or too short (< 32 chars)
  // 2. EXACTLY matches a common placeholder
  // 3. Starts with obvious placeholder prefixes for short secrets
  const isTooShort = !secret || secret.length < 32;
  const isExactPlaceholder = commonPlaceholders.includes(lowerSecret);
  const hasPlaceholderPrefix = secret && secret.length < 40 && 
    (lowerSecret.startsWith('your-') || lowerSecret.startsWith('change'));
  
  const isInsecure = isTooShort || isExactPlaceholder || hasPlaceholderPrefix;
  
  if (!secret || isInsecure) {
    if (isProduction) {
      console.error('❌ CRITICAL: Auth secret is missing or insecure for production!');
      console.error('   Generate a secure secret:');
      console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      process.exit(1);
    } else {
      // Auto-generate in development
      const generated = autoGenerateSecret();
      if (generated) {
        secret = generated;
      } else {
        console.warn('⚠️  Auth secret is weak. Use a secure random secret in production.');
        return;
      }
    }
  }
  
  console.log('✅ Auth secret validated');
}

async function startServer() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           CHARTVOLT API SERVER                            ║');
  console.log('║           Bcrypt Worker Threads for Auth                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // Validate auth secret before starting
    validateAuthSecret();
    
    // Connect to database
    console.log('📊 Connecting to database...');
    await connectToDatabase();
    console.log('✅ Database connected');

    // Initialize bcrypt worker pool
    console.log('🔧 Initializing bcrypt worker pool...');
    bcryptPool.initialize();
    console.log(`✅ Worker pool ready (${bcryptPool.getStats().poolSize} workers)`);

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 API Server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log('\n📋 Routes (bcrypt offloading):');
      console.log('   POST /api/auth/register');
      console.log('   POST /api/auth/login');
      console.log('   POST /api/auth/register-batch (simulator)');
      console.log('\n');
    });

  } catch (error) {
    console.error('❌ Failed to start API server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}, shutting down...`);
  
  try {
    await bcryptPool.shutdown();
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
startServer();

