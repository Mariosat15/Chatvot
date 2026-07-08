/**
 * IP Detection Service
 *
 * Detects VPN, Proxy, Tor, hosting/datacenter usage and provides geolocation.
 *
 * Detection strategy (best available first):
 *   1. proxycheck.io — accurate VPN/Proxy/Tor flags. Enabled automatically when
 *      IP_INTELLIGENCE_API_KEY (or PROXYCHECK_API_KEY) is set. Free tier: 1,000
 *      queries/day. This is the recommended production path.
 *   2. ip-api.com free fallback — geolocation + provider-name heuristics matched
 *      against a curated VPN/hosting list. Best-effort only (name-based). Used
 *      when no intelligence API key is configured.
 *
 * Reason: the previous implementation only flagged an IP as a VPN when the ISP
 * name literally contained the substring "vpn", so commercial VPNs that exit via
 * hosting/transit networks (Mullvad, M247, DataCamp, etc. — used by Malwarebytes
 * VPN, NordVPN and others) were never detected. This version fixes that logic and
 * adds a real intelligence provider.
 */

export interface IPDetectionResult {
  success: boolean;
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  org?: string;
  asn?: string;

  // Risk indicators
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number; // 0-100

  /** Which detector produced the result: "proxycheck" | "ip-api" | "skipped" | "error". */
  source?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any;
}

// Known commercial VPN brands. Matching ANY of these in the ISP/org/ASN text
// marks the IP as a VPN — we no longer additionally require the literal word
// "vpn" in the name (that was the core detection bug).
const VPN_PROVIDERS = [
  "nordvpn",
  "expressvpn",
  "surfshark",
  "privatevpn",
  "purevpn",
  "cyberghost",
  "ipvanish",
  "protonvpn",
  "proton ",
  "tunnelbear",
  "windscribe",
  "mullvad",
  "privadovpn",
  "zenmate",
  "hotspot shield",
  "vyprvpn",
  "atlas vpn",
  "private internet access",
  "torguard",
  "airvpn",
  "ivpn",
  "hide.me",
  "hidemyass",
  "perfect privacy",
  "strongvpn",
  "malwarebytes",
  "vpn",
];

// Hosting / transit networks very commonly used as VPN or proxy exit points.
// These are treated as VPN-grade risk because consumer traffic almost never
// originates directly from them.
const VPN_HOSTING_PROVIDERS = [
  "m247",
  "datacamp",
  "31173",
  "xtom",
  "leaseweb",
  "packethub",
  "tzulo",
  "creanova",
  "clouvider",
  "flokinet",
];

const PROXY_KEYWORDS = ["proxy", "proxies", "anonymizer", "hideip", "hideme"];

const TOR_KEYWORDS = ["tor exit", "tor-exit", "tor node", "torservers", "exit node"];

// Generic datacenter / hosting keywords (medium risk on their own).
const HOSTING_KEYWORDS = [
  "digitalocean",
  "amazon",
  "aws",
  "google cloud",
  "microsoft azure",
  "azure",
  "linode",
  "vultr",
  "ovh",
  "hetzner",
  "contabo",
  "scaleway",
  "hosting",
  "datacenter",
  "data center",
  "server",
  "colocation",
  "cloud",
];

// Known hosting ASNs (Autonomous System Numbers).
const HOSTING_ASNS = [
  "AS14061", // DigitalOcean
  "AS16509", // Amazon AWS
  "AS15169", // Google Cloud
  "AS8075", // Microsoft Azure
  "AS20473", // Vultr / Choopa
  "AS63949", // Linode / Akamai
  "AS16276", // OVH
  "AS24940", // Hetzner
  "AS9009", // M247
  "AS212238", // DataCamp
  "AS60068", // DataCamp / CDN77
  "AS51396", // Pfcloud / VPN hosting
  "AS62240", // Clouvider
];

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Classify VPN/Proxy/Tor/hosting purely from provider-name signals.
 * Used by the free ip-api fallback (no dedicated intelligence flags).
 */
function classifyFromNames(
  isp: string,
  org: string,
  asn: string,
): { isVPN: boolean; isProxy: boolean; isTor: boolean; isHosting: boolean } {
  const text = `${isp} ${org} ${asn}`.toLowerCase();
  const asnUpper = asn.toUpperCase();

  const isTor = includesAny(text, TOR_KEYWORDS);
  const isProxy = !isTor && includesAny(text, PROXY_KEYWORDS);
  const isVPN =
    !isTor &&
    !isProxy &&
    (includesAny(text, VPN_PROVIDERS) ||
      includesAny(text, VPN_HOSTING_PROVIDERS));
  const isHosting =
    !isVPN &&
    !isProxy &&
    !isTor &&
    (includesAny(text, HOSTING_KEYWORDS) ||
      HOSTING_ASNS.some((a) => asnUpper.includes(a)));

  return { isVPN, isProxy, isTor, isHosting };
}

