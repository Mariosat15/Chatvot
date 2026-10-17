/**
 * Email Verification Service
 * Handles sending verification emails and validating verification tokens
 */

import crypto from "crypto";
import { connectToDatabase } from "@/database/mongoose";
import EmailTemplate from "@/database/models/email-template.model";
import { getTransporter, sendWelcomeEmail } from "@/lib/nodemailer";
import { escapeHtml, renderChartVoltEmail } from "@/lib/nodemailer/chartvolt-email-layout";
import { getEmailBrand } from "@/lib/nodemailer/email-brand";
import { getSettings } from "@/lib/services/settings.service";
import { ObjectId } from "mongodb";

/**
 * Escape special regex characters in a string to prevent ReDoS attacks
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  /** The link had already been used and the account is verified - not a failure. */
  alreadyVerified?: boolean;
}

/**
 * Sends the welcome email once the address is proven, honouring the operator's switch.
 *
 * Reason: it used to go out at sign-up beside the verification email. Fire-and-forget:
 * a failed welcome must never turn a successful verification into an error.
 */
async function sendWelcomeAfterVerification(email: string, name: string): Promise<void> {
  try {
    const template = (await EmailTemplate.findOne({ templateType: "welcome" }).lean()) as {
      isActive?: boolean;
      introText?: string;
    } | null;
    if (template?.isActive === false) return;
    const intro =
      template?.introText ||
      "Thanks for joining! Your account is ready - pick a game or a competition and start playing.";
    await sendWelcomeEmail({ email, name, intro });
  } catch (error) {
    console.warn("⚠️ Failed to send welcome email after verification:", error);
  }
}

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
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
export async function sendVerificationEmail({
  email,
  name,
  userId,
}: SendVerificationEmailParams): Promise<boolean> {
  try {
    await connectToDatabase();

    // Get settings for platform name
    const settings = await getSettings();
    const platformName = settings.siteName || "ChartVolt";
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000";

    // Generate verification token
    const token = generateVerificationToken();
    const tokenExpiry = getTokenExpiry();

    // Store token in database
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.error("❌ Database connection not available");
      return false;
    }

    // Update user with verification token
    // Use $or query to handle different ID formats from better-auth
    const userQueries = buildUserIdQuery(userId);
    const updateResult = await db.collection("user").updateOne(
      { $or: userQueries },
      {
        $set: {
          emailVerificationToken: token,
          emailVerificationTokenExpiry: tokenExpiry,
          emailVerified: false,
          updatedAt: new Date(),
        },
      },
    );

    console.log(
      `📧 Token stored for user ${userId}: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`,
    );

    // Build verification URL
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}&userId=${userId}`;

    // Get email template
    const template = await EmailTemplate.findOne({
      templateType: "email_verification",
    });

    // Build email content
    const subject =
      template?.subject?.replace("{{platformName}}", platformName) ||
      `Verify your email - ${platformName}`;
    const fromName =
      template?.fromName?.replace("{{platformName}}", platformName) ||
      platformName;
    const headingText =
      template?.headingText?.replace("{{name}}", name) ||
      `Hi ${name}, please verify your email`;
    const introText =
      template?.introText ||
      `Thanks for signing up! Please click the button below to verify your email address and activate your account.`;
    const ctaButtonText = template?.ctaButtonText || "Verify Email";

    const htmlContent = await buildVerificationHtml({
      subject,
      platformName,
      headingText,
      introText,
      ctaButtonText,
      verificationUrl,
    });

    // Send email
    const transporter = await getTransporter();
    const senderEmail =
      settings.nodemailerEmail || process.env.NODEMAILER_EMAIL;

    await transporter.sendMail({
      from: `"${fromName}" <${senderEmail}>`,
      to: email,
      subject,
      html: htmlContent,
    });

    console.log(`✅ Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send verification email:", error);
    return false;
  }
}

/**
 * Verification email body in the shared ChartVolt dark layout. Both the first
 * send and the resend use it, so the two can no longer drift apart.
 */
