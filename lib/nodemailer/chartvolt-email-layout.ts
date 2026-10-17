/**
 * The one ChartVolt email shell: dark navy card, cyan border, gold call to
 * action, "Trade • Play • Compete • Conquer" strip and a platform disclaimer.
 *
 * Pure string building - no database, no network - so it can be unit tested
 * and imported from either app. MIRRORED byte-for-byte into
 * `apps/admin/lib/nodemailer/chartvolt-email-layout.ts`.
 *
 * Reason: mobile mail clients (Gmail app, Outlook mobile) drop `<body>`
 * backgrounds and CSS gradients, which is why the old emails rendered white on
 * phones. Every surface here is a table carrying BOTH a `bgcolor` attribute and
 * an inline `background-color`, so the dark theme survives without any
 * background image.
 */

export const EMAIL_THEME = {
  page: "#030712",
  card: "#071226",
  panel: "#050d1d",
  strip: "#050b17",
  border: "#0bbfe6",
  cyan: "#00dcff",
  gold: "#ffc928",
  ink: "#07101f",
  text: "#ffffff",
  body: "#b7c5d8",
  muted: "#72839a",
  faint: "#60738d",
  green: "#22c55e",
  red: "#f87171",
} as const;

/** Marker left in the footer; `applyEmailDisclaimer` swaps it for the text. */
export const DISCLAIMER_SLOT = "<!--CV_EMAIL_DISCLAIMER-->";
/** Attribute that proves a disclaimer block is already in the HTML. */
export const DISCLAIMER_ATTR = "data-cv-disclaimer";

export const DEFAULT_EMAIL_DISCLAIMER =
  "This email was sent by ChartVolt to the address registered on your account. " +
  "ChartVolt is a skill-based competition platform; trading takes place with " +
  "simulated funds and nothing in this email is investment advice. " +
  "Never share your password or one-time codes - ChartVolt staff will never ask for them.";

export type EmailTone = "gold" | "green" | "cyan" | "red" | "white" | "muted";

export interface EmailDetailRow {
  label: string;
  value: string;
  tone?: EmailTone;
  mono?: boolean;
}

export interface ChartVoltEmailOptions {
  /** `<title>` and hidden preheader fallback. */
  title: string;
  platformName: string;
  logoUrl?: string;
  /** Hidden inbox preview line. */
  preheader?: string;
  /** Small cyan uppercase line above the heading. */
  eyebrow?: string;
  heading: string;
  subheading?: string;
  /** Recipient name; rendered as "Hi <strong>name</strong>,". */
  greetingName?: string;
  /** Already-safe HTML paragraphs (callers escape user input). */
  bodyHtml?: string;
  detailsTitle?: string;
  details?: EmailDetailRow[];
  /** Big centred figure, e.g. a new balance. */
  highlight?: { label: string; value: string; tone?: EmailTone };
  listTitle?: string;
  listItems?: string[];
  cta?: { text: string; url: string };
  ctaNote?: string;
  /** Show "Button not working?" with the raw link. */
  showFallbackLink?: boolean;
  panel?: { icon?: string; title: string; lines: string[] };
  closingHtml?: string;
  footerAddress?: string;
  footerLinks?: { label: string; url: string }[];
  footerNote?: string;
}

const FONT = "Arial, Helvetica, sans-serif";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toneColor(tone: EmailTone | undefined): string {
  switch (tone) {
    case "gold":
      return EMAIL_THEME.gold;
    case "green":
      return EMAIL_THEME.green;
    case "cyan":
      return EMAIL_THEME.cyan;
    case "red":
      return EMAIL_THEME.red;
    case "muted":
      return EMAIL_THEME.muted;
    default:
      return EMAIL_THEME.text;
  }
}

/** A dark table row; `bgcolor` + inline colour so mobile keeps it dark. */
function row(content: string, padding: string, bg: string = EMAIL_THEME.card): string {
  return `<tr><td bgcolor="${bg}" style="background-color:${bg};padding:${padding};">${content}</td></tr>`;
}

