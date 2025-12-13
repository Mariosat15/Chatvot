import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import DeviceFingerprint from '@/database/models/fraud/device-fingerprint.model';
import FraudAlert from '@/database/models/fraud/fraud-alert.model';
import UserRestriction from '@/database/models/user-restriction.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { detectVPNProxy, isHighRiskIP } from '@/lib/services/ip-detection.service';
import { getFraudSettings } from '@/lib/services/fraud-settings.service';
import { SuspicionScoringService } from '@/lib/services/fraud/suspicion-scoring.service';
import { AlertManagerService } from '@/lib/services/fraud/alert-manager.service';

/**
 * Check if accounts are already restricted (banned/suspended)
 * Returns object with:
 * - shouldSuppress: true if alerts should be completely suppressed (restricted users)
 * - hasActiveAlert: true if there's an existing alert we should merge into
 */
async function checkAlertStatus(userIds: string[]): Promise<{
  shouldSuppress: boolean;
  hasActiveAlert: boolean;
  existingAlertStatus?: string;
}> {
  // Check if any users are restricted (banned/suspended) - COMPLETELY suppress for these
  const restrictions = await UserRestriction.find({
    userId: { $in: userIds },
    isActive: true
  });

  if (restrictions.length > 0) {
    console.log(`🔇 Alert suppressed: ${restrictions.length} account(s) already restricted (banned/suspended)`);
    return { shouldSuppress: true, hasActiveAlert: false };
  }

  // Check if any of these users already have active alerts (pending or investigating)
  // We DON'T suppress these - we MERGE new evidence into them via AlertManagerService
  const existingAlerts = await FraudAlert.findOne({
    suspiciousUserIds: { $in: userIds },
    status: { $in: ['pending', 'investigating'] }
  });

  if (existingAlerts) {
    console.log(`📝 Active alert exists (${existingAlerts.status}) - will MERGE new evidence via AlertManagerService`);
    return { shouldSuppress: false, hasActiveAlert: true, existingAlertStatus: existingAlerts.status };
  }

  return { shouldSuppress: false, hasActiveAlert: false };
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
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const fingerprintData = await request.json();
    
    // Get fraud settings
    const fraudSettings = await getFraudSettings();
    
    // Get IP address
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : 
                     headersList.get('x-real-ip') || 
                     'unknown';

    // Detect VPN/Proxy (if enabled)
    let ipDetection: any = {
      isVPN: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
      country: undefined,
      city: undefined,
      isp: undefined
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

    // Check if device fingerprinting is enabled
    if (!fraudSettings.deviceFingerprintingEnabled) {
      return NextResponse.json({
        success: true,
        suspicious: false,
        message: 'Device fingerprinting disabled'
      });
    }

    // Check if this fingerprint already exists FOR THIS USER FIRST
    // This ensures each user updates their OWN fingerprint, not a linked one
    const existingFingerprint = await DeviceFingerprint.findOne({
      fingerprintId: fingerprintData.fingerprintId,
      userId: userId
    });

    // If no exact match for this user, check if ANY fingerprint exists (for fraud detection)
    let existingDeviceAnyUser = null;
    if (!existingFingerprint) {
      existingDeviceAnyUser = await DeviceFingerprint.findOne({
        fingerprintId: fingerprintData.fingerprintId
      });
    }

    // If no exact match for this user, check for "similar" devices from OTHER users (AGGRESSIVE fuzzy matching)
    // This catches cases where FingerprintJS generates different IDs for same device
    // OR when users try to hide by switching browsers
    if (!existingFingerprint && !existingDeviceAnyUser && fraudSettings.multiAccountDetectionEnabled) {
      // Try multiple matching strategies, from strictest to most aggressive
      
      // Strategy 1: Same browser + same hardware (original)
      existingDeviceAnyUser = await DeviceFingerprint.findOne({
        userId: { $ne: userId },
        browser: fingerprintData.browser,
        browserVersion: fingerprintData.browserVersion,
        os: fingerprintData.os,
        osVersion: fingerprintData.osVersion,
        screenResolution: fingerprintData.screenResolution,
        ...(fingerprintData.canvas && { canvas: fingerprintData.canvas })
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
          timezone: fingerprintData.timezone
        });
        
        if (existingDeviceAnyUser) {
          console.log(`🔍 AGGRESSIVE FUZZY MATCH: Same hardware, different browser detected!`);
          console.log(`   User trying to hide by switching browsers:`);
          console.log(`   Original: ${existingDeviceAnyUser.browser} ${existingDeviceAnyUser.browserVersion}`);
          console.log(`   New:      ${fingerprintData.browser} ${fingerprintData.browserVersion}`);
          console.log(`   Match:    Same canvas + screen (${fingerprintData.screenResolution}) + timezone (${fingerprintData.timezone})`);
        }
      }

      // Strategy 3: Same WebGL (GPU) + screen + timezone
      // Even if canvas differs slightly, GPU signature is very unique
      if (!existingDeviceAnyUser && fingerprintData.webgl && fingerprintData.webgl !== 'unavailable') {
        existingDeviceAnyUser = await DeviceFingerprint.findOne({
          userId: { $ne: userId },
          webgl: fingerprintData.webgl,
          screenResolution: fingerprintData.screenResolution,
          timezone: fingerprintData.timezone
        });
        
        if (existingDeviceAnyUser) {
          console.log(`🔍 GPU MATCH: Same graphics card detected!`);
          console.log(`   Original: ${existingDeviceAnyUser.browser} on ${existingDeviceAnyUser.os}`);
          console.log(`   New:      ${fingerprintData.browser} on ${fingerprintData.os}`);
          console.log(`   Match:    Same GPU (${fingerprintData.webgl.substring(0, 50)}...) + screen + timezone`);
        }
      }

      if (existingDeviceAnyUser) {
        console.log(`   Device IDs: ${existingDeviceAnyUser.fingerprintId} vs ${fingerprintData.fingerprintId}`);
      }
    }

    // Handle case where this user already has a fingerprint - just update it
    if (existingFingerprint) {
      // Same user, same device - just update THEIR fingerprint
      existingFingerprint.lastSeen = new Date();
      existingFingerprint.timesUsed += 1;
      existingFingerprint.ipAddress = ipAddress;
      
      // Update enhanced data (to capture any changes over time)
      existingFingerprint.browser = fingerprintData.browser || existingFingerprint.browser;
      existingFingerprint.browserVersion = fingerprintData.browserVersion || existingFingerprint.browserVersion;
      existingFingerprint.userAgent = fingerprintData.userAgent || existingFingerprint.userAgent;
      if (fingerprintData.webglVendor) existingFingerprint.webglVendor = fingerprintData.webglVendor;
      if (fingerprintData.webglRenderer) existingFingerprint.webglRenderer = fingerprintData.webglRenderer;
      if (fingerprintData.gpuInfo) existingFingerprint.gpuInfo = fingerprintData.gpuInfo;
      if (fingerprintData.confidence) existingFingerprint.confidence = fingerprintData.confidence;
      if (fingerprintData.hardware) existingFingerprint.hardware = fingerprintData.hardware;
      if (fingerprintData.media) existingFingerprint.media = fingerprintData.media;
      if (fingerprintData.plugins) existingFingerprint.plugins = fingerprintData.plugins;
      if (fingerprintData.storage) existingFingerprint.storage = fingerprintData.storage;
      if (fingerprintData.features) existingFingerprint.features = fingerprintData.features;
      
      await existingFingerprint.save();

      return NextResponse.json({
        success: true,
        suspicious: false,
        message: 'Device recognized for this user'
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
          100
        );
        
        // Update last seen on original fingerprint
        existingDeviceAnyUser.lastSeen = new Date();
        existingDeviceAnyUser.timesUsed += 1;
        await existingDeviceAnyUser.save();

        // 🔥 CRITICAL FIX: Create a NEW fingerprint for THIS user with THEIR browser data
        // This ensures each user has their own device record with correct browser/timestamps
        const newUserFingerprint = await DeviceFingerprint.create({
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
          linkedUserIds: [existingDeviceAnyUser.userId, ...existingDeviceAnyUser.linkedUserIds].filter(id => id !== userId), // Link to other users
          isVPN: ipRiskScore >= 30,
          isProxy: ipRiskScore >= 30,
          isTor: ipRiskScore >= 50,
          riskScore: existingDeviceAnyUser.riskScore,
          firstSeen: new Date(),
          lastSeen: new Date()
        });

        console.log(`✅ Created separate fingerprint for user ${userId} with ${newUserFingerprint.browser} (linked to ${existingDeviceAnyUser.userId})`);

        // Create or update fraud alert
        // Always create alert when multiple accounts detected, regardless of risk score
        const allLinkedUsers = [existingDeviceAnyUser.userId, ...existingDeviceAnyUser.linkedUserIds];
        
        console.log(`🔍 Multi-account detected: ${allLinkedUsers.length} accounts on same device (Risk: ${existingDeviceAnyUser.riskScore}, Threshold: ${fraudSettings.alertThreshold})`);
        
        if (allLinkedUsers.length >= 2) {  // Changed: Alert when 2+ accounts detected
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
          if (allLinkedUsers.length >= fraudSettings.maxAccountsPerDevice + 2) {
            severity = 'critical';
          } else if (allLinkedUsers.length > fraudSettings.maxAccountsPerDevice) {
            severity = 'high';
          }
          
          // Check if an alert already exists for THESE USERS (ANY alert type)
          // This ensures we MERGE into existing alerts from other fraud types (similarity, mirror, etc.)
          const existingAlert = await FraudAlert.findOne({
            status: { $in: ['pending', 'investigating'] },
            $or: [
              { suspiciousUserIds: { $in: allLinkedUsers } },
              { primaryUserId: { $in: allLinkedUsers } }
            ]
          }).sort({ updatedAt: -1 }); // Get most recently updated
          
          // Get ALL devices used by these users for comprehensive evidence
          // This includes ALL devices, not just the suspicious ones, for full context
          const allDevices = await DeviceFingerprint.find({
            userId: { $in: allLinkedUsers }
          }).lean();

          console.log(`📊 Building evidence for ${allLinkedUsers.length} accounts with ${allDevices.length} total devices`);

          // Build detailed evidence for each account
          // CRITICAL FIX: Only show devices that THIS user actually owns/used
          const accountsEvidence = allLinkedUsers.map(linkedUserId => {
            const userDevices = allDevices.filter(d => 
              d.userId === linkedUserId  // Only devices owned by THIS user
            );
            console.log(`   User ${linkedUserId}: ${userDevices.length} device(s)`);
            return {
              userId: linkedUserId,
              devicesUsed: userDevices.map(d => ({
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
                timesUsed: d.timesUsed
              }))
            };
          });

          console.log(`✅ Evidence built with ${accountsEvidence.length} accounts`);
          console.log(`   Sample:`, JSON.stringify(accountsEvidence[0], null, 2));

          if (existingAlert) {
            // Use AlertManagerService to MERGE new device evidence into existing alert
            // This properly handles alerts of ANY type (similarity, mirror, payment, etc.)
            console.log(`📝 Found existing ${existingAlert.alertType} alert (${existingAlert.status}) - merging device evidence via AlertManagerService`);
            
            await AlertManagerService.createOrUpdateAlert({
              alertType: 'same_device',
              userIds: allLinkedUsers,
              title: 'Multiple Accounts on Same Device',
              description: `${allLinkedUsers.length} accounts detected using the same device (${fingerprintData.deviceType}, ${fingerprintData.browser} on ${fingerprintData.os})`,
              severity,
              confidence: 0.85,
              evidence: [
                {
                  type: 'device_fingerprint',
                  description: 'Device fingerprint match - All devices used by suspicious accounts',
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
                      gpuInfo: fingerprintData.gpuInfo
                    },
                    linkedAccounts: allLinkedUsers.length,
                    maxAllowed: fraudSettings.maxAccountsPerDevice,
                    accountsDetails: accountsEvidence,
                    lastActivity: {
                      timestamp: new Date(),
                      userId: userId,
                      browser: fingerprintData.browser,
                      action: 'login_detected',
                      ipAddress: ipAddress
                    }
                  }
                }
              ]
            });
            
            // Update suspicion scores
            await SuspicionScoringService.scoreDeviceMatch(
              allLinkedUsers,
              fingerprintData.fingerprintId,
              `${fingerprintData.browser} on ${fingerprintData.os}`
            );
            
            console.log(`✅ MERGED device evidence into existing alert`);
          } else {
            // Check if we should suppress alerts for these accounts
            const alertStatus = await checkAlertStatus(allLinkedUsers);
            
            if (alertStatus.shouldSuppress) {
              console.log(`⏭️ Skipping alert creation - accounts are restricted (banned/suspended)`);
              return NextResponse.json({
                success: true,
                suspicious: false,
                message: 'Fraud detected but alert suppressed (accounts restricted)'
              });
            }
            
            // NOTE: If alertStatus.hasActiveAlert is true, AlertManagerService will MERGE
            // the new evidence into the existing alert (even if it's in "investigating" status)
            
            // Create new alert with comprehensive evidence and activity tracking
            const activityLog = [{
              timestamp: new Date(),
              userId: userId,
              browser: fingerprintData.browser,
              action: 'initial_detection',
              ipAddress: ipAddress
            }];
            
            await AlertManagerService.createOrUpdateAlert({
              alertType: 'same_device',
              userIds: allLinkedUsers,
              title: 'Multiple Accounts on Same Device',
              description: `${allLinkedUsers.length} accounts detected using the same device (${fingerprintData.deviceType}, ${fingerprintData.browser} on ${fingerprintData.os})`,
              severity,
              confidence: 0.85,
              evidence: [
                {
                  type: 'device_fingerprint',
                  description: 'Device fingerprint match - All devices used by suspicious accounts',
                  data: {
                    matchedFingerprintId: fingerprintData.fingerprintId,
                    primaryDevice: {
                      device: `${fingerprintData.deviceType} - ${fingerprintData.browser} ${fingerprintData.browserVersion}`,
                      os: `${fingerprintData.os} ${fingerprintData.osVersion}`,
                      screenResolution: fingerprintData.screenResolution,
                      timezone: fingerprintData.timezone,
                      language: fingerprintData.language,
                      ipAddress: ipAddress,
                      gpuInfo: fingerprintData.gpuInfo
                    },
                    linkedAccounts: allLinkedUsers.length,
                    maxAllowed: fraudSettings.maxAccountsPerDevice,
                    accountsDetails: accountsEvidence,
                    activityLog: activityLog,
                    totalActivities: 1,
                    lastActivity: activityLog[0]
                  }
                }
              ]
            });
            
            // 📊 UPDATE SUSPICION SCORES
            await SuspicionScoringService.scoreDeviceMatch(
              allLinkedUsers,
              fingerprintData.fingerprintId,
              `${fingerprintData.browser} on ${fingerprintData.os}`
            );
            
            // Also check for same timezone + language
            if (fingerprintData.timezone && fingerprintData.language) {
              await SuspicionScoringService.scoreTimezoneLanguage(
                allLinkedUsers,
                fingerprintData.timezone,
                fingerprintData.language
              );
            }
          }
        } else {
          console.log(`⚠️ Multi-account detected but not enough accounts yet: ${allLinkedUsers.length} accounts (need 2+)`);
        }

        console.log(`🚨 FRAUD DETECTED: User ${userId} using same device as ${allLinkedUsers.length - 1} other account(s)`);

        return NextResponse.json({
          success: true,
          suspicious: true,
          message: 'Device already associated with other accounts',
          linkedAccounts: existingDeviceAnyUser.linkedUserIds.length,
          riskScore: existingDeviceAnyUser.riskScore
        });
    }
    
    // 🔥 NEW: Check for same IP + same browser (even if fingerprints differ)
    if (!existingFingerprint && !existingDeviceAnyUser && fraudSettings.multiAccountDetectionEnabled) {
      // Extract main browser name (e.g., "Chrome" from "Chrome 142.0")
      const currentBrowserName = fingerprintData.browser?.split(' ')[0] || 'Unknown';
      
      // Find devices with same IP and same browser family, but different users
      const sameIPBrowserDevices = await DeviceFingerprint.find({
        userId: { $ne: userId }, // Different user
        ipAddress: ipAddress,
        browser: { $regex: `^${currentBrowserName}`, $options: 'i' } // Same browser family
      }).lean();

      if (sameIPBrowserDevices.length > 0) {
        console.log(`🔍 SAME IP + BROWSER DETECTED: ${sameIPBrowserDevices.length} other account(s) using ${currentBrowserName} from ${ipAddress}`);
        
        // Get all unique users
        const allLinkedUserIds = [...new Set(sameIPBrowserDevices.map(d => d.userId))];
        allLinkedUserIds.push(userId); // Add current user
        
        console.log(`📊 Creating fraud alert for ${allLinkedUserIds.length} accounts (Same IP + Same Browser)`);
        
        // Create new fingerprint for current user first
        const newFingerprint = await DeviceFingerprint.create({
          fingerprintId: fingerprintData.fingerprintId || 'unknown',
          userId: userId,
          deviceType: fingerprintData.deviceType || 'unknown',
          browser: fingerprintData.browser || 'Unknown',
          browserVersion: fingerprintData.browserVersion || 'Unknown',
          os: fingerprintData.os || 'Unknown',
          osVersion: fingerprintData.osVersion || 'Unknown',
          screenResolution: fingerprintData.screenResolution || 'Unknown',
          colorDepth: fingerprintData.colorDepth || 24,
          timezone: fingerprintData.timezone || 'UTC',
          language: fingerprintData.language || 'en',
          ipAddress: ipAddress || 'unknown',
          country: ipDetection.country,
          city: ipDetection.city,
          userAgent: fingerprintData.userAgent || headersList.get('user-agent') || 'Unknown',
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
          linkedUserIds: allLinkedUserIds.filter(id => id !== userId),
          isVPN: isVPN,
          isProxy: isProxy,
          isTor: isTor,
          riskScore: 30 // Higher initial risk for same IP + browser
        });

        console.log('✅ Saved fingerprint to database:', newFingerprint._id);

        // Update existing devices to link to this user
        for (const device of sameIPBrowserDevices) {
          await DeviceFingerprint.findByIdAndUpdate(device._id, {
            $addToSet: { linkedUserIds: userId },
            $inc: { riskScore: 15 }
          });
        }

        // Create fraud alert
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        if (allLinkedUserIds.length >= 5) {
          severity = 'critical';
        } else if (allLinkedUserIds.length >= 3) {
          severity = 'high';
        }

        // Check if alert already exists for these users (ANY alert type)
        // This ensures we MERGE into existing alerts from other fraud types
        const existingAlert = await FraudAlert.findOne({
          status: { $in: ['pending', 'investigating'] },
          $or: [
            { suspiciousUserIds: { $in: allLinkedUserIds } },
            { primaryUserId: { $in: allLinkedUserIds } }
          ]
        }).sort({ updatedAt: -1 }); // Get most recently updated

        // Check if we should suppress alerts for these accounts (only for restricted users)
        const alertStatus = await checkAlertStatus(allLinkedUserIds);
        
        if (alertStatus.shouldSuppress) {
          console.log(`⏭️ Skipping IP+Browser alert creation - accounts are restricted (banned/suspended)`);
          return NextResponse.json({
            success: true,
            suspicious: false,
            message: 'Fraud detected but alert suppressed (accounts restricted)'
          });
        }
        
        // Log if merging into existing alert
        if (existingAlert) {
          console.log(`📝 Found existing ${existingAlert.alertType} alert (${existingAlert.status}) - merging IP+Browser evidence via AlertManagerService`);
        }
        
        // Get all devices for evidence
        const allDevices = await DeviceFingerprint.find({
          userId: { $in: allLinkedUserIds }
        }).lean();

        const accountsEvidence = allLinkedUserIds.map(linkedUserId => {
          const userDevices = allDevices.filter(d => d.userId === linkedUserId);
          return {
            userId: linkedUserId,
            devicesUsed: userDevices.map(d => ({
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
              timesUsed: d.timesUsed
            }))
          };
        });

        // Use AlertManagerService which handles MERGING into existing alerts
        await AlertManagerService.createOrUpdateAlert({
            alertType: 'same_ip_browser',
            userIds: allLinkedUserIds,
            title: `${allLinkedUserIds.length} accounts using same IP + ${currentBrowserName}`,
            description: `Multiple accounts detected using ${currentBrowserName} from IP ${ipAddress}`,
            severity: severity,
            confidence: 0.80,
            evidence: [
              {
                type: 'ip_browser_match',
                description: `${allLinkedUserIds.length} accounts using ${currentBrowserName} from ${ipAddress}`,
                data: {
                  browser: currentBrowserName,
                  ipAddress: ipAddress,
                  location: `${ipDetection.city || 'Unknown'}, ${ipDetection.country || 'Unknown'}`,
                  linkedAccounts: allLinkedUserIds.length,
                  accountsDetails: accountsEvidence
                }
              }
            ]
          });
          
        // 📊 UPDATE SUSPICION SCORES
        await SuspicionScoringService.scoreIPBrowserMatch(
          allLinkedUserIds,
          ipAddress,
          currentBrowserName
        );

        return NextResponse.json({
          success: true,
          suspicious: true,
          message: `Multiple accounts detected using ${currentBrowserName} from this IP`,
          linkedAccounts: allLinkedUserIds.length - 1,
          riskScore: 30
        });
      }
    }
    
    // If no existing fingerprint found at all - create new one
    if (!existingFingerprint && !existingDeviceAnyUser) {
      // New device fingerprint - create record
      const baseRiskScore = ipRiskScore;
      
      // Log what we're receiving for debugging
      console.log('📥 Received fingerprint data:', {
        fingerprintId: fingerprintData.fingerprintId,
        browser: fingerprintData.browser,
        browserVersion: fingerprintData.browserVersion,
        os: fingerprintData.os,
        osVersion: fingerprintData.osVersion,
        colorDepth: fingerprintData.colorDepth,
        userAgent: fingerprintData.userAgent ? 'present' : 'MISSING',
        ipAddress: ipAddress
      });

      const newFingerprint = await DeviceFingerprint.create({
        fingerprintId: fingerprintData.fingerprintId || 'unknown',
        userId: userId,
        deviceType: fingerprintData.deviceType || 'unknown',
        browser: fingerprintData.browser || 'Unknown',
        browserVersion: fingerprintData.browserVersion || 'Unknown',
        os: fingerprintData.os || 'Unknown',
        osVersion: fingerprintData.osVersion || 'Unknown',
        screenResolution: fingerprintData.screenResolution || 'Unknown',
        colorDepth: fingerprintData.colorDepth || 24,
        timezone: fingerprintData.timezone || 'UTC',
        language: fingerprintData.language || 'en',
        ipAddress: ipAddress || 'unknown',
        country: ipDetection.country,
        city: ipDetection.city,
        userAgent: fingerprintData.userAgent || headersList.get('user-agent') || 'Unknown',
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
        riskScore: baseRiskScore
      });

      console.log('✅ Saved fingerprint to database:', newFingerprint._id);

      // Create alert if VPN/Proxy/Tor detected (and risk exceeds threshold)
      if ((isTor || isVPN || isProxy || ipRiskScore >= fraudSettings.alertThreshold) && fraudSettings.vpnDetectionEnabled) {
        let alertType: 'vpn_usage' | 'high_risk_device' = 'vpn_usage';
        let severity: 'medium' | 'high' | 'critical' = 'medium';
        let title = 'VPN/Proxy Usage Detected';
        let description = '';

        if (isTor) {
          severity = 'critical';
          title = 'Tor Network Detected';
          description = `User ${userId} is connecting through Tor network`;
        } else if (isVPN) {
          severity = 'high';
          title = 'VPN Usage Detected';
          description = `User ${userId} is connecting through a VPN (${ipDetection.isp})`;
        } else if (isProxy) {
          severity = 'high';
          title = 'Proxy Server Detected';
          description = `User ${userId} is connecting through a proxy (${ipDetection.isp})`;
        } else {
          severity = 'medium';
          alertType = 'high_risk_device';
          title = 'High-Risk IP Detected';
          description = `User ${userId} is connecting from a suspicious IP (Risk: ${ipRiskScore}%)`;
        }

        // Check if we should suppress alerts for this user
        const alertStatus = await checkAlertStatus([userId]);
        
        if (alertStatus.shouldSuppress) {
          console.log(`⏭️ Skipping VPN/Proxy alert creation - user is restricted (banned/suspended)`);
          return NextResponse.json({
            success: true,
            suspicious: false,
            message: 'High-risk IP detected but alert suppressed (account restricted)'
          });
        }
        
        // NOTE: If alertStatus.hasActiveAlert is true, AlertManagerService will MERGE

        await AlertManagerService.createOrUpdateAlert({
          alertType,
          userIds: [userId],
          title,
          description,
          severity,
          confidence: ipRiskScore / 100,
          evidence: [
            {
              type: 'ip_detection',
              description: 'IP Analysis Results',
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
                riskScore: ipRiskScore
              }
            }
          ]
        });
      }

      console.log(`✅ New device registered for user ${userId}: ${fingerprintData.fingerprintId} (Risk: ${baseRiskScore})`);

      return NextResponse.json({
        success: true,
        suspicious: false,
        message: 'New device registered',
        fingerprintId: newFingerprint.fingerprintId
      });
    }
  } catch (error) {
    console.error('Error tracking device fingerprint:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to track device' },
      { status: 500 }
    );
  }
}