async function buildVerificationHtml(args: {
  subject: string;
  platformName: string;
  headingText: string;
  introText: string;
  ctaButtonText: string;
  verificationUrl: string;
}): Promise<string> {
  const brand = await getEmailBrand();
  return renderChartVoltEmail({
    title: args.subject,
    platformName: args.platformName,
    logoUrl: brand.logoUrl,
    preheader: args.introText,
    eyebrow: "Verify your email",
    heading: escapeHtml(args.headingText),
    bodyHtml: `<p style="margin:0;">${escapeHtml(args.introText)}</p>`,
    cta: { text: args.ctaButtonText, url: args.verificationUrl },
    ctaNote: `This link expires in ${TOKEN_EXPIRY_HOURS} hours.`,
    showFallbackLink: true,
    panel: {
      icon: "&#128274;",
      title: "Didn't sign up?",
      lines: [`If you didn't create an account with ${escapeHtml(args.platformName)}, you can safely ignore this email.`],
    },
    footerAddress: brand.companyAddress,
  });
}

/**
 * Verify email token and mark user as verified
 */
export async function verifyEmailToken(
  token: string,
  userId: string,
): Promise<VerificationResult> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return { success: false, error: "Database connection failed" };
    }

    // Build queries to handle different ID formats
    const userQueries = buildUserIdQuery(userId);

    // Find user with matching token (using $or for ID and $and for token)
    const user = await db.collection("user").findOne({
      $and: [{ $or: userQueries }, { emailVerificationToken: token }],
    });

    console.log(`📧 Looking for user ${userId} with token: found=${!!user}`);

    if (!user) {
      // Try to find user without token to give better error message
      const userWithoutToken = await db
        .collection("user")
        .findOne({ $or: userQueries });
      if (userWithoutToken) {
        if (userWithoutToken.emailVerified === true) {
          // Reason: Outlook's Safe Links (and other mail scanners) open the link before
          // the player does, spending the token. The player's own click then lands here,
          // and telling them the link is invalid would be false - the account is verified.
          return { success: true, userId, alreadyVerified: true };
        }
        console.log(
          `📧 User found but token doesn't match. Stored token: ${userWithoutToken.emailVerificationToken?.substring(0, 10)}...`,
        );
        // Token doesn't match - user probably clicked old link after requesting new one
        return {
          success: false,
          error:
            "This verification link is outdated. Please check your email for the latest verification link, or request a new one.",
        };
      }
      return {
        success: false,
        error:
          "Invalid verification link. Please request a new verification email.",
      };
    }

    // Check if token has expired
    if (
      user.emailVerificationTokenExpiry &&
      new Date(user.emailVerificationTokenExpiry) < new Date()
    ) {
      return {
        success: false,
        error: "Verification link has expired. Please request a new one.",
      };
    }

    // Mark email as verified and clear token
    const updateResult = await db.collection("user").updateOne(
      { $or: userQueries },
      {
        $set: {
          emailVerified: true,
          updatedAt: new Date(),
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationTokenExpiry: "",
        },
      },
    );

    console.log(
      `✅ Email verified for user ${userId}: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`,
    );

    if (updateResult.modifiedCount === 0) {
      console.error(`⚠️ User found but update failed for ${userId}`);
      return {
        success: false,
        error: "Verification failed. Please try again.",
      };
    }

    if (typeof user.email === "string") {
      void sendWelcomeAfterVerification(user.email, typeof user.name === "string" ? user.name : "");
    }

    return { success: true, userId };
  } catch (error) {
    console.error("❌ Email verification failed:", error);
    return { success: false, error: "Verification failed. Please try again." };
  }
}

/**
 * Resend verification email
 * IMPORTANT: Reuses existing valid token to avoid invalidating emails user already received
 */
