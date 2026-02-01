/**
 * URL validation to prevent Open Redirect and SSRF attacks
 */

// Private IP ranges that should be blocked for SSRF protection
const PRIVATE_IP_RANGES = [
  /^127\./,                    // Localhost
  /^10\./,                     // Class A private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Class B private
  /^192\.168\./,               // Class C private
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^224\./,                    // Multicast
  /^255\./,                    // Broadcast
  /^localhost$/i,
  /^::1$/,                     // IPv6 localhost
  /^fc00:/i,                   // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
];

// Blocked hostnames for SSRF
const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal", // Cloud metadata
  "169.254.169.254",          // AWS/GCP metadata
  "metadata.google.com",
];

// Allowed KYC provider domains
const ALLOWED_KYC_DOMAINS = [
  "veriff.com",
  "stationapi.veriff.com",
  "api.veriff.com",
  "magic.veriff.me",
  "station.veriff.me",
];

// Valid forex symbols (whitelist)
const VALID_FOREX_SYMBOLS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "EUR/CHF", "EUR/AUD", "EUR/CAD", "EUR/NZD",
  "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD", "AUD/JPY", "AUD/NZD", "AUD/CAD",
  "AUD/CHF", "CAD/JPY", "CAD/CHF", "CHF/JPY", "NZD/JPY", "NZD/CAD", "NZD/CHF",
  // Crypto pairs
  "BTC/USD", "ETH/USD", "XRP/USD", "LTC/USD", "BCH/USD", "ADA/USD", "DOT/USD",
  "SOL/USD", "DOGE/USD", "MATIC/USD", "LINK/USD", "UNI/USD", "AVAX/USD",
  // Indices (for future use)
  "US500", "US30", "NAS100", "UK100", "GER40", "JPN225",
  // Commodities
  "XAU/USD", "XAG/USD", "WTI/USD", "BRENT/USD",
];

/**
 * Check if a hostname or IP is in a private/internal range
 */
export function isPrivateIpOrHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();
  
  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
    return true;
  }
  
  // Check private IP ranges
  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate a URL for server-side requests (SSRF protection)
 * Blocks requests to internal/private IP addresses
 */
export function isValidSsrfUrl(url: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, reason: `Invalid protocol: ${parsed.protocol}` };
    }
    
    // Block private IPs and internal hostnames
    if (isPrivateIpOrHostname(parsed.hostname)) {
      return { valid: false, reason: `Blocked internal/private address: ${parsed.hostname}` };
    }
    
    // Block URLs with credentials
    if (parsed.username || parsed.password) {
      return { valid: false, reason: "URLs with credentials are not allowed" };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: `Invalid URL format: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/**
 * Validate KYC provider URL (e.g., Veriff)
 */
export function isValidKycProviderUrl(url: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    
    // Must be HTTPS
    if (parsed.protocol !== "https:") {
      return { valid: false, reason: "KYC provider URLs must use HTTPS" };
    }
    
    // Check against allowed domains
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_KYC_DOMAINS.some(
      domain => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    if (!isAllowed) {
      return { valid: false, reason: `Domain not in allowed list: ${hostname}. Allowed: ${ALLOWED_KYC_DOMAINS.join(", ")}` };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: `Invalid URL format: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/**
 * Validate forex symbol format
 */
export function isValidForexSymbol(symbol: string): boolean {
  // Check against whitelist
  const normalizedSymbol = symbol.toUpperCase().trim();
  return VALID_FOREX_SYMBOLS.includes(normalizedSymbol);
}

/**
 * Sanitize a forex symbol for use in API URLs
 * Returns null if invalid
 */
export function sanitizeForexSymbol(symbol: string): string | null {
  const normalizedSymbol = symbol.toUpperCase().trim();
  if (!isValidForexSymbol(normalizedSymbol)) {
    return null;
  }
  return normalizedSymbol;
}

// Trusted domains for external redirects
const TRUSTED_DOMAINS = [
  // Payment providers
  "stripe.com",
  "checkout.stripe.com",
  "paddle.com",
  "checkout.paddle.com",
  "buy.paddle.com",
  "nuvei.com",
  "secure.safecharge.com",
  "ppp-test.nuvei.com",
  // KYC providers
  "veriff.com",
  "magic.veriff.com",
  "station.veriff.me",
  // Your own domains (add your production domains)
  "localhost",
  "127.0.0.1",
];

/**
 * Validate if a URL is safe for redirect
 * - Must be HTTPS (or localhost for development)
 * - Must be from a trusted domain
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Allow localhost for development
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    ) {
      return true;
    }

    // Require HTTPS in production
    if (parsed.protocol !== "https:") {
      console.warn(`Open redirect blocked: non-HTTPS URL ${url}`);
      return false;
    }

    // Check against trusted domains
    const hostname = parsed.hostname.toLowerCase();
    const isTrusted = TRUSTED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isTrusted) {
      console.warn(`Open redirect blocked: untrusted domain ${hostname}`);
      return false;
    }

    return true;
  } catch {
    console.warn(`Open redirect blocked: invalid URL ${url}`);
    return false;
  }
}

/**
 * Safely redirect to a URL, with validation
 * Returns false if redirect was blocked
 */
export function safeRedirect(url: string): boolean {
  if (isValidRedirectUrl(url)) {
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
    return true;
  }
  return false;
}

/**
 * Safely open a URL in a new window, with validation
 * Returns null if blocked
 */
export function safeWindowOpen(
  url: string,
  target?: string,
  features?: string
): Window | null {
  if (isValidRedirectUrl(url)) {
    if (typeof window !== "undefined") {
      return window.open(url, target, features);
    }
  }
  return null;
}

// ============================================================================
// MongoDB/NoSQL Injection Prevention
// ============================================================================

/**
 * Validate that a value is a valid MongoDB ObjectId string
 * Prevents NoSQL injection by ensuring the input is a 24-char hex string
 */
export function isValidObjectId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[a-fA-F0-9]{24}$/.test(value);
}

/**
 * Sanitize a value for use in MongoDB queries
 * Returns the value if it's a safe string, null otherwise
 */
export function sanitizeObjectId(value: unknown): string | null {
  if (isValidObjectId(value)) {
    return value;
  }
  return null;
}

/**
 * Validate that a value is a safe string (not an object that could be used for injection)
 * MongoDB NoSQL injection often uses objects like { $gt: "" } instead of strings
 */
export function isSafeMongoString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Sanitize user input for MongoDB queries
 * Prevents NoSQL injection by ensuring the value is a primitive type
 */
export function sanitizeMongoInput<T>(value: unknown, allowedType: "string" | "number" | "boolean"): T | null {
  if (allowedType === "string" && typeof value === "string") {
    return value as T;
  }
  if (allowedType === "number" && typeof value === "number" && !isNaN(value)) {
    return value as T;
  }
  if (allowedType === "boolean" && typeof value === "boolean") {
    return value as T;
  }
  return null;
}

/**
 * Validate an email format
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  // Basic email validation - not perfect but prevents obvious injection
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
