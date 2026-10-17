import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  reconcilePrizePoolAgainstCollectedFees,
} from "@/lib/services/settlement/prize-pool-integrity";

/**
 * R1 residual — under-count branch of the finalize-time prize-pool safeguard.
 *
 * The over-count cap has existed since Stage 0. The under-count raise is what
 * this suite pins: a writer that increments seats but forgets `$inc prizePool`
 * must not underpay winners with no log line.
 */

describe("reconcilePrizePoolAgainstCollectedFees", () => {
  it("leaves a matching pool untouched", () => {
    expect(reconcilePrizePoolAgainstCollectedFees(300, 3, 100)).toEqual({
      prizePool: 300,
      collectedFees: 300,
      correction: null,
    });
  });

  it("caps an over-counted pool", () => {
    expect(reconcilePrizePoolAgainstCollectedFees(10_000, 3, 100)).toEqual({
      prizePool: 300,
      collectedFees: 300,
      correction: "over",
    });
  });

  it("raises an under-counted pool", () => {
    // Reason: the Stage 0 residual — seats incremented, pool not. Without this
    // branch winners are paid from 100 while 300 was collected.
    expect(reconcilePrizePoolAgainstCollectedFees(100, 3, 100)).toEqual({
      prizePool: 300,
      collectedFees: 300,
      correction: "under",
    });
  });

  it("raises a zero stored pool when fees were collected", () => {
    expect(reconcilePrizePoolAgainstCollectedFees(0, 2, 50)).toEqual({
      prizePool: 100,
      collectedFees: 100,
      correction: "under",
    });
  });

  it("does nothing when no fees were collected (free contest)", () => {
    expect(reconcilePrizePoolAgainstCollectedFees(500, 10, 0)).toEqual({
      prizePool: 500,
      collectedFees: 0,
      correction: null,
    });
  });

  it("treats a missing stored pool as zero for the under-count check", () => {
    expect(reconcilePrizePoolAgainstCollectedFees(NaN as unknown as number, 2, 100)).toEqual({
      prizePool: 200,
      collectedFees: 200,
      correction: "under",
    });
  });
});

describe("prize-pool-integrity mirror", () => {
  it("keeps the admin copy byte-identical to the main one", () => {
    const main = readFileSync(
      resolve("lib/services/settlement/prize-pool-integrity.ts"),
      "utf8",
    );
    const admin = readFileSync(
      resolve("apps/admin/lib/services/settlement/prize-pool-integrity.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });
});
