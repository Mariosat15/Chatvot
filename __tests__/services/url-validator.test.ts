/**
 * Tests for URL validation and security utilities.
 * Covers SSRF prevention, redirect validation, email validation,
 * MongoDB input sanitization, and forex symbol whitelisting.
 */
import { describe, it, expect } from "vitest";
import {
  isPrivateIpOrHostname,
  isValidSsrfUrl,
  isValidRedirectUrl,
  isValidForexSymbol,
  sanitizeForexSymbol,
  getSafeForexTicker,
  isValidObjectId,
  sanitizeObjectId,
  isSafeMongoString,
  sanitizeMongoInput,
  isValidEmail,
  isValidKycProviderUrl,
  getSafeKycBaseUrl,
} from "@/lib/utils/url-validator";

describe("isPrivateIpOrHostname", () => {
  it("blocks localhost variants", () => {
    expect(isPrivateIpOrHostname("localhost")).toBe(true);
    expect(isPrivateIpOrHostname("127.0.0.1")).toBe(true);
    expect(isPrivateIpOrHostname("::1")).toBe(true);
  });

  it("blocks private IP ranges", () => {
    expect(isPrivateIpOrHostname("10.0.0.1")).toBe(true);
    expect(isPrivateIpOrHostname("10.255.255.255")).toBe(true);
    expect(isPrivateIpOrHostname("172.16.0.1")).toBe(true);
    expect(isPrivateIpOrHostname("172.31.255.255")).toBe(true);
    expect(isPrivateIpOrHostname("192.168.1.1")).toBe(true);
    expect(isPrivateIpOrHostname("192.168.0.100")).toBe(true);
  });

  it("blocks link-local and special ranges", () => {
    expect(isPrivateIpOrHostname("169.254.169.254")).toBe(true);
    expect(isPrivateIpOrHostname("0.0.0.0")).toBe(true);
  });

  it("blocks cloud metadata endpoints", () => {
    expect(isPrivateIpOrHostname("metadata.google.internal")).toBe(true);
    expect(isPrivateIpOrHostname("169.254.169.254")).toBe(true);
  });

  it("allows public IPs", () => {
    expect(isPrivateIpOrHostname("8.8.8.8")).toBe(false);
    expect(isPrivateIpOrHostname("1.1.1.1")).toBe(false);
    expect(isPrivateIpOrHostname("203.0.113.50")).toBe(false);
  });

  it("allows public hostnames", () => {
    expect(isPrivateIpOrHostname("example.com")).toBe(false);
    expect(isPrivateIpOrHostname("google.com")).toBe(false);
  });

  it("does not falsely block 172.x outside private range", () => {
    expect(isPrivateIpOrHostname("172.15.0.1")).toBe(false);
    expect(isPrivateIpOrHostname("172.32.0.1")).toBe(false);
  });
});

describe("isValidSsrfUrl", () => {
  it("allows valid HTTPS URLs", () => {
    expect(isValidSsrfUrl("https://example.com/page")).toEqual({ valid: true });
    expect(isValidSsrfUrl("http://example.com")).toEqual({ valid: true });
  });

  it("blocks non-HTTP protocols", () => {
    const result = isValidSsrfUrl("ftp://files.example.com/data");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid protocol");
  });

  it("blocks file:// protocol", () => {
    expect(isValidSsrfUrl("file:///etc/passwd").valid).toBe(false);
  });

  it("blocks private IPs in URLs", () => {
    expect(isValidSsrfUrl("http://127.0.0.1/admin").valid).toBe(false);
    expect(isValidSsrfUrl("http://10.0.0.1:8080/").valid).toBe(false);
    expect(isValidSsrfUrl("http://192.168.1.1/").valid).toBe(false);
  });

  it("blocks URLs with credentials", () => {
    const result = isValidSsrfUrl("http://user:pass@example.com");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("credentials");
  });

  it("rejects invalid URL formats", () => {
    expect(isValidSsrfUrl("not-a-url").valid).toBe(false);
    expect(isValidSsrfUrl("").valid).toBe(false);
  });
});

describe("isValidForexSymbol", () => {
  it("accepts valid major pairs", () => {
    expect(isValidForexSymbol("EUR/USD")).toBe(true);
    expect(isValidForexSymbol("GBP/USD")).toBe(true);
    expect(isValidForexSymbol("USD/JPY")).toBe(true);
  });

  it("accepts crypto pairs", () => {
    expect(isValidForexSymbol("BTC/USD")).toBe(true);
    expect(isValidForexSymbol("ETH/USD")).toBe(true);
  });

  it("accepts commodities", () => {
    expect(isValidForexSymbol("XAU/USD")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidForexSymbol("eur/usd")).toBe(true);
    expect(isValidForexSymbol("Eur/Usd")).toBe(true);
  });

  it("rejects invalid symbols", () => {
    expect(isValidForexSymbol("FAKE/USD")).toBe(false);
    expect(isValidForexSymbol("")).toBe(false);
    expect(isValidForexSymbol("../../../etc/passwd")).toBe(false);
  });
});

describe("sanitizeForexSymbol", () => {
  it("returns whitelist value, not user input", () => {
    const result = sanitizeForexSymbol("eur/usd");
    expect(result).toBe("EUR/USD");
  });

  it("returns null for invalid symbols", () => {
    expect(sanitizeForexSymbol("HACK/ME")).toBeNull();
  });
});

