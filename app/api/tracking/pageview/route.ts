import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SiteVisit from "@/database/models/site-visit.model";
import BlockedVisitor from "@/database/models/blocked-visitor.model";

// ─── Bot detection patterns ─────────────────────────────────────────────────
const BOT_PATTERNS: [RegExp, string][] = [
  [/Googlebot/i, "Googlebot"],
  [/Bingbot/i, "Bingbot"],
  [/Slurp/i, "Yahoo Slurp"],
  [/DuckDuckBot/i, "DuckDuckBot"],
  [/Baiduspider/i, "Baiduspider"],
  [/YandexBot/i, "YandexBot"],
  [/facebookexternalhit/i, "Facebook"],
  [/Twitterbot/i, "Twitterbot"],
  [/LinkedInBot/i, "LinkedInBot"],
  [/WhatsApp/i, "WhatsApp"],
  [/TelegramBot/i, "TelegramBot"],
  [/Discordbot/i, "Discordbot"],
  [/Applebot/i, "Applebot"],
  [/SemrushBot/i, "SemrushBot"],
  [/AhrefsBot/i, "AhrefsBot"],
  [/MJ12bot/i, "MJ12bot"],
  [/DotBot/i, "DotBot"],
  [/PetalBot/i, "PetalBot"],
  [/GPTBot/i, "GPTBot"],
  [/Claude-Web/i, "Claude"],
  [/Bytespider/i, "Bytespider"],
  [/HeadlessChrome/i, "HeadlessChrome"],
  [/PhantomJS/i, "PhantomJS"],
  [/python-requests/i, "python-requests"],
  [/curl\//i, "curl"],
  [/wget\//i, "wget"],
  [/Go-http-client/i, "Go-http-client"],
  [/scrapy/i, "Scrapy"],
  [/bot|crawl|spider|slurp|scrape/i, "Unknown Bot"],
];

// Reason: Known attack/scanner patterns
const SUSPICIOUS_PATTERNS: [RegExp, string][] = [
  [/sqlmap/i, "SQL injection scanner"],
  [/nikto/i, "Nikto vulnerability scanner"],
  [/nmap/i, "Nmap port scanner"],
  [/masscan/i, "Masscan scanner"],
  [/zgrab/i, "ZGrab scanner"],
  [/nuclei/i, "Nuclei scanner"],
  [/dirbuster/i, "DirBuster scanner"],
  [/gobuster/i, "GoBuster scanner"],
  [/wpscan/i, "WPScan scanner"],
  [/burpsuite/i, "BurpSuite scanner"],
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectBot(ua: string): { isBot: boolean; botName: string } {
  if (!ua) return { isBot: false, botName: "" };
  for (const [pattern, name] of BOT_PATTERNS) {
    if (pattern.test(ua)) return { isBot: true, botName: name };
  }
  return { isBot: false, botName: "" };
}

function detectSuspicious(ua: string, path: string): { isSuspicious: boolean; reason: string } {
  for (const [pattern, name] of SUSPICIOUS_PATTERNS) {
    if (pattern.test(ua)) return { isSuspicious: true, reason: name };
  }
  const attackPaths = [
    "/wp-admin", "/wp-login", "/.env", "/phpmyadmin",
    "/administrator", "/admin.php", "/.git", "/config",
    "/xmlrpc.php", "/wp-content", "/.well-known/security.txt",
  ];
  const lowerPath = path.toLowerCase();
  for (const ap of attackPaths) {
    if (lowerPath.startsWith(ap)) {
      return { isSuspicious: true, reason: `Attack path probe: ${ap}` };
    }
  }
  return { isSuspicious: false, reason: "" };
}

function parseBrowser(ua: string): string {
  if (!ua) return "Unknown";
  if (ua.includes("Edg/") || ua.includes("Edg ")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Brave")) return "Brave";
  if (ua.includes("Vivaldi")) return "Vivaldi";
  if (ua.includes("Chrome/") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("MSIE") || ua.includes("Trident")) return "IE";
  return "Other";
}

function parseOS(ua: string): string {
  if (!ua) return "Unknown";
  if (ua.includes("Windows NT 10")) return "Windows 10/11";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("CrOS")) return "ChromeOS";
  return "Other";
}

function parseDevice(screenWidth?: number, ua?: string): "desktop" | "mobile" | "tablet" | "unknown" {
  if (screenWidth) {
    if (screenWidth < 768) return "mobile";
    if (screenWidth < 1024) return "tablet";
    return "desktop";
  }
  if (ua) {
    if (/Mobile|Android.*Mobile|iPhone/i.test(ua)) return "mobile";
    if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "tablet";
    if (/Windows|Macintosh|Linux/i.test(ua)) return "desktop";
  }
  return "unknown";
}

function categorisePath(path: string): "hero" | "landing" | "app" | "auth" | "admin" | "other" {
  if (path === "/" || path === "") return "hero";
  if (path.startsWith("/lp/")) return "landing";
  if (path.startsWith("/sign-in") || path.startsWith("/sign-up") || path.startsWith("/verify")) return "auth";
  if (path.startsWith("/admin") || path.startsWith("/administrator")) return "admin";
  const appPrefixes = [
    "/dashboard", "/competitions", "/challenges", "/wallet",
    "/profile", "/settings", "/leaderboard", "/marketplace",
    "/friends", "/messages", "/arena", "/championship",
  ];
  for (const prefix of appPrefixes) {
    if (path.startsWith(prefix)) return "app";
  }
  return "other";
}

function extractSearchQuery(referrer: string): string {
  if (!referrer) return "";
  try {
    const url = new URL(referrer);
    return url.searchParams.get("q")
      || url.searchParams.get("query")
      || url.searchParams.get("p")
      || url.searchParams.get("text")
      || url.searchParams.get("wd")
      || "";
  } catch {
    return "";
  }
}

/**
 * Categorize the traffic source from the referrer URL.
 * Mirrors GA4 source/medium logic.
 */
function categorizeTrafficSource(referrer: string, utmSource: string, utmMedium: string): string {
  if (utmMedium === "cpc" || utmMedium === "ppc" || utmMedium === "paid") return "paid";
  if (utmSource === "email" || utmMedium === "email") return "email";
  if (utmSource || utmMedium) return "campaign";
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    const socialDomains = [
      "facebook.com", "fb.com", "twitter.com", "x.com", "instagram.com",
      "linkedin.com", "youtube.com", "tiktok.com", "reddit.com", "pinterest.com",
      "t.co", "threads.net", "discord.com", "telegram.org",
    ];
    for (const d of socialDomains) {
      if (host.includes(d)) return "social";
    }
    const searchDomains = [
      "google.", "bing.com", "yahoo.", "duckduckgo.com",
      "yandex.", "baidu.com", "ecosia.org",
    ];
    for (const d of searchDomains) {
      if (host.includes(d)) return "organic";
    }
    return "referral";
  } catch {
    return "direct";
  }
}

// ─── In-memory rate limiter ──────────────────────────────────────────────────
const recentVisits = new Map<string, number>();
const RATE_LIMIT_MS = 2000;

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, ts] of recentVisits) {
    if (ts < cutoff) recentVisits.delete(key);
  }
}, 60_000);

