/**
 * Play surface and result delivery tests. Run with `npx tsx tools/test-play.ts`.
 *
 * THE THREE PROPERTIES THIS FILE EXISTS FOR
 * ----------------------------------------
 * 1. The client cannot influence its own score. Nothing here submits a score, a time or a board -
 *    the client sends paths and the server decides everything else. A provider that trusted the
 *    browser would pass every functional test in this file and still be unusable for prize money.
 *
 * 2. Every round reaches a terminal state and the result actually arrives. Section 13 calls a round
 *    that stops reporting "the worst thing that can happen in this integration", and section 8 asks
 *    for retries over 24 hours with a stable `eventId`. Both are pinned by driving a real callback
 *    receiver that verifies the signature the way the platform does.
 *
 * 3. Every player in one contest faces identical content, while no two see it presented the same
 *    way. Section 12 requires the first and explicitly wants the second, and they pull in opposite
 *    directions - which is exactly why both need a test.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { generateForPlayer } from "../src/engine/generate";
import type { Cell } from "../src/engine/puzzle";
import { shapeFor, type GridSize } from "../src/games/titles";
import { auditPlaySurface, readServableAssets, servedFileNames } from "../src/http/play-page";
import {
  callApi,
  callPlay,
  clearRounds,
  fetchRaw,
  received,
  receiverBehaviour,
  startService,
  stopService,
  summary,
  test,
  tokenFromLaunchUrl,
  waitFor,
} from "./api-harness";

interface ClientBoard {
  index: number;
  width: number;
  height: number;
  pairs: { id: number; a: Cell; b: Cell }[];
}

interface PlayStateBody {
  roundId: string;
  status: string;
  title?: string;
  boardRules?: string[];
  scoring?: string;
  board?: ClientBoard;
  boardsSolved: number;
  boardTarget?: number;
  durationSeconds?: number;
  playableSeconds?: number;
  endsAt?: string;
  finished?: { status: string; boardsSolved: number };
}

const FUTURE = () => new Date(Date.now() + 60 * 60_000).toISOString();

let seedCounter = 0;

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    roundId: `cv_rnd_${Math.random().toString(36).slice(2, 12)}`,
    gameCode: "circuit-sprint",
    mode: "ranked",
    player: { playerId: `cv_p_${Math.random().toString(36).slice(2, 8)}` },
    config: { durationSeconds: 120, gridSize: "medium" },
    contentSeed: `cv_ctst_${++seedCounter}`,
    expiresAt: FUTURE(),
    resultCallbackUrl: "",
    ...overrides,
  };
}

/**
 * The solution to a board, computed the way the server would.
 *
 * This reads the generator's own solution, which is legitimate for a test and would not be for the
 * verifier: `verify.ts` deliberately checks a submission against the RULES rather than against this
 * list, because a puzzle can have several valid coverings and comparing against one of them would
 * reject the others. That independence is proven in `test-engine.ts`; here the solution is only a
 * convenient way to play correctly.
 */
async function solutionFor(
  roundId: string,
  boardIndex: number,
): Promise<{ pairId: number; cells: Cell[] }[]> {
  const { Round } = await import("../src/store/round.model");
  const round = await Round.findOne({ roundId });
  if (!round) throw new Error(`no round ${roundId}`);

  const config = round.config as { gridSize: GridSize };
  const generated = generateForPlayer(
    round.contentSeed ?? round.providerRoundId,
    round.presentationSeed,
    boardIndex,
    shapeFor(config.gridSize),
  );

  return generated.pairs.map((pair, index) => ({
    pairId: pair.id,
    // `index` is the map callback's own counter, one per pair, and the solution has one path per
    // pair by construction.
    // eslint-disable-next-line security/detect-object-injection
    cells: generated.solution[index],
  }));
}

/** A symmetry-invariant fingerprint of a board's content. */
function contentFingerprint(board: ClientBoard): string {
  const distances = board.pairs
    .map(({ a, b }) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]))
    .sort((x, y) => x - y);
  const dims = [board.width, board.height].sort((x, y) => x - y);
  return `${dims.join("x")}|${board.pairs.length}|${distances.join(",")}`;
}

/** A file from the play surface, read off disk. */
function playFile(name: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "public", "play", name), "utf8");
}

/**
 * The same text with its comments removed.
 *
 * Every structural test in this codebase needs this, and the reason is worth restating: these
 * files explain their own anti-patterns in prose. A test that reads the comments flags a correct
 * file for DISCUSSING a mistake, and passes a broken one whose only mention of the right thing is
 * in a comment. Both failures are worse than no test.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The bodies of every block opened by `opener`, brace-matched.
 *
 * Brace-matched rather than regexed, because a regex for "a try block" either stops at the first
 * inner `}` - which is any nested block - or runs to the end of the file. Either way it reports
 * on something other than the block it was aimed at, which is indistinguishable from a test that
 * does not work.
 */
function blockBodies(source: string, opener: RegExp): string[] {
  const bodies: string[] = [];
  for (const match of source.matchAll(opener)) {
    let at = source.indexOf("{", (match.index ?? 0) + match[0].length - 1);
    if (at < 0) continue;
    let depth = 0;
    const from = at + 1;
    for (; at < source.length; at++) {
      const ch = source.charAt(at);
      if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) break;
    }
    bodies.push(source.slice(from, at));
  }
  return bodies;
}

async function openRound(overrides: Record<string, unknown> = {}) {
  const { callbackUrl } = await import("./api-harness");
  const body = createBody({ resultCallbackUrl: callbackUrl, ...overrides });
  const created = await callApi<{ launchUrl: string }>("/v1/rounds", { method: "POST", body });
  if (created.status !== 201) throw new Error(`create failed ${created.status}: ${created.raw}`);
  return { roundId: body.roundId, token: tokenFromLaunchUrl(created.body.launchUrl) };
}

