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
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();

// User interface - matches better-auth's user schema (NO password field!)
// better-auth stores passwords in the 'account' collection, not 'user'
interface IUser extends Document {
  id: string;           // better-auth's primary identifier (NOT MongoDB's _id)
  email: string;
  name?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;       // Token for email verification
  emailVerificationTokenExpiry?: Date;   // When the token expires
  image?: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Account interface - matches better-auth's account schema
// This is where passwords are stored with providerId='credential'
interface IAccount extends Document {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Cached models to avoid recreation
let UserModel: Model<IUser> | null = null;
let AccountModel: Model<IAccount> | null = null;

/**
 * Generate a unique ID compatible with better-auth
 * Uses crypto.randomUUID() which produces standard UUID v4 format
 */
const generateUserId = (): string => {
  return crypto.randomUUID();
};

// Get or create User model with proper typing
const getUserModel = (): Model<IUser> => {
  if (UserModel) return UserModel;
  
  // Check if model already exists to avoid OverwriteModelError
  if (mongoose.models.User) {
    UserModel = mongoose.models.User as Model<IUser>;
    return UserModel;
  }
  
  // Define schema matching better-auth's user structure
  // NO password field - that goes in account collection
  const userSchema = new mongoose.Schema<IUser>({
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },       // Token for email verification
    emailVerificationTokenExpiry: { type: Date },   // When the token expires
    image: { type: String },
    role: { type: String, default: 'trader' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }, { collection: 'user' });

  UserModel = mongoose.model<IUser>('User', userSchema);
  return UserModel;
};

// Get or create Account model with proper typing
const getAccountModel = (): Model<IAccount> => {
  if (AccountModel) return AccountModel;
  
  if (mongoose.models.Account) {
    AccountModel = mongoose.models.Account as Model<IAccount>;
    return AccountModel;
  }
  
  // Define schema matching better-auth's account structure
  // This stores credentials with providerId='credential' for email/password auth
  const accountSchema = new mongoose.Schema<IAccount>({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    accountId: { type: String, required: true },
    providerId: { type: String, required: true },
    password: { type: String }, // Hashed password for credential auth
    accessToken: { type: String },
    refreshToken: { type: String },
    accessTokenExpiresAt: { type: Date },
    refreshTokenExpiresAt: { type: Date },
    scope: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }, { collection: 'account' });

  AccountModel = mongoose.model<IAccount>('Account', accountSchema);
  return AccountModel;
};

/**
 * Register a new user
 * Uses worker thread for bcrypt hashing (non-blocking)
 * Creates both user and account records to match better-auth schema
 * Uses MongoDB transaction to ensure atomicity (no orphaned users)
 */
router.post('/register', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Session created inside try block to handle connection errors gracefully
  let session: mongoose.ClientSession | null = null;
  
  try {
    // Start a MongoDB session for transaction (inside try for proper error handling)
    session = await mongoose.startSession();
    
    const { email, password, name } = req.body;

    // Type validation - ensure email and password are strings
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    
    // Email format validation (matches batch registration requirement)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }
    
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Valid password is required' });
      return;
    }
    
    // Password must be at least 6 characters (matches batch registration requirement)
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    
    // Optional name must also be string if provided
    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({ error: 'Name must be a string' });
      return;
    }

    const User = getUserModel();
    const Account = getAccountModel();

    // Check if user already exists (before starting transaction)
    const existingUser = await User.findOne({ email });
    let orphanedUserId: string | null = null;
    
    if (existingUser) {
      // Check if they have ANY account (credential OR OAuth) - if not, they're orphaned
      // IMPORTANT: Don't filter by providerId - OAuth users have different providerIds (google, github, etc.)
      const existingAccount = await Account.findOne({ userId: existingUser.id });
      if (existingAccount) {
        // User has an account - check if it's a credential account for proper error message
        if (existingAccount.providerId === 'credential') {
          res.status(409).json({ error: 'User already exists' });
        } else {
          // User registered via OAuth - suggest they use that method
          res.status(409).json({ 
            error: 'User already exists',
            message: `This email is already registered via ${existingAccount.providerId}. Please sign in using that method.`
          });
        }
        return;
      }
      // No account found - user is truly orphaned, safe to clean up
      orphanedUserId = existingUser._id.toString();
      console.log(`🔧 Found orphaned user ${email}, will clean up in transaction...`);
    }

    // Hash password using worker thread (NON-BLOCKING!)
    const hashStart = Date.now();
    const hashedPassword = await hashPassword(password, 12);
    const hashDuration = Date.now() - hashStart;
    
    console.log(`🔐 Password hashed in ${hashDuration}ms (non-blocking)`);

