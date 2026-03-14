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

  // Reason: Fetch ALL transactions so the user can browse full history
  // and download complete Excel exports. Client-side pagination handles display.
  const [stats, transactions] = await Promise.all([
    getWalletStats(),
    getWalletTransactions(0),
  ]);

  return <WalletContent stats={stats as any} transactions={transactions} />;
};

export default WalletPage;
