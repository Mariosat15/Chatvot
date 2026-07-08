/**
 * Registration Security Service
 *
 * State-of-the-art protection against:
 * - Bot registration attacks
 * - Disposable email abuse
 * - Rate limiting violations
 * - Suspicious pattern detection
 * - Brute force attacks
 *
 * All checks are configurable via the admin Fraud Settings panel.
 */

import { connectToDatabase } from "@/database/mongoose";
import FraudSettings, {
  IFraudSettings,
  DEFAULT_FRAUD_SETTINGS,
} from "@/database/models/fraud/fraud-settings.model";
import { headers } from "next/headers";
import { evaluateIpRisk } from "./ip-detection.service";
import { verifyCaptcha } from "./captcha.service";

// In-memory rate limiting cache (consider Redis for production clusters)
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

const registrationRateLimit: Map<string, RateLimitEntry> = new Map();
const loginRateLimit: Map<string, RateLimitEntry> = new Map();
// Reason: enforces `registrationCooldownMinutes` — the minimum gap between
// successful registrations from the same IP. Maps IP → last-registration ms.
const registrationCooldown: Map<string, number> = new Map();
// Reason: enforces `maxSignupsPerHour` per device fingerprint (when the signup
// form supplies one). Maps fingerprint → { count, windowStart ms }.
const signupsByFingerprint: Map<string, { count: number; windowStart: number }> =
  new Map();
const failedLoginAttempts: Map<
  string,
  { count: number; lastAttempt: number; lockedUntil?: number }
> = new Map();

// Flag to track if we've loaded lockouts from database on startup
let lockoutsLoadedFromDB = false;

/**
 * Load active lockouts from database into memory
 * Called automatically on first login validation
 */
async function ensureLockoutsLoaded(): Promise<void> {
  if (lockoutsLoadedFromDB) return;

  try {
    console.log("📥 [Startup] Loading active lockouts from database...");
    const { connectToDatabase } = await import("@/database/mongoose");
    await connectToDatabase();

    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;
    const now = new Date();

    // Load active lockouts that haven't expired
    const activeLockouts = await AccountLockout.find({
      isActive: true,
      $or: [
        { lockedUntil: { $gt: now } }, // Temporary lockouts not yet expired
        { lockedUntil: null }, // Permanent lockouts
      ],
    });

    let loaded = 0;
    for (const lockout of activeLockouts) {
      const key = `${lockout.email}:${lockout.ipAddress || "unknown"}`;
      failedLoginAttempts.set(key, {
        count: lockout.failedAttempts || 5,
        lastAttempt: lockout.lastAttemptAt?.getTime() || Date.now(),
        lockedUntil: lockout.lockedUntil?.getTime(),
      });
      loaded++;
    }

    if (loaded > 0) {
      console.log(
        `✅ [Startup] Loaded ${loaded} active lockouts from database into memory`,
      );
    } else {
      console.log("✅ [Startup] No active lockouts found in database");
    }

    lockoutsLoadedFromDB = true;
  } catch (error) {
    console.error("❌ [Startup] Failed to load lockouts from database:", error);
    // Don't retry - set flag to prevent repeated attempts
    lockoutsLoadedFromDB = true;
  }
}

// Clean up old entries every 10 minutes
setInterval(
  () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [key, entry] of registrationRateLimit.entries()) {
      if (now - entry.lastAttempt > oneHour) {
        registrationRateLimit.delete(key);
      }
    }

    for (const [key, entry] of loginRateLimit.entries()) {
      if (now - entry.lastAttempt > oneHour) {
        loginRateLimit.delete(key);
      }
    }

    for (const [key, entry] of failedLoginAttempts.entries()) {
      if (entry.lockedUntil && now > entry.lockedUntil) {
        failedLoginAttempts.delete(key);
      } else if (now - entry.lastAttempt > oneHour) {
        failedLoginAttempts.delete(key);
      }
    }

    for (const [key, last] of registrationCooldown.entries()) {
      if (now - last > oneHour) registrationCooldown.delete(key);
    }

    for (const [key, entry] of signupsByFingerprint.entries()) {
      if (now - entry.windowStart > oneHour) signupsByFingerprint.delete(key);
    }
  },
  10 * 60 * 1000,
);

// Extended disposable email domains list (comprehensive)
const EXTENDED_DISPOSABLE_DOMAINS = [
  // Popular disposable services
  "tempmail.com",
  "guerrillamail.com",
  "10minutemail.com",
  "throwaway.email",
  "mailinator.com",
  "yopmail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "getnada.com",
  "mohmal.com",
  "tempail.com",
  "dispostable.com",
  "mailnesia.com",
  "trashmail.com",
  "sharklasers.com",
  "guerrillamail.info",
  "grr.la",
  "spam4.me",
  "mytemp.email",
  "tempr.email",
  "discard.email",
  "dropmail.me",
  "emailondeck.com",
  "getairmail.com",
  "crazymailing.com",
  // Additional domains
  "tempinbox.com",
  "throwawaymail.com",
  "mailcatch.com",
  "mailsac.com",
  "tmpmail.org",
  "tmpmail.net",
  "mailtemp.net",
  "guerillamail.com",
  "guerillamail.net",
  "guerillamail.org",
  "guerillamail.biz",
  "guerillamail.de",
  "maildrop.cc",
  "inboxalias.com",
  "spamgourmet.com",
  "mintemail.com",
  "mytrashmail.com",
  "tempomail.fr",
  "mailforspam.com",
  "spambox.us",
  "incognitomail.org",
  "hushmail.me",
  "anonmails.de",
  "anonymbox.com",
  "fakemailgenerator.com",
  "getnowmail.com",
  "instantemailaddress.com",
  "jetable.org",
  "kasmail.com",
  "mailexpire.com",
  "mailnull.com",
  "nospam.ws",
  "nwldx.com",
  "otherinbox.com",
  "pookmail.com",
  "rcpt.at",
  "rmqkr.net",
  "safetymail.info",
  "sendspamhere.com",
  "sofimail.com",
  "spamavert.com",
  "spamday.com",
  "spamfree24.org",
  "spamobox.com",
  "tempemail.net",
  "tempmailer.com",
  "tempmailo.com",
  "tempmailaddress.com",
  "throwam.com",
  "trashmail.net",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "yepmail.net",
  "yuurok.com",
  "zehnminutenmail.de",
  "cock.li",
  "airmail.cc",
  "getmail.com",
  "protonmail.com",
  "tutanota.com",
  "tutanota.de",
  "tutamail.com",
  // Numbers-based domains
  "10mail.org",
  "20mail.it",
  "33mail.com",
  "60minutemail.com",
  // Misc
  "burnermail.io",
  "tempemailaddress.com",
  "binkmail.com",
  "bobmail.info",
  "bofthew.com",
  "budaya-tionghoa.com",
  "bugmenot.com",
  "cellurl.com",
  "cheatmail.de",
  "crapmail.org",
  "e4ward.com",
  "emailigo.de",
  "emailsensei.com",
  "emailtemporario.com.br",
  "ephemail.net",
  "etranquil.com",
  "example.com",
];

