import { Document, Model } from 'mongoose';
interface IChallengeSettingsModel extends Model<IChallengeSettings> {
    getSingleton(): Promise<IChallengeSettings>;
    clearCache(): void;
}
export interface IChallengeSettings extends Document {
    platformFeePercentage: number;
    minEntryFee: number;
    maxEntryFee: number;
    defaultStartingCapital: number;
    minStartingCapital: number;
    maxStartingCapital: number;
    minDurationMinutes: number;
    maxDurationMinutes: number;
    defaultDurationMinutes: number;
    acceptDeadlineMinutes: number;
    defaultAssetClasses: ('stocks' | 'forex' | 'crypto' | 'indices')[];
    challengesEnabled: boolean;
    requireBothOnline: boolean;
    allowChallengeWhileInCompetition: boolean;
    challengeCooldownMinutes: number;
    maxPendingChallenges: number;
    maxActiveChallenges: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const ChallengeSettings: IChallengeSettingsModel;
export default ChallengeSettings;
//# sourceMappingURL=challenge-settings.model.d.ts.map