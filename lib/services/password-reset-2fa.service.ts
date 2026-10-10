/**
 * Session-less 2FA for the forgot-password flow.
 *
 * better-auth's verifyTOTP needs a session cookie. A player resetting a
 * forgotten password has none, so we decrypt the stored TOTP secret (same
 * BETTER_AUTH_SECRET) and verify locally. A short-lived verification row
 * records that 2FA passed for this reset token before the password can change.
 */

import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { safeJSONParse } from "@better-auth/core/utils";

import { connectToDatabase } from "@/database/mongoose";

const RESET_TOKEN_PREFIX = "reset-password:";
const RESET_2FA_PREFIX = "reset-password-2fa:";

function userIdFilter(userId: string): Record<string, unknown> {
  let oid: ObjectId | null = null;
  try {
    oid = new ObjectId(userId);
  } catch {
    oid = null;
  }
  return oid ? { userId: { $in: [oid, userId] } } : { userId };
}

function asUserIdString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (
    value &&
    typeof value === "object" &&
    "toHexString" in value &&
    typeof (value as { toHexString: () => string }).toHexString === "function"
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }
  return null;
}

/** Resolve the user id stored on a better-auth reset-password verification row. */
export async function resolveResetTokenUserId(
  token: string,
): Promise<{ userId: string; expiresAt: Date } | null> {
  if (!token || typeof token !== "string" || token.length < 8) return null;

  await connectToDatabase();
  const col = mongoose.connection.collection("verification");
  const row = await col.findOne({
    identifier: `${RESET_TOKEN_PREFIX}${token}`,
  });
  if (!row) return null;

  const expiresAt =
    row.expiresAt instanceof Date
      ? row.expiresAt
      : new Date(String(row.expiresAt));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    return null;
  }

  const userId = asUserIdString(row.value);
  if (!userId) return null;
  // Reason: after we mark 2FA we must not mutate the reset token's value —
  // better-auth's resetPassword reads it as the user id verbatim.
  return { userId, expiresAt };
}

export async function userHasTwoFactorEnrolment(
  userId: string,
): Promise<boolean> {
  await connectToDatabase();
  const col = mongoose.connection.collection("twoFactor");
  const record = await col.findOne(userIdFilter(userId), {
    projection: { _id: 1 },
  });
  return Boolean(record);
}

async function verifyTotpAgainstSecret(
  encryptedSecret: string,
  code: string,
): Promise<boolean> {
  const secretKey = process.env.BETTER_AUTH_SECRET;
  if (!secretKey) {
    console.error("❌ [password-reset-2fa] BETTER_AUTH_SECRET missing");
    return false;
  }
  try {
    const secret = await symmetricDecrypt({
      key: secretKey,
      data: encryptedSecret,
    });
    return await createOTP(secret, { period: 30, digits: 6 }).verify(code);
  } catch (err) {
    console.warn("⚠️ [password-reset-2fa] TOTP verify failed:", err);
    return false;
  }
}

async function verifyAndConsumeBackupCode(
  userId: string,
  encryptedOrJsonCodes: string,
  code: string,
): Promise<boolean> {
  const secretKey = process.env.BETTER_AUTH_SECRET;
  if (!secretKey) return false;

  let codes: string[] | null = null;
  try {
    // Reason: default better-auth storage is plain JSON; "encrypted" mode uses
    // symmetricDecrypt. Try JSON first, then decrypt — both are legitimate.
    codes = safeJSONParse<string[]>(encryptedOrJsonCodes);
    if (!codes) {
      const decrypted = await symmetricDecrypt({
        key: secretKey,
        data: encryptedOrJsonCodes,
      });
      codes = safeJSONParse<string[]>(decrypted);
    }
  } catch {
    codes = null;
  }

  if (!codes || !Array.isArray(codes) || !codes.includes(code)) {
    return false;
  }

  const remaining = codes.filter((c) => c !== code);
  await connectToDatabase();
  const col = mongoose.connection.collection("twoFactor");
  // Reason: store remaining codes the same way we found them — plain JSON
  // matches the plugin default when storeBackupCodes is unset.
  await col.updateOne(userIdFilter(userId), {
    $set: { backupCodes: JSON.stringify(remaining) },
  });
  return true;
}

/**
 * Verify a TOTP or backup code for a user with no session.
 * Consumes a matching backup code when that path is used.
 */
export async function verifyTwoFactorWithoutSession(
  userId: string,
  code: string,
): Promise<boolean> {
  const trimmed = (code || "").trim();
  if (!trimmed) return false;

  await connectToDatabase();
  const col = mongoose.connection.collection("twoFactor");
  const record = await col.findOne(userIdFilter(userId));
  if (!record) return false;

  const secret =
    typeof record.secret === "string" ? record.secret : null;
  const backupCodes =
    typeof record.backupCodes === "string" ? record.backupCodes : null;

  const isTotp = /^\d{6,8}$/.test(trimmed);
  if (isTotp && secret) {
    return verifyTotpAgainstSecret(secret, trimmed);
  }
  if (backupCodes) {
    return verifyAndConsumeBackupCode(userId, backupCodes, trimmed);
  }
  return false;
}

/** Persist that 2FA passed for this reset token (expires with the token). */
export async function markResetTokenTwoFactorVerified(
  token: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  await connectToDatabase();
  const col = mongoose.connection.collection("verification");
  const identifier = `${RESET_2FA_PREFIX}${token}`;
  await col.updateOne(
    { identifier },
    {
      $set: {
        identifier,
        value: userId,
        expiresAt,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function isResetTokenTwoFactorVerified(
  token: string,
): Promise<boolean> {
  await connectToDatabase();
  const col = mongoose.connection.collection("verification");
  const row = await col.findOne({
    identifier: `${RESET_2FA_PREFIX}${token}`,
  });
  if (!row) return false;
  const expiresAt =
    row.expiresAt instanceof Date
      ? row.expiresAt
      : new Date(String(row.expiresAt));
  return !(Number.isNaN(expiresAt.getTime()) || expiresAt < new Date());
}

export async function clearResetTokenTwoFactorProof(
  token: string,
): Promise<void> {
  await connectToDatabase();
  const col = mongoose.connection.collection("verification");
  await col.deleteOne({ identifier: `${RESET_2FA_PREFIX}${token}` });
}
