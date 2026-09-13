import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Gap detection on the Market Data screen must stay operator-triggered.
 *
 * Reason: `GET /api/market-data/gap-fill` scans every configured symbol against
 * every timeframe collection and loads each candle's timestamp into Node memory,
 * then loops over them in JavaScript. That is CPU-bound work on the event loop,
 * so while it runs it also starves the two cheap requests this screen needs to
 * render — which is why the section used to sit on a spinner showing nothing.
 *
 * It was called from the mount effect. Putting it back is a one-line change that
 * reads as harmless, produces no error, and reintroduces a multi-minute blank
 * screen. Hence a test rather than a comment.
 */

const SECTION_PATH = join(
  process.cwd(),
  "apps/admin/components/admin/MarketDataSection.tsx",
);

/** The `useEffect(..., [])` that runs once when the section mounts. */
function mountEffectBody(source: string): string {
  const marker = "}, []); // Run only once on mount";
  const end = source.indexOf(marker);
  expect(
    end,
    "the mount effect marker comment has changed — re-read the effect and update this test deliberately",
  ).toBeGreaterThan(-1);

  const start = source.lastIndexOf("useEffect(() => {", end);
  expect(start).toBeGreaterThan(-1);

  return source.slice(start, end);
}

describe("market data gap detection is operator-triggered", () => {
  const source = readFileSync(SECTION_PATH, "utf8");

  it("does not scan for gaps when the section mounts", () => {
    expect(
      mountEffectBody(source),
      "fetchGaps() is back in the mount effect — opening Market Data will block on a full multi-collection scan and render nothing",
    ).not.toContain("fetchGaps");
  });

  it("still loads the cheap data the screen needs to render", () => {
    // Reason: guards the opposite mistake — removing the scan is only correct if
    // the settings and stats fetches that clear `loading` are still there.
    const body = mountEffectBody(source);
    expect(body).toContain("fetchData");
    expect(body).toContain("fetchSymbols");
  });

  it("keeps a deliberate trigger for the operator", () => {
    expect(source).toContain("Detect Gaps Now");
    expect(source).toContain("onClick={fetchGaps}");
  });

  it("does not claim there are no gaps before anything was scanned", () => {
    // Reason: an empty gap list means "not checked" until a scan completes.
    // Rendering "No gaps detected" in that state tells an operator the data is
    // complete when nothing has been verified — a worse failure than being slow.
    expect(source).toContain("gapsScanned");
    expect(source).toContain("Not scanned yet");

    // Reason: matches the rendered JSX rather than the bare phrase, so the
    // explanatory comment above `gapsScanned` cannot satisfy this by accident.
    const rendered = "✓</span> No gaps detected";
    const occurrences = source.split(rendered).length - 1;
    expect(
      occurrences,
      "expected exactly one place to render the reassuring message; a second one would need gating too",
    ).toBe(1);

    const noGapsIndex = source.indexOf(rendered);
    const guardWindow = source.slice(
      Math.max(0, noGapsIndex - 200),
      noGapsIndex,
    );
    expect(
      guardWindow,
      '"No gaps detected" must be gated on gapsScanned',
    ).toContain("gapsScanned");
  });
});
