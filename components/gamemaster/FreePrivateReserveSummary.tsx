"use client";

import { computeFreePrivateReserve } from "@/lib/services/gamemaster/free-private-competition";

/**
 * Live reserve for a funded private competition: entry fee x max players, taken from the
 * Game Master's wallet when the contest is created.
 *
 * Reason it reads the shared `computeFreePrivateReserve`: the create route reserves with the
 * same function, so the figure shown here is the figure debited - a second formula in the
 * browser is the "one rule, two copies" shape.
 */
export default function FreePrivateReserveSummary({
  entryFee,
  maxParticipants,
  walletBalance,
  currencySymbol = "",
}: {
  entryFee: unknown;
  maxParticipants: unknown;
  walletBalance: number | null;
  currencySymbol?: string;
}) {
  const reserve = computeFreePrivateReserve(entryFee, maxParticipants);
  const short =
    reserve !== null && walletBalance !== null && walletBalance < reserve;

  return (
    <div className="space-y-2 rounded-xl border border-cyan-800/60 bg-cyan-950/30 p-4 text-sm">
      <div className="font-semibold text-cyan-200">You are funding this competition</div>
      {reserve === null ? (
        <p className="text-amber-200">
          Set an entry fee of at least 1 and at least 2 players to see the reserve.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-2 text-gray-200">
            <span>Reserved from your wallet now</span>
            <span className="font-bold">
              {reserve} {currencySymbol}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-gray-400">
            <span>Your wallet balance</span>
            <span>
              {walletBalance === null ? "-" : `${walletBalance} ${currencySymbol}`}
            </span>
          </div>
          {short && (
            <p className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-red-200">
              Your balance is too low to fund every seat. Lower the entry fee or the player
              limit, or top up your wallet.
            </p>
          )}
        </>
      )}
      <ul className="list-disc space-y-1 pl-5 text-xs text-gray-400">
        <li>Each player who joins uses one seat. Unused seats return to you when it ends.</li>
        <li>The platform fee is still taken from the prize pool when it settles.</li>
        <li>
          If too few players join, or a platform fault cancels it, you get everything back.
        </li>
        <li>If nobody qualifies for a prize, the remaining pool returns to you.</li>
      </ul>
    </div>
  );
}
