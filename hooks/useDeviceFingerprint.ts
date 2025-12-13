/**
 * React Hook for Device Fingerprinting
 * 
 * Automatically tracks device fingerprint and detects multi-accounting.
 * Use this hook in components where you want to track user devices.
 */

import { useEffect, useState } from 'react';
import { trackDeviceFingerprint } from '@/lib/services/device-fingerprint.service';

interface DeviceFingerprintResult {
  success: boolean;
  suspicious?: boolean;
  message?: string;
  linkedAccounts?: number;
  riskScore?: number;
}

interface UseDeviceFingerprintOptions {
  /** Whether to track automatically on mount */
  auto?: boolean;
  /** Callback when fingerprint is tracked */
  onTrack?: (result: DeviceFingerprintResult) => void;
  /** Callback when suspicious activity is detected */
  onSuspicious?: (result: DeviceFingerprintResult) => void;
}

export function useDeviceFingerprint(options: UseDeviceFingerprintOptions = {}) {
  const { auto = true, onTrack, onSuspicious } = options;
  const [tracking, setTracking] = useState(false);
  const [result, setResult] = useState<DeviceFingerprintResult | null>(null);

  const track = async () => {
    if (tracking) return result;

    setTracking(true);
    try {
      const trackResult = await trackDeviceFingerprint();
      setResult(trackResult);

      if (onTrack) {
        onTrack(trackResult);
      }

      if (trackResult.suspicious && onSuspicious) {
        onSuspicious(trackResult);
      }

      return trackResult;
    } catch (error) {
      console.error('Error tracking device fingerprint:', error);
      const errorResult = {
        success: false,
        message: 'Failed to track device'
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setTracking(false);
    }
  };

  useEffect(() => {
    if (auto) {
      track();
    }
  }, [auto]);

  return {
    tracking,
    result,
    track,
    isSuspicious: result?.suspicious || false,
    riskScore: result?.riskScore || 0
  };
}

