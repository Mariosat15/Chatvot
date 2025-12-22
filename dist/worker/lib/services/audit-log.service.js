"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = void 0;
const audit_log_model_1 = __importDefault(require("@/database/models/audit-log.model"));
const mongoose_1 = require("@/database/mongoose");
const headers_1 = require("next/headers");
/**
 * Audit Log Service
 * Provides easy-to-use methods for logging admin actions
 */
exports.auditLogService = {
    /**
     * Log a generic admin action
     */
    async log(params) {
        try {
            await (0, mongoose_1.connectToDatabase)();
            // Get request info from headers (if available)
            let ipAddress;
            let userAgent;
            let requestPath;
            try {
                const headersList = await (0, headers_1.headers)();
                ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;
                userAgent = headersList.get('user-agent') || undefined;
                requestPath = headersList.get('x-invoke-path') || undefined;
            }
            catch {
                // Headers not available (e.g., in non-request context)
            }
            await audit_log_model_1.default.logAction({
                userId: params.admin.id || 'unknown',
                userName: params.admin.name || (params.admin.email ? params.admin.email.split('@')[0] : 'Admin'),
                userEmail: params.admin.email || 'unknown@admin',
                userRole: params.admin.role || 'admin',
                action: params.action,
                actionCategory: params.category,
                description: params.description,
                targetType: params.targetType,
                targetId: params.targetId,
                targetName: params.targetName,
                metadata: params.metadata,
                previousValue: params.previousValue,
                newValue: params.newValue,
                ipAddress,
                userAgent,
                requestPath,
                status: params.status || 'success',
                errorMessage: params.errorMessage,
            });
        }
        catch (error) {
            console.error('Failed to log audit action:', error);
            // Don't throw - audit logging should not break the main flow
        }
    },
    // ==================== USER MANAGEMENT ====================
    async logUserCreated(admin, userId, userEmail, userName) {
        await this.log({
            admin,
            action: 'user_created',
            category: 'user_management',
            description: `Created new user: ${userName} (${userEmail})`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
        });
    },
    async logUserUpdated(admin, userId, userName, changes) {
        await this.log({
            admin,
            action: 'user_updated',
            category: 'user_management',
            description: `Updated user: ${userName}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
            metadata: { changes },
        });
    },
    async logUserDeleted(admin, userId, userName, userEmail) {
        await this.log({
            admin,
            action: 'user_deleted',
            category: 'user_management',
            description: `Deleted user: ${userName} (${userEmail})`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
        });
    },
    async logUserBanned(admin, userId, userName, reason) {
        await this.log({
            admin,
            action: 'user_banned',
            category: 'user_management',
            description: `Banned user: ${userName}${reason ? ` - Reason: ${reason}` : ''}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
            metadata: { reason },
        });
    },
    async logUserUnbanned(admin, userId, userName) {
        await this.log({
            admin,
            action: 'user_unbanned',
            category: 'user_management',
            description: `Unbanned user: ${userName}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
        });
    },
    async logUserRestricted(admin, userId, userName, restrictions) {
        await this.log({
            admin,
            action: 'user_restricted',
            category: 'user_management',
            description: `Applied restrictions to user: ${userName}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
            metadata: { restrictions },
        });
    },
    // ==================== FINANCIAL ====================
    async logWithdrawalApproved(admin, withdrawalId, userId, userName, amount) {
        await this.log({
            admin,
            action: 'withdrawal_approved',
            category: 'financial',
            description: `Approved withdrawal of ${amount} credits for ${userName}`,
            targetType: 'transaction',
            targetId: withdrawalId,
            targetName: userName,
            metadata: { amount, userId },
        });
    },
    async logWithdrawalRejected(admin, withdrawalId, userId, userName, amount, reason) {
        await this.log({
            admin,
            action: 'withdrawal_rejected',
            category: 'financial',
            description: `Rejected withdrawal of ${amount} credits for ${userName}${reason ? ` - Reason: ${reason}` : ''}`,
            targetType: 'transaction',
            targetId: withdrawalId,
            targetName: userName,
            metadata: { amount, userId, reason },
        });
    },
    async logAdminWithdrawal(admin, amount, amountEUR, bankInfo) {
        await this.log({
            admin,
            action: 'admin_withdrawal',
            category: 'financial',
            description: `Recorded admin withdrawal: €${amountEUR.toFixed(2)} to ${bankInfo}`,
            targetType: 'system',
            metadata: { amount, amountEUR, bankInfo },
        });
    },
    async logVATPayment(admin, amount, reference) {
        await this.log({
            admin,
            action: 'vat_payment',
            category: 'financial',
            description: `Recorded VAT payment: €${amount.toFixed(2)} (Ref: ${reference})`,
            targetType: 'system',
            metadata: { amount, reference },
        });
    },
    async logCreditsAdjusted(admin, userId, userName, previousBalance, newBalance, reason) {
        await this.log({
            admin,
            action: 'credits_adjusted',
            category: 'financial',
            description: `Adjusted credits for ${userName}: ${previousBalance} → ${newBalance}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
            previousValue: previousBalance,
            newValue: newBalance,
            metadata: { reason },
        });
    },
    // ==================== COMPETITION ====================
    async logCompetitionCreated(admin, competitionId, competitionName) {
        await this.log({
            admin,
            action: 'competition_created',
            category: 'competition',
            description: `Created competition: ${competitionName}`,
            targetType: 'competition',
            targetId: competitionId,
            targetName: competitionName,
        });
    },
    async logCompetitionUpdated(admin, competitionId, competitionName, changes) {
        await this.log({
            admin,
            action: 'competition_updated',
            category: 'competition',
            description: `Updated competition: ${competitionName}`,
            targetType: 'competition',
            targetId: competitionId,
            targetName: competitionName,
            metadata: { changes },
        });
    },
    async logCompetitionDeleted(admin, competitionId, competitionName) {
        await this.log({
            admin,
            action: 'competition_deleted',
            category: 'competition',
            description: `Deleted competition: ${competitionName}`,
            targetType: 'competition',
            targetId: competitionId,
            targetName: competitionName,
        });
    },
    async logCompetitionCancelled(admin, competitionId, competitionName, reason) {
        await this.log({
            admin,
            action: 'competition_cancelled',
            category: 'competition',
            description: `Cancelled competition: ${competitionName}${reason ? ` - Reason: ${reason}` : ''}`,
            targetType: 'competition',
            targetId: competitionId,
            targetName: competitionName,
            metadata: { reason },
        });
    },
    // ==================== SETTINGS ====================
    async logSettingsUpdated(admin, settingName, previousValue, newValue) {
        await this.log({
            admin,
            action: 'settings_updated',
            category: 'settings',
            description: `Updated settings: ${settingName}`,
            targetType: 'settings',
            targetName: settingName,
            previousValue,
            newValue,
        });
    },
    async logFeeConfigUpdated(admin, feeType, previousValue, newValue) {
        await this.log({
            admin,
            action: 'fee_config_updated',
            category: 'settings',
            description: `Updated ${feeType}: ${previousValue}% → ${newValue}%`,
            targetType: 'settings',
            targetName: feeType,
            previousValue,
            newValue,
        });
    },
    async logPaymentProviderUpdated(admin, providerName, enabled) {
        await this.log({
            admin,
            action: 'payment_provider_updated',
            category: 'settings',
            description: `${enabled ? 'Enabled' : 'Disabled'} payment provider: ${providerName}`,
            targetType: 'settings',
            targetName: providerName,
            metadata: { enabled },
        });
    },
    async logPaymentProviderCreated(admin, providerId, providerName) {
        await this.log({
            admin,
            action: 'payment_provider_created',
            category: 'settings',
            description: `Created payment provider: ${providerName}`,
            targetType: 'settings',
            targetId: providerId,
            targetName: providerName,
        });
    },
    async logEmailConfigUpdated(admin) {
        await this.log({
            admin,
            action: 'email_config_updated',
            category: 'settings',
            description: 'Updated email configuration',
            targetType: 'settings',
            targetName: 'email_config',
        });
    },
    async logInvoiceSettingsUpdated(admin) {
        await this.log({
            admin,
            action: 'invoice_settings_updated',
            category: 'settings',
            description: 'Updated invoice settings',
            targetType: 'settings',
            targetName: 'invoice_settings',
        });
    },
    async logCompanySettingsUpdated(admin) {
        await this.log({
            admin,
            action: 'company_settings_updated',
            category: 'settings',
            description: 'Updated company settings',
            targetType: 'settings',
            targetName: 'company_settings',
        });
    },
    // ==================== SECURITY ====================
    async logFraudInvestigationStarted(admin, userId, userName) {
        await this.log({
            admin,
            action: 'fraud_investigation_started',
            category: 'security',
            description: `Started fraud investigation for user: ${userName}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
        });
    },
    async logFraudInvestigationCompleted(admin, userId, userName, verdict) {
        await this.log({
            admin,
            action: 'fraud_investigation_completed',
            category: 'security',
            description: `Completed fraud investigation for ${userName}: ${verdict}`,
            targetType: 'user',
            targetId: userId,
            targetName: userName,
            metadata: { verdict },
        });
    },
    async logSecurityAlertHandled(admin, alertId, alertType, action) {
        await this.log({
            admin,
            action: 'security_alert_handled',
            category: 'security',
            description: `Handled ${alertType} alert: ${action}`,
            targetType: 'system',
            targetId: alertId,
            metadata: { alertType, action },
        });
    },
    // ==================== DATA ====================
    async logDatabaseReset(admin, deletedCounts) {
        await this.log({
            admin,
            action: 'database_reset',
            category: 'data',
            description: 'Reset all database data',
            targetType: 'system',
            metadata: { deletedCounts },
        });
    },
    async logDataExported(admin, exportType, recordCount) {
        await this.log({
            admin,
            action: 'data_exported',
            category: 'data',
            description: `Exported ${recordCount} ${exportType} records`,
            targetType: 'system',
            metadata: { exportType, recordCount },
        });
    },
    async logInvoicesExported(admin, count, dateRange, format) {
        await this.log({
            admin,
            action: 'invoices_exported',
            category: 'data',
            description: `Exported ${count} invoices (${dateRange.start} to ${dateRange.end}) as ${format.toUpperCase()}`,
            targetType: 'system',
            metadata: { count, dateRange, format },
        });
    },
    // ==================== SYSTEM ====================
    async logAdminLogin(admin) {
        await this.log({
            admin,
            action: 'admin_login',
            category: 'system',
            description: `Admin logged in: ${admin.email}`,
            targetType: 'system',
        });
    },
    async logAdminLogout(admin) {
        await this.log({
            admin,
            action: 'admin_logout',
            category: 'system',
            description: `Admin logged out: ${admin.email}`,
            targetType: 'system',
        });
    },
    async logSystemAction(admin, action, description, metadata) {
        await this.log({
            admin,
            action,
            category: 'system',
            description,
            targetType: 'system',
            metadata,
        });
    },
};
exports.default = exports.auditLogService;
