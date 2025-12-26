/**
 * Environment Variable Validation
 * 
 * Validates critical environment variables at startup.
 * Prevents the app from running with insecure/placeholder values in production.
 * 
 * In DEVELOPMENT: Auto-generates missing secrets and saves to .env
 * In PRODUCTION: Requires manual configuration (security best practice)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Known placeholder/insecure values that should never be used in production
const INSECURE_SECRETS = [
  'your-super-secret-key-min-32-chars',
  'your-secret-key',
  'change-me',
  'changeme',
  'secret',
  'password',
  'test',
  'development',
  'placeholder',
  'example',
  'fallback-secret',
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Auto-generate and save a secure secret to .env file
 * Only used in development mode
 */
function autoGenerateSecret(): string | null {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Never auto-generate in production
    return null;
  }
  
  try {
    // Generate a secure 64-character hex string
    const newSecret = crypto.randomBytes(32).toString('hex');
    
    // Find .env file (check common locations)
    const possiblePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local'),
    ];
    
    let envPath = possiblePaths.find(p => fs.existsSync(p));
    
    // If no .env exists, create one
    if (!envPath) {
      envPath = possiblePaths[0];
      fs.writeFileSync(envPath, '# Auto-generated environment file\n');
    }
    
    // Read existing content
    let envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Check if BETTER_AUTH_SECRET already exists (even if empty)
    if (envContent.includes('BETTER_AUTH_SECRET=')) {
      // Replace the existing line
      envContent = envContent.replace(
        /BETTER_AUTH_SECRET=.*/,
        `BETTER_AUTH_SECRET=${newSecret}`
      );
    } else {
      // Add new line
      envContent += `\n# Auto-generated secure secret (generated on ${new Date().toISOString()})\nBETTER_AUTH_SECRET=${newSecret}\n`;
    }
    
    // Write back
    fs.writeFileSync(envPath, envContent);
    
    // Also set in current process
    process.env.BETTER_AUTH_SECRET = newSecret;
    
    console.log('🔐 Auto-generated BETTER_AUTH_SECRET and saved to .env');
    console.log('   (This only happens in development mode)');
    
    return newSecret;
  } catch (error) {
    console.warn('⚠️  Could not auto-generate secret:', error);
    return null;
  }
}

/**
 * Validate that BETTER_AUTH_SECRET is secure
 */
export function validateAuthSecret(): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  let secret = process.env.BETTER_AUTH_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // Check if secret exists
  if (!secret) {
    // Try to auto-generate in development
    if (!isProduction) {
      const generated = autoGenerateSecret();
      if (generated) {
        secret = generated;
        result.warnings.push('BETTER_AUTH_SECRET was auto-generated for development.');
      }
    }
    
    // Still no secret?
    if (!secret) {
      result.valid = false;
      result.errors.push('BETTER_AUTH_SECRET is not set. Authentication will not work.');
      return result;
    }
  }

  // Check minimum length (32 characters recommended for security)
  if (secret.length < 32) {
    if (isProduction) {
      result.valid = false;
      result.errors.push(
        `BETTER_AUTH_SECRET is too short (${secret.length} chars). ` +
        'Production requires at least 32 characters for security.'
      );
    } else {
      result.warnings.push(
        `BETTER_AUTH_SECRET is short (${secret.length} chars). ` +
        'Use at least 32 characters in production.'
      );
    }
  }

  // Check for insecure/placeholder values
  const lowerSecret = secret.toLowerCase();
  let isInsecure = false;
  for (const insecure of INSECURE_SECRETS) {
    if (lowerSecret.includes(insecure)) {
      isInsecure = true;
      break;
    }
  }
  
  if (isInsecure) {
    if (isProduction) {
      result.valid = false;
      result.errors.push(
        `BETTER_AUTH_SECRET contains insecure placeholder value. ` +
        'Generate a secure random secret for production.'
      );
    } else {
      // Auto-regenerate in development
      console.log('⚠️  Detected placeholder secret, auto-generating a secure one...');
      const generated = autoGenerateSecret();
      if (generated) {
        secret = generated;
        result.warnings.push('Placeholder secret replaced with auto-generated secure secret.');
      } else {
        result.warnings.push(
          'BETTER_AUTH_SECRET appears to be a placeholder. ' +
          'Generate a secure random secret before deploying to production.'
        );
      }
    }
  }

  // Check for low entropy (simple patterns)
  if (isProduction && hasLowEntropy(secret)) {
    result.valid = false;
    result.errors.push(
      'BETTER_AUTH_SECRET has low entropy (predictable pattern). ' +
      'Use a cryptographically random secret.'
    );
  }

  return result;
}

/**
 * Check if a string has low entropy (repeating patterns, sequential chars)
 */
function hasLowEntropy(str: string): boolean {
  // Check for repeating characters (e.g., "aaaaaaa")
  if (/(.)\1{7,}/.test(str)) return true;
  
  // Check for sequential patterns (e.g., "12345678", "abcdefgh")
  if (/01234567|12345678|23456789|abcdefgh|bcdefghi/i.test(str)) return true;
  
  // Check if mostly same character
  const charCount: Record<string, number> = {};
  for (const char of str) {
    charCount[char] = (charCount[char] || 0) + 1;
  }
  const maxCount = Math.max(...Object.values(charCount));
  if (maxCount > str.length * 0.5) return true; // More than 50% same char
  
  return false;
}

/**
 * Validate all critical environment variables
 * Call this at app startup
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('🔐 Validating environment security...');
  
  const authResult = validateAuthSecret();
  
  // Log warnings
  for (const warning of authResult.warnings) {
    console.warn(`⚠️  ${warning}`);
  }
  
  // Log errors
  for (const error of authResult.errors) {
    console.error(`❌ ${error}`);
  }
  
  // In production, fail fast on security issues
  if (!authResult.valid && isProduction) {
    console.error('\n🚨 CRITICAL: Environment validation failed!');
    console.error('   The app cannot start with insecure configuration in production.');
    console.error('\n   To fix, generate a secure secret:');
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('\n   Then set BETTER_AUTH_SECRET in your .env file.\n');
    process.exit(1);
  }
  
  if (authResult.valid && authResult.warnings.length === 0) {
    console.log('✅ Environment security validated');
  }
}

/**
 * Generate a secure random secret
 */
export function generateSecureSecret(): string {
  // This is a helper - actual generation should use crypto
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

