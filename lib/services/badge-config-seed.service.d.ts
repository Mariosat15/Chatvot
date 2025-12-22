/**
 * Seed default badge configurations to database
 */
export declare function seedBadgeConfigs(): Promise<void>;
/**
 * Seed default XP configurations to database
 */
export declare function seedXPConfigs(): Promise<void>;
/**
 * Reset badge and XP configurations to defaults
 */
export declare function resetBadgeAndXPConfigs(): Promise<{
    success: boolean;
}>;
/**
 * Get all badges from database (fallback to constants if DB is empty)
 */
export declare function getBadgesFromDB(): Promise<import("@/lib/constants/badges").Badge[] | {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    condition: import("mongoose").FlattenMaps<{
        type: string;
        value?: number;
        minValue?: number;
        maxValue?: number;
        comparison?: string;
    }>;
    isActive: boolean;
}[]>;
/**
 * Get XP configuration from database (fallback to constants if DB is empty)
 */
export declare function getXPConfigFromDB(): Promise<{
    badgeXP: {
        readonly common: 10;
        readonly rare: 25;
        readonly epic: 50;
        readonly legendary: 100;
    } | import("mongoose").FlattenMaps<{
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
    }>;
    levels: import("@/lib/constants/levels").TitleLevel[];
} | {
    badgeXP: import("mongoose").FlattenMaps<{
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
    }>;
    levels: import("mongoose").FlattenMaps<{
        level: number;
        title: string;
        minXP: number;
        maxXP: number;
        icon: string;
        color: string;
        description: string;
    }>[] | undefined;
}>;
//# sourceMappingURL=badge-config-seed.service.d.ts.map