export type ContestType = 'competition' | 'challenge';
export interface ContestData {
    type: ContestType;
    contest: any;
    participant: any;
    status: string;
    leverage: {
        enabled: boolean;
        min?: number;
        max: number;
    };
    maxPositionSize: number;
    maxOpenPositions: number;
    allowShortSelling: boolean;
    marginCallThreshold: number;
    riskLimits?: {
        enabled: boolean;
        maxDrawdownPercent?: number;
        dailyLossLimitPercent?: number;
        dailyLossLimitEnabled?: boolean;
    };
    startingCapital: number;
    assetClasses: string[];
}
/**
 * Get contest (competition or challenge) and participant data
 * First tries to find a competition, then falls back to challenge
 */
export declare function getContestAndParticipant(contestId: string, userId: string): Promise<ContestData | null>;
/**
 * Update participant stats after a trade
 * Works for both competition and challenge participants
 */
export declare function updateParticipantStats(contestId: string, userId: string, updates: Record<string, any>): Promise<boolean>;
/**
 * Get participant for a contest
 */
export declare function getParticipant(contestId: string, userId: string): Promise<{
    type: ContestType;
    participant: any;
} | null>;
/**
 * Get the participant model based on contest type
 */
export declare function getParticipantModel(type: ContestType): Promise<any>;
/**
 * Get the ID field name for the participant based on contest type
 */
export declare function getContestIdField(type: ContestType): Promise<string>;
