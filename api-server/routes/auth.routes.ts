/**
 * Auth Routes - Handles registration and login with non-blocking bcrypt
 * 
 * These are the CPU-intensive routes that benefit most from worker threads.
 * Registration: bcrypt.hash (300-500ms blocking → 0ms blocking)
 * Login: bcrypt.compare (100-300ms blocking → 0ms blocking)
 */

import { Router, Request, Response } from 'express';
import { hashPassword, comparePassword } from '../workers/worker-pool';
import mongoose, { Document, Model } from 'mongoose';

const router = Router();

// User interface for type safety
interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Cached model to avoid recreation
let UserModel: Model<IUser> | null = null;

// Get or create User model with proper typing
const getUserModel = (): Model<IUser> => {
  if (UserModel) return UserModel;
  
  // Check if model already exists to avoid OverwriteModelError
  if (mongoose.models.User) {
    UserModel = mongoose.models.User as Model<IUser>;
    return UserModel;
  }
  
  // Define minimal schema for auth operations
  // Use 'user' collection (singular) to match better-auth's collection name
  const userSchema = new mongoose.Schema<IUser>({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }, { collection: 'user' }); // Explicitly set collection name to match better-auth

  UserModel = mongoose.model<IUser>('User', userSchema);
  return UserModel;
};

/**
 * Register a new user
 * Uses worker thread for bcrypt hashing (non-blocking)
 */
router.post('/register', async (req: Request, res: Response) => {
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
    const hashedPassword = await hashPassword(password, 12);
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
  } catch (error) {
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
router.post('/login', async (req: Request, res: Response) => {
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
    const isValid = await comparePassword(password, user.password);
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
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Batch register users (for simulator/internal use only)
 * Uses worker threads for parallel bcrypt hashing
 * 
 * SECURITY: This endpoint requires an internal API key to prevent abuse.
 * Set INTERNAL_API_KEY in your .env file to enable this endpoint.
 * Without the key, this endpoint is completely disabled.
 */
router.post('/register-batch', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // SECURITY: Require internal API key to prevent abuse
    const internalApiKey = process.env.INTERNAL_API_KEY;
    const providedKey = req.headers['x-internal-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    // If no internal API key is configured, disable this endpoint entirely
    if (!internalApiKey) {
      res.status(403).json({ 
        error: 'Batch registration is disabled',
        message: 'This endpoint requires INTERNAL_API_KEY to be configured'
      });
      return;
    }
    
    // Verify the provided key matches
    if (providedKey !== internalApiKey) {
      console.warn(`⚠️ Unauthorized batch registration attempt from ${req.ip}`);
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or missing internal API key. Provide via X-Internal-API-Key header.'
      });
      return;
    }

    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      res.status(400).json({ error: 'Users array is required' });
      return;
    }
    
    // Limit batch size to prevent abuse (max 100 users per request)
    if (users.length > 100) {
      res.status(400).json({ error: 'Maximum 100 users per batch request' });
      return;
    }

    const User = getUserModel();
    const results: Array<{ success: boolean; email: string; userId?: string; error?: string }> = [];
    let successCount = 0;
    let failureCount = 0;

    // Process users with parallel bcrypt hashing
    // Track wall-clock time for the parallel operation (not sum of individual times)
    const bcryptStart = Date.now();
    const hashPromises = users.map(async (userData: { email: string; password: string; name?: string }) => {
      try {
        const hashedPassword = await hashPassword(userData.password, 12);
        return { ...userData, hashedPassword };
      } catch {
        return { ...userData, hashedPassword: null };
      }
    });

    const hashedUsers = await Promise.all(hashPromises);
    const totalBcryptTime = Date.now() - bcryptStart; // Actual wall-clock time for all parallel hashes

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
      } catch (error) {
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
  } catch (error) {
    console.error('❌ Batch registration error:', error);
    res.status(500).json({ 
      error: 'Batch registration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Benchmark endpoint - test bcrypt performance
 * 
 * SECURITY: Only enabled in development mode to prevent DoS attacks
 */
router.get('/benchmark', async (req: Request, res: Response) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ 
      error: 'Benchmark endpoint disabled in production',
      message: 'This endpoint is only available in development mode'
    });
    return;
  }

  const iterations = 5;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await hashPassword('test-password-123', 12);
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

export default router;

