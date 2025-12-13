import { getOrCreateWallet, getWalletStats, getWalletTransactions } from '@/lib/actions/trading/wallet.actions';
import WalletContent from '@/components/trading/WalletContent';

// Force dynamic rendering - this page uses authentication
export const dynamic = 'force-dynamic';

const WalletPage = async () => {
  // Get wallet data
  const _wallet = await getOrCreateWallet();
  const stats = await getWalletStats();
  const transactions = await getWalletTransactions(20);

  return <WalletContent stats={stats as any} transactions={transactions} />
};

export default WalletPage;

