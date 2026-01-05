/**
 * Email Verification Service
 * Handles sending verification emails and validating verification tokens
 */

import crypto from 'crypto';
import { connectToDatabase } from '@/database/mongoose';
import EmailTemplate from '@/database/models/email-template.model';
import { getTransporter } from '@/lib/nodemailer';
import { getSettings } from '@/lib/services/settings.service';
import { ObjectId } from 'mongodb';

/**
 * Build query to find user by multiple ID formats
 * Better-auth may use either `id` field or `_id` field
 */
function buildUserIdQuery(userId: string): Record<string, unknown>[] {
  const queries: Record<string, unknown>[] = [{ id: userId }];
  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  queries.push({ _id: userId });
  return queries;
}

// Verification token expires in 24 hours
const TOKEN_EXPIRY_HOURS = 24;

interface SendVerificationEmailParams {
  email: string;
  name: string;
  userId: string;
}

interface VerificationResult {
  success: boolean;
  error?: string;
  userId?: string;
}

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create verification token expiry date
 */
export function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + TOKEN_EXPIRY_HOURS);
  return expiry;
}

/**
 * Send email verification email to user
 */
export async function sendVerificationEmail({ email, name, userId }: SendVerificationEmailParams): Promise<boolean> {
  try {
    await connectToDatabase();
    
    // Get settings for platform name
    const settings = await getSettings();
    const platformName = settings.siteName || 'ChartVolt';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    
    // Generate verification token
    const token = generateVerificationToken();
    const tokenExpiry = getTokenExpiry();
    
    // Store token in database
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      console.error('❌ Database connection not available');
      return false;
    }
    
    // Update user with verification token
    // Use $or query to handle different ID formats from better-auth
    const userQueries = buildUserIdQuery(userId);
    const updateResult = await db.collection('user').updateOne(
      { $or: userQueries },
      { 
        $set: { 
          emailVerificationToken: token,
          emailVerificationTokenExpiry: tokenExpiry,
          emailVerified: false,
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`📧 Token stored for user ${userId}: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    
    // Build verification URL
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}&userId=${userId}`;
    
    // Get email template
    const template = await EmailTemplate.findOne({ templateType: 'email_verification' });
    
    // Build email content
    const subject = template?.subject?.replace('{{platformName}}', platformName) 
      || `Verify your email - ${platformName}`;
    const fromName = template?.fromName?.replace('{{platformName}}', platformName) 
      || platformName;
    const headingText = template?.headingText?.replace('{{name}}', name) 
      || `Hi ${name}, please verify your email`;
    const introText = template?.introText 
      || `Thanks for signing up! Please click the button below to verify your email address and activate your account.`;
    const ctaButtonText = template?.ctaButtonText || 'Verify Email';
    
    // Build HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="color: #f5c518; margin: 0; font-size: 28px; font-weight: bold;">${platformName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="color: #ffffff; margin: 0 0 20px; font-size: 24px;">${headingText}</h2>
              <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                ${introText}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationUrl}" 
                       style="display: inline-block; background-color: #f5c518; color: #000000; 
                              text-decoration: none; padding: 16px 40px; border-radius: 8px; 
                              font-weight: bold; font-size: 16px;">
                      ${ctaButtonText}
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #f5c518; font-size: 12px; word-break: break-all; margin: 10px 0 0;">
                ${verificationUrl}
              </p>
              
              <!-- Expiry Notice -->
              <p style="color: #666666; font-size: 14px; margin: 30px 0 0;">
                This link will expire in ${TOKEN_EXPIRY_HOURS} hours.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #333333;">
              <p style="color: #666666; font-size: 12px; margin: 0; text-align: center;">
                If you didn't create an account with ${platformName}, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    // Send email
    const transporter = await getTransporter();
    const senderEmail = settings.nodemailerEmail || process.env.NODEMAILER_EMAIL;
    
    await transporter.sendMail({
      from: `"${fromName}" <${senderEmail}>`,
      to: email,
      subject,
      html: htmlContent,
    });
    
    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    return false;
  }
}

/**
 * Verify email token and mark user as verified
 */
export async function verifyEmailToken(token: string, userId: string): Promise<VerificationResult> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return { success: false, error: 'Database connection failed' };
    }
    
    // Build queries to handle different ID formats
    const userQueries = buildUserIdQuery(userId);
    
    // Find user with matching token (using $or for ID and $and for token)
    const user = await db.collection('user').findOne({
      $and: [
        { $or: userQueries },
        { emailVerificationToken: token }
      ]
    });
    
    console.log(`📧 Looking for user ${userId} with token: found=${!!user}`);
    
    if (!user) {
      // Try to find user without token to give better error message
      const userWithoutToken = await db.collection('user').findOne({ $or: userQueries });
      if (userWithoutToken) {
        if (userWithoutToken.emailVerified === true) {
          return { success: false, error: 'Email is already verified. Please sign in.' };
        }
        console.log(`📧 User found but token doesn't match. Stored token: ${userWithoutToken.emailVerificationToken?.substring(0, 10)}...`);
        // Token doesn't match - user probably clicked old link after requesting new one
        return { success: false, error: 'This verification link is outdated. Please check your email for the latest verification link, or request a new one.' };
      }
      return { success: false, error: 'Invalid verification link. Please request a new verification email.' };
    }
    
    // Check if token has expired
    if (user.emailVerificationTokenExpiry && new Date(user.emailVerificationTokenExpiry) < new Date()) {
      return { success: false, error: 'Verification link has expired. Please request a new one.' };
    }
    
    // Mark email as verified and clear token
    const updateResult = await db.collection('user').updateOne(
      { $or: userQueries },
      { 
        $set: { 
          emailVerified: true,
          updatedAt: new Date()
        },
        $unset: {
          emailVerificationToken: '',
          emailVerificationTokenExpiry: ''
        }
      }
    );
    
    console.log(`✅ Email verified for user ${userId}: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    
    if (updateResult.modifiedCount === 0) {
      console.error(`⚠️ User found but update failed for ${userId}`);
      return { success: false, error: 'Verification failed. Please try again.' };
    }
    
    return { success: true, userId };
  } catch (error) {
    console.error('❌ Email verification failed:', error);
    return { success: false, error: 'Verification failed. Please try again.' };
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return { success: false, error: 'Database connection failed' };
    }
    
    // Find user by email (case-insensitive)
    const user = await db.collection('user').findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    
    if (!user) {
      return { success: false, error: 'No account found with this email' };
    }
    
    if (user.emailVerified === true) {
      return { success: false, error: 'Email is already verified' };
    }
    
    // Get user ID - better-auth may use 'id' field or '_id'
    // Convert _id to string if id doesn't exist
    const userId = user.id || user._id?.toString();
    
    if (!userId) {
      console.error('❌ User found but has no ID:', user.email);
      return { success: false, error: 'User account error' };
    }
    
    console.log(`📧 Resending verification email to ${user.email} (userId: ${userId})`);
    
    // Send new verification email
    const sent = await sendVerificationEmail({
      email: user.email,
      name: user.name || 'User',
      userId: userId,
    });
    
    if (!sent) {
      return { success: false, error: 'Failed to send verification email' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Resend verification failed:', error);
    return { success: false, error: 'Failed to resend verification email' };
  }
}

/**
 * Check if user's email is verified
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) return false;
    
    const userQueries = buildUserIdQuery(userId);
    const user = await db.collection('user').findOne({ $or: userQueries });
    return user?.emailVerified === true;
  } catch (error) {
    console.error('❌ Error checking email verification:', error);
    return false;
  }
}

/**
 * Admin: Manually verify user's email
 */
export async function adminVerifyEmail(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return { success: false, error: 'Database connection failed' };
    }
    
    const userQueries = buildUserIdQuery(userId);
    const result = await db.collection('user').updateOne(
      { $or: userQueries },
      { 
        $set: { 
          emailVerified: true,
          updatedAt: new Date()
        },
        $unset: {
          emailVerificationToken: '',
          emailVerificationTokenExpiry: ''
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return { success: false, error: 'User not found' };
    }
    
    console.log(`✅ Admin manually verified email for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Admin email verification failed:', error);
    return { success: false, error: 'Failed to verify email' };
  }
}

/**
 * Admin: Reset user's email verification status
 */
export async function adminResetEmailVerification(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return { success: false, error: 'Database connection failed' };
    }
    
    const userQueries = buildUserIdQuery(userId);
    const result = await db.collection('user').updateOne(
      { $or: userQueries },
      { 
        $set: { 
          emailVerified: false,
          updatedAt: new Date()
        },
        $unset: {
          emailVerificationToken: '',
          emailVerificationTokenExpiry: ''
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return { success: false, error: 'User not found' };
    }
    
    console.log(`✅ Admin reset email verification for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Admin reset email verification failed:', error);
    return { success: false, error: 'Failed to reset email verification' };
  }
}