/**
 * Calculate a 0-100 risk score from the detection flags.
 */
function calculateRiskScore(
  isVPN: boolean,
  isProxy: boolean,
  isTor: boolean,
  isHosting: boolean,
): number {
  let score = 0;
  if (isTor) score += 50; // Tor is highest risk
  if (isVPN) score += 30; // VPN is medium-high risk
  if (isProxy) score += 25; // Proxy is medium risk
  if (isHosting) score += 20; // Datacenter IP is medium-low risk
  return Math.min(score, 100);
}

/**
 * Return true for localhost / private / reserved addresses that can never be
 * meaningfully classified (and must never be blocked).
 */
function isLocalOrPrivate(ip: string): boolean {
  return (
    !ip ||
    ip === "unknown" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.") ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("::ffff:192.168.") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("fe80:")
  );
}

const SKIPPED_RESULT = (ip: string): IPDetectionResult => ({
  success: true,
  ip,
  isVPN: false,
  isProxy: false,
  isTor: false,
  isHosting: false,
  riskScore: 0,
  source: "skipped",
});

/**
 * Primary detector: proxycheck.io. Returns null when no key is configured or
 * the request fails, so the caller can fall back to ip-api.
 */
async function detectViaProxyCheck(
  ip: string,
): Promise<IPDetectionResult | null> {
  // Reason: load the key like other admin-managed settings — WhiteLabel DB
  // first, then .env / process.env (via getEnv). PROXYCHECK_API_KEY remains a
  // legacy env alias. This lets admins set it from Settings → Environment.
  let key = "";
  try {
    const { getEnv } = await import("@/lib/services/settings.service");
    key = (await getEnv("IP_INTELLIGENCE_API_KEY", "")) || "";
  } catch {
    key = process.env.IP_INTELLIGENCE_API_KEY || "";
  }
  if (!key) key = process.env.PROXYCHECK_API_KEY || "";
  if (!key) return null;

  try {
    const url = `https://proxycheck.io/v2/${encodeURIComponent(
      ip,
    )}?key=${encodeURIComponent(key)}&vpn=3&asn=1&risk=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== "ok" && data.status !== "warning") return null;

    // eslint-disable-next-line security/detect-object-injection -- `ip` is the address we queried, not a user-controlled object traversal key
    const node = data[ip] as Record<string, unknown> | undefined;
    if (!node) return null;

    const proxy = String(node.proxy || "no").toLowerCase() === "yes";
    const type = String(node.type || "").toLowerCase(); // VPN, TOR, PUB, WEB, SES, RES, ...
    const providerRisk = Number(node.risk ?? 0);

    const isTor = type.includes("tor");
    const isVPN = !isTor && (type.includes("vpn") || (proxy && type === "vpn"));
    const isProxy = !isTor && !isVPN && proxy;
    const isHosting =
      !isVPN &&
      !isProxy &&
      !isTor &&
      (type.includes("hosting") || type.includes("compromised server"));

    // Prefer the provider's own risk score when present, else derive from flags.
    const derived = calculateRiskScore(isVPN, isProxy, isTor, isHosting);
    const riskScore = Math.max(
      derived,
      Number.isFinite(providerRisk) ? Math.min(providerRisk, 100) : 0,
    );

    return {
      success: true,
      ip,
      country: node.country as string | undefined,
      countryCode: (node.isocode as string | undefined) || undefined,
      region: node.region as string | undefined,
      city: node.city as string | undefined,
      isp: (node.provider as string | undefined) || (node.isp as string | undefined),
      org: node.organisation as string | undefined,
      asn: node.asn as string | undefined,
      isVPN,
      isProxy,
      isTor,
      isHosting,
      riskScore,
      source: "proxycheck",
      rawData: node,
    };
  } catch (error) {
    console.warn("⚠️ proxycheck.io lookup failed, falling back to ip-api:", error);
    return null;
  }
}

/**
 * Fallback detector: ip-api.com (free). Geolocation + provider-name heuristics.
 */
async function detectViaIpApi(ip: string): Promise<IPDetectionResult> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city,timezone,isp,org,as`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) throw new Error(`IP-API returned ${response.status}`);

    const data = await response.json();
    if (data.status === "fail") {
      console.warn(`IP-API detection failed for ${ip}: ${data.message}`);
      return { ...SKIPPED_RESULT(ip), success: false, source: "ip-api" };
    }

    const isp = data.isp || "";
    const org = data.org || "";
    const asn = data.as || "";

    const { isVPN, isProxy, isTor, isHosting } = classifyFromNames(
      isp,
      org,
      asn,
    );
    const riskScore = calculateRiskScore(isVPN, isProxy, isTor, isHosting);

    if (riskScore > 0) {
      console.log(
        `🔍 Suspicious IP ${ip} — isp="${isp}" org="${org}" asn="${asn}" ` +
          `VPN:${isVPN} Proxy:${isProxy} Tor:${isTor} Hosting:${isHosting} risk:${riskScore}`,
      );
    }

    return {
      success: true,
      ip,
      country: data.country,
      countryCode: data.countryCode,
      region: data.region,
      city: data.city,
      timezone: data.timezone,
      isp,
      org,
      asn,
      isVPN,
      isProxy,
      isTor,
      isHosting,
      riskScore,
      source: "ip-api",
      rawData: data,
    };
  } catch (error) {
    console.error(`Error detecting VPN/Proxy for ${ip}:`, error);
    // Fail safe — never block users because of an API error.
    return { ...SKIPPED_RESULT(ip), success: false, source: "error" };
  }
}