/**
 * POST /api/tracking/pageview — Record page visits AND engagement updates.
 * type: "pageview" — new page view record
 * type: "engagement" — update duration/scroll depth on existing visit
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    // ─── Engagement update (duration + scroll depth) ───────────────────
    if (type === "engagement") {
      const { path, sessionId, duration, scrollDepth } = body;
      if (!path || !sessionId || typeof duration !== "number") {
        return NextResponse.json({ ok: true });
      }

      await connectToDatabase();

      // Reason: Update the most recent visit for this session+path with duration
      await SiteVisit.updateOne(
        { sessionId, path },
        {
          $set: {
            duration: Math.min(duration, 3600), // Cap at 1 hour
            scrollDepth: Math.min(Math.round(scrollDepth || 0), 100),
          },
        },
        { sort: { visitedAt: -1 } },
      );

      return NextResponse.json({ ok: true });
    }

    // ─── Page view ─────────────────────────────────────────────────────
    const { path, referrer, userAgent, screenWidth, screenHeight, language } = body;

    if (!path || typeof path !== "string") {
      return NextResponse.json({ ok: true });
    }

    const cfIp = req.headers.get("cf-connecting-ip");
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = cfIp
      || (forwardedFor ? forwardedFor.split(",")[0].trim() : "")
      || req.headers.get("x-real-ip")
      || "";

    const rateKey = `${ip}-${path}`;
    const lastVisit = recentVisits.get(rateKey);
    if (lastVisit && Date.now() - lastVisit < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true });
    }
    recentVisits.set(rateKey, Date.now());

    await connectToDatabase();

    const ua = (userAgent || "").slice(0, 500);
    const isBlocked = await BlockedVisitor.exists({
      isActive: true,
      $or: [
        { type: "ip", value: ip },
        { type: "country", value: req.headers.get("cf-ipcountry") || "" },
      ],
    });

    const botInfo = detectBot(ua);
    const suspiciousInfo = detectSuspicious(ua, path);

    const country = req.headers.get("cf-ipcountry") || "";
    const city = req.headers.get("cf-ipcity") || "";
    const region = req.headers.get("cf-region") || "";

    const visitorId = `${ip}-${ua.slice(0, 50)}`;
    const sessionId = body.sessionId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const resolution = screenWidth && screenHeight ? `${screenWidth}x${screenHeight}` : "";
    const utmSource = (body.utmSource || "").slice(0, 200);
    const utmMedium = (body.utmMedium || "").slice(0, 200);
    const trafficSource = categorizeTrafficSource(referrer || "", utmSource, utmMedium);

    if (isBlocked) {
      BlockedVisitor.updateMany(
        { isActive: true, $or: [{ type: "ip", value: ip }] },
        { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } },
      ).exec().catch(() => {});
    }

    await SiteVisit.create({
      path: path.slice(0, 500),
      pageCategory: categorisePath(path),
      visitorId,
      sessionId,
      ip,
      userAgent: ua,
      referrer: (referrer || "").slice(0, 500),
      country,
      city,
      region,
      device: parseDevice(screenWidth, ua),
      browser: parseBrowser(ua),
      os: parseOS(ua),
      screenResolution: resolution,
      language: (language || "").slice(0, 50),
      isBot: botInfo.isBot,
      botName: botInfo.botName,
      isSuspicious: suspiciousInfo.isSuspicious,
      suspiciousReason: suspiciousInfo.reason,
      searchQuery: extractSearchQuery(referrer || ""),
      utmSource,
      utmMedium,
      utmCampaign: (body.utmCampaign || "").slice(0, 200),
      utmTerm: (body.utmTerm || "").slice(0, 200),
      utmContent: (body.utmContent || "").slice(0, 200),
      trafficSource,
      isNewVisitor: !!body.isNewVisitor,
      sessionPageCount: body.sessionPageCount || 1,
      connectionType: (body.connectionType || "").slice(0, 20),
      visitedAt: new Date(),
      isBlocked: !!isBlocked,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("⚠️ [SiteTracker] Error recording visit:", error);
    return NextResponse.json({ ok: true });
  }
}
