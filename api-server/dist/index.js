"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from root .env
// When compiled: api-server/dist/index.js → ../../.env (project root)
// When running ts directly: api-server/index.ts → ../.env (project root)
const isCompiledBuild = __dirname.includes('dist');
const envPath = isCompiledBuild
    ? path_1.default.resolve(__dirname, '../../.env') // From dist/ folder
    : path_1.default.resolve(__dirname, '../.env'); // From api-server/ folder
dotenv_1.default.config({ path: envPath });
const worker_pool_1 = require("./workers/worker-pool");
const database_1 = require("./config/database");
// Import routes - ONLY auth and health (minimal dependencies)
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const app = (0, express_1.default)();
const PORT = process.env.API_PORT || 4000;
// ============================================
// MIDDLEWARE
// ============================================
// Security headers
app.use((0, helmet_1.default)({
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
app.use((0, cors_1.default)(corsOptions));
// Gzip compression - reduces response size by 70%
app.use((0, compression_1.default)({
    level: 6, // Balance between compression ratio and CPU usage
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        // Don't compress if client doesn't accept it
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
}));
// Parse JSON bodies
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
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
app.use('/api/health', health_routes_1.default);
// Auth routes (bcrypt worker threads for password hashing)
app.use('/api/auth', auth_routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found on API server`,
    });
});
// Error handler
app.use((err, req, res, next) => {
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
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
// Auto-generate secret in development if missing or weak
function autoGenerateSecret() {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction)
        return null;
    try {
        const newSecret = crypto_1.default.randomBytes(32).toString('hex');
        const envPath = path_1.default.resolve(process.cwd(), '.env');
        if (fs_1.default.existsSync(envPath)) {
            let content = fs_1.default.readFileSync(envPath, 'utf-8');
            if (content.includes('BETTER_AUTH_SECRET=')) {
                content = content.replace(/BETTER_AUTH_SECRET=.*/, `BETTER_AUTH_SECRET=${newSecret}`);
            }
            else {
                content += `\n# Auto-generated by api-server\nBETTER_AUTH_SECRET=${newSecret}\n`;
            }
            fs_1.default.writeFileSync(envPath, content);
        }
        process.env.BETTER_AUTH_SECRET = newSecret;
        console.log('🔐 Auto-generated BETTER_AUTH_SECRET (development only)');
        return newSecret;
    }
    catch (error) {
        console.warn('⚠️  Could not auto-generate secret');
        return null;
    }
}
// Validate auth secret security
function validateAuthSecret() {
    let secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    // Check for insecure placeholder values
    const insecurePatterns = ['your-', 'change', 'secret', 'password', 'test', 'example', 'placeholder'];
    const lowerSecret = secret?.toLowerCase() || '';
    const isInsecure = !secret || secret.length < 32 || insecurePatterns.some(p => lowerSecret.includes(p));
    if (!secret || isInsecure) {
        if (isProduction) {
            console.error('❌ CRITICAL: Auth secret is missing or insecure for production!');
            console.error('   Generate a secure secret:');
            console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
            process.exit(1);
        }
        else {
            // Auto-generate in development
            const generated = autoGenerateSecret();
            if (generated) {
                secret = generated;
            }
            else {
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
        await (0, database_1.connectToDatabase)();
        console.log('✅ Database connected');
        // Initialize bcrypt worker pool
        console.log('🔧 Initializing bcrypt worker pool...');
        worker_pool_1.bcryptPool.initialize();
        console.log(`✅ Worker pool ready (${worker_pool_1.bcryptPool.getStats().poolSize} workers)`);
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
    }
    catch (error) {
        console.error('❌ Failed to start API server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n🛑 Received ${signal}, shutting down...`);
    try {
        await worker_pool_1.bcryptPool.shutdown();
        console.log('✅ Server shut down gracefully');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Start the server
startServer();
//# sourceMappingURL=index.js.map