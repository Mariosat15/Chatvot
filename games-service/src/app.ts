import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

import { loadConfig } from "./config";
import { listGames } from "./http/catalogue";
import { serveAsset } from "./http/assets";
import { ApiError, sendError } from "./http/errors";
import { requirePlatformAuth, type SignedRequest } from "./http/inbound-auth";
import { servePlayAsset, servePlayPage } from "./http/play-page";
import { getState, postLeave, postSession, postSubmit } from "./http/play-routes";
import { getRound, postRound, postVoidRound } from "./http/rounds";
import { armRound, finishRoundForTesting, redeliver, requireSandbox } from "./http/sandbox";

/**
 * The Express application.
 *
 * Separated from `index.ts` so the app can be constructed without starting a listener or a
 * sweeper, which is what makes the endpoints testable in-process.
 */

/**
 * Wraps an async handler so a rejected promise reaches the error handler.
 *
 * Express 4 does not await handlers, so a `throw` inside an async one becomes an unhandled
 * rejection: the client waits until it times out, the error handler never runs, and the log shows a
 * warning with no request context. Every async route goes through here, and the reason it is a
 * helper rather than a convention is that a convention is something one route will eventually be
 * written without.
 */
function wrap(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function createApp() {
  const app = express();
  const config = loadConfig();

  app.disable("x-powered-by");
  // Behind a proxy in any real deployment, and the timestamp check plus the launch tokens are the
  // only things that care about the client - never the IP - so this is set purely so that
  // `req.protocol` is right when launch URLs are built from a forwarded request.
  app.set("trust proxy", true);

  /**
   * The raw body, captured for the HMAC.
   *
   * `verify` runs before the parsed body exists, which is the only place the exact bytes are still
   * available. Re-serialising `req.body` later does not reproduce them - key order, whitespace and
   * number formatting all shift - so a signature checked against a re-serialisation fails for
   * valid requests and can be made to pass for crafted ones.
   */
  app.use(
    express.json({
      limit: "256kb",
      verify: (req, _res, buffer) => {
        (req as SignedRequest).rawBody = buffer.toString("utf8");
      },
    }),
  );

  /**
   * The frame headers.
   *
   * The specification requires the game to work embedded: no `X-Frame-Options: DENY`, and a
   * `frame-ancestors` policy that permits the platform's domain. `X-Frame-Options` is deliberately
   * NOT set at all rather than set to a permissive value - it has no allowlist form that browsers
   * agree on, and its presence beside a `frame-ancestors` directive is a well-known way to have one
   * browser honour the wrong rule.
   *
   * `GAMES_FRAME_ANCESTORS` is unset by default, which leaves the game embeddable anywhere. That
   * is the correct default for a service that has not yet been told who its customer is, and it
   * is enforced at boot in production only - see `requiredInProduction` in `config.ts`. This
   * comment used to say the check was left to the README "because a service that refused to boot
   * without it could not be smoke-tested"; the smoke tools do not set `NODE_ENV=production`, so
   * the two cases are separable and the trade-off was never necessary.
   *
   * Read from the config rather than from `process.env` so the value serving requests is the same
   * one boot validated. Reading the environment again here would let the two diverge.
   */
  app.use((_req, res, next) => {
    const ancestors = config.frameAncestors;
    if (ancestors) {
      res.setHeader("Content-Security-Policy", `frame-ancestors ${ancestors}`);
    }
    next();
  });

  // ── health ────────────────────────────────────────────────────────────────────────────────────
  //
  // Unauthenticated on purpose, and it deliberately says nothing about rounds, players or scores.
  // A health endpoint is the one thing a load balancer must be able to reach without credentials,
  // so anything it reveals is public.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "chartvolt-games", sandbox: config.sandbox });
  });

  // ── the platform-facing API ───────────────────────────────────────────────────────────────────
  const v1 = express.Router();
  v1.use(requirePlatformAuth);

  v1.get("/games", listGames);
  v1.post("/rounds", wrap(postRound));
  v1.get("/rounds/:roundId", wrap(getRound));
  v1.post("/rounds/:roundId/void", wrap(postVoidRound));

  app.use("/v1", v1);

  // ── sandbox controls ──────────────────────────────────────────────────────────────────────────
  const sandbox = express.Router();
  sandbox.use(requireSandbox, requirePlatformAuth);
  sandbox.post("/rounds/:roundId/arm", wrap(armRound));
  sandbox.post("/rounds/:roundId/finish", wrap(finishRoundForTesting));
  sandbox.post("/rounds/:roundId/deliver", wrap(redeliver));
  app.use("/sandbox", sandbox);

  // ── catalogue artwork ─────────────────────────────────────────────────────────────────────────
  app.get("/assets/:gameCode/:asset", serveAsset);

  // ── the play surface ──────────────────────────────────────────────────────────────────────────
  //
  // The page and its assets first, then the client-facing API. The two are separate concerns that
  // happen to share a prefix: `/play` is served to an unauthenticated browser, and `/play/api/*`
  // authenticates with the launch token from the URL that browser was given.
  app.get("/play", servePlayPage);
  app.get("/play/:asset", servePlayAsset);

  app.post("/play/api/session", wrap(postSession));
  app.get("/play/api/state", wrap(getState));
  app.post("/play/api/submit", wrap(postSubmit));
  app.post("/play/api/leave", wrap(postLeave));

  // ── JSON for everything, including the two cases no handler sees ───────────────────────────────
  //
  // Section 14: "always return JSON, never an HTML error page - an HTML body forces us to guess
  // what went wrong". Express answers an unknown path with HTML and an unhandled throw with an HTML
  // stack trace, and neither passes through a route handler. A service whose handlers are all
  // careful still fails this requirement in exactly the two situations most likely to occur during
  // an incident, which is why both are installed explicitly.
  app.use((_req, res) => {
    sendError(res, 404, "NOT_FOUND", "No such endpoint.");
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      sendError(res, error.status, error.code, error.message, error.retryable);
      return;
    }

    // A malformed JSON body arrives here from the body parser rather than from a handler.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { type?: string }).type === "entity.parse.failed"
    ) {
      sendError(res, 400, "INVALID_REQUEST", "Request body is not valid JSON.");
      return;
    }

    console.error("❌ [games-service] unhandled error:", error);
    // Retryable, deliberately. An unexpected throw is far more often a transient fault than a
    // permanent one, and the specification's own reading of a 5xx is that the platform retries
    // three times and then fails the round WITHOUT consuming the player's attempt. Marking it
    // fatal would spend a paying player's round on our bug.
    sendError(res, 500, "INTERNAL", "Something went wrong. Please contact support.", true);
  });

  return app;
}
