import {
  getOrCreateWallet,
  getWalletStats,
  getWalletTransactions,
} from "@/lib/actions/trading/wallet.actions";
import WalletContent from "@/components/trading/WalletContent";
import { redirectIfRestricted } from "@/lib/services/restriction-guard.service";

// Force dynamic rendering - this page uses authentication
export const dynamic = "force-dynamic";

const WalletPage = async () => {
  // Reason: restricted users must see the Account Under Review page instead
  // of a partially-working wallet with a generic "action blocked" toast.
  await redirectIfRestricted("withdraw");

  // Ensure wallet exists first (creates if needed)
  await getOrCreateWallet();

  // Reason: Fetch ALL transactions so the user can browse full history
  // and download complete Excel exports. Client-side pagination handles display.
  const [stats, transactions] = await Promise.all([
    getWalletStats(),
    getWalletTransactions(0),
  ]);

  // Reason: `getWalletStats` returns a loose shape (some optional MongoDB
  // metadata fields WalletContent doesn't use). A narrowing refactor is
  // tracked separately; the cast here is intentional.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <WalletContent stats={stats as any} transactions={transactions} />;
};

export default WalletPage;
