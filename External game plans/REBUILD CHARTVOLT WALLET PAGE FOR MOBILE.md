TASK: REBUILD CHARTVOLT WALLET PAGE FOR MOBILE

We already have a desktop Wallet Analytics page.

DO NOT simply shrink the desktop Wallet Analytics page.
DO NOT stack every desktop chart vertically.
DO NOT try to force desktop charts into a phone screen.

Create a dedicated MOBILE WALLET experience that feels like a modern fintech + gaming wallet inside ChartVolt.

The desktop Wallet page must remain unchanged.

==================================================
1. MAIN OBJECTIVE
==================================================

Build a completely different mobile Wallet layout for screens below 768px.

The mobile Wallet must:

- Be very easy to understand.
- Make the current Volt balance the main focus.
- Make Deposit and Withdraw immediately accessible.
- Show important wallet movement without overwhelming the user.
- Keep the ChartVolt neon gaming style.
- Feel like a native mobile fintech wallet.
- Use the same real backend wallet data.
- Be fully responsive.
- Be retina-ready.
- Be touch-friendly.
- Use proper mobile charts.
- Avoid tiny desktop graphs.
- Avoid unnecessary statistics.
- Avoid horizontal page overflow.

Desktop stays exactly as it is.

Use a dedicated mobile component structure.

Example:

<div className="hidden md:block">
   <DesktopWalletAnalytics />
</div>

<div className="block md:hidden">
   <MobileWallet />
</div>

Share DATA/API logic.

Do NOT share desktop layout.

==================================================
2. BREAKPOINTS
==================================================

Mobile:
max-width: 768px

Desktop:
min-width: 769px

Primary mobile widths:

360px
375px
390px
393px
412px
430px

The design must work naturally across these widths.

Do NOT use CSS transform/scale to reduce the desktop layout.

==================================================
3. MOBILE WALLET PAGE ORDER
==================================================

Use this order:

1. Mobile Wallet Header
2. Main Volt Balance Card
3. Deposit / Withdraw Actions
4. Wallet Overview Metrics
5. Wallet Balance Trend
6. Money In / Money Out Breakdown
7. Daily Wallet Activity
8. Wallet Insights
9. Recent Transactions
10. Bottom Navigation

This order is important.

The first screen should answer immediately:

- How many Volts do I have?
- Can I deposit?
- Can I withdraw?
- Is my balance going up or down?

==================================================
4. MOBILE HEADER
==================================================

Create a compact mobile header.

LEFT:
back button if needed
Wallet icon
title: Wallet

RIGHT:
notifications
profile/avatar

Optional:
date/range filter icon

Do NOT show the large desktop analytics navigation.

Header height:
approximately 60-68px.

Keep it clean.

==================================================
5. MAIN BALANCE CARD
==================================================

THIS IS THE MOST IMPORTANT ELEMENT.

Create one large premium balance card.

Example:

WALLET BALANCE

987.82 ⚡

+79.50 this period
+12.4%

Use actual wallet data.

Include:

- Volt icon
- large balance number
- current change
- subtle sparkline
- optional available / pending balance
- small visual glow

Style:

dark navy glass
gold/orange edge
subtle cyan secondary glow
large readable balance

Recommended height:
150-180px.

Do NOT fill this card with too much information.

The balance must be readable instantly.

==================================================
6. PRIMARY WALLET ACTIONS
==================================================

Immediately below the balance card:

[ DEPOSIT ]
[ WITHDRAW ]

Use two large buttons side-by-side.

Optional third button:
[ TRANSACTIONS ]

But Deposit and Withdraw must dominate.

Minimum button height:
54-60px.

Icons:
Deposit = downward/in wallet icon
Withdraw = upward/out wallet icon

Colors:

Deposit:
green / cyan

Withdraw:
magenta / purple

Use active/pressed states.

Touch targets must be minimum 44px.

==================================================
7. QUICK WALLET OVERVIEW
==================================================

