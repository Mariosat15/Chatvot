export declare const getUserPositions: (competitionId: string) => Promise<any>;
export declare const updatePositionTPSL: (positionId: string, takeProfit: number | null, stopLoss: number | null) => Promise<{
    success: boolean;
    error: any;
    message?: undefined;
    position?: undefined;
} | {
    success: boolean;
    message: string;
    position: {
        _id: any;
        takeProfit: any;
        stopLoss: any;
    };
    error?: undefined;
}>;
export declare const closePosition: (positionId: string, requestedPrice?: {
    bid: number;
    ask: number;
    timestamp: number;
}) => Promise<{
    success: boolean;
    realizedPnl: any;
    message: string;
}>;
export declare const updateAllPositionsPnL: (competitionId: string, userId: string) => Promise<{
    success: boolean;
    unrealizedPnl: number;
    totalUnrealizedPnl?: undefined;
} | {
    success: boolean;
    totalUnrealizedPnl: number;
    unrealizedPnl?: undefined;
}>;
export declare const checkStopLossTakeProfit: (competitionId: string) => Promise<void>;
export declare function closePositionAutomatic(positionId: string, exitPrice: number, closeReason: 'stop_loss' | 'take_profit' | 'margin_call'): Promise<void>;
export declare const checkMarginCalls: (competitionId: string) => Promise<void>;