    // Create user and account in a transaction (atomic operation)
    const userId = generateUserId();
    const accountId = generateUserId();
    
    let createdUser: IUser | null = null;
    
    await session.withTransaction(async () => {
      // Delete orphaned user inside transaction (if exists)
      // This ensures if new user creation fails, orphan is NOT deleted
      if (orphanedUserId) {
        // RACE CONDITION FIX: Re-verify orphaned state inside transaction
        // Another request could have created an account during password hashing (300-500ms)
        const accountCreatedDuringHash = await Account.findOne({ userId: existingUser!.id }, { session });
        if (accountCreatedDuringHash) {
          // User is no longer orphaned - abort by throwing
          throw new Error('CONCURRENT_REGISTRATION');
        }
        await User.deleteOne({ _id: orphanedUserId }, { session });
        console.log(`🔧 Deleted orphaned user in transaction`);
      }
      
      // Create user with better-auth compatible fields (NO password here!)
      const [user] = await User.create([{
        id: userId,
        email,
        name: name || email.split('@')[0],
        emailVerified: false,
        role: 'trader',
      }], { session });
      
      createdUser = user;
      
      // Create account record with password (better-auth stores credentials here)
      await Account.create([{
        id: accountId,
        userId: userId,
        accountId: userId, // For credential auth, accountId equals userId
        providerId: 'credential', // This identifies email/password auth
        password: hashedPassword,
      }], { session });
    });

    const totalDuration = Date.now() - startTime;
    console.log(`✅ User registered in ${totalDuration}ms`);

    // Send verification email (matching main app behavior)
    let verificationEmailSent = false;
    try {
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24); // 24 hour expiry
      
      // Store token on user document
      const User = getUserModel();
      await User.findOneAndUpdate(
        { id: userId },
        { 
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiry: tokenExpiry,
        }
      );
      
      // Build verification URL (consistent with login flow)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}&userId=${userId}`;
      
      // Send email using nodemailer (if available in this environment)
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || process.env.NODEMAILER_HOST,
        port: parseInt(process.env.SMTP_PORT || process.env.NODEMAILER_PORT || '587'),
        secure: (process.env.SMTP_SECURE || process.env.NODEMAILER_SECURE) === 'true',
        auth: {
          user: process.env.SMTP_USER || process.env.NODEMAILER_EMAIL,
          pass: process.env.SMTP_PASS || process.env.NODEMAILER_PASSWORD,
        },
      });
      
      const platformName = process.env.PLATFORM_NAME || 'ChartVolt';
      const senderEmail = process.env.SMTP_USER || process.env.NODEMAILER_EMAIL || 'noreply@chartvolt.com';
      
      await transporter.sendMail({
        from: `"${platformName}" <${senderEmail}>`,
        to: email,
        subject: `Verify your email - ${platformName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #ffffff; padding: 40px;">
            <h1 style="color: #f5c518; margin-bottom: 24px;">Verify Your Email</h1>
            <p style="margin-bottom: 24px;">Thanks for signing up! Please click the button below to verify your email address.</p>
            <a href="${verificationUrl}" style="display: inline-block; background-color: #f5c518; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold;">
              Verify Email
            </a>
            <p style="margin-top: 24px; color: #888888; font-size: 14px;">
              Or copy this link: ${verificationUrl}
            </p>
            <p style="margin-top: 24px; color: #888888; font-size: 12px;">
              This link expires in 24 hours. If you didn't create an account, you can ignore this email.
            </p>
          </div>
        `,
      });
      
      verificationEmailSent = true;
      console.log(`📧 Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    // Auto-assign customer to employee (if enabled)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
      
      // Use AbortController for timeout - prevents hanging if auto-assign endpoint is slow/unreachable
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5 second timeout
      
      try {
        const autoAssignResponse = await fetch(`${baseUrl}/api/customer-assignment/auto-assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            userEmail: email,
            userName: name || email.split('@')[0],
          }),
          signal: abortController.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (autoAssignResponse.ok) {
          const result = await autoAssignResponse.json() as { assigned?: boolean; employee?: { name?: string }; reason?: string };
          if (result.assigned) {
            console.log(`✅ Customer auto-assigned to ${result.employee?.name}`);
          } else {
            console.log(`📋 Customer not auto-assigned: ${result.reason}`);
          }
        }
      } finally {
        clearTimeout(timeoutId); // Ensure timeout is cleared even on error
      }
    } catch (autoAssignError) {
      // Handle timeout specifically for better logging
      if (autoAssignError instanceof Error && autoAssignError.name === 'AbortError') {
        console.warn('⚠️ Customer auto-assign timed out (5s) - will be assigned later');
      } else {
        console.error('⚠️ Failed to auto-assign customer:', autoAssignError);
      }
      // Don't fail registration if auto-assign fails
    }

    res.status(201).json({
      success: true,
      user: {
        id: createdUser?.id || userId,  // Return better-auth's id, not _id
        email: createdUser?.email || email,
        name: createdUser?.name || name || email.split('@')[0],
      },
      message: verificationEmailSent 
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful! Please contact support if you did not receive a verification email.',
      emailVerificationRequired: true,
      timing: {
        total: totalDuration,
        bcrypt: hashDuration,
        blocked: 0, // Worker thread means 0 blocking!
      },
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle concurrent registration race condition
    // This occurs when another request completed registration during password hashing
    if (errorMessage === 'CONCURRENT_REGISTRATION') {
      res.status(409).json({ 
        error: 'User already exists',
        message: 'An account with this email address was just created. Please try logging in.',
      });
      return;
    }
    
    // Handle MongoDB duplicate key error (race condition)
    // This occurs when concurrent requests for the same email both pass the initial check
    if (errorMessage.includes('E11000') || errorMessage.includes('duplicate key')) {
      res.status(409).json({ 
        error: 'User already exists',
        message: 'An account with this email address already exists.',
      });
      return;
    }
    
    // For other errors, return a generic message to avoid exposing internal details
    res.status(500).json({ 
      error: 'Registration failed',
      message: 'An unexpected error occurred during registration. Please try again.',
    });
  } finally {
    // Always end the session (if it was created)
    if (session) {
      await session.endSession();
    }
  }
});

