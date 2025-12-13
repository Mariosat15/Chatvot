'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield, Users, TrendingUp, CreditCard, Eye, CheckCircle, 
  XCircle, AlertTriangle, Activity, Zap, Clock, Target, Monitor
} from 'lucide-react';

interface DetectionMethod {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  confidence: number; // 0-100
  status: 'active' | 'inactive' | 'coming_soon';
  weight: number; // How much this method contributes to overall score
  detailsText: string;
  detectedCount?: number;
  totalChecked?: number;
}

interface FraudConfidenceBreakdownProps {
  alertId?: string;
  suspiciousUserIds?: string[];
  evidence?: any[];
}

export default function FraudConfidenceBreakdown({ 
  alertId, 
  suspiciousUserIds = [],
  evidence = []
}: FraudConfidenceBreakdownProps) {
  const [selectedMethod, setSelectedMethod] = useState<DetectionMethod | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Debug logging
  console.log('🔍 [CONFIDENCE] Alert ID:', alertId);
  console.log('🔍 [CONFIDENCE] Suspicious User IDs:', suspiciousUserIds);
  console.log('🔍 [CONFIDENCE] Evidence:', evidence);

  // Calculate detection methods and their confidence scores
  const deviceConfidence = calculateDeviceFingerprintConfidence(evidence);
  const ipConfidence = calculateIPTrackingConfidence(evidence);
  const ipMatchCount = countIPMatches(evidence);
  
  const detectionMethods: DetectionMethod[] = [
    {
      id: 'device_fingerprint',
      name: 'Device Fingerprinting',
      description: 'Multiple accounts from same device',
      icon: <Shield className="h-5 w-5" />,
      confidence: deviceConfidence,
      status: deviceConfidence > 0 ? 'active' : 'inactive',
      weight: 35,
      detailsText: 'Uses 50+ device characteristics including GPU fingerprint, canvas fingerprint, WebGL, screen resolution, timezone, and browser details to identify unique devices. When multiple accounts use the same device, it indicates potential multi-accounting.',
      detectedCount: deviceConfidence > 0 ? suspiciousUserIds.length : 0,
      totalChecked: suspiciousUserIds.length
    },
    {
      id: 'ip_tracking',
      name: 'IP Address Tracking',
      description: 'Same IP + same browser detection',
      icon: <Activity className="h-5 w-5" />,
      confidence: ipConfidence,
      status: ipConfidence > 0 ? 'active' : 'inactive',
      weight: 25,
      detailsText: 'Tracks IP addresses combined with browser fingerprints. Detects when multiple accounts access from the same IP using the same browser, which is a strong indicator of multi-accounting. Includes VPN/Proxy/Tor detection.',
      detectedCount: ipMatchCount > 0 ? ipMatchCount : (ipConfidence > 0 ? suspiciousUserIds.length : 0),
      totalChecked: suspiciousUserIds.length
    },
    {
      id: 'mirror_trades',
      name: 'Mirror Trade Detection',
      description: 'Identical trading patterns',
      icon: <TrendingUp className="h-5 w-5" />,
      confidence: 0, // Not yet implemented
      status: 'coming_soon',
      weight: 20,
      detailsText: 'Analyzes trading patterns to detect accounts that execute identical or nearly identical trades. This includes same entry/exit points, position sizes, and timing. Mirror trading is a common fraud technique where users hedge positions across multiple accounts.',
      detectedCount: 0,
      totalChecked: 0
    },
    {
      id: 'payment_tracking',
      name: 'Payment Method Tracking',
      description: 'Same payment fingerprints',
      icon: <CreditCard className="h-5 w-5" />,
      confidence: 0, // Not yet implemented
      status: 'coming_soon',
      weight: 15,
      detailsText: 'Tracks payment method fingerprints including card BIN numbers, billing addresses, and payment device IDs. Multiple accounts using the same payment method or device are flagged. Works with Stripe Radar and other payment provider fraud detection.',
      detectedCount: 0,
      totalChecked: 0
    },
    {
      id: 'behavioral_analysis',
      name: 'Behavioral Analysis',
      description: 'Mouse, typing, and usage patterns',
      icon: <Target className="h-5 w-5" />,
      confidence: 0, // Not yet implemented
      status: 'coming_soon',
      weight: 5,
      detailsText: 'Analyzes user behavior including mouse movement patterns, typing speed and rhythm, navigation patterns, and time-of-day activity. Each user has unique behavioral biometrics that can help identify when the same person operates multiple accounts.',
      detectedCount: 0,
      totalChecked: 0
    }
  ];

  // Calculate overall confidence score (weighted average of active methods)
  const calculateOverallConfidence = () => {
    const activeMethods = detectionMethods.filter(m => m.status === 'active');
    const totalWeight = activeMethods.reduce((sum, m) => sum + m.weight, 0);
    
    if (totalWeight === 0) return 0;
    
    const weightedSum = activeMethods.reduce((sum, m) => sum + (m.confidence * m.weight), 0);
    return Math.round(weightedSum / totalWeight);
  };

  const overallConfidence = calculateOverallConfidence();

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-red-500';
    if (confidence >= 60) return 'text-orange-500';
    if (confidence >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getConfidenceGradient = (confidence: number) => {
    if (confidence >= 80) return 'from-red-500/20 to-red-600/5 border-red-500/30';
    if (confidence >= 60) return 'from-orange-500/20 to-orange-600/5 border-orange-500/30';
    if (confidence >= 40) return 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30';
    return 'from-green-500/20 to-green-600/5 border-green-500/30';
  };

  const handleShowDetails = (method: DetectionMethod) => {
    setSelectedMethod(method);
    setDetailsDialogOpen(true);
  };

  return (
    <>
      <Card className={`bg-gradient-to-br ${getConfidenceGradient(overallConfidence)} overflow-hidden`}>
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Fraud Detection Confidence
          </CardTitle>
          <CardDescription className="text-gray-400">
            AI-powered multi-layered fraud detection system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Circular Confidence Score */}
            <div className="lg:col-span-3 flex items-center justify-center">
              <div className="relative">
                {/* Circular Progress */}
                <svg className="transform -rotate-90 w-36 h-36">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-700"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (1 - overallConfidence / 100)}`}
                    className={`${getConfidenceColor(overallConfidence)} transition-all duration-1000 ease-out`}
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`text-4xl font-bold ${getConfidenceColor(overallConfidence)}`}>
                    {overallConfidence}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">CONFIDENCE</div>
                </div>
              </div>
            </div>

            {/* Right: Detection Methods List */}
            <div className="lg:col-span-9 space-y-3">
              {detectionMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg bg-gray-900/50 border border-gray-700/50 hover:border-gray-600/50 transition-all"
                >
                  {/* Method Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      method.status === 'active' 
                        ? 'bg-blue-500/10 text-blue-400' 
                        : 'bg-gray-700/50 text-gray-500'
                    }`}>
                      {method.icon}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-100">
                          {method.name}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            method.status === 'active' 
                              ? 'border-green-500/30 text-green-400'
                              : method.status === 'inactive'
                              ? 'border-gray-500/30 text-gray-500'
                              : 'border-yellow-500/30 text-yellow-400'
                          }`}
                        >
                          {method.status === 'active' ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                          ) : method.status === 'inactive' ? (
                            <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                          ) : (
                            <><Clock className="h-3 w-3 mr-1" /> Coming Soon</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400">{method.description}</p>
                      {method.status === 'active' && method.detectedCount !== undefined && (
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-gray-500">
                            Weight: <strong className="text-gray-300">{method.weight}%</strong>
                          </span>
                          <span className="text-gray-500">
                            Detected: <strong className="text-gray-300">{method.detectedCount}/{method.totalChecked}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confidence Score */}
                  <div className="flex items-center gap-4">
                    {method.status === 'active' && (
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getConfidenceColor(method.confidence)}`}>
                          {method.confidence}%
                        </div>
                        <div className="text-xs text-gray-500">confidence</div>
                      </div>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShowDetails(method)}
                      className="border-gray-600 hover:bg-gray-700"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              ))}

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-700/50">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {suspiciousUserIds.length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Suspicious Accounts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {detectionMethods.filter(m => m.status === 'active').length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Active Methods</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {detectionMethods.filter(m => m.status === 'coming_soon').length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Coming Soon</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getConfidenceColor(overallConfidence)}`}>
                    {overallConfidence >= 70 ? 'HIGH' : overallConfidence >= 40 ? 'MEDIUM' : 'LOW'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Risk Level</div>
                </div>
              </div>

              {/* Investigation Accounts List */}
              {suspiciousUserIds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-400" />
                    Accounts in This Investigation
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {suspiciousUserIds.map((userId, idx) => (
                      <span 
                        key={userId} 
                        className="text-xs font-mono bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700"
                      >
                        #{idx + 1}: {userId.substring(0, 12)}...
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

       {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="!max-w-none !w-[90vw] !h-[90vh] !p-6 bg-gray-800 border-gray-700 text-gray-100 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {selectedMethod?.icon}
              {selectedMethod?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedMethod?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-4">
              <Badge 
                variant="outline" 
                className={`${
                  selectedMethod?.status === 'active' 
                    ? 'border-green-500/30 text-green-400'
                    : selectedMethod?.status === 'inactive'
                    ? 'border-gray-500/30 text-gray-500'
                    : 'border-yellow-500/30 text-yellow-400'
                }`}
              >
                {selectedMethod?.status === 'active' ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Active & Running</>
                ) : selectedMethod?.status === 'inactive' ? (
                  <><XCircle className="h-3 w-3 mr-1" /> Currently Inactive</>
                ) : (
                  <><Clock className="h-3 w-3 mr-1" /> In Development</>
                )}
              </Badge>
              
              {selectedMethod?.status === 'active' && (
                <div className={`text-3xl font-bold ${getConfidenceColor(selectedMethod?.confidence || 0)}`}>
                  {selectedMethod?.confidence}% Confidence
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-400" />
                How It Works
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                {selectedMethod?.detailsText}
              </p>
            </div>

            {/* Device Fingerprint Data (if available) */}
            {selectedMethod?.id === 'device_fingerprint' && selectedMethod?.status === 'active' && (
              <DeviceFingerprintDetails evidence={evidence} suspiciousUserIds={suspiciousUserIds} />
            )}

            {/* IP Tracking Data (if available) */}
            {selectedMethod?.id === 'ip_tracking' && selectedMethod?.status === 'active' && (
              <IPTrackingDetails evidence={evidence} suspiciousUserIds={suspiciousUserIds} />
            )}

            {/* Stats (if active) */}
            {selectedMethod?.status === 'active' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {selectedMethod?.weight}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Weight in Score</div>
                </div>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {selectedMethod?.detectedCount}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Matches Found</div>
                </div>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-300">
                    {selectedMethod?.totalChecked}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Accounts Checked</div>
                </div>
              </div>
            )}

            {/* Coming Soon Info */}
            {selectedMethod?.status === 'coming_soon' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-400 mb-1">
                      Upcoming Enhancement
                    </h4>
                    <p className="text-xs text-yellow-300/80">
                      This detection method is currently in development and will be added in a future update. 
                      When activated, it will contribute <strong>{selectedMethod?.weight}%</strong> to the overall confidence score.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Component to display detailed device fingerprint data
function DeviceFingerprintDetails({ evidence, suspiciousUserIds }: { evidence: any[], suspiciousUserIds: string[] }) {
  const deviceEvidence = evidence.find(e => 
    e.type === 'device_fingerprint' || 
    e.type === 'fingerprint_match' ||
    e.description?.toLowerCase().includes('device') ||
    e.description?.toLowerCase().includes('fingerprint')
  );

  if (!deviceEvidence || !deviceEvidence.data) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-400">No detailed fingerprint data available for this investigation.</p>
      </div>
    );
  }

  const { accountsDetails } = deviceEvidence.data;

  if (!accountsDetails || accountsDetails.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-400">No account details available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
        <Shield className="h-5 w-5 text-blue-400" />
        Device Fingerprint Data (50+ Characteristics)
      </h4>

      {accountsDetails.map((account: any, idx: number) => {
        const userId = account.userId;
        const devices = account.devicesUsed || [];

        return (
          <div key={userId} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                Account #{idx + 1}
              </Badge>
              <span className="text-xs font-mono text-gray-400">{userId}</span>
              <Badge variant="outline" className="ml-auto border-purple-500/30 text-purple-400">
                {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}
              </Badge>
            </div>

            {devices.map((device: any, deviceIdx: number) => (
              <div key={deviceIdx} className="mb-6 last:mb-0">
                {devices.length > 1 && (
                  <h5 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-purple-400" />
                    Device {deviceIdx + 1}
                  </h5>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Core Identification */}
                  <div className="col-span-full">
                    <h6 className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wide">
                      Core Identification
                    </h6>
                  </div>

                  <DataField label="Fingerprint ID" value={device.fingerprintId} mono />
                  <DataField label="Browser" value={`${device.browser || 'N/A'}`} />
                  <DataField label="Browser Version" value={device.browserVersion || 'N/A'} />
                  <DataField label="Operating System" value={device.os || 'N/A'} />
                  <DataField label="OS Version" value={device.osVersion || 'N/A'} />
                  <DataField label="Device Type" value={device.deviceType || 'N/A'} />

                  {/* Screen & Display */}
                  <div className="col-span-full mt-2">
                    <h6 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wide">
                      Screen & Display
                    </h6>
                  </div>

                  <DataField label="Screen Resolution" value={device.screenResolution || 'N/A'} />
                  <DataField label="Color Depth" value={device.colorDepth ? `${device.colorDepth} bit` : 'N/A'} />
                  <DataField label="Timezone" value={device.timezone || 'N/A'} />
                  <DataField label="Language" value={device.language || 'N/A'} />

                  {/* Network */}
                  <div className="col-span-full mt-2">
                    <h6 className="text-xs font-semibold text-yellow-400 mb-2 uppercase tracking-wide">
                      Network
                    </h6>
                  </div>

                  <DataField label="IP Address" value={device.ipAddress || 'N/A'} />
                  <DataField label="User Agent" value={device.userAgent || 'N/A'} mono truncate />

                  {/* Graphics & Hardware */}
                  <div className="col-span-full mt-2">
                    <h6 className="text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wide">
                      Graphics & Hardware
                    </h6>
                  </div>

                  <DataField 
                    label="GPU (WebGL)" 
                    value={device.webgl || 'N/A'} 
                    className="col-span-2"
                  />
                  <DataField label="WebGL Vendor" value={device.webglVendor || 'N/A'} />
                  <DataField label="WebGL Renderer" value={device.webglRenderer || 'N/A'} className="col-span-2" />
                  <DataField label="GPU Info" value={device.gpuInfo || 'N/A'} className="col-span-full" />
                  <DataField 
                    label="Canvas Fingerprint" 
                    value={device.canvas ? `${device.canvas.substring(0, 50)}...` : 'N/A'} 
                    mono 
                    className="col-span-full"
                  />

                  {/* Enhanced Hardware Details (from hardware object) */}
                  {device.hardware && (
                    <>
                      <DataField label="CPU Cores" value={device.hardware.cpuCores?.toString() || 'N/A'} />
                      <DataField label="Device Memory" value={device.hardware.deviceMemory ? `${device.hardware.deviceMemory} GB` : 'N/A'} />
                      <DataField label="Max Touch Points" value={device.hardware.maxTouchPoints?.toString() || 'N/A'} />
                      <DataField label="Hardware Concurrency" value={device.hardware.hardwareConcurrency?.toString() || 'N/A'} />
                      <DataField label="Screen Orientation" value={device.hardware.screenOrientation || 'N/A'} />
                      <DataField label="Pixel Ratio" value={device.hardware.pixelRatio?.toString() || 'N/A'} />
                      <DataField label="Touch Support" value={device.hardware.touchSupport ? 'Yes' : 'No'} />
                      {device.hardware.battery && (
                        <>
                          <DataField label="Battery Charging" value={device.hardware.battery.charging ? 'Yes' : 'No'} />
                          <DataField label="Battery Level" value={device.hardware.battery.level ? `${device.hardware.battery.level}%` : 'N/A'} />
                        </>
                      )}
                    </>
                  )}

                  {/* Media Capabilities */}
                  {device.media && (
                    <>
                      <div className="col-span-full mt-2">
                        <h6 className="text-xs font-semibold text-pink-400 mb-2 uppercase tracking-wide">
                          Media Capabilities
                        </h6>
                      </div>
                      <DataField 
                        label="Audio Formats" 
                        value={device.media.audioFormats?.join(', ') || 'N/A'} 
                        className="col-span-2"
                      />
                      <DataField 
                        label="Video Formats" 
                        value={device.media.videoFormats?.join(', ') || 'N/A'} 
                        className="col-span-2"
                      />
                      <DataField label="Media Devices" value={device.media.mediaDevices?.toString() || 'N/A'} />
                    </>
                  )}

                  {/* Browser Plugins */}
                  {device.plugins && device.plugins.length > 0 && (
                    <>
                      <div className="col-span-full mt-2">
                        <h6 className="text-xs font-semibold text-cyan-400 mb-2 uppercase tracking-wide">
                          Browser Plugins ({device.plugins.length})
                        </h6>
                      </div>
                      <DataField 
                        label="Installed Plugins" 
                        value={device.plugins.join(', ')} 
                        className="col-span-full"
                      />
                    </>
                  )}

                  {/* Installed Fonts */}
                  {device.fonts && device.fonts.length > 0 && (
                    <>
                      <div className="col-span-full mt-2">
                        <h6 className="text-xs font-semibold text-indigo-400 mb-2 uppercase tracking-wide">
                          Installed Fonts ({device.fonts.length})
                        </h6>
                      </div>
                      <DataField 
                        label="Detected Fonts" 
                        value={device.fonts.join(', ')} 
                        className="col-span-full"
                      />
                    </>
                  )}

                  {/* Storage Capabilities */}
                  {device.storage && (
                    <>
                      <div className="col-span-full mt-2">
                        <h6 className="text-xs font-semibold text-teal-400 mb-2 uppercase tracking-wide">
                          Storage Capabilities
                        </h6>
                      </div>
                      <DataField label="Local Storage" value={device.storage.localStorage ? 'Available' : 'Not Available'} />
                      <DataField label="Session Storage" value={device.storage.sessionStorage ? 'Available' : 'Not Available'} />
                      <DataField label="IndexedDB" value={device.storage.indexedDB ? 'Available' : 'Not Available'} />
                      <DataField label="Cookies Enabled" value={device.storage.cookiesEnabled ? 'Yes' : 'No'} />
                    </>
                  )}

                  {/* Browser Features */}
                  {device.features && (
                    <>
                      <div className="col-span-full mt-2">
                        <h6 className="text-xs font-semibold text-lime-400 mb-2 uppercase tracking-wide">
                          Browser Features
                        </h6>
                      </div>
                      <DataField label="WebGL 2.0" value={device.features.webgl2 ? 'Supported' : 'Not Supported'} />
                      <DataField label="WebRTC" value={device.features.webrtc ? 'Supported' : 'Not Supported'} />
                      <DataField label="Geolocation API" value={device.features.geolocation ? 'Supported' : 'Not Supported'} />
                      <DataField label="Notifications API" value={device.features.notifications ? 'Supported' : 'Not Supported'} />
                      <DataField label="Service Worker" value={device.features.serviceWorker ? 'Supported' : 'Not Supported'} />
                      <DataField label="WebAssembly" value={device.features.webAssembly ? 'Supported' : 'Not Supported'} />
                    </>
                  )}

                  {/* Detection Confidence */}
                  {device.confidence !== undefined && (
                    <>
                      <div className="col-span-full mt-2">
                        <h6 className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wide">
                          Detection Quality
                        </h6>
                      </div>
                      <DataField 
                        label="FingerprintJS Confidence" 
                        value={`${(device.confidence * 100).toFixed(1)}%`} 
                      />
                    </>
                  )}

                  {/* Usage Stats */}
                  <div className="col-span-full mt-2">
                    <h6 className="text-xs font-semibold text-orange-400 mb-2 uppercase tracking-wide">
                      Usage Statistics
                    </h6>
                  </div>

                  <DataField label="Times Used" value={device.timesUsed?.toString() || '0'} />
                  <DataField 
                    label="First Seen" 
                    value={device.firstSeen ? new Date(device.firstSeen).toLocaleString() : 'N/A'} 
                  />
                  <DataField 
                    label="Last Seen" 
                    value={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'N/A'} 
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Component to display IP tracking data
function IPTrackingDetails({ evidence, suspiciousUserIds }: { evidence: any[], suspiciousUserIds: string[] }) {
  const ipEvidence = evidence.find(e => 
    e.type === 'same_ip' || 
    e.type === 'ip_match' ||
    e.type === 'same_ip_browser' ||
    e.description?.toLowerCase().includes('ip')
  );

  if (!ipEvidence || !ipEvidence.data) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-400">No detailed IP tracking data available for this investigation.</p>
      </div>
    );
  }

  const { accountsDetails } = ipEvidence.data;

  if (!accountsDetails || accountsDetails.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-400">No IP tracking details available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
        <Activity className="h-5 w-5 text-blue-400" />
        IP Tracking Data
      </h4>

      {accountsDetails.map((account: any, idx: number) => {
        const userId = account.userId;
        const devices = account.devicesUsed || [];

        // Group devices by IP
        const ipGroups = devices.reduce((groups: any, device: any) => {
          const ip = device.ipAddress || 'Unknown';
          if (!groups[ip]) groups[ip] = [];
          groups[ip].push(device);
          return groups;
        }, {});

        return (
          <div key={userId} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                Account #{idx + 1}
              </Badge>
              <span className="text-xs font-mono text-gray-400">{userId}</span>
              <Badge variant="outline" className="ml-auto border-orange-500/30 text-orange-400">
                {Object.keys(ipGroups).length} IP {Object.keys(ipGroups).length === 1 ? 'Address' : 'Addresses'}
              </Badge>
            </div>

            {Object.entries(ipGroups).map(([ip, ipDevices]: [string, any]) => (
              <div key={ip} className="mb-4 last:mb-0 bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-semibold text-gray-200">IP Address: {ip}</span>
                  <Badge variant="outline" className="ml-auto border-purple-500/30 text-purple-400 text-xs">
                    {ipDevices.length} {ipDevices.length === 1 ? 'Browser' : 'Browsers'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {ipDevices.map((device: any, deviceIdx: number) => (
                    <div key={deviceIdx} className="bg-gray-900 rounded p-3 border border-gray-700/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Browser:</span>
                          <span className="ml-2 text-gray-200 font-semibold">{device.browser || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">OS:</span>
                          <span className="ml-2 text-gray-200">{device.os || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Times Used:</span>
                          <span className="ml-2 text-gray-200">{device.timesUsed || 0}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Seen:</span>
                          <span className="ml-2 text-gray-200">
                            {device.lastSeen ? new Date(device.lastSeen).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Helper component for displaying data fields
function DataField({ 
  label, 
  value, 
  mono = false, 
  truncate = false,
  className = ''
}: { 
  label: string; 
  value: string; 
  mono?: boolean;
  truncate?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm text-gray-200 ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}>
        {value}
      </div>
    </div>
  );
}

// Helper functions to calculate confidence scores
function calculateDeviceFingerprintConfidence(evidence: any[]): number {
  if (!evidence || evidence.length === 0) return 0;
  
  // Look for device fingerprint evidence
  const deviceEvidence = evidence.find(e => 
    e.type === 'device_fingerprint' || 
    e.type === 'fingerprint_match' ||
    e.description?.toLowerCase().includes('device') ||
    e.description?.toLowerCase().includes('fingerprint')
  );
  
  if (!deviceEvidence) return 0; // No evidence = 0%
  
  // Check if we have device match data
  const data = deviceEvidence.data || {};
  
  // If we have specific account details, calculate based on that
  if (data.accountsDetails) {
    const accounts = data.accountsDetails;
    const accountCount = accounts.length;
    
    // Multiple accounts sharing same device = high confidence
    if (accountCount >= 3) return 95;
    if (accountCount === 2) return 85;
    return 70;
  }
  
  // Alternative: Check for matched devices
  const matchedDevices = data.matchedDevices || 0;
  const totalDevices = data.totalDevices || 1;
  
  if (matchedDevices > 0) {
    const matchPercentage = (matchedDevices / totalDevices) * 100;
    if (matchPercentage >= 80) return 95;
    if (matchPercentage >= 60) return 85;
    if (matchPercentage >= 40) return 75;
    return 70;
  }
  
  // If device fingerprint evidence exists but no specific data, give medium confidence
  return 75;
}

function calculateIPTrackingConfidence(evidence: any[]): number {
  if (!evidence || evidence.length === 0) return 0;
  
  // Look for IP tracking evidence
  const ipEvidence = evidence.find(e => 
    e.type === 'same_ip' || 
    e.type === 'ip_match' ||
    e.type === 'same_ip_browser' ||
    e.description?.toLowerCase().includes('ip') ||
    e.description?.toLowerCase().includes('browser')
  );
  
  if (!ipEvidence) return 0; // No evidence = 0%
  
  const data = ipEvidence.data || {};
  
  // Check for same IP + same browser (highest confidence)
  if (ipEvidence.type === 'same_ip_browser') {
    return 90;
  }
  
  // Check data properties
  const sameBrowser = data.sameBrowser || false;
  const sameIP = data.sameIP || false;
  
  // Multiple indicators
  if (sameIP && sameBrowser) return 90;
  if (sameIP) return 70;
  
  // If IP evidence exists but no specific data
  return 65;
}

function countIPMatches(evidence: any[]): number {
  if (!evidence || evidence.length === 0) return 0;
  
  const ipEvidence = evidence.find(e => 
    e.type === 'same_ip' || 
    e.type === 'ip_match' ||
    e.type === 'same_ip_browser' ||
    e.description?.toLowerCase().includes('ip')
  );
  
  if (!ipEvidence) return 0;
  
  const data = ipEvidence.data || {};
  
  // Try different data structures
  if (data.accountsDetails) return data.accountsDetails.length;
  if (data.matchedAccounts) return data.matchedAccounts;
  if (data.accounts) return data.accounts.length;
  
  return 0;
}

