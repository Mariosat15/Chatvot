/**
 * Data Masking Utilities for AI Agent
 * 
 * Anonymizes sensitive data before sending to external AI services
 * to protect user privacy and comply with data protection regulations.
 */

// Mapping to store original -> masked values for the session
const maskingMap = new Map<string, string>();
let maskCounter = 0;

/**
 * Reset masking map (call at start of each request)
 */
export function resetMaskingMap() {
  maskingMap.clear();
  maskCounter = 0;
}

/**
 * Get or create a masked version of a value
 */
function getOrCreateMask(value: string, prefix: string): string {
  if (!value) return value;
  
  const key = `${prefix}:${value}`;
  if (maskingMap.has(key)) {
    return maskingMap.get(key)!;
  }
  
  maskCounter++;
  const masked = `${prefix}_${maskCounter.toString().padStart(4, '0')}`;
  maskingMap.set(key, masked);
  return masked;
}

/**
 * Mask an email address
 * john.doe@example.com → user_0001
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return '—';
  return getOrCreateMask(email, 'user');
}

/**
 * Mask a user ID
 * 507f1f77bcf86cd799439011 → uid_0001
 */
export function maskUserId(userId: string | undefined | null): string {
  if (!userId) return '—';
  return getOrCreateMask(userId, 'uid');
}

/**
 * Mask a name (show only initials)
 * John Doe → J.D.
 */
export function maskName(name: string | undefined | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p.charAt(0).toUpperCase() + '.').join('');
}

/**
 * Mask a monetary amount to a range
 * €1,234.56 → €1,000-2,000
 */
export function maskAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '—';
  
  if (amount === 0) return '€0';
  if (amount < 10) return '€0-10';
  if (amount < 50) return '€10-50';
  if (amount < 100) return '€50-100';
  if (amount < 500) return '€100-500';
  if (amount < 1000) return '€500-1K';
  if (amount < 5000) return '€1K-5K';
  if (amount < 10000) return '€5K-10K';
  return '€10K+';
}

/**
 * Mask amount but keep precision for totals/summaries (less sensitive)
 * Shows rounded value
 */
export function maskTotalAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '€0.00';
  // Round to nearest whole number for totals
  return `€${Math.round(amount).toLocaleString()}`;
}

/**
 * Mask a card fingerprint
 * abc123def456 → fp_****
 */
export function maskFingerprint(fingerprint: string | undefined | null): string {
  if (!fingerprint) return '—';
  // Show first 4 chars only
  return `fp_${fingerprint.substring(0, 4)}****`;
}

/**
 * Mask card last 4 digits
 * 1234 → **34
 */
export function maskCardLast4(last4: string | undefined | null): string {
  if (!last4) return '—';
  return `**${last4.slice(-2)}`;
}

/**
 * Mask a transaction ID
 * 507f1f77bcf86cd799439011 → tx_0001
 */
export function maskTransactionId(txId: string | undefined | null): string {
  if (!txId) return '—';
  return getOrCreateMask(txId, 'tx');
}

/**
 * Mask a provider transaction ID (external reference)
 * pi_3ABC123 → ext_****ABC
 */
export function maskProviderTxId(providerTxId: string | undefined | null): string {
  if (!providerTxId) return '—';
  // Show only last 3 chars
  const last3 = providerTxId.slice(-3);
  return `ext_****${last3}`;
}

/**
 * Mask IP address
 * 192.168.1.100 → 192.168.*.*
 */
export function maskIpAddress(ip: string | undefined | null): string {
  if (!ip) return '—';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return 'masked_ip';
}

/**
 * Mask country (keep as-is, not sensitive)
 */
export function maskCountry(country: string | undefined | null): string {
  return country || '—';
}

/**
 * Mask a date (keep date but not exact time)
 */
export function maskDate(date: Date | string | undefined | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString();
}

/**
 * Mask all sensitive fields in an object recursively
 */
export function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }
  
  if (typeof data === 'object') {
    const masked: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Email fields
      if (lowerKey.includes('email')) {
        masked[key] = maskEmail(value as string);
      }
      // Name fields
      else if (lowerKey === 'name' || lowerKey.includes('username')) {
        masked[key] = maskName(value as string);
      }
      // User ID fields
      else if (lowerKey === 'userid' || lowerKey === 'user_id' || lowerKey === 'ownerid') {
        masked[key] = maskUserId(value as string);
      }
      // Transaction ID fields
      else if (lowerKey.includes('transactionid') || lowerKey === 'txid') {
        masked[key] = maskTransactionId(value as string);
      }
      // Provider transaction ID
      else if (lowerKey.includes('providertransactionid') || lowerKey.includes('paymentintentid')) {
        masked[key] = maskProviderTxId(value as string);
      }
      // Fingerprint fields
      else if (lowerKey.includes('fingerprint')) {
        masked[key] = maskFingerprint(value as string);
      }
      // Card last 4
      else if (lowerKey.includes('last4') || lowerKey.includes('cardlast')) {
        masked[key] = maskCardLast4(value as string);
      }
      // IP address
      else if (lowerKey.includes('ipaddress') || lowerKey === 'ip') {
        masked[key] = maskIpAddress(value as string);
      }
      // Amount fields (individual transactions)
      else if (lowerKey === 'amount' || lowerKey === 'balance') {
        masked[key] = maskAmount(value as number);
      }
      // Keep totals more visible (aggregates are less sensitive)
      else if (lowerKey.includes('total') && typeof value === 'number') {
        masked[key] = maskTotalAmount(value as number);
      }
      // Nested objects
      else if (typeof value === 'object' && value !== null) {
        masked[key] = maskSensitiveData(value);
      }
      // Pass through other values
      else {
        masked[key] = value;
      }
    }
    return masked;
  }
  
  return data;
}

/**
 * Create a summary of what was masked (for audit purposes)
 */
export function getMaskingSummary(): { totalMasked: number; types: Record<string, number> } {
  const types: Record<string, number> = {};
  
  for (const key of maskingMap.keys()) {
    const prefix = key.split(':')[0];
    types[prefix] = (types[prefix] || 0) + 1;
  }
  
  return {
    totalMasked: maskingMap.size,
    types
  };
}

