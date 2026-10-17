TASK: REBUILD WALLET ANALYTICS TO MATCH THE PROVIDED REFERENCE

IMPORTANT:
Do NOT simply restyle the existing wallet analytics.
Do NOT keep the current page structure if it differs from the reference.
Rebuild the page layout so the final result follows the reference image very closely.

The reference image is the source of truth for:
- section order
- card sizes
- spacing
- visual hierarchy
- chart placement
- proportions
- colors
- borders
- glow intensity
- typography hierarchy
- responsive behavior

The current backend/data/API logic must remain functional.
Only restructure the presentation layer and chart visualization.

==================================================
1. OVERALL PAGE GOAL
==================================================

Create a premium ChartVolt Wallet Analytics page that feels like:

- futuristic gaming dashboard
- modern fintech analytics
- polished and professional
- visually rich without becoming busy
- easy to scan
- consistent with the Performance Analytics page
- same neon ChartVolt theme

The current page looks too flat, too empty and too much like a generic admin dashboard.

The new page must have:
- stronger hierarchy
- clearly grouped data
- better visual flow
- large meaningful graphs
- compact KPI cards
- consistent spacing
- proper card borders
- subtle glass/neon effects
- no unnecessary empty space

==================================================
2. PAGE STRUCTURE — EXACT ORDER
==================================================

Use this structure from top to bottom:

A. Wallet Analytics page header
B. 4 primary KPI cards
C. Row 1:
   - Wallet Balance Trend
   - Credit Breakdown
D. Row 2:
   - Daily Credit Flow
   - Spending vs Earnings
E. Bottom horizontal Wallet Insights strip

DO NOT change this order.

==================================================
3. PAGE HEADER
==================================================

At the top create:

LEFT:
Wallet icon in a glowing blue square

Title:
Wallet Analytics

Subtitle:
Track your credits, spending, earnings and overall wallet activity.

RIGHT:
Date range selector

Example:
Aug 31, 2024 - Sep 29, 2024

The header should sit over a subtle neon geometric / mountain-line background.

Do not use a large hero banner.

Header height should remain compact:
approximately 90-110px including top spacing.

==================================================
4. PRIMARY KPI CARDS
==================================================

Create FOUR cards in one horizontal row on desktop.

Cards:

1. CREDIT BALANCE
2. TOTAL SPEND
3. GAME EARNINGS
4. PRIZES WON

Each card must include:

- icon on left
- small uppercase label
- large primary value
- percentage change
- comparison text such as "vs last period"
- small sparkline graph on right
- distinct accent color
- subtle decorative glow circle in corner

Colors:

Credit Balance:
gold / yellow

Total Spend:
pink / magenta

Game Earnings:
green / cyan

Prizes Won:
orange

Recommended card height:
90-110px

Desktop:
grid-template-columns: repeat(4, 1fr);

Gap:
14-18px

Do NOT make the cards extremely tall.

Do NOT show too much text.

==================================================
5. KPI CARD VISUAL STYLE
==================================================

Cards should use:

dark navy glass background

Example:
background:
linear-gradient(
  135deg,
  rgba(9, 22, 45, .96),
  rgba(3, 10, 25, .96)
);

border:
1px solid accent-color with ~40% opacity

box-shadow:
0 0 20px rgba(accentColor, .08);

border-radius:
14-18px

Use a slightly brighter edge for the active accent.

Do NOT create huge outer glow.

The cards need to remain clean.

==================================================
6. WALLET BALANCE TREND — LARGE LEFT GRAPH
==================================================

First large analytics row.

LEFT SIDE:
Wallet Balance Trend

This must be the largest financial chart.

Header:
Wallet Balance Trend

Subtitle:
Track your wallet balance over time with daily changes.

Controls on top-right:

7D
30D
90D
All

30D selected.

GRAPH:
Use an AREA + LINE chart.

Important visual details:

- yellow/gold line
- smooth interpolation
- subtle gold fill gradient underneath
- dots on important points
- vertical hover guideline
- tooltip
- dark grid lines
- readable date labels

Example tooltip:

Sep 27, 2024
842.60

The chart needs to fill most of the card.

Avoid:
- a tiny line sitting in empty space
- too much top padding
- tiny labels
- excessive graph margins

==================================================
7. CREDIT BREAKDOWN — LARGE RIGHT GRAPH
==================================================

RIGHT SIDE of first analytics row:

Credit Breakdown

