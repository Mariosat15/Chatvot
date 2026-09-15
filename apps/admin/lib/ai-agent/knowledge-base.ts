/**
 * ChartVolt Platform Knowledge Base
 *
 * Comprehensive documentation for the AI Agent to answer admin questions
 * about how the system works.
 *
 * TRADING IS ONE GAME AMONG SEVERAL, AND THIS FILE IS THE TRADING HALF. The
 * game-administration material lives in `games-knowledge-base.ts` and is composed in below.
 * Before this split the file opened "ChartVolt is a trading competition platform", which is
 * what made the agent answer a question about a provider game out of the trading material -
 * confidently, with no error and nothing in a log. If you add a fact here, ask first whether
 * it is true of every game or only of trading, and put it in the other file if it is the
 * former.
 */

import { GAMES_KNOWLEDGE_BASE, GAMES_QUICK_ANSWERS } from "./games-knowledge-base";

const TRADING_KNOWLEDGE_BASE = `
# ChartVolt Platform - Complete Admin Guide

## OVERVIEW
ChartVolt is a multi-game competition platform. Players deposit credits with real money (EUR),
pay a credit entry fee to enter a competition or a one-against-one challenge on one of the
platform's games, and the best performers win prizes from the pool.

**Trading is one of those games, not the whole platform.** It is the game this section
describes, and it is the one the platform runs itself: the platform owns the prices, the
positions and the profit and loss, so a trading contest has starting capital, leverage and
instruments. Contests on a provider's game have none of those and work differently - that is
the GAMES section further down, and it is the one to answer from whenever a question is about
a game rather than about trading.

What is identical across every game: credits, entry fees, prize pools, the platform fee,
Game Master commission, wallets, withdrawals, KYC, restrictions and the player's progression.

The platform uses a CREDIT system: 100 credits = €1 EUR by default.

---

## 1. COMPETITIONS (TRADING)

### What are Competitions?
A competition is an event where several players compete on one of the platform's games. They
pay a credit entry fee, the fees form a prize pool, and the best performers share it.

**This section describes a TRADING competition specifically.** Players receive virtual trading
capital and try to make the highest return. Everything below about starting capital, leverage,
instruments, trade requirements and the six ranking methods is trading-only - a competition on
a provider's game has none of it. See the GAMES section for those.

### How to Create a Competition
**Location**: Competitions → Competitions → New Competition

That opens a game picker first. Choosing Trading opens the trading wizard described here.
(Typing /competitions/create still goes straight to the trading wizard.)

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
4. **Active**: Both players play - on trading, both trade with virtual capital
5. **Completed**: The better result wins and takes the pool minus the platform fee. On trading
   that is the higher profit and loss; on a provider's game it is the better SCORE, in the
   direction that title scores.

A challenge can be on a provider's game as well as on trading, and it can be left OPEN to
anyone rather than addressed to one player. Players can also say which games they are willing
to be challenged at, in their own profile.

### Challenge Settings
**Location**: Competitions → 1v1 Challenges → Settings
- Platform fee percentage
- Minimum/maximum entry fee
- Minimum/maximum duration
- Accept deadline (default 24 hours), and how long an OPEN challenge stays up
- Margin settings (trading only)

Per-title challenge defaults live with the title, at Games → Game Providers → [provider] →
Games.

---

## 3. CREDITS & DEPOSITS

### Credit System
- **Exchange Rate**: Configurable, default 100 credits = €1 EUR
- **Minimum Deposit**: Configurable (default €10)
- Users buy credits → Use in competitions → Win more → Withdraw to EUR

### How to Change Deposit Settings
**Location**: Settings → Settings → Fees

**Configurable there**:
- Platform deposit fee % (what you charge users)
- Platform withdrawal fee %
- Bank deposit and withdrawal fees (what the payment provider charges you)

**The EUR-to-credits RATE is not editable in the admin panel at present.** Settings →
Settings → Currency shows what one credit is worth, derived from that rate, but read-only. If
an operator needs the rate itself changed, that is a support request, not a screen - do not
send them looking for a "Credit Conversion" page, because the navigation does not contain one.
(Recorded as R93.)

**Minimum deposit** is on the payment configuration, not here.

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
**Location**: Finance → Withdrawal Settings

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
- Admin reviews in Finance → Pending Withdrawals
- Options: Approve (sends money) or Reject (refunds credits)

---

## 5. VAT (Value Added Tax)

### How to Change VAT %
**Location**: Settings → Settings → Company

The VAT rate is set in Company Settings under tax configuration. Current default is 19% (Cyprus).

### How VAT Works
- VAT is added ON TOP of the deposit amount
- If user wants €100 worth of credits with 19% VAT: User pays €119
- VAT amount (€19) is tracked separately for tax reporting

### VAT Reports
**Location**: Finance → Financial Dashboard → VAT

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
**Location**: Settings → Settings → Fees (for deposit and withdrawal fees)
**Location**: The competition creation wizard (for that competition's platform fee %)

### Understanding Platform Earnings
**Location**: Finance → Financial Dashboard

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
**Location**: Security → KYC Settings

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
**Location**: Security → Fraud Detection → Settings

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
**Location**: Security → Fraud Detection

**Key Settings**:
- **Risk Thresholds**: Alert threshold (40), Block threshold (70), Auto-suspend (90)
- **VPN/Proxy**: Block or just flag
- **Multi-account**: Max accounts per device
- **Rate Limiting**: Max signups per hour, max login attempts

### Fraud Alerts
**Location**: Security → Fraud Detection

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
**Location**: User Management → Badges & XP

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
**Location**: Games → Trading → Risk & Margin

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
**Location**: Settings → Settings → Payment Providers

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
**Location**: User Management → Users → [Select User] → Restrictions

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
**Location**: Settings → Settings → Invoices

- Invoice number prefix
- Company details (name, address, VAT number)
- Logo
- Footer text

### Viewing Invoices
**Location**: Finance → Financial Dashboard → Invoices

- Search by user, date, status
- Download PDF
- Resend to user

---

## 14. SYSTEM SETTINGS

### Company Settings
**Location**: Settings → Settings → Company
- Company name, address, registration number
- VAT number and rate
- Support email
- Logo

### Email Templates
**Location**: Settings → Settings → Email Templates
- Welcome email
- Verification email
- Password reset
- Deposit confirmation
- Withdrawal confirmation
- Competition notifications

### White Label / Branding
**Location**: Settings → Settings → Branding
- Site name
- Logo
- Primary colors
- Custom domains

---

## 15. COMMON ADMIN TASKS

### How to Manually Credit a User
User Management → Users → [Find User] → Actions → Adjust Balance
- Enter amount (+ or -)
- Add reason (logged for audit)

### How to Process a Pending Withdrawal
Finance → Pending Withdrawals → [Select] → Approve or Reject

### How to Resolve a Fraud Alert
Security → Fraud Detection → [Select Alert]
- Review evidence
- Click Dismiss (if false positive) or take action (Suspend/Ban)

### How to Cancel a Competition
Competitions → Competitions → [Select] → view → Cancel
- All participants refunded automatically
- Entry fees returned to user wallets

### How to View User Trading History
User Management → Users → [Find User] → Trading History
- All positions (open and closed)
- Competition participation
- P&L history

---

## 16. RECONCILIATION

### Running Reconciliation
AI Agent can run: "Run reconciliation for this week"

Or manually: Finance → Financial Dashboard → Reconciliation

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

**Location**: Settings → Settings → Audit Logs

---

## QUICK REFERENCE

Every path here was read off the live navigation. The top-level groups are Dashboard, Content,
Competitions, Games, User Management, Finance, Security, Operations, Help, Messaging, Game
Master, AI & Automation, Settings, Dev Zone, Admin and My Account. There is no "Financials"
group, no "Gamification" group and no top-level "Trading" group - trading is a destination
inside Games.

| Task | Location |
|------|----------|
| Change VAT % | Settings → Settings → Company |
| Change deposit or withdrawal fees | Settings → Settings → Fees |
| Change withdrawal rules and limits | Finance → Withdrawal Settings |
| See what one credit is worth | Settings → Settings → Currency (read-only) |
| Rename competitions, players, prizes etc. | Settings → Settings → Wording |
| Enable/disable KYC | Security → KYC Settings |
| Configure fraud rules | Security → Fraud Detection |
| Create a competition | Competitions → Competitions → New Competition |
| Create or edit a 1v1 challenge setting | Competitions → 1v1 Challenges → Settings |
| Competition and challenge analytics | Competitions → Analytics |
| Process withdrawal | Finance → Pending Withdrawals |
| Process a pending deposit | Finance → Pending Payments |
| View user details | User Management → Users |
| View fraud alerts | Security → Fraud Detection |
| View financials | Finance → Financial Dashboard |
| Configure badges | User Management → Badges & XP |
| Email templates | Settings → Settings → Email Templates |
| Audit logs | Settings → Settings → Audit Logs |
| Add a game provider | Games → Game Providers |
| Enable a game title | Games → Game Providers → [provider] → Games |
| Trading symbols, hours, risk, price feed | Games → Trading |
| A round that needs a decision | Games → Round Inspector |
| Is a provider working? | Games → Provider Health |
| Is a game worth keeping? | Games → Game Performance |
| Incidents | Operations → Incident Management |
| Game Masters | Game Master → Manage Game Masters |

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
 * The knowledge base the agent is actually given.
 *
 * Trading first, then games. The order matters less than the fact that BOTH are present: before
 * the split the agent had only the trading half and answered questions about a provider game out
 * of it - fluently, with nothing in a log.
 */
export const PLATFORM_KNOWLEDGE_BASE = `${TRADING_KNOWLEDGE_BASE}
${GAMES_KNOWLEDGE_BASE}`;

/**
 * Quick answers for common questions
 */
const TRADING_QUICK_ANSWERS: Record<string, string> = {
  "how to change vat":
    "Go to Settings → Settings → Company. The VAT rate is in the tax configuration section. Default is 19%.",
  "how to create competition":
    "Go to Competitions → Competitions → New Competition, then pick the game. Trading asks for starting capital, instruments and a ranking method; a provider game asks for attempts, a round start policy and how unresolved rounds are handled. Both ask for a name, an entry fee, a start and end, and a prize split.",
  "how winner evaluated":
    "At the end the platform ranks the players and pays the prize split. On trading that means profit and loss is calculated, disqualifications are checked, and players are ranked by the method the competition chose. On a provider's game the player's SCORE is ranked in the direction that title scores - a time trial ranks the lowest number first. In both cases a player with no result at all is not ranked and not paid.",
  "what are challenges":
    "1v1 Challenges are head-to-head contests between exactly two players. They stake credits and the better result wins the pool minus the platform fee - on trading the higher profit and loss, on a provider's game the better score. A challenge can also be left open to anyone rather than addressed to one player.",
  "how withdrawal works":
    "User requests withdrawal → System checks requirements (KYC, balance, limits) → Automatic mode processes immediately or Manual mode waits for admin approval.",
  "how to process withdrawal":
    "Finance → Pending Withdrawals → Select the withdrawal → Click Approve (sends money) or Reject (returns credits to user).",
  "how badges work":
    "Users earn badges for achievements (wins, milestones, profits). Each badge has a rarity (Common/Rare/Epic/Legendary) that determines XP reward. Badges are evaluated automatically.",
  "how fraud detection works":
    "System tracks device fingerprints, payment methods, VPN usage, and behavior patterns. Users get risk scores. Alerts created for suspicious activity. Admins review and take action.",
  "how to ban user":
    "User Management → Users → Find User → Restrictions → Add Login Block restriction with permanent duration, or use Fraud Alerts → Ban action.",
  "what is margin call":
    "A TRADING-only rule. When a trader's equity drops to the margin call level (default 100%) they get a warning; at the liquidation level (default 50%) positions are auto-closed. Configure it at Games → Trading → Risk & Margin. A provider's game has no capital, no leverage and no positions, so none of this applies to it.",
};

/**
 * Quick answers for common questions, trading and games together.
 *
 * Merged rather than kept apart because the lookup in the agent route iterates one object. A
 * games answer must never be unreachable merely because it lives in the other file.
 */
export const QUICK_ANSWERS: Record<string, string> = {
  ...TRADING_QUICK_ANSWERS,
  ...GAMES_QUICK_ANSWERS,
};
