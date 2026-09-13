import type { Request, Response } from "express";

import { findTitle, shapeFor, type TitleDefinition } from "../games/titles";
import { generatePuzzle } from "../engine/generate";
import { SeededRandom } from "../engine/rng";

/**
 * Catalogue artwork, drawn rather than stored.
 *
 * WHY THE ARTWORK IS GENERATED
 * ----------------------------
 * The specification requires a thumbnail, a banner and ideally screenshots, at stated minimum
 * sizes, on stable HTTPS URLs. A reference provider that returned URLs to files nobody committed
 * would advertise a catalogue whose images 404, and the platform would cache those 404s - a
 * failure that looks like a platform bug and is a provider bug.
 *
 * Drawing them from the puzzle engine also makes them honest: the picture on the catalogue card
 * is a real board this game can produce, from a fixed seed, so it cannot drift away from the
 * game the way a hand-made mock-up does.
 *
 * SVG rather than raster is a deliberate deviation from the spirit of "4:3, minimum 400x300",
 * recorded rather than hidden. A vector image has no intrinsic pixel size, so it satisfies any
 * minimum by definition, and the `viewBox` carries the aspect ratio the platform's layout needs.
 */

/** A muted palette, so the artwork sits inside the platform's own styling rather than shouting. */
const WIRE_COLOURS = [
  "#2f6f9f",
  "#c2703c",
  "#4e8c62",
  "#8a5fa8",
  "#b8913c",
  "#9f4756",
  "#3f8c95",
  "#7a6a5a",
];

function colourFor(index: number): string {
  return WIRE_COLOURS[index % WIRE_COLOURS.length];
}

/**
 * Draws one board as SVG, at a fixed seed.
 *
 * The solved paths are shown, which is safe precisely because the seed is a constant chosen here
 * and never used for a round. Section 12 forbids exposing a round's `contentSeed` and forbids any
 * endpoint that turns a seed into content; a fixed marketing seed that no contest can ever be
 * issued is neither.
 */
function boardSvg(title: TitleDefinition, seed: string, cell: number): string {
  const shape = shapeFor("medium");
  const puzzle = generatePuzzle(seed, shape);
  const rng = new SeededRandom(`${seed}:paint`);

  const width = puzzle.width * cell;
  const height = puzzle.height * cell;
  const parts: string[] = [];

  parts.push(`<rect width="${width}" height="${height}" rx="10" fill="#f7f9fb"/>`);

  for (let x = 0; x <= puzzle.width; x++) {
    parts.push(
      `<line x1="${x * cell}" y1="0" x2="${x * cell}" y2="${height}" stroke="#e3e9f0" stroke-width="1"/>`,
    );
  }
  for (let y = 0; y <= puzzle.height; y++) {
    parts.push(
      `<line x1="0" y1="${y * cell}" x2="${width}" y2="${y * cell}" stroke="#e3e9f0" stroke-width="1"/>`,
    );
  }

  const centre = (v: number) => v * cell + cell / 2;

  puzzle.solution.forEach((path, index) => {
    const colour = colourFor(index);
    const points = path.map(([x, y]) => `${centre(x)},${centre(y)}`).join(" ");
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${colour}" stroke-width="${Math.round(
        cell * 0.3,
      )}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`,
    );

    const ends = [path[0], path[path.length - 1]];
    for (const [x, y] of ends) {
      parts.push(
        `<circle cx="${centre(x)}" cy="${centre(y)}" r="${Math.round(
          cell * 0.24,
        )}" fill="${colour}"/>`,
      );
    }
  });

  // `rng` is consumed so the decorative accent varies between titles without a second seed.
  const accent = rng.int(2) === 0 ? "#143a5c" : "#1d4d75";
  parts.push(
    `<rect width="${width}" height="${height}" rx="10" fill="none" stroke="${accent}" stroke-width="2" opacity="0.25"/>`,
  );

  return `<g>${parts.join("")}</g>`;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(viewBox: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img">${body}</svg>`;
}

function thumbnail(title: TitleDefinition): string {
  const board = boardSvg(title, `${title.gameCode}:thumb`, 44);
  return wrap(
    "0 0 400 300",
    `<rect width="400" height="300" fill="#ffffff"/>
     <g transform="translate(68,24) scale(0.95)">${board}</g>
     <text x="200" y="286" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="600" fill="#143a5c">${escapeText(
       title.displayName,
     )}</text>`,
  );
}

function banner(title: TitleDefinition): string {
  const left = boardSvg(title, `${title.gameCode}:banner-a`, 46);
  const right = boardSvg(title, `${title.gameCode}:banner-b`, 46);
  return wrap(
    "0 0 1600 600",
    `<rect width="1600" height="600" fill="#143a5c"/>
     <g transform="translate(120,160) scale(1.15)" opacity="0.9">${left}</g>
     <g transform="translate(1090,160) scale(1.15)" opacity="0.9">${right}</g>
     <text x="800" y="272" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="66" font-weight="700" fill="#f0dda6">${escapeText(
       title.displayName,
     )}</text>
     <text x="800" y="330" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="27" fill="#cfdcea">${escapeText(
       title.tagline,
     )}</text>`,
  );
}

function icon(title: TitleDefinition): string {
  const board = boardSvg(title, `${title.gameCode}:icon`, 38);
  return wrap(
    "0 0 256 256",
    `<rect width="256" height="256" rx="34" fill="#143a5c"/>
     <g transform="translate(14,14) scale(0.98)">${board}</g>`,
  );
}

function screenshot(title: TitleDefinition, which: string): string {
  const board = boardSvg(title, `${title.gameCode}:shot-${which}`, 62);
  const label =
    title.scoreDirection === "lower_is_better" ? "TOTAL TIME  01:14.8" : "SCORE  4,180";
  return wrap(
    "0 0 720 1280",
    `<rect width="720" height="1280" fill="#0f2338"/>
     <text x="40" y="88" font-family="Consolas, monospace" font-size="30" fill="#f0dda6">${escapeText(
       label,
     )}</text>
     <text x="680" y="88" text-anchor="end" font-family="Consolas, monospace" font-size="30" fill="#cfdcea">BOARD ${escapeText(
       which,
     )}</text>
     <g transform="translate(174,420)">${board}</g>`,
  );
}

const RENDERERS: Record<string, (title: TitleDefinition) => string> = {
  "thumbnail.svg": thumbnail,
  "banner.svg": banner,
  "icon.svg": icon,
  "screenshot-1.svg": (title) => screenshot(title, "1"),
  "screenshot-2.svg": (title) => screenshot(title, "2"),
};

export function serveAsset(req: Request, res: Response): void {
  const title = findTitle(req.params.gameCode ?? "");
  // Reason for a `Map`-free object lookup guarded by `Object.hasOwn`: both `in` and plain
  // indexing walk the prototype chain, so `__proto__` and `toString` would resolve to truthy
  // values that are not renderers. `hasOwn` is total over own keys only.
  const name = req.params.asset ?? "";
  if (!title || !Object.hasOwn(RENDERERS, name)) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "No such asset.", retryable: false },
    });
    return;
  }

  // eslint-disable-next-line security/detect-object-injection
  const svg = RENDERERS[name](title);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // Long cache with an immutable hint: the specification asks for a cache policy and warns
  // against rotating URLs. These are deterministic, so the same URL is the same bytes for ever.
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.send(svg);
}
