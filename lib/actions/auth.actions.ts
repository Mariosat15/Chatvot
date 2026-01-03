'use server';

import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {connectToDatabase} from "@/database/mongoose";
import { ObjectId } from 'mongodb';
import { sendWelcomeEmail } from "@/lib/nodemailer";
import EmailTemplate from "@/database/models/email-template.model";
import { sendVerificationEmail } from "@/lib/services/email-verification.service";
import { validateRegistration, validateLogin, recordFailedLogin, clearFailedLogins, getClientIP } from "@/lib/services/registration-security.service";

export const signUpWithEmail = async ({ 
    email, 
    password, 
    fullName, 
    country, 
    address, 
    city, 
    postalCode,
    honeypot 
}: SignUpFormData & { honeypot?: string }) => {
    try {
        // Get client IP for security checks
        const ip = await getClientIP();
        
        // SECURITY: Validate registration with comprehensive checks
        const securityResult = await validateRegistration({
            email,
            name: fullName,
            honeypot,
            ip
        });
        
        if (!securityResult.allowed) {
            console.log(`🛡️ Registration blocked: ${securityResult.code} - ${securityResult.reason}`);
            return { 
                error: securityResult.reason || 'Registration failed. Please try again.',
                success: false,
                code: securityResult.code
            };
        }
        
        // Log high-risk registrations
        if (securityResult.riskScore && securityResult.riskScore >= 40) {
            console.log(`⚠️ High-risk registration allowed: email=${email}, ip=${ip}, score=${securityResult.riskScore}`);
        }
        
        // SECURITY: Prevent users from signing up with admin email
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';
        if (email.toLowerCase() === adminEmail) {
            return { 
                error: 'This email address is not available for registration',
                success: false 
            };
        }
        
        const response = await auth.api.signUpEmail({ body: { email, password, name: fullName } })

        if(response && response.user) {
            // Update user with additional profile fields
            const mongoose = await connectToDatabase();
            const db = mongoose.connection.db;
            
            if (db) {
                const userId = response.user.id;
                console.log(`📝 Sign-up: Updating user ${userId} with profile data...`);
                
                // Build query to find user by multiple ID formats
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const queries: any[] = [{ id: userId }];
                if (ObjectId.isValid(userId)) {
                    queries.push({ _id: new ObjectId(userId) });
                }
                queries.push({ _id: userId });
                
                // All new users are traders by default
                // Admin role can ONLY be assigned through the admin panel
                const role = 'trader';
                
                const updateResult = await db.collection('user').updateOne(
                    { $or: queries },
                    { 
                        $set: { 
                            country,
                            address,
                            city,
                            postalCode,
                            role, // All signups are traders - admin role assigned via admin panel only
                            emailVerified: false, // Must verify email before login
                            updatedAt: new Date()
                        } 
                    }
                );
                
                console.log(`📝 Sign-up: Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
                
                if (updateResult.matchedCount === 0) {
                    console.error(`⚠️ Sign-up: Could not find user to update profile data. userId: ${userId}`);
                } else {
                    console.log(`✅ Sign-up: Profile data saved for user ${userId}`, { country, address, city, postalCode });
                }
                
                // Send verification email (required before login)
                try {
                    await sendVerificationEmail({
                        email,
                        name: fullName,
                        userId: userId,
                    });
                    console.log(`✅ Verification email sent to ${email}`);
                } catch (verificationError) {
                    console.error('⚠️ Failed to send verification email:', verificationError);
                    // Don't fail registration, but log it
                }
            }

            // Send welcome email (separate from verification)
            try {
                const template = await EmailTemplate.findOne({ templateType: 'welcome' });
                if (template?.isActive !== false) {
                    const introText = template?.introText || 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.';
                    await sendWelcomeEmail({ email, name: fullName, intro: introText });
                    console.log(`✅ Welcome email sent to ${email}`);
                } else {
                    console.log('📧 Welcome email is disabled in settings, skipping...');
                }
            } catch (emailError) {
                console.error('⚠️ Failed to send welcome email:', emailError);
                // Don't fail registration if email fails
            }
        }

        return { success: true, data: response }
    } catch (e) {
        console.log('Sign up failed', e)
        return { success: false, error: 'Sign up failed' }
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const ip = await getClientIP();
        
        // SECURITY: Check login rate limiting and account lockout
        const loginCheck = await validateLogin({ email, ip });
        
        if (!loginCheck.allowed) {
            console.log(`🔒 Login blocked: ${loginCheck.code} for ${email} from IP ${ip}`);
            return { 
                success: false, 
                error: loginCheck.reason || 'Too many login attempts. Please try again later.',
                code: loginCheck.code,
                lockoutUntil: loginCheck.lockoutUntil
            };
        }
        
        // First check if email is verified
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        
        if (db) {
            const user = await db.collection('user').findOne({ email });
            
            if (user && user.emailVerified === false) {
                return { 
                    success: false, 
                    error: 'Please verify your email before signing in. Check your inbox for the verification link.',
                    needsVerification: true,
                    email: email
                };
            }
        }
        
        try {
            const response = await auth.api.signInEmail({ body: { email, password } });
            
            // SECURITY: Clear failed login attempts on success
            await clearFailedLogins({ email, ip });
            
            return { success: true, data: response };
        } catch (authError) {
            // SECURITY: Record failed login attempt
            const failResult = await recordFailedLogin({ email, ip });
            
            if (failResult.locked) {
                console.log(`🔒 Account locked after failed attempt: ${email}`);
                return { 
                    success: false, 
                    error: `Account temporarily locked. Try again after ${failResult.lockoutUntil?.toLocaleTimeString()}.`,
                    code: 'ACCOUNT_LOCKED',
                    lockoutUntil: failResult.lockoutUntil
                };
            }
            
            const remainingMsg = failResult.remainingAttempts > 0 
                ? ` (${failResult.remainingAttempts} attempts remaining)`
                : '';
            
            console.log(`⚠️ Failed login for ${email} from IP ${ip}. Remaining: ${failResult.remainingAttempts}`);
            return { success: false, error: `Invalid email or password${remainingMsg}` };
        }
    } catch (e) {
        console.log('Sign in failed', e);
        return { success: false, error: 'Invalid email or password' };
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.log('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}
