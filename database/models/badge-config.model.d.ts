import { Document, Model } from 'mongoose';
export interface IBadgeConfig extends Document {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    condition: {
        type: string;
        value?: number;
        minValue?: number;
        maxValue?: number;
        comparison?: string;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const BadgeConfig: Model<IBadgeConfig>;
export default BadgeConfig;
//# sourceMappingURL=badge-config.model.d.ts.map