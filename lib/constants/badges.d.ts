export type BadgeCategory = 'Competition' | 'Trading' | 'Profit' | 'Risk' | 'Speed' | 'Consistency' | 'Volume' | 'Strategy' | 'Social' | 'Legendary';
export interface Badge {
    id: string;
    name: string;
    description: string;
    category: BadgeCategory;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    condition: {
        type: string;
        value?: number;
        comparison?: 'gte' | 'lte' | 'eq';
    };
}
export declare const BADGES: Badge[];
export declare const getBadgesByCategory: (category: BadgeCategory) => Badge[];
export declare const getBadgesByRarity: (rarity: Badge["rarity"]) => Badge[];
export declare const getBadgeById: (id: string) => Badge | undefined;
//# sourceMappingURL=badges.d.ts.map