Subtitle:
See how your credits are sourced and used.

This should use a MULTI-SERIES BAR CHART.

Categories:

Deposits
Purchases
Game Earnings
Bonuses
Prizes
Withdrawals

Recommended colors:

Deposits: green
Purchases: yellow
Game Earnings: cyan
Bonuses: purple/pink
Prizes: orange
Withdrawals: red

The graph should show transaction activity over time.

Below the graph add SIX compact summary cards:

Total Deposits
Total Purchases
Game Earnings
Bonuses
Prizes Won
Withdrawals

Each summary tile:
- colored dot
- label
- value

Keep them compact.

==================================================
8. FIRST GRAPH ROW GRID
==================================================

Desktop:

grid-template-columns:
1.1fr 1fr

or approximately:

55% Wallet Balance Trend
45% Credit Breakdown

Both cards should have the same height.

Recommended height:
300-340px.

==================================================
9. DAILY CREDIT FLOW
==================================================

Second row LEFT.

Title:
Daily Credit Flow

Subtitle:
Daily net credit movement in your wallet.

Use a POSITIVE / NEGATIVE BAR CHART.

Positive values:
green

Negative values:
red

Optional neutral/special values:
yellow

Baseline should be clearly visible at zero.

Do not use the current tiny compressed graph.

Graph should occupy most of the card.

Include:

7D
30D
90D
All

30D selected.

==================================================
10. SPENDING VS EARNINGS
==================================================

Second row RIGHT.

Title:
Spending vs Earnings

Subtitle:
Compare your spending with earnings and prizes.

Use a DONUT chart on the left.

Center:
total wallet flow / total credits

Example:

1.37K
Total Credits

RIGHT SIDE:
horizontal breakdown rows.

Example:

Purchases       62.7%    858.00
Prizes Won      15.8%    215.82
Game Earnings    4.9%     67.00
Bonuses          1.8%     25.00
Withdrawals      9.0%    123.32
Net Movement     5.8%     79.50

Each row should have:

- color dot
- label
- percentage
- horizontal progress line
- value

This is much easier to understand than showing another complex graph.

==================================================
11. SECOND GRAPH ROW GRID
==================================================

Use:

grid-template-columns:
1.1fr 1fr

Same proportions as the first graph row.

Cards should align perfectly.

No random heights.

==================================================
12. WALLET INSIGHTS STRIP
==================================================

At the bottom add a full-width section:

Wallet Insights

Subtitle:
Key metrics and transaction summary for the selected period.

RIGHT:
View All Transactions →

Below title:
a horizontal row of compact insight cards.

Cards:

Deposits
Withdrawals
Purchases
Game Earnings
Bonuses
Prizes Won
Net Movement

Each card contains:

- icon
- title
- value
- change percentage
- small sparkline

Use consistent colors.

This strip should be approximately:
100-130px tall.

Do not create another huge section.

==================================================
13. DATA — DO NOT HARDCODE
==================================================

Everything must use the existing wallet backend data.

Do NOT hardcode example values from the image.

Examples include:

walletBalance
totalSpend
gameEarnings
prizesWon
deposits
withdrawals
bonuses
purchases
netMovement
dailyCreditFlow
walletHistory

Create normalized frontend selectors if needed.

For example:

const walletAnalytics = useMemo(() => ({
   creditBalance: ...,
   totalSpend: ...,
   gameEarnings: ...,
   prizesWon: ...,
   ...
}), [walletData]);

==================================================
14. USE EXISTING API DATA — ONLY TRANSFORM IT
==================================================

Do NOT create duplicate API requests just because a new chart needs data.

Reuse existing wallet API data.

Transform client-side into:

walletBalanceSeries
creditBreakdownSeries
dailyFlowSeries
spendingVsEarningsData
walletInsightMetrics

Keep API access centralized.

==================================================
15. GRAPH LIBRARY
==================================================

Use the existing chart library if the project already uses one.

If using Recharts:

Wallet Balance Trend:
AreaChart

Credit Breakdown:
BarChart

Daily Credit Flow:
BarChart

Spending vs Earnings:
PieChart

Do NOT introduce another graph framework unless absolutely necessary.

==================================================
16. GRAPH QUALITY
==================================================

All graphs must look premium.

Use:

smooth curves
subtle gradients
neon point highlights
thin grid lines
soft axis text
clean tooltips
proper padding
animated initial render
hover states

