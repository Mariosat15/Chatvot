"use strict";
/**
 * Auth Routes - Handles registration and login with non-blocking bcrypt
 *
 * These are the CPU-intensive routes that benefit most from worker threads.
 * Registration: bcrypt.hash (300-500ms blocking → 0ms blocking)
 * Login: bcrypt.compare (100-300ms blocking → 0ms blocking)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const worker_pool_1 = require("../workers/worker-pool");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Cached model to avoid recreation
let UserModel = null;
// Get or create User model with proper typing
const getUserModel = () => {
    if (UserModel)
        return UserModel;
    // Check if model already exists to avoid OverwriteModelError
    if (mongoose_1.default.models.User) {
        UserModel = mongoose_1.default.models.User;
        return UserModel;
    }
    // Define minimal schema for auth operations
    // Use 'user' collection (singular) to match better-auth's collection name
    const userSchema = new mongoose_1.default.Schema({
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        name: { type: String },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    }, { collection: 'user' }); // Explicitly set collection name to match better-auth
    UserModel = mongoose_1.default.model('User', userSchema);
    return UserModel;
};
/**
 * Register a new user
 * Uses worker thread for bcrypt hashing (non-blocking)
 */
router.post('/register', async (req, res) => {
    const startTime = Date.now();
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        const User = getUserModel();
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }
        // Hash password using worker thread (NON-BLOCKING!)
        const hashStart = Date.now();
        const hashedPassword = await (0, worker_pool_1.hashPassword)(password, 12);
        const hashDuration = Date.now() - hashStart;
        console.log(`🔐 Password hashed in ${hashDuration}ms (non-blocking)`);
        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            name: name || email.split('@')[0],
        });
        const totalDuration = Date.now() - startTime;
        console.log(`✅ User registered in ${totalDuration}ms`);
        res.status(201).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
            },
            timing: {
                total: totalDuration,
                bcrypt: hashDuration,
                blocked: 0, // Worker thread means 0 blocking!
            },
        });
    }
    catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Login user
 * Uses worker thread for bcrypt compare (non-blocking)
 */
router.post('/login', async (req, res) => {
    const startTime = Date.now();
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        const User = getUserModel();
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Compare password using worker thread (NON-BLOCKING!)
        const compareStart = Date.now();
        const isValid = await (0, worker_pool_1.comparePassword)(password, user.password);
        const compareDuration = Date.now() - compareStart;
        console.log(`🔐 Password compared in ${compareDuration}ms (non-blocking)`);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const totalDuration = Date.now() - startTime;
        console.log(`✅ User logged in in ${totalDuration}ms`);
        // In production, you'd generate a JWT here
        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
            },
            timing: {
                total: totalDuration,
                bcrypt: compareDuration,
                blocked: 0,
            },
        });
    }
    catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Batch register users (for simulator)
 * Uses worker threads for parallel bcrypt hashing
 */
router.post('/register-batch', async (req, res) => {
    const startTime = Date.now();
    try {
        const { users } = req.body;
        if (!users || !Array.isArray(users) || users.length === 0) {
            res.status(400).json({ error: 'Users array is required' });
            return;
        }
        const User = getUserModel();
        const results = [];
        let successCount = 0;
        let failureCount = 0;
        let totalBcryptTime = 0;
        // Process users with parallel bcrypt hashing
        const hashPromises = users.map(async (userData) => {
            const hashStart = Date.now();
            try {
                const hashedPassword = await (0, worker_pool_1.hashPassword)(userData.password, 12);
                totalBcryptTime += Date.now() - hashStart;
                return { ...userData, hashedPassword };
            }
            catch {
                return { ...userData, hashedPassword: null };
            }
        });
        const hashedUsers = await Promise.all(hashPromises);
        // Save users sequentially (to handle duplicates gracefully)
        for (const userData of hashedUsers) {
            if (!userData.hashedPassword) {
                results.push({ success: false, email: userData.email, error: 'Hash failed' });
                failureCount++;
                continue;
            }
            try {
                // Check if user exists
                const existing = await User.findOne({ email: userData.email });
                if (existing) {
                    results.push({ success: false, email: userData.email, error: 'Already exists' });
                    failureCount++;
                    continue;
                }
                const user = await User.create({
                    email: userData.email,
                    password: userData.hashedPassword,
                    name: userData.name || userData.email.split('@')[0],
                });
                results.push({ success: true, email: userData.email, userId: user._id.toString() });
                successCount++;
            }
            catch (error) {
                results.push({
                    success: false,
                    email: userData.email,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                failureCount++;
            }
        }
        const totalDuration = Date.now() - startTime;
        console.log(`✅ Batch registration: ${successCount}/${users.length} users in ${totalDuration}ms (bcrypt: ${totalBcryptTime}ms parallel)`);
        res.status(200).json({
            success: true,
            users: results,
            stats: {
                total: users.length,
                success: successCount,
                failed: failureCount,
            },
            timing: {
                total: totalDuration,
                bcrypt: totalBcryptTime,
                avgPerUser: Math.round(totalDuration / users.length),
                blocked: 0, // Worker threads = 0 blocking!
            },
        });
    }
    catch (error) {
        console.error('❌ Batch registration error:', error);
        res.status(500).json({
            error: 'Batch registration failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Benchmark endpoint - test bcrypt performance
 */
router.get('/benchmark', async (req, res) => {
    const iterations = 5;
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await (0, worker_pool_1.hashPassword)('test-password-123', 12);
        times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    res.json({
        message: 'Bcrypt benchmark (using worker threads - NON-BLOCKING)',
        iterations,
        times,
        stats: {
            average: `${avg.toFixed(2)}ms`,
            min: `${min}ms`,
            max: `${max}ms`,
        },
        note: 'Main thread was NOT blocked during these operations',
    });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map