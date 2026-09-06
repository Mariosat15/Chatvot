import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import DeviceFingerprint from "@/database/models/fraud/device-fingerprint.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import UserRestriction from "@/database/models/user-restriction.model";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import {
  detectVPNProxy,
  // isHighRiskIP is imported for potential future use in IP risk detection
  isHighRiskIP as _isHighRiskIP,
} from "@/lib/services/ip-detection.service";
import { getFraudSettings } from "@/lib/services/fraud-settings.service";
import { SuspicionScoringService } from "@/lib/services/fraud/suspicion-scoring.service";
import { AlertManagerService } from "@/lib/services/fraud/alert-manager.service";

/**
 * Check if accounts are already restricted (banned/suspended)
 * Returns object with:
 * - shouldSuppress: true if alerts should be completely suppressed (restricted users)
 * - hasActiveAlert: true if there's an existing alert we should merge into
 *
 * @param triggeringUserId - The user who triggered the detection (the NEW user)
 * @param allLinkedUserIds - All users linked to this detection
 *
 * Reason: We only suppress if the TRIGGERING user is restricted. If old linked users
 * are restricted but the triggering user is new and unrestricted, we MUST still create
 * an alert — otherwise new fraudulent accounts linked to banned users slip through.
 */
async function checkAlertStatus(
  triggeringUserId: string,
  allLinkedUserIds: string[],
): Promise<{
  shouldSuppress: boolean;
  hasActiveAlert: boolean;
  existingAlertStatus?: string;
}> {
  // Only suppress if the TRIGGERING user themselves is restricted
  const triggeringUserRestriction = await UserRestriction.findOne({
    userId: triggeringUserId,
    isActive: true,
  });

  if (triggeringUserRestriction) {
    return { shouldSuppress: true, hasActiveAlert: false };
  }

  // Check if any of these users already have active alerts (pending or investigating)
  // We DON'T suppress these - we MERGE new evidence into them via AlertManagerService
  const existingAlerts = await FraudAlert.findOne({
    $or: [
      { suspiciousUserIds: { $in: allLinkedUserIds } },
      { primaryUserId: { $in: allLinkedUserIds } },
    ],
    status: { $in: ["pending", "investigating"] },
  });

  if (existingAlerts) {
    return {
      shouldSuppress: false,
      hasActiveAlert: true,
      existingAlertStatus: existingAlerts.status,
    };
  }

  return { shouldSuppress: false, hasActiveAlert: false };
}

/**
 * Create (or merge) a VPN / Proxy / Tor / high-risk-IP alert for a user.
 *
 * Reason: this runs on EVERY tracked request — not only when a brand-new device
 * is registered — so a returning user who switches on a VPN is still flagged.
 * AlertManagerService merges into any existing alert, so repeat logins don't
 * spam duplicates. No-ops for clean IPs and for already-restricted users.
 */