/**
 * Login user
 * Uses worker thread for bcrypt compare (non-blocking)
 * Looks up password from account collection (better-auth compatible)
 */
router.post('/login', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { email, password } = req.body;

    // Type validation - ensure email and password are strings
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Valid password is required' });
      return;
    }

    const User = getUserModel();
    const Account = getAccountModel();

    // SECURITY: Use consistent error responses to prevent account enumeration
    // All authentication failures return the same generic error message.
    // This prevents attackers from determining if an account exists or its state.
    const GENERIC_AUTH_ERROR = { error: 'Invalid credentials' };
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // User doesn't exist - return generic error
      res.status(401).json(GENERIC_AUTH_ERROR);
      return;
    }

    // Find credential account for this user (better-auth stores password here)
    const account = await Account.findOne({ 
      userId: user.id, 
      providerId: 'credential' 
    });
    
    if (!account || !account.password) {
      // No credential account - user may have registered via OAuth only
      res.status(401).json(GENERIC_AUTH_ERROR);
      return;
    }

    // Compare password using worker thread (NON-BLOCKING!)
    const compareStart = Date.now();
    const isValid = await comparePassword(password, account.password);
    const compareDuration = Date.now() - compareStart;

    console.log(`🔐 Password compared in ${compareDuration}ms (non-blocking)`);

    if (!isValid) {
      // Wrong password - return generic error
      res.status(401).json(GENERIC_AUTH_ERROR);
      return;
    }
    
    // SECURITY: Check email verification AFTER password validation
    // Only reveal verification status to users who prove they own the account
    // by providing the correct password. This prevents account enumeration
    // while still providing helpful feedback to legitimate users.
    if (user.emailVerified !== true) {
      console.log(`⚠️ Login blocked for unverified user: ${email} (emailVerified: ${user.emailVerified})`);
      
      // Silently attempt to resend verification email for legitimate users
      try {
        const nodemailer = await import('nodemailer');
        const crypto = await import('crypto');
        
        // Check if we need to generate a new token or can reuse existing
        const needsNewToken = !user.emailVerificationToken || 
          !user.emailVerificationTokenExpiry ||
          new Date(user.emailVerificationTokenExpiry) < new Date();
        
        let verificationToken: string;
        
        if (needsNewToken) {
          // Generate new token
          verificationToken = crypto.randomBytes(32).toString('hex');
          const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                emailVerificationToken: verificationToken,
                emailVerificationTokenExpiry: tokenExpiry
              } 
            }
          );
        } else {
          // Reuse existing valid token
          verificationToken = user.emailVerificationToken;
        }
        
        // Always send verification email (either with new or existing token)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://chartvolt.com';
        // FIXED: Use userId instead of email - the /api/auth/verify-email endpoint expects userId
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}&userId=${user.id}`;
        
        // Use consistent SMTP configuration with registration route
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || process.env.NODEMAILER_HOST,
          port: parseInt(process.env.SMTP_PORT || process.env.NODEMAILER_PORT || '587'),
          secure: (process.env.SMTP_SECURE || process.env.NODEMAILER_SECURE) === 'true',
          auth: {
            user: process.env.SMTP_USER || process.env.NODEMAILER_EMAIL,
            pass: process.env.SMTP_PASS || process.env.NODEMAILER_PASSWORD
          }
        });
        
        const platformName = process.env.PLATFORM_NAME || 'ChartVolt';
        const senderEmail = process.env.SMTP_USER || process.env.NODEMAILER_EMAIL || 'noreply@chartvolt.com';
        
        // Fire and forget - don't await
        transporter.sendMail({
          from: `"${platformName}" <${senderEmail}>`,
          to: email,
          subject: `Verify your email - ${platformName}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Email Verification Required</h2>
              <p>You attempted to log in but your email is not yet verified.</p>
              <p>Please click the link below to verify your email address:</p>
              <p><a href="${verificationUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a></p>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">This link expires in 24 hours.</p>
            </div>
          `
        }).catch(err => console.error('Failed to send verification reminder:', err));
      } catch (emailError) {
        // Don't fail login flow due to email error, just log it
        console.error('Error sending verification reminder:', emailError);
      }
      
      // Return specific error only after password is validated
      // This is safe because the user has proven account ownership
      res.status(403).json({ 
        error: 'Email not verified',
        message: 'Please verify your email address before signing in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      });
      return;
    }

    const totalDuration = Date.now() - startTime;
    console.log(`✅ User logged in in ${totalDuration}ms`);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
    if (!jwtSecret) {
      console.error('❌ JWT_SECRET or BETTER_AUTH_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }
    
    // Use 'id' field to match middleware expectations (AuthenticatedRequest interface)
    const token = jwt.sign(
      { 
        id: user.id,  // Must be 'id' not 'userId' to match auth middleware
        email: user.email,
        name: user.name,
      },
      jwtSecret,
      { 
        expiresIn: '7d',  // Token expires in 7 days
        issuer: 'chartvolt-api',
      }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,  // Always returns consistent UUID format
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
    
    // Don't expose internal error details to clients
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An unexpected error occurred during login. Please try again.',
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
    // Get provided key from header (handle array case - take first value)
    const headerKey = req.headers['x-internal-api-key'];
    // SECURITY FIX: Handle Authorization header array case to prevent TypeError
    const authHeaderRaw = req.headers['authorization'];
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    const authKey = typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : undefined;
    const providedKey = Array.isArray(headerKey) ? headerKey[0] : headerKey || authKey;
    
    // If no internal API key is configured, disable this endpoint entirely
    if (!internalApiKey) {
      res.status(403).json({ 
        error: 'Batch registration is disabled',
        message: 'This endpoint requires INTERNAL_API_KEY to be configured'
      });
      return;
    }
    
    // Verify the provided key matches using timing-safe comparison
    // Hash both keys first to produce fixed-length outputs - this prevents
    // timing attacks that could leak the API key length through response times.
    // Without hashing, the length check would reject wrong-length keys faster.
    const hashKey = (key: string | undefined): Buffer => {
      return crypto.createHash('sha256').update(key || '').digest();
    };
    
    const isValidKey = providedKey && 
      typeof providedKey === 'string' &&
      crypto.timingSafeEqual(hashKey(providedKey), hashKey(internalApiKey));
    
    if (!isValidKey) {
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
    const Account = getAccountModel();
    
    // Pre-allocate results array to preserve input order
    // Each result will be stored at its original index
    const results: Array<{ success: boolean; email: string; userId?: string; error?: string }> = new Array(users.length);
    let successCount = 0;
    let failureCount = 0;

    // Validate each user before processing - track original index
    const validUsers: Array<{ email: string; password: string; name?: string; originalIndex: number }> = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    for (let i = 0; i < users.length; i++) {
      const userData = users[i];
      
      // Validate that element is an object (not null, undefined, or primitive)
      if (!userData || typeof userData !== 'object' || Array.isArray(userData)) {
        results[i] = { 
          success: false, 
          email: 'unknown', 
          error: `Invalid user data at index ${i}: expected an object` 
        };
        failureCount++;
        continue;
      }
      
      // Validate email
      if (!userData.email || typeof userData.email !== 'string' || !emailRegex.test(userData.email)) {
        results[i] = { 
          success: false, 
          email: userData.email || 'unknown', 
          error: 'Invalid or missing email' 
        };
        failureCount++;
        continue;
      }
      
      // Validate password
      if (!userData.password || typeof userData.password !== 'string' || userData.password.length < 6) {
        results[i] = { 
          success: false, 
          email: userData.email, 
          error: 'Invalid or missing password (min 6 characters)' 
        };
        failureCount++;
        continue;
      }
      
      // Store original index to preserve order in results
      validUsers.push({ ...userData, originalIndex: i });
    }

    // Process validated users with parallel bcrypt hashing
    // Track wall-clock time for the parallel operation (not sum of individual times)
    const bcryptStart = Date.now();
    const hashPromises = validUsers.map(async (userData) => {
      try {
        const hashedPassword = await hashPassword(userData.password, 12);
        return { ...userData, hashedPassword };
      } catch {
        return { ...userData, hashedPassword: null };
      }
    });

    const hashedUsers = await Promise.all(hashPromises);
    const totalBcryptTime = Date.now() - bcryptStart; // Actual wall-clock time for all parallel hashes

    // Save users sequentially with transactions (to handle duplicates and ensure atomicity)
    for (const userData of hashedUsers) {
      const { originalIndex } = userData;
      
      if (!userData.hashedPassword) {
        results[originalIndex] = { success: false, email: userData.email, error: 'Hash failed' };
        failureCount++;
        continue;
      }

      // Start a session for each user's transaction
      const session = await mongoose.startSession();
      
      try {
        // Check if user exists
        const existing = await User.findOne({ email: userData.email });
        let orphanedUserId: string | null = null;
        
        if (existing) {
          // Check if they have ANY account (credential OR OAuth) - if not, they're orphaned
          // IMPORTANT: Don't filter by providerId - OAuth users have different providerIds
          const existingAccount = await Account.findOne({ userId: existing.id });
          if (existingAccount) {
            // User has an account - they're not orphaned, reject registration
            const errorMsg = existingAccount.providerId === 'credential' 
              ? 'Already exists' 
              : `Already registered via ${existingAccount.providerId}`;
            results[originalIndex] = { success: false, email: userData.email, error: errorMsg };
            failureCount++;
            // Don't call session.endSession() here - finally block handles it
            // Using continue in try-finally still executes finally first
            continue;
          }
          // No account found - user is truly orphaned, safe to clean up
          orphanedUserId = existing._id.toString();
          console.log(`🔧 Found orphaned user ${userData.email}, will clean up in transaction...`);
        }

        const userId = generateUserId();
        const accountId = generateUserId();
        
        let createdUserId: string | null = null;
        
        // Use transaction to ensure both user and account are created atomically
        await session.withTransaction(async () => {
          // Delete orphaned user inside transaction (if exists)
          // This ensures if new user creation fails, orphan is NOT deleted
          if (orphanedUserId) {
            // RACE CONDITION FIX: Re-verify orphaned state inside transaction
            // Another request could have created an account during password hashing
            const accountCreatedDuringHash = await Account.findOne({ userId: existing!.id }, { session });
            if (accountCreatedDuringHash) {
              // User is no longer orphaned - abort by throwing
              throw new Error('CONCURRENT_REGISTRATION');
            }
            await User.deleteOne({ _id: orphanedUserId }, { session });
            console.log(`🔧 Deleted orphaned user in transaction`);
          }
          
          // Create user (no password here - better-auth stores it in account)
          const [user] = await User.create([{
            id: userId,
            email: userData.email,
            name: userData.name || userData.email.split('@')[0],
            emailVerified: false,
            role: 'trader',
          }], { session });
          
          createdUserId = user.id;
          
          // Create account with password (better-auth compatible)
          await Account.create([{
            id: accountId,
            userId: userId,
            accountId: userId,
            providerId: 'credential',
            password: userData.hashedPassword,
          }], { session });
        });

        results[originalIndex] = { success: true, email: userData.email, userId: createdUserId || userId };
        successCount++;
      } catch (error) {
        // Handle errors with clean messages
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let cleanError: string;
        
        if (errorMessage === 'CONCURRENT_REGISTRATION') {
          cleanError = 'User was just registered by another request';
        } else if (errorMessage.includes('E11000') || errorMessage.includes('duplicate key')) {
          cleanError = 'User already exists';
        } else {
          cleanError = 'Registration failed';
        }
        
        results[originalIndex] = { 
          success: false, 
          email: userData.email, 
          error: cleanError
        };
        failureCount++;
      } finally {
        await session.endSession();
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
    
    // Don't expose internal error details
    res.status(500).json({ 
      error: 'Batch registration failed',
      message: 'An unexpected error occurred during batch registration. Please try again.',
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

  try {
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
  } catch (error) {
    console.error('❌ Benchmark error:', error);
    res.status(500).json({
      error: 'Benchmark failed',
      message: 'An error occurred during the benchmark. The worker pool may be unavailable.',
    });
  }
});

export default router;

