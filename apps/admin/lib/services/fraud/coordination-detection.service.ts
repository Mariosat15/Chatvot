import TradingBehaviorProfile from '@/database/models/fraud/trading-behavior-profile.model';
import { SuspicionScoringService } from '@/lib/services/fraud/suspicion-scoring.service';
import { AlertManagerService } from '@/lib/services/fraud/alert-manager.service';
import { connectToDatabase } from '@/database/mongoose';

/**
 * Coordination Detection Service
 * 
 * Detects coordinated activities between accounts such as:
 * - Simultaneous competition entries
 * - Accounts created within minutes of each other
 * - Similar first trade patterns
 */

interface CoordinationResult {
  detected: boolean;
  involvedUsers: string[];
  competitionId: string;
  timeSpan: number; // seconds between first and last entry
  averageGap: number;
  severity: 'low' | 'medium' | 'high';
}

export class CoordinationDetectionService {
  
  // Time window for coordinated entry detection (5 minutes)
  private static readonly COORDINATION_WINDOW_MINUTES = 5;
  
  // Minimum accounts for coordinated entry alert
  private static readonly MIN_COORDINATED_ACCOUNTS = 2;
  
  /**
   * Detect coordinated competition entries
   */
  static async detectCoordinatedEntry(
    competitionId: string,
    recentEntries: { userId: string; entryTime: Date }[]
  ): Promise<CoordinationResult | null> {
    await connectToDatabase();
    
    console.log(`🎯 Checking for coordinated entries in competition ${competitionId}`);
    console.log(`   Entries to analyze: ${recentEntries.length}`);
    
    recentEntries.forEach((entry, i) => {
      console.log(`   Entry ${i + 1}: User ${entry.userId.substring(0, 8)}... at ${entry.entryTime}`);
    });
    
    if (recentEntries.length < this.MIN_COORDINATED_ACCOUNTS) {
      console.log(`   ❌ Not enough entries (need ${this.MIN_COORDINATED_ACCOUNTS}+)`);
      return null;
    }
    
    // Sort by entry time
    const sortedEntries = [...recentEntries].sort(
      (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    );
    
    // Group entries within the coordination window
    const coordinatedGroups: { userId: string; entryTime: Date }[][] = [];
    let currentGroup: { userId: string; entryTime: Date }[] = [sortedEntries[0]];
    
    for (let i = 1; i < sortedEntries.length; i++) {
      const timeDiff = new Date(sortedEntries[i].entryTime).getTime() - 
                       new Date(currentGroup[currentGroup.length - 1].entryTime).getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      if (minutesDiff <= this.COORDINATION_WINDOW_MINUTES) {
        currentGroup.push(sortedEntries[i]);
      } else {
        if (currentGroup.length >= this.MIN_COORDINATED_ACCOUNTS) {
          coordinatedGroups.push(currentGroup);
        }
        currentGroup = [sortedEntries[i]];
      }
    }
    
    // Don't forget the last group
    if (currentGroup.length >= this.MIN_COORDINATED_ACCOUNTS) {
      coordinatedGroups.push(currentGroup);
    }
    
    // Process largest coordinated group
    if (coordinatedGroups.length === 0) {
      return null;
    }
    
    const largestGroup = coordinatedGroups.reduce(
      (max, group) => group.length > max.length ? group : max,
      coordinatedGroups[0]
    );
    
    const involvedUsers = largestGroup.map(e => e.userId);
    const firstEntry = new Date(largestGroup[0].entryTime).getTime();
    const lastEntry = new Date(largestGroup[largestGroup.length - 1].entryTime).getTime();
    const timeSpan = (lastEntry - firstEntry) / 1000; // seconds
    const averageGap = timeSpan / (largestGroup.length - 1);
    
    // Determine severity
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (largestGroup.length >= 4 || averageGap < 30) {
      severity = 'high';
    } else if (largestGroup.length >= 3 || averageGap < 60) {
      severity = 'medium';
    }
    
    console.log(`🚨 COORDINATED ENTRY DETECTED!`);
    console.log(`   Users: ${involvedUsers.length}`);
    console.log(`   Time span: ${timeSpan}s`);
    console.log(`   Severity: ${severity}`);
    
    // Update suspicion scores (+25 for coordinated entry)
    for (const userId of involvedUsers) {
      await SuspicionScoringService.updateScore(userId, {
        method: 'coordinatedEntry',
        percentage: 25,
        evidence: `Coordinated competition entry with ${involvedUsers.length - 1} other accounts (${Math.round(averageGap)}s avg gap)`,
        linkedUserIds: involvedUsers.filter(id => id !== userId),
        confidence: severity === 'high' ? 0.9 : severity === 'medium' ? 0.75 : 0.6
      });
    }
    
    // Create fraud alert - PER COMPETITION (allows separate alerts for each competition)
    await AlertManagerService.createOrUpdateAlert({
      alertType: 'coordinated_entry',
      userIds: involvedUsers,
      title: `Coordinated Competition Entry (${involvedUsers.length} accounts)`,
      description: `${involvedUsers.length} accounts entered competition within ${Math.round(timeSpan)}s of each other`,
      severity: severity === 'high' ? 'high' : 'medium',
      confidence: severity === 'high' ? 0.9 : severity === 'medium' ? 0.75 : 0.6,
      competitionId, // Pass competitionId for competition-specific tracking
      evidence: [{
        type: 'coordinated_entry',
        description: `${involvedUsers.length} accounts entered within ${this.COORDINATION_WINDOW_MINUTES} minutes`,
        data: {
          competitionId,
          involvedAccounts: involvedUsers.length,
          timeSpan: `${Math.round(timeSpan)}s`,
          averageGap: `${Math.round(averageGap)}s`,
          entrySequence: largestGroup.map((e, i) => ({
            position: i + 1,
            userId: e.userId,
            entryTime: new Date(e.entryTime).toISOString(),
            deltaFromFirst: i === 0 ? '0s' : `+${Math.round((new Date(e.entryTime).getTime() - firstEntry) / 1000)}s`
          })),
          connectedAccountIds: involvedUsers
        }
      }]
    });
    
    return {
      detected: true,
      involvedUsers,
      competitionId,
      timeSpan,
      averageGap,
      severity
    };
  }
  
  /**
   * Find nearby entries when a user enters a competition
   */
  static async findNearbyEntries(
    userId: string,
    competitionId: string,
    entryTime: Date,
    allEntries: { participantId: string; joinedAt: Date }[]
  ): Promise<{
    nearbyUsers: string[];
    timeDiffs: number[];
  }> {
    await connectToDatabase();
    
    const windowMs = this.COORDINATION_WINDOW_MINUTES * 60 * 1000;
    const entryTimeMs = new Date(entryTime).getTime();
    
    const nearbyEntries = allEntries.filter(e => {
      if (e.participantId === userId) return false;
      const diff = Math.abs(new Date(e.joinedAt).getTime() - entryTimeMs);
      return diff <= windowMs;
    });
    
    return {
      nearbyUsers: nearbyEntries.map(e => e.participantId),
      timeDiffs: nearbyEntries.map(e => 
        (new Date(e.joinedAt).getTime() - entryTimeMs) / 1000
      )
    };
  }
  
  /**
   * Track competition entry pattern for a user
   */
  static async trackCompetitionEntryPattern(
    userId: string,
    competitionId: string,
    entryTime: Date
  ): Promise<void> {
    await connectToDatabase();
    
    console.log(`📝 Tracking competition entry for user ${userId.substring(0, 8)}...`);
    
    const profile = await TradingBehaviorProfile.findOne({ userId });
    
    if (!profile) {
      // Create profile if doesn't exist
      await TradingBehaviorProfile.create({
        userId,
        competitionEntryTimes: [entryTime]
      });
    } else {
      profile.competitionEntryTimes.push(entryTime);
      await profile.save();
    }
  }
  
  /**
   * Detect rapid account creation (accounts created close together)
   */
  static async detectRapidAccountCreation(
    accounts: { userId: string; createdAt: Date }[]
  ): Promise<{
    groups: { userIds: string[]; timeSpan: number }[];
  }> {
    await connectToDatabase();
    
    const ONE_HOUR_MS = 60 * 60 * 1000;
    
    // Sort by creation time
    const sorted = [...accounts].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const groups: { userIds: string[]; timeSpan: number }[] = [];
    let currentGroup: { userId: string; createdAt: Date }[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const timeDiff = new Date(sorted[i].createdAt).getTime() - 
                       new Date(currentGroup[currentGroup.length - 1].createdAt).getTime();
      
      if (timeDiff <= ONE_HOUR_MS) {
        currentGroup.push(sorted[i]);
      } else {
        if (currentGroup.length >= 2) {
          const firstTime = new Date(currentGroup[0].createdAt).getTime();
          const lastTime = new Date(currentGroup[currentGroup.length - 1].createdAt).getTime();
          groups.push({
            userIds: currentGroup.map(a => a.userId),
            timeSpan: (lastTime - firstTime) / 1000
          });
        }
        currentGroup = [sorted[i]];
      }
    }
    
    // Don't forget last group
    if (currentGroup.length >= 2) {
      const firstTime = new Date(currentGroup[0].createdAt).getTime();
      const lastTime = new Date(currentGroup[currentGroup.length - 1].createdAt).getTime();
      groups.push({
        userIds: currentGroup.map(a => a.userId),
        timeSpan: (lastTime - firstTime) / 1000
      });
    }
    
    // Update suspicion scores for rapid creation
    for (const group of groups) {
      for (const userId of group.userIds) {
        await SuspicionScoringService.updateScore(userId, {
          method: 'rapidCreation',
          percentage: 20,
          evidence: `Account created within ${Math.round(group.timeSpan)}s of ${group.userIds.length - 1} other accounts`,
          linkedUserIds: group.userIds.filter(id => id !== userId),
          confidence: 0.7
        });
      }
      
      // Create fraud alert
      await AlertManagerService.createOrUpdateAlert({
        alertType: 'suspicious_behavior',
        userIds: group.userIds,
        title: `Rapid Account Creation (${group.userIds.length} accounts)`,
        description: `${group.userIds.length} accounts created within ${Math.round(group.timeSpan)}s`,
        severity: group.userIds.length >= 3 ? 'high' : 'medium',
        confidence: 0.7,
        evidence: [{
          type: 'rapid_creation',
          description: 'Multiple accounts created in rapid succession',
          data: {
            accountCount: group.userIds.length,
            timeSpan: `${Math.round(group.timeSpan)}s`,
            connectedAccountIds: group.userIds
          }
        }]
      });
    }
    
    return { groups };
  }
  
  /**
   * Analyze entry timing patterns for suspicious behavior
   */
  static async analyzeEntryTimingPatterns(
    competitionId: string,
    entries: { userId: string; entryTime: Date }[]
  ): Promise<{
    coordinatedGroups: string[][];
    suspiciousPatterns: {
      type: string;
      users: string[];
      confidence: number;
    }[];
  }> {
    await connectToDatabase();
    
    const coordinatedGroups: string[][] = [];
    const suspiciousPatterns: { type: string; users: string[]; confidence: number }[] = [];
    
    // Sort entries by time
    const sorted = [...entries].sort(
      (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    );
    
    // Find sequential entries (rapid fire)
    const rapidFireThreshold = 10; // seconds
    for (let i = 0; i < sorted.length - 1; i++) {
      const timeDiff = (new Date(sorted[i + 1].entryTime).getTime() - 
                        new Date(sorted[i].entryTime).getTime()) / 1000;
      
      if (timeDiff <= rapidFireThreshold) {
        const group = [sorted[i].userId, sorted[i + 1].userId];
        
        // Check if extends existing group
        const existingGroupIndex = coordinatedGroups.findIndex(
          g => g.includes(sorted[i].userId)
        );
        
        if (existingGroupIndex >= 0) {
          if (!coordinatedGroups[existingGroupIndex].includes(sorted[i + 1].userId)) {
            coordinatedGroups[existingGroupIndex].push(sorted[i + 1].userId);
          }
        } else {
          coordinatedGroups.push(group);
        }
      }
    }
    
    // Detect "burst" patterns (multiple entries in very short window)
    const burstWindow = 30; // seconds
    const burstThreshold = 3; // minimum entries
    
    for (let i = 0; i < sorted.length; i++) {
      const burstEnd = new Date(sorted[i].entryTime).getTime() + burstWindow * 1000;
      const burstEntries = sorted.filter(e => {
        const time = new Date(e.entryTime).getTime();
        return time >= new Date(sorted[i].entryTime).getTime() && time <= burstEnd;
      });
      
      if (burstEntries.length >= burstThreshold) {
        const users = burstEntries.map(e => e.userId);
        const unique = [...new Set(users)];
        
        if (unique.length >= burstThreshold) {
          suspiciousPatterns.push({
            type: 'burst_entry',
            users: unique,
            confidence: Math.min(0.95, 0.5 + unique.length * 0.1)
          });
        }
      }
    }
    
    // Remove duplicate patterns
    const uniquePatterns = suspiciousPatterns.filter((pattern, index, self) =>
      index === self.findIndex(p => 
        p.type === pattern.type && 
        p.users.sort().join(',') === pattern.users.sort().join(',')
      )
    );
    
    return {
      coordinatedGroups,
      suspiciousPatterns: uniquePatterns
    };
  }
}

