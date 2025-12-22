'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signOut = exports.signInWithEmail = exports.signUpWithEmail = void 0;
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
const mongoose_1 = require("@/database/mongoose");
const mongodb_1 = require("mongodb");
const nodemailer_1 = require("@/lib/nodemailer");
const email_template_model_1 = __importDefault(require("@/database/models/email-template.model"));
const signUpWithEmail = async ({ email, password, fullName, country, address, city, postalCode }) => {
    try {
        // SECURITY: Prevent users from signing up with admin email
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';
        if (email.toLowerCase() === adminEmail) {
            return {
                error: 'This email address is not available for registration',
                success: false
            };
        }
        const response = await auth_1.auth.api.signUpEmail({ body: { email, password, name: fullName } });
        if (response && response.user) {
            // Update user with additional profile fields
            const mongoose = await (0, mongoose_1.connectToDatabase)();
            const db = mongoose.connection.db;
            if (db) {
                const userId = response.user.id;
                console.log(`📝 Sign-up: Updating user ${userId} with profile data...`);
                // Build query to find user by multiple ID formats
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const queries = [{ id: userId }];
                if (mongodb_1.ObjectId.isValid(userId)) {
                    queries.push({ _id: new mongodb_1.ObjectId(userId) });
                }
                queries.push({ _id: userId });
                // All new users are traders by default
                // Admin role can ONLY be assigned through the admin panel
                const role = 'trader';
                const updateResult = await db.collection('user').updateOne({ $or: queries }, {
                    $set: {
                        country,
                        address,
                        city,
                        postalCode,
                        role, // All signups are traders - admin role assigned via admin panel only
                        updatedAt: new Date()
                    }
                });
                console.log(`📝 Sign-up: Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
                if (updateResult.matchedCount === 0) {
                    console.error(`⚠️ Sign-up: Could not find user to update profile data. userId: ${userId}`);
                }
                else {
                    console.log(`✅ Sign-up: Profile data saved for user ${userId}`, { country, address, city, postalCode });
                }
            }
            // Send welcome email directly (replaces Inngest)
            try {
                const template = await email_template_model_1.default.findOne({ templateType: 'welcome' });
                if (template?.isActive !== false) {
                    const introText = template?.introText || 'Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.';
                    await (0, nodemailer_1.sendWelcomeEmail)({ email, name: fullName, intro: introText });
                    console.log(`✅ Welcome email sent to ${email}`);
                }
                else {
                    console.log('📧 Welcome email is disabled in settings, skipping...');
                }
            }
            catch (emailError) {
                console.error('⚠️ Failed to send welcome email:', emailError);
                // Don't fail registration if email fails
            }
        }
        return { success: true, data: response };
    }
    catch (e) {
        console.log('Sign up failed', e);
        return { success: false, error: 'Sign up failed' };
    }
};
exports.signUpWithEmail = signUpWithEmail;
const signInWithEmail = async ({ email, password }) => {
    try {
        const response = await auth_1.auth.api.signInEmail({ body: { email, password } });
        return { success: true, data: response };
    }
    catch (e) {
        console.log('Sign in failed', e);
        return { success: false, error: 'Sign in failed' };
    }
};
exports.signInWithEmail = signInWithEmail;
const signOut = async () => {
    try {
        await auth_1.auth.api.signOut({ headers: await (0, headers_1.headers)() });
    }
    catch (e) {
        console.log('Sign out failed', e);
        return { success: false, error: 'Sign out failed' };
    }
};
exports.signOut = signOut;
