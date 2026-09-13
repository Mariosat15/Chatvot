/**
 * Tests for payment security logic.
 * Validates server-side credit calculations, fee computation,
 * and amount tampering detection.
 */
import { describe, it, expect } from "vitest";

// Reason: These mirror the server-side calculations in:
// - app/api/nuvei/open-order/route.ts
// - app/api/stripe/create-payment-intent/route.ts
// - lib/actions/trading/wallet.actions.ts

describe("Server-side credit calculation", () => {
  function computeCredits(eurAmount: number, eurToCreditsRate: number): number {
    return Math.round(eurAmount * eurToCreditsRate * 100) / 100;
  }

  it("1:1 rate returns same amount", () => {
    expect(computeCredits(100, 1)).toBe(100);
    expect(computeCredits(49.99, 1)).toBe(49.99);
  });

  it("10000:1 rate converts correctly", () => {
    expect(computeCredits(1, 10000)).toBe(10000);
    expect(computeCredits(0.5, 10000)).toBe(5000);
    expect(computeCredits(10, 10000)).toBe(100000);
  });

  it("handles fractional rates", () => {
    expect(computeCredits(100, 1.5)).toBe(150);
    expect(computeCredits(33.33, 2)).toBe(66.66);
  });

  it("rounds to 2 decimal places", () => {
    // 1/3 EUR at 1:1 rate should not produce infinite decimals
    const result = computeCredits(0.333333, 1);
    expect(result).toBe(0.33);
  });

  it("handles zero amount", () => {
    expect(computeCredits(0, 10000)).toBe(0);
  });
});

describe("Fee computation", () => {
  function computeFees(
    baseAmountEur: number,
    platformFeePercent: number,
    vatPercent: number,
  ) {
    const clampedVat = Math.max(0, Math.min(vatPercent, 30));
    const vatAmount = Math.round(baseAmountEur * clampedVat) / 100;
    const platformFee =
      Math.round((baseAmountEur + vatAmount) * platformFeePercent) / 100;
    const totalCharged = baseAmountEur + vatAmount + platformFee;

    return {
      vatAmount: Math.round(vatAmount * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      totalCharged: Math.round(totalCharged * 100) / 100,
    };
  }

  it("no fees produces exact base amount", () => {
    const result = computeFees(100, 0, 0);
    expect(result.vatAmount).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.totalCharged).toBe(100);
  });

  it("VAT only adds correct percentage", () => {
    const result = computeFees(100, 0, 20);
    expect(result.vatAmount).toBe(20);
    expect(result.platformFee).toBe(0);
    expect(result.totalCharged).toBe(120);
  });

  it("platform fee applies to base + VAT", () => {
    const result = computeFees(100, 5, 20);
    expect(result.vatAmount).toBe(20);
    expect(result.platformFee).toBe(6); // 5% of 120
    expect(result.totalCharged).toBe(126);
  });

  it("clamps VAT to max 30%", () => {
    const result = computeFees(100, 0, 50);
    expect(result.vatAmount).toBe(30); // Clamped from 50 to 30
  });

  it("clamps negative VAT to 0", () => {
    const result = computeFees(100, 0, -10);
    expect(result.vatAmount).toBe(0);
  });
});

describe("Amount tampering detection", () => {
  function isAmountTampered(
    clientBaseAmount: number,
    serverBaseAmount: number,
    toleranceEur: number = 0.5,
  ): boolean {
    return Math.abs(clientBaseAmount - serverBaseAmount) > toleranceEur;
  }

  it("identical amounts are not tampered", () => {
    expect(isAmountTampered(100, 100)).toBe(false);
  });

  it("rounding differences within tolerance pass", () => {
    expect(isAmountTampered(99.99, 100, 0.5)).toBe(false);
    expect(isAmountTampered(100.49, 100, 0.5)).toBe(false);
  });

  it("significant differences are detected", () => {
    expect(isAmountTampered(200, 100, 0.5)).toBe(true);
    expect(isAmountTampered(0, 100, 0.5)).toBe(true);
    expect(isAmountTampered(100.6, 100, 0.5)).toBe(true);
  });

  it("negative tampering is detected", () => {
    expect(isAmountTampered(-100, 100, 0.5)).toBe(true);
  });
});

describe("Webhook amount reconciliation", () => {
  function isWebhookAmountValid(
    webhookTotal: number,
    storedTotal: number,
    toleranceEur: number = 0.01,
  ): boolean {
    return Math.abs(webhookTotal - storedTotal) <= toleranceEur;
  }

  it("matching amounts reconcile", () => {
    expect(isWebhookAmountValid(126.00, 126.00)).toBe(true);
  });

  it("penny differences reconcile", () => {
    // Reason: Floating-point math means 126.01 - 126.00 ≈ 0.00999...
    // Tolerance of 0.01 means abs diff must be <= 0.01, which covers this.
    expect(isWebhookAmountValid(126.005, 126.00)).toBe(true);
    expect(isWebhookAmountValid(125.995, 126.00)).toBe(true);
  });

  it("larger differences fail reconciliation", () => {
    expect(isWebhookAmountValid(125.98, 126.00)).toBe(false);
    expect(isWebhookAmountValid(127.00, 126.00)).toBe(false);
  });
});
