/**
 * ChartVolt Platform Knowledge Base
 * 
 * Comprehensive documentation for the AI Agent to answer admin questions
 * about how the system works.
 */

export const PLATFORM_KNOWLEDGE_BASE = `
# ChartVolt Platform - Complete Admin Guide

## OVERVIEW
ChartVolt is a trading competition platform where users can:
- Deposit credits using real money (EUR)
- Enter trading competitions using those credits
- Trade forex, stocks, crypto, and indices with virtual capital
- Win prizes based on their trading performance
- Withdraw their winnings back to real money

The platform uses a CREDIT system: 100 credits = €1 EUR by default.

---

## 1. COMPETITIONS

### What are Competitions?
Competitions are trading events where multiple users compete against each other using virtual trading capital. Users pay an entry fee (in credits), receive virtual trading capital, and try to make the highest return. Winners receive prizes from the prize pool.

### How to Create a Competition
**Location**: Admin Panel → Competitions → Create New

**Required Settings**:
1. **Basic Info**: Name, description, slug (URL-friendly name), image
2. **Entry Fee**: Credits required to enter (e.g., 50 credits = €0.50)
3. **Starting Capital**: Virtual trading capital each participant gets (e.g., 10,000 points)
4. **Timing**: Start time, end time, registration deadline
5. **Participants**: Minimum (2+) and maximum participants

**Prize Distribution**:
- Prize Pool = Sum of all entry fees
- Platform takes a fee (configurable %, default 20%)
- Remaining is distributed to winners based on rank percentages
- Example: 1st: 70%, 2nd: 20%, 3rd: 10%

**Competition Types**:
- **Time-based**: Runs for a set duration, highest P&L at end wins
- **Goal-based**: First to reach target return wins
- **Hybrid**: Combines both

**Ranking Methods**:
- PnL (Profit & Loss) - most common
- ROI (Return on Investment)
- Total Capital
- Win Rate
- Total Wins
- Profit Factor

**Tie Breakers** (in order):
1. Primary tie breaker (e.g., trades count)
2. Secondary tie breaker (e.g., win rate)
3. Join time (first in wins)
4. Split prize equally

### Competition Status Flow
Draft → Upcoming → Active → Completed
                      ↓
                  Cancelled

**Auto-cancellation**: If minimum participants not reached by deadline, competition is auto-cancelled and entry fees refunded.

### Winner Evaluation
The system automatically evaluates winners when competition ends:
1. Calculates final P&L for each participant
2. Checks for disqualifications (liquidated users, minimum trade requirements)
3. Ranks by chosen method (PnL, ROI, etc.)
4. Applies tie breakers
5. Distributes prizes to winners
6. Updates user statistics and badges

---

## 2. 1v1 CHALLENGES

### What are Challenges?
Direct head-to-head trading battles between two users. One user challenges another, they both stake credits, and compete for a set duration.

### Challenge Flow
1. **Creation**: User A creates challenge, sets entry fee and duration
2. **Invite**: Challenge sent to User B
3. **Accept/Decline**: User B has time to accept (configurable deadline)
4. **Active**: Both users trade with virtual capital
5. **Completed**: Higher P&L wins, takes prize pool minus platform fee

### Challenge Settings
**Admin Panel → Settings → Challenge Settings**
- Platform fee percentage
- Minimum/maximum entry fee
- Minimum/maximum duration
- Accept deadline (default 24 hours)
- Margin settings (same as competitions)

---

## 3. CREDITS & DEPOSITS

### Credit System
- **Exchange Rate**: Configurable, default 100 credits = €1 EUR
- **Minimum Deposit**: Configurable (default €10)
- Users buy credits → Use in competitions → Win more → Withdraw to EUR

### How to Change Deposit Settings
**Location**: Admin Panel → Settings → Credit Conversion

**Configurable**:
- EUR to Credits rate
- Minimum deposit amount
- Platform deposit fee % (what you charge users)
- Bank fee % (what payment provider charges you)

### Fee Calculation on Deposit
When user deposits €100:
1. User pays: €100 + VAT (if applicable)
2. Platform fee: Calculated on total (e.g., 5% = €5)
3. Bank fee: What Stripe/Nuvei charges (e.g., 2.9% + €0.30)
4. Net platform earning: Platform fee - Bank fee
5. User receives: Credits equivalent of €100

---

## 4. WITHDRAWALS

### How Withdrawals Work
1. User requests withdrawal (credits → EUR)
2. System checks requirements (KYC, balance, limits)
3. Based on mode:
   - **Automatic**: Processed via payment provider
   - **Manual**: Admin reviews and processes

### Withdrawal Settings
**Location**: Admin Panel → Settings → Withdrawal Settings

**Key Settings**:
- **Processing Mode**: Automatic or Manual
- **Limits**: Min/max per withdrawal, daily limit, monthly limit
- **Requirements**: KYC required?, email verification?, minimum account age
- **Fees**: Platform fee %, fixed fee
- **Fraud Prevention**: Hold period after deposit, max withdrawals per day
- **Payout Methods**: Card refund, bank transfer

### Automatic vs Manual Mode
**Automatic Mode**:
- Withdrawals processed immediately via Nuvei
- Good for verified users with small amounts
- Auto-approval rules can be set

**Manual Mode**:
- All withdrawals require admin approval
- Admin reviews in Admin Panel → Withdrawals → Pending
- Options: Approve (sends money) or Reject (refunds credits)

---

## 5. VAT (Value Added Tax)

### How to Change VAT %
**Location**: Admin Panel → Settings → Company Settings

The VAT rate is set in Company Settings under tax configuration. Current default is 19% (Cyprus).

### How VAT Works
- VAT is added ON TOP of the deposit amount
- If user wants €100 worth of credits with 19% VAT: User pays €119
- VAT amount (€19) is tracked separately for tax reporting

### VAT Reports
**Location**: Admin Panel → Financials → VAT Payments

- View VAT collected by period
- Track pending VAT payments
- Mark VAT as paid to tax authority
- Export for accounting

---

## 6. FEES & FINANCIALS

### Platform Fee Structure
1. **Deposit Fees**: What users pay when depositing (platform fee + VAT)
2. **Withdrawal Fees**: What users pay when withdrawing (platform fee)
3. **Competition Fees**: % taken from competition prize pools
4. **Challenge Fees**: % taken from 1v1 challenge prize pools

### How to Change Fees
**Location**: Admin Panel → Settings → Credit Conversion (for deposits/withdrawals)
**Location**: Competition creation form (for competition platform fee %)

### Understanding Platform Earnings
**Location**: Admin Panel → Financials → Platform Earnings

Sources of revenue:
- Deposit fees (platform % charged to users)
- Withdrawal fees (platform % charged to users)
- Competition fees (% of prize pool)
- Challenge fees (% of challenge stakes)
- Unclaimed pools (when competitions cancel or no winners qualify)

### Net Earnings Calculation
Net Earning = Platform Fee - Bank Fee

Example Deposit of €100:
- User pays: €119 (€100 + 19% VAT)
- Platform fee (5%): €5.95
- Bank fee (2.9% + €0.30): €3.75
- Net earning: €5.95 - €3.75 = €2.20

---

## 7. KYC (Know Your Customer)

### How to Enable/Configure KYC
**Location**: Admin Panel → Settings → KYC Settings

**Settings**:
- Enable/disable KYC requirement
- Required for withdrawals? (yes/no)
- Required for deposits? (yes/no)
- Threshold amount (require KYC for withdrawals above X EUR)
- Provider: Veriff (requires API credentials)

### KYC Flow
1. User initiates withdrawal (if KYC required)
2. System prompts for verification
3. User completes Veriff flow (ID + selfie)
4. Veriff processes and returns result
5. Auto-approve on success or manual review on decline

### Duplicate KYC Detection
**Location**: Fraud Settings

System detects when same ID document used by multiple accounts:
- Auto-suspend option
- Block deposits/trading/competitions
- Allow withdrawals (regulatory requirement)

---

## 8. FRAUD DETECTION

### Overview
The platform has comprehensive fraud detection:
- Device fingerprinting (same device = same user)
- Payment method sharing (same card across accounts)
- VPN/Proxy detection
- Multi-account detection
- Suspicious behavior analysis

### How to Configure Fraud Settings
**Location**: Admin Panel → Security → Fraud Settings

**Key Settings**:
- **Risk Thresholds**: Alert threshold (40), Block threshold (70), Auto-suspend (90)
- **VPN/Proxy**: Block or just flag
- **Multi-account**: Max accounts per device
- **Rate Limiting**: Max signups per hour, max login attempts

### Fraud Alerts
**Location**: Admin Panel → Security → Fraud Alerts

When suspicious activity detected:
1. Alert created with severity (low/medium/high/critical)
2. Admin reviews evidence
3. Actions: Investigate, Dismiss, Suspend, Ban

### Suspicion Scores
Users accumulate risk scores based on:
- Device sharing (+10-30)
- Payment method sharing (+20-40)
- VPN usage (+30)
- Failed verification (+25)
- Suspicious behavior patterns

---

## 9. BADGES & XP SYSTEM

### How Badges Work
Users earn badges for achievements:
- Competition wins
- Trade milestones
- Profit achievements
- Special actions

### Badge Rarities
- **Common**: Easy to earn (10 XP)
- **Rare**: Moderate difficulty (50 XP)
- **Epic**: Hard to earn (150 XP)
- **Legendary**: Very rare (500 XP)

### How to Configure Badges
**Location**: Admin Panel → Gamification → Badges & XP

- Enable/disable individual badges
- Modify XP rewards per rarity
- Set badge conditions

### Level Progression
Users level up by earning XP:
- Level 1: Novice (0-99 XP)
- Level 2: Apprentice (100-499 XP)
- Level 3: Trader (500-1,499 XP)
- ... up to Level 10: Trading God

### Badge Evaluation
Badges are evaluated automatically when:
- User completes a trade
- User wins a competition
- User makes a deposit
- User reaches milestones

---

## 10. TRADING RISK SETTINGS

### Margin System
**Location**: Admin Panel → Settings → Trading Risk

**Margin Levels**:
- **Safe (200%+)**: Healthy margin
- **Warning (150%)**: User notified
- **Margin Call (100%)**: User warned, may restrict new positions
- **Liquidation (50%)**: Positions auto-closed

### Position Limits
- Max open positions per user
- Max position size (lot size)
- Leverage limits (min/max)
- Max drawdown % before restrictions

### How Margin Works in Competitions
Each competition can have its own margin settings or use global defaults. When a user's equity drops below the liquidation level, their positions are automatically closed and they may be disqualified.

---

## 11. PAYMENT PROVIDERS

### Supported Providers
- **Stripe**: Card payments, Apple Pay, Google Pay
- **Nuvei**: Card payments, alternative methods, payouts

### How to Configure Providers
**Location**: Admin Panel → Settings → Payment Providers

Or via environment variables:
- STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
- NUVEI_MERCHANT_ID, NUVEI_MERCHANT_SITE_ID, NUVEI_SECRET_KEY

### Test Mode vs Live Mode
- Set via environment: STRIPE_TEST_MODE=true or NUVEI_TEST_MODE=true
- Test mode uses sandbox credentials
- Test cards: 4242 4242 4242 4242 (Stripe)

---

## 12. USER MANAGEMENT

### User Restrictions
**Location**: Admin Panel → Users → [Select User] → Restrictions

Types:
- **Deposit blocked**: Cannot deposit
- **Withdrawal blocked**: Cannot withdraw
- **Trading blocked**: Cannot trade
- **Login blocked**: Cannot access account

### Manual Actions
- Edit user details
- Reset password
- Verify email manually
- Adjust credit balance
- Add notes

### User Notes
Admins can add internal notes about users for documentation and compliance.

---

## 13. INVOICES

### Auto-Generated Invoices
System automatically generates invoices for:
- Deposits (includes VAT breakdown)
- Purchases

### Invoice Settings
**Location**: Admin Panel → Settings → Invoice Settings

- Invoice number prefix
- Company details (name, address, VAT number)
- Logo
- Footer text

### Viewing Invoices
**Location**: Admin Panel → Financials → Invoices

- Search by user, date, status
- Download PDF
- Resend to user

---

## 14. SYSTEM SETTINGS

### Company Settings
**Location**: Admin Panel → Settings → Company Settings
- Company name, address, registration number
- VAT number and rate
- Support email
- Logo

### Email Templates
**Location**: Admin Panel → Settings → Email Templates
- Welcome email
- Verification email
- Password reset
- Deposit confirmation
- Withdrawal confirmation
- Competition notifications

### White Label / Branding
**Location**: Admin Panel → Settings → White Label
- Site name
- Logo
- Primary colors
- Custom domains

---

## 15. COMMON ADMIN TASKS

### How to Manually Credit a User
Admin Panel → Users → [Find User] → Actions → Adjust Balance
- Enter amount (+ or -)
- Add reason (logged for audit)

### How to Process a Pending Withdrawal
Admin Panel → Withdrawals → Pending → [Select] → Approve or Reject

### How to Resolve a Fraud Alert
Admin Panel → Security → Fraud Alerts → [Select Alert]
- Review evidence
- Click Dismiss (if false positive) or take action (Suspend/Ban)

### How to Cancel a Competition
Admin Panel → Competitions → [Select] → Cancel
- All participants refunded automatically
- Entry fees returned to user wallets

### How to View User Trading History
Admin Panel → Users → [Find User] → Trading History
- All positions (open and closed)
- Competition participation
- P&L history

---

## 16. RECONCILIATION

### Running Reconciliation
AI Agent can run: "Run reconciliation for this week"

Or manually: Admin Panel → Financials → Reconciliation

**Checks**:
- Completed transactions match provider records
- All deposits credited properly
- All withdrawals paid
- Fees calculated correctly
- Identifies discrepancies

---

## 17. AUDIT LOGS

### What's Logged
- All admin actions
- User authentication events
- Settings changes
- Financial operations
- Security events

**Location**: Admin Panel → System → Audit Logs

---

## QUICK REFERENCE

| Task | Location |
|------|----------|
| Change VAT % | Settings → Company Settings |
| Change deposit fees | Settings → Credit Conversion |
| Change withdrawal fees | Settings → Withdrawal Settings |
| Enable/disable KYC | Settings → KYC Settings |
| Configure fraud rules | Security → Fraud Settings |
| Create competition | Competitions → Create New |
| Process withdrawal | Withdrawals → Pending |
| View user details | Users → Search |
| View fraud alerts | Security → Fraud Alerts |
| View financials | Financials → Dashboard |
| Configure badges | Gamification → Badges & XP |
| Email templates | Settings → Email Templates |

---

## SUPPORT & TROUBLESHOOTING

### User Can't Deposit
Check: Payment provider configured? User verified? Restrictions on account?

### User Can't Withdraw
Check: Minimum balance? KYC required? Pending hold period? Daily limit reached?

### Competition Not Starting
Check: Minimum participants reached? Start time correct? Not cancelled?

### Fraud Alert False Positive
Review evidence, dismiss if false positive, whitelist IP/device if needed.

### Missing Transaction
Check provider dashboard, run reconciliation, check webhook logs.
`;

