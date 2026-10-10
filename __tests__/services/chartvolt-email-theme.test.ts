/**
 * The ChartVolt dark email theme, the platform-wide disclaimer, and the two
 * session guards (Remember Me, lockout kick). See `External game plans/redising login.md`.
 */
import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EMAIL_DISCLAIMER,
  DISCLAIMER_ATTR,
  DISCLAIMER_SLOT,
  EMAIL_THEME,
  applyEmailDisclaimer,
  ensureDarkColorScheme,
  finalizeEmailHtml,
  renderChartVoltEmail,
} from "@/lib/nodemailer/chartvolt-email-layout";
import { resolveEmailDisclaimer } from "@/lib/nodemailer/email-brand";
import { formatFeeAmount } from "@/lib/services/notification.service";
import {
  readRememberedEmail,
  rememberSignInEmail,
} from "@/lib/utils/remember-sign-in";
import { SESSION_ENDING_LOCKOUT_REASONS } from "@/lib/services/account-standing.service";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function sample(): string {
  return renderChartVoltEmail({
    title: "Reset your password",
    platformName: "ChartVolt",
    heading: "Reset your password",
    bodyHtml: "<p>Hello</p>",
    cta: { text: "Reset password", url: "https://chartvolt.com/reset?t=1" },
  });
}

