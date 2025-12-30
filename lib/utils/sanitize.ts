/**
 * Input Sanitization Utilities
 * 
 * SECURITY: Prevents XSS, SQL injection, and other injection attacks
 */

/**
 * Sanitize a string to prevent XSS attacks
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeString(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Convert to string if not already
  let str = String(input);
  
  // Trim whitespace
  str = str.trim();
  
  // Limit length
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Escape HTML entities
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return str;
}

/**
 * Sanitize a string but preserve some formatting (for notes/descriptions)
 * Less aggressive than full sanitization
 */
export function sanitizeText(input: string | null | undefined, maxLength: number = 5000): string {
  if (!input) return '';
  
  let str = String(input).trim();
  
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Remove script tags and event handlers
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/on\w+\s*=/gi, '');
  
  // Remove javascript: URLs
  str = str.replace(/javascript:/gi, '');
  
  // Basic HTML entity escaping for dangerous characters
  str = str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return str;
}

/**
 * Sanitize an email address
 * Returns empty string if invalid
 */
export function sanitizeEmail(input: string | null | undefined): string {
  if (!input) return '';
  
  const email = String(input).trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email) || email.length > 254) {
    return '';
  }
  
  return email;
}

/**
 * Sanitize a numeric amount
 * Returns 0 if invalid
 */
export function sanitizeAmount(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  
  const num = typeof input === 'string' ? parseFloat(input) : input;
  
  // Check for valid number
  if (isNaN(num) || !isFinite(num)) return 0;
  
  // Round to 2 decimal places for currency
  return Math.round(num * 100) / 100;
}

/**
 * Sanitize a MongoDB ObjectId string
 * Returns null if invalid
 */
export function sanitizeObjectId(input: string | null | undefined): string | null {
  if (!input) return null;
  
  const id = String(input).trim();
  
  // MongoDB ObjectId is 24 hex characters
  const objectIdRegex = /^[a-f0-9]{24}$/i;
  
  if (!objectIdRegex.test(id)) {
    return null;
  }
  
  return id;
}

/**
 * Sanitize a bank IBAN
 */
export function sanitizeIBAN(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove all whitespace and convert to uppercase
  const iban = String(input).replace(/\s/g, '').toUpperCase();
  
  // IBAN should be 15-34 alphanumeric characters
  if (!/^[A-Z0-9]{15,34}$/.test(iban)) {
    return '';
  }
  
  return iban;
}

/**
 * Sanitize a BIC/SWIFT code
 */
export function sanitizeBIC(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove all whitespace and convert to uppercase
  const bic = String(input).replace(/\s/g, '').toUpperCase();
  
  // BIC is 8 or 11 alphanumeric characters
  if (!/^[A-Z0-9]{8}$|^[A-Z0-9]{11}$/.test(bic)) {
    return '';
  }
  
  return bic;
}

/**
 * Sanitize user-provided note/reason text
 */
export function sanitizeUserNote(input: string | null | undefined): string {
  return sanitizeText(input, 500);
}

/**
 * Sanitize admin note text
 */
export function sanitizeAdminNote(input: string | null | undefined): string {
  return sanitizeText(input, 2000);
}

/**
 * Sanitize a card holder name
 */
export function sanitizeCardHolderName(input: string | null | undefined): string {
  if (!input) return '';
  
  let name = String(input).trim();
  
  // Max 100 characters
  if (name.length > 100) {
    name = name.substring(0, 100);
  }
  
  // Only allow letters, spaces, hyphens, apostrophes
  name = name.replace(/[^a-zA-Z\s\-']/g, '');
  
  // Normalize whitespace
  name = name.replace(/\s+/g, ' ').trim();
  
  return name;
}

