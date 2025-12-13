/**
 * Device Fingerprinting Service (Client-Side)
 * 
 * This service generates unique device fingerprints to detect multi-accounting.
 * Uses FingerprintJS for accuracy, with ClientJS as fallback.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface DeviceFingerprintData {
  fingerprintId: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  language: string;
  userAgent: string;
  canvas?: string;
  webgl?: string;
  webglVendor?: string;
  webglRenderer?: string;
  gpuInfo?: string;
  fonts?: string[];
  confidence: number;
  // Enhanced device data (50+ properties)
  hardware?: {
    cpuCores?: number;
    deviceMemory?: number;
    maxTouchPoints?: number;
    hardwareConcurrency?: number;
    screenOrientation?: string;
    pixelRatio?: number;
    touchSupport?: boolean;
    battery?: {
      charging?: boolean;
      level?: number;
    };
  };
  media?: {
    audioFormats?: string[];
    videoFormats?: string[];
    mediaDevices?: number;
  };
  plugins?: string[];
  storage?: {
    localStorage?: boolean;
    sessionStorage?: boolean;
    indexedDB?: boolean;
    cookiesEnabled?: boolean;
  };
  features?: {
    webgl2?: boolean;
    webrtc?: boolean;
    geolocation?: boolean;
    notifications?: boolean;
    serviceWorker?: boolean;
    webAssembly?: boolean;
  };
}

let fpPromise: Promise<any> | null = null;

/**
 * Initialize FingerprintJS agent
 */
async function initFingerprint() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

/**
 * Get device type from user agent (improved mobile detection)
 */
function getDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  const ua = navigator.userAgent;
  
  // Check for tablets first (iPad, Android tablets, etc.)
  if (/(iPad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  }
  
  // Check for mobile devices (comprehensive list)
  if (/Mobile|iP(hone|od)|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini|Opera Mobi/i.test(ua)) {
    return 'mobile';
  }
  
  // Check for specific mobile browsers
  if (/SamsungBrowser|UCBrowser|MiuiBrowser/i.test(ua)) {
    // These are typically mobile browsers
    if (!/tablet/i.test(ua)) {
      return 'mobile';
    }
  }
  
  // Check for desktop OS
  if (/Windows NT|Macintosh|Mac OS X|Linux.*X11|CrOS/i.test(ua)) {
    return 'desktop';
  }
  
  // Fallback: Check screen size as hint
  if (typeof window !== 'undefined' && window.screen) {
    const screenWidth = window.screen.width;
    if (screenWidth < 768) {
      return 'mobile';
    } else if (screenWidth >= 768 && screenWidth < 1024) {
      return 'tablet';
    }
  }
  
  return 'unknown';
}

/**
 * Parse user agent to extract browser and OS info
 */
