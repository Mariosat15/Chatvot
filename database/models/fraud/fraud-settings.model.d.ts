import { Document } from 'mongoose';
export interface IFraudSettings extends Document {
    deviceFingerprintingEnabled: boolean;
    deviceFingerprintBlockThreshold: number;
    vpnDetectionEnabled: boolean;
    blockVPN: boolean;
    blockProxy: boolean;
    blockTor: boolean;
    vpnRiskScore: number;
    proxyRiskScore: number;
    torRiskScore: number;
    multiAccountDetectionEnabled: boolean;
    maxAccountsPerDevice: number;
    entryBlockThreshold: number;
    alertThreshold: number;
    autoSuspendEnabled: boolean;
    autoSuspendThreshold: number;
    maxSignupsPerHour: number;
    maxEntriesPerHour: number;
    whitelistedIPs: string[];
    whitelistedFingerprints: string[];
    updatedAt: Date;
    updatedBy?: string;
}
declare const FraudSettings: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default FraudSettings;
export declare const DEFAULT_FRAUD_SETTINGS: Partial<IFraudSettings>;
//# sourceMappingURL=fraud-settings.model.d.ts.map