/**
 * IP Detection Service
 * 
 * Detects VPN, Proxy, Tor, and provides geolocation data
 * Uses free IP-API.com service (15,000 requests/hour)
 */

interface IPDetectionResult {
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
  
  // Additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any;
}

// Known VPN/Proxy/Hosting providers
const SUSPICIOUS_ISPS = [
  // VPN Providers
  'nordvpn', 'expressvpn', 'surfshark', 'privatevpn', 'purevpn', 
  'cyberghost', 'ipvanish', 'protonvpn', 'tunnelbear', 'windscribe',
  'mullvad', 'privadovpn', 'zenmate', 'hotspot shield', 'vyprvpn',
  
  // Proxy Services
  'proxy', 'proxies', 'anonymizer', 'hideip', 'hideme',
  
  // Hosting/Datacenter (often used for VPN/Proxy)
  'digitalocean', 'amazonaws', 'google cloud', 'microsoft azure',
  'linode', 'vultr', 'ovh', 'hetzner', 'contabo', 'scaleway',
  
  // Tor Exit Nodes
  'tor', 'exit node', 'relay'
];

// Known hosting ASNs (Autonomous System Numbers)
const HOSTING_ASNS = [
  'AS14061', // DigitalOcean
  'AS16509', // Amazon AWS
  'AS15169', // Google Cloud
  'AS8075',  // Microsoft Azure
  'AS20473', // Vultr
  'AS63949', // Linode
  'AS16276', // OVH
  'AS24940', // Hetzner
];

/**
 * Check if IP is from a suspicious provider
 */
function isSuspiciousProvider(isp: string, org: string, asn: string): boolean {
  const combinedText = `${isp} ${org} ${asn}`.toLowerCase();
  
  return SUSPICIOUS_ISPS.some(suspicious => 
    combinedText.includes(suspicious.toLowerCase())
  ) || HOSTING_ASNS.some(hostingAsn => 
    asn.includes(hostingAsn)
  );
}

/**
 * Calculate risk score based on detection results
 */
function calculateRiskScore(
  isVPN: boolean,
  isProxy: boolean,
  isTor: boolean,
  isHosting: boolean
): number {
  let score = 0;
  
  if (isTor) score += 50;        // Tor is highest risk
  if (isVPN) score += 30;        // VPN is medium-high risk
  if (isProxy) score += 25;      // Proxy is medium risk
  if (isHosting) score += 20;    // Datacenter IP is medium-low risk
  
  return Math.min(score, 100);
}

/**
 * Detect VPN/Proxy using IP-API.com (free service)
 * Rate limit: 45 requests per minute
 * 
 * For production, consider upgrading to:
 * - IP-API Pro ($13/month for 150,000 requests/month)
 * - IPQualityScore (more accurate VPN/Proxy detection)
 * - IPHub (specialized in proxy detection)
 */
export async function detectVPNProxy(ipAddress: string): Promise<IPDetectionResult> {
  // Skip detection for localhost/private IPs (IPv4 and IPv6)
  if (
    ipAddress === 'unknown' ||
    ipAddress === '::1' ||           // IPv6 localhost
    ipAddress === '::ffff:127.0.0.1' || // IPv4-mapped IPv6 localhost
    ipAddress.startsWith('127.') ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.') ||
    ipAddress.startsWith('172.') ||
    ipAddress.startsWith('::ffff:127.') ||
    ipAddress.startsWith('::ffff:192.168.') ||
    ipAddress.startsWith('::ffff:10.') ||
    ipAddress.startsWith('fe80:')    // IPv6 link-local
  ) {
    return {
      success: true,
      ip: ipAddress,
      isVPN: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
    };
  }

  try {
    // Use IP-API.com free service
    // Fields: status,message,country,countryCode,region,city,timezone,isp,org,as
    const response = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,city,timezone,isp,org,as`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Set timeout
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`IP-API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'fail') {
      console.warn(`IP-API detection failed for ${ipAddress}: ${data.message}`);
      return {
        success: false,
        ip: ipAddress,
        isVPN: false,
        isProxy: false,
        isTor: false,
        isHosting: false,
        riskScore: 0,
      };
    }

    // Extract data
    const isp = data.isp || '';
    const org = data.org || '';
    const asn = data.as || '';

    // Detect VPN/Proxy/Hosting
    const isSuspicious = isSuspiciousProvider(isp, org, asn);
    const isHostingProvider = HOSTING_ASNS.some(hostingAsn => asn.includes(hostingAsn));
    
    // Simple heuristics (can be improved)
    const isVPN = isSuspicious && (
      isp.toLowerCase().includes('vpn') ||
      org.toLowerCase().includes('vpn')
    );
    
    const isProxy = isSuspicious && (
      isp.toLowerCase().includes('proxy') ||
      org.toLowerCase().includes('proxy') ||
      isp.toLowerCase().includes('anonymizer')
    );
    
    const isTor = isSuspicious && (
      isp.toLowerCase().includes('tor') ||
      org.toLowerCase().includes('tor') ||
      isp.toLowerCase().includes('exit')
    );
    
    const isHosting = isHostingProvider && !isVPN && !isProxy && !isTor;

    const riskScore = calculateRiskScore(isVPN, isProxy, isTor, isHosting);

    const result: IPDetectionResult = {
      success: true,
      ip: ipAddress,
      country: data.country,
      countryCode: data.countryCode,
      region: data.region,
      city: data.city,
      timezone: data.timezone,
      isp: data.isp,
      org: data.org,
      asn: data.as,
      isVPN,
      isProxy,
      isTor,
      isHosting,
      riskScore,
      rawData: data,
    };

    // Log suspicious IPs
    if (riskScore > 0) {
      console.log(`🔍 Suspicious IP detected: ${ipAddress}`);
      console.log(`   ISP: ${isp}`);
      console.log(`   Org: ${org}`);
      console.log(`   ASN: ${asn}`);
      console.log(`   VPN: ${isVPN}, Proxy: ${isProxy}, Tor: ${isTor}, Hosting: ${isHosting}`);
      console.log(`   Risk Score: ${riskScore}`);
    }

    return result;
  } catch (error) {
    console.error(`Error detecting VPN/Proxy for ${ipAddress}:`, error);
    
    // Return safe default on error (don't block users due to API issues)
    return {
      success: false,
      ip: ipAddress,
      isVPN: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
    };
  }
}

/**
 * Check if IP should be flagged as high risk
 */
export function isHighRiskIP(detection: IPDetectionResult): boolean {
  // Tor is always high risk
  if (detection.isTor) return true;
  
  // VPN + Hosting is suspicious (common cheater setup)
  if (detection.isVPN && detection.isHosting) return true;
  
  // Multiple indicators
  const indicators = [
    detection.isVPN,
    detection.isProxy,
    detection.isHosting
  ].filter(Boolean).length;
  
  return indicators >= 2 || detection.riskScore >= 40;
}

