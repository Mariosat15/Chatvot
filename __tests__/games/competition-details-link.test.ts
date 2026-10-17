import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPETITION_DETAILS_VIEW,
  COMPETITION_VIEW_PARAM,
  competitionDetailsHref,
  wantsCompetitionDetailsView,
} from "@/lib/utils/competition-details-view";

/**
 * "View Competition Details" on a finished contest, and the query string that makes it work.
 *
 * THE DEFECT THIS PINS. `/competitions/[id]` redirects a participant of a completed contest to
 * their own results, which is what they came for. `?view=details` switches that off so they can
 * go back and read the lobby. The game results screen's two links to the lobby were written
 * WITHOUT it, so pressing "View Competition Details" navigated to the page it was already on:
 * no error, no log line, no perceptible navigation. Trading's three links carried the query
 * string, which is exactly why nobody found it - the feature worked on the path everybody tests.
 *
 * WHY A ROUND TRIP IS THE LOAD-BEARING ASSERTION. Either half can be tested and pass while the
 * pair is broken: the gate is correct against a literal, and a link is a valid URL. Only feeding
 * what the links produce into what the gate reads can fail. The structural half then stops a new
 * call site composing the query string by hand and reopening the drift one link at a time.
 */

const ROOT = join(__dirname, "..", "..");

/** Comments are stripped first: these files explain the defect in prose, and a test that reads
 *  prose flags a correct file for discussing the mistake and passes a broken one whose only
 *  mention of the right thing is in a comment. */
function readCode(relativePath: string): string {
  const raw = readFileSync(join(ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const LOBBY_PAGE = "app/(root)/competitions/[id]/page.tsx";
const RESULTS_PAGE = "app/(root)/competitions/[id]/results/page.tsx";
const PROVIDER_RESULTS = "components/games/ProviderResultsScreen.tsx";

describe("the link and the gate agree", () => {
  /**
   * The whole point. A link built by the helper must be one the gate lets through.
   *
   * Parsed with `URL` rather than compared as a string, because the browser is what stands
   * between the two in production and a test that compares literals is testing its own copy of
   * the format rather than the format.
   */
  it("a href the helper builds opens the gate that reads it", () => {
    const href = competitionDetailsHref("68bd3f0e1f2c4a5b6c7d8e9f");
    const url = new URL(href, "https://example.test");

    const query = Object.fromEntries(url.searchParams.entries());

    expect(wantsCompetitionDetailsView(query)).toBe(true);
  });

  it("the href points at the lobby for the id it was given", () => {
    const url = new URL(
      competitionDetailsHref("68bd3f0e1f2c4a5b6c7d8e9f"),
      "https://example.test",
    );

    expect(url.pathname).toBe("/competitions/68bd3f0e1f2c4a5b6c7d8e9f");
    expect(url.searchParams.get(COMPETITION_VIEW_PARAM)).toBe(
      COMPETITION_DETAILS_VIEW,
    );
  });

  /**
   * The default must stay "send them to their results". A gate that opened on an absent
   * parameter would strand every player on the lobby, which is the failure this feature exists
   * to avoid in the other direction.
   */
  it("nothing else opens the gate", () => {
    expect(wantsCompetitionDetailsView({})).toBe(false);
    expect(wantsCompetitionDetailsView(undefined)).toBe(false);
    expect(wantsCompetitionDetailsView({ view: "leaderboard" })).toBe(false);
    expect(wantsCompetitionDetailsView({ view: "" })).toBe(false);
    expect(wantsCompetitionDetailsView({ other: "details" })).toBe(false);
  });

  /**
   * Next.js types a repeated parameter as an array, so `?view=details&view=x` arrives as
   * `["details", "x"]`. Reading `=== "details"` off that is `false` - the safe direction, but
   * not a decision anyone made, and it means a duplicated parameter silently loses the button.
   */
  it("a repeated parameter is still a request for the details view", () => {
    expect(wantsCompetitionDetailsView({ view: ["details"] })).toBe(true);
    expect(wantsCompetitionDetailsView({ view: ["details", "x"] })).toBe(true);
    expect(wantsCompetitionDetailsView({ view: ["x"] })).toBe(false);
    expect(wantsCompetitionDetailsView({ view: [] })).toBe(false);
  });
});

describe("every screen goes through the one module", () => {
  /**
   * THE NEGATIVE ASSERTION IS THE HALF THAT MATTERS. Importing the helper is trivially
   * satisfied by a file that then writes `?view=details` by hand five lines later - which is
   * how this started, with the trading links carrying the string and the game links not.
   */
  it("no screen composes the query string by hand", () => {
    for (const file of [LOBBY_PAGE, RESULTS_PAGE, PROVIDER_RESULTS]) {
      const code = readCode(file);

      expect(
        code,
        `${file} writes the view query string by hand`,
      ).not.toMatch(/\?\s*view\s*=/);
      expect(
        code,
        `${file} writes the view query string by hand`,
      ).not.toMatch(/view\s*=\s*details/);
    }
  });

  /**
   * The gate must read the module, not a literal. Asserting the operator with its operands
   * rather than the identifier alone: `wantsCompetitionDetailsView` appears in the import line
   * whether or not it is ever called.
   */
  it("the lobby gate asks the module whether the details view was requested", () => {
    const code = readCode(LOBBY_PAGE);

    expect(code).toMatch(/wantsCompetitionDetailsView\s*\(\s*query\s*\)/);
    // The literal comparison this replaced. Its return would be a gate that no link can open.
    expect(code).not.toMatch(/query\s*\.\s*view\s*[!=]==/);
    expect(code).not.toMatch(/["']details["']/);
  });

  /**
   * Counted rather than merely found. The results page has two links to the lobby - one in each
   * of its two branches, provider and trading - and a test that only proves one exists is green
   * on exactly the bug that was here: the trading branch correct, the provider branch dead.
   *
   * It deliberately does NOT forbid a bare `/competitions/${id}` link in this file, because
   * there is a legitimate one: a visitor with no seat is redirected to the lobby, and the gate
   * requires a seat, so that path must not carry the override.
   */
  it("both results branches link through the helper", () => {
    const code = readCode(RESULTS_PAGE);
    const calls = code.match(/competitionDetailsHref\s*\(\s*\w/g) ?? [];

    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("the provider results screen links through the helper", () => {
    const code = readCode(PROVIDER_RESULTS);

    expect(code).toMatch(/competitionDetailsHref\s*\(\s*contestId\s*\)/);
    // The bare form, which is what this button had. It rendered, it navigated, and the
    // destination sent the player straight back to this screen.
    expect(code).not.toMatch(/href=\{`\/competitions\/\$\{contestId\}`\}/);
  });
});
