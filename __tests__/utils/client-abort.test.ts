import { describe, expect, it } from "vitest";
import { isClientAbort } from "@/lib/utils/client-abort";

describe("isClientAbort", () => {
  it("recognises a client hang-up", () => {
    expect(isClientAbort(new Error("aborted"))).toBe(true);
    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    expect(isClientAbort(reset)).toBe(true);
    const ac = new AbortController();
    ac.abort();
    const req = new Request("http://x", { signal: ac.signal });
    expect(isClientAbort(new Error("anything"), req)).toBe(true);
  });

  it("does not hide real server failures", () => {
    expect(isClientAbort(new Error("Mongo timeout"))).toBe(false);
    expect(isClientAbort(new SyntaxError("Unexpected token"))).toBe(false);
    expect(isClientAbort("aborted")).toBe(false);
    expect(isClientAbort(new Error("x"), new Request("http://x"))).toBe(false);
  });
});
