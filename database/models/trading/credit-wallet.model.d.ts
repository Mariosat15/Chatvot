import { Document } from 'mongoose';
export interface ICreditWallet extends Document {
    userId: string;
    creditBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalSpentOnCompetitions: number;
    totalWonFromCompetitions: number;
    totalSpentOnChallenges: number;
    totalWonFromChallenges: number;
    isActive: boolean;
    kycVerified: boolean;
    withdrawalEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const CreditWallet: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default CreditWallet;
//# sourceMappingURL=credit-wallet.model.d.ts.map