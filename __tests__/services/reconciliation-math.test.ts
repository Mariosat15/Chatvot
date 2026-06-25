/**
 * Tests for reconciliation money math (lib/services/reconciliation-math.ts).
 *
 * These lock the financial rules that power the Financial Dashboard and the
 * reconciliation engine, covering every input class the system tracks:
 * deposits, withdrawals (completed + in-flight), refunds that deduct credits
 * (clawbacks), real credit refunds, admin adjustments, wins/losses, incident
 * compensation, GM earnings, and chargebacks. If any of these rules ever drift,
 * a test breaks before a customer's balance does.
 */
import { describe, it, expect } from "vitest";
import {
  round2,
  sumAmounts,
  computeExpectedBalance,
  balanceDifference,
  isBalanceMismatch,
  classifyBalanceMismatchSeverity,
  netSpent,
  evaluateClawback,
} from "@/lib/services/reconciliation-math";

describe("round2 / sumAmounts", () => {
  it("rounds to the cent", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(0)).toBe(0);
  });

  it("treats undefined/NaN amounts as 0", () => {
    expect(sumAmounts([10, undefined as unknown as number, 5])).toBe(15);
    expect(sumAmounts([])).toBe(0);
  });

  it("does not leak floating point noise", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in raw JS
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
  });
});

describe("computeExpectedBalance — the source of truth", () => {
  it("pure deposit equals the deposit amount", () => {
    expect(computeExpectedBalance([100])).toBe(100);
  });

  it("deposit minus completed withdrawal (signed amounts)", () => {
    // +100 deposit, -40 completed withdrawal transaction
    expect(computeExpectedBalance([100, -40])).toBe(60);
  });

  it("subtracts in-flight (pending) withdrawal credits", () => {
    // Wallet was already debited 30 for a pending withdrawal, but that
    // withdrawal txn is not 'completed' yet, so it's not in the sum.
    // Completed sum = 100, pending = 30 -> expected 70 (matches live wallet).
    expect(computeExpectedBalance([100], 30)).toBe(70);
  });

  it("REGRESSION: ignoring pending credits over-states the balance", () => {
    const withPending = computeExpectedBalance([100], 30); // correct
    const withoutPending = computeExpectedBalance([100], 0); // the old bug
    expect(withPending).toBe(70);
    expect(withoutPending).toBe(100);
    // The 30-credit gap is exactly what used to trigger false criticals.
    expect(withoutPending - withPending).toBe(30);
  });

  it("aggregates every transaction class into one balance", () => {
    const amounts = [
      200, // deposit
      -50, // competition entry (loss/spend)
      120, // competition win
      -30, // marketplace purchase
      25, // competition refund (real credit refund)
      -200, // chargeback clawback (admin_adjustment -)
      40, // incident compensation
      15, // gamemaster earning
      -10, // admin adjustment (debit)
    ];
    // 200-50+120-30+25-200+40+15-10 = 110
    expect(computeExpectedBalance(amounts)).toBe(110);
  });

  it("chargeback fully reverses its deposit (nets to zero)", () => {
    // +100 disputed deposit, then -100 chargeback clawback
    expect(computeExpectedBalance([100, -100])).toBe(0);
  });

  it("refund-clawback removes exactly the refunded credits", () => {
    // +50 Atlas deposit, refunded to card, then -50 clawback adjustment
    expect(computeExpectedBalance([50, -50])).toBe(0);
  });
});

describe("balanceDifference / isBalanceMismatch", () => {
  it("equal balances are not a mismatch", () => {
    expect(balanceDifference(70, 70)).toBe(0);
    expect(isBalanceMismatch(70, 70)).toBe(false);
  });

  it("sub-cent rounding noise is tolerated", () => {
    expect(isBalanceMismatch(70.004, 70)).toBe(false);
    expect(isBalanceMismatch(69.995, 70, 0.01)).toBe(false);
  });

  it("a real gap is a mismatch with the correct sign", () => {
    expect(isBalanceMismatch(100, 70)).toBe(true);
    expect(balanceDifference(100, 70)).toBe(30);
    expect(balanceDifference(40, 70)).toBe(-30);
  });

  it("a wallet with a pending withdrawal reconciles cleanly", () => {
    const completed = [100];
    const pendingWithdrawalCredits = 30;
    const liveWalletBalance = 70; // already debited
    const expected = computeExpectedBalance(
      completed,
      pendingWithdrawalCredits,
    );
    expect(isBalanceMismatch(liveWalletBalance, expected)).toBe(false);
  });
});

describe("classifyBalanceMismatchSeverity", () => {
  it("is critical when nothing pending can explain a gap", () => {
    expect(
      classifyBalanceMismatchSeverity({
        pendingWithdrawalCredits: 0,
        pendingDepositCredits: 0,
      }),
    ).toBe("critical");
  });

  it("downgrades to info when a pending withdrawal exists", () => {
    expect(
      classifyBalanceMismatchSeverity({ pendingWithdrawalCredits: 30 }),
    ).toBe("info");
  });

  it("downgrades to info when a pending deposit exists", () => {
    expect(
      classifyBalanceMismatchSeverity({ pendingDepositCredits: 50 }),
    ).toBe("info");
  });
});

describe("netSpent (gross spend minus refunds)", () => {
  it("subtracts refunds from gross spend", () => {
    expect(netSpent(100, 25)).toBe(75);
  });

  it("fully refunded activity nets to zero", () => {
    expect(netSpent(50, 50)).toBe(0);
  });

  it("handles missing values", () => {
    expect(netSpent(undefined as unknown as number, 0)).toBe(0);
  });
});

describe("evaluateClawback — refund clawback safety", () => {
  it("allows a full clawback within balance", () => {
    const r = evaluateClawback({ currentBalance: 100, grantedCredits: 50 });
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(50);
    expect(r.newBalance).toBe(50);
  });

  it("allows a partial clawback override", () => {
    const r = evaluateClawback({
      currentBalance: 100,
      grantedCredits: 50,
      requestedAmount: 20,
    });
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(20);
    expect(r.newBalance).toBe(80);
  });

  it("rejects a clawback that exceeds the credits originally granted", () => {
    const r = evaluateClawback({
      currentBalance: 100,
      grantedCredits: 50,
      requestedAmount: 60,
    });
    expect(r.ok).toBe(false);
    expect(r.newBalance).toBe(100); // unchanged
    expect(r.error).toMatch(/exceeds/i);
  });

  it("never forces a negative balance (user already spent it)", () => {
    const r = evaluateClawback({ currentBalance: 20, grantedCredits: 50 });
    expect(r.ok).toBe(false);
    expect(r.newBalance).toBe(20); // unchanged
    expect(r.error).toMatch(/already spent|loss|fraud/i);
  });

  it("rejects invalid (zero / negative / NaN) amounts", () => {
    expect(
      evaluateClawback({
        currentBalance: 100,
        grantedCredits: 0,
      }).ok,
    ).toBe(false);
    expect(
      evaluateClawback({
        currentBalance: 100,
        grantedCredits: 50,
        requestedAmount: 0,
      }).ok,
    ).toBe(false);
    expect(
      evaluateClawback({
        currentBalance: 100,
        grantedCredits: 50,
        requestedAmount: NaN,
      }).ok,
    ).toBe(false);
  });

  it("allows clawing back the exact full balance to zero", () => {
    const r = evaluateClawback({ currentBalance: 50, grantedCredits: 50 });
    expect(r.ok).toBe(true);
    expect(r.newBalance).toBe(0);
  });
});
