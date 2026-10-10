import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ART_BUTTON_HOVER, PRESS_EFFECT } from "@/components/ui/press-effect";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("one press effect for every player-side button (owner, 3 Oct 2026)", () => {
  it("is the competition entry button's small press, and never scales on hover", () => {
    expect(PRESS_EFFECT).toMatch(/\bduration-150\b/);
    expect(PRESS_EFFECT).toMatch(/\bactive:scale-95\b/);
    expect(PRESS_EFFECT).not.toMatch(/hover:scale/);
    expect(ART_BUTTON_HOVER).not.toMatch(/scale/);
    const entry = read("components/trading/CompetitionEntryButton.tsx");
    expect(entry).toMatch(/active:scale-95 transition-all duration-150/);
  });

  it("the shared Button and NeonButton/NeonPill all carry it", () => {
    expect(read("components/ui/button.tsx")).toMatch(/\$\{PRESS_EFFECT\}/);
    const neon = read("components/neon/Buttons.tsx");
    expect(neon.match(/\$\{PRESS_EFFECT\}/g)?.length).toBe(2);
  });

  it("no <Button>, <button> or <Link> opening tag scales on hover", () => {
    // Reason: a bare grep would also hit `group-hover:scale` on icons inside a card, which
    // is fine; only a hover scale on the control itself breaks the shared press.
    const files = execSync('rg -l --glob "*.tsx" "hover:scale-" components app', {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of files) {
      const src = read(f);
      const re = /<(Button|button|Link)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        let depth = 0;
        let end = m.index;
        for (let i = m.index; i < src.length; i++) {
          const ch = src.charAt(i);
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
          else if (ch === ">" && depth === 0 && src[i - 1] !== "=") {
            end = i;
            break;
          }
        }
        if (/(^|[\s"'`{])hover:scale-/.test(src.slice(m.index, end))) offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });
});
