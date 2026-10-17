/**
 * Mutable context for testing Next.js server actions.
 *
 * Server actions read the caller's identity from ambient request state - the session and
 * the request headers - and they consult guard services before doing anything. None of
 * that exists in a test process, so the modules providing it have to be replaced.
 *
 * `vi.mock` factories are hoisted above the file's imports and cannot close over local
 * variables, so they cannot be handed a value directly. What they *can* do is import a
 * module. This file is that module: the mock factories read from it, and tests write to
 * it. That keeps a single mutable place per test file rather than a fresh mock per test.
 *
 * Reset it in `beforeEach`. A leaked session from a previous test is the kind of failure
 * that looks like a logic bug for an hour.
 */

export interface TestSessionUser {
  id: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

export interface RestrictionOutcome {
  allowed: boolean;
  reason?: string;
}

export interface FraudOutcome {
  allowed: boolean;
  reason?: string;
}

interface ActionContext {
  /** null means "nobody is logged in", which makes the action redirect. */
  session: { user: TestSessionUser } | null;
  /**
   * When set, each session lookup consumes the next id instead of using `session`.
   *
   * Reason: concurrency tests fire many calls at once and every one of them must be a
   * different player, or the test proves nothing - a competition cannot be joined twice by
   * the same account, so a shared session would just exercise the duplicate-entry guard 19
   * times. A single mutable `session` cannot express "a different caller per call", because
   * all the calls are in flight together. Which caller gets which slot does not matter;
   * only that they are distinct.
   */
  sessionQueue: string[] | null;
  /** Request headers the action reads, e.g. x-forwarded-for for the fraud gate. */
  headers: Record<string, string>;
  restriction: RestrictionOutcome;
  fraud: FraudOutcome;
  /** Paths passed to revalidatePath, so a test can assert the cache was invalidated. */
  revalidated: string[];
  /** Set when the action called redirect(), with the target. */
  redirectedTo: string | null;
}

/**
 * Reason: this must be a 24-character hex string, not a readable label like "test-user-1".
 * Better Auth uses the MongoDB adapter, so `session.user.id` is the string form of a real
 * ObjectId. Most models type `userId` as a String and would accept anything, but the fraud
 * models (`TradingBehaviorProfile`) declare it as `Schema.Types.ObjectId`, so a readable id
 * throws a CastError. That error is caught and logged rather than surfaced, which is the
 * trap: the test still passes while a whole branch of the entry path - the coordinated-entry
 * fraud detection - silently errors out and never runs. A fixture that cannot reach the code
 * under test is worse than no fixture, because it looks like coverage.
 */
const DEFAULT_USER_ID = "6500000000000000000000a1";

const DEFAULT_USER: TestSessionUser = {
  id: DEFAULT_USER_ID,
  email: "player@example.com",
  name: "Test Player",
  emailVerified: true,
};

export { DEFAULT_USER_ID };

function defaults(): ActionContext {
  return {
    session: { user: { ...DEFAULT_USER } },
    sessionQueue: null,
    headers: { "x-forwarded-for": "203.0.113.10" },
    restriction: { allowed: true },
    fraud: { allowed: true },
    revalidated: [],
    redirectedTo: null,
  };
}

export const ctx: ActionContext = defaults();

/** Call in beforeEach. Restores a logged-in, verified, unrestricted, unflagged player. */
export function resetActionContext(): void {
  Object.assign(ctx, defaults());
}

// ---- convenience setters, so tests read as intent rather than as plumbing -------------

export function signInAs(user: Partial<TestSessionUser>): void {
  ctx.session = { user: { ...DEFAULT_USER, ...user } };
}

export function signOut(): void {
  ctx.session = null;
}

/**
 * The session lookup the auth mock should perform. Handles the queue case.
 *
 * Reason: keeping this beside the queue means every test file's mock behaves identically.
 * A file that reimplemented it and forgot the queue would silently run its concurrency
 * test as one player twenty times, and still pass.
 */
export function currentSession(): { user: TestSessionUser } | null {
  if (ctx.sessionQueue && ctx.sessionQueue.length > 0) {
    const id = ctx.sessionQueue.shift() as string;
    return { user: { ...DEFAULT_USER, id, email: `${id}@example.com` } };
  }
  return ctx.session;
}

/** Generates `count` distinct ObjectId-shaped ids and queues them, returning the list. */
export function signInAsDistinctPlayers(count: number): string[] {
  const ids = Array.from({ length: count }, (_, i) =>
    // 24 hex characters, unique per index. Must be ObjectId-shaped - see DEFAULT_USER_ID.
    (i + 1).toString(16).padStart(24, "b"),
  );
  ctx.sessionQueue = [...ids];
  return ids;
}

export function withUnverifiedEmail(): void {
  signInAs({ emailVerified: false });
}

export function withRestriction(reason: string): void {
  ctx.restriction = { allowed: false, reason };
}

export function withFraudBlock(reason: string): void {
  ctx.fraud = { allowed: false, reason };
}

/**
 * Thrown by the redirect mock.
 *
 * Reason: Next's real redirect() throws to unwind the request, and callers are written on
 * that assumption. A mock that returned normally would let execution continue past a
 * redirect and produce behaviour that cannot happen in production.
 *
 * The `digest` property is the load-bearing part, and getting it wrong sends you chasing
 * a bug that is not there. Server actions in this codebase wrap everything in a catch that
 * converts errors into `{ success: false, error }`, and they identify Next's own
 * control-flow errors by testing `digest.startsWith("NEXT_")` so those alone are re-thrown.
 * A redirect error without a digest gets swallowed and turned into a result object, so the
 * redirect silently never happens - which is what a naive mock reproduces, wrongly blaming
 * the production code. Real Next uses `NEXT_REDIRECT;<type>;<url>;<status>;`.
 */
export class TestRedirectError extends Error {
  public readonly digest: string;

  constructor(public readonly target: string) {
    super(`NEXT_REDIRECT:${target}`);
    this.name = "TestRedirectError";
    this.digest = `NEXT_REDIRECT;replace;${target};307;`;
  }
}
