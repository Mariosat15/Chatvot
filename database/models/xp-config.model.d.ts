import { Document, Model } from 'mongoose';
export interface IXPConfig extends Document {
    configType: 'badge_xp' | 'level_progression';
    data: {
        common?: number;
        rare?: number;
        epic?: number;
        legendary?: number;
        levels?: Array<{
            level: number;
            title: string;
            minXP: number;
            maxXP: number;
            icon: string;
            color: string;
            description: string;
        }>;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const XPConfig: Model<IXPConfig>;
export default XPConfig;
//# sourceMappingURL=xp-config.model.d.ts.map