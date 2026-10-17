import type { Request, Response } from "express";

import { isTerminal, Round } from "../store/round.model";
import { verifyReplayToken } from "../rounds/report";

/**
 * `GET /replay/:providerRoundId?t=…` — the page behind every result's `replayUrl`.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * Ambiguity A14 / risk R35: the field was required on every result and nothing defined what
 * it served, so this service built a URL that answered `NOT_FOUND`. A dispute over prize money
 * is exactly when somebody follows it.
 *
 * WHAT IT MUST NOT SHOW
 * ---------------------
 * The puzzle content of a contest that may still be live. Boards are identical for every
 * player by design (`contentSeed`), so a replay that redraws the board is a content leak.
 * Serve the player's own attempt summary only — boards solved, duration, status, score.
 *
 * WHEN IT OPENS
 * -------------
 * The round must be terminal. For ranked rounds, `expiresAt` must also have passed, so a
 * finisher cannot read live contest material via their own replay while others are still
 * playing. Practice has no shared contest content to protect and opens as soon as terminal.
 *
 * AUTHENTICATION
 * --------------
 * The `t` query token is an HMAC of the provider round id (see `replayUrl` in `report.ts`).
 * It is unguessable without the inbound API secret and needs no session cookie.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b1220; color: #e8eefc; margin: 0; padding: 2rem; }
    main { max-width: 28rem; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 1rem; margin: 0; }
    dt { color: #8fa3c8; }
    dd { margin: 0; font-variant-numeric: tabular-nums; }
    p.note { color: #8fa3c8; font-size: 0.875rem; margin-top: 1.5rem; }
    p.err { color: #f5a3a3; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export async function serveReplay(req: Request, res: Response): Promise<void> {
  const providerRoundId =
    typeof req.params.providerRoundId === "string" ? req.params.providerRoundId.trim() : "";
  const token = typeof req.query.t === "string" ? req.query.t.trim() : "";

  if (!providerRoundId || !token || !verifyReplayToken(providerRoundId, token)) {
    res
      .status(404)
      .type("html")
      .send(page("Replay not found", "<p class=\"err\">This replay link is invalid or incomplete.</p>"));
    return;
  }

  const round = await Round.findOne({ providerRoundId }).lean();
  if (!round) {
    res
      .status(404)
      .type("html")
      .send(page("Replay not found", "<p class=\"err\">This round no longer exists.</p>"));
    return;
  }

  if (!isTerminal(round.status)) {
    res
      .status(403)
      .type("html")
      .send(
        page(
          "Replay not ready",
          "<p class=\"err\">Replay is available after the round ends.</p>",
        ),
      );
    return;
  }

  // Ranked: wait until the hard stop so a finisher cannot inspect live shared content.
  if (round.mode === "ranked" && round.expiresAt.getTime() > Date.now()) {
    res
      .status(403)
      .type("html")
      .send(
        page(
          "Replay not ready",
          "<p class=\"err\">Replay opens after this round&rsquo;s play window closes.</p>",
        ),
      );
    return;
  }

  const boardsSolved = Array.isArray(round.boards)
    ? round.boards.filter((board) => board.solvedAt).length
    : 0;
  const score =
    typeof round.score === "number" && Number.isFinite(round.score)
      ? String(round.score)
      : "—";
  const duration =
    typeof round.durationMs === "number" && Number.isFinite(round.durationMs)
      ? `${(round.durationMs / 1000).toFixed(1)}s`
      : "—";

  const body = `
    <h1>Your attempt</h1>
    <dl>
      <dt>Status</dt><dd>${escapeHtml(round.status)}</dd>
      <dt>Boards solved</dt><dd>${boardsSolved}</dd>
      <dt>Duration</dt><dd>${escapeHtml(duration)}</dd>
      <dt>Score</dt><dd>${escapeHtml(score)}</dd>
      <dt>Round</dt><dd>${escapeHtml(round.providerRoundId)}</dd>
    </dl>
    <p class="note">This page shows your submitted attempt only. Puzzle content is never shown here.</p>
  `;

  res
    .status(200)
    .type("html")
    .setHeader("Cache-Control", "private, no-store")
    .send(page("Round replay", body));
}