function renderHeader(o: ChartVoltEmailOptions): string {
  const logo = o.logoUrl
    ? `<img src="${escapeHtml(o.logoUrl)}" alt="${escapeHtml(o.platformName)}" width="150" style="display:block;border:0;max-width:150px;height:auto;margin:0 auto 20px;" />`
    : `<div style="font-size:24px;font-weight:800;color:${EMAIL_THEME.gold};margin:0 0 20px;">${escapeHtml(o.platformName)}</div>`;
  const eyebrow = o.eyebrow
    ? `<div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${EMAIL_THEME.cyan};font-weight:700;margin-bottom:8px;">${escapeHtml(o.eyebrow)}</div>`
    : "";
  const sub = o.subheading
    ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#9fb3cc;">${o.subheading}</p>`
    : "";
  return row(
    `<div style="text-align:center;">${logo}${eyebrow}<h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:800;color:${EMAIL_THEME.text};">${o.heading}</h1>${sub}</div>`,
    "34px 28px 18px",
  );
}

function renderBody(o: ChartVoltEmailOptions): string {
  const greeting = o.greetingName
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:${EMAIL_THEME.text};">Hi <strong>${escapeHtml(o.greetingName)}</strong>,</p>`
    : "";
  const body = o.bodyHtml
    ? `<div style="font-size:15px;line-height:1.8;color:${EMAIL_THEME.body};">${o.bodyHtml}</div>`
    : "";
  if (!greeting && !body) return "";
  return row(`${greeting}${body}`, "20px 34px 10px");
}

function renderDetails(o: ChartVoltEmailOptions): string {
  if (!o.details || o.details.length === 0) return "";
  const rows = o.details
    .map((d, i) => {
      const last = i === o.details!.length - 1;
      const border = last ? "" : "border-bottom:1px solid rgba(0,213,255,.15);";
      const font = d.mono ? "font-family:monospace;font-size:12px;" : "font-size:14px;";
      return `<tr><td style="padding:11px 0;color:#91a4bc;font-size:14px;${border}">${escapeHtml(d.label)}</td><td align="right" style="padding:11px 0;color:${toneColor(d.tone)};font-weight:700;${font}${border}word-break:break-all;">${d.value}</td></tr>`;
    })
    .join("");
  const title = o.detailsTitle
    ? `<div style="font-size:15px;color:${EMAIL_THEME.text};font-weight:700;margin-bottom:8px;">${escapeHtml(o.detailsTitle)}</div>`
    : "";
  return row(panelTable(`${title}<table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`), "6px 34px 18px");
}

function panelTable(inner: string, borderColor = "rgba(0,213,255,.25)"): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_THEME.panel}" style="background-color:${EMAIL_THEME.panel};border:1px solid ${borderColor};border-radius:16px;"><tr><td style="padding:20px 22px;">${inner}</td></tr></table>`;
}

function renderHighlight(o: ChartVoltEmailOptions): string {
  if (!o.highlight) return "";
  const color = toneColor(o.highlight.tone ?? "gold");
  return row(
    panelTable(
      `<div style="text-align:center;"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#91a4bc;margin-bottom:8px;">${escapeHtml(o.highlight.label)}</div><div style="font-size:30px;font-weight:800;color:${color};">${o.highlight.value}</div></div>`,
      color,
    ),
    "6px 34px 18px",
  );
}

function renderList(o: ChartVoltEmailOptions): string {
  if (!o.listItems || o.listItems.length === 0) return "";
  const title = o.listTitle
    ? `<div style="font-size:15px;color:${EMAIL_THEME.gold};font-weight:700;margin-bottom:10px;">${escapeHtml(o.listTitle)}</div>`
    : "";
  const items = o.listItems
    .map((item) => `<div style="padding:3px 0;">&#8226;&nbsp; ${item}</div>`)
    .join("");
  return row(
    `${title}<div style="font-size:14px;line-height:1.8;color:${EMAIL_THEME.body};">${items}</div>`,
    "6px 34px 14px",
  );
}