async function maybeCreateVpnAlert(params: {
  userId: string;
  ipAddress: string;
  ipRiskScore: number;
  ipDetection: {
    isVPN: boolean;
    isProxy: boolean;
    isTor: boolean;
    isHosting: boolean;
    country?: string;
    city?: string;
    isp?: string;
    org?: string;
    asn?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fraudSettings: any;
}): Promise<void> {
  const { userId, ipAddress, ipRiskScore, ipDetection, fraudSettings } = params;
  const { isVPN, isProxy, isTor } = ipDetection;

  if (
    !fraudSettings.vpnDetectionEnabled ||
    !(isTor || isVPN || isProxy || ipRiskScore >= fraudSettings.alertThreshold)
  ) {
    return;
  }

  let alertType: "vpn_usage" | "high_risk_device" = "vpn_usage";
  let severity: "medium" | "high" | "critical" = "medium";
  let title = "VPN/Proxy Usage Detected";
  let description = "";

  if (isTor) {
    severity = "critical";
    title = "Tor Network Detected";
    description = `User ${userId} is connecting through Tor network`;
  } else if (isVPN) {
    severity = "high";
    title = "VPN Usage Detected";
    description = `User ${userId} is connecting through a VPN (${ipDetection.isp})`;
  } else if (isProxy) {
    severity = "high";
    title = "Proxy Server Detected";
    description = `User ${userId} is connecting through a proxy (${ipDetection.isp})`;
  } else {
    severity = "medium";
    alertType = "high_risk_device";
    title = "High-Risk IP Detected";
    description = `User ${userId} is connecting from a suspicious IP (Risk: ${ipRiskScore}%)`;
  }

  // Suppress only when the triggering user is already restricted.
  const alertStatus = await checkAlertStatus(userId, [userId]);
  if (alertStatus.shouldSuppress) return;

  await AlertManagerService.createOrUpdateAlert({
    alertType,
    userIds: [userId],
    title,
    description,
    severity,
    confidence: ipRiskScore / 100,
    evidence: [
      {
        type: "ip_detection",
        description: "IP Analysis Results",
        data: {
          ip: ipAddress,
          country: ipDetection.country,
          city: ipDetection.city,
          isp: ipDetection.isp,
          org: ipDetection.org,
          asn: ipDetection.asn,
          isVPN,
          isProxy,
          isTor,
          isHosting: ipDetection.isHosting,
          riskScore: ipRiskScore,
        },
      },
    ],
  });
}

/**
 * POST /api/fraud/track-device
 * Track device fingerprint and detect multi-accounting
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    // Get user session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const fingerprintData = await request.json();

    // Get fraud settings
    const fraudSettings = await getFraudSettings();

    // Reason: whitelisted devices bypass all fraud tracking/alerting. The
    // `whitelistedFingerprints` setting existed but was never consulted — this
    // lets admins exempt known-good devices (e.g. office/test machines).
    if (
      fingerprintData?.fingerprintId &&
      Array.isArray(fraudSettings.whitelistedFingerprints) &&
      fraudSettings.whitelistedFingerprints.includes(
        fingerprintData.fingerprintId,
      )
    ) {
      return NextResponse.json({
        success: true,
        suspicious: false,
        message: "Whitelisted device",
      });
    }

    // Get IP address
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    const ipAddress = forwarded
      ? forwarded.split(",")[0]
      : headersList.get("x-real-ip") || "unknown";

    // Detect VPN/Proxy (if enabled)
    let ipDetection: {
      isVPN: boolean;
      isProxy: boolean;
      isTor: boolean;
      isHosting: boolean;
      riskScore: number;
      country?: string;
      city?: string;
      isp?: string;
      org?: string;
      asn?: string;
    } = {
      isVPN: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
      country: undefined,
      city: undefined,
      isp: undefined,
    };

    if (fraudSettings.vpnDetectionEnabled) {
      ipDetection = await detectVPNProxy(ipAddress);
    }

    const isVPN = ipDetection.isVPN;
    const isProxy = ipDetection.isProxy;
    const isTor = ipDetection.isTor;

    // Calculate IP risk score using settings
    let ipRiskScore = 0;
    if (fraudSettings.vpnDetectionEnabled) {
      if (isTor) ipRiskScore += fraudSettings.torRiskScore;
      else if (isVPN) ipRiskScore += fraudSettings.vpnRiskScore;
      else if (isProxy) ipRiskScore += fraudSettings.proxyRiskScore;
      else if (ipDetection.isHosting) ipRiskScore += 20;
    }

    // 🛡️ VPN/Proxy/Tor alerting — runs for EVERY tracked request (including
    // returning users on a known device), not only when a new device is first
    // seen. Independent of device fingerprinting being enabled.
    await maybeCreateVpnAlert({
      userId,
      ipAddress,
      ipRiskScore,
      ipDetection,
      fraudSettings,
    });

    // Check if device fingerprinting is enabled
    if (!fraudSettings.deviceFingerprintingEnabled) {
      return NextResponse.json({
        success: true,
        suspicious: false,
        message: "Device fingerprinting disabled",
      });
    }

    // Check if this fingerprint already exists FOR THIS USER FIRST
    // This ensures each user updates their OWN fingerprint, not a linked one
    const existingFingerprint = await DeviceFingerprint.findOne({
      fingerprintId: fingerprintData.fingerprintId,
      userId: userId,
    });

    // If no exact match for this user, check if ANY fingerprint exists (for fraud detection)
    let existingDeviceAnyUser = null;
    if (!existingFingerprint) {
      existingDeviceAnyUser = await DeviceFingerprint.findOne({
        fingerprintId: fingerprintData.fingerprintId,
      });
    }

    // If no exact match for this user, check for "similar" devices from OTHER users (AGGRESSIVE fuzzy matching)
    // This catches cases where FingerprintJS generates different IDs for same device
    // OR when users try to hide by switching browsers
    if (
      !existingFingerprint &&
      !existingDeviceAnyUser &&
      fraudSettings.multiAccountDetectionEnabled
    ) {
      // Try multiple matching strategies, from strictest to most aggressive

      // Strategy 1: Same browser + same hardware (original)
      existingDeviceAnyUser = await DeviceFingerprint.findOne({
        userId: { $ne: userId },
        browser: fingerprintData.browser,
        browserVersion: fingerprintData.browserVersion,
        os: fingerprintData.os,
        osVersion: fingerprintData.osVersion,
        screenResolution: fingerprintData.screenResolution,
        ...(fingerprintData.canvas && { canvas: fingerprintData.canvas }),
      });

      // Strategy 2: Same hardware (screen + OS + canvas) - IGNORES browser!
      // This catches users switching between Chrome, Edge, Firefox on same PC
      if (!existingDeviceAnyUser && fingerprintData.canvas) {
        existingDeviceAnyUser = await DeviceFingerprint.findOne({
          userId: { $ne: userId },
          os: fingerprintData.os,
          osVersion: fingerprintData.osVersion,
          screenResolution: fingerprintData.screenResolution,
          canvas: fingerprintData.canvas, // Canvas is unique per hardware
          timezone: fingerprintData.timezone,
        });

        if (existingDeviceAnyUser) {
          // Same hardware, different browser - fuzzy match
        }
      }

      // Strategy 3: Same WebGL (GPU) + screen + timezone
      // Even if canvas differs slightly, GPU signature is very unique
      if (
        !existingDeviceAnyUser &&
        fingerprintData.webgl &&
        fingerprintData.webgl !== "unavailable"
      ) {
        existingDeviceAnyUser = await DeviceFingerprint.findOne({
          userId: { $ne: userId },
          webgl: fingerprintData.webgl,
          screenResolution: fingerprintData.screenResolution,
          timezone: fingerprintData.timezone,
        });

        if (existingDeviceAnyUser) {
          // Same GPU + screen + timezone
        }
      }

      if (existingDeviceAnyUser) {
        // Device match found
      }
    }

    // Handle case where this user already has a fingerprint - update it
    if (existingFingerprint) {
      // Same user, same device - update THEIR fingerprint
      existingFingerprint.lastSeen = new Date();
      existingFingerprint.timesUsed += 1;
      existingFingerprint.ipAddress = ipAddress;

      // Update enhanced data (to capture any changes over time)
      existingFingerprint.browser =
        fingerprintData.browser || existingFingerprint.browser;
      existingFingerprint.browserVersion =
        fingerprintData.browserVersion || existingFingerprint.browserVersion;
      existingFingerprint.userAgent =
        fingerprintData.userAgent || existingFingerprint.userAgent;
      if (fingerprintData.webglVendor)
        existingFingerprint.webglVendor = fingerprintData.webglVendor;
      if (fingerprintData.webglRenderer)
        existingFingerprint.webglRenderer = fingerprintData.webglRenderer;
      if (fingerprintData.gpuInfo)
        existingFingerprint.gpuInfo = fingerprintData.gpuInfo;
      if (fingerprintData.confidence)
        existingFingerprint.confidence = fingerprintData.confidence;
      if (fingerprintData.hardware)
        existingFingerprint.hardware = fingerprintData.hardware;
      if (fingerprintData.media)
        existingFingerprint.media = fingerprintData.media;
      if (fingerprintData.plugins)
        existingFingerprint.plugins = fingerprintData.plugins;
      if (fingerprintData.storage)
        existingFingerprint.storage = fingerprintData.storage;
      if (fingerprintData.features)
        existingFingerprint.features = fingerprintData.features;

      await existingFingerprint.save();

      // 🔥 IMPORTANT: Even if this user is known, check if they're linked to other accounts
      // This ensures fraud alerts are created EVERY TIME a known multi-account user logs in
      if (
        existingFingerprint.linkedUserIds &&
        existingFingerprint.linkedUserIds.length > 0 &&
        fraudSettings.multiAccountDetectionEnabled
      ) {
        const allLinkedUsers = [
          existingFingerprint.userId,
          ...existingFingerprint.linkedUserIds,
        ];
        // Check if accounts exceed the max allowed
        const exceedsMaxAllowed =
          allLinkedUsers.length > fraudSettings.maxAccountsPerDevice;

        // Only alert if accounts EXCEED the max allowed setting
        if (exceedsMaxAllowed) {
          // Get all devices for evidence
          const allDevices = await DeviceFingerprint.find({
            userId: { $in: allLinkedUsers },
          }).lean();

          const accountsEvidence = allLinkedUsers.map((linkedUserId) => {
            const userDevices = allDevices.filter(
              (d) => d.userId === linkedUserId,
            );
            return {
              userId: linkedUserId,
              devicesUsed: userDevices.map((d) => ({
                fingerprintId: d.fingerprintId,
                browser: `${d.browser} ${d.browserVersion}`,
                os: `${d.os} ${d.osVersion}`,
                deviceType: d.deviceType,
                screenResolution: d.screenResolution,
                ipAddress: d.ipAddress,
                timezone: d.timezone,
                language: d.language,
                firstSeen: d.firstSeen,
                lastSeen: d.lastSeen,
                timesUsed: d.timesUsed,
              })),
            };
          });

          let severity: "low" | "medium" | "high" | "critical" = "medium";
          if (allLinkedUsers.length >= fraudSettings.maxAccountsPerDevice + 2) {
            severity = "critical";
          } else if (
            allLinkedUsers.length > fraudSettings.maxAccountsPerDevice
          ) {
            severity = "high";
          }

          // Call AlertManagerService - it will handle checking for cleared/dismissed alerts
          await AlertManagerService.createOrUpdateAlert({
            alertType: "same_device",
            userIds: allLinkedUsers,
            title: "Multiple Accounts on Same Device",
            description: `${allLinkedUsers.length} accounts detected using the same device (${existingFingerprint.deviceType}, ${existingFingerprint.browser} on ${existingFingerprint.os})`,
            severity,
            confidence: 0.85,
            evidence: [
              {
                type: "device_fingerprint",
                description: "Known multi-account device - user login detected",
                data: {
                  matchedFingerprintId: existingFingerprint.fingerprintId,
                  fingerprintId: existingFingerprint.fingerprintId,
                  linkedAccounts: allLinkedUsers.length,
                  maxAllowed: fraudSettings.maxAccountsPerDevice,
                  accountsDetails: accountsEvidence,
                  lastActivity: {
                    timestamp: new Date(),
                    userId: userId,
                    browser: fingerprintData.browser,
                    action: "known_device_login",
                    ipAddress: ipAddress,
                  },
                },
              },
            ],
          });

          // Update suspicion scores
          await SuspicionScoringService.scoreDeviceMatch(
            allLinkedUsers,
            existingFingerprint.fingerprintId,
            `${existingFingerprint.browser} on ${existingFingerprint.os}`,
          );

        }
      }

      const linkedCount = existingFingerprint.linkedUserIds?.length || 0;
      const totalAccounts = linkedCount + 1; // +1 for current user
      const exceedsLimit = totalAccounts > fraudSettings.maxAccountsPerDevice;

      return NextResponse.json({
        success: true,
        suspicious: exceedsLimit, // Only mark as suspicious if exceeds max allowed
        message:
          linkedCount > 0
            ? exceedsLimit
              ? `Device linked to ${totalAccounts} accounts (exceeds max: ${fraudSettings.maxAccountsPerDevice})`
              : `Device linked to ${totalAccounts} accounts (within max: ${fraudSettings.maxAccountsPerDevice})`
            : "Device recognized for this user",
      });
    }

    // Handle case where a DIFFERENT user's device was found (fraud detection)
    if (existingDeviceAnyUser && fraudSettings.multiAccountDetectionEnabled) {
      // 🚨 SUSPICIOUS: Same device, different user

      // Add to linked users on the ORIGINAL fingerprint
      if (!existingDeviceAnyUser.linkedUserIds.includes(userId)) {
        existingDeviceAnyUser.linkedUserIds.push(userId);
      }

      // Increase risk score (add 20 points per additional account)
      existingDeviceAnyUser.riskScore = Math.min(
        existingDeviceAnyUser.riskScore + 20,
        100,
      );

      // Update last seen on original fingerprint
      existingDeviceAnyUser.lastSeen = new Date();
      existingDeviceAnyUser.timesUsed += 1;
      await existingDeviceAnyUser.save();

      // 🔥 CRITICAL FIX: Create a NEW fingerprint for THIS user with THEIR browser data
      // This ensures each user has their own device record with correct browser/timestamps
      const _newUserFingerprint = await DeviceFingerprint.create({
        fingerprintId: fingerprintData.fingerprintId,
        userId: userId,
        deviceType: fingerprintData.deviceType,
        browser: fingerprintData.browser,
        browserVersion: fingerprintData.browserVersion,
        os: fingerprintData.os,
        osVersion: fingerprintData.osVersion,
        screenResolution: fingerprintData.screenResolution,
        colorDepth: fingerprintData.colorDepth,
        timezone: fingerprintData.timezone,
        language: fingerprintData.language,
        ipAddress: ipAddress,
        userAgent: fingerprintData.userAgent,
        canvas: fingerprintData.canvas,
        webgl: fingerprintData.webgl,
        webglVendor: fingerprintData.webglVendor,
        webglRenderer: fingerprintData.webglRenderer,
        gpuInfo: fingerprintData.gpuInfo,
        fonts: fingerprintData.fonts,
        confidence: fingerprintData.confidence,
        // Enhanced 50+ data points
        hardware: fingerprintData.hardware,
        media: fingerprintData.media,
        plugins: fingerprintData.plugins,
        storage: fingerprintData.storage,
        features: fingerprintData.features,
        timesUsed: 1,
        linkedUserIds: [
          existingDeviceAnyUser.userId,
          ...existingDeviceAnyUser.linkedUserIds,
        ].filter((id) => id !== userId), // Link to other users
        isVPN: ipRiskScore >= 30,
        isProxy: ipRiskScore >= 30,
        isTor: ipRiskScore >= 50,
        riskScore: existingDeviceAnyUser.riskScore,
        firstSeen: new Date(),
        lastSeen: new Date(),
      });


      // Create or update fraud alert
      // Only alert when accounts EXCEED the max allowed setting
      const allLinkedUsers = [
        existingDeviceAnyUser.userId,
        ...existingDeviceAnyUser.linkedUserIds,
      ];

      // Include current user in the count - they were just added to linkedUserIds
      // allLinkedUsers = owner + all linked users (including the new user)

      // Check if accounts exceed the max allowed
      const exceedsMaxAllowed =
        allLinkedUsers.length > fraudSettings.maxAccountsPerDevice;

      // ALWAYS log for debugging
      if (exceedsMaxAllowed) {
      }

      // Only create alert if accounts EXCEED the max allowed setting
      if (exceedsMaxAllowed) {
        let severity: "low" | "medium" | "high" | "critical" = "medium";
        if (allLinkedUsers.length >= fraudSettings.maxAccountsPerDevice + 2) {
          severity = "critical";
        } else if (allLinkedUsers.length > fraudSettings.maxAccountsPerDevice) {
          severity = "high";
        }

        // Check if an alert already exists for THESE USERS (ANY alert type)
        // This ensures we MERGE into existing alerts from other fraud types (similarity, mirror, etc.)
        const existingAlert = await FraudAlert.findOne({
          status: { $in: ["pending", "investigating"] },
          $or: [
            { suspiciousUserIds: { $in: allLinkedUsers } },
            { primaryUserId: { $in: allLinkedUsers } },
          ],
        }).sort({ updatedAt: -1 }); // Get most recently updated

        // Get ALL devices used by these users for comprehensive evidence
        // This includes ALL devices, not just the suspicious ones, for full context
        const allDevices = await DeviceFingerprint.find({
          userId: { $in: allLinkedUsers },
        }).lean();


        // Build detailed evidence for each account
        // CRITICAL FIX: Only show devices that THIS user actually owns/used
        const accountsEvidence = allLinkedUsers.map((linkedUserId) => {
          const userDevices = allDevices.filter(
            (d) => d.userId === linkedUserId, // Only devices owned by THIS user
          );
          return {
            userId: linkedUserId,
            devicesUsed: userDevices.map((d) => ({
              fingerprintId: d.fingerprintId,
              browser: `${d.browser} ${d.browserVersion}`,
              browserVersion: d.browserVersion,
              os: `${d.os} ${d.osVersion}`,
              osVersion: d.osVersion,
              deviceType: d.deviceType,
              screenResolution: d.screenResolution,
              ipAddress: d.ipAddress,
              timezone: d.timezone,
              language: d.language,
              canvas: d.canvas,
              webgl: d.webgl,
              webglVendor: d.webglVendor,
              webglRenderer: d.webglRenderer,
              gpuInfo: d.gpuInfo,
              userAgent: d.userAgent,
              colorDepth: d.colorDepth,
              fonts: d.fonts,
              confidence: d.confidence,
              // Enhanced 50+ data points
              hardware: d.hardware,
              media: d.media,
              plugins: d.plugins,
              storage: d.storage,
              features: d.features,
              firstSeen: d.firstSeen,
              lastSeen: d.lastSeen,
              timesUsed: d.timesUsed,
            })),
          };
        });

        if (existingAlert) {
          // Use AlertManagerService to MERGE new device evidence into existing alert
          // This properly handles alerts of ANY type (similarity, mirror, payment, etc.)

          await AlertManagerService.createOrUpdateAlert({
            alertType: "same_device",
            userIds: allLinkedUsers,
            title: "Multiple Accounts on Same Device",
            description: `${allLinkedUsers.length} accounts detected using the same device (${fingerprintData.deviceType}, ${fingerprintData.browser} on ${fingerprintData.os})`,
            severity,
            confidence: 0.85,
            evidence: [
              {
                type: "device_fingerprint",
                description:
                  "Device fingerprint match - All devices used by suspicious accounts",
                data: {
                  matchedFingerprintId: fingerprintData.fingerprintId,
                  fingerprintId: fingerprintData.fingerprintId, // For duplicate detection
                  primaryDevice: {
                    device: `${fingerprintData.deviceType} - ${fingerprintData.browser} ${fingerprintData.browserVersion}`,
                    os: `${fingerprintData.os} ${fingerprintData.osVersion}`,
                    screenResolution: fingerprintData.screenResolution,
                    timezone: fingerprintData.timezone,
                    language: fingerprintData.language,
                    ipAddress: ipAddress,
                    gpuInfo: fingerprintData.gpuInfo,
                  },
                  linkedAccounts: allLinkedUsers.length,
                  maxAllowed: fraudSettings.maxAccountsPerDevice,
                  accountsDetails: accountsEvidence,
                  lastActivity: {
                    timestamp: new Date(),
                    userId: userId,
                    browser: fingerprintData.browser,
                    action: "login_detected",
                    ipAddress: ipAddress,
                  },
                },
              },
            ],
          });

          // Update suspicion scores
          await SuspicionScoringService.scoreDeviceMatch(
            allLinkedUsers,
            fingerprintData.fingerprintId,
            `${fingerprintData.browser} on ${fingerprintData.os}`,
          );

        } else {
          // Check if we should suppress alerts for these accounts
          const alertStatus = await checkAlertStatus(userId, allLinkedUsers);

          if (alertStatus.shouldSuppress) {
            return NextResponse.json({
              success: true,
              suspicious: false,
              message:
                "Fraud detected but alert suppressed (accounts restricted)",
            });
          }

          // NOTE: If alertStatus.hasActiveAlert is true, AlertManagerService will MERGE
          // the new evidence into the existing alert (even if it's in "investigating" status)

          // Create new alert with comprehensive evidence and activity tracking
          const activityLog = [
            {
              timestamp: new Date(),
              userId: userId,
              browser: fingerprintData.browser,
              action: "initial_detection",
              ipAddress: ipAddress,
            },
          ];

          await AlertManagerService.createOrUpdateAlert({
            alertType: "same_device",
            userIds: allLinkedUsers,
            title: "Multiple Accounts on Same Device",
            description: `${allLinkedUsers.length} accounts detected using the same device (${fingerprintData.deviceType}, ${fingerprintData.browser} on ${fingerprintData.os})`,
            severity,
            confidence: 0.85,
            evidence: [
              {
                type: "device_fingerprint",
                description:
                  "Device fingerprint match - All devices used by suspicious accounts",
                data: {
                  matchedFingerprintId: fingerprintData.fingerprintId,
                  primaryDevice: {
                    device: `${fingerprintData.deviceType} - ${fingerprintData.browser} ${fingerprintData.browserVersion}`,
                    os: `${fingerprintData.os} ${fingerprintData.osVersion}`,
                    screenResolution: fingerprintData.screenResolution,
                    timezone: fingerprintData.timezone,
                    language: fingerprintData.language,
                    ipAddress: ipAddress,
                    gpuInfo: fingerprintData.gpuInfo,
                  },
                  linkedAccounts: allLinkedUsers.length,
                  maxAllowed: fraudSettings.maxAccountsPerDevice,
                  accountsDetails: accountsEvidence,
                  activityLog: activityLog,
                  totalActivities: 1,
                  lastActivity: activityLog[0],
                },
              },
            ],
          });

          // 📊 UPDATE SUSPICION SCORES
          await SuspicionScoringService.scoreDeviceMatch(
            allLinkedUsers,
            fingerprintData.fingerprintId,
            `${fingerprintData.browser} on ${fingerprintData.os}`,
          );

          // Also check for same timezone + language
          if (fingerprintData.timezone && fingerprintData.language) {
            await SuspicionScoringService.scoreTimezoneLanguage(
              allLinkedUsers,
              fingerprintData.timezone,
              fingerprintData.language,
            );
          }
        }
      } else {
      }

      const exceedsLimit =
        allLinkedUsers.length > fraudSettings.maxAccountsPerDevice;

      return NextResponse.json({
        success: true,
        suspicious: exceedsLimit, // Only suspicious if exceeds max allowed
        message: exceedsLimit
          ? `Device shared by ${allLinkedUsers.length} accounts (exceeds max: ${fraudSettings.maxAccountsPerDevice})`
          : `Device shared by ${allLinkedUsers.length} accounts (within max: ${fraudSettings.maxAccountsPerDevice})`,
        linkedAccounts: existingDeviceAnyUser.linkedUserIds.length,
        riskScore: existingDeviceAnyUser.riskScore,
      });
    }

    // 🔥 NEW: Check for same IP + same browser (even if fingerprints differ)
    if (
      !existingFingerprint &&
      !existingDeviceAnyUser &&
      fraudSettings.multiAccountDetectionEnabled
    ) {
      // Extract main browser name (e.g., "Chrome" from "Chrome 142.0")
      const currentBrowserName =
        fingerprintData.browser?.split(" ")[0] || "Unknown";

      // Find devices with same IP and same browser family, but different users
      const sameIPBrowserDevices = await DeviceFingerprint.find({
        userId: { $ne: userId }, // Different user
        ipAddress: ipAddress,
        browser: { $regex: `^${currentBrowserName}`, $options: "i" }, // Same browser family
      }).lean();

      if (sameIPBrowserDevices.length > 0) {
        // Get all unique users
        const allLinkedUserIds = [
          ...new Set(sameIPBrowserDevices.map((d) => d.userId)),
        ];
        allLinkedUserIds.push(userId); // Add current user

        const exceedsLimit =
          allLinkedUserIds.length > fraudSettings.maxAccountsPerDevice;

        // Create new fingerprint for current user first
        const _newFingerprint = await DeviceFingerprint.create({
          fingerprintId: fingerprintData.fingerprintId || "unknown",
          userId: userId,
          deviceType: fingerprintData.deviceType || "unknown",
          browser: fingerprintData.browser || "Unknown",
          browserVersion: fingerprintData.browserVersion || "Unknown",
          os: fingerprintData.os || "Unknown",
          osVersion: fingerprintData.osVersion || "Unknown",
          screenResolution: fingerprintData.screenResolution || "Unknown",
          colorDepth: fingerprintData.colorDepth || 24,
          timezone: fingerprintData.timezone || "UTC",
          language: fingerprintData.language || "en",
          ipAddress: ipAddress || "unknown",
          country: ipDetection.country,
          city: ipDetection.city,
          userAgent:
            fingerprintData.userAgent ||
            headersList.get("user-agent") ||
            "Unknown",
          canvas: fingerprintData.canvas,
          webgl: fingerprintData.webgl,
          webglVendor: fingerprintData.webglVendor,
          webglRenderer: fingerprintData.webglRenderer,
          gpuInfo: fingerprintData.gpuInfo,
          fonts: fingerprintData.fonts || [],
          confidence: fingerprintData.confidence,
          // Enhanced 50+ data points
          hardware: fingerprintData.hardware,
          media: fingerprintData.media,
          plugins: fingerprintData.plugins,
          storage: fingerprintData.storage,
          features: fingerprintData.features,
          linkedUserIds: allLinkedUserIds.filter((id) => id !== userId),
          isVPN: isVPN,
          isProxy: isProxy,
          isTor: isTor,
          riskScore: 30, // Higher initial risk for same IP + browser
        });

        // Update existing devices to link to this user
        for (const device of sameIPBrowserDevices) {
          await DeviceFingerprint.findByIdAndUpdate(device._id, {
            $addToSet: { linkedUserIds: userId },
            $inc: { riskScore: 15 },
          });
        }

        // Only create fraud alert if accounts EXCEED the max allowed setting
        if (exceedsLimit) {
          let severity: "low" | "medium" | "high" | "critical" = "medium";
          if (
            allLinkedUserIds.length >=
            fraudSettings.maxAccountsPerDevice + 2
          ) {
            severity = "critical";
          } else if (
            allLinkedUserIds.length > fraudSettings.maxAccountsPerDevice
          ) {
            severity = "high";
          }

          // Check if alert already exists for these users (ANY alert type)
          // This ensures we MERGE into existing alerts from other fraud types
          const _existingAlert = await FraudAlert.findOne({
            status: { $in: ["pending", "investigating"] },
            $or: [
              { suspiciousUserIds: { $in: allLinkedUserIds } },
              { primaryUserId: { $in: allLinkedUserIds } },
            ],
          }).sort({ updatedAt: -1 }); // Get most recently updated

          // Check if we should suppress alerts for these accounts (only for restricted users)
          const alertStatus = await checkAlertStatus(userId, allLinkedUserIds);

          if (alertStatus.shouldSuppress) {
            return NextResponse.json({
              success: true,
              suspicious: false,
              message:
                "Fraud detected but alert suppressed (accounts restricted)",
            });
          }

          // Get all devices for evidence
          const allDevices = await DeviceFingerprint.find({
            userId: { $in: allLinkedUserIds },
          }).lean();

          const accountsEvidence = allLinkedUserIds.map((linkedUserId) => {
            const userDevices = allDevices.filter(
              (d) => d.userId === linkedUserId,
            );
            return {
              userId: linkedUserId,
              devicesUsed: userDevices.map((d) => ({
                fingerprintId: d.fingerprintId,
                browser: `${d.browser} ${d.browserVersion}`,
                browserVersion: d.browserVersion,
                os: `${d.os} ${d.osVersion}`,
                osVersion: d.osVersion,
                deviceType: d.deviceType,
                screenResolution: d.screenResolution,
                ipAddress: d.ipAddress,
                timezone: d.timezone,
                language: d.language,
                canvas: d.canvas,
                webgl: d.webgl,
                webglVendor: d.webglVendor,
                webglRenderer: d.webglRenderer,
                gpuInfo: d.gpuInfo,
                userAgent: d.userAgent,
                colorDepth: d.colorDepth,
                fonts: d.fonts,
                confidence: d.confidence,
                // Enhanced 50+ data points
                hardware: d.hardware,
                media: d.media,
                plugins: d.plugins,
                storage: d.storage,
                features: d.features,
                firstSeen: d.firstSeen,
                lastSeen: d.lastSeen,
                timesUsed: d.timesUsed,
              })),
            };
          });

          // Use AlertManagerService which handles MERGING into existing alerts
          await AlertManagerService.createOrUpdateAlert({
            alertType: "same_ip_browser",
            userIds: allLinkedUserIds,
            title: `${allLinkedUserIds.length} accounts using same IP + ${currentBrowserName}`,
            description: `Multiple accounts detected using ${currentBrowserName} from IP ${ipAddress} (exceeds max: ${fraudSettings.maxAccountsPerDevice})`,
            severity: severity,
            confidence: 0.8,
            evidence: [
              {
                type: "ip_browser_match",
                description: `${allLinkedUserIds.length} accounts using ${currentBrowserName} from ${ipAddress}`,
                data: {
                  browser: currentBrowserName,
                  ipAddress: ipAddress,
                  location: `${ipDetection.city || "Unknown"}, ${ipDetection.country || "Unknown"}`,
                  linkedAccounts: allLinkedUserIds.length,
                  maxAllowed: fraudSettings.maxAccountsPerDevice,
                  accountsDetails: accountsEvidence,
                },
              },
            ],
          });

          // 📊 UPDATE SUSPICION SCORES
          await SuspicionScoringService.scoreIPBrowserMatch(
            allLinkedUserIds,
            ipAddress,
            currentBrowserName,
          );
        }

        return NextResponse.json({
          success: true,
          suspicious: exceedsLimit,
          message: exceedsLimit
            ? `${allLinkedUserIds.length} accounts on same IP + browser (exceeds max: ${fraudSettings.maxAccountsPerDevice})`
            : `${allLinkedUserIds.length} accounts on same IP + browser (within max: ${fraudSettings.maxAccountsPerDevice})`,
          linkedAccounts: allLinkedUserIds.length - 1,
          riskScore: exceedsLimit ? 30 : 10,
        });
      }
    }

    // If no existing fingerprint found at all - create new one
    if (!existingFingerprint && !existingDeviceAnyUser) {
      // New device fingerprint - create record
      const baseRiskScore = ipRiskScore;

      const newFingerprint = await DeviceFingerprint.create({
        fingerprintId: fingerprintData.fingerprintId || "unknown",
        userId: userId,
        deviceType: fingerprintData.deviceType || "unknown",
        browser: fingerprintData.browser || "Unknown",
        browserVersion: fingerprintData.browserVersion || "Unknown",
        os: fingerprintData.os || "Unknown",
        osVersion: fingerprintData.osVersion || "Unknown",
        screenResolution: fingerprintData.screenResolution || "Unknown",
        colorDepth: fingerprintData.colorDepth || 24,
        timezone: fingerprintData.timezone || "UTC",
        language: fingerprintData.language || "en",
        ipAddress: ipAddress || "unknown",
        country: ipDetection.country,
        city: ipDetection.city,
        userAgent:
          fingerprintData.userAgent ||
          headersList.get("user-agent") ||
          "Unknown",
        canvas: fingerprintData.canvas,
        webgl: fingerprintData.webgl,
        webglVendor: fingerprintData.webglVendor,
        webglRenderer: fingerprintData.webglRenderer,
        gpuInfo: fingerprintData.gpuInfo,
        fonts: fingerprintData.fonts || [],
        confidence: fingerprintData.confidence,
        // Enhanced 50+ data points
        hardware: fingerprintData.hardware,
        media: fingerprintData.media,
        plugins: fingerprintData.plugins,
        storage: fingerprintData.storage,
        features: fingerprintData.features,
        linkedUserIds: [],
        isVPN: isVPN,
        isProxy: isProxy,
        isTor: isTor,
        riskScore: baseRiskScore,
      });

      // VPN/Proxy/Tor alerting is handled up-front by maybeCreateVpnAlert(),
      // which runs for every tracked request (including this new device).

      return NextResponse.json({
        success: true,
        suspicious: false,
        message: "New device registered",
        fingerprintId: newFingerprint.fingerprintId,
      });
    }

    // Reason: Fallback return in case no branch above explicitly returns.
    return NextResponse.json({ success: true, message: "Device processed" });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("❌ Error tracking device fingerprint:", errorMessage);
    console.error("Stack:", errorStack);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to track device",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 },
    );
  }
}
