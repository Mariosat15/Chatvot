/**
 * Owner request (13 Oct 2026): "make sure that these settings in admin actually
 * work - KYC, hold period, refund to original payment method - just confirm
 * that they are operational."
 *
 * Reason: KYC and the post-deposit hold were already enforced by the shared
 * validator. "Refund to original payment method" was not: `nuveiPreferCardRefund`
 * was read by no player screen, and nothing refused a bank payout of card-funded
 * money. `requireOriginalPaymentMethod` is the server-side control, and the
 * preference now chooses the modal's default method.
 *
 * The validator runs for real here. Only its I/O (models, 2FA gate, restriction
 * lookup) is stubbed, so each test drives one admin setting and asserts which
 * refusal fired, never merely that one did.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  kyc: null as Record<string, unknown> | null,
  wallet: {} as Record<string, unknown>,
  lastDeposit: null as Record<string, unknown> | null,
}));

function chain<T>(value: T) {
  const p = Promise.resolve(value) as Promise<T> & Record<string, unknown>;
  p.sort = () => chain(value);
  p.select = () => chain(value);
  p.lean = () => Promise.resolve(value);
  return p;
}

vi.mock("@/database/mongoose", () => ({ connectToDatabase: vi.fn(async () => undefined) }));
vi.mock("@/database/models/withdrawal-settings.model", () => ({
  default: { getSingleton: vi.fn(async () => state.settings) },
}));
vi.mock("@/database/models/credit-conversion-settings.model", () => ({
  default: {
    getSingleton: vi.fn(async () => ({ eurToCreditsRate: 100, platformWithdrawalFeePercentage: 0 })),
  },
}));
vi.mock("@/database/models/trading/credit-wallet.model", () => ({
  default: { findOne: vi.fn(async () => state.wallet) },
}));
vi.mock("@/database/models/app-settings.model", () => ({
  default: { findById: vi.fn(async () => ({ simulatorModeEnabled: false })) },
}));
vi.mock("@/database/models/kyc-settings.model", () => ({
  default: { findOne: vi.fn(async () => state.kyc) },
}));
vi.mock("@/database/models/trading/wallet-transaction.model", () => ({
  default: { findOne: vi.fn(() => chain(state.lastDeposit)) },
}));
vi.mock("@/database/models/withdrawal-request.model", () => ({
  default: {
    getDailyTotal: vi.fn(async () => 0),
    getMonthlyTotal: vi.fn(async () => 0),
    countDocuments: vi.fn(async () => 0),
    findOne: vi.fn(() => chain(null)),
  },
}));
vi.mock("@/database/models/trading/competition-participant.model", () => ({
  default: { find: vi.fn(() => chain([])) },
}));
vi.mock("@/database/models/trading/challenge.model", () => ({
  default: { find: vi.fn(() => chain([])) },
}));
vi.mock("@/lib/services/two-factor-gate.service", () => ({
  evaluateTwoFactorGate: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/services/user-restriction.service", () => ({
  canUserPerformAction: vi.fn(async () => ({ allowed: true })),
}));

import { validateWithdrawal } from "@/lib/services/withdrawal-validator.service";
import {
  isBankFundedPaymentMethod,
  originalMethodBlocksPayout,
  ORIGINAL_METHOD_REQUIRED_MESSAGE,
} from "@/lib/services/withdrawal/original-method-rule";

const USER = "64b7f0c2a1b2c3d4e5f60718";

function baseSettings(over: Record<string, unknown> = {}) {
  return {
    apiRateLimitEnabled: false,
    sandboxEnabled: true,
    requireKYC: false,
    minimumDepositRequired: false,
    minimumWithdrawal: 1,
    maximumWithdrawal: 10_000,
    useCustomFees: false,
    dailyWithdrawalLimit: 0,
    monthlyWithdrawalLimit: 0,
    maxWithdrawalsPerDay: 0,
    maxWithdrawalsPerMonth: 0,
    cooldownHours: 0,
    holdPeriodAfterDeposit: 0,
    allowWithdrawalDuringActiveCompetitions: true,
    blockWithdrawalOnActiveChallenges: false,
    cardWithdrawalsEnabled: true,
    bankWithdrawalsEnabled: true,
    requireOriginalPaymentMethod: false,
    ...over,
  };
}

function run(payoutCategory: string, amountEUR = 50) {
  return validateWithdrawal({
    userId: USER,
    amountEUR,
    payoutCategory,
    enforceRateLimit: false,
  } as Parameters<typeof validateWithdrawal>[0]);
}

beforeEach(() => {
  state.settings = baseSettings();
  state.kyc = null;
  state.wallet = { isActive: true, kycVerified: false, creditBalance: 100_000, totalDeposited: 1000 };
  state.lastDeposit = null;
});

describe("the original-method rule", () => {
  it.each([
    ["card", false],
    ["Visa •••• 4242", false],
    ["apmgw_SEPA", true],
    ["Bank transfer", true],
    ["wire", true],
    [undefined, false],
  ])("classifies %s as bank-funded=%s", (pm, expected) => {
    expect(isBankFundedPaymentMethod(pm as string | undefined)).toBe(expected);
  });

  it("blocks only a bank payout of card-funded money while the control is on", () => {
    const base = { required: true, hasDeposit: true, lastDepositPaymentMethod: "card" };
    expect(originalMethodBlocksPayout({ ...base, payoutCategory: "bank_transfer" })).toBe(true);
    expect(originalMethodBlocksPayout({ ...base, payoutCategory: "card_payout" })).toBe(false);
    expect(originalMethodBlocksPayout({ ...base, required: false, payoutCategory: "bank_transfer" })).toBe(false);
    expect(originalMethodBlocksPayout({ ...base, hasDeposit: false, payoutCategory: "bank_transfer" })).toBe(false);
    expect(
      originalMethodBlocksPayout({ ...base, lastDepositPaymentMethod: "apmgw_SEPA", payoutCategory: "bank_transfer" }),
    ).toBe(false);
  });
});

describe("the validator honours each admin control", () => {
  it("passes with every control off (control case)", async () => {
    const r = await run("bank_transfer");
    expect(r.ok).toBe(true);
  });

  it("KYC: refuses an unverified wallet when the withdrawal settings require KYC", async () => {
    state.settings = baseSettings({ requireKYC: true });
    const r = await run("card_payout");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("KYC_REQUIRED");
  });

  it("KYC: refuses when the KYC settings screen requires it for withdrawals", async () => {
    state.kyc = { enabled: true, requiredForWithdrawal: true, requiredAmount: 0 };
    const r = await run("card_payout");
    expect(!r.ok && r.code).toBe("KYC_REQUIRED");
  });

  it("KYC: a verified wallet passes", async () => {
    state.settings = baseSettings({ requireKYC: true });
    state.wallet = { ...state.wallet, kycVerified: true };
    const r = await run("card_payout");
    expect(r.ok).toBe(true);
  });

  it("KYC: below the amount threshold it warns instead of refusing", async () => {
    state.kyc = { enabled: true, requiredForWithdrawal: true, requiredAmount: 100 };
    const r = await run("card_payout", 50);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.join(" ")).toMatch(/KYC verification will be required/);
  });

  it("hold period: refuses inside the window after the last deposit", async () => {
    state.settings = baseSettings({ holdPeriodAfterDeposit: 24 });
    state.lastDeposit = { createdAt: new Date(Date.now() - 2 * 3600_000), paymentMethod: "card" };
    const r = await run("card_payout");
    expect(!r.ok && r.code).toBe("HOLD_PERIOD_ACTIVE");
  });

  it("hold period: passes once the window has elapsed", async () => {
    state.settings = baseSettings({ holdPeriodAfterDeposit: 24 });
    state.lastDeposit = { createdAt: new Date(Date.now() - 30 * 3600_000), paymentMethod: "card" };
    const r = await run("card_payout");
    expect(r.ok).toBe(true);
  });

  it("original method: refuses a bank payout of a card deposit, with the stated reason", async () => {
    state.settings = baseSettings({ requireOriginalPaymentMethod: true });
    state.lastDeposit = { createdAt: new Date(Date.now() - 72 * 3600_000), paymentMethod: "card" };
    const r = await run("bank_transfer");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ORIGINAL_METHOD_REQUIRED");
      expect(r.error).toBe(ORIGINAL_METHOD_REQUIRED_MESSAGE);
    }
  });

  it("original method: the card payout of the same deposit is allowed", async () => {
    state.settings = baseSettings({ requireOriginalPaymentMethod: true });
    state.lastDeposit = { createdAt: new Date(Date.now() - 72 * 3600_000), paymentMethod: "card" };
    const r = await run("card_payout");
    expect(r.ok).toBe(true);
  });

  it("original method: a bank-funded deposit may still go back by bank", async () => {
    state.settings = baseSettings({ requireOriginalPaymentMethod: true });
    state.lastDeposit = { createdAt: new Date(Date.now() - 72 * 3600_000), paymentMethod: "apmgw_SEPA" };
    const r = await run("bank_transfer");
    expect(r.ok).toBe(true);
  });

  it("original method: switched off, the same card deposit may go by bank", async () => {
    state.lastDeposit = { createdAt: new Date(Date.now() - 72 * 3600_000), paymentMethod: "card" };
    const r = await run("bank_transfer");
    expect(r.ok).toBe(true);
  });
});

describe("the control is wired end to end", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("is declared in both model copies with default false", () => {
    for (const p of [
      "database/models/withdrawal-settings.model.ts",
      "apps/admin/database/models/withdrawal-settings.model.ts",
    ]) {
      expect(read(p)).toMatch(/requireOriginalPaymentMethod:\s*\{\s*type:\s*Boolean,\s*default:\s*false\b/);
    }
  });

  it("both withdrawal routes go through the shared validator", () => {
    expect(read("app/api/wallet/withdraw/route.ts")).toMatch(/validateWithdrawal\(/);
    expect(read("app/api/nuvei/withdrawal/route.ts")).toMatch(/validateWithdrawal\(/);
  });

  it("the admin screen offers the switch outside the Nuvei-only block", () => {
    const src = read("apps/admin/components/admin/WithdrawalSettingsSection.tsx");
    expect(src).toMatch(/updateSetting\("requireOriginalPaymentMethod", checked\)/);
  });

  it("the method list hides bank accounts when the rule would refuse them", () => {
    const src = read("app/api/wallet/withdraw/route.ts");
    expect(src).toMatch(/originalMethodEnforced/);
    expect(src).toMatch(/preferOriginalMethod:\s*withdrawalSettings\.nuveiPreferCardRefund === true/);
  });

  it("the modal honours the prefer-card-refund preference", () => {
    const src = read("components/trading/WithdrawalModal.tsx");
    expect(src).toMatch(/data\.preferOriginalMethod && originalMethod/);
  });
});