async function main(): Promise<number> {
  await startService({ sandbox: true });

  console.log("");
  console.log("The play surface the launch URL points at");

  await test("the launch URL the platform is handed actually loads a page", async () => {
    /*
     * The whole lifecycle can be correct by API and still be unreachable by clicking, and this
     * platform has already shipped that exact gap twice - a publish route no admin screen called,
     * and a launch route no player screen called. `launchUrl` is the one string the platform puts
     * in an iframe, so it is worth a test that follows it rather than assuming it resolves.
     */
    await clearRounds();
    const { callbackUrl } = await import("./api-harness");
    const created = await callApi<{ launchUrl: string }>("/v1/rounds", {
      method: "POST",
      body: createBody({ resultCallbackUrl: callbackUrl }),
    });
    assert.equal(created.status, 201);

    const page = await fetchRaw(created.body.launchUrl);
    assert.equal(page.status, 200, "the launch URL did not load");
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(page.text, /<svg[^>]+id="board"/, "the page has no board to draw on");
  });

  await test("the page never contains the launch token", async () => {
    // The token is a credential. It has to arrive in the URL, because that is the only channel the
    // specification gives a provider for authenticating an embedded frame - but putting it in the
    // HTML as well would place it in any cache that ignores our headers and in every saved copy of
    // the page. The client reads it from `location.search` instead.
    await clearRounds();
    const { token } = await openRound();
    const page = await fetchRaw(`/play?t=${token}`);
    assert.equal(page.status, 200);
    assert.ok(!page.text.includes(token), "the launch token was rendered into the document");
  });

  await test("every asset the page references is actually served", async () => {
    // A renamed file is a blank frame, and it is the kind of break that a typecheck, a lint and
    // every other test in this repository would pass through: the page is HTML and the allowlist
    // that serves it is TypeScript, so nothing connects the two but this assertion.
    const page = await fetchRaw("/play");
    const references = [...page.text.matchAll(/(?:src|href)="(\/play\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(references.length >= 2, `expected the page to reference assets, saw ${references}`);

    for (const reference of references) {
      const asset = await fetchRaw(reference);
      assert.equal(asset.status, 200, `${reference} is referenced but not served`);
      assert.ok(asset.text.length > 0, `${reference} served nothing`);
    }
  });

  await test("the page has no rules of its own to disagree with the catalogue", async () => {
    /*
     * The other half of the rules-drift fix. The four rules used to be list items in this
     * document, and they had already drifted from the catalogue's wording - a player read one set
     * on the game page and a different set inside the game, with nothing to notice it: markup is
     * invisible to a typecheck, a lint and every mirror check.
     *
     * They arrive in the round state now, so the markup must contain none of them. Asserted
     * against the shared list rather than against remembered phrases, because a literal here
     * would be the copy this test exists to forbid.
     */
    const { BOARD_RULES } = await import("../src/games/instructions");
    const page = await fetchRaw("/play");
    assert.equal(page.status, 200);

    for (const rule of BOARD_RULES) {
      assert.ok(!page.text.includes(rule), `the page hard-codes the rule "${rule}"`);
    }
    // The container the state fills has to exist, or "no rules in the markup" would also be
    // satisfied by a page that shows the player no rules at all.
    assert.match(page.text, /id="intro-rules"/, "the page has nowhere to render the rules");
  });

  await test("every module the play surface imports is served", async () => {
    /*
     * The test above walks the DOCUMENT's references, which is `app.js` and `app.css` and nothing
     * else. `board.js` and `presentation.js` are reached by `import` statements inside other
     * scripts, so no amount of reading the HTML finds them - and a module missing from the
     * allowlist in `play-page.ts` is a 404 in the middle of the module graph. The browser then
     * fails to evaluate the importer too, so the game does not boot at all, and the only evidence
     * is a console message in a player's browser that we will never see.
     *
     * Following the imports rather than listing the files is the point: a module added tomorrow is
     * covered without anybody remembering this test exists.
     */
    const seen = new Set<string>();
    const queue = ["/play/app.js"];

    while (queue.length > 0) {
      const path = queue.shift() as string;
      if (seen.has(path)) continue;
      seen.add(path);

      const asset = await fetchRaw(path);
      assert.equal(asset.status, 200, `${path} is imported but not served`);
      assert.match(
        asset.headers.get("content-type") ?? "",
        /javascript/,
        `${path} was not served as JavaScript`,
      );

      // Relative specifiers only - the surface loads nothing from a third party, deliberately, so
      // a bare or absolute specifier appearing here is a finding in its own right.
      for (const match of asset.text.matchAll(/(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+"([^"]+)"/g)) {
        const specifier = match[1];
        assert.ok(
          specifier.startsWith("./"),
          `${path} imports "${specifier}", which is not a relative module in this directory`,
        );
        queue.push(`/play/${specifier.slice(2)}`);
      }
    }

    /*
     * `sound.js` joined this list on 8 September 2026 and is the proof the walk works as
     * advertised: it was added to the surface, reached only by an `import` in `app.js`, and
     * needed no change here to be covered. Naming the three explicitly is the tripwire for a walk
     * that stops early - a broken crawler visits `app.js`, finds nothing, and reports success.
     */
    assert.ok(
      seen.has("/play/board.js") && seen.has("/play/presentation.js") && seen.has("/play/sound.js"),
      `the walk did not reach the known modules, only ${[...seen].join(", ")}`,
    );
  });

  /*
   * ── the fingerprinted asset URLs ──────────────────────────────────────────────────────────────
   *
   * These exist because of a third outage on 8 September 2026, and it was neither of the first
   * two: nothing was missing and nothing 404ed. A browser held `presentation.js` from four hours
   * earlier and ran it against that morning's `board.js`, which said
   * `does not provide an export named 'newlyJoined'` and stopped the game dead. Half a build from
   * the cache, half from the server, every response a 200.
   */

  await test("the document points at fingerprinted assets, and never at the bare ones", async () => {
    /*
     * The NEGATIVE half is the load-bearing one. A document that references both forms - a
     * fingerprinted `app.js` beside a bare `app.css`, say - satisfies any assertion that a
     * version appears somewhere while leaving the stylesheet exactly as cacheable as before, and
     * the same is true of the whole module graph beneath a bare entry point.
     */
    const page = await fetchRaw("/play");
    assert.equal(page.status, 200);

    const references = [...page.text.matchAll(/(?:src|href)="(\/play\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(references.length >= 2, `expected asset references, saw ${references.join(", ")}`);

    for (const reference of references) {
      assert.match(
        reference,
        /^\/play\/v-[0-9a-f]{12}\//,
        `${reference} is referenced without a fingerprint, so a stale copy is still addressable`,
      );
    }
  });

  await test("a module reached by relative import inherits the fingerprint", async () => {
    /*
     * This is the whole argument for a path segment over `?v=`, and it is the assertion a query
     * string cannot pass. `board.js` reaches `presentation.js` through a literal
     * `import ... from "./presentation.js"` - there is nowhere to put a query string and no way
     * for that file to know the hash. A segment needs no cooperation: the browser resolves the
     * specifier against the importing module's own URL.
     *
     * So the test walks the graph again, this time from the fingerprinted entry point, and
     * requires every module to answer there. `presentation.js` is named explicitly because it is
     * the file that actually broke.
     */
    const page = await fetchRaw("/play");
    const entry = /src="(\/play\/v-[0-9a-f]{12}\/app\.js)"/.exec(page.text);
    assert.ok(entry, "the document does not reference a fingerprinted app.js");

    const prefix = (entry as RegExpExecArray)[1].replace(/\/app\.js$/, "");
    const seen = new Set<string>();
    const queue = [`${prefix}/app.js`];

    while (queue.length > 0) {
      const next = queue.shift() as string;
      if (seen.has(next)) continue;
      seen.add(next);

      const asset = await fetchRaw(next);
      assert.equal(asset.status, 200, `${next} is imported but not served at the versioned path`);

      for (const match of asset.text.matchAll(
        /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+"([^"]+)"/g,
      )) {
        queue.push(`${prefix}/${match[1].slice(2)}`);
      }
    }

    assert.ok(
      seen.has(`${prefix}/presentation.js`),
      `the versioned walk never reached presentation.js, only ${[...seen].join(", ")}`,
    );
  });

  await test("a fingerprinted asset is immutable and a bare one still revalidates", async () => {
    /*
     * `immutable` is only honest because the segment is a hash of the bytes, so a changed file is
     * a changed address. It is also the payoff rather than a detail: the surface is then fetched
     * once and never revalidated again mid-contest, on a phone, against a clock the player is
     * being scored on.
     *
     * The bare route keeps `no-cache` and keeps working. Removing it would break a document
     * already open in somebody's browser, and the artwork is referenced absolutely and
     * deliberately unversioned - a stale picture is cosmetic, which is s4.1m's rule.
     */
    const page = await fetchRaw("/play");
    const entry = /src="(\/play\/v-[0-9a-f]{12}\/app\.js)"/.exec(page.text);
    assert.ok(entry, "the document does not reference a fingerprinted app.js");

    const versioned = await fetchRaw((entry as RegExpExecArray)[1]);
    assert.equal(versioned.status, 200);
    assert.match(
      versioned.headers.get("cache-control") ?? "",
      /immutable/,
      "a fingerprinted asset must be immutable, or the round trip is still paid every load",
    );

    const bare = await fetchRaw("/play/app.js");
    assert.equal(bare.status, 200, "the bare route must keep working for a document already open");
    assert.equal(bare.headers.get("cache-control"), "no-cache");
  });

  await test("the versioned route does not swallow the API the board polls", async () => {
    /*
     * THE REGRESSION THIS SHAPE INVITES, and it would have been a total outage rather than a
     * cosmetic fault. `/play/:version/:asset` has exactly the same shape as `/play/api/state`,
     * which the board polls throughout a round. Registered first and refusing what it does not
     * recognise, it answers that poll with a 404 and the game stops - and whether it did so would
     * depend purely on the order two lines appear in `app.ts`, so it would come back the next time
     * somebody tidied the route list.
     *
     * The handler hands anything that is not a fingerprint straight back, which is what makes the
     * ordering irrelevant. Asserted through the real route rather than by reading `app.ts`.
     */
    await clearRounds();
    const { token } = await openRound();

    const state = await fetchRaw(`/play/api/state?t=${token}`);
    assert.equal(state.status, 200, "the state poll was captured by the versioned asset route");
    assert.match(state.headers.get("content-type") ?? "", /json/);

    // And a plausible-but-wrong fingerprint is a 404 from the asset route, not a fall-through to
    // something that answers by accident.
    const wrong = await fetchRaw("/play/v-000000000000/app.js");
    assert.equal(wrong.status, 200, "a well-formed fingerprint serves the file it names");

    const nonsense = await fetchRaw("/play/not-a-version/app.js");
    assert.equal(nonsense.status, 404, "an unrecognised segment must not serve an asset");
  });

  await test("every image the board names is served", async () => {
    /*
     * The artwork is NOT part of the module graph, so the walk above cannot see it: an `<image>`
     * href and a CSS `background-image` are strings, resolved by the browser long after the code
     * has been evaluated.
     *
     * Which is also why a missing one is quiet. A module that 404s takes the whole page down and
     * is at least unmistakable; a token that 404s draws nothing at all, and the board keeps
     * working - the vector socket underneath still carries the pair's number, so the game is
     * playable and merely looks unfinished. That is precisely the failure nobody reports and
     * nobody notices in review.
     *
     * Read from `BOARD_ART` rather than listed here, so a ninth token is covered by existing.
     */
    // @ts-expect-error - untyped browser module, deliberately; see `test-board.ts` for why.
    const board = (await import("../public/play/board.js")) as Record<string, unknown>;
    const named = [...(board.BOARD_ART as string[])];
    assert.ok(named.length >= 9, `BOARD_ART named only ${named.length} files`);

    for (const url of named) {
      const asset = await fetchRaw(url);
      assert.equal(asset.status, 200, `${url} is drawn by the board but not served`);
      assert.match(asset.headers.get("content-type") ?? "", /^image\//, `${url} is not an image`);
    }
  });

  await test("the stylesheet and the board agree how far the bezel overhangs the grid", async () => {
    /*
     * The number is declared twice - `BOARD_ART_OVERHANG` in `presentation.js` reserves the space,
     * `--board-art-overhang` in `app.css` fills it - because a stylesheet cannot import a number.
     *
     * The failure if they drift is the kind that never gets filed: the bezel's opening stops
     * landing on the grid's edge, so it either clips the outer row of cells or leaves a band of
     * page showing inside the frame. Both read as "the artwork is a bit off" rather than as a bug
     * with a cause, and both get worse the larger the player's screen.
     */
    // @ts-expect-error - untyped browser module, deliberately; see `test-board.ts` for why.
    const presentation = (await import("../public/play/presentation.js")) as Record<
      string,
      unknown
    >;
    const css = fs.readFileSync(
      path.resolve(__dirname, "..", "public", "play", "app.css"),
      "utf8",
    );

    const declared = /--board-art-overhang:\s*([\d.]+)\s*;/.exec(css);
    assert.ok(declared, "app.css no longer declares --board-art-overhang");
    assert.equal(
      Number(declared[1]),
      presentation.BOARD_ART_OVERHANG,
      "the stylesheet and presentation.js disagree about the bezel",
    );
  });

  /*
   * The arcade pass - the animations and the synthesised sound.
   *
   * Everything below is a property that fails SILENTLY. A browser refusing storage takes the game
   * down with no message; an awaited audio call puts a sound device between a tap and the POST
   * that starts a paid clock; an animation missing from the reduced-motion block is invisible to
   * everybody who has not asked for reduced motion, which is everybody likely to review it.
   *
   * The pitches, the volumes and the count-up arithmetic are asserted in `test-presentation.ts`,
   * which can import them. These are the ones only the source text can answer.
   */
  await test("the mute preference survives a browser that refuses storage", async () => {
    /*
     * `localStorage` THROWS rather than returning null when a browser refuses it - Safari in
     * private browsing, and any page loaded with third-party storage blocked, which an iframe on
     * somebody else's domain very much is.
     *
     * The read happens while `app.js` is being evaluated, so an unhandled throw takes the whole
     * module graph down: no board, no error, and the platform's opaque overlay left in front of a
     * page that never ran. That is the same total failure as a module that 404s, arriving from a
     * setting the player cannot see and we cannot reproduce.
     *
     * Counted rather than merely found. A file where the read is guarded and the WRITE is not
     * passes any "is there a try/catch" check while still throwing the first time somebody
     * presses mute.
     */
    const source = withoutComments(playFile("sound.js"));
    const uses = [...source.matchAll(/localStorage/g)].length;
    assert.ok(uses >= 2, `expected a read and a write, found ${uses} mentions of localStorage`);

    const guarded = blockBodies(source, /\btry\s*\{/g)
      .map((body) => [...body.matchAll(/localStorage/g)].length)
      .reduce((total, count) => total + count, 0);

    assert.equal(guarded, uses, `${uses - guarded} of ${uses} storage calls are outside a catch`);
  });

  await test("nothing on the gameplay path ever waits for a sound", async () => {
    /*
     * On a timed title the clock IS the score, and it starts on the SERVER when the player taps
     * Start. An `await` on `AudioContext.resume()` - which returns a promise, and is the obvious
     * thing to await before playing a sound - puts an audio device between the tap and that
     * request. It costs the player time they paid for, it varies by handset, and it produces no
     * error on any device where it is slow rather than broken.
     *
     * Asserted as an absence in `sound.js` rather than as a rule about call sites, because that
     * is the version a caller cannot get wrong: there is nothing to await.
     */
    const sound = withoutComments(playFile("sound.js"));
    assert.ok(!/\basync\b/.test(sound), "sound.js declares an async function");
    assert.ok(!/\bawait\b/.test(sound), "sound.js awaits something");

    // And the other side of it: no caller may await one either, nor chain onto it.
    const app = withoutComments(playFile("app.js"));
    assert.ok(!/await\s+sound\./.test(app), "app.js awaits a sound");
    assert.ok(!/sound\.[A-Za-z]+\([^)]*\)\s*\.then/.test(app), "app.js chains onto a sound");

    /*
     * The unlock must be the first thing `start` does. Moved below the `await` on the session
     * POST it is no longer inside the click as far as the browser is concerned, so the context is
     * created suspended and the game is silent for the whole round with nothing in any log.
     */
    const [body] = blockBodies(app, /async function start\(\)\s*\{/g);
    assert.ok(body, "start() is no longer a function this test can find");
    const unlockAt = body.indexOf("sound.unlock()");
    const awaitAt = body.indexOf("await ");
    assert.ok(unlockAt >= 0, "start() no longer opens the audio context");
    assert.ok(awaitAt < 0 || unlockAt < awaitAt, "the audio context is opened after an await");
  });

  await test("every animation the stylesheet adds is switched off under reduced motion", async () => {
    /*
     * The accessibility requirement, held by comparing two lists rather than by remembering.
     *
     * Adding an animation and forgetting the reduced-motion half changes nothing for anybody who
     * has not set the preference - so it passes every review, every screenshot and every manual
     * pass, and is only wrong for the players who asked not to be moved. There is no symptom to
     * notice and nothing in a log.
     *
     * Selectors are compared as written. That is stricter than necessary - a broader selector in
     * the media block would also do the job - and deliberately so: the failure mode of a clever
     * comparison here is a test that quietly stops covering things.
     */
    // Comments first, or a rule's "selector" is the prose block above it and every comparison is
    // against a paragraph. The same trap as every structural test in this codebase.
    let css = withoutComments(playFile("app.css"));

    // `@keyframes` bodies hold nested blocks, which defeats the flat rule scan below - and they
    // are not rules that can be switched off, they are the definitions being switched off.
    for (const body of blockBodies(css, /@keyframes\s+[\w-]+\s*\{/g)) css = css.replace(body, " ");

    const [reduced] = blockBodies(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g);
    assert.ok(reduced, "app.css has no prefers-reduced-motion block at all");
    css = css.replace(reduced, " ");

    const animated: string[] = [];
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/animation(?:-name)?\s*:\s*(?!none)/.test(rule[2])) continue;
      for (const selector of rule[1].split(",")) animated.push(selector.trim());
    }
    assert.ok(animated.length >= 6, `only found ${animated.length} animated rules to check`);

    /*
     * WHAT THE REDUCED RULE DOES, NOT MERELY THAT THE SELECTOR APPEARS IN THE BLOCK.
     *
     * A probe caught this: the first version only asked whether the selector was mentioned, so a
     * rule setting a colour would have satisfied it, and removing a selector from the
     * `animation: none` list still passed because it was named again in a rule beside it. The
     * three endings that genuinely stop movement are the whole list - the animation switched off,
     * its duration overridden, or the element taken off the screen because it is DRAWN by the
     * animation rather than merely moved by it.
     */
    const covered = new Map<string, string>();
    for (const rule of reduced.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of rule[1].split(",")) {
        covered.set(selector.trim(), (covered.get(selector.trim()) ?? "") + rule[2]);
      }
    }

    for (const selector of animated) {
      const body = covered.get(selector);
      assert.ok(body, `"${selector}" animates and is not in the reduced-motion block at all`);
      assert.match(
        body,
        /animation\s*:\s*none|animation-duration\s*:|display\s*:\s*none/,
        `"${selector}" is in the reduced-motion block but nothing there stops it moving`,
      );
    }
  });

  await test("the score counts up from a value that is already correct", async () => {
    /*
     * The final figure is written BEFORE the animation starts, and the first step then rewinds
     * it. It costs one frame showing the answer and buys the property that matters: a browser
     * that never fires the interval again - a backgrounded tab, a phone throttling a hidden
     * frame, a device suspending timers on lock - leaves the right number on screen.
     *
     * Written the natural way round, a stalled count-up freezes at "2" on a round that solved
     * five. Nothing errors, nothing logs, and the player has been told they lost.
     */
    const [body] = blockBodies(withoutComments(playFile("app.js")), /function countUpStat\(/g);
    assert.ok(body, "countUpStat is no longer a function this test can find");

    const finalAt = body.indexOf("ui.resultStat.textContent = statValue;");
    const firstStepAt = body.indexOf("withCountUpValue");
    assert.ok(finalAt >= 0, "the final value is never written directly");
    assert.ok(firstStepAt >= 0, "the count-up never rewinds to a starting figure");
    assert.ok(finalAt < firstStepAt, "the animation starts before the correct value is on screen");

    // And it must be abandonable. Two results in one round - a refusal then a finish - would
    // otherwise leave two intervals writing to the same element, which reads as a flickering score.
    assert.match(body, /clearInterval/, "a second count-up cannot cancel the first");
  });

  await test("the mute control ships announcing the state it is actually in", async () => {
    /*
     * The button carries a label in the markup so that a screen reader reaching it before the
     * script has run does not announce a bare "button". That label is a second copy of something
     * `soundControlCopy` owns, so it can disagree - and a control that announces "unmute" on a
     * game already making a noise is wrong in the way nobody sighted can see.
     *
     * Compared against the DEFAULT state rather than against a remembered phrase, so changing the
     * wording in one place turns this red rather than drifting.
     */
    // @ts-expect-error - untyped browser module, deliberately; see `test-board.ts` for why.
    const p = (await import("../public/play/presentation.js")) as Record<string, unknown>;
    const soundEnabledFrom = p.soundEnabledFrom as (stored: string | null) => boolean;
    const soundControlCopy = p.soundControlCopy as (on: boolean) => {
      label: string;
      pressed: string;
    };
    const initial = soundControlCopy(soundEnabledFrom(null));

    const page = await fetchRaw("/play");
    const button = /<button\b[^>]*id="mute"[\s\S]*?>/.exec(page.text);
    assert.ok(button, "the play screen has no mute control");
    assert.ok(
      button[0].includes(`aria-label="${initial.label}"`),
      `the markup's label disagrees with soundControlCopy: ${button[0]}`,
    );
    assert.ok(
      button[0].includes(`aria-pressed="${initial.pressed}"`),
      `the markup's aria-pressed disagrees with soundControlCopy: ${button[0]}`,
    );
  });

  /*
   * The boot watchdog, which exists because the test above and the audit below BOTH pass while a
   * player watches a spinner.
   *
   * The import walk proves the files agree with the allowlist in this checkout. The audit proves
   * the running deployment's two halves agree. Neither can promise that every layer between the
   * browser and this service - a proxy, a CDN, a cache holding a 404 from before the fix - hands
   * the file over. And the failure is total rather than partial: one missing file in a module
   * graph means the importer does not evaluate either, so nothing runs, nothing is logged, and no
   * `ready` is sent, leaving the platform's opaque overlay in front of a page that could have
   * explained itself.
   *
   * So the last line of defence does not try to prevent the fault - it makes it SAY so.
   */
  await test("a module that never arrives names itself instead of spinning for ever", async () => {
    const page = await fetchRaw("/play");
    assert.equal(page.status, 200);

    const moduleAt = page.text.indexOf('<script type="module"');
    assert.ok(moduleAt > 0, "the page does not load its module at all");

    /*
     * Position, not presence. A watchdog placed AFTER the module tag still runs - scripts are
     * parsed in order and a module is deferred - but the whole point is that it cannot be taken
     * down by the graph it is watching, and a reader who finds it below the module will
     * reasonably assume the opposite. Asserting the order keeps the file readable as the thing
     * it is.
     */
    /*
     * Anchored to a line of its own rather than matched anywhere in the text. The watchdog's own
     * comment explains why the error event names the wrong file, and to do that it writes the
     * words `<script>` - so a bare match counts two tags and fails on correct code. The same trap
     * as every structural test in this codebase that reads prose as if it were code.
     */
    const classic = [...page.text.matchAll(/^[ \t]*<script>[ \t]*$/gm)];
    assert.equal(classic.length, 1, "expected exactly one classic script - the boot watchdog");
    assert.ok(
      (classic[0].index ?? Number.MAX_SAFE_INTEGER) < moduleAt,
      "the watchdog is below the module it watches",
    );

    const watchdog = page.text.slice(classic[0].index ?? 0, moduleAt);

    /*
     * It must key on the module having EVALUATED, not on a screen being visible. A round that is
     * merely slow to fetch is the platform's 12-second panel to report; this one is specifically
     * for code that never arrived, and the two need different messages.
     */
    assert.match(
      watchdog,
      /window\.__circuitLoaded/,
      "the watchdog does not check whether the code ever loaded",
    );

    /*
     * THE LOAD-BEARING ASSERTION. Without `ready` the panel is rendered underneath the
     * platform's overlay, which is opaque - so the player reads nothing, and the button that
     * leaves the round is unreachable because it lives inside this frame. A watchdog that shows
     * a message nobody can see is worse than none, because it looks fixed.
     */
    assert.match(
      watchdog,
      /postMessage\(\s*\{\s*type:\s*"ready"\s*\}/,
      "the watchdog never releases the platform's overlay",
    );

    // Resource errors do not bubble, so a listener without the capture flag never sees them and
    // the wording falls back to the vaguest of the three. The `true` is the whole difference.
    assert.match(
      watchdog,
      /addEventListener\(\s*"error",[\s\S]*?true,?\s*\)/,
      "the error listener is not in the capture phase, so it cannot see a failed module",
    );

    /*
     * THE FAILING FILE MUST BE READ FROM THE RESOURCE TIMELINE, NOT FROM THE ERROR EVENT.
     *
     * Proven in a browser: the `error` event fires on the `<script>` element that started the
     * graph, so its `src` is `app.js` even when the file that 404ed is `presentation.js`. Naming
     * the event's target is worse than naming nothing, because it points whoever investigates at
     * a file that loaded correctly. A nested module has no element, so the timeline is the only
     * place its request is recorded.
     */
    assert.match(
      watchdog,
      /getEntriesByType\(\s*"resource"\s*\)/,
      "the watchdog does not consult the resource timeline, so it cannot name a nested module",
    );
    assert.match(
      watchdog,
      /responseStatus\s*>=\s*400/,
      "the watchdog does not filter the timeline by status, so it would name a file that loaded",
    );
    // The negative half, and the one that fails if somebody "simplifies" this back: the element's
    // URL must not reach the message. The listener may only record THAT something failed.
    assert.ok(
      !/(src|href)\)\s*\)?\s*;?\s*\n?\s*(failed|urls|names)\.push/.test(watchdog) &&
        !/textContent[\s\S]{0,400}target\.(src|href)/.test(watchdog),
      "the failing element's own URL is used in the message, which names the graph entry",
    );

    // It has to fire BEFORE the platform's own timeout, or the player gets the vaguer message
    // and this is dead code that still reads correctly. Compared against the platform's constant
    // as a number rather than importing it: this service shares no code with the platform.
    const deadline = watchdog.match(/BOOT_DEADLINE_MS\s*=\s*(\d+)/);
    assert.ok(deadline, "the watchdog has no deadline");
    const ms = Number(deadline![1]);
    assert.ok(ms > 0, "a deadline of zero fires before the module has any chance to load");
    assert.ok(
      ms < 12000,
      `the watchdog waits ${ms}ms, at or beyond the platform's 12000ms - it can never be the one that speaks`,
    );

    // The panel is useless if the loading section is still on top of it, and the retry button's
    // real handler is in the module that never ran - so it must be given one here or it is a
    // control that does nothing.
    assert.match(watchdog, /screen-error/, "the watchdog does not reveal the error panel");
    assert.match(watchdog, /hidden = true/, "the watchdog does not hide the loading panel");
    assert.match(watchdog, /location\.reload/, "the retry button would do nothing");
  });

  await test("the watchdog never takes down a game that is running", async () => {
    /*
     * REACHED PRODUCTION, 8 September 2026, within an hour of the flag shipping. A player was
     * mid-round when the board was replaced by "The game's code did not finish loading."
     *
     * `window.__circuitLoaded` is set by `app.js`, so an unset flag means *this build of app.js*
     * did not run - which is a different fact from "the game did not start". Cloudflare gives
     * every asset a four-hour lifetime in the browser (R54) while THIS document is never cached,
     * its URL carrying a single-use token. So today's markup loads around a four-hour-old
     * `app.js` from before the flag existed: the game works, the flag stays unset, and a watchdog
     * trusting it alone destroys a working screen.
     *
     * The general form, and the reason this is not merely a missing condition: **an absent signal
     * is evidence only if the thing that would have sent it was definitely present.**
     */
    const page = await fetchRaw("/play");
    const start = page.text.indexOf("<script>");
    const watchdog = page.text.slice(start, page.text.indexOf('<script type="module"'));

    assert.match(
      watchdog,
      /if \(window\.__circuitLoaded \|\| gameHasPainted\(\)\) return;/,
      "the deadline consults only one witness, so a stale app.js means a wiped board mid-round",
    );

    const paintedAt = watchdog.indexOf("function gameHasPainted");
    assert.ok(paintedAt > 0, "there is no second witness at all");
    const painted = watchdog.slice(paintedAt, watchdog.indexOf("function claimRetry"));
    assert.ok(painted.length > 100, "the gameHasPainted slice found nothing, so it asserts nothing");

    assert.match(
      painted,
      /getElementById\("screen-loading"\)[\s\S]{0,120}hidden\) return true/,
      "a hidden loading screen is not treated as proof the game is alive",
    );
    assert.match(
      painted,
      /id !== "screen-loading"/,
      "the loading screen counts as a painted screen, so the watchdog can never fire at all",
    );
  });

  await test("the document starts on the loading screen and nothing else", async () => {
    /*
     * The coupling the test above depends on, asserted against the real markup rather than
     * assumed. `gameHasPainted` reads "some screen other than loading is visible" as proof the
     * game is running, so a new `<section class="screen">` added without `hidden` would make that
     * true at zero seconds and **silently retire the whole watchdog** - no failure, no test, and
     * the endless spinner is back the next time a module goes missing.
     */
    const page = await fetchRaw("/play");
    const sections = [...page.text.matchAll(/<section[^>]*class="screen[^"]*"[^>]*>/g)].map(
      (match) => match[0],
    );

    assert.ok(sections.length >= 4, `expected the screens in the markup, found ${sections.length}`);

    const visible = sections.filter((tag) => !/\bhidden\b/.test(tag));
    assert.equal(
      visible.length,
      1,
      `exactly one screen may be visible in the document; found ${visible.length}: ${visible.join(" ")}`,
    );
    assert.match(
      visible[0],
      /id="screen-loading"/,
      "the one visible screen is not the loading screen, so the watchdog is dead on arrival",
    );
  });

  await test("a stale refusal in the browser's own cache is cured, not merely reported", async () => {
    /*
     * MEASURED ON THE LIVE SITE, 8 September 2026. Cloudflare rewrites `Cache-Control` on
     * everything it serves to `max-age=14400`, **including 404s** - the service sends `no-store`
     * on a refused asset and it does not survive the edge. So a file that was genuinely missing
     * for ten minutes is remembered by every browser that asked as missing for FOUR HOURS, and
     * no deploy can reach it, because the browser never asks again.
     *
     * That is the worst failure mode available: the server is fixed, every check on our side
     * reports success, and the player still cannot play. `curl` from the server says 200 while
     * the page says 404, which reads as a lie from one of the two.
     */
    const page = await fetchRaw("/play");
    const start = page.text.indexOf('<script>');
    const watchdog = page.text.slice(start, page.text.indexOf('<script type="module"'));

    /*
     * `cache: "reload"` is the whole fix and no other cache mode does this job. `no-store`
     * bypasses the browser's copy without REPLACING it, so the page reloads into the same stale
     * refusal; `reload` writes what the server says now into the cache, which is why the reload
     * afterwards finds the file.
     */
    assert.match(
      watchdog,
      /fetch\([^)]*\{\s*cache:\s*"reload"\s*\}/,
      "the watchdog never re-fetches past the browser's cache, so a stale 404 is permanent",
    );

    /*
     * ONE ATTEMPT, GUARDED BY STORAGE THAT SURVIVES THE RELOAD. A counter in a variable resets
     * as the page reloads, so the recovery becomes a loop - a round flickering for ever, which is
     * worse than the panel. And it must FAIL CLOSED: a browser that refuses storage is exactly
     * the one where a loop could not be detected, so it takes no attempt at all.
     *
     * Sliced to `claimRetry` rather than asserted over the whole watchdog. A bare match on
     * `sessionStorage` is satisfied by the WRITE alone, so deleting the read - which is the whole
     * limit, and turns the recovery into a reload loop - left this test green when probed.
     */
    const claimAt = watchdog.indexOf("function claimRetry");
    assert.ok(claimAt > 0, "there is no single-attempt guard at all");
    const claim = watchdog.slice(claimAt, watchdog.indexOf("window.setTimeout"));
    assert.ok(claim.length > 100, "the claimRetry slice found nothing, so it asserts nothing");

    assert.match(
      claim,
      /getItem\([\s\S]{0,60}return false/,
      "the flag is written but never read, so every reload takes a fresh attempt - a loop",
    );
    assert.match(
      claim,
      /setItem\(/,
      "the attempt is not recorded anywhere that survives the reload it triggers",
    );
    assert.match(
      claim,
      /catch[\s\S]{0,60}return false/,
      "a browser that refuses storage would be allowed to retry, so it could loop",
    );

    /*
     * The recovery is only attempted when a URL was recorded as failing. A boot that stalled for
     * any other reason must not be answered by reloading the page underneath the player - and
     * the reload must be the LAST thing, after every check has come back true, or a genuinely
     * missing file produces a reload loop that reports nothing.
     */
    assert.match(
      watchdog,
      /urls\.length > 0 && claimRetry\(\)/,
      "the recovery is not conditional on something having actually failed",
    );

    /*
     * Sliced from `Promise.all` rather than scanned from the top of the watchdog, because
     * `giveUp` contains a `location.reload()` of its own - the retry button's handler - and the
     * first version of this assertion found that one and reported the order wrong on correct
     * code. Locate the construct; do not scan towards it.
     */
    const checksAt = watchdog.indexOf("Promise.all");
    assert.ok(checksAt > 0, "the watchdog does not wait for the re-fetches at all");
    const afterChecks = watchdog.slice(checksAt);
    const refusalAt = afterChecks.indexOf("giveUp(urls)");
    const reloadAt = afterChecks.indexOf("window.location.reload();");
    assert.ok(refusalAt > 0 && reloadAt > 0, "the recovery has no outcome for one of its cases");
    assert.ok(
      refusalAt < reloadAt,
      "the reload is not the last resort - a file that is genuinely gone would reload for ever",
    );

    // And the give-up path must still be reachable: a failed re-fetch has to land on the panel,
    // or a real outage becomes a silent reload instead of a message.
    const failureHandlers = [...watchdog.matchAll(/giveUp\(urls\)/g)];
    assert.ok(
      failureHandlers.length >= 3,
      `expected the panel on the rejected, the not-ok and the no-retry paths, found ${failureHandlers.length}`,
    );
  });

  await test("app.js records that it loaded before it does anything else", async () => {
    const app = await fetchRaw("/play/app.js");
    assert.equal(app.status, 200);

    /*
     * No leading whitespace, which is how this asserts "module top level" without parsing: a
     * flag set inside a function or a branch would be indented, and would then mean "boot got
     * that far" rather than "the code arrived" - a weaker claim that reports a slow round as a
     * missing file.
     */
    const flags = [...app.text.matchAll(/\nwindow\.__circuitLoaded = true;/g)];
    assert.equal(flags.length, 1, "expected exactly one top-level boot flag in app.js");

    const lastImport = app.text.lastIndexOf('from "./');
    assert.ok(
      (flags[0].index ?? 0) > lastImport,
      "the flag sits above an import, so it is not a statement in the module body",
    );
  });

  await test("the artwork is fetched at boot, not when a screen happens to want it", async () => {
    /*
     * POSITION, not presence. `warmBoardArt` was first called from `renderIntro`, which reads
     * correctly and is wrong on one path: a player resuming a round they already started never
     * sees the intro, so the board renders on the first response and the bezel - a background
     * behind the grid - snaps in a frame or two later around a bare grid.
     *
     * A test asserting only that the warm exists is green on that version, because it does. So
     * this pins it inside `boot` and BEFORE the first `refresh`, which is the call that can paint.
     *
     * Structural because `app.js` cannot be imported at all: it touches `document` at module
     * scope, which is the whole reason `presentation.js` exists. See `test-presentation.ts`.
     */
    const app = await fetchRaw("/play/app.js");
    assert.equal(app.status, 200);

    const bootAt = app.text.indexOf("async function boot()");
    assert.ok(bootAt > 0, "app.js no longer has a boot function under that name");
    const body = app.text.slice(bootAt);
    assert.ok(body.length > 200, "the slice found the name but not the body");

    const warmAt = body.indexOf("warmBoardArt();");
    const refreshAt = body.indexOf("await refresh()");
    assert.ok(warmAt > 0, "boot does not warm the artwork");
    assert.ok(refreshAt > 0, "boot no longer refreshes, so this test is aimed at nothing");
    assert.ok(
      warmAt < refreshAt,
      "the artwork is warmed after the first fetch that can paint the board",
    );

    // And nowhere else: a second call site is how the "only on the intro" version comes back,
    // half-fixed, with this test still green.
    const calls = [...app.text.matchAll(/warmBoardArt\(\);/g)];
    assert.equal(calls.length, 1, `expected one call to warmBoardArt, found ${calls.length}`);
  });

  await test("a refused asset is never remembered by a cache", async () => {
    /*
     * The 200 path uses `no-cache`, which permits storing for revalidation. A 404 here is always
     * a deployment fault rather than a fact about the file, so a stored one keeps the game broken
     * after the fix has shipped - and that is indistinguishable from the fix not working, which
     * sends whoever is debugging it back to a server that is now correct.
     */
    const missing = await fetchRaw("/play/definitely-not-an-asset.js");
    assert.equal(missing.status, 404);
    assert.equal(
      missing.headers.get("cache-control"),
      "no-store",
      "a refused asset may be cached, so its 404 can outlive its cause",
    );
  });

  /*
   * The boot audit, which exists because the test above CANNOT catch the failure that actually
   * reached players.
   *
   * That test walks the import graph of one revision and passes whenever the allowlist and the
   * files agree. On 8 September 2026 they agreed in git and disagreed on the server: `public/play`
   * had been updated by a pull, the compiled allowlist had not been rebuilt, so `presentation.js`
   * was imported and answered with a 404 and no game booted. A single-revision test has no way to
   * express that, so the deployment has to check itself.
   */
  /*
   * The three unit tests below pass their OWN served list rather than the real allowlist, so each
   * one holds exactly one rule. Written against `ASSETS`, removing a single entry turned all three
   * red at once - which the probe harness reports as a suspected harness fault, and rightly: a
   * test that fails for a reason other than the rule it names cannot tell you which rule broke.
   */
  const SERVED = ["app.js", "app.css", "board.js", "presentation.js"];

  await test("a file this build will not serve is reported, and named", async () => {
    const audit = auditPlaySurface([...SERVED, "newmodule.js"], SERVED);

    assert.deepEqual(audit.unserved, ["newmodule.js"]);
    assert.deepEqual(audit.missing, []);
  });

  await test("an allowlisted file that is not on disk is reported the other way round", async () => {
    // The reverse split: the code is newer than the files. Same deploy mistake, opposite halves.
    const audit = auditPlaySurface(["app.js", "app.css", "board.js"], SERVED);

    assert.deepEqual(audit.missing, ["presentation.js"]);
    assert.deepEqual(audit.unserved, []);
  });

  await test("index.html is not reported, because it has its own route", async () => {
    /*
     * The trap this pins. `index.html` is served by `servePlayPage` and is deliberately absent
     * from the allowlist, so an audit that simply diffed the directory against the served set
     * would print an error on every single boot. A guard that cries wolf at every start is worse
     * than no guard: it is the line everyone learns to scroll past, including on the day it is
     * right. This is the only test here that puts the document in the list.
     */
    const audit = auditPlaySurface(["index.html", ...SERVED], SERVED);

    assert.deepEqual(audit.unserved, []);
    assert.deepEqual(audit.missing, []);
  });

  await test("a new module needs no code change to be served - the R52 regression", async () => {
    /*
     * THE TEST THAT WOULD HAVE PREVENTED THE OUTAGE, and it could not have existed before the
     * design changed. `presentation.js` was added to `public/play` on 7 September and the running
     * service refused it, because the list authorising it was compiled into a build nobody had
     * remade. The served set is now derived from the directory, so a file arriving with a `git
     * pull` is servable with no build at all.
     *
     * Asserted through `readServableAssets` rather than by hitting the HTTP route, because the
     * point is what happens to a file this repository does not contain.
     */
    const entries = [
      { name: "app.js", isFile: () => true },
      { name: "presentation.js", isFile: () => true },
      { name: "somethingaddedtomorrow.js", isFile: () => true },
    ];

    const assets = readServableAssets(entries);

    assert.equal(assets.has("somethingaddedtomorrow.js"), true);
    assert.deepEqual(assets.get("somethingaddedtomorrow.js"), {
      file: "somethingaddedtomorrow.js",
      type: "text/javascript; charset=utf-8",
    });
  });

  await test("the fingerprint follows the bytes, not the file dates or the listing order", async () => {
    /*
     * MTIME WAS THE OBVIOUS INPUT AND IT WOULD HAVE BEEN WRONG. A `git pull` gives the same bytes
     * different timestamps on each machine, so two servers would publish different URLs for
     * identical files - halving the cache benefit and, behind a balancer that alternates, making a
     * player re-download the surface on almost every request. Content is the same everywhere by
     * construction. The sort is what makes a directory's own ordering unable to change the answer.
     */
    const { fingerprintAssets } = await import("../src/http/play-page");

    const one = { name: "app.js", bytes: Buffer.from("alpha") };
    const two = { name: "board.js", bytes: Buffer.from("beta") };

    assert.equal(fingerprintAssets([one, two]), fingerprintAssets([two, one]));
    assert.notEqual(
      fingerprintAssets([one, two]),
      fingerprintAssets([one, { name: "board.js", bytes: Buffer.from("beta!") }]),
      "a changed file must change the fingerprint, or the stale copy stays addressable",
    );
    // A rename with identical contents is a different surface too - `board.js` importing
    // `./presentation.js` cares about the name, not just the bytes behind it.
    assert.notEqual(
      fingerprintAssets([one, two]),
      fingerprintAssets([one, { name: "sound.js", bytes: Buffer.from("beta") }]),
    );
    assert.match(fingerprintAssets([one]), /^v-[0-9a-f]{12}$/);
  });

  await test("a document that stops naming an asset says so instead of failing quietly", async () => {
    /*
     * The rewrite FAILS OPEN: an unrecognised reference leaves the document loading perfectly well
     * from the bare route, with only the guarantee lost. That is the right trade for the same
     * reason `resolvePlayRoot` warns rather than throwing - rounds in flight still have to be
     * delivered - but it means the boot log is the only thing that can report it, so `missing` has
     * to be reported rather than inferred from the output being unchanged.
     */
    const { versionPlayDocument } = await import("../src/http/play-page");

    const both = versionPlayDocument(
      '<link href="/play/app.css"><script src="/play/app.js">',
      "v-0123456789ab",
    );
    assert.deepEqual(both.missing, []);
    assert.ok(both.html.includes('href="/play/v-0123456789ab/app.css"'));
    assert.ok(both.html.includes('src="/play/v-0123456789ab/app.js"'));
    assert.ok(!both.html.includes('"/play/app.js"'), "the bare reference survived the rewrite");

    const reformatted = versionPlayDocument("<script src='./app.js'>", "v-0123456789ab");
    assert.deepEqual(reformatted.missing, ["/play/app.css", "/play/app.js"]);
    assert.equal(reformatted.html, "<script src='./app.js'>", "a failed rewrite must not mangle");
  });

  await test("a version segment is recognised by shape, so `api` can never be mistaken for one", async () => {
    // The whole reason the state poll survives. Asserted on the predicate as well as through the
    // route, because the route test would also pass if the two happened to be registered in a
    // lucky order.
    const { isAssetVersionSegment } = await import("../src/http/play-page");

    assert.equal(isAssetVersionSegment("v-0123456789ab"), true);
    assert.equal(isAssetVersionSegment("api"), false);
    assert.equal(isAssetVersionSegment("assets"), false);
    assert.equal(isAssetVersionSegment("app.js"), false);
    assert.equal(isAssetVersionSegment("v-0123456789AB"), false, "the hash is lower-case hex");
    assert.equal(isAssetVersionSegment("v-0123456789ab0"), false, "and a fixed length");
  });

  await test("the served set refuses everything except a recognised file type", async () => {
    /*
     * The extension allowlist is what replaced the filename allowlist, so it is the whole of the
     * remaining protection. A directory listing is not a permission: `.env` and `.ts` are the two
     * that would actually be present in a mistaken deploy, and `..` is there because a name is
     * only ever a `Map` key here - it can never become a path component - so this pins that the
     * lookup would miss rather than relying on that being obvious.
     */
    const assets = readServableAssets([
      { name: "app.js", isFile: () => true },
      { name: ".env", isFile: () => true },
      { name: "server.ts", isFile: () => true },
      { name: "app.js.map", isFile: () => true },
      { name: "index.html", isFile: () => true },
      { name: "assets", isFile: () => false },
      { name: "..", isFile: () => false },
    ]);

    assert.deepEqual([...assets.keys()], ["app.js"]);
  });

  await test("index.html is not in the served set, because it has its own route", async () => {
    /*
     * It would otherwise be reachable as `/play/index.html` as well as `/play`, by a route that
     * sets a content type from a table rather than the one `servePlayPage` sets.
     *
     * THE PROPERTY IS HELD BY THE EXTENSION TABLE, NOT BY THE NAME CHECK, and finding that out is
     * why there are two assertions here. A probe deleting the explicit `index.html` skip stayed
     * green: `.html` is not a servable type, so the document was already refused one line later.
     * The name check is kept as a tripwire - see the note on `readServableAssets` - but a test
     * asserting only the observable behaviour would have credited it with a guarantee it does not
     * provide. So the second assertion pins where the guarantee actually lives, and it is the one
     * that fails if somebody adds `.html` to the table for a rules page.
     */
    const assets = readServableAssets([
      { name: "index.html", isFile: () => true },
      { name: "app.css", isFile: () => true },
    ]);

    assert.deepEqual([...assets.keys()], ["app.css"]);

    // Any HTML file, not just the document, must be unservable through the asset route.
    const other = readServableAssets([{ name: "rules.html", isFile: () => true }]);
    assert.equal(other.size, 0, "an .html file must not be servable as an asset");
  });

  await test("a directory is never served, however plausibly it is named", async () => {
    // Reason: `sendFile` on a directory does not fail usefully, and the platform's own artwork
    // rewrite means `/play/assets/...` is a path a browser will genuinely ask for.
    const assets = readServableAssets([{ name: "assets.js", isFile: () => false }]);

    assert.equal(assets.size, 0);
  });

  await test("this checkout's own play surface agrees with this build", async () => {
    // The in-repo instance of the same question, and the only one wired to reality. It cannot see
    // a stale deployment - that is what the boot audit is for - but it does catch a module
    // committed without its allowlist line before it ever reaches a server.
    const root = path.resolve(__dirname, "..", "public", "play");
    const audit = auditPlaySurface(fs.readdirSync(root), servedFileNames());

    assert.deepEqual(audit.unserved, [], "files are on disk that the service will not serve");
    assert.deepEqual(audit.missing, [], "the allowlist names files that are not on disk");
  });

  await test("a failure inside the game still tells the platform to stop loading", async () => {
    /*
     * THE OWNER'S REPORT, AND THE HALF OF IT THAT LIVED HERE: starting a round showed
     * "Loading Circuit Sprint..." for ever.
     *
     * `ready` does not mean "the game is playable" - it means "there is something on the screen,
     * so drop your loading state", and the platform's overlay is OPAQUE and covers the whole
     * frame. So every refusal `boot()` can hit - an expired launch token, a 401, this service
     * answering 500 - used to render the error panel directly underneath that overlay and leave
     * it there. The player saw a spinner, the sentence explaining what had happened was
     * unreachable, and so was the button that leaves the round, because it is in here too.
     *
     * Asserted inside `fail`'s own body rather than anywhere in the file, because the happy path
     * announces `ready` as well and a file-wide match is green on exactly the bug. Comments are
     * stripped first: this one discusses `ready` at length, and a test that reads prose passes a
     * broken file that merely talks about the right thing.
     */
    const script = await fetchRaw("/play/app.js");
    assert.equal(script.status, 200);

    const code = script.text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    const start = code.indexOf("function fail(");
    assert.ok(start > -1, "fail() was renamed or removed");
    const body = code.slice(start, code.indexOf("\n}", start));

    assert.match(
      body,
      /tellPlatform\("ready"\)/,
      "fail() renders an error panel without telling the platform to drop its loading overlay",
    );
    // And it must paint the panel before saying so, or the platform stands its overlay down over
    // a frame that is still showing the previous screen.
    const panel = body.indexOf('show("error")');
    const announce = body.indexOf('tellPlatform("ready")');
    assert.ok(panel < announce, "fail() announces ready before it has anything on the screen");

    /*
     * AND NOTHING MAY RETURN IN BETWEEN, which is the assertion this test was missing.
     *
     * The first version checked only that the call was present and in the right order, and a
     * probe inserting `return;` straight after the panel stayed GREEN - the call is still there,
     * still after `show`, and now unreachable. That is the exact shape of the original defect,
     * so the test was weak rather than the claim being wrong. Text cannot see reachability in
     * general; it can see the one form that produces it here.
     */
    assert.ok(
      !/\breturn\b/.test(body.slice(panel, announce)),
      "fail() returns before it announces ready, so the panel stays hidden behind the overlay",
    );
  });

  await test("an unknown asset is JSON, not an HTML error page", async () => {
    // Section 14's rule reaches here too. An HTML body from a path under `/play` would be the one
    // response the platform cannot read, and the framework's default for an unknown route is
    // exactly that.
    const missing = await fetchRaw("/play/not-a-file.js");
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(JSON.parse(missing.text).error.code, "NOT_FOUND");
  });

  await test("an encoded traversal cannot read a file outside the play directory", async () => {
    /*
     * The reason the served files are an allowlist rather than a directory.
     *
     * A path segment cannot contain a literal slash, which is what makes this look safe - but
     * Express decodes route parameters, so `%2f` arrives as `/` and `path.join` follows it out of
     * the directory. `package.json` sits two levels up, and the service's `.env` sits beside it.
     */
    const escaped = await fetchRaw("/play/..%2f..%2fpackage.json");
    assert.equal(escaped.status, 404, "a traversal was served");
    assert.ok(
      !escaped.text.includes("chartvolt-games-service"),
      "a file outside the play directory was served",
    );
  });

  await test("the surface refuses to send a referrer", async () => {
    // The token appears once, in this page's own URL. Without this header any request the page
    // makes to a third party would carry it in `Referer`, which is how a credential ends up in
    // somebody else's access log.
    for (const path of ["/play", "/play/app.js", "/play/app.css"]) {
      const response = await fetchRaw(path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer", path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
    }
  });

  console.log("");
  console.log("The play session");

  await test("an invalid launch token is a 401, never a 404", async () => {
    // A 404 would confirm that a token was well-formed but unknown, which turns the endpoint into an
    // oracle for guessing tokens.
    const response = await callPlay("/play/api/session", { t: "a".repeat(48) });
    assert.equal(response.status, 401);
  });

  await test("starting a round returns a board and starts the clock", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();

    const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
    assert.equal(state.status, 200);
    assert.equal(state.body.status, "in_progress");
    assert.equal(state.body.board?.index, 0);
    assert.ok((state.body.board?.pairs.length ?? 0) >= 3);
    assert.ok(state.body.endsAt, "no clock was reported");

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.ok(stored?.startedAt, "startedAt was not recorded server-side");
  });

  await test("the board payload carries no solution and no seed", async () => {
    await clearRounds();
    const { token } = await openRound({ contentSeed: "SEEDCANARY" });
    const state = await callPlay("/play/api/session", { t: token });
    assert.doesNotMatch(state.raw, /solution/i);
    assert.doesNotMatch(state.raw, /SEEDCANARY/);
    assert.doesNotMatch(state.raw, /presentationSeed/i);
  });

  await test("reading the state does NOT start the round", async () => {
    // A GET must never have a side effect that costs the player something. A browser issues one for
    // reasons that have nothing to do with intent - prefetch on hover, a crawler, a refresh - so a
    // clock started from a GET is a paid attempt spent while the player was still reading the rules.
    await clearRounds();
    const { roundId, token } = await openRound();

    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(state.status, 200);
    assert.equal(state.body.status, "created");

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.equal(stored?.startedAt, undefined, "a GET started the clock");
    assert.equal(stored?.status, "created");
  });

  await test("a round that has not started is not reported as finished", async () => {
    // `finished` means the round is over, not "there is no board to show" - and a round nobody has
    // started has no board either. Conflating the two answered a freshly created round with
    // `finished: { status: "created" }`, so a client reading the state before offering a Start
    // button would render a result screen for a round that had never been played.
    await clearRounds();
    const { token } = await openRound({ config: { durationSeconds: 90, gridSize: "small" } });

    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(state.body.finished, undefined, "a round that never started reported finished");
    assert.equal(state.body.board, undefined, "an unstarted round handed out a board");
    // The one moment the player needs the length of the round is before they start it, which is
    // exactly when `endsAt` does not exist yet.
    assert.equal(state.body.durationSeconds, 90);
    assert.equal(state.body.endsAt, undefined);
  });

  /*
   * ── the clock the player is shown ─────────────────────────────────────────────────────────────
   *
   * THE OWNER'S REPORT, 10 September 2026: "when a user enters late and the time of the
   * competition is less than the game's default time, it must show the time left to end the
   * competition, so it is not misleading."
   *
   * Two numbers were wrong and they are two separate reads. `endsAt` drove the live countdown and
   * was `gameplayEndsAt(round)` - the title's clock from `startedAt` - so a ten-minute sprint
   * started with five minutes of contest left counted down from 10:00 and stopped, mid-board, with
   * the clock still reading 5:00. `durationSeconds` drove the sentence before Start and was the
   * configured length, so the same player was promised ten minutes in writing.
   *
   * `hardDeadline` had weighed all three deadlines correctly since the file was written and was
   * called by nothing, which is the part worth remembering: the answer existed, unwired.
   */

  await test("a round the contest will cut short counts down to the contest, not the title's clock", async () => {
    /*
     * The defect, end to end. This is exactly the shape the platform sends: `resolveExpiry` clamps
     * `expiresAt` to the end of the play window, so a late joiner's round is born with less time
     * than its title asks for.
     */
    await clearRounds();
    const expiresAt = new Date(Date.now() + 60_000);
    const { token } = await openRound({
      config: { durationSeconds: 120, gridSize: "small" },
      expiresAt: expiresAt.toISOString(),
    });

    const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
    assert.equal(state.status, 200);
    assert.ok(state.body.endsAt, "no clock was reported");

    const ends = new Date(state.body.endsAt as string).getTime();
    assert.ok(
      Math.abs(ends - expiresAt.getTime()) < 5_000,
      `the clock runs to ${state.body.endsAt}, not the contest's ${expiresAt.toISOString()}`,
    );

    /*
     * And the failure it replaced, asserted separately. Without this the test would also pass
     * against a clock set to the title's full length on a contest that happened to end later -
     * the two only differ when the contest is the tighter of the two, which is the whole case.
     */
    assert.ok(
      ends < Date.now() + 110_000,
      "the clock still runs the title's full length, so the player is cut off with time showing",
    );
  });

  await test("the length promised before Start is the length the server will honour", async () => {
    await clearRounds();
    const { token } = await openRound({
      config: { durationSeconds: 120, gridSize: "small" },
      expiresAt: new Date(Date.now() + 45_000).toISOString(),
    });

    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(state.body.status, "created");

    // The title's own length is still reported, and deliberately: the client needs both figures in
    // order to tell the player WHY the round is short. It is simply no longer the promise.
    assert.equal(state.body.durationSeconds, 120);
    const promised = state.body.playableSeconds ?? -1;
    assert.ok(
      promised <= 45 && promised >= 35,
      `promised ${promised}s inside a 45s window`,
    );
  });

  await test("a round with the whole window ahead of it promises its full length", async () => {
    /*
     * THE CONTROL, and without it the fix is unfalsifiable. "Always report the contest's remaining
     * time" satisfies both tests above while telling a player with an hour of contest left that a
     * two-minute sprint lasts an hour - a worse lie than the one being fixed, in the other
     * direction.
     */
    await clearRounds();
    const { token } = await openRound({ config: { durationSeconds: 120, gridSize: "small" } });

    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(state.body.durationSeconds, 120);
    assert.equal(state.body.playableSeconds, 120);
  });

  await test("a fixed-set title reports a length too, so it can notice being cut short", async () => {
    /*
     * Circuit Perfect has no clock in its rules, so its intro leads on the board count and makes
     * no claim about time - which is why it was easy to miss that a Perfect round is cut short by
     * the contest exactly as a sprint is. `roundDurationMs` gives its declared maximum, which IS
     * its hard stop, and the client compares the two to decide whether to mention the contest.
     */
    await clearRounds();
    const { PERFECT, PERFECT_CODE } = await import("../src/games/titles");
    const { token } = await openRound({
      gameCode: PERFECT_CODE,
      config: { boardCount: 3, gridSize: "small", unfinishedPenaltyMs: 60_000 },
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
    });

    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(state.body.durationSeconds, PERFECT.maxDurationSeconds);
    assert.ok(
      (state.body.playableSeconds ?? Number.MAX_SAFE_INTEGER) <= 90,
      `a Perfect round promised ${state.body.playableSeconds}s inside a 90s window`,
    );
  });

  await test("the promised length stops moving once the clock is running", async () => {
    /*
     * Anchored on `startedAt` after Start and on `now` before it, which is two behaviours from one
     * function and therefore worth pinning. Measured from `now` throughout, the figure shrinks on
     * every poll - so a player who refreshes watches the round they were granted getting shorter,
     * which reads as the game taking time off them.
     *
     * THE CONTEST MUST BE THE TIGHTER OF THE TWO DEADLINES OR THIS TEST PROVES NOTHING, which is
     * how it was first written. With the window an hour away the gameplay clock wins, and a
     * gameplay clock re-anchored on `now` is *also* a constant 120 - so both the correct and the
     * broken version answer identically and the fixture cannot tell them apart. Against a window
     * 45 seconds out, only the correct anchor holds still.
     *
     * Exact equality is safe rather than flaky: once anchored, the value is a difference between
     * two fixed instants.
     */
    await clearRounds();
    const { token } = await openRound({
      config: { durationSeconds: 120, gridSize: "small" },
      expiresAt: new Date(Date.now() + 45_000).toISOString(),
    });
    const started = await callPlay<PlayStateBody>("/play/api/session", { t: token });
    const first = started.body.playableSeconds;
    assert.ok(typeof first === "number", "no promised length was reported");

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const again = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");
    assert.equal(again.body.playableSeconds, first, "the promised length shrank while playing");
  });

  await test("the state carries the title's own name, rules and scoring", async () => {
    /*
     * The three facts the pre-round panel used to invent.
     *
     * The frame kept its own map of display names, so a title added to the catalogue would have
     * appeared inside the game as "Circuit" while the platform showed its real name - no error,
     * just two names for one thing. The rules were hard-coded in the page, so the catalogue's
     * wording and the game's wording had already drifted apart. And `scoring` was missing
     * outright: a player in a paid contest could not find out from inside the game whether a fast
     * board was worth more than a finished one, which for Circuit Perfect is the difference
     * between playing to win and playing to lose.
     *
     * Asserted against the CATALOGUE's own strings rather than against literals, because a literal
     * here would be the third copy of the wording and would drift the same way the first two did.
     */
    await clearRounds();
    const { PERFECT, PERFECT_CODE } = await import("../src/games/titles");
    const { BOARD_RULES } = await import("../src/games/instructions");

    const { token } = await openRound({
      gameCode: PERFECT_CODE,
      config: { boardCount: 3, gridSize: "small", unfinishedPenaltyMs: 60_000 },
    });
    const state = await callPlay<PlayStateBody>(`/play/api/state?t=${token}`, undefined, "GET");

    assert.equal(state.status, 200);
    assert.equal(state.body.title, PERFECT.displayName);
    assert.equal(state.body.scoring, PERFECT.rulesSummary);
    assert.deepEqual(state.body.boardRules, [...BOARD_RULES]);
    // Before the round starts is exactly when the player is reading them.
    assert.equal(state.body.status, "created");
  });

  await test("the state carries no score, no rank and no prize, on any status", async () => {
    /*
     * Held by construction on the client - `resultCopy` destructures the four fields it uses - and
     * held here as well, because the two guards fail differently. A field added to `PlayState`
     * would be ignored by today's frame and rendered by tomorrow's, and by then nobody would
     * remember that the browser is not a link in the scoring chain.
     *
     * The terminal state is the one that matters: it is the only moment a score exists at all, and
     * the specification's rule is that it travels to the platform over a signed callback and
     * nowhere else. A number on this screen is one the player could argue with that nothing
     * authoritative had agreed to.
     */
    await clearRounds();
    const { token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const live = await callPlay(`/play/api/state?t=${token}`, undefined, "GET");
    const finished = await callPlay("/play/api/leave", { t: token });

    for (const [label, response] of [
      ["live", live],
      ["finished", finished],
    ] as const) {
      const body = JSON.parse(response.raw) as Record<string, unknown>;
      const state = (body.state ?? body) as Record<string, unknown>;
      for (const forbidden of ["score", "rawScore", "scoreBreakdown", "rank", "prize", "points"]) {
        assert.ok(
          !(forbidden in state),
          `the ${label} play state carries "${forbidden}"`,
        );
      }
      // `finished` is the terminal report, and it is the likeliest place for a score to be added
      // "just for the result screen".
      const report = state.finished as Record<string, unknown> | undefined;
      if (report) {
        assert.deepEqual(
          Object.keys(report).sort(),
          ["boardsSolved", "status"],
          "the terminal report grew a field",
        );
      }
    }
  });

  await test("resuming returns the same board rather than a new one", async () => {
    // A dropped mobile connection must not cost a board. The clock belongs to the round, not the
    // session, so resuming does not restart it either.
    await clearRounds();
    const { token } = await openRound();
    const first = await callPlay<PlayStateBody>("/play/api/session", { t: token });
    const again = await callPlay<PlayStateBody>("/play/api/session", { t: token });

    assert.equal(again.body.board?.index, first.body.board?.index);
    assert.deepEqual(again.body.board?.pairs, first.body.board?.pairs);
    assert.equal(again.body.endsAt, first.body.endsAt, "the clock restarted on resume");
  });

  console.log("");
  console.log("Submitting a board");

  await test("a correct solution is accepted and the next board is issued", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const paths = await solutionFor(roundId, 0);
    const response = await callPlay<{ accepted: boolean; state: PlayStateBody }>(
      "/play/api/submit",
      { t: token, boardIndex: 0, paths },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.accepted, true);
    assert.equal(response.body.state.boardsSolved, 1);
    assert.equal(response.body.state.board?.index, 1, "no next board was issued");
  });

  await test("a wrong solution is refused by name, at HTTP 200", async () => {
    // A refusal is information for the player, not an error in the request. Returning 4xx would make
    // ordinary gameplay indistinguishable from a malformed call in every monitor the service has.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const paths = await solutionFor(roundId, 0);
    // Drop the last cell of the first path: the endpoints no longer match.
    const broken = paths.map((path, index) =>
      index === 0 ? { ...path, cells: path.cells.slice(0, -1) } : path,
    );

    const response = await callPlay<{ accepted: boolean; refusal: string; message: string }>(
      "/play/api/submit",
      { t: token, boardIndex: 0, paths: broken },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.accepted, false);
    assert.ok(
      ["endpoints_do_not_match", "incomplete_coverage"].includes(response.body.refusal),
      `unexpected refusal '${response.body.refusal}'`,
    );
    assert.ok(response.body.message.length > 10, "no explanation for the player");
  });

  await test("a submission for a board that was never issued is refused", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const paths = await solutionFor(roundId, 4);
    const response = await callPlay("/play/api/submit", { t: token, boardIndex: 4, paths });
    assert.equal(response.status, 400);
  });

  await test("a board cannot be solved twice", async () => {
    // Each board is worth points once. Accepting a resubmission would let a player farm one board.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const paths = await solutionFor(roundId, 0);
    await callPlay("/play/api/submit", { t: token, boardIndex: 0, paths });

    const again = await callPlay("/play/api/submit", { t: token, boardIndex: 0, paths });
    assert.equal(again.status, 400);
  });

  await test("a score sent by the client is ignored entirely", async () => {
    // Section 7: "we will ignore any score arriving from the browser". Proven behaviourally rather
    // than by reading the code, because the interesting failure is a field somebody adds later.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const paths = await solutionFor(roundId, 0);

    await callPlay("/play/api/submit", {
      t: token,
      boardIndex: 0,
      paths,
      score: 999_999,
      rawScore: 999_999,
      durationMs: 1,
      solvedAt: new Date(0).toISOString(),
    });

    await callPlay("/play/api/leave", { t: token });

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.ok((stored?.score ?? 0) < 999_999, `client score was honoured: ${stored?.score}`);
    assert.ok((stored?.score ?? 0) >= 1000, "a solved board scored nothing");
  });

  console.log("");
  console.log("Identical content, varied presentation (section 12)");

  await test("two players on one contentSeed face the same content", async () => {
    await clearRounds();
    const seed = "cv_ctst_fairness";
    const fingerprints: string[] = [];

    for (let player = 0; player < 4; player++) {
      const { token } = await openRound({
        contentSeed: seed,
        player: { playerId: `cv_p_fair_${player}` },
      });
      const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
      fingerprints.push(contentFingerprint(state.body.board!));
    }

    assert.equal(
      new Set(fingerprints).size,
      1,
      `content differed between players: ${fingerprints.join(" / ")}`,
    );
  });

  await test("a different contentSeed produces different content", async () => {
    await clearRounds();
    const fingerprints = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { token } = await openRound({ contentSeed: `cv_ctst_vary_${i}` });
      const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
      fingerprints.add(contentFingerprint(state.body.board!));
    }
    // Not "all six differ": two unrelated boards can coincidentally share a distance multiset, and a
    // test that forbids that would fail on a correct generator. More than one is the real claim.
    assert.ok(fingerprints.size > 1, "every seed produced identical content");
  });

  await test("the same content is presented differently to different players", async () => {
    // The anti-collusion property, and the one that pulls against the test above. Section 12 asks for
    // it directly: shuffling per player "stops players simply telling each other that the answer is
    // B while keeping the challenge identical".
    await clearRounds();
    const seed = "cv_ctst_presentation";
    const presentations = new Set<string>();

    for (let player = 0; player < 8; player++) {
      const { token } = await openRound({
        contentSeed: seed,
        player: { playerId: `cv_p_pres_${player}` },
      });
      const state = await callPlay<PlayStateBody>("/play/api/session", { t: token });
      presentations.add(JSON.stringify(state.body.board!.pairs));
    }

    assert.ok(
      presentations.size > 1,
      "every player saw the identical orientation - the presentation transform is not applied",
    );
  });

  console.log("");
  console.log("Reaching a terminal state and reporting it (sections 8 and 13)");

  await test("finishing every board completes the round and delivers a result", async () => {
    await clearRounds();
    const { roundId, token } = await openRound({
      gameCode: "circuit-perfect",
      config: { boardCount: 3, gridSize: "small", unfinishedPenaltyMs: 120_000 },
    });

    await callPlay("/play/api/session", { t: token });
    for (let index = 0; index < 3; index++) {
      const paths = await solutionFor(roundId, index);
      const response = await callPlay<{ accepted: boolean }>("/play/api/submit", {
        t: token,
        boardIndex: index,
        paths,
      });
      assert.equal(response.body.accepted, true, `board ${index} was refused`);
    }

    await waitFor(() => received.length === 1, "the result callback");

    const event = received[0];
    assert.equal(event.signatureValid, true, "the callback signature did not verify");
    assert.equal(event.headers["x-timestamp"] !== undefined, true);
    assert.match(String(event.headers.authorization), /^Bearer /);
    assert.equal(event.body.status, "completed");
    assert.equal(event.body.eventType, "round.completed");
    assert.equal(event.body.roundId, roundId);
    assert.equal(typeof event.body.score, "number");
    assert.equal(typeof event.body.durationMs, "number");
    assert.ok(event.body.startedAt && event.body.completedAt, "timestamps missing");
    assert.ok(String(event.body.replayUrl).startsWith("http"));

    /*
     * The breakdown, under the name the platform's adapter reads.
     *
     * Untested until 6 September 2026, and the gap was found by a smoke tool that printed
     * `body.breakdown` and `body.scoreType` - neither of which exists - and therefore reported
     * empty values for a round that had reported correctly. The service was right and the tool was
     * wrong, but nothing in this suite could have said so, which is the reason for asserting the
     * NAME here: the field is `scoreBreakdown`, the platform's `normalise.ts` reads exactly that,
     * and a rename on either side is a display panel that silently goes blank.
     */
    const breakdown = event.body.scoreBreakdown as Record<string, unknown> | undefined;
    assert.ok(breakdown, "no scoreBreakdown was delivered");
    assert.equal(breakdown.boardsCompleted, 3);
    // `scoreType` is a property of a catalogue title, never of a round. Asserted absent so a
    // future addition has to be a deliberate change to the contract rather than a stray field.
    assert.equal("scoreType" in event.body, false, "a round reported a scoreType");
  });

  await test("the delivered payload never contains the content seed", async () => {
    await clearRounds();
    const { roundId, token } = await openRound({ contentSeed: "SEEDCANARY3" });
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });
    await waitFor(() => received.length === 1, "the callback");
    assert.doesNotMatch(received[0].rawBody, /SEEDCANARY3/);
    assert.equal(received[0].body.roundId, roundId);
  });

  await test("leaving reports abandoned WITH the boards already solved", async () => {
    // Section 13: "please send a partial score if you can compute one - a dropped mobile signal
    // should not cost someone a paid entry".
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    const paths = await solutionFor(roundId, 0);
    await callPlay("/play/api/submit", { t: token, boardIndex: 0, paths });

    await callPlay("/play/api/leave", { t: token });
    await waitFor(() => received.length === 1, "the callback");

    assert.equal(received[0].body.status, "abandoned");
    assert.equal(received[0].body.eventType, "round.abandoned");
    assert.ok((received[0].body.score as number) >= 1000, "the solved board was not counted");
  });

  await test("a retried delivery reuses the same eventId", async () => {
    // Section 11: "unique per message and stable across your retries. This is how we avoid counting
    // one score twice." A regenerated id would make every retry a new score to the platform.
    await clearRounds();
    receiverBehaviour.failTimes = 2;

    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    await waitFor(() => received.length >= 1, "the first attempt");

    const { attemptDelivery } = await import("../src/callback/deliver");
    await attemptDelivery(roundId);
    await attemptDelivery(roundId);

    assert.ok(received.length >= 3, `expected at least 3 attempts, saw ${received.length}`);
    const ids = new Set(received.map((event) => event.body.eventId));
    assert.equal(ids.size, 1, `eventId changed between retries: ${[...ids].join(", ")}`);
    for (const event of received) {
      assert.equal(event.signatureValid, true, "a retry was signed incorrectly");
    }
  });

  await test("a failed delivery schedules a later attempt rather than giving up", async () => {
    await clearRounds();
    receiverBehaviour.status = 500;

    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });
    await waitFor(() => received.length >= 1, "the first attempt");

    const { Round } = await import("../src/store/round.model");
    await waitFor(async () => {
      const stored = await Round.findOne({ roundId });
      return Boolean(stored?.delivery.nextAttemptAt);
    }, "a scheduled retry");

    const stored = await Round.findOne({ roundId });
    assert.equal(stored?.delivery.acknowledgedAt, undefined, "a 500 was treated as acknowledged");
    assert.equal(stored?.delivery.gaveUpAt, undefined, "gave up on the first failure");
    assert.ok(stored!.delivery.nextAttemptAt!.getTime() > Date.now(), "retry scheduled in the past");
    assert.match(String(stored?.delivery.lastError), /500/);
  });

  await test("a delivery failure says WHY in the log, not merely that one happened", async () => {
    /*
     * The reason is stored on the round, which the test above checks - and nobody triaging a live
     * contest is reading documents in MongoDB. Until 8 September 2026 the only thing an operator
     * saw was `failed 1` on the sweeper's summary line, repeated every tick. A rotated callback
     * secret, a platform that is down and a callback URL routed to nothing all produce that
     * identical line, while the player sits on "Confirming your result" and the contest cannot
     * settle behind them.
     *
     * Asserting the STATUS rather than just that something was logged is the load-bearing half: a
     * line reading "delivery failed" would satisfy a bare "did we log" check and would leave the
     * operator exactly where they started.
     */
    await clearRounds();
    receiverBehaviour.status = 503;

    const lines: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };

    try {
      const { token, roundId } = await openRound();
      await callPlay("/play/api/session", { t: token });
      await callPlay("/play/api/leave", { t: token });

      await waitFor(
        () => lines.some((line) => line.includes(roundId)),
        "a logged delivery failure",
      );

      const line = lines.find((entry) => entry.includes(roundId)) as string;
      assert.match(line, /503/, `the log did not name the failure: ${line}`);
      assert.match(line, /will retry/, `the log did not say what happens next: ${line}`);
    } finally {
      console.warn = realWarn;
    }
  });

  await test("the retry backoff is capped inside the 24-hour window", async () => {
    // The failure this pins is silent. Doubling for ever looks like the careful choice and switches
    // the retry off: within a 24-hour window an uncapped delay eventually exceeds the window, so the
    // last hours contain no attempts at all while the delivery still counts as pending.
    const { delayFor } = await import("../src/callback/deliver");
    const window = 24 * 60 * 60_000;

    for (const attempt of [10, 20, 50, 200]) {
      assert.ok(
        delayFor(attempt) <= 4 * 60 * 60_000,
        `attempt ${attempt} waits ${delayFor(attempt)}ms, past the four-hour cap`,
      );
    }

    // And the schedule must actually land several attempts inside the window rather than one.
    let elapsed = 0;
    let attempts = 0;
    while (elapsed <= window && attempts < 1000) {
      elapsed += delayFor(attempts);
      attempts++;
    }
    assert.ok(attempts >= 10, `only ${attempts} attempts fit inside 24 hours`);
  });

  await test("a suppressed callback leaves a fetchable result and an unfinished delivery", async () => {
    // The sandbox control exists so the platform can prove its own recovery path works when a
    // message never arrives. Marking the delivery complete would be a different scenario - a provider
    // that had nothing to say - so it stays pending on purpose.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callApi(`/sandbox/rounds/${roundId}/arm`, {
      method: "POST",
      body: { suppressCallback: true },
    });

    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const fetched = await callApi<{ status: string; score: number }>(`/v1/rounds/${roundId}`);
    assert.equal(fetched.body.status, "abandoned");
    assert.equal(typeof fetched.body.score, "number");

    // Several sweeper ticks, so the delivery has genuinely been ATTEMPTED and refused.
    //
    // Without this wait the test asserted nothing: it read the delivery record before any tick had
    // touched it, so "still pending" was true because nothing had run yet rather than because
    // suppression left it pending. A probe that marked a suppressed delivery acknowledged stayed
    // green. This is the general trap in a test with a background timer - the state you are
    // asserting about is the state before the code under test ran.
    await new Promise((resolve) => setTimeout(resolve, 600));

    assert.equal(received.length, 0, "a suppressed callback was delivered anyway");

    const { Round } = await import("../src/store/round.model");
    const stored = await Round.findOne({ roundId });
    assert.equal(stored?.delivery.acknowledgedAt, undefined);
    assert.ok(stored?.delivery.eventId, "no eventId was minted for the suppressed result");
  });

  await test("releasing a suppressed callback delivers the same eventId", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callApi(`/sandbox/rounds/${roundId}/arm`, {
      method: "POST",
      body: { suppressCallback: true },
    });
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const { Round } = await import("../src/store/round.model");
    const before = await Round.findOne({ roundId });

    await callApi(`/sandbox/rounds/${roundId}/deliver`, { method: "POST", body: {} });
    await waitFor(() => received.length === 1, "the released callback");

    assert.equal(received[0].body.eventId, before?.delivery.eventId);
    assert.equal(received[0].signatureValid, true);
  });

  await test("a practice round is never delivered", async () => {
    await clearRounds();
    const { roundId, token } = await openRound({ mode: "practice", contentSeed: undefined });
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    // Long enough for several sweeper ticks, so this proves the sweeper skips it rather than proving
    // the sweeper had not run yet.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(received.length, 0, "a practice result was reported");

    // But it is still fetchable in full, so nothing is hidden from the platform.
    const fetched = await callApi<{ status: string }>(`/v1/rounds/${roundId}`);
    assert.equal(fetched.body.status, "abandoned");
  });

  await test("a round can only reach a terminal state once", async () => {
    // Three things can end a round - the player finishing, the player leaving, the sweeper noticing a
    // deadline - and two can arrive at the same instant. A second terminal write would mint a second
    // eventId and report a second score.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const { finishRound } = await import("../src/rounds/lifecycle");
    const outcomes = await Promise.all([
      finishRound(roundId, { status: "completed" }),
      finishRound(roundId, { status: "expired" }),
      finishRound(roundId, { status: "abandoned" }),
    ]);

    const transitions = outcomes.filter((outcome) => outcome?.transitioned).length;
    assert.equal(transitions, 1, `${transitions} writers claimed the same round`);
  });

  await test("the running sweeper closes a round nobody came back to", async () => {
    // The whole reason a timer exists: a player who closes the tab tells us nothing, and there is no
    // request left to run any code in. Driven by the real interval rather than a direct call to
    // `sweepOnce`, because the overlap guard and the scheduling only exist on the timer's path.
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });

    const { Round } = await import("../src/store/round.model");
    await Round.updateOne({ roundId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    await waitFor(() => received.length === 1, "the callback from the sweeper");
    assert.equal(received[0].body.status, "expired");
    assert.equal(received[0].body.eventType, "round.expired");

    // And it must not be reported again on every subsequent tick. An acknowledged delivery is done.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(received.length, 1, `the result was delivered ${received.length} times`);
  });

  await test("a finished gameplay clock completes rather than expires", async () => {
    // A different deadline from `expiresAt`, and a different terminal state. Conflating the two would
    // report a player who played to the end of the timer as having expired - which reads to the
    // player as being cut off rather than as having finished.
    await clearRounds();
    const { roundId, token } = await openRound({
      config: { durationSeconds: 60, gridSize: "small" },
    });
    await callPlay("/play/api/session", { t: token });

    const { Round } = await import("../src/store/round.model");
    await Round.updateOne({ roundId }, { $set: { startedAt: new Date(Date.now() - 120_000) } });

    await waitFor(() => received.length === 1, "the callback");
    assert.equal(received[0].body.status, "completed");
  });

  await test("play is refused once the round is terminal", async () => {
    await clearRounds();
    const { roundId, token } = await openRound();
    await callPlay("/play/api/session", { t: token });
    await callPlay("/play/api/leave", { t: token });

    const paths = await solutionFor(roundId, 0);
    const response = await callPlay<{ accepted: boolean; state: PlayStateBody }>(
      "/play/api/submit",
      { t: token, boardIndex: 0, paths },
    );
    assert.equal(response.body.accepted, false);
    assert.equal(response.body.state.status, "abandoned");
  });

  console.log("");
  console.log("Sandbox controls (section 15)");

  await test("forcing a score overrides the computed one and says so", async () => {
    // A forced result that could not be told apart from an earned one would make every test built on
    // this control untrustworthy, so the breakdown keeps reporting what really happened.
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi<{
      result: { score: number; scoreBreakdown: Record<string, unknown> };
    }>(`/sandbox/rounds/${roundId}/finish`, {
      method: "POST",
      body: { status: "completed", score: 4242 },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.result.score, 4242);
    assert.equal(response.body.result.scoreBreakdown.sandboxForcedScore, 4242);
    assert.ok(
      "sandboxComputedScore" in response.body.result.scoreBreakdown,
      "the real computed score was not recorded beside the forced one",
    );

    await waitFor(() => received.length === 1, "the callback");
    assert.equal(received[0].body.score, 4242);
  });

  await test("a forced score of zero is honoured, not discarded", async () => {
    // Zero is one of the most useful values to test ranking with, and a truthiness check would drop
    // it silently.
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi<{ result: { score: number } }>(
      `/sandbox/rounds/${roundId}/finish`,
      { method: "POST", body: { status: "completed", score: 0 } },
    );
    assert.equal(response.body.result.score, 0);
  });

  await test("every terminal state can be forced", async () => {
    for (const status of ["completed", "abandoned", "expired", "voided"]) {
      await clearRounds();
      const { roundId } = await openRound();
      const response = await callApi<{ result: { status: string; eventType: string } }>(
        `/sandbox/rounds/${roundId}/finish`,
        { method: "POST", body: { status } },
      );
      assert.equal(response.body.result.status, status, `could not force '${status}'`);
      assert.equal(response.body.result.eventType, `round.${status}`);
    }
  });

  await test("a forced status the specification does not define is refused", async () => {
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi(`/sandbox/rounds/${roundId}/finish`, {
      method: "POST",
      body: { status: "in_progress" },
    });
    assert.equal(response.status, 400);
  });

  await test("sandbox routes still require platform credentials", async () => {
    await clearRounds();
    const { roundId } = await openRound();
    const response = await callApi(`/sandbox/rounds/${roundId}/finish`, {
      method: "POST",
      body: { status: "completed" },
      secret: "wrong",
    });
    assert.equal(response.status, 401);
  });

  await stopService();
  return summary("Play and delivery tests");
}

main()
  .then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
