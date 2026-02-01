/**
 * URL validation to prevent Open Redirect attacks
 */

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
    window.location.href = url;
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
    return window.open(url, target, features);
  }
  return null;
}
