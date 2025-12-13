/**
 * Quick script to manually complete a pending payment
 * Run: node scripts/complete-pending-payment.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const WalletTransaction = require('../database/models/trading/wallet-transaction.model');
const CreditWallet = require('../database/models/trading/credit-wallet.model');

async function completePendingPayment() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Find the pending transaction
    const pendingTransaction = await WalletTransaction.findOne({
      status: 'pending',
      transactionType: 'deposit'
    }).sort({ createdAt: -1 });

    if (!pendingTransaction) {
      console.log('❌ No pending transactions found');
      process.exit(0);
    }

    console.log('📋 Found pending transaction:');
    console.log('   ID:', pendingTransaction._id);
    console.log('   User:', pendingTransaction.userId);
    console.log('   Amount:', pendingTransaction.amount, pendingTransaction.currency);
    console.log('   Credits:', pendingTransaction.creditsAmount);

    // Update transaction status
    pendingTransaction.status = 'completed';
    pendingTransaction.paymentIntentId = 'manual_completion';
    pendingTransaction.paymentMethod = 'manual';
    await pendingTransaction.save();
    console.log('✅ Transaction marked as completed');

    // Update wallet balance
    const wallet = await CreditWallet.findOne({ userId: pendingTransaction.userId });
    
    if (!wallet) {
      console.log('❌ Wallet not found for user:', pendingTransaction.userId);
      process.exit(1);
    }

    wallet.creditBalance += pendingTransaction.creditsAmount;
    wallet.totalDeposited += pendingTransaction.amount;
    await wallet.save();

    console.log('✅ Wallet updated:');
    console.log('   New balance:', wallet.creditBalance, 'credits');
    console.log('   Total deposited:', wallet.totalDeposited, wallet.currency);

    console.log('\n🎉 Payment completed successfully!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

completePendingPayment();