export interface RegistrationSecurityResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  riskScore?: number;
}

export interface LoginSecurityResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  remainingAttempts?: number;
  lockoutUntil?: Date;
}

/**
 * Get current fraud settings (cached)
 */
let cachedSettings: IFraudSettings | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute cache

async function getFraudSettings(): Promise<IFraudSettings> {
  const now = Date.now();

  if (cachedSettings && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  try {
    await connectToDatabase();
    let settings = await FraudSettings.findOne();

    if (!settings) {
      settings = await FraudSettings.create(DEFAULT_FRAUD_SETTINGS);
    }

    cachedSettings = settings;
    settingsCacheTime = now;
    return settings;
  } catch (error) {
    console.error("Error loading fraud settings:", error);
    // Return defaults if DB fails
    return DEFAULT_FRAUD_SETTINGS as IFraudSettings;
  }
}

/**
 * Get client IP from request headers
 */
export async function getClientIP(): Promise<string> {
  try {
    const headersList = await headers();

    // Check various headers for real IP (in order of reliability)
    const forwardedFor = headersList.get("x-forwarded-for");
    if (forwardedFor) {
      // Get the first IP in the chain (client IP)
      return forwardedFor.split(",")[0].trim();
    }

    const realIP = headersList.get("x-real-ip");
    if (realIP) return realIP;

    const cfConnectingIP = headersList.get("cf-connecting-ip");
    if (cfConnectingIP) return cfConnectingIP;

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Check if email is from a disposable email service
 */
export function isDisposableEmail(
  email: string,
  customDomains: string[] = [],
): boolean {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;

  // Check extended list
  if (EXTENDED_DISPOSABLE_DOMAINS.includes(domain)) {
    return true;
  }

  // Check custom domains from settings
  if (
    customDomains.some(
      (d) =>
        domain === d.toLowerCase() || domain.endsWith("." + d.toLowerCase()),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Check if email domain is blocked
 */
export function isBlockedEmailDomain(
  email: string,
  blockedDomains: string[],
): boolean {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;

  return blockedDomains.some(
    (d) => domain === d.toLowerCase() || domain.endsWith("." + d.toLowerCase()),
  );
}

/**
 * Check if name matches suspicious patterns
 */
export function isSuspiciousName(
  name: string,
  patterns: string[],
): { suspicious: boolean; pattern?: string } {
  // Reason: Match against the ORIGINAL (non-lowercased) string too so regex
  // patterns that include character-class ranges (e.g. Cyrillic) still fire.
  const lowerName = name.toLowerCase().trim();
  const rawName = name.trim();

  for (const pattern of patterns) {
    try {
      // Patterns are admin-controlled via FraudSettings, not user input.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regex = new RegExp(pattern, "i");
      if (regex.test(lowerName) || regex.test(rawName)) {
        return { suspicious: true, pattern };
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return { suspicious: false };
}

/**
 * Detect URL-like tokens in a display name (spam campaigns often embed links).
 *
 * Matches:
 *  - http:// or https:// protocols
 *  - shortener domains (bit.ly, tinyurl, t.me)
 *  - raw www. prefix
 *  - common TLDs (.com/.ru/.xyz/.io/.net) with slash, end, or word boundary
 */
export function nameContainsUrl(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;

  const urlPatterns: RegExp[] = [
    /https?:\/\//i,
    /\bwww\./i,
    /\bbit\.ly\b/i,
    /\btinyurl\b/i,
    /\bt\.me\//i,
    /\b[a-z0-9-]+\.(com|net|org|ru|xyz|io|co|info|biz|me|site|online|shop|live|gg|tv|top|click)(\/|$|\s)/i,
  ];

  return urlPatterns.some((p) => p.test(normalized));
}

/**
 * Count emoji / pictographic characters in a string.
 * Uses Unicode property escapes — supported in Node 10+ / ES2018.
 */
export function countEmojis(input: string): number {
  const matches = input.match(/\p{Extended_Pictographic}/gu);
  return matches ? matches.length : 0;
}

/**
 * Check whether the first non-whitespace character is an ASCII or Unicode letter.
 * Rejects names that start with digits, punctuation, symbols, or emojis
 * (e.g. "🌶 85.000 Lira ...").
 */
export function startsWithLetter(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return /^\p{L}/u.test(trimmed);
}

/**
 * Check if an IP matches any entry in the known-bad list.
 * Supports exact match and simple CIDR prefix match ("1.2.3.0/24").
 */
export function isKnownBadIP(ip: string, knownBadIPs: string[]): boolean {
  if (!ip || ip === "unknown" || !knownBadIPs?.length) return false;

  for (const entry of knownBadIPs) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Exact match
    if (trimmed === ip) return true;

    // Simple IPv4 CIDR (e.g. "203.0.113.0/24") — prefix-based
    if (trimmed.includes("/")) {
      const [network, prefixStr] = trimmed.split("/");
      const prefix = parseInt(prefixStr, 10);
      if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) continue;

      const ipParts = ip.split(".").map((p) => parseInt(p, 10));
      const netParts = network.split(".").map((p) => parseInt(p, 10));
      if (ipParts.length !== 4 || netParts.length !== 4) continue;
      if (ipParts.some((n) => Number.isNaN(n))) continue;

      // Compare the first `prefix` bits
      const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
      const ipInt =
        ((ipParts[0] << 24) |
          (ipParts[1] << 16) |
          (ipParts[2] << 8) |
          ipParts[3]) >>>
        0;
      const netInt =
        ((netParts[0] << 24) |
          (netParts[1] << 16) |
          (netParts[2] << 8) |
          netParts[3]) >>>
        0;

      if ((ipInt & mask) === (netInt & mask)) return true;
    }
  }

  return false;
}

/**
 * Check registration rate limit for IP
 */
function checkRegistrationRateLimit(
  ip: string,
  maxPerHour: number,
  maxPerDay: number,
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  const entry = registrationRateLimit.get(ip);

  if (!entry) {
    registrationRateLimit.set(ip, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { allowed: true };
  }

  // Reset if more than 24 hours since first attempt
  if (now - entry.firstAttempt > oneDay) {
    registrationRateLimit.set(ip, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return { allowed: true };
  }

  // Check hourly limit
  if (now - entry.lastAttempt < oneHour && entry.count >= maxPerHour) {
    return {
      allowed: false,
      reason: "Too many registration attempts. Please try again later.",
    };
  }

  // Check daily limit
  if (entry.count >= maxPerDay) {
    return {
      allowed: false,
      reason: "Daily registration limit reached. Please try again tomorrow.",
    };
  }

  // Update count
  entry.count++;
  entry.lastAttempt = now;

  return { allowed: true };
}

/**
 * Check if honeypot was triggered (bot detection)
 */
export function checkHoneypot(honeypotValue?: string): boolean {
  // Honeypot should be empty - if filled, it's a bot
  return !!honeypotValue && honeypotValue.trim().length > 0;
}

/**
 * Main registration security check
 * Call this before processing registration
 */
export async function validateRegistration(data: {
  email: string;
  name: string;
  honeypot?: string;
  ip?: string;
  fingerprint?: string;
  captchaToken?: string;
}): Promise<RegistrationSecurityResult> {
  const settings = await getFraudSettings();
  const ip = data.ip || (await getClientIP());
  let riskScore = 0;

  // 1. Check honeypot (bot trap)
  if (settings.honeypotEnabled && checkHoneypot(data.honeypot)) {
    console.log(`🤖 Bot detected via honeypot from IP: ${ip}`);
    return {
      allowed: false,
      reason: settings.genericErrorMessages
        ? "Registration failed. Please try again."
        : "Bot detected.",
      code: "BOT_DETECTED",
      riskScore: 100,
    };
  }

  // 2. Check IP whitelist (skip other checks if whitelisted)
  if (settings.whitelistedIPs?.includes(ip)) {
    return { allowed: true, riskScore: 0 };
  }

  // 2b. Check known-bad IP list (reputation)
  // Reason: settings flag `blockKnownBadIPs` existed but was not wired to any
  // list — now it consults the admin-curated `knownBadIPs` array.
  if (
    settings.blockKnownBadIPs &&
    isKnownBadIP(ip, settings.knownBadIPs || [])
  ) {
    console.log(`🛡️ Registration blocked: known-bad IP ${ip}`);
    return {
      allowed: false,
      reason: settings.genericErrorMessages
        ? "Registration failed. Please try again."
        : "Your IP address has been flagged. Registration not allowed.",
      code: "BAD_IP",
      riskScore: 100,
    };
  }

  // 2c. CAPTCHA challenge (server-side verification)
  // Reason: the "Require CAPTCHA" toggle previously verified nothing. Now we
  // validate the token with the provider. Skips gracefully when disabled or the
  // server secret isn't configured, so it can't accidentally lock out signups.
  const captcha = await verifyCaptcha({
    enabled: settings.registrationChallengeEnabled,
    provider: settings.registrationChallengeProvider,
    token: data.captchaToken,
    ip,
  });
  if (!captcha.ok) {
    console.log(`🛡️ Registration blocked: CAPTCHA failed for IP ${ip}`);
    return {
      allowed: false,
      reason: captcha.reason || "Verification failed. Please try again.",
      code: "CAPTCHA_FAILED",
      riskScore: 90,
    };
  }

  // 2d. Registration cooldown — minimum gap between signups from the same IP.
  const cooldownMinutes = settings.registrationCooldownMinutes ?? 0;
  if (cooldownMinutes > 0) {
    const lastReg = registrationCooldown.get(ip);
    if (lastReg && Date.now() - lastReg < cooldownMinutes * 60_000) {
      console.log(`🛡️ Registration blocked: cooldown active for IP ${ip}`);
      return {
        allowed: false,
        reason:
          "You're creating accounts too quickly. Please wait a moment and try again.",
        code: "REGISTRATION_COOLDOWN",
        riskScore: 70,
      };
    }
  }

  // 2e. Per-fingerprint hourly signup cap (only when the client supplies one).
  const maxSignups = settings.maxSignupsPerHour ?? 0;
  if (data.fingerprint && maxSignups > 0) {
    const now = Date.now();
    const entry = signupsByFingerprint.get(data.fingerprint);
    if (entry && now - entry.windowStart < 60 * 60 * 1000) {
      if (entry.count >= maxSignups) {
        console.log(
          `🛡️ Registration blocked: fingerprint ${data.fingerprint} exceeded ${maxSignups}/hour`,
        );
        return {
          allowed: false,
          reason:
            "Too many accounts created from this device. Please try again later.",
          code: "FINGERPRINT_SIGNUP_LIMIT",
          riskScore: 85,
        };
      }
    }
  }

  // 3. Check rate limiting
  if (settings.registrationRateLimitEnabled) {
    const rateCheck = checkRegistrationRateLimit(
      ip,
      settings.maxRegistrationsPerIPPerHour || 5,
      settings.maxRegistrationsPerIPPerDay || 10,
    );

    if (!rateCheck.allowed) {
      console.log(`⚠️ Rate limit exceeded for IP: ${ip}`);
      return {
        allowed: false,
        reason: rateCheck.reason,
        code: "RATE_LIMIT_EXCEEDED",
        riskScore: 80,
      };
    }
  }

  // 4. Check disposable email
  if (settings.blockDisposableEmails) {
    const allDisposableDomains = [
      ...EXTENDED_DISPOSABLE_DOMAINS,
      ...(settings.disposableEmailDomains || []),
    ];

    if (isDisposableEmail(data.email, allDisposableDomains)) {
      console.log(`📧 Disposable email blocked: ${data.email}`);
      return {
        allowed: false,
        reason: settings.genericErrorMessages
          ? "Please use a valid email address."
          : "Disposable email addresses are not allowed.",
        code: "DISPOSABLE_EMAIL",
        riskScore: 90,
      };
    }
  }

  // 5. Check blocked email domains
  if (settings.blockedEmailDomains?.length > 0) {
    if (isBlockedEmailDomain(data.email, settings.blockedEmailDomains)) {
      console.log(`📧 Blocked email domain: ${data.email}`);
      return {
        allowed: false,
        reason: settings.genericErrorMessages
          ? "Please use a different email address."
          : "This email domain is not allowed.",
        code: "BLOCKED_DOMAIN",
        riskScore: 85,
      };
    }
  }

  // 6. Check name length (min)
  const trimmedName = data.name.trim();
  const nameLength = trimmedName.length;
  if (nameLength < (settings.minNameLength || 2)) {
    return {
      allowed: false,
      reason: `Name must be at least ${settings.minNameLength || 2} characters.`,
      code: "NAME_TOO_SHORT",
      riskScore: 50,
    };
  }

  // 6b. Check name length (max)
  // Reason: Spam bots often submit long promotional strings as display names.
  const maxNameLen = settings.maxNameLength || 40;
  if (nameLength > maxNameLen) {
    console.log(
      `🛡️ Registration blocked: name too long (${nameLength} chars) - ${trimmedName.slice(0, 40)}...`,
    );
    return {
      allowed: false,
      reason: `Name must be at most ${maxNameLen} characters.`,
      code: "NAME_TOO_LONG",
      riskScore: 90,
    };
  }

  // 7. Check single character names
  if (settings.blockSingleCharacterNames && nameLength === 1) {
    return {
      allowed: false,
      reason: "Please enter your full name.",
      code: "INVALID_NAME",
      riskScore: 60,
    };
  }

  // 7b. Require letter start (rejects emoji / digit / symbol-leading names)
  if (settings.requireLetterStart && !startsWithLetter(trimmedName)) {
    console.log(
      `🛡️ Registration blocked: name does not start with a letter - "${trimmedName}"`,
    );
    return {
      allowed: false,
      reason: "Name must start with a letter.",
      code: "INVALID_NAME_START",
      riskScore: 90,
    };
  }

  // 7c. Reject URLs embedded in name
  if (settings.blockUrlsInName && nameContainsUrl(trimmedName)) {
    console.log(
      `🛡️ Registration blocked: URL in name - "${trimmedName}"`,
    );
    return {
      allowed: false,
      reason: "Name cannot contain URLs or links.",
      code: "URL_IN_NAME",
      riskScore: 95,
    };
  }

  // 7d. Reject names with excessive emojis
  const emojiCount = countEmojis(trimmedName);
  const maxEmojis = settings.maxEmojisInName ?? 2;
  if (emojiCount > maxEmojis) {
    console.log(
      `🛡️ Registration blocked: too many emojis (${emojiCount}) in name - "${trimmedName}"`,
    );
    return {
      allowed: false,
      reason: "Name contains too many emoji characters.",
      code: "TOO_MANY_EMOJIS",
      riskScore: 85,
    };
  }

  // 8. Check numeric-only names
  if (settings.blockNumericOnlyNames && /^[0-9]+$/.test(trimmedName)) {
    return {
      allowed: false,
      reason: "Please enter a valid name.",
      code: "INVALID_NAME",
      riskScore: 70,
    };
  }

  // 9. Check suspicious name patterns — HARD BLOCK (not just risk-score)
  // Reason: Admin-curated patterns represent known spam campaigns; matching them
  // should be a hard reject, not a soft score bump.
  if (
    settings.blockSuspiciousPatterns &&
    settings.suspiciousNamePatterns?.length > 0
  ) {
    const nameCheck = isSuspiciousName(
      trimmedName,
      settings.suspiciousNamePatterns,
    );
    if (nameCheck.suspicious) {
      console.log(
        `🛡️ Registration blocked: suspicious name pattern "${nameCheck.pattern}" matched "${trimmedName}"`,
      );
      return {
        allowed: false,
        reason: settings.genericErrorMessages
          ? "Please enter a valid name."
          : `Name matches a blocked pattern.`,
        code: "SUSPICIOUS_NAME",
        riskScore: 90,
      };
    }
  }

  // 10. Check for common bot patterns in email
  const emailPrefix = data.email.split("@")[0].toLowerCase();
  const botPatterns = [
    /^test[0-9]*$/,
    /^user[0-9]+$/,
    /^admin[0-9]*$/,
    /^[a-z]{1,2}[0-9]{6,}$/, // Single letter + many numbers
    /^[0-9]+$/, // Numbers only
  ];

  for (const pattern of botPatterns) {
    if (pattern.test(emailPrefix)) {
      riskScore += 20;
      break;
    }
  }

  // Log high-risk registrations
  if (riskScore >= 40) {
    console.log(
      `⚠️ High-risk registration: email=${data.email}, name=${data.name}, ip=${ip}, score=${riskScore}`,
    );
  }

  // 11. Score-based blocking — reject if accumulated risk exceeds threshold
  // Reason: Previously suspicious signals only raised the score without ever
  // blocking. This converts soft signals into a hard block above the threshold.
  const blockThreshold = settings.riskScoreBlockThreshold ?? 70;
  if (riskScore >= blockThreshold) {
    console.log(
      `🛡️ Registration blocked by risk threshold: score=${riskScore} >= ${blockThreshold} (email=${data.email}, ip=${ip})`,
    );
    return {
      allowed: false,
      reason: settings.genericErrorMessages
        ? "Registration failed. Please try again."
        : "Registration flagged by risk scoring.",
      code: "RISK_THRESHOLD_EXCEEDED",
      riskScore,
    };
  }

  // 12. IP-risk gate — enforces the Block VPN / Proxy / Tor / Datacenter
  // toggles. Whitelisted IPs pass; detection errors fail OPEN. Runs last
  // because it is the only network call in this path.
  const ipGate = await evaluateIpRisk(ip, settings);
  if (ipGate.blocked) {
    console.log(
      `🛡️ Registration blocked by IP gate (${ip}) via ${ipGate.detection.source} — ` +
        `VPN:${ipGate.detection.isVPN} Proxy:${ipGate.detection.isProxy} ` +
        `Tor:${ipGate.detection.isTor} Hosting:${ipGate.detection.isHosting}`,
    );
    return {
      allowed: false,
      reason: settings.genericErrorMessages
        ? "Registration failed. Please try again."
        : ipGate.reason || "Registration is not allowed from this network.",
      code: "IP_BLOCKED",
      riskScore: 100,
    };
  }

  // Record success markers for cooldown + per-fingerprint hourly cap.
  if (cooldownMinutes > 0) registrationCooldown.set(ip, Date.now());
  if (data.fingerprint && maxSignups > 0) {
    const nowTs = Date.now();
    const fp = signupsByFingerprint.get(data.fingerprint);
    if (fp && nowTs - fp.windowStart < 60 * 60 * 1000) {
      fp.count += 1;
    } else {
      signupsByFingerprint.set(data.fingerprint, {
        count: 1,
        windowStart: nowTs,
      });
    }
  }

  return { allowed: true, riskScore };
}

/**
 * Check login rate limiting and account lockout
 * IMPORTANT: Checks DATABASE FIRST for persistence across server restarts
 */
export async function validateLogin(data: {
  email: string;
  ip?: string;
}): Promise<LoginSecurityResult> {
  // Ensure lockouts are loaded from database on first call (server restart recovery)
  await ensureLockoutsLoaded();

  const settings = await getFraudSettings();
  const ip = data.ip || (await getClientIP());
  const key = `${data.email}:${ip}`;

  // Check IP whitelist
  if (settings.whitelistedIPs?.includes(ip)) {
    return { allowed: true };
  }

  // Check if login rate limiting is enabled
  if (!settings.loginRateLimitEnabled) {
    return { allowed: true };
  }

  const now = Date.now();
  const nowDate = new Date();

  // ========================================
  // CRITICAL: Check DATABASE ONLY for lockouts
  // Database is the ONLY source of truth for lockout state
  // In-memory is NOT reliable in serverless/multi-instance environments
  // ========================================
  try {
    const { connectToDatabase } = await import("@/database/mongoose");
    await connectToDatabase();

    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;

    // Use case-insensitive regex to match email
    // Escape special regex characters to prevent regex injection
    const escapedEmail = data.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dbLockout = await AccountLockout.findOne({
      // Input is pre-escaped above.
      // eslint-disable-next-line security/detect-non-literal-regexp
      email: { $regex: new RegExp(`^${escapedEmail}$`, "i") },
      isActive: true,
      $or: [
        { lockedUntil: { $gt: nowDate } }, // Temporary lockout not expired
        { lockedUntil: null }, // Permanent lockout
      ],
    }).sort({ lockedAt: -1 });

    if (dbLockout) {
      console.log(
        `🔒 [validateLogin] Found active DB lockout: ID=${dbLockout._id}, email=${data.email}`,
      );

      const lockoutEnd = dbLockout.lockedUntil
        ? new Date(dbLockout.lockedUntil)
        : null;

      // Check if temporary lockout has expired
      if (lockoutEnd && now >= lockoutEnd.getTime()) {
        // Lockout expired - clear it in database
        await AccountLockout.findByIdAndUpdate(dbLockout._id, {
          isActive: false,
          unlockedAt: nowDate,
          unlockedReason: "Lockout expired",
        });
        console.log(
          `🔓 Lockout expired for ${data.email}, auto-cleared from database`,
        );
        // Continue - allow login
      } else {
        // Still locked - block login
        console.log(
          `🔒 Login blocked: ACCOUNT_LOCKED for ${data.email} from IP ${ip}`,
        );
        return {
          allowed: false,
          reason: "Account temporarily locked due to too many failed attempts.",
          code: "ACCOUNT_LOCKED",
          lockoutUntil: lockoutEnd || undefined,
          remainingAttempts: 0,
        };
      }
    }
    // NOTE: Do NOT clear in-memory entries here!
    // They are used by recordFailedLogin to count failed attempts
    // Only admin unlock should clear entries
  } catch (dbError) {
    console.error("Error checking database lockout:", dbError);
    // On database error, allow login rather than lock out users
  }

  // NOTE: We do NOT check in-memory for lockouts anymore
  // In-memory is only used for tracking failed attempts within a single instance
  // The database is the ONLY source of truth for lockout state

  // Short throttle between attempts after a failure. Reason: enforces the
  // `loginCooldownAfterFailedAttempts` setting (seconds) — it slows credential
  // stuffing without waiting for the full lockout threshold. Only applies once
  // the account/IP already has at least one recent failed attempt.
  const cooldownSeconds = settings.loginCooldownAfterFailedAttempts ?? 0;
  if (cooldownSeconds > 0) {
    const failed = failedLoginAttempts.get(key);
    if (failed && failed.count > 0) {
      const sinceLast = now - failed.lastAttempt;
      const cooldownMs = cooldownSeconds * 1000;
      if (sinceLast < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - sinceLast) / 1000);
        return {
          allowed: false,
          reason: `Please wait ${waitSec} second${waitSec !== 1 ? "s" : ""} before trying again.`,
          code: "LOGIN_COOLDOWN",
        };
      }
    }
  }

  // Check login rate (per hour)
  const rateEntry = loginRateLimit.get(ip);
  if (rateEntry) {
    const oneHour = 60 * 60 * 1000;
    if (
      now - rateEntry.firstAttempt < oneHour &&
      rateEntry.count >= settings.maxLoginAttemptsPerHour
    ) {
      return {
        allowed: false,
        reason: "Too many login attempts. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
      };
    }
  }

  // Update rate limit tracking
  if (rateEntry) {
    rateEntry.count++;
    rateEntry.lastAttempt = now;
  } else {
    loginRateLimit.set(ip, { count: 1, firstAttempt: now, lastAttempt: now });
  }

  // Get failed login count from in-memory (for display purposes only)
  const failedEntry = failedLoginAttempts.get(key);

  return {
    allowed: true,
    remainingAttempts: failedEntry
      ? Math.max(0, settings.maxFailedLoginsBeforeLockout - failedEntry.count)
      : settings.maxFailedLoginsBeforeLockout,
  };
}

/**
 * Record a failed login attempt - persists to database for admin visibility
 */
export async function recordFailedLogin(data: {
  email: string;
  ip?: string;
  userId?: string;
}): Promise<{
  locked: boolean;
  remainingAttempts: number;
  lockoutUntil?: Date;
}> {
  const settings = await getFraudSettings();
  const ip = data.ip || (await getClientIP());
  const key = `${data.email}:${ip}`;

  if (!settings.trackFailedLogins) {
    return {
      locked: false,
      remainingAttempts: settings.maxFailedLoginsBeforeLockout,
    };
  }

  const now = Date.now();
  let entry = failedLoginAttempts.get(key);

  if (entry) {
    entry.count++;
    entry.lastAttempt = now;

    // Check if should lock
    if (entry.count >= settings.maxFailedLoginsBeforeLockout) {
      // IMPORTANT: Before locking, verify this isn't stale data from before an unlock
      // Check if there's no active lockout but there was a recent unlock
      try {
        const { connectToDatabase } = await import("@/database/mongoose");
        await connectToDatabase();
        const AccountLockout = (
          await import("@/database/models/account-lockout.model")
        ).default;

        // Check for active lockout first
        // Escape special regex characters to prevent regex injection
        const escapedEmailForLockout = data.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const activeLockout = await AccountLockout.findOne({
          // Input is pre-escaped above.
          // eslint-disable-next-line security/detect-non-literal-regexp
          email: { $regex: new RegExp(`^${escapedEmailForLockout}$`, "i") },
          isActive: true,
        });

        if (!activeLockout) {
          // No active lockout - check if there was a recent unlock
          const recentUnlock = await AccountLockout.findOne({
            // Input is pre-escaped above.
            // eslint-disable-next-line security/detect-non-literal-regexp
            email: { $regex: new RegExp(`^${escapedEmailForLockout}$`, "i") },
            isActive: false,
            unlockedAt: { $exists: true },
          }).sort({ unlockedAt: -1 });

          // If there's a recent unlock and our entry started before the unlock, reset
          if (recentUnlock && recentUnlock.unlockedAt) {
            const unlockTime = recentUnlock.unlockedAt.getTime();
            const entryStartTime = entry.lastAttempt - entry.count * 2000; // Approximate start

            if (unlockTime > entryStartTime) {
              // The unlock happened during our counting period - counter is stale
              console.log(
                `🔄 Stale counter detected for ${data.email} (unlock at ${recentUnlock.unlockedAt}), resetting`,
              );
              entry.count = 1; // Reset to current attempt only
              entry.lockedUntil = undefined;

              return {
                locked: false,
                remainingAttempts: settings.maxFailedLoginsBeforeLockout - 1,
              };
            }
          }
        }
      } catch (staleCheckError) {
        console.error("Error checking for stale counter:", staleCheckError);
      }

      const lockoutDuration = settings.loginLockoutDurationMinutes * 60 * 1000;
      entry.lockedUntil = now + lockoutDuration;
      const lockoutUntilDate = new Date(entry.lockedUntil);

      console.log(
        `🔒 Account locked: ${data.email} from IP ${ip} (${entry.count} failed attempts)`,
      );

      // CRITICAL: Persist lockout to database - this is the source of truth
      // Without this, lockouts are lost on server restart
      try {
        const AccountLockout = (
          await import("@/database/models/account-lockout.model")
        ).default;
        const savedLockout = await AccountLockout.findOneAndUpdate(
          { email: data.email, ipAddress: ip, isActive: true },
          {
            $set: {
              userId: data.userId,
              email: data.email,
              ipAddress: ip,
              reason: "failed_login",
              failedAttempts: entry.count,
              lastAttemptAt: new Date(entry.lastAttempt),
              lockedAt: new Date(),
              lockedUntil: lockoutUntilDate,
              isActive: true,
            },
          },
          { upsert: true, new: true },
        );
        console.log(
          `📝 Lockout persisted to database for: ${data.email} (ID: ${savedLockout._id})`,
        );
      } catch (dbError) {
        console.error(
          "❌ CRITICAL: Failed to persist lockout to database:",
          dbError,
        );
        console.error(
          "⚠️ Lockout is only in-memory and will be lost on server restart!",
        );
        // Try one more time with a fresh connection
        try {
          const mongoose = await import("mongoose");
          if (mongoose.default.connection.readyState !== 1) {
            console.log("🔄 Attempting database reconnection...");
            const { connectToDatabase } = await import("@/database/mongoose");
            await connectToDatabase();
          }
          const AccountLockout = (
            await import("@/database/models/account-lockout.model")
          ).default;
          await AccountLockout.create({
            userId: data.userId,
            email: data.email,
            ipAddress: ip,
            reason: "failed_login",
            failedAttempts: entry.count,
            lastAttemptAt: new Date(entry.lastAttempt),
            lockedAt: new Date(),
            lockedUntil: lockoutUntilDate,
            isActive: true,
          });
          console.log(
            `📝 Lockout persisted to database (retry) for: ${data.email}`,
          );
        } catch (retryError) {
          console.error("❌ CRITICAL: Retry also failed:", retryError);
        }
      }

      // Create fraud alert when account is locked (same threshold as lockout)
      // Note: failedLoginAlertThreshold can be used to require more attempts before alerting
      // but typically we want to alert when account is locked
      if (
        entry.count >=
        Math.min(
          settings.failedLoginAlertThreshold,
          settings.maxFailedLoginsBeforeLockout,
        )
      ) {
        console.log(
          `🚨 ALERT: Brute force attack detected on ${data.email} from IP ${ip}`,
        );
        try {
          const FraudAlert = (
            await import("@/database/models/fraud/fraud-alert.model")
          ).default;
          await FraudAlert.create({
            alertType: "brute_force",
            severity: "high",
            status: "pending",
            primaryUserId: data.userId || data.email, // Use email as fallback if no userId
            suspiciousUserIds: data.userId ? [data.userId] : [],
            confidence: 0.85, // High confidence for brute force
            evidence: [
              {
                type: "failed_logins",
                description: `${entry.count} consecutive failed login attempts`,
                data: {
                  email: data.email,
                  ipAddress: ip,
                  failedAttempts: entry.count,
                  lockedUntil: lockoutUntilDate,
                },
              },
            ],
            title: "Brute Force Attack Detected",
            description: `${entry.count} failed login attempts detected for ${data.email} from IP ${ip}. Account has been temporarily locked.`,
            autoGenerated: true,
          });
          console.log(
            `✅ Fraud alert created for brute force on ${data.email}`,
          );

          // Also update suspicion score if userId is available
          if (data.userId) {
            try {
              const SuspicionScore = (
                await import("@/database/models/fraud/suspicion-score.model")
              ).default;
              let score = await SuspicionScore.findOne({ userId: data.userId });

              if (!score) {
                score = await SuspicionScore.create({
                  userId: data.userId,
                  totalScore: 0,
                  riskLevel: "low",
                  scoreBreakdown: {},
                  linkedAccounts: [],
                  scoreHistory: [],
                });
              }

              // Add brute force percentage to score
              score.addPercentage(
                "bruteForce",
                35,
                `Brute force: ${entry.count} failed logins from IP ${ip}`,
              );
              await score.save();
              console.log(
                `📊 Suspicion score updated for ${data.userId}: +35% (brute force)`,
              );
            } catch (scoreError) {
              console.error("Failed to update suspicion score:", scoreError);
            }
          }

          // Log to fraud history
          try {
            const FraudHistory = (
              await import("@/database/models/fraud/fraud-history.model")
            ).FraudHistory;
            await FraudHistory.logAction({
              userId: data.userId || data.email, // Use email as fallback ID
              userEmail: data.email,
              userName: data.email.split("@")[0],
              actionType: "account_locked",
              actionSeverity: "high",
              performedBy: {
                type: "automated",
              },
              reason: "Brute Force Attack Detected",
              details: `Account locked after ${entry.count} failed login attempts from IP ${ip}. Lockout duration: ${settings.loginLockoutDurationMinutes} minutes. Locked until: ${lockoutUntilDate.toLocaleString()}.`,
              previousState: { accountStatus: "active" },
              newState: { accountStatus: "locked" },
              duration: {
                startDate: new Date(),
                endDate: lockoutUntilDate,
                isPermanent: false,
                durationDays: settings.loginLockoutDurationMinutes / (60 * 24),
              },
              ipAddress: ip,
            });
            console.log(
              `📝 Fraud history logged for brute force on ${data.email}`,
            );
          } catch (historyError) {
            console.error("Failed to log fraud history:", historyError);
            if (historyError instanceof Error) {
              console.error("History error details:", historyError.message);
            }
          }
        } catch (alertError) {
          console.error("Failed to create fraud alert:", alertError);
        }
      }

      return {
        locked: true,
        remainingAttempts: 0,
        lockoutUntil: lockoutUntilDate,
      };
    }

    return {
      locked: false,
      remainingAttempts: settings.maxFailedLoginsBeforeLockout - entry.count,
    };
  } else {
    failedLoginAttempts.set(key, { count: 1, lastAttempt: now });
    return {
      locked: false,
      remainingAttempts: settings.maxFailedLoginsBeforeLockout - 1,
    };
  }
}

/**
 * Clear failed login attempts on successful login
 */
export async function clearFailedLogins(data: {
  email: string;
  ip?: string;
}): Promise<void> {
  const ip = data.ip || (await getClientIP());
  const key = `${data.email}:${ip}`;
  failedLoginAttempts.delete(key);

  // Also clear database lockout
  try {
    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;
    await AccountLockout.updateMany(
      { email: data.email, isActive: true },
      {
        $set: {
          isActive: false,
          unlockedAt: new Date(),
          unlockedReason: "Successful login",
        },
      },
    );
  } catch (error) {
    console.error("Failed to clear database lockout:", error);
  }
}

/**
 * Manually unlock an account (admin action)
 * ALWAYS clears in-memory lockouts regardless of database state
 */
export async function adminUnlockAccount(data: {
  email: string;
  adminId: string;
  reason?: string;
}): Promise<boolean> {
  let inMemoryCleared = 0;
  let dbCleared = 0;

  console.log(`🔓 [Unlock] ========== STARTING UNLOCK ==========`);
  console.log(`🔓 [Unlock] Email: ${data.email}`);
  console.log(`🔓 [Unlock] In-memory map size: ${failedLoginAttempts.size}`);

  // Log all keys in memory for debugging
  if (failedLoginAttempts.size > 0) {
    console.log(
      `🔓 [Unlock] All in-memory keys:`,
      Array.from(failedLoginAttempts.keys()),
    );
  }

  try {
    // CRITICAL: Clear ALL in-memory lockouts for this email (any IP)
    // Use case-insensitive matching
    const emailLower = data.email.toLowerCase();
    const keysToDelete: string[] = [];

    for (const [key] of failedLoginAttempts.entries()) {
      if (key.toLowerCase().startsWith(`${emailLower}:`)) {
        keysToDelete.push(key);
      }
    }

    console.log(
      `🔓 [Unlock] Keys matching email: ${keysToDelete.length}`,
      keysToDelete,
    );

    for (const key of keysToDelete) {
      failedLoginAttempts.delete(key);
      inMemoryCleared++;
    }

    console.log(`🔓 [In-Memory] Cleared ${inMemoryCleared} lockout entries`);

    // Ensure database connection
    const { connectToDatabase } = await import("@/database/mongoose");
    await connectToDatabase();

    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;

    // DEBUG: First, let's see ALL lockouts for this email
    // Escape special regex characters to prevent regex injection
    const escapedEmailForUnlock = data.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const allLockouts = await AccountLockout.find({
      // Input is pre-escaped above.
      // eslint-disable-next-line security/detect-non-literal-regexp
      email: { $regex: new RegExp(`^${escapedEmailForUnlock}$`, "i") },
    }).lean();

    console.log(
      "🔓 [Database] Found", allLockouts.length, "total lockouts for", data.email
    );
    for (const l of allLockouts) {
      const doc = l as { _id: unknown; isActive?: boolean; ipAddress?: string };
      console.log(
        "   - ID:", doc._id, ", isActive:", doc.isActive, ", IP:", doc.ipAddress
      );
    }

    // Clear ALL lockouts for this email (regardless of isActive status to be safe)
    const result = await AccountLockout.updateMany(
      // Input is pre-escaped above.
      // eslint-disable-next-line security/detect-non-literal-regexp
      { email: { $regex: new RegExp(`^${escapedEmailForUnlock}$`, "i") } },
      {
        $set: {
          isActive: false,
          unlockedAt: new Date(),
          unlockedBy: data.adminId,
          unlockedReason: data.reason || "Admin manual unlock",
        },
      },
    );

    dbCleared = result.modifiedCount;
    console.log(`🔓 [Database] Cleared ${dbCleared} lockout entries`);
    console.log(`🔓 [Unlock] ========== UNLOCK COMPLETE ==========`);

    return true;
  } catch (error) {
    console.error("❌ [Unlock] Failed to unlock account:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return inMemoryCleared > 0;
  }
}

/**
 * Get all active lockouts (for admin dashboard)
 */
export async function getActiveLockouts(): Promise<
  Array<{
    email: string;
    userId?: string;
    ipAddress?: string;
    reason: string;
    failedAttempts: number;
    lockedAt: Date;
    lockedUntil?: Date;
    isTemporary: boolean;
  }>
> {
  try {
    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;
    const now = new Date();

    const lockouts = await AccountLockout.find({
      isActive: true,
      $or: [{ lockedUntil: { $gt: now } }, { lockedUntil: null }],
    })
      .sort({ lockedAt: -1 })
      .lean();

    return lockouts.map((l) => ({
      email: l.email,
      userId: l.userId,
      ipAddress: l.ipAddress,
      reason: l.reason,
      failedAttempts: l.failedAttempts,
      lockedAt: l.lockedAt,
      lockedUntil: l.lockedUntil,
      isTemporary: !!l.lockedUntil,
    }));
  } catch (error) {
    console.error("Failed to get active lockouts:", error);
    return [];
  }
}

/**
 * Check if a specific user/email is locked
 */
export async function isAccountLocked(email: string): Promise<{
  locked: boolean;
  reason?: string;
  lockedUntil?: Date;
  failedAttempts?: number;
}> {
  try {
    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;
    const now = new Date();

    const lockout = await AccountLockout.findOne({
      email,
      isActive: true,
      $or: [{ lockedUntil: { $gt: now } }, { lockedUntil: null }],
    }).sort({ lockedAt: -1 });

    if (lockout) {
      return {
        locked: true,
        reason: lockout.reason,
        lockedUntil: lockout.lockedUntil,
        failedAttempts: lockout.failedAttempts,
      };
    }

    return { locked: false };
  } catch (error) {
    console.error("Failed to check account lock:", error);
    return { locked: false };
  }
}

/**
 * Clear ALL in-memory lockouts and rate limits (admin reset)
 */
export async function clearAllLockouts(): Promise<number> {
  const failedLoginCount = failedLoginAttempts.size;
  const rateLimitCount = registrationRateLimit.size;
  const loginRateCount = loginRateLimit.size;

  // Clear all in-memory maps
  failedLoginAttempts.clear();
  registrationRateLimit.clear();
  loginRateLimit.clear();

  const totalCleared = failedLoginCount + rateLimitCount + loginRateCount;
  console.log(
    `🔓 Cleared all in-memory lockouts: ${failedLoginCount} failed logins, ${rateLimitCount} registration limits, ${loginRateCount} login limits`,
  );

  return totalCleared;
}

/**
 * Get current security status for admin dashboard
 */
export function getSecurityStats(): {
  activeRateLimits: number;
  lockedAccounts: number;
  failedLoginTracking: number;
} {
  const now = Date.now();
  let lockedCount = 0;

  for (const entry of failedLoginAttempts.values()) {
    if (entry.lockedUntil && now < entry.lockedUntil) {
      lockedCount++;
    }
  }

  return {
    activeRateLimits: registrationRateLimit.size,
    lockedAccounts: lockedCount,
    failedLoginTracking: failedLoginAttempts.size,
  };
}

/**
 * Clean up expired lockouts from database
 * Should be called periodically or on server startup
 */
export async function cleanupExpiredLockouts(): Promise<number> {
  try {
    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;
    const now = new Date();

    const result = await AccountLockout.updateMany(
      {
        isActive: true,
        lockedUntil: { $lte: now, $ne: null },
      },
      {
        $set: {
          isActive: false,
          unlockedAt: now,
          unlockedReason: "Lockout expired",
        },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(`🔓 Cleaned up ${result.modifiedCount} expired lockouts`);
    }

    return result.modifiedCount;
  } catch (error) {
    console.error("Failed to cleanup expired lockouts:", error);
    return 0;
  }
}

/**
 * Load active lockouts from database into memory
 * Called on server startup to ensure consistency
 */
export async function loadActiveLockoutsFromDatabase(): Promise<number> {
  try {
    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;
    const now = new Date();

    // First cleanup expired lockouts
    await cleanupExpiredLockouts();

    // Load active lockouts
    const activeLockouts = await AccountLockout.find({
      isActive: true,
      $or: [{ lockedUntil: { $gt: now } }, { lockedUntil: null }],
    });

    let loaded = 0;
    for (const lockout of activeLockouts) {
      const key = `${lockout.email}:${lockout.ipAddress || "unknown"}`;
      failedLoginAttempts.set(key, {
        count: lockout.failedAttempts,
        lastAttempt: lockout.lastAttemptAt?.getTime() || Date.now(),
        lockedUntil: lockout.lockedUntil?.getTime(),
      });
      loaded++;
    }

    if (loaded > 0) {
      console.log(
        `📥 Loaded ${loaded} active lockouts from database into memory`,
      );
    }

    return loaded;
  } catch (error) {
    console.error("Failed to load lockouts from database:", error);
    return 0;
  }
}

/**
 * Get database lockout statistics
 */
export async function getDatabaseLockoutStats(): Promise<{
  activeLockouts: number;
  expiredLockouts: number;
  totalLockouts: number;
}> {
  try {
    const AccountLockout = (
      await import("@/database/models/account-lockout.model")
    ).default;

    const [active, expired, total] = await Promise.all([
      AccountLockout.countDocuments({ isActive: true }),
      AccountLockout.countDocuments({ isActive: false }),
      // PERF: estimatedDocumentCount() is O(1) vs full scan
      AccountLockout.estimatedDocumentCount(),
    ]);

    return {
      activeLockouts: active,
      expiredLockouts: expired,
      totalLockouts: total,
    };
  } catch (error) {
    console.error("Failed to get lockout stats:", error);
    return { activeLockouts: 0, expiredLockouts: 0, totalLockouts: 0 };
  }
}