Create a small section:

WALLET OVERVIEW

Use a 2x2 grid.

Cards:

Total Spent
Game Earnings
Prizes Won
Net Movement

Each card should contain:

icon
label
value
small percentage/change

Example:

TOTAL SPENT
858.00 ⚡
+18.7%

GAME EARNINGS
67.00 ⚡
+12%

PRIZES WON
215.82 ⚡
+32%

NET MOVEMENT
79.50 ⚡
+18%

Do NOT use four huge desktop cards.

On mobile they should be compact.

Approximate card height:
85-100px.

==================================================
8. WALLET BALANCE TREND
==================================================

Create one strong full-width chart card.

Title:
Wallet Balance Trend

Subtitle:
See how your Volt balance changes over time.

Use:
smooth area chart

Main line:
gold/yellow

Fill:
subtle gold gradient

Controls:

7D
30D
90D
ALL

Prefer a horizontal segmented control.

The selected range should be visually obvious.

The graph should be approximately:
220-260px high.

Do not use a desktop graph squeezed to 350px width.

Simplify:

- fewer x-axis labels
- fewer y-axis labels
- cleaner grid
- large tooltip
- touch-friendly points

On tap, tooltip shows:

date
balance
change

==================================================
9. MONEY IN / MONEY OUT
==================================================

Instead of the dense desktop Credit Breakdown chart, create a mobile-friendly financial summary.

Title:

Money In & Out

Use two strong summary cards:

MONEY IN
Deposits
Game Earnings
Prizes
Bonuses

MONEY OUT
Purchases
Withdrawals
Fees

Show:

total in
total out

Then below:
simple horizontal category bars.

Example:

Deposits      ████████     230.80
Prizes        ██████       215.82
Games         ███           67.00
Bonuses       ██            25.00

Withdrawals   ████         123.32
Purchases     ███████      245.82

This is easier to read on mobile than many grouped bars.

==================================================
10. OPTIONAL BREAKDOWN CHART
==================================================

If a visual chart is needed, use:

DONUT CHART

not a crowded multi-series desktop bar chart.

Center:

1.37K
Total Activity

Categories:
Deposits
Purchases
Game Earnings
Bonuses
Prizes
Withdrawals

Use the same colors everywhere.

Do not show tiny labels around the donut.

Put labels below it.

==================================================
11. DAILY CREDIT FLOW
==================================================

Create:

DAILY VOLT FLOW

Use a compact positive/negative bar chart.

Positive:
green

Negative:
red

Prize/bonus event:
gold if needed

Clearly show zero baseline.

Card height:
220-250px.

User should quickly understand:

green = Volts in
red = Volts out

Avoid excessive axis detail.

==================================================
12. WALLET INSIGHTS
==================================================

Create:

WALLET INSIGHTS

Instead of the desktop long horizontal strip, use horizontally swipeable insight cards.

Cards:

Deposits
Withdrawals
Purchases
Game Earnings
Bonuses
Prizes Won
Net Movement

Each card:

icon
label
value
change %
small sparkline

Card width:
approximately 65-75% of viewport

Use:

overflow-x-auto
scroll-snap-type: x mandatory

The user can swipe through insights.

==================================================
13. RECENT TRANSACTIONS
==================================================

Create a clean transaction section.

Title:

RECENT TRANSACTIONS           See All

Show latest 5 transactions.

Each row:

[icon]
transaction title
date/time
amount

Example:

Deposit
Today, 10:42
+100 ⚡

Competition Entry
Today, 09:15
-20 ⚡

Prize Won
Yesterday
+75 ⚡

Color rules:

money in:
green

money out:
red/orange

prize:
gold

game earnings:
cyan

Rows approximately:
58-66px.

Do NOT use a desktop transaction table.

==================================================
14. TRANSACTION DETAILS
==================================================

When user taps a transaction:

open bottom sheet or detail page.

Show:

