import mongoose from 'mongoose';
declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    };
    var mongooseProfilingEnabled: boolean;
}
export declare const connectToDatabase: () => Promise<typeof mongoose>;
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName?: string): Promise<T>;
export declare function safeDbOperation<T>(operation: () => Promise<T>, options?: {
    timeoutMs?: number;
    retries?: number;
    operationName?: string;
}): Promise<T>;
//# sourceMappingURL=mongoose.d.ts.map