export async function resendVerificationEmail(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return { success: false, error: "Database connection failed" };
    }

    // Find user by email (case-insensitive)
    // Escape the email to prevent ReDoS attacks
    const user = await db.collection("user").findOne({
      // eslint-disable-next-line security/detect-non-literal-regexp -- input is escaped by escapeRegex
      email: { $regex: new RegExp(`^${escapeRegex(email)}$`, "i") },
    });

    if (!user) {
      return { success: false, error: "No account found with this email" };
    }

    if (user.emailVerified === true) {
      return { success: false, error: "Email is already verified" };
    }

    // Get user ID - better-auth may use 'id' field or '_id'
    const userId = user.id || user._id?.toString();

    if (!userId) {
      console.error("❌ User found but has no ID:", user.email);
      return { success: false, error: "User account error" };
    }

    console.log(
      `📧 Resending verification email to ${user.email} (userId: ${userId})`,
    );

    // Check if user already has a valid (non-expired) token
    // If so, reuse it instead of generating a new one (to avoid invalidating emails already sent)
    let token = user.emailVerificationToken;
    let tokenExpiry = user.emailVerificationTokenExpiry
      ? new Date(user.emailVerificationTokenExpiry)
      : null;
    const now = new Date();

    // If no token or token is expired, generate a new one
    if (!token || !tokenExpiry || tokenExpiry < now) {
      console.log(`📧 Generating new token (old token expired or missing)`);
      token = generateVerificationToken();
      tokenExpiry = getTokenExpiry();

      // Update token in database
      const userQueries = buildUserIdQuery(userId);
      await db.collection("user").updateOne(
        { $or: userQueries },
        {
          $set: {
            emailVerificationToken: token,
            emailVerificationTokenExpiry: tokenExpiry,
            updatedAt: new Date(),
          },
        },
      );
      console.log(`📧 New token stored for user ${userId}`);
    } else {
      console.log(
        `📧 Reusing existing valid token (expires: ${tokenExpiry.toISOString()})`,
      );
    }

    // Get settings for platform name and build email
    const settings = await getSettings();
    const platformName = settings.siteName || "ChartVolt";
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000";
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}&userId=${userId}`;

    // Get email template
    const EmailTemplate = (
      await import("@/database/models/email-template.model")
    ).default;
    const template = await EmailTemplate.findOne({
      templateType: "email_verification",
    });

    // Build email content
    const userName = user.name || "User";
    const subject =
      template?.subject?.replace("{{platformName}}", platformName) ||
      `Verify your email - ${platformName}`;
    const fromName =
      template?.fromName?.replace("{{platformName}}", platformName) ||
      platformName;
    const headingText =
      template?.headingText?.replace("{{name}}", userName) ||
      `Hi ${userName}, please verify your email`;
    const introText =
      template?.introText ||
      `Thanks for signing up! Please click the button below to verify your email address and activate your account.`;
    const ctaButtonText = template?.ctaButtonText || "Verify Email";

    const htmlContent = await buildVerificationHtml({
      subject,
      platformName,
      headingText,
      introText,
      ctaButtonText,
      verificationUrl,
    });

    // Send email using nodemailer transporter
    const { getTransporter } = await import("@/lib/nodemailer");
    const transporter = await getTransporter();

    try {
      await transporter.sendMail({
        to: user.email,
        subject,
        html: htmlContent,
        from: `${fromName} <${process.env.NODEMAILER_EMAIL || "noreply@chartvolt.com"}>`,
      });
      console.log(`✅ Verification email sent to ${user.email}`);
      return { success: true };
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError);
      return { success: false, error: "Failed to send verification email" };
    }
  } catch (error) {
    console.error("❌ Resend verification failed:", error);
    return { success: false, error: "Failed to resend verification email" };
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
    const user = await db.collection("user").findOne({ $or: userQueries });
    return user?.emailVerified === true;
  } catch (error) {
    console.error("❌ Error checking email verification:", error);
    return false;
  }
}

/**
 * Admin: Manually verify user's email
 */
export async function adminVerifyEmail(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return { success: false, error: "Database connection failed" };
    }

    const userQueries = buildUserIdQuery(userId);
    const result = await db.collection("user").updateOne(
      { $or: userQueries },
      {
        $set: {
          emailVerified: true,
          updatedAt: new Date(),
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationTokenExpiry: "",
        },
      },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    console.log(`✅ Admin manually verified email for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Admin email verification failed:", error);
    return { success: false, error: "Failed to verify email" };
  }
}

/**
 * Admin: Reset user's email verification status
 */
export async function adminResetEmailVerification(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return { success: false, error: "Database connection failed" };
    }

    const userQueries = buildUserIdQuery(userId);
    const result = await db.collection("user").updateOne(
      { $or: userQueries },
      {
        $set: {
          emailVerified: false,
          updatedAt: new Date(),
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationTokenExpiry: "",
        },
      },
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    console.log(`✅ Admin reset email verification for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Admin reset email verification failed:", error);
    return { success: false, error: "Failed to reset email verification" };
  }
}