Type
Amount
Date
Status
Reference
Source
Competition/Game if relevant

Do not clutter the main wallet screen with all details.

==================================================
15. AVAILABLE / PENDING BALANCE
==================================================

If ChartVolt has:

available balance
pending balance
locked funds

show these BELOW the main balance as a compact row.

Example:

Available
920.50 ⚡

Pending
67.32 ⚡

Do not make these equal visual importance to total balance.

==================================================
16. RANGE FILTER
==================================================

The selected wallet period should update:

Wallet Balance Trend
Daily Volt Flow
Money In/Out
Wallet Insights

Use one shared wallet period state.

Example:

7D
30D
90D
ALL

Do NOT create separate independent filter state for every chart unless necessary.

==================================================
17. MOBILE GRAPH RULES
==================================================

Mobile graphs must be touch-first.

Use:

large tooltip
larger hit areas
fewer labels
simplified legends
no hover dependency
responsive width
fixed practical height

Avoid:

tiny points
tiny legends
many category labels
desktop tooltip behavior
horizontal overflow

==================================================
18. CHART STYLE
==================================================

Match ChartVolt Performance Analytics styling.

Background:

#030916
#050B18

Chart card:
dark blue glass

Border:
cyan/blue low-opacity edge

Use subtle glow.

Graph colors:

wallet balance:
gold

deposit:
green

withdrawal:
pink/red

game earnings:
cyan

prizes:
orange/gold

bonus:
purple

purchases:
yellow/orange

Keep these consistent across the entire wallet.

==================================================
19. CARD DESIGN
==================================================

Use consistent wallet cards.

Recommended:

border-radius:
16-20px

padding:
14-18px

border:
1px solid rgba(0, 210, 255, .25)

background:
linear-gradient(
  135deg,
  rgba(7, 19, 42, .96),
  rgba(3, 8, 20, .96)
)

Do NOT add a strong glow around every card.

Glow should mainly appear on:

balance
selected tab
important CTA
positive reward
active item

==================================================
20. TYPOGRAPHY
==================================================

Mobile Wallet typography:

Page title:
20-24px

Balance:
32-40px

Section title:
15-17px

Metric value:
20-24px

Card labels:
11-13px

Body:
13-15px

Secondary text:
11-12px

Do not shrink text just to fit desktop information.

==================================================
21. MOBILE SPACING
==================================================

Horizontal padding:
16px

Section gap:
20-24px

Card gap:
12-14px

Internal card padding:
14-18px

Use more breathing room than desktop.

==================================================
22. MOBILE NAVIGATION
==================================================

Wallet must work naturally with the ChartVolt bottom mobile nav.

Primary bottom nav:

Home
Games
Compete
Wallet
Profile

Wallet should appear active.

Active wallet icon:
cyan/blue glow.

Add page bottom padding:

calc(80px + env(safe-area-inset-bottom))

so content never goes behind the navigation.

==================================================
23. SAFE AREA
==================================================

Support iPhones / modern phones.

Use:

padding-top:
env(safe-area-inset-top)

padding-inline:
max(16px, env(safe-area-inset-left))

padding-bottom:
calc(80px + env(safe-area-inset-bottom))

==================================================
24. COMPONENT STRUCTURE
==================================================

Create dedicated mobile wallet components.

Recommended:

components/
wallet/
desktop/
DesktopWalletAnalytics.tsx

mobile/
MobileWallet.tsx
MobileWalletHeader.tsx
MobileBalanceCard.tsx
MobileWalletActions.tsx
MobileWalletOverview.tsx
MobileWalletTrend.tsx
MobileMoneyFlow.tsx
MobileDailyFlow.tsx
MobileWalletInsights.tsx
MobileRecentTransactions.tsx
MobileTransactionSheet.tsx

Shared:

hooks/
useWalletAnalytics.ts

Do NOT duplicate wallet API calls.

==================================================
25. SHARED DATA
==================================================

Both desktop and mobile should use the same source data.

