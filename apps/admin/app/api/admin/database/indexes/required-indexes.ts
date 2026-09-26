/**
 * Comprehensive list of required MongoDB indexes for the ChartVolt platform.
 * Used by the Database Indexes tab in admin Dev Zone to audit and create missing indexes.
 *
 * Collection names must match actual DB names:
 *   - "user" / "session" / "account" = Better Auth collections
 *   - Mongoose defaults = lowercased plural of model name
 *   - Explicit `collection:` options in schemas override the default
 *
 * Every entry here was verified against the actual Mongoose schema `.index()` calls.
 */

export interface RequiredIndex {
  keys: Record<string, number>;
  options: { name: string; unique?: boolean; expireAfterSeconds?: number };
}

export const REQUIRED_INDEXES: Record<string, RequiredIndex[]> = {
  // ── BETTER-AUTH CORE (session, user, account) ──────────────────
  session: [
    { keys: { token: 1 }, options: { unique: true, name: "token_1" } },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "expiresAt_ttl" } },
  ],
  account: [
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { providerId: 1, accountId: 1 }, options: { name: "providerId_1_accountId_1" } },
  ],
  user: [
    { keys: { id: 1 }, options: { name: "id_1" } },
    { keys: { email: 1 }, options: { unique: true, name: "email_1" } },
    { keys: { role: 1 }, options: { name: "role_1" } },
    { keys: { email: 1, role: 1 }, options: { name: "email_1_role_1" } },
  ],
  users: [
    { keys: { email: 1 }, options: { unique: true, name: "email_1" } },
    { keys: { username: 1 }, options: { name: "username_1" } },
    { keys: { role: 1 }, options: { name: "role_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  userpresences: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { status: 1 }, options: { name: "status_1" } },
    { keys: { lastHeartbeat: -1 }, options: { name: "lastHeartbeat_-1" } },
    { keys: { status: 1, acceptingChallenges: 1 }, options: { name: "status_1_acceptingChallenges_1" } },
  ],
  userlevels: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { currentXP: -1 }, options: { name: "currentXP_-1" } },
    { keys: { level: -1 }, options: { name: "level_-1" } },
  ],
  userbadges: [
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { userId: 1, badgeId: 1 }, options: { unique: true, name: "userId_1_badgeId_1" } },
    { keys: { badgeId: 1 }, options: { name: "badgeId_1" } },
  ],

  // ── COMPETITIONS ───────────────────────────────────────────────
  competitions: [
    { keys: { status: 1, startTime: 1 }, options: { name: "status_1_startTime_1" } },
    { keys: { status: 1, endTime: 1 }, options: { name: "status_1_endTime_1" } },
    { keys: { slug: 1 }, options: { unique: true, name: "slug_1" } },
    { keys: { endTime: 1 }, options: { name: "endTime_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  competitionparticipants: [
    { keys: { competitionId: 1, userId: 1 }, options: { unique: true, name: "competitionId_1_userId_1" } },
    { keys: { competitionId: 1, status: 1 }, options: { name: "competitionId_1_status_1" } },
    { keys: { competitionId: 1, pnl: -1 }, options: { name: "competitionId_1_pnl_-1" } },
    { keys: { competitionId: 1, currentCapital: -1 }, options: { name: "competitionId_1_currentCapital_-1" } },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { userId: 1, currentRank: 1 }, options: { name: "userId_1_currentRank_1" } },
    { keys: { currentRank: 1 }, options: { name: "currentRank_1" } },
  ],

  // ── CHALLENGES ─────────────────────────────────────────────────
  challenges: [
    { keys: { status: 1, endTime: 1 }, options: { name: "status_1_endTime_1" } },
    { keys: { status: 1, acceptDeadline: 1 }, options: { name: "status_1_acceptDeadline_1" } },
    { keys: { challengerId: 1 }, options: { name: "challengerId_1" } },
    { keys: { challengedId: 1 }, options: { name: "challengedId_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  challengeparticipants: [
    { keys: { challengeId: 1 }, options: { name: "challengeId_1" } },
    { keys: { challengeId: 1, role: 1 }, options: { name: "challengeId_1_role_1" } },
    { keys: { challengeId: 1, status: 1 }, options: { name: "challengeId_1_status_1" } },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { userId: 1, isWinner: 1 }, options: { name: "userId_1_isWinner_1" } },
  ],

  // ── TRADING ────────────────────────────────────────────────────
  tradingpositions: [
    { keys: { participantId: 1, status: 1 }, options: { name: "participantId_1_status_1" } },
    { keys: { competitionId: 1, status: 1 }, options: { name: "competitionId_1_status_1" } },
    { keys: { userId: 1, status: 1 }, options: { name: "userId_1_status_1" } },
    { keys: { symbol: 1, status: 1 }, options: { name: "symbol_1_status_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
    { keys: { closedAt: -1 }, options: { name: "closedAt_-1" } },
  ],
  tradingorders: [
    { keys: { participantId: 1, status: 1 }, options: { name: "participantId_1_status_1" } },
    { keys: { competitionId: 1, status: 1 }, options: { name: "competitionId_1_status_1" } },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  tradehistories: [
    { keys: { competitionId: 1, closedAt: -1 }, options: { name: "competitionId_1_closedAt_-1" } },
    { keys: { userId: 1, closedAt: -1 }, options: { name: "userId_1_closedAt_-1" } },
    { keys: { participantId: 1, closedAt: -1 }, options: { name: "participantId_1_closedAt_-1" } },
    { keys: { symbol: 1, closedAt: -1 }, options: { name: "symbol_1_closedAt_-1" } },
    { keys: { competitionId: 1, isWinner: 1 }, options: { name: "competitionId_1_isWinner_1" } },
    { keys: { userId: 1, isWinner: 1 }, options: { name: "userId_1_isWinner_1" } },
    { keys: { userId: 1, competitionId: 1, closedAt: -1 }, options: { name: "userId_1_competitionId_1_closedAt_-1" } },
    { keys: { competitionId: 1, realizedPnl: -1 }, options: { name: "competitionId_1_realizedPnl_-1" } },
    { keys: { closeReason: 1, closedAt: -1 }, options: { name: "closeReason_1_closedAt_-1" } },
  ],
  tradingsymbols: [
    { keys: { symbol: 1 }, options: { unique: true, name: "symbol_1" } },
    { keys: { enabled: 1, category: 1 }, options: { name: "enabled_1_category_1" } },
    { keys: { category: 1, sortOrder: 1 }, options: { name: "category_1_sortOrder_1" } },
    { keys: { popular: 1, enabled: 1 }, options: { name: "popular_1_enabled_1" } },
  ],
  positionevents: [
    { keys: { userId: 1, competitionId: 1, createdAt: -1 }, options: { name: "userId_1_competitionId_1_createdAt_-1" } },
    { keys: { createdAt: 1 }, options: { expireAfterSeconds: 60, name: "createdAt_ttl" } },
  ],

  // ── WALLET & FINANCIAL ─────────────────────────────────────────
  withdrawalrequests: [
    { keys: { userId: 1, status: 1, createdAt: -1 }, options: { name: "userId_1_status_1_createdAt_-1" } },
    { keys: { status: 1, createdAt: -1 }, options: { name: "status_1_createdAt_-1" } },
    { keys: { isSandbox: 1, status: 1 }, options: { name: "isSandbox_1_status_1" } },
    { keys: { requestedAt: -1 }, options: { name: "requestedAt_-1" } },
    { keys: { payoutId: 1 }, options: { name: "payoutId_1" } },
  ],
  wallets: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { balance: -1 }, options: { name: "balance_-1" } },
  ],
  creditwallets: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
  ],
  wallettransactions: [
    { keys: { userId: 1, createdAt: -1 }, options: { name: "userId_1_createdAt_-1" } },
    { keys: { walletId: 1, type: 1 }, options: { name: "walletId_1_type_1" } },
    { keys: { status: 1 }, options: { name: "status_1" } },
    { keys: { transactionType: 1, status: 1, createdAt: -1 }, options: { name: "transactionType_1_status_1_createdAt_-1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
    { keys: { competitionId: 1 }, options: { name: "competitionId_1" } },
    { keys: { challengeId: 1 }, options: { name: "challengeId_1" } },
  ],
  platformtransactions: [
    { keys: { type: 1, createdAt: -1 }, options: { name: "type_1_createdAt_-1" } },
    { keys: { competitionId: 1 }, options: { name: "competitionId_1" } },
    { keys: { challengeId: 1 }, options: { name: "challengeId_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  nuveiuserpaymentoptions: [
    { keys: { userId: 1, userPaymentOptionId: 1 }, options: { unique: true, name: "userId_1_userPaymentOptionId_1" } },
    { keys: { userId: 1, isActive: 1, lastUsed: -1 }, options: { name: "userId_1_isActive_1_lastUsed_-1" } },
  ],

  // ── NOTIFICATIONS ──────────────────────────────────────────────
  notifications: [
    { keys: { userId: 1, isRead: 1 }, options: { name: "userId_1_isRead_1" } },
    { keys: { userId: 1, isRead: 1, createdAt: -1 }, options: { name: "userId_1_isRead_1_createdAt_-1" } },
    { keys: { userId: 1, category: 1, createdAt: -1 }, options: { name: "userId_1_category_1_createdAt_-1" } },
    { keys: { userId: 1, createdAt: -1 }, options: { name: "userId_1_createdAt_-1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  notificationtemplates: [
    { keys: { templateId: 1 }, options: { unique: true, name: "templateId_1" } },
    { keys: { isEnabled: 1, category: 1, name: 1 }, options: { name: "isEnabled_1_category_1_name_1" } },
  ],
  emailtemplates: [
    { keys: { templateType: 1 }, options: { unique: true, name: "templateType_1" } },
  ],
  systemannouncements: [
    { keys: { status: 1, isActive: 1 }, options: { name: "status_1_isActive_1" } },
    { keys: { scheduledStart: 1, scheduledEnd: 1 }, options: { name: "scheduledStart_1_scheduledEnd_1" } },
  ],

  // ── MESSAGING ──────────────────────────────────────────────────
  conversations: [
    { keys: { "participants.id": 1, status: 1 }, options: { name: "participants.id_1_status_1" } },
    { keys: { assignedEmployeeId: 1, status: 1 }, options: { name: "assignedEmployeeId_1_status_1" } },
    { keys: { type: 1, status: 1, lastActivityAt: -1 }, options: { name: "type_1_status_1_lastActivityAt_-1" } },
    { keys: { isAIHandled: 1, type: 1 }, options: { name: "isAIHandled_1_type_1" } },
    { keys: { lastActivityAt: -1 }, options: { name: "lastActivityAt_-1" } },
  ],
  messages: [
    { keys: { conversationId: 1, createdAt: -1 }, options: { name: "conversationId_1_createdAt_-1" } },
    { keys: { conversationId: 1, isDeleted: 1, createdAt: -1 }, options: { name: "conversationId_1_isDeleted_1_createdAt_-1" } },
    { keys: { senderId: 1, createdAt: -1 }, options: { name: "senderId_1_createdAt_-1" } },
  ],
  friend_requests: [
    { keys: { fromUserId: 1, toUserId: 1, status: 1 }, options: { name: "fromUserId_1_toUserId_1_status_1" } },
    { keys: { toUserId: 1, status: 1, createdAt: -1 }, options: { name: "toUserId_1_status_1_createdAt_-1" } },
  ],
  friendships: [
    { keys: { users: 1 }, options: { unique: true, name: "users_1" } },
    { keys: { "userDetails.userId": 1 }, options: { name: "userDetails.userId_1" } },
  ],

  // ── MARKET DATA (PRICE & CANDLES) ──────────────────────────────
  pricecaches: [
    { keys: { symbol: 1 }, options: { unique: true, name: "symbol_1" } },
  ],
  pricelogs: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { timestamp: 1 }, options: { expireAfterSeconds: 86400, name: "timestamp_1_ttl" } },
  ],
  candles_1m: [
    { keys: { symbol: 1, t: -1 }, options: { name: "symbol_1_t_-1" } },
    { keys: { symbol: 1, t: 1 }, options: { unique: true, name: "symbol_1_t_1" } },
  ],
  candles_historical_1m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],
  candles_historical_5m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],
  candles_historical_15m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],
  candles_historical_30m: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],
  candles_historical_1h: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],
  candles_historical_4h: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],
  candles_historical_1d: [
    { keys: { symbol: 1, timestamp: -1 }, options: { name: "symbol_1_timestamp_-1" } },
    { keys: { symbol: 1, timestamp: 1 }, options: { name: "symbol_1_timestamp_1" } },
  ],

  // ── MARKETPLACE ────────────────────────────────────────────────
  marketplaceitems: [
    { keys: { slug: 1 }, options: { unique: true, name: "slug_1" } },
    { keys: { category: 1, isActive: 1 }, options: { name: "category_1_isActive_1" } },
    { keys: { isActive: 1 }, options: { name: "isActive_1" } },
  ],
  userpurchases: [
    { keys: { userId: 1, itemId: 1 }, options: { unique: true, name: "userId_1_itemId_1" } },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
  ],

  // ── FRAUD & SECURITY ──────────────────────────────────────────
  auditlogs: [
    { keys: { userId: 1, createdAt: -1 }, options: { name: "userId_1_createdAt_-1" } },
    { keys: { action: 1, createdAt: -1 }, options: { name: "action_1_createdAt_-1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  fraudevents: [
    { keys: { userId: 1, createdAt: -1 }, options: { name: "userId_1_createdAt_-1" } },
    { keys: { type: 1, createdAt: -1 }, options: { name: "type_1_createdAt_-1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  fraudalerts: [
    { keys: { status: 1, severity: -1 }, options: { name: "status_1_severity_-1" } },
    { keys: { competitionId: 1 }, options: { name: "competitionId_1" } },
    { keys: { detectedAt: -1 }, options: { name: "detectedAt_-1" } },
    { keys: { primaryUserId: 1 }, options: { name: "primaryUserId_1" } },
    { keys: { suspiciousUserIds: 1 }, options: { name: "suspiciousUserIds_1" } },
  ],
  suspicionscores: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { userId: 1, totalScore: -1 }, options: { name: "userId_1_totalScore_-1" } },
    { keys: { riskLevel: 1, lastUpdated: -1 }, options: { name: "riskLevel_1_lastUpdated_-1" } },
    { keys: { "linkedAccounts.userId": 1 }, options: { name: "linkedAccounts.userId_1" } },
    { keys: { totalScore: -1, riskLevel: 1 }, options: { name: "totalScore_-1_riskLevel_1" } },
  ],
  userrestrictions: [
    { keys: { userId: 1, isActive: 1 }, options: { name: "userId_1_isActive_1" } },
    { keys: { expiresAt: 1, isActive: 1 }, options: { name: "expiresAt_1_isActive_1" } },
    { keys: { restrictedBy: 1 }, options: { name: "restrictedBy_1" } },
    { keys: { relatedFraudAlertId: 1 }, options: { name: "relatedFraudAlertId_1" } },
  ],
  accountlockouts: [
    { keys: { email: 1, isActive: 1 }, options: { name: "email_1_isActive_1" } },
    { keys: { userId: 1, isActive: 1 }, options: { name: "userId_1_isActive_1" } },
    { keys: { lockedUntil: 1, isActive: 1 }, options: { name: "lockedUntil_1_isActive_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  devicefingerprints: [
    { keys: { fingerprintId: 1, userId: 1 }, options: { unique: true, name: "fingerprintId_1_userId_1" } },
    { keys: { ipAddress: 1 }, options: { name: "ipAddress_1" } },
    { keys: { linkedUserIds: 1 }, options: { name: "linkedUserIds_1" } },
    { keys: { riskScore: -1 }, options: { name: "riskScore_-1" } },
  ],
  tradingbehaviorprofiles: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { lastUpdated: -1 }, options: { name: "lastUpdated_-1" } },
  ],
  securitylogs: [
    { keys: { userId: 1, createdAt: -1 }, options: { name: "userId_1_createdAt_-1" } },
    { keys: { category: 1, createdAt: -1 }, options: { name: "category_1_createdAt_-1" } },
    { keys: { suspicious: 1, createdAt: -1 }, options: { name: "suspicious_1_createdAt_-1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],

  // ── KYC ────────────────────────────────────────────────────────
  kycsessions: [
    { keys: { userId: 1, status: 1 }, options: { name: "userId_1_status_1" } },
    { keys: { veriffSessionId: 1 }, options: { unique: true, name: "veriffSessionId_1" } },
    { keys: { status: 1, createdAt: -1 }, options: { name: "status_1_createdAt_-1" } },
    { keys: { documentFingerprint: 1, status: 1 }, options: { name: "documentFingerprint_1_status_1" } },
    { keys: { "documentData.number": 1, "documentData.country": 1 }, options: { name: "documentData.number_1_documentData.country_1" } },
    { keys: { "personData.idNumber": 1 }, options: { name: "personData.idNumber_1" } },
  ],

  // ── JOURNEY ────────────────────────────────────────────────────
  userjourneyprogresses: [
    { keys: { userId: 1, mapId: 1 }, options: { unique: true, name: "userId_1_mapId_1" } },
    { keys: { totalMilestonesCompleted: -1 }, options: { name: "totalMilestonesCompleted_-1" } },
    { keys: { totalXPFromJourney: -1 }, options: { name: "totalXPFromJourney_-1" } },
  ],
  journeymilestones: [
    { keys: { id: 1, mapId: 1 }, options: { unique: true, name: "id_1_mapId_1" } },
    { keys: { mapId: 1, zoneId: 1 }, options: { name: "mapId_1_zoneId_1" } },
    { keys: { mapId: 1, order: 1 }, options: { name: "mapId_1_order_1" } },
  ],
  journeymapconfigs: [
    { keys: { mapId: 1 }, options: { unique: true, name: "mapId_1" } },
    { keys: { isActive: 1, sequenceOrder: 1 }, options: { name: "isActive_1_sequenceOrder_1" } },
  ],

  // ── GAME MASTER ────────────────────────────────────────────────
  gamemasterearnings: [
    { keys: { gameMasterId: 1, createdAt: -1 }, options: { name: "gameMasterId_1_createdAt_-1" } },
    { keys: { gameMasterId: 1, status: 1 }, options: { name: "gameMasterId_1_status_1" } },
    { keys: { sourceType: 1, sourceId: 1 }, options: { name: "sourceType_1_sourceId_1" } },
    { keys: { referredUserId: 1, gameMasterId: 1 }, options: { name: "referredUserId_1_gameMasterId_1" } },
  ],
  userreferrals: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { gameMasterId: 1 }, options: { name: "gameMasterId_1" } },
    { keys: { referralCode: 1 }, options: { name: "referralCode_1" } },
  ],

  // ── SERVER FLEET ───────────────────────────────────────────────
  servers: [
    { keys: { serverId: 1 }, options: { unique: true, name: "serverId_1" } },
    { keys: { lastHeartbeat: -1 }, options: { name: "lastHeartbeat_-1" } },
  ],

  // ── BADGE CONFIGURATION ────────────────────────────────────────
  badgeconfigs: [
    { keys: { id: 1 }, options: { unique: true, name: "id_1" } },
    { keys: { isActive: 1, category: 1 }, options: { name: "isActive_1_category_1" } },
  ],
};
