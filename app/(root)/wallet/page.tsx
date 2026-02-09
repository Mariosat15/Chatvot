import {
  getOrCreateWallet,
  getWalletStats,
  getWalletTransactions,
} from "@/lib/actions/trading/wallet.actions";
import WalletContent from "@/components/trading/WalletContent";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

const WalletPage = async () => {
  // Ensure wallet exists first (creates if needed)
  await getOrCreateWallet();

  // Then fetch stats and transactions in parallel (both independent read-only queries)
  const [stats, transactions] = await Promise.all([
    getWalletStats(),
    getWalletTransactions(20),
  ]);

  return <WalletContent stats={stats as any} transactions={transactions} />;
};

export default WalletPage;
