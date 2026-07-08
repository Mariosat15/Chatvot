/**
 * IP Detection Service (admin mirror)
 *
 * Detects VPN, Proxy, Tor, hosting/datacenter usage and provides geolocation.
 * Keep in sync with the main app copy at lib/services/ip-detection.service.ts.
 *
 * Detection strategy (best available first):
 *   1. proxycheck.io — accurate VPN/Proxy/Tor flags. Enabled automatically when
 *      IP_INTELLIGENCE_API_KEY (or PROXYCHECK_API_KEY) is set. Free tier: 1,000
 *      queries/day.
 *   2. ip-api.com free fallback — geolocation + provider-name heuristics.
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

  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number;

  source?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any;
}

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

const HOSTING_ASNS = [
  "AS14061",
  "AS16509",
  "AS15169",
  "AS8075",
  "AS20473",
  "AS63949",
  "AS16276",
  "AS24940",
  "AS9009",
  "AS212238",
  "AS60068",
  "AS51396",
  "AS62240",
];

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

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

function calculateRiskScore(
  isVPN: boolean,
  isProxy: boolean,
  isTor: boolean,
  isHosting: boolean,
): number {
  let score = 0;
  if (isTor) score += 50;
  if (isVPN) score += 30;
  if (isProxy) score += 25;
  if (isHosting) score += 20;
  return Math.min(score, 100);
}

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

async function detectViaProxyCheck(
  ip: string,
): Promise<IPDetectionResult | null> {
  const key =
    process.env.IP_INTELLIGENCE_API_KEY ||
    process.env.PROXYCHECK_API_KEY ||
    "";
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
    const type = String(node.type || "").toLowerCase();
    const providerRisk = Number(node.risk ?? 0);

    const isTor = type.includes("tor");
    const isVPN = !isTor && (type.includes("vpn") || (proxy && type === "vpn"));
    const isProxy = !isTor && !isVPN && proxy;
    const isHosting =
      !isVPN &&
      !isProxy &&
      !isTor &&
      (type.includes("hosting") || type.includes("compromised server"));

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
    return { ...SKIPPED_RESULT(ip), success: false, source: "error" };
  }
}

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