describe("getSafeForexTicker", () => {
  it("converts valid symbol to API format", () => {
    expect(getSafeForexTicker("EUR/USD")).toBe("C:EURUSD");
    expect(getSafeForexTicker("BTC/USD")).toBe("C:BTCUSD");
  });

  it("returns null for invalid symbols", () => {
    expect(getSafeForexTicker("INVALID")).toBeNull();
  });
});

describe("isValidObjectId", () => {
  it("accepts valid 24-char hex strings", () => {
    expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    expect(isValidObjectId("aabbccddeeff00112233aabb")).toBe(true);
  });

  it("rejects non-hex strings", () => {
    expect(isValidObjectId("not-a-valid-objectid!!!")).toBe(false);
  });

  it("rejects wrong-length strings", () => {
    expect(isValidObjectId("507f1f77bcf86cd79943901")).toBe(false);
    expect(isValidObjectId("507f1f77bcf86cd7994390111")).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(isValidObjectId(123)).toBe(false);
    expect(isValidObjectId(null)).toBe(false);
    expect(isValidObjectId(undefined)).toBe(false);
    expect(isValidObjectId({ $gt: "" })).toBe(false);
  });
});

describe("sanitizeObjectId", () => {
  it("returns the value for valid ObjectIds", () => {
    expect(sanitizeObjectId("507f1f77bcf86cd799439011")).toBe(
      "507f1f77bcf86cd799439011",
    );
  });

  it("returns null for invalid values", () => {
    expect(sanitizeObjectId("invalid")).toBeNull();
    expect(sanitizeObjectId({ $gt: "" })).toBeNull();
  });
});

describe("isSafeMongoString", () => {
  it("returns true for strings", () => {
    expect(isSafeMongoString("hello")).toBe(true);
    expect(isSafeMongoString("")).toBe(true);
  });

  it("returns false for injection objects", () => {
    expect(isSafeMongoString({ $gt: "" })).toBe(false);
    expect(isSafeMongoString({ $ne: null })).toBe(false);
    expect(isSafeMongoString(123)).toBe(false);
    expect(isSafeMongoString(null)).toBe(false);
  });
});

describe("sanitizeMongoInput", () => {
  it("allows valid string inputs", () => {
    expect(sanitizeMongoInput("hello", "string")).toBe("hello");
  });

  it("allows valid number inputs", () => {
    expect(sanitizeMongoInput(42, "number")).toBe(42);
  });

  it("allows valid boolean inputs", () => {
    expect(sanitizeMongoInput(true, "boolean")).toBe(true);
  });

  it("rejects type mismatches", () => {
    expect(sanitizeMongoInput(42, "string")).toBeNull();
    expect(sanitizeMongoInput("hello", "number")).toBeNull();
    expect(sanitizeMongoInput("true", "boolean")).toBeNull();
  });

  it("rejects NaN numbers", () => {
    expect(sanitizeMongoInput(NaN, "number")).toBeNull();
  });

  it("blocks injection objects", () => {
    expect(sanitizeMongoInput({ $gt: "" }, "string")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("test.user@domain.co.uk")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail({ $gt: "" })).toBe(false);
  });

  it("rejects excessively long emails", () => {
    const longEmail = "a".repeat(255) + "@example.com";
    expect(isValidEmail(longEmail)).toBe(false);
  });
});

describe("isValidKycProviderUrl", () => {
  it("accepts valid Veriff URLs", () => {
    expect(
      isValidKycProviderUrl("https://stationapi.veriff.com/v1/sessions"),
    ).toEqual({ valid: true });
    expect(
      isValidKycProviderUrl("https://api.veriff.com/v1/sessions"),
    ).toEqual({ valid: true });
  });

  it("rejects non-HTTPS", () => {
    const result = isValidKycProviderUrl("http://api.veriff.com/v1/sessions");
    expect(result.valid).toBe(false);
  });

  it("rejects non-allowed domains", () => {
    const result = isValidKycProviderUrl("https://evil.com/v1/sessions");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not in allowed list");
  });
});

describe("getSafeKycBaseUrl", () => {
  it("returns hardcoded URL from whitelist", () => {
    expect(getSafeKycBaseUrl("https://api.veriff.com/anything", "default")).toBe(
      "https://api.veriff.com",
    );
  });

  it("returns default for unknown domains", () => {
    expect(getSafeKycBaseUrl("https://evil.com", "https://default.com")).toBe(
      "https://default.com",
    );
  });

  it("returns default for null/undefined input", () => {
    expect(getSafeKycBaseUrl(null, "https://default.com")).toBe(
      "https://default.com",
    );
    expect(getSafeKycBaseUrl(undefined, "https://default.com")).toBe(
      "https://default.com",
    );
  });
});

describe("isValidRedirectUrl", () => {
  it("allows trusted HTTPS domains", () => {
    expect(isValidRedirectUrl("https://checkout.stripe.com/pay/123")).toBe(true);
    expect(isValidRedirectUrl("https://buy.paddle.com/checkout")).toBe(true);
  });

  it("allows localhost for development", () => {
    expect(isValidRedirectUrl("http://localhost:3000/callback")).toBe(true);
  });

  it("blocks untrusted domains", () => {
    expect(isValidRedirectUrl("https://evil.com/steal-tokens")).toBe(false);
  });

  it("blocks non-HTTPS for non-localhost", () => {
    expect(isValidRedirectUrl("http://stripe.com/pay")).toBe(false);
  });
});