Example:

const wallet = useWalletAnalytics();

DesktopWalletAnalytics
MobileWallet

must consume the same backend state.

Do not create:

useDesktopWallet()
useMobileWallet()

if they fetch the same data.

==================================================
26. DATA MUST BE REAL
==================================================

Do not hardcode values from the design.

Use real ChartVolt data for:

wallet balance
total spend
game earnings
prizes
deposits
withdrawals
bonuses
purchases
fees
net movement
wallet history
daily flow
transactions

The reference image is visual guidance only.

==================================================
27. PERFORMANCE
==================================================

Do not load unnecessary chart libraries twice.

Reuse current chart library.

Lazy-load lower sections if useful.

Memoize chart transformations.

Avoid rendering hundreds of transactions.

Show only 5 recent items on mobile.

Use:
See All

for the complete history.

==================================================
28. MOBILE EMPTY STATES
==================================================

Handle:

No transactions
No deposits
No withdrawals
No game earnings
Zero wallet balance

Do not show broken empty charts.

Example:

No wallet activity yet.
Your transactions will appear here once you start using your Volts.

==================================================
29. LOADING STATES
==================================================

Use skeletons for:

balance
metrics
charts
transactions

Do not show layout jumps.

Keep skeleton dimensions equal to final card sizes.

==================================================
30. ERROR STATES
==================================================

If wallet data fails:

show a compact retry state.

Example:

We couldn't load your wallet right now.

[Retry]

Do NOT leave blank charts.

==================================================
31. ACCESSIBILITY
==================================================

Provide:

aria-labels
proper button semantics
readable contrast
visible selected states
screen-reader transaction descriptions

Do not use color alone to communicate positive/negative activity.

Use:

+ / -
icons
labels

as well.

==================================================
32. RESPONSIVE BEHAVIOR
==================================================

Test:

360x800
375x812
390x844
393x852
412x915
430x932

Verify:

no horizontal overflow
charts resize correctly
balance never clips
buttons remain touchable
transaction amounts remain visible
bottom nav does not cover content
insight cards snap correctly
text remains readable

==================================================
33. DESKTOP MUST REMAIN UNCHANGED
==================================================

Do not modify DesktopWalletAnalytics styling just to make mobile work.

Use separate layouts.

Example:

<>
  <div className="hidden md:block">
    <DesktopWalletAnalytics />
  </div>

  <div className="md:hidden">
    <MobileWallet />
  </div>
</>

==================================================
34. EXACT MOBILE VISUAL FLOW
==================================================

The user should see:

WALLET
↓
LARGE BALANCE
↓
DEPOSIT / WITHDRAW
↓
QUICK WALLET METRICS
↓
BALANCE TREND
↓
MONEY IN / MONEY OUT
↓
DAILY VOLT FLOW
↓
WALLET INSIGHTS
↓
RECENT TRANSACTIONS
↓
BOTTOM NAV

This is the required visual hierarchy.

==================================================
35. IMPORTANT UX RULE
==================================================

Do NOT treat mobile Wallet as an analytics dashboard first.

It is a WALLET first.

The priority is:

1. My balance
2. Deposit / Withdraw
3. What changed?
4. Where did my Volts come from?
5. Where did my Volts go?
6. Recent transactions
7. Deeper analytics

The page should feel usable even for someone who does not understand financial charts.

==================================================
36. FINAL ACCEPTANCE CRITERIA
==================================================

Do not mark the task finished until:

- desktop Wallet remains unchanged
- mobile Wallet has its own layout
- balance is dominant
- Deposit and Withdraw are immediately visible
- charts are touch-friendly
- graphs do not overflow
- transaction history is readable
- no tiny desktop labels remain
- real backend wallet data is used
- Wallet visually matches ChartVolt Performance Analytics
- mobile navigation works
- all wallet actions still work
- loading/error/empty states work
- safe areas work
- the page looks like a proper mobile fintech/gaming wallet