/**
 * Detect VPN/Proxy/Tor for an IP address.
 * Tries the intelligence provider first, then the free heuristic fallback.
 */
export async function detectVPNProxy(
  ipAddress: string,
): Promise<IPDetectionResult> {
  if (isLocalOrPrivate(ipAddress)) {
    return SKIPPED_RESULT(ipAddress);
  }

  const viaProvider = await detectViaProxyCheck(ipAddress);
  if (viaProvider) return viaProvider;

  return detectViaIpApi(ipAddress);
}

/**
 * Check if IP should be flagged as high risk (used for scoring/alerts).
 */
export function isHighRiskIP(detection: IPDetectionResult): boolean {
  if (detection.isTor) return true;
  if (detection.isVPN && detection.isHosting) return true;
  const indicators = [
    detection.isVPN,
    detection.isProxy,
    detection.isHosting,
  ].filter(Boolean).length;
  return indicators >= 2 || detection.riskScore >= 40;
}

/** Minimal shape of the fraud settings this gate reads. */
export interface IpGateSettings {
  vpnDetectionEnabled?: boolean;
  blockVPN?: boolean;
  blockProxy?: boolean;
  blockTor?: boolean;
  blockDatacenterIPs?: boolean;
  whitelistedIPs?: string[];
}

export interface IpGateResult {
  blocked: boolean;
  reason?: string;
  detection: IPDetectionResult;
}

/**
 * Central IP-risk gate. Decides whether an IP should be BLOCKED based on the
 * admin's block toggles. Shared by registration and competition/challenge entry
 * so the "Block VPN / Proxy / Tor / Datacenter" switches actually take effect.
 *
 * Reason: previously these toggles were saved but never enforced anywhere — the
 * system only raised alerts. This turns them into real gates. Whitelisted IPs
 * always pass, and any detection error fails OPEN (never blocks a real user).
 */
export async function evaluateIpRisk(
  ipAddress: string,
  settings: IpGateSettings,
): Promise<IpGateResult> {
  const passthrough = (detection: IPDetectionResult): IpGateResult => ({
    blocked: false,
    detection,
  });

  // Detection disabled or no block toggle on → nothing to enforce.
  const anyBlockEnabled =
    !!settings.blockVPN ||
    !!settings.blockProxy ||
    !!settings.blockTor ||
    !!settings.blockDatacenterIPs;

  if (!settings.vpnDetectionEnabled || !anyBlockEnabled) {
    return passthrough(SKIPPED_RESULT(ipAddress));
  }

  if (isLocalOrPrivate(ipAddress)) {
    return passthrough(SKIPPED_RESULT(ipAddress));
  }

  // Whitelisted IPs always pass.
  if (settings.whitelistedIPs?.includes(ipAddress)) {
    return passthrough(SKIPPED_RESULT(ipAddress));
  }

  const detection = await detectVPNProxy(ipAddress);

  // Detection failed → fail open (don't block real users on API errors).
  if (!detection.success) {
    return passthrough(detection);
  }

  if (settings.blockTor && detection.isTor) {
    return {
      blocked: true,
      reason:
        "Access via the Tor network is not permitted. Please disable it and try again.",
      detection,
    };
  }
  if (settings.blockVPN && detection.isVPN) {
    return {
      blocked: true,
      reason:
        "Access via a VPN is not permitted. Please disable your VPN and try again.",
      detection,
    };
  }
  if (settings.blockProxy && detection.isProxy) {
    return {
      blocked: true,
      reason:
        "Access via a proxy is not permitted. Please disable it and try again.",
      detection,
    };
  }
  if (settings.blockDatacenterIPs && detection.isHosting) {
    return {
      blocked: true,
      reason:
        "Access from this network is not permitted. Please use a standard internet connection.",
      detection,
    };
  }

  return passthrough(detection);
}
