"use server";

import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";
import { sendVerificationEmail } from "@/lib/services/email-verification.service";
import {
  validateRegistration,
  validateLogin,
  recordFailedLogin,
  clearFailedLogins,
  getClientIP,
} from "@/lib/services/registration-security.service";
import { getFraudSettings } from "@/lib/services/fraud-settings.service";
import { parseSignupInterest } from "@/lib/utils/signup-interest";
import { playerTypeForSignupInterest } from "@/lib/utils/player-type";
import { parsePhoneInput } from "@/lib/utils/phone";
import { assertPhoneAvailable } from "@/lib/services/phone-uniqueness.service";
import { recordReferralClaim } from "@/lib/services/gamemaster/referral-claim.service";
import {
  checkUsernameAvailability,
  ensureUsernameIndex,
} from "@/lib/services/username.service";
import { validateUsername } from "@/lib/utils/username";
import type { Db } from "mongodb";

/** Undoes a sign-up whose profile could not be saved (only ever a username race). */
async function removeJustCreatedAccount(
  db: Db,
  userId: string,
  userQueries: Record<string, unknown>[],
): Promise<void> {
  const ownerIds: unknown[] = [userId];
  if (ObjectId.isValid(userId)) ownerIds.push(new ObjectId(userId));
  try {
    await Promise.all([
      db.collection("account").deleteMany({ userId: { $in: ownerIds } }),
      db.collection("session").deleteMany({ userId: { $in: ownerIds } }),
      db.collection("user").deleteOne({ $or: userQueries }),
    ]);
  } catch (cleanupError) {
    console.error("❌ Could not remove account after username race:", cleanupError);
  }
}