DO NOT use:
- giant axis labels
- thick grid lines
- default Recharts styling
- bright white backgrounds
- generic Bootstrap-looking graphs

==================================================
17. WALLET BALANCE CHART EXAMPLE
==================================================

Structure concept:

<ResponsiveContainer width="100%" height="100%">
  <AreaChart data={walletBalanceSeries}>
    <defs>
      <linearGradient id="walletGold" ... />
    </defs>

    <CartesianGrid strokeDasharray="3 3" />
    <XAxis />
    <YAxis />
    <Tooltip />
    <Area
      type="monotone"
      dataKey="balance"
      stroke="#ffc928"
      fill="url(#walletGold)"
    />
  </AreaChart>
</ResponsiveContainer>

Do not copy colors literally if ChartVolt already has token variables.

Use theme tokens.

==================================================
18. DAILY CREDIT FLOW LOGIC
==================================================

The bar color should depend on value.

Example:

value >= 0
=> green

value < 0
=> red

Use a custom Cell:

data.map((entry, index) => (
   <Cell
      key={index}
      fill={entry.value >= 0 ? positiveColor : negativeColor}
   />
))

==================================================
19. SPENDING VS EARNINGS DONUT
==================================================

Use only categories with meaningful values.

Avoid showing a meaningless zero-value slice.

Order categories consistently.

Use the same category colors everywhere on the page.

For example:

depositGreen
purchaseYellow
gameCyan
bonusPink
prizeOrange
withdrawalRed

These colors must match:

Credit Breakdown
Spending vs Earnings
Wallet Insights

Consistency is important.

==================================================
20. CARD LAYOUT SYSTEM
==================================================

Create reusable components:

WalletAnalyticsPage.tsx

WalletAnalyticsHeader.tsx

WalletKpiGrid.tsx
WalletKpiCard.tsx

WalletBalanceTrend.tsx
CreditBreakdownChart.tsx
DailyCreditFlow.tsx
SpendingVsEarnings.tsx

WalletInsights.tsx
WalletInsightCard.tsx

AnalyticsCard.tsx
ChartRangeSelector.tsx

Do NOT build one giant 1000-line page component.

==================================================
21. REUSABLE ANALYTICS CARD
==================================================

Create one consistent wrapper.

Example:

<AnalyticsCard
  title="Wallet Balance Trend"
  subtitle="Track your wallet balance over time with daily changes."
  icon={<ChartIcon />}
  controls={<ChartRangeSelector />}
/>

Every chart panel should use the same:

header height
border radius
padding
title size
subtitle size
border treatment

==================================================
22. SPACING
==================================================

Desktop page padding:
24px

Page section gap:
14-18px

Card padding:
18-22px

Internal spacing:
12-16px

Card radius:
14-18px

Graph header:
approximately 56-64px

Keep layout dense but comfortable.

DO NOT create giant blank spaces.

==================================================
23. PAGE WIDTH
==================================================

Wallet Analytics should use the available application content width.

Do NOT constrain it to an unnecessarily narrow center column.

Example:

width: 100%

max-width:
none or the same max width used by Performance.

It should align with the Performance Analytics page.

==================================================
24. TYPOGRAPHY
==================================================

Page Title:
28-34px desktop

Card title:
16-18px

KPI label:
11-13px

KPI number:
22-28px

Normal analytics text:
12-14px

Secondary labels:
11-12px

Important:
do not reduce text to tiny 8-9px fonts just to fit things.

==================================================
25. VISUAL BACKGROUND
==================================================

Use the same background language as the Performance page.

Main background:
deep navy / midnight blue.

Add a subtle:

neon polygonal mountain line
energy wave
geometric chart line

behind the PAGE HEADER ONLY or very subtly behind content.

Do not place busy artwork behind graph values.

Graphs need clean contrast.

==================================================
26. GLOW CONTROL
==================================================

Do not glow everything.

Glow hierarchy:

STRONG:
selected KPI accent
selected range button
important data point
CTA

MEDIUM:
chart headers
icons

LOW:
card borders

NONE:
normal text
grid lines
background

The current ChartVolt design becomes difficult to read if every border glows equally.

==================================================
27. FILTER / DATE STATE
==================================================

Date range must affect ALL charts.

For example:

selectedRange = 7D / 30D / 90D / ALL

This should update:

Wallet Balance Trend
Credit Breakdown
Daily Credit Flow
Spending vs Earnings
Wallet Insights

Do NOT have independent range state for every panel unless there is a real reason.