function renderCta(o: ChartVoltEmailOptions): string {
  if (!o.cta) return "";
  const url = escapeHtml(o.cta.url);
  const note = o.ctaNote
    ? `<p style="margin:14px 0 0;font-size:12px;color:${EMAIL_THEME.muted};">${o.ctaNote}</p>`
    : "";
  const button = `<table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center" bgcolor="${EMAIL_THEME.gold}" style="border-radius:12px;background-color:${EMAIL_THEME.gold};"><a href="${url}" style="display:inline-block;padding:16px 36px;min-width:190px;text-decoration:none;color:${EMAIL_THEME.ink};font-size:15px;font-weight:800;font-family:${FONT};">${escapeHtml(o.cta.text)} &rarr;</a></td></tr></table>`;
  const fallback = o.showFallbackLink
    ? `<p style="margin:22px 0 6px;font-size:12px;line-height:1.6;color:#718299;">Button not working? Copy and paste this link into your browser:</p><p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;"><a href="${url}" style="color:${EMAIL_THEME.cyan};text-decoration:none;">${url}</a></p>`
    : "";
  return row(`<div style="text-align:center;">${button}${note}</div>${fallback}`, "22px 34px 26px");
}

function renderPanel(o: ChartVoltEmailOptions): string {
  if (!o.panel) return "";
  const icon = o.panel.icon ?? "&#128274;";
  const lines = o.panel.lines.map((l) => `&#8226; ${l}`).join("<br/>");
  return row(
    panelTable(
      `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" valign="top"><div style="width:34px;height:34px;border-radius:10px;background-color:#081a34;border:1px solid #00cfff;text-align:center;line-height:34px;color:#00e5ff;font-size:18px;">${icon}</div></td><td><div style="font-size:15px;color:${EMAIL_THEME.text};font-weight:700;margin-bottom:8px;">${escapeHtml(o.panel.title)}</div><div style="font-size:13px;line-height:1.8;color:#91a4bc;">${lines}</div></td></tr></table>`,
    ),
    "0 34px 24px",
  );
}

function renderFooter(o: ChartVoltEmailOptions): string {
  const strip = row(
    `<div style="text-align:center;font-size:11px;letter-spacing:1.8px;color:#6e839c;text-transform:uppercase;">Trade &nbsp;&#8226;&nbsp; Play &nbsp;&#8226;&nbsp; Compete &nbsp;&#8226;&nbsp; Conquer</div>`,
    "18px 20px",
    EMAIL_THEME.strip,
  ).replace('style="', 'style="border-top:1px solid rgba(0,213,255,.15);');
  const links = (o.footerLinks ?? [])
    .filter((l) => l.url)
    .map((l) => `<a href="${escapeHtml(l.url)}" style="color:#8fa3bb;text-decoration:underline;">${escapeHtml(l.label)}</a>`)
    .join(" &nbsp;|&nbsp; ");
  const address = o.footerAddress
    ? `<div style="margin-top:6px;">${escapeHtml(o.footerAddress)}</div>`
    : "";
  const note = o.footerNote ?? "This is an automated email. Please do not reply to this message.";
  const footer = row(
    `<div style="text-align:center;"><div style="color:${EMAIL_THEME.text};font-size:13px;font-weight:700;margin-bottom:6px;">${escapeHtml(o.platformName)}</div><div style="color:${EMAIL_THEME.faint};font-size:11px;line-height:1.6;">${escapeHtml(note)}${address}${links ? `<div style="margin-top:8px;">${links}</div>` : ""}<div style="margin-top:8px;">&copy; ${new Date().getFullYear()} ${escapeHtml(o.platformName)}</div></div>${DISCLAIMER_SLOT}</div>`,
    "22px 28px 28px",
  );
  return strip + footer;
}

