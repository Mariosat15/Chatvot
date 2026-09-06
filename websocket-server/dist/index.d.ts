/**
 * Chartvolt WebSocket Server
 *
 * Production-ready WebSocket server for real-time messaging
 * Runs as a separate PM2 process alongside other Chartvolt services
 *
 * Start with: pm2 start ecosystem.config.js --only chartvolt-websocket
 */
export declare function notifyNewMessage(conversationId: string, message: any): void;
export declare function notifyRead(conversationId: string, participantId: string, participantName: string): void;
export declare function notifyTransfer(conversationId: string, toEmployeeId: string, toEmployeeName: string): void;
export declare function notifyFriendRequest(toUserId: string, eventType: string, request: any): void;
export declare function getOnlineParticipants(participantIds: string[]): string[];
export declare function getStats(): {
    totalConnections: number;
    uniqueParticipants: number;
    activeConversations: number;
    presenceWatchers: number;
};
//# sourceMappingURL=index.d.ts.map