/**
 * Quick answers for common questions
 */
export const QUICK_ANSWERS: Record<string, string> = {
  'how to change vat': 'Go to Admin Panel → Settings → Company Settings. The VAT rate is in the tax configuration section. Default is 19%.',
  'how to create competition': 'Go to Admin Panel → Competitions → Create New. Fill in name, entry fee, starting capital, timing, and prize distribution.',
  'how winner evaluated': 'Winners are automatically evaluated when competition ends: P&L calculated → Check disqualifications → Rank by method (PnL/ROI) → Apply tie breakers → Distribute prizes.',
  'what are challenges': '1v1 Challenges are direct head-to-head trading battles between two users. They stake credits, trade for a set duration, and the higher P&L wins.',
  'how withdrawal works': 'User requests withdrawal → System checks requirements (KYC, balance, limits) → Automatic mode processes immediately or Manual mode waits for admin approval.',
  'how to process withdrawal': 'Admin Panel → Withdrawals → Pending → Select the withdrawal → Click Approve (sends money) or Reject (returns credits to user).',
  'how badges work': 'Users earn badges for achievements (wins, milestones, profits). Each badge has a rarity (Common/Rare/Epic/Legendary) that determines XP reward. Badges are evaluated automatically.',
  'how fraud detection works': 'System tracks device fingerprints, payment methods, VPN usage, and behavior patterns. Users get risk scores. Alerts created for suspicious activity. Admins review and take action.',
  'how to ban user': 'Admin Panel → Users → Find User → Restrictions → Add Login Block restriction with permanent duration, or use Fraud Alerts → Ban action.',
  'what is margin call': 'When user equity drops to margin call level (default 100%), they get a warning. At liquidation level (default 50%), positions are auto-closed. Configure in Trading Risk Settings.',
};