function parseUserAgent() {
  const ua = navigator.userAgent;
  
  // Detect browser (order matters! Check specific browsers before generic ones)
  let browser = 'Unknown';
  let browserVersion = 'Unknown';
  
  if (ua.includes('Edg/') || ua.includes('Edge/')) {
    // Microsoft Edge (Chromium-based)
    browser = 'Edge';
    browserVersion = ua.match(/Edg[e]?\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    // Opera
    browser = 'Opera';
    browserVersion = ua.match(/(?:OPR|Opera)\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Firefox/') && !ua.includes('Seamonkey')) {
    // Firefox
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg') && !ua.includes('OPR')) {
    // Chrome (check after Edge/Opera since they use Chrome engine)
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome') && !ua.includes('Edg')) {
    // Safari (only if not Chrome or Edge)
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Samsung')) {
    // Samsung Internet
    browser = 'Samsung Internet';
    browserVersion = ua.match(/SamsungBrowser\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('UCBrowser')) {
    // UC Browser
    browser = 'UC Browser';
    browserVersion = ua.match(/UCBrowser\/(\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('MSIE') || ua.includes('Trident/')) {
    // Internet Explorer (legacy)
    browser = 'Internet Explorer';
    browserVersion = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/)?.[1] || 'Unknown';
  }
  
  // Detect OS (improved mobile detection)
  let os = 'Unknown';
  let osVersion = 'Unknown';
  
  if (ua.includes('Android')) {
    // Android (check before Linux since Android uses Linux kernel)
    os = 'Android';
    osVersion = ua.match(/Android (\d+(?:\.\d+)?)/)?.[1] || 'Unknown';
  } else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    // iOS
    os = 'iOS';
    osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || 'Unknown';
  } else if (ua.includes('Windows NT')) {
    // Windows
    os = 'Windows';
    const versionMap: { [key: string]: string } = {
      '10.0': '10/11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
      '6.0': 'Vista',
      '5.1': 'XP'
    };
    const ntVersion = ua.match(/Windows NT (\d+\.\d+)/)?.[1];
    osVersion = ntVersion ? (versionMap[ntVersion] || ntVersion) : 'Unknown';
  } else if (ua.includes('Windows Phone')) {
    // Windows Phone
    os = 'Windows Phone';
    osVersion = ua.match(/Windows Phone (\d+\.\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Mac OS X')) {
    // macOS
    os = 'macOS';
    osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || 'Unknown';
  } else if (ua.includes('Linux')) {
    // Linux (desktop)
    os = 'Linux';
  } else if (ua.includes('CrOS')) {
    // Chrome OS
    os = 'Chrome OS';
    osVersion = ua.match(/CrOS [^ ]+ (\d+\.\d+)/)?.[1] || 'Unknown';
  }
  
  console.log(`🔍 Detected: ${browser} ${browserVersion} on ${os} ${osVersion}`);
  
  return { browser, browserVersion, os, osVersion };
}

/**
 * Generate canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'unavailable';
    
    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Chartvolt 🔐', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Chartvolt 🔐', 4, 17);
    
    return canvas.toDataURL();
  } catch (e) {
    return 'error';
  }
}

/**
 * Get WebGL fingerprint with GPU details
 */
function getWebGLFingerprint(): { fingerprint: string; vendor?: string; renderer?: string; gpuInfo?: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    if (!gl) return { fingerprint: 'unavailable' };
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return { fingerprint: 'unavailable' };
    
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    // Extract GPU model from renderer string
    let gpuInfo = renderer || 'Unknown GPU';
    // Clean up common patterns
    gpuInfo = gpuInfo.replace(/ANGLE \(([^)]+)\)/, '$1');
    gpuInfo = gpuInfo.replace(/Direct3D\d+/, '').trim();
    
    return {
      fingerprint: `${vendor}~${renderer}`,
      vendor,
      renderer,
      gpuInfo
    };
  } catch (e) {
    return { fingerprint: 'error' };
  }
}

/**
 * Get enhanced hardware information
 */
function getHardwareInfo() {
  const nav = navigator as any;
  
  return {
    cpuCores: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory || undefined,
    maxTouchPoints: nav.maxTouchPoints || 0,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    screenOrientation: screen.orientation?.type || undefined,
    pixelRatio: window.devicePixelRatio || 1,
    touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0,
  };
}

/**
 * Get battery information (if available)
 */
async function getBatteryInfo() {
  try {
    const nav = navigator as any;
    if ('getBattery' in nav) {
      const battery = await nav.getBattery();
      return {
        charging: battery.charging,
        level: Math.round(battery.level * 100)
      };
    }
  } catch (e) {
    // Battery API not available or blocked
  }
  return undefined;
}

/**
 * Get media capabilities
 */
function getMediaCapabilities() {
  const audioFormats: string[] = [];
  const videoFormats: string[] = [];
  
  const audio = document.createElement('audio');
  const video = document.createElement('video');
  
  // Check audio formats
  ['audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac'].forEach(format => {
    if (audio.canPlayType && audio.canPlayType(format)) {
      audioFormats.push(format.split('/')[1]);
    }
  });
  
  // Check video formats
  ['video/mp4', 'video/ogg', 'video/webm'].forEach(format => {
    if (video.canPlayType && video.canPlayType(format)) {
      videoFormats.push(format.split('/')[1]);
    }
  });
  
  return {
    audioFormats,
    videoFormats,
    mediaDevices: 0 // Will be set later if available
  };
}

/**
 * Get browser plugins
 */
function getPlugins(): string[] {
  try {
    const plugins: string[] = [];
    const nav = navigator as any;
    
    if (nav.plugins && nav.plugins.length > 0) {
      for (let i = 0; i < nav.plugins.length; i++) {
        plugins.push(nav.plugins[i].name);
      }
    }
    
    return plugins.slice(0, 10); // Limit to first 10 plugins
  } catch (e) {
    return [];
  }
}

/**
 * Get storage capabilities
 */
function getStorageInfo() {
  return {
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined',
    cookiesEnabled: navigator.cookieEnabled || false
  };
}

/**
 * Get browser features
 */
function getBrowserFeatures() {
  const win = window as any;
  
  return {
    webgl2: !!document.createElement('canvas').getContext('webgl2'),
    webrtc: !!(win.RTCPeerConnection || win.webkitRTCPeerConnection || win.mozRTCPeerConnection),
    geolocation: 'geolocation' in navigator,
    notifications: 'Notification' in window,
    serviceWorker: 'serviceWorker' in navigator,
    webAssembly: typeof WebAssembly !== 'undefined'
  };
}

/**
 * Get list of installed fonts (sample check)
 */
function getInstalledFonts(): string[] {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
    'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
    'Impact', 'Lucida Console'
  ];
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  const baseFontWidths: { [key: string]: number } = {};
  baseFonts.forEach(font => {
    ctx.font = `72px ${font}`;
    baseFontWidths[font] = ctx.measureText('mmmmmmmmmmlli').width;
  });
  
  const detectedFonts: string[] = [];
  
  testFonts.forEach(font => {
    let detected = false;
    baseFonts.forEach(baseFont => {
      ctx.font = `72px ${font}, ${baseFont}`;
      const width = ctx.measureText('mmmmmmmmmmlli').width;
      if (width !== baseFontWidths[baseFont]) {
        detected = true;
      }
    });
    if (detected) {
      detectedFonts.push(font);
    }
  });
  
  return detectedFonts;
}

/**
 * Generate device fingerprint with 50+ data points
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprintData> {
  try {
    // Try FingerprintJS first (most accurate)
    const fp = await initFingerprint();
    const result = await fp.get();
    
    const { browser, browserVersion, os, osVersion } = parseUserAgent();
    const webglData = getWebGLFingerprint();
    const hardwareInfo = getHardwareInfo();
    const batteryInfo = await getBatteryInfo();
    const mediaInfo = getMediaCapabilities();
    const plugins = getPlugins();
    const storage = getStorageInfo();
    const features = getBrowserFeatures();
    
    const fingerprintData = {
      fingerprintId: result.visitorId,
      deviceType: getDeviceType(),
      browser,
      browserVersion,
      os,
      osVersion,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      userAgent: navigator.userAgent, // ✅ ADDED!
      canvas: getCanvasFingerprint(),
      webgl: webglData.fingerprint,
      webglVendor: webglData.vendor,
      webglRenderer: webglData.renderer,
      gpuInfo: webglData.gpuInfo,
      fonts: getInstalledFonts(),
      confidence: result.confidence.score,
      hardware: {
        ...hardwareInfo,
        battery: batteryInfo
      },
      media: mediaInfo,
      plugins,
      storage,
      features
    };

    console.log('🔍 Generated enhanced fingerprint with 50+ data points:', {
      fingerprintId: fingerprintData.fingerprintId,
      browser: fingerprintData.browser,
      browserVersion: fingerprintData.browserVersion,
      os: fingerprintData.os,
      osVersion: fingerprintData.osVersion,
      colorDepth: fingerprintData.colorDepth,
      userAgent: fingerprintData.userAgent ? 'present' : 'MISSING',
      gpuInfo: webglData.gpuInfo,
      cpuCores: hardwareInfo.cpuCores,
      deviceMemory: hardwareInfo.deviceMemory
    });
    
    return fingerprintData;
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    
    // Fallback: Create basic fingerprint from available data
    const { browser, browserVersion, os, osVersion } = parseUserAgent();
    const webglData = getWebGLFingerprint();
    const hardwareInfo = getHardwareInfo();
    
    const basicFingerprint = [
      navigator.userAgent,
      screen.width,
      screen.height,
      screen.colorDepth,
      navigator.language,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage
    ].join('|');
    
    // Create simple hash
    let hash = 0;
    for (let i = 0; i < basicFingerprint.length; i++) {
      const char = basicFingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return {
      fingerprintId: `fallback_${Math.abs(hash).toString(36)}`,
      deviceType: getDeviceType(),
      browser,
      browserVersion,
      os,
      osVersion,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      userAgent: navigator.userAgent,
      webgl: webglData.fingerprint,
      gpuInfo: webglData.gpuInfo,
      confidence: 0.5, // Lower confidence for fallback method
      hardware: hardwareInfo,
      storage: getStorageInfo(),
      features: getBrowserFeatures()
    };
  }
}

/**
 * Send fingerprint to server for tracking
 */
export async function trackDeviceFingerprint(): Promise<{ success: boolean; suspicious?: boolean; message?: string }> {
  try {
    const fingerprint = await generateDeviceFingerprint();
    
    console.log('📤 Sending fingerprint to API:', {
      fingerprintId: fingerprint.fingerprintId,
      browser: fingerprint.browser,
      browserVersion: fingerprint.browserVersion,
      os: fingerprint.os,
      osVersion: fingerprint.osVersion,
      colorDepth: fingerprint.colorDepth,
      userAgent: fingerprint.userAgent ? `${fingerprint.userAgent.substring(0, 50)}...` : 'MISSING',
      screenResolution: fingerprint.screenResolution,
      timezone: fingerprint.timezone,
      language: fingerprint.language
    });
    
    const response = await fetch('/api/fraud/track-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fingerprint)
    });
    
    if (!response.ok) {
      throw new Error('Failed to track device');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error tracking device fingerprint:', error);
    return { success: false, message: 'Failed to track device' };
  }
}