export const signUpWithEmail = async ({
  email,
  password,
  fullName,
  username,
  country,
  address,
  city,
  postalCode,
  phoneCountry,
  phoneNational,
  honeypot,
  referralCode,
  captchaToken,
  fingerprint,
  signupInterest,
}: SignUpFormData & {
  honeypot?: string;
  referralCode?: string;
  captchaToken?: string;
  fingerprint?: string;
}) => {
  try {
    // Get client IP for security checks
    const ip = await getClientIP();

    // SECURITY: Verify request Origin / Referer matches our own domain.
    // Reason: Server Actions can be invoked via direct POST from external
    // scripts/bots. Rejecting cross-origin callers blocks automated spam
    // tools that never hit our signup page in the browser.
    try {
      const hdrs = await headers();
      const origin = hdrs.get("origin") || "";
      const referer = hdrs.get("referer") || "";
      const host = hdrs.get("host") || "";

      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.BETTER_AUTH_URL ||
        ""
      ).toLowerCase();

      const allowedHosts = new Set<string>();
      if (host) allowedHosts.add(host.toLowerCase());
      try {
        if (appUrl) allowedHosts.add(new URL(appUrl).host.toLowerCase());
      } catch {
        /* ignore invalid URL */
      }

      // Only enforce when we have at least one allowed host AND the caller
      // provided an Origin or Referer. Server-to-server calls without these
      // headers are rare in browser flows; signed-in admin tooling would not
      // invoke this action.
      const candidateUrl = origin || referer;
      if (candidateUrl && allowedHosts.size > 0) {
        let callerHost = "";
        try {
          callerHost = new URL(candidateUrl).host.toLowerCase();
        } catch {
          callerHost = "";
        }

        if (!callerHost || !allowedHosts.has(callerHost)) {
          console.log(
            `🛡️ Signup blocked: cross-origin request origin="${origin}" referer="${referer}" host="${host}"`,
          );
          return {
            success: false,
            error: "Registration failed. Please try again.",
            code: "INVALID_ORIGIN",
          };
        }
      }
    } catch (originErr) {
      console.warn("⚠️ Origin check skipped due to error:", originErr);
      // Fail-open: don't block sign-ups if header access fails
    }

    // SECURITY: Validate registration with comprehensive checks
    const securityResult = await validateRegistration({
      email,
      name: fullName,
      honeypot,
      ip,
      captchaToken,
      fingerprint,
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

    // Reason: phone is mandatory for new registrations only (owner, 1 Oct 2026).
    // Parse before Better Auth creates the account so a bad or taken number never
    // leaves an orphan user row without a usable phone. Runs after the bot /
    // origin gates so a PHONE_TAKEN reply is not a free probe for scrapers.
    const phoneParsed = parsePhoneInput(phoneNational, phoneCountry);
    if (!phoneParsed.ok) {
      return {
        success: false,
        error: phoneParsed.error,
        code: "INVALID_PHONE",
      };
    }
    const phoneCheck = await assertPhoneAvailable(phoneParsed.e164);
    if (!phoneCheck.available) {
      return {
        success: false,
        error: phoneCheck.reason,
        code: phoneCheck.code,
      };
    }

    // Reason: a username is mandatory and unique (owner, 5 Oct 2026) - it is the only
    // identity other players see. Checked before the account exists so a taken name never
    // leaves an orphan user; the unique index below still decides a race between two
    // simultaneous sign-ups for the same name.
    const usernameCheck = await checkUsernameAvailability(username);
    if (!usernameCheck.available) {
      return {
        success: false,
        error: usernameCheck.error,
        code: "USERNAME_UNAVAILABLE",
      };
    }
    const chosenUsername = validateUsername(username);
    if (!chosenUsername.ok) {
      return {
        success: false,
        error: chosenUsername.error,
        code: "USERNAME_UNAVAILABLE",
      };
    }

    // Reason: the player type is mandatory (owner, 5 Oct 2026) and becomes the account's
    // role, so it is refused here, before the account exists, rather than defaulted - a
    // missing answer would otherwise silently make every bot and skipped form a trader.
    const interest = parseSignupInterest(signupInterest);
    const role = playerTypeForSignupInterest(interest);
    if (!interest || !role) {
      return {
        success: false,
        error: "Please choose whether you are a trader, a gamer or both.",
        code: "PLAYER_TYPE_REQUIRED",
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

        // The role is the player type chosen above (trader / gamer / both).
        // Staff roles can ONLY be assigned through the admin panel.
        const profileFields: Record<string, unknown> = {
          country,
          address,
          city,
          postalCode,
          // Reason: always E.164 so differently typed versions of one number collide
          // on the duplicate check. phoneCountry is the dial ISO for admin flags.
          phone: phoneParsed.e164,
          phoneCountry: phoneParsed.country,
          // Reason: unset means "never asked"; false means "registered, not yet
          // SMS-verified". SMS slots in later without migrating existing rows —
          // existing accounts keep these fields absent.
          phoneVerified: false,
          username: chosenUsername.value,
          usernameLower: chosenUsername.key,
          role, // Player type from the registration choice - never a staff role
          signupInterest: interest,
          signupInterestAt: new Date(),
          emailVerified: false, // Must verify email before login
          updatedAt: new Date(),
        };

        await ensureUsernameIndex(db as unknown as Db);
        let updateResult;
        try {
          updateResult = await db.collection("user").updateOne(
            { $or: queries },
            {
              $set: profileFields,
            },
          );
        } catch (profileError) {
          // Reason: someone else took this username between the availability check and
          // now. The account was just created and nobody has used it, so remove it rather
          // than leave a player who cannot be shown to anyone.
          if ((profileError as { code?: number })?.code === 11000) {
            await removeJustCreatedAccount(db as unknown as Db, userId, queries);
            return {
              success: false,
              error: "That username is already taken",
              code: "USERNAME_UNAVAILABLE",
            };
          }
          throw profileError;
        }

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
            phone: phoneParsed.e164,
            phoneCountry: phoneParsed.country,
            address,
            city,
            postalCode,
          });
        }

        // Process game master referral if present
        if (referralCode && referralCode.startsWith("GM")) {
          try {
            // Reason: sign-up does NOT attach the player (`External game plans/24` s5.3).
            // Registering gives no chance to read the Gamemaster terms, so it records a
            // pending claim; the player's first visit shows the terms once, and only an
            // acceptance becomes an affiliation - through `affiliate()`, the single writer.
            // A decline, or ignoring it, leaves the player unattached.
            let userAgent: string | undefined;
            try {
              userAgent = (await headers()).get("user-agent") || undefined;
            } catch {
              userAgent = undefined;
            }
            const result = await recordReferralClaim({
              user: { id: userId, email, name: fullName },
              referralCode,
              ipAddress: ip || undefined,
              userAgent,
            });

            if (result.recorded) {
              console.log(
                `✅ User ${userId} invited to Game Master ${result.gameMasterId} via referral code ${referralCode}; awaiting terms`,
              );
            } else {
              // Reason: a dropped referral is money a Game Master is owed and never gets,
              // so it must be visible in the logs rather than an info line nobody reads.
              console.warn(
                `⚠️ Referral dropped: code ${referralCode} refused (${result.reason}) for user ${userId}`,
              );
            }
          } catch (referralError) {
            console.error("⚠️ Failed to process referral:", referralError);
            // Don't fail registration if referral processing fails
          }
        } else if (referralCode) {
          console.warn(
            `⚠️ Referral dropped: code ${referralCode} is not a Game Master code (user ${userId})`,
          );
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

      // Reason: the welcome email is sent after verification (verifyEmailToken), not here.
      // Two link-heavy emails to a brand-new address in the same second is a strong spam
      // signal, and Outlook in particular then files the verification link as junk.

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
    // SECURITY: Reject non-string credentials. Server Actions serialize only
    // JSON-compatible values, so a crafted client can send `{email: {$gt: ""}}`
    // which Mongo would interpret as a query operator — classic NoSQL
    // injection. Reject anything that isn't a plain string before we touch
    // the database.
    // Reason: a generic "Invalid credentials" message avoids leaking that
    // the check rejected a type rather than a wrong password.
    if (typeof email !== "string" || typeof password !== "string") {
      // Best-effort security alert — imported lazily to avoid circular deps.
      try {
        const { recordSecurityAlert } = await import(
          "@/lib/services/security/security-alert.service"
        );
        await recordSecurityAlert({
          alertType: "nosql_injection_attempt",
          severity: "high",
          source: "signInWithEmail",
          reason: "Non-string credential rejected at login",
          metadata: {
            emailType: typeof email,
            passwordType: typeof password,
          },
        });
      } catch {
        // Non-blocking — the rejection itself is the primary defense.
      }
      return { success: false, error: "Invalid credentials." };
    }

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

      // Reason: Deactivated accounts must be blocked from logging in.
      // The account data is preserved but the user cannot access it.
      if (user && user.isDeactivated === true) {
        return {
          success: false,
          error:
            "This account has been deactivated. If you believe this is an error, please contact support.",
        };
      }

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

    // Reason: when the admin has disabled 2FA on login we still want
    // the withdrawal / password-change step-up gates to work. The
    // better-auth twoFactor plugin's sign-in hook gates off the single
    // `user.twoFactorEnabled` boolean, so we temporarily clear it for
    // the duration of the signInEmail call and restore it afterwards.
    // Enrolment state (the TOTP secret + backup codes in the `twoFactor`
    // collection) is never touched, which is what the withdrawal gate
    // and the /api/user/2fa/status endpoint read.
    let bypassUserId: ObjectId | null = null;
    try {
      if (db) {
        const fraud = await getFraudSettings().catch(() => null);
        if (fraud && fraud.requireTwoFactorForLogin === false) {
          const u = await db
            .collection("user")
            .findOne(
              { email },
              { projection: { _id: 1, twoFactorEnabled: 1 } },
            );
          if (u && u.twoFactorEnabled === true) {
            bypassUserId = u._id as ObjectId;
            await db
              .collection("user")
              .updateOne(
                { _id: bypassUserId },
                { $set: { twoFactorEnabled: false } },
              );
          }
        }
      }
    } catch (bypassErr) {
      console.warn(
        "⚠️ [signIn] login-2FA bypass preflight failed, continuing with default flow:",
        bypassErr instanceof Error ? bypassErr.message : bypassErr,
      );
      bypassUserId = null;
    }

    try {
      const response = await auth.api.signInEmail({
        body: { email, password },
      });

      // Reason: When the user has 2FA enabled, better-auth returns a
      // `twoFactorRedirect: true` payload and sets a short-lived 2FA
      // cookie (handled automatically by the nextCookies() plugin) that
      // the verify-2fa endpoints will consume. We must NOT clear failed
      // logins yet — the login is only complete once TOTP is verified.
      if (
        response &&
        typeof response === "object" &&
        "twoFactorRedirect" in (response as Record<string, unknown>) &&
        (response as { twoFactorRedirect?: boolean }).twoFactorRedirect === true
      ) {
        const methods =
          (response as { twoFactorMethods?: string[] }).twoFactorMethods || [
            "totp",
          ];
        return {
          success: true,
          twoFactorRequired: true,
          twoFactorMethods: methods,
        };
      }

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
    } finally {
      // Reason: always restore the twoFactorEnabled flag we cleared for
      // the login-2FA bypass. If this update fails (e.g. DB hiccup) the
      // user is left with `twoFactorEnabled=false`, which only matters
      // the next time the admin flips `requireTwoFactorForLogin` back
      // on — at which point better-auth would skip the challenge for
      // this user. Enrolment (the TOTP secret in the `twoFactor` coll.)
      // remains intact, so the withdrawal gate still enforces 2FA.
      if (bypassUserId && db) {
        try {
          await db
            .collection("user")
            .updateOne(
              { _id: bypassUserId },
              { $set: { twoFactorEnabled: true } },
            );
        } catch (restoreErr) {
          console.error(
            "❌ [signIn] failed to restore twoFactorEnabled after login-2FA bypass:",
            restoreErr,
          );
        }
      }
    }
  } catch (e) {
    console.log("Sign in failed", e);
    return { success: false, error: "Invalid email or password" };
  }
};

export const signOut = async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
    return { success: true };
  } catch (e) {
    console.log("Sign out failed", e);
    return { success: false, error: "Sign out failed" };
  }
};