/** Render a complete dark ChartVolt email document. */
export function renderChartVoltEmail(o: ChartVoltEmailOptions): string {
  const preheader = escapeHtml(o.preheader ?? o.title);
  const sections = [
    `<tr><td height="5" bgcolor="${EMAIL_THEME.cyan}" style="height:5px;line-height:5px;font-size:0;background-color:${EMAIL_THEME.cyan};background-image:linear-gradient(90deg,#00d9ff,#6648ff,#ff32c8,#ffc928);">&nbsp;</td></tr>`,
    renderHeader(o),
    renderBody(o),
    renderDetails(o),
    renderHighlight(o),
    renderList(o),
    o.closingHtml
      ? row(`<div style="font-size:15px;line-height:1.8;color:${EMAIL_THEME.body};">${o.closingHtml}</div>`, "6px 34px 6px")
      : "",
    renderCta(o),
    renderPanel(o),
    renderFooter(o),
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(o.title)}</title>
</head>
<body bgcolor="${EMAIL_THEME.page}" style="margin:0;padding:0;background-color:${EMAIL_THEME.page};font-family:${FONT};color:${EMAIL_THEME.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_THEME.page}" style="background-color:${EMAIL_THEME.page};">
<tr><td align="center" bgcolor="${EMAIL_THEME.page}" style="background-color:${EMAIL_THEME.page};padding:32px 12px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_THEME.card}" style="max-width:620px;background-color:${EMAIL_THEME.card};border:1px solid ${EMAIL_THEME.border};border-radius:22px;overflow:hidden;">
${sections}
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The disclaimer block itself; `text` is plain text (escaped here). */
export function renderDisclaimerBlock(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 6px;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div ${DISCLAIMER_ATTR}="1" style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(0,213,255,.15);color:${EMAIL_THEME.faint};font-size:10px;line-height:1.6;text-align:center;font-family:${FONT};">${paragraphs}</div>`;
}

/**
 * Put the platform disclaimer into any email HTML, including operator-written
 * custom templates that know nothing about the layout.
 *
 * Order: the layout's slot, then a `{{emailDisclaimer}}` placeholder, then a
 * dark block before `</body>`, then an append. Idempotent - a document that
 * already carries a disclaimer block is returned with only the slots cleared.
 */
export function applyEmailDisclaimer(html: string, text: string | null | undefined): string {
  const clean = (text ?? "").trim();
  const clearSlots = (h: string) =>
    h.split(DISCLAIMER_SLOT).join("").replace(/\{\{\s*emailDisclaimer\s*\}\}/g, "");
  if (!clean || html.includes(DISCLAIMER_ATTR)) return clearSlots(html);

  const block = renderDisclaimerBlock(clean);
  if (html.includes(DISCLAIMER_SLOT)) {
    return html.replace(DISCLAIMER_SLOT, block).split(DISCLAIMER_SLOT).join("");
  }
  if (/\{\{\s*emailDisclaimer\s*\}\}/.test(html)) {
    return html.replace(/\{\{\s*emailDisclaimer\s*\}\}/, block).replace(/\{\{\s*emailDisclaimer\s*\}\}/g, "");
  }
  const wrapped = `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL_THEME.page}" style="background-color:${EMAIL_THEME.page};"><tr><td align="center" style="padding:0 20px 24px;"><div style="max-width:620px;">${block}</div></td></tr></table>`;
  const bodyClose = html.search(/<\/body>/i);
  if (bodyClose >= 0) return html.slice(0, bodyClose) + wrapped + html.slice(bodyClose);
  return html + wrapped;
}

/**
 * Ask mail clients not to auto-invert a document into a light theme. Only adds
 * the `color-scheme` meta tags; never rewrites an operator's own colours.
 */
export function ensureDarkColorScheme(html: string): string {
  if (/name=["']color-scheme["']/i.test(html)) return html;
  const meta = `<meta name="color-scheme" content="dark" /><meta name="supported-color-schemes" content="dark" />`;
  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen || headOpen.index === undefined) return html;
  const at = headOpen.index + headOpen[0].length;
  return html.slice(0, at) + meta + html.slice(at);
}

/** Final pass every outgoing email goes through (see `getTransporter`). */
export function finalizeEmailHtml(html: string, disclaimer: string | null | undefined): string {
  return applyEmailDisclaimer(ensureDarkColorScheme(html), disclaimer);
}