Preferred:
one global wallet analytics period.

==================================================
28. RESPONSIVE TABLET
==================================================

At tablet:

KPI cards:
2x2

Chart rows:
can remain 2 columns if width permits

Otherwise:
stack cards.

Insight cards:
horizontal scrolling or 3-column layout.

==================================================
29. MOBILE
==================================================

Mobile must NOT shrink this desktop design.

On mobile:

Wallet header
Balance card
Other KPIs in horizontal scroll
Wallet Balance Trend
Daily Credit Flow
Credit Breakdown
Spending vs Earnings
Wallet Insights horizontal scroll

Charts should be full width.

Avoid side-by-side graph panels on mobile.

==================================================
30. IMPORTANT VISUAL CONSISTENCY WITH PERFORMANCE PAGE
==================================================

Wallet Analytics and Performance Analytics should clearly look like parts of the SAME PRODUCT.

Use the same:

page title style
background
section headers
date selector
range selectors
card radius
border thickness
fonts
icon treatment
glow intensity
chart controls
tooltip styling

But Wallet should have its own financial color language:

gold
green
magenta
orange
cyan

==================================================
31. THINGS TO REMOVE FROM CURRENT WALLET PAGE
==================================================

Remove:

- huge empty graph areas
- excessively wide blank cards
- tiny labels
- weak hierarchy
- inconsistent graph heights
- random unused spacing
- thin illegible graph data
- default chart styling
- repeated controls that do nothing
- cards without visual purpose

==================================================
32. EXACT DESKTOP FLOW
==================================================

The final page must visually read like this:

WALLET ANALYTICS
[DATE]

[ CREDIT BALANCE ]
[ TOTAL SPEND ]
[ GAME EARNINGS ]
[ PRIZES WON ]

[          WALLET BALANCE TREND          ]
[             CREDIT BREAKDOWN           ]

[           DAILY CREDIT FLOW            ]
[           SPENDING VS EARNINGS         ]

[ WALLET INSIGHTS: 7 COMPACT CARDS       ]

The user should be able to understand the wallet state from top to bottom without hunting for information.

==================================================
33. IMPORTANT CURSOR INSTRUCTION
==================================================

Before coding:

1. inspect the existing wallet page
2. identify all wallet API hooks
3. identify existing chart components
4. preserve working data fetching
5. separate data from layout
6. rebuild the layout
7. replace old chart presentation
8. test with real data
9. test zero-value states
10. test mobile/tablet/desktop

Do NOT redesign blindly without checking current data structures.

==================================================
34. ACCEPTANCE CRITERIA
==================================================

The task is NOT finished until:

- The page visually resembles the supplied reference.
- Four KPI cards are aligned in one row on desktop.
- Wallet Balance Trend and Credit Breakdown align perfectly.
- Daily Credit Flow and Spending vs Earnings align perfectly.
- Graphs fill their available panels.
- No huge empty spaces remain.
- Wallet Insights appear in a single compact bottom strip.
- Colors are consistent.
- Date/range controls work.
- Tooltips work.
- Existing wallet data remains real.
- Desktop and mobile do not overflow.
- Page visually matches the Performance Analytics design system.
- No existing wallet functionality is broken.

DO NOT settle for “similar.”
Match the structure, proportions, hierarchy and visual quality of the reference as closely as possible.

Do not treat the reference as inspiration only. Treat it as the target layout. First recreate the geometry: section order, widths, heights, spacing and card positions. Only after the geometry matches should you polish colors, shadows, icons and graphs. Do not keep old wallet components in their old positions just because they already exist. Reuse their data/logic, not their layout.

For the two main desktop columns, I would use something close to:

<div className="grid grid-cols-12 gap-4">
  <section className="col-span-7">
    <WalletBalanceTrend />
  </section>

  <section className="col-span-5">
    <CreditBreakdown />
  </section>

  <section className="col-span-7">
    <DailyCreditFlow />
  </section>

  <section className="col-span-5">
    <SpendingVsEarnings />
  </section>
</div>

And the top cards:

<div className="grid grid-cols-4 gap-4">
  <WalletKpiCard type="balance" />
  <WalletKpiCard type="spend" />
  <WalletKpiCard type="games" />
  <WalletKpiCard type="prizes" />
</div>

That geometry is important: large left analytical graph + slightly smaller right analytical graph, repeated in the second row, then the compact full-width insights strip. This is what gives the wallet page the same natural flow and polished structure as the reference.