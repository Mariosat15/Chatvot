import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Reason: the race server accepted the practice `track` action while both proxies in front of it
// (nginx in production, the Next.js rewrite locally) admitted only six actions, so every circuit
// pick and Shuffle 404ed with nothing in any log. Each list is a separate copy of one fact, so the
// guard reads the actions out of the client and asserts both copies admit every one of them.
const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function clientActions(): string[] {
  const source = read("velocity-server/client-patches/multiplayer-client.js");
  const requested = [...source.matchAll(/request\('([a-z]+)'/g)].map((m) => m[1]);
  // The event stream is opened as an EventSource on `/events`, not through request().
  if (source.includes("'/events'")) requested.push("events");
  return [...new Set(requested)].sort();
}

function allowList(source: string, pattern: RegExp): string[] {
  const match = source.match(pattern);
  expect(match, "allow-list not found").not.toBeNull();
  return match![1].split("|").sort();
}

describe("Volt Velocity proxy action allow-lists", () => {
  const actions = clientActions();

  it("reads the client's actions, including track", () => {
    expect(actions).toEqual(expect.arrayContaining(["join", "events", "input", "ship", "track", "ready", "leave"]));
  });

  it("nginx admits every action the client sends", () => {
    const list = allowList(read("deploy/nginx.conf"), /\/races\/\(\[-\\w\]\{1,80\}\)\/\(([a-z|]+)\)\$"/);
    expect(list).toEqual(actions);
  });

  it("the Next.js rewrite admits every action the client sends", () => {
    const list = allowList(read("next.config.ts"), /:action\(([a-z|]+)\)"/);
    expect(list).toEqual(actions);
  });
});
