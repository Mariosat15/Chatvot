/**
 * The contest-entry contract: what a caller passes in, and what it can get back.
 *
 * Split out of `contest-entry.service.ts` so that a route or a guard can depend on the
 * shapes without pulling in the transaction body. See that file for the design rationale.
 */

/**
 * Why an entry was refused. The caller maps this to an HTTP status or a toast; the service
 * never decides either. `contended` is the only code worth retrying.
 */
export type ContestEntryFailureCode =
  | "invalid_id"
  | "email_unverified"
  | "restricted"
  | "fraud_blocked"
  | "not_found"
  | "not_open"
  | "registration_closed"
  | "full"
  | "level_requirement"
  | "no_wallet"
  | "insufficient_balance"
  | "contended"
  | "failed";

export interface ContestEntrySuccess {
  success: true;
  participantId: string;
  /** True when the seat already existed. No fee is taken and no counter moves. */
  alreadyEntered: boolean;
  feeCharged: number;
  /**
   * `startingCapital` is optional because a provider-game contest has none - the field is
   * required on the `Competition` schema only when the contest is trading. Typed as
   * possibly-absent so a caller has to decide what to show rather than rendering
   * `undefined`; every existing consumer already falls back with `|| 10000` or `|| 0`.
   */
  competition: { name: string; startingCapital?: number };
}

export interface ContestEntryFailure {
  success: false;
  code: ContestEntryFailureCode;
  error: string;
}

export type ContestEntryResult = ContestEntrySuccess | ContestEntryFailure;

/** The person entering. Authentication happens before this; the service trusts these values. */
export interface ContestEntryActor {
  userId: string;
  email: string;
  username: string;
  emailVerified: boolean;
  /** Client IP, for the fraud gate's VPN/proxy/datacenter checks. Optional. */
  ip?: string;
  /**
   * Simulator and internal callers set this to skip the person-level gates - email
   * verification, restrictions and fraud - which are meaningless for synthetic users.
   * It does NOT skip any contest-level or money guard. Reason: the simulator seeds users
   * that have no verified email and no fraud history, and gating them would make the
   * simulator untestable, but nothing may let it take a fee without funding the pool.
   */
  trusted?: boolean;
}

export const fail = (
  code: ContestEntryFailureCode,
  error: string,
): ContestEntryFailure => ({ success: false, code, error });