describe("dark layout", () => {
  it("paints the page, card and CTA in the ChartVolt palette with bgcolor fallbacks", () => {
    const html = sample();
    expect(EMAIL_THEME.page).toBe("#030712");
    expect(EMAIL_THEME.card).toBe("#071226");
    expect(EMAIL_THEME.gold).toBe("#ffc928");
    // Reason: Gmail/Outlook mobile drop `background-color` in some modes; `bgcolor`
    // is the attribute that kept the email dark on the owner's phone.
    expect(html).toContain(`<body bgcolor="#030712"`);
    expect(html).toContain(`bgcolor="#071226"`);
    expect(html).toContain(`bgcolor="#ffc928"`);
    expect(html).toContain('<meta name="color-scheme" content="dark" />');
    expect(html).toContain("linear-gradient(90deg,#00d9ff,#6648ff,#ff32c8,#ffc928)");
    expect(html).toContain("Trade &nbsp;&#8226;&nbsp; Play");
    expect(html).not.toMatch(/background-image:url\(/i);
  });

  it("leaves exactly one disclaimer slot for the finalizer", () => {
    expect(sample().split(DISCLAIMER_SLOT)).toHaveLength(2);
  });
});

describe("disclaimer placement", () => {
  it("fills the layout slot and leaves no slot behind", () => {
    const out = applyEmailDisclaimer(sample(), "Not financial advice.");
    expect(out).toContain("Not financial advice.");
    expect(out).not.toContain(DISCLAIMER_SLOT);
    expect(out.split(DISCLAIMER_ATTR)).toHaveLength(2);
  });

  it("is idempotent - a second pass adds no second block", () => {
    const once = applyEmailDisclaimer(sample(), "Note");
    expect(applyEmailDisclaimer(once, "Note")).toBe(once);
  });

  it("fills a {{emailDisclaimer}} placeholder in an operator template", () => {
    const out = applyEmailDisclaimer("<html><body><p>Hi</p>{{ emailDisclaimer }}</body></html>", "Note");
    expect(out).not.toContain("emailDisclaimer");
    expect(out.indexOf("Note")).toBeLessThan(out.indexOf("</body>"));
  });

  it("falls back to a block before </body> when the template has no slot", () => {
    const out = applyEmailDisclaimer("<html><body><p>Hi</p></body></html>", "Note");
    expect(out.indexOf(DISCLAIMER_ATTR)).toBeGreaterThan(out.indexOf("<p>Hi</p>"));
    expect(out.indexOf(DISCLAIMER_ATTR)).toBeLessThan(out.indexOf("</body>"));
  });

  it("escapes the operator's text", () => {
    expect(applyEmailDisclaimer("<body></body>", "<script>x</script>")).not.toContain("<script>");
  });

  it("when switched off, renders nothing and still clears the slots", () => {
    const out = applyEmailDisclaimer(sample() + "{{emailDisclaimer}}", null);
    expect(out).not.toContain(DISCLAIMER_ATTR);
    expect(out).not.toContain(DISCLAIMER_SLOT);
    expect(out).not.toContain("emailDisclaimer");
  });

  it("adds the dark color-scheme meta to an operator template once", () => {
    const once = ensureDarkColorScheme("<html><head><title>x</title></head><body></body></html>");
    expect(once).toContain('name="color-scheme"');
    expect(ensureDarkColorScheme(once)).toBe(once);
    expect(finalizeEmailHtml("<html><head></head><body></body></html>", "N")).toContain(DISCLAIMER_ATTR);
  });
});

describe("resolveEmailDisclaimer", () => {
  it("uses the default for empty text and only switches off on an explicit false", () => {
    expect(resolveEmailDisclaimer(undefined, undefined)).toBe(DEFAULT_EMAIL_DISCLAIMER);
    expect(resolveEmailDisclaimer("   ", true)).toBe(DEFAULT_EMAIL_DISCLAIMER);
    expect(resolveEmailDisclaimer(" Mine ", null)).toBe("Mine");
    expect(resolveEmailDisclaimer("Mine", false)).toBeNull();
  });
});

describe("placeholders", () => {
  it("never leaves a literal {{entryFee}} behind", () => {
    expect(formatFeeAmount(undefined)).toBe("0");
    expect(formatFeeAmount(Number.NaN)).toBe("0");
    expect(formatFeeAmount(25)).not.toContain("{{");
  });
});

describe("mirrors", () => {
  it.each(["lib/nodemailer/chartvolt-email-layout.ts", "lib/nodemailer/email-brand.ts"])(
    "%s is byte-identical in both apps",
    (rel) => {
      expect(read(`apps/admin/${rel}`)).toBe(read(rel));
    },
  );

  it("two_factor_otp is a template type in both models and offered in the admin screen", () => {
    expect(read("database/models/email-template.model.ts")).toContain('"two_factor_otp"');
    expect(read("apps/admin/database/models/email-template.model.ts")).toContain('"two_factor_otp"');
    expect(read("apps/admin/components/admin/EmailTemplatesSection.tsx")).toContain("two_factor_otp");
    expect(read("apps/admin/components/admin/EmailTemplatesSection.tsx")).toContain("<EmailDisclaimerCard />");
  });
});

describe("guards", () => {
  it("are mounted in both layouts", () => {
    expect(read("app/(root)/layout.tsx")).toContain("<AccountStandingGuard />");
    expect(read("apps/admin/app/layout.tsx")).toContain("<AdminSessionGuard />");
  });

  it("only a person's or the fraud system's lockout ends a live session", () => {
    expect([...SESSION_ENDING_LOCKOUT_REASONS].sort()).toEqual(
      ["admin_action", "fraud_detection", "suspicious_activity"],
    );
  });

  it("the disclaimer route guards every exported handler by section", () => {
    const src = stripComments(read("apps/admin/app/api/email-templates/disclaimer/route.ts"));
    const handlers = src.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
    const guards = src.match(/guardSection\("email-templates"\)/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(guards.length).toBe(handlers.length);
  });
});

describe("Remember Me", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const map = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
      },
    });
    return map;
  }

  it("stores only the email when ticked and forgets it when unticked", () => {
    const map = stubStorage();
    rememberSignInEmail("  me@x.com ", true);
    expect(readRememberedEmail()).toBe("me@x.com");
    expect([...map.values()]).toEqual(["me@x.com"]);
    rememberSignInEmail("me@x.com", false);
    expect(readRememberedEmail()).toBeNull();
  });

  it("survives a browser that throws on storage access", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("denied");
      },
    });
    expect(() => rememberSignInEmail("a@b.c", true)).not.toThrow();
    expect(readRememberedEmail()).toBeNull();
  });
});
