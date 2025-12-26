import { Agenda, Job } from 'agenda';

/**
 * Withdrawal Processing Job
 * 
 * For MANUAL withdrawal mode:
 * - Doesn't auto-process (admin does manual bank transfer)
 * - Monitors for stuck withdrawals
 * - Sends reminders to admin for pending withdrawals
 */

export function defineWithdrawalProcessJob(agenda: Agenda) {
  // Check for pending withdrawals (reminder for admin)
  agenda.define('check-pending-withdrawals', async (job: Job) => {
    console.log('🏦 Checking pending withdrawals...');
    
    try {
      const WithdrawalRequest = (await import('../../database/models/withdrawal-request.model')).default;
      const WithdrawalSettings = (await import('../../database/models/withdrawal-settings.model')).default;
      
      // Get withdrawal settings
      const settings = await WithdrawalSettings.getSingleton();
      
      // Count pending/approved withdrawals
      const pendingCount = await WithdrawalRequest.countDocuments({ status: 'pending' });
      const approvedCount = await WithdrawalRequest.countDocuments({ status: 'approved' });
      const processingCount = await WithdrawalRequest.countDocuments({ status: 'processing' });
      
      if (pendingCount > 0 || approvedCount > 0) {
        console.log(`📋 Withdrawal Status Summary:`);
        console.log(`   - Pending review: ${pendingCount}`);
        console.log(`   - Approved (awaiting bank transfer): ${approvedCount}`);
        console.log(`   - Processing: ${processingCount}`);
        console.log(`   - Mode: ${settings.processingMode.toUpperCase()}`);
        
        if (settings.processingMode === 'manual') {
          console.log(`   ℹ️  Manual mode: Admin must transfer via company bank`);
        }
      } else {
        console.log('✅ No pending withdrawals');
      }
    } catch (error) {
      console.error('❌ Withdrawal check failed:', error);
      throw error;
    }
  });

  // Check for stuck withdrawals (processing for too long)
  agenda.define('check-stuck-withdrawals', async (job: Job) => {
    console.log('🔍 Checking for stuck withdrawals...');
    
    try {
      const WithdrawalRequest = (await import('../../database/models/withdrawal-request.model')).default;
      
      // Find withdrawals stuck in 'processing' for over 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const stuckWithdrawals = await WithdrawalRequest.find({
        status: 'processing',
        processedAt: { $lt: oneDayAgo },
      });

      if (stuckWithdrawals.length > 0) {
        console.warn(`⚠️ Found ${stuckWithdrawals.length} withdrawal(s) in processing for >24 hours:`);
        
        for (const withdrawal of stuckWithdrawals) {
          const hoursStuck = Math.round((Date.now() - new Date(withdrawal.processedAt!).getTime()) / (1000 * 60 * 60));
          console.warn(`  - ID: ${withdrawal._id}`);
          console.warn(`    User: ${withdrawal.userEmail}`);
          console.warn(`    Amount: €${withdrawal.netAmountEUR}`);
          console.warn(`    Processing for: ${hoursStuck} hours`);
          console.warn(`    Action: Admin should complete or mark as failed`);
        }
      } else {
        console.log('✅ No stuck withdrawals found');
      }
    } catch (error) {
      console.error('❌ Stuck withdrawal check failed:', error);
      throw error;
    }
  });

  // Check for old pending withdrawals (remind admin)
  agenda.define('check-old-pending-withdrawals', async (job: Job) => {
    console.log('🔍 Checking for old pending withdrawals...');
    
    try {
      const WithdrawalRequest = (await import('../../database/models/withdrawal-request.model')).default;
      
      // Find withdrawals pending for over 48 hours
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const oldPending = await WithdrawalRequest.find({
        status: 'pending',
        requestedAt: { $lt: twoDaysAgo },
      });

      if (oldPending.length > 0) {
        console.warn(`⚠️ Found ${oldPending.length} withdrawal(s) pending for >48 hours:`);
        
        for (const withdrawal of oldPending) {
          const hoursWaiting = Math.round((Date.now() - new Date(withdrawal.requestedAt).getTime()) / (1000 * 60 * 60));
          console.warn(`  - ID: ${withdrawal._id}`);
          console.warn(`    User: ${withdrawal.userEmail}`);
          console.warn(`    Amount: €${withdrawal.amountEUR}`);
          console.warn(`    Waiting for: ${hoursWaiting} hours`);
          console.warn(`    Action: Admin should approve or reject`);
        }
      } else {
        console.log('✅ No old pending withdrawals');
      }
    } catch (error) {
      console.error('❌ Old pending withdrawal check failed:', error);
      throw error;
    }
  });
}

export async function scheduleWithdrawalJobs(agenda: Agenda) {
  // Check pending withdrawals every hour (summary for logs)
  await agenda.every('1 hour', 'check-pending-withdrawals');
  console.log('📅 Scheduled: check-pending-withdrawals (every 1 hour)');
  
  // Check for stuck withdrawals every 6 hours
  await agenda.every('6 hours', 'check-stuck-withdrawals');
  console.log('📅 Scheduled: check-stuck-withdrawals (every 6 hours)');
  
  // Check for old pending withdrawals every 12 hours
  await agenda.every('12 hours', 'check-old-pending-withdrawals');
  console.log('📅 Scheduled: check-old-pending-withdrawals (every 12 hours)');
}
