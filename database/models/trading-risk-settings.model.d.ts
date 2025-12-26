import { Document, Model } from 'mongoose';
export interface ITradingRiskSettings extends Document {
    marginLiquidation: number;
    marginCall: number;
    marginWarning: number;
    marginSafe: number;
    maxOpenPositions: number;
    maxPositionSize: number;
    minLeverage: number;
    maxLeverage: number;
    defaultLeverage: number;
    maxDrawdownPercent: number;
    dailyLossLimit: number;
    marginCheckIntervalSeconds: number;
    updatedAt: Date;
    updatedBy?: string;
}
interface ITradingRiskSettingsModel extends Model<ITradingRiskSettings> {
    getSingleton(): Promise<ITradingRiskSettings>;
    updateSingleton(updates: Partial<ITradingRiskSettings>): Promise<ITradingRiskSettings>;
    clearCache(): void;
}
declare const TradingRiskSettings: ITradingRiskSettingsModel;
export default TradingRiskSettings;
//# sourceMappingURL=trading-risk-settings.model.d.ts.map