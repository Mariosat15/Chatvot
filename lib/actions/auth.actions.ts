"use server";

import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";
import { sendWelcomeEmail } from "@/lib/nodemailer";
import EmailTemplate from "@/database/models/email-template.model";
import { sendVerificationEmail } from "@/lib/services/email-verification.service";
import {
  validateRegistration,
  validateLogin,
  recordFailedLogin,
  clearFailedLogins,
  getClientIP,
} from "@/lib/services/registration-security.service";

export const signUpWithEmail = async ({
  email,
  password,
  fullName,
  country,
  address,
  city,
  postalCode,
  honeypot,
  referralCode,
}: SignUpFormData & { honeypot?: string; referralCode?: string }) => {
  try {
    // Get client IP for security checks
    const ip = await getClientIP();

    // SECURITY: Validate registration with comprehensive checks
    const securityResult = await validateRegistration({
      email,
      name: fullName,
      honeypot,
      ip,
    });

    if (!securityResult.allowed) {
      console.log(
        `🛡️ Registration blocked: ${securityResult.code} - ${securityResult.reason}`,
      );
      return {
        error:
          securityResult.reason || "Registration failed. Please try again.",
        success: false,
        code: securityResult.code,
      };
    }

    // Log high-risk registrations
    if (securityResult.riskScore && securityResult.riskScore >= 40) {
      console.log(
        `⚠️ High-risk registration allowed: email=${email}, ip=${ip}, score=${securityResult.riskScore}`,
      );
    }

    // SECURITY: Prevent users from signing up with admin email
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || "";
    if (email.toLowerCase() === adminEmail) {
      return {
        error: "This email address is not available for registration",
        success: false,
      };
    }

    const response = await auth.api.signUpEmail({
      body: { email, password, name: fullName },
    });

    if (response && response.user) {
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
        const role = "trader";

        const updateResult = await db.collection("user").updateOne(
          { $or: queries },
          {
            $set: {
              country,
              address,
              city,
              postalCode,
              role, // All signups are traders - admin role assigned via admin panel only
              emailVerified: false, // Must verify email before login
              updatedAt: new Date(),
            },
          },
        );

        console.log(
          `📝 Sign-up: Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`,
        );

        if (updateResult.matchedCount === 0) {
          console.error(
            `⚠️ Sign-up: Could not find user to update profile data. userId: ${userId}`,
          );
        } else {
          console.log(`✅ Sign-up: Profile data saved for user ${userId}`, {
            country,
            address,
            city,
            postalCode,
          });
        }

        // Process game master referral if present
        if (referralCode && referralCode.startsWith("GM")) {
          try {
            console.log(`🎮 Processing referral code: ${referralCode}`);

            // Find the game master subscription with this referral code
            const gmSubscription = await db
              .collection("gamemastersubscriptions")
              .findOne({
                referralCode: referralCode,
                status: "active",
              });

            if (gmSubscription) {
              const referredAt = new Date();

              // STEP 1: Update the user document with referral info
              // This MUST succeed before we create other records
              const userUpdateResult = await db.collection("user").updateOne(
                { $or: queries },
                {
                  $set: {
                    referredByGameMasterId: gmSubscription.userId,
                    referredByReferralCode: referralCode,
                    referredAt: referredAt,
                  },
                },
              );

              // CRITICAL: Verify user was actually updated
              if (userUpdateResult.matchedCount === 0) {
                console.error(
                  `❌ Referral: Failed to find user ${userId} to update with referral data`,
                );
                throw new Error("User not found for referral update");
              }

              if (userUpdateResult.modifiedCount === 0) {
                console.warn(
                  `⚠️ Referral: User ${userId} already had referral data or update failed`,
                );
                // Continue anyway - user might already have the referral set
              }

              console.log(
                `✅ Referral: Updated user ${userId} with GM reference`,
              );

              // STEP 2: Check if UserReferral already exists (prevent duplicates)
              const existingReferral = await db
                .collection("userreferrals")
                .findOne({
                  userId: userId,
                  gameMasterId: gmSubscription.userId,
                });

              if (existingReferral) {
                console.warn(
                  `⚠️ Referral: UserReferral already exists for user ${userId} -> GM ${gmSubscription.userId}`,
                );
              } else {
                // STEP 3: Create UserReferral record
                const referralInsertResult = await db
                  .collection("userreferrals")
                  .insertOne({
                    userId: userId,
                    userEmail: email,
                    userName: fullName,
                    gameMasterId: gmSubscription.userId,
                    gameMasterEmail: gmSubscription.userEmail,
                    referralCode: referralCode,
                    referredAt: referredAt,
                    signupIP: ip || undefined,
                    isActive: true,
                    totalEntryFees: 0,
                    totalGMEarnings: 0,
                    competitionsEntered: 0,
                    challengesEntered: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });

                if (!referralInsertResult.insertedId) {
                  console.error(
                    `❌ Referral: Failed to create UserReferral record for user ${userId}`,
                  );
                  throw new Error("Failed to create UserReferral record");
                }

                console.log(
                  `✅ Referral: Created UserReferral record ${referralInsertResult.insertedId}`,
                );

                // STEP 4: Only increment counter AFTER UserReferral is created
                const counterUpdateResult = await db
                  .collection("gamemastersubscriptions")
                  .updateOne(
                    { _id: gmSubscription._id },
                    {
                      $inc: {
                        totalReferredUsers: 1,
                        activeReferredUsers: 1,
                      },
                    },
                  );

                if (counterUpdateResult.modifiedCount === 0) {
                  console.error(
                    `❌ Referral: Failed to increment GM counter for ${gmSubscription._id}`,
                  );
                  // Don't throw - referral is already created, counter can be fixed via sync
                } else {
                  console.log(
                    `✅ Referral: Incremented GM ${gmSubscription.userId} referral count`,
                  );
                }
              }

              console.log(
                `✅ User ${userId} successfully linked to Game Master ${gmSubscription.userId} via referral code ${referralCode}`,
              );
            } else {
              console.log(
                `⚠️ Referral code ${referralCode} not found or game master not active`,
              );
            }
          } catch (referralError) {
            console.error("⚠️ Failed to process referral:", referralError);
            // Don't fail registration if referral processing fails
          }
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
          console.error(
            "⚠️ Failed to send verification email:",
            verificationError,
          );
          // Don't fail registration, but log it
        }
      }

      // Send welcome email (separate from verification)
      try {
        const template = await EmailTemplate.findOne({
          templateType: "welcome",
        }).lean();
        if (template?.isActive !== false) {
          const introText =
            template?.introText ||
            "Thanks for joining! You now have access to our trading competition platform where you can compete against other traders and win real prizes.";
          await sendWelcomeEmail({ email, name: fullName, intro: introText });
          console.log(`✅ Welcome email sent to ${email}`);
        } else {
          console.log("📧 Welcome email is disabled in settings, skipping...");
        }
      } catch (emailError) {
        console.error("⚠️ Failed to send welcome email:", emailError);
        // Don't fail registration if email fails
      }

      // Auto-assign customer to employee (if enabled)
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.VERCEL_URL ||
          "http://localhost:3000";
        const newUserId = response.user.id; // Get userId from response (available in this scope)
        console.log(
          `🎯 [AutoAssign] Calling auto-assign API at: ${baseUrl}/api/customer-assignment/auto-assign`,
        );
        console.log(
          `🎯 [AutoAssign] Payload: userId=${newUserId}, userEmail=${email}, userName=${fullName}`,
        );

        const autoAssignResponse = await fetch(
          `${baseUrl}/api/customer-assignment/auto-assign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: newUserId,
              userEmail: email,
              userName: fullName,
            }),
          },
        );

        console.log(
          `🎯 [AutoAssign] Response status: ${autoAssignResponse.status}`,
        );

        if (autoAssignResponse.ok) {
          const result = await autoAssignResponse.json();
          console.log(`🎯 [AutoAssign] Response data:`, JSON.stringify(result));
          if (result.assigned) {
            console.log(
              `✅ Customer auto-assigned to ${result.employee?.name}`,
            );
          } else {
            console.log(`📋 Customer not auto-assigned: ${result.reason}`);
          }
        } else {
          const errorText = await autoAssignResponse.text();
          console.log(`❌ [AutoAssign] Error response: ${errorText}`);
        }
      } catch (autoAssignError) {
        console.error("⚠️ Failed to auto-assign customer:", autoAssignError);
        // Don't fail registration if auto-assign fails
      }
    }

    return { success: true, data: response };
  } catch (e) {
    console.log("Sign up failed", e);
    return { success: false, error: "Sign up failed" };
  }
};

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
  try {
    const ip = await getClientIP();

    // SECURITY: Check login rate limiting and account lockout
    const loginCheck = await validateLogin({ email, ip });

    if (!loginCheck.allowed) {
      console.log(
        `🔒 Login blocked: ${loginCheck.code} for ${email} from IP ${ip}`,
      );

      // Calculate remaining time for user-friendly message
      let errorMessage =
        loginCheck.reason || "Too many login attempts. Please try again later.";
      if (loginCheck.lockoutUntil) {
        const remainingMs = loginCheck.lockoutUntil.getTime() - Date.now();
        if (remainingMs > 0) {
          const remainingMinutes = Math.ceil(remainingMs / 60000);
          errorMessage = `Account temporarily locked. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}.`;
        }
      }

      return {
        success: false,
        error: errorMessage,
        code: loginCheck.code,
        lockoutUntil: loginCheck.lockoutUntil,
        remainingMinutes: loginCheck.lockoutUntil
          ? Math.ceil((loginCheck.lockoutUntil.getTime() - Date.now()) / 60000)
          : undefined,
      };
    }

    // First check if email is verified
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (db) {
      const user = await db.collection("user").findOne({ email });

      // Block if user exists and email is NOT verified
      // emailVerified can be false, null, or undefined - all mean not verified
      // This matches the check in app/(root)/layout.tsx
      if (user && user.emailVerified !== true) {
        return {
          success: false,
          error:
            "Please verify your email before signing in. Check your inbox for the verification link.",
          needsVerification: true,
          email: email,
        };
      }
    }

    try {
      const response = await auth.api.signInEmail({
        body: { email, password },
      });

      // SECURITY: Clear failed login attempts on success
      await clearFailedLogins({ email, ip });

      return { success: true, data: response };
    } catch {
      // SECURITY: Record failed login attempt
      const failResult = await recordFailedLogin({ email, ip });

      if (failResult.locked) {
        console.log(`🔒 Account locked after failed attempt: ${email}`);

        // Calculate remaining time for user-friendly message
        let lockoutMessage =
          "Account temporarily locked due to too many failed attempts.";
        let remainingMinutes = 0;
        if (failResult.lockoutUntil) {
          const remainingMs = failResult.lockoutUntil.getTime() - Date.now();
          remainingMinutes = Math.ceil(remainingMs / 60000);
          if (remainingMinutes > 0) {
            lockoutMessage = `Account temporarily locked. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}.`;
          }
        }

        return {
          success: false,
          error: lockoutMessage,
          code: "ACCOUNT_LOCKED",
          lockoutUntil: failResult.lockoutUntil,
          remainingMinutes,
        };
      }

      const remainingMsg =
        failResult.remainingAttempts > 0
          ? ` (${failResult.remainingAttempts} attempts remaining)`
          : "";

      console.log(
        `⚠️ Failed login for ${email} from IP ${ip}. Remaining: ${failResult.remainingAttempts}`,
      );
      return {
        success: false,
        error: `Invalid email or password${remainingMsg}`,
      };
    }
  } catch (e) {
    console.log("Sign in failed", e);
    return { success: false, error: "Invalid email or password" };
  }
};

export const signOut = async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (e) {
    console.log("Sign out failed", e);
    return { success: false, error: "Sign out failed" };
  }
};
