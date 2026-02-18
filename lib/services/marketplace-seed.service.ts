/**
 * Marketplace Seed Service
 *
 * Seeds marketplace items: cosmetic avatars and game master packages.
 * Indicators and strategies have been removed for one-by-one rebuild.
 */

import { connectToDatabase } from "@/database/mongoose";
import {
  MarketplaceItem,
  IMarketplaceItem,
} from "@/database/models/marketplace/marketplace-item.model";
import { readFile } from "fs/promises";
import path from "path";

// ============================================================================
// NOTE: All indicator and strategy definitions have been removed.
// They will be rebuilt one-by-one with proper testing.
// The indicator calculation functions in indicators.service.ts are preserved.
// ============================================================================

// ============================================================================
// COSMETIC AVATARS
// ============================================================================

const AVATAR_SHADOW_TRADER: Partial<IMarketplaceItem> = {
  name: "Shadow Trader",
  slug: "avatar-shadow-trader",
  shortDescription:
    "A mysterious hooded figure wielding a flaming Bitcoin and katana.",
  fullDescription: `# Shadow Trader

## Origin Story
Once a legendary samurai in feudal Japan, Kuro Yamazaki discovered a portal through time while meditating at a sacred temple. Transported to the digital age, he found his warrior skills perfectly suited for the volatile crypto markets. Now known as the Shadow Trader, he strikes with precision, his ancient katana replaced with algorithmic insights, and the flames of his Bitcoin coin representing his burning passion for profitable trades.

## Symbolism
- **The Katana**: Precision and decisive action in trading
- **Flaming Bitcoin**: Mastery over volatile assets
- **Red Eyes**: Seeing through market manipulation
- **Trading Charts Background**: Always analyzing, always watching

*"In the shadows of the charts, opportunity awaits the patient warrior."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/shadow-trader.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "ninja", "crypto", "legendary"],
  riskLevel: "low",
};

const AVATAR_PHANTOM_OPERATIVE: Partial<IMarketplaceItem> = {
  name: "Phantom Operative",
  slug: "avatar-phantom-operative",
  shortDescription:
    "Elite tactical trader with advanced combat gear and glowing red optics.",
  fullDescription: `# Phantom Operative

## Origin Story
Former special forces commander Victor "Ghost" Reyes was recruited by a secretive hedge fund after his military career. His tactical expertise translated seamlessly to high-frequency trading. Equipped with cutting-edge neural interfaces and combat-grade analysis tools, he executes trades with military precision. His signature red eye implant processes market data faster than any human could naturally perceive.

## Symbolism
- **Tactical Gear**: Prepared for any market condition
- **Red Eye Glow**: Enhanced pattern recognition
- **Weapon**: Armed with data and analysis
- **Dark Hood**: Operating in the shadows of the market

*"Every trade is a mission. Every profit is victory."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/phantom-operative.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "tactical", "military", "elite"],
  riskLevel: "low",
};

const AVATAR_CYBER_RONIN: Partial<IMarketplaceItem> = {
  name: "Cyber Ronin",
  slug: "avatar-cyber-ronin",
  shortDescription:
    "Futuristic samurai warrior with neon-lit crimson armor and dual katanas.",
  fullDescription: `# Cyber Ronin

## Origin Story
In Neo-Tokyo 2087, the legendary trader Akira Takeshi refused to serve the corporate megacorps that controlled the markets. Cast out as a ronin—a masterless samurai—he forged his own path. His armor, infused with quantum processors, glows with the energy of a thousand calculations. Each trade he makes honors the code of the ancient warriors: discipline, patience, and unwavering focus.

## Symbolism
- **Neon Armor**: Technology fused with tradition
- **Blue Energy Halo**: Enlightened market understanding
- **Dual Katanas**: Balance in trading strategy
- **Red Accents**: Warning to market manipulators

*"Honor in profit. Discipline in loss. The way of the Cyber Ronin."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/cyber-ronin.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "samurai", "cyber", "futuristic"],
  riskLevel: "low",
};

const AVATAR_CRYPTO_ORACLE: Partial<IMarketplaceItem> = {
  name: "Crypto Oracle",
  slug: "avatar-crypto-oracle",
  shortDescription:
    "Mystical tech-mage who channels market wisdom through arcane algorithms.",
  fullDescription: `# Crypto Oracle

## Origin Story
Dr. Elena Voss was a quantum physicist who discovered that market patterns mirrored ancient mystical formulas. Abandoning academia, she merged her scientific knowledge with esoteric wisdom. Now known as the Crypto Oracle, she wields a holographic grimoire containing algorithms that seem to predict the future. The Bitcoin orb floating above her hand channels pure market energy into actionable insights.

## Symbolism
- **Holographic Book**: Ancient wisdom meets modern technology
- **Bitcoin Orb**: Mastery over digital currencies
- **Blue Energy**: Calm, calculated decision making
- **Hooded Robe**: Keeper of trading secrets

*"The markets speak to those who listen with both logic and intuition."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/crypto-oracle.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "mage", "oracle", "mystical"],
  riskLevel: "low",
};

const AVATAR_NEBULA_SNIPER: Partial<IMarketplaceItem> = {
  name: "Nebula Sniper",
  slug: "avatar-nebula-sniper",
  shortDescription:
    "Cosmic marksman who targets opportunities across the market universe.",
  fullDescription: `# Nebula Sniper

## Origin Story
Commander Zara Chen was Earth's finest long-range specialist before the Galactic Trading Federation recruited her. In the vastness of space, she learned that patience was the ultimate weapon. Her plasma rifle now fires precision trades instead of energy bolts. The swirling nebula around her represents the chaos of markets she has learned to navigate with deadly accuracy.

## Symbolism
- **Plasma Rifle**: Precision entry and exit points
- **Cosmic Background**: Global market perspective
- **Glowing Eyes**: Enhanced market vision
- **Battle Armor**: Protection against volatility

*"One shot. One trade. Maximum impact."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/nebula-sniper.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "sniper", "space", "precision"],
  riskLevel: "low",
};

const AVATAR_BLOOD_SHOGUN: Partial<IMarketplaceItem> = {
  name: "Blood Shogun",
  slug: "avatar-blood-shogun",
  shortDescription:
    "Battle-scarred warrior whose crimson scarf tells tales of market conquests.",
  fullDescription: `# Blood Shogun

## Origin Story
General Ryu Matsumoto earned his title on countless battlefields before discovering the ultimate war—the financial markets. Each scar on his armor represents a lesson learned from devastating losses. His crimson scarf, stained with the "blood" of failed positions, reminds him that survival requires sacrifice. Now a trading legend, he leads armies of followers into profitable campaigns.

## Symbolism
- **Scarred Armor**: Lessons from past losses
- **Crimson Scarf**: Sacrifice and determination
- **Glowing Red Eyes**: Seeing through fear and greed
- **Battle-worn Katana**: Sharpened by experience

*"Every scar is a lesson. Every loss, a teacher."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/blood-shogun.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "warrior", "shogun", "battle"],
  riskLevel: "low",
};

const AVATAR_VOID_HUNTER: Partial<IMarketplaceItem> = {
  name: "Void Hunter",
  slug: "avatar-void-hunter",
  shortDescription:
    "Interdimensional trader who harvests profits from market anomalies.",
  fullDescription: `# Void Hunter

## Origin Story
When scientist Dr. Marcus Webb opened a portal to another dimension, he discovered markets that existed outside of time. Now transformed by void energy, he hunts for price anomalies and arbitrage opportunities that others cannot perceive. His weapon fires concentrated void matter that isolates and captures fleeting market inefficiencies before they disappear.

## Symbolism
- **Void Energy Weapon**: Capturing fleeting opportunities
- **Blue Void Portal**: Access to hidden market data
- **Dark Armor**: Protection from market noise
- **Glowing Visor**: Seeing patterns in chaos

*"In the void between candles, fortunes are made."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/void-hunter.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "void", "hunter", "cosmic"],
  riskLevel: "low",
};

const AVATAR_INFERNO_LORD: Partial<IMarketplaceItem> = {
  name: "Inferno Lord",
  slug: "avatar-inferno-lord",
  shortDescription: "Demonic titan who thrives in the flames of market chaos.",
  fullDescription: `# Inferno Lord

## Origin Story
Once a mortal trader consumed by greed, Azaroth was transformed by the fires of a spectacular market crash. Rather than being destroyed, he emerged as the Inferno Lord—a being who draws power from market volatility. When others flee from red candles, he advances. His molten axe cleaves through panic selling, and his fiery form grows stronger with each bout of market fear.

## Symbolism
- **Molten Axe**: Cutting through market panic
- **Fire Aura**: Thriving in volatility
- **Demonic Form**: Embracing what others fear
- **Glowing Core**: Inner conviction

*"Let the markets burn. I am reborn in every crash."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/inferno-lord.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "demon", "fire", "chaos"],
  riskLevel: "low",
};

const AVATAR_ALCHEMIST_PRIME: Partial<IMarketplaceItem> = {
  name: "Alchemist Prime",
  slug: "avatar-alchemist-prime",
  shortDescription: "Master of transformation who turns market lead into gold.",
  fullDescription: `# Alchemist Prime

## Origin Story
Aldric Goldweaver was a medieval alchemist who finally discovered the secret of transmutation—not of metals, but of value itself. Transported through time by his experiments, he found the modern markets to be the ultimate alchemical laboratory. His green elixirs represent risk management, while the golden Bitcoin in his palm shows his mastery over digital gold.

## Symbolism
- **Green Elixir**: Calculated risk-taking
- **Golden Bitcoin**: Successful transformation
- **Mystical Symbols**: Pattern recognition
- **Blue Eyes**: Clarity of vision

*"The philosopher's stone was never about gold. It was about understanding value."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/alchemist-prime.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "alchemist", "mystical", "gold"],
  riskLevel: "low",
};

const AVATAR_STORM_CENTURION: Partial<IMarketplaceItem> = {
  name: "Storm Centurion",
  slug: "avatar-storm-centurion",
  shortDescription:
    "Lightning-wielding gladiator who commands the arena of trading.",
  fullDescription: `# Storm Centurion

## Origin Story
Marcus Aurelius Volt was the champion of the Colosseum trading pits before they were automated. When algorithms replaced human traders, he refused to be obsolete. Augmenting himself with cybernetic enhancements, he now fights in digital arenas. His spear channels lightning—the same speed at which he executes trades—and his armor is forged from the remains of failed trading bots he has defeated.

## Symbolism
- **Lightning Spear**: Speed of execution
- **Gladiator Armor**: Battle-tested strategy
- **Glowing Energy Nodes**: Powered by conviction
- **Red Plume**: Leadership and visibility

*"In the arena of markets, only the swift survive."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/storm-centurion.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "gladiator", "lightning", "warrior"],
  riskLevel: "low",
};

const AVATAR_QUANTUM_SAGE: Partial<IMarketplaceItem> = {
  name: "Quantum Sage",
  slug: "avatar-quantum-sage",
  shortDescription:
    "Enlightened master who sees all possible market outcomes simultaneously.",
  fullDescription: `# Quantum Sage

## Origin Story
Professor Thaddeus Quark achieved the impossible—he merged his consciousness with a quantum computer. Now existing in a state of superposition, he can perceive multiple market timelines simultaneously. The glowing flask he carries contains probability essence, while the Bitcoin hovering near him exists in a state of both profit and loss until observed. His trading decisions collapse reality into favorable outcomes.

## Symbolism
- **Probability Flask**: Managing multiple scenarios
- **Floating Bitcoin**: Quantum state of trades
- **Ethereal Energy**: Connection to market consciousness
- **Wise Countenance**: Centuries of market wisdom

*"In every trade, infinite outcomes. The sage chooses wisely."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/quantum-sage.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "sage", "quantum", "wisdom"],
  riskLevel: "low",
};

const AVATAR_DIGITAL_ASSASSIN: Partial<IMarketplaceItem> = {
  name: "Digital Assassin",
  slug: "avatar-digital-assassin",
  shortDescription:
    "Silent killer of bad trades with plasma-powered precision.",
  fullDescription: `# Digital Assassin

## Origin Story
Known only by her codename "Zero," this elite operative was trained by a clandestine organization of market makers. Her mission: eliminate inefficiencies and punish bad actors. Her plasma rifle can "assassinate" poorly performing positions instantly, and her neural implants process market data faster than institutional algorithms. She leaves no trace—only profits in her wake.

## Symbolism
- **Plasma Rifle**: Instant position execution
- **Pink/Red Energy**: Aggressive profit-taking
- **Sleek Armor**: Efficiency and speed
- **Masked Face**: Anonymous trading

*"Every bad trade has a weakness. I find it."*`,
  category: "cosmetic",
  price: 5,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  cosmeticType: "avatar",
  imageUrl: "/assets/avatars/digital-assassin.png",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["avatar", "cosmetic", "assassin", "digital", "precision"],
  riskLevel: "low",
};

// ============================================================================
// GAME MASTER PACKAGES
// ============================================================================

const GAMEMASTER_STARTER_PACKAGE: Partial<IMarketplaceItem> = {
  name: "Game Master Starter",
  slug: "game-master-starter",
  shortDescription:
    "Begin your Game Master journey! Create daily competitions, earn 5% from referrals, and build your trading community.",
  fullDescription: `# Welcome to Your Game Master Journey

The **Starter Package** is your gateway to becoming a Game Master on ChartVolt. Perfect for traders who want to dip their toes into community building while earning passive income.

## What You Get

- **1 Competition per Day** - Host daily trading battles for your community
- **Up to 30 Participants** - Perfect size for intimate, competitive events
- **5% Referral Earnings** - Earn from every entry fee your referred users pay
- **30 Days Duration** - Full month of Game Master privileges

## How Referral Earnings Work

When users sign up using your unique referral link and join ANY competition on the platform:
- They pay the entry fee as normal
- You automatically receive 5% of their entry fee
- Earnings are credited instantly to your wallet

## Perfect For

- New community builders testing the waters
- Traders with small but loyal followings
- Anyone wanting to start earning from referrals

*"Every Game Master empire started somewhere. Start yours today."*`,
  category: "gamemaster",
  price: 299,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: false,
  version: "1.0.0",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["gamemaster", "starter", "referral", "beginner", "affordable"],
  riskLevel: "low",
  gameMasterConfig: {
    maxCompetitionsPerDay: 1,
    maxUsersPerCompetition: 30,
    referralFeePercentage: 5,
    subscriptionDurationDays: 30,
    canCreateCompetitions: true,
    canEarnFromChallenges: false,
  },
};

const GAMEMASTER_PRO_PACKAGE: Partial<IMarketplaceItem> = {
  name: "Game Master Pro",
  slug: "game-master-pro",
  shortDescription:
    "Level up your Game Master game! 3 daily competitions, 75 participants, and 7.5% referral earnings. The choice of serious community builders.",
  fullDescription: `# The Professional's Choice

The **Pro Package** is designed for Game Masters who are serious about building a thriving trading community. More competitions, bigger events, better earnings.

## What You Get

- **3 Competitions per Day** - Run morning, afternoon, and evening events
- **Up to 75 Participants** - Scale your competitions for bigger prize pools
- **7.5% Referral Earnings** - 50% more earnings than Starter tier
- **30 Days Duration** - Full month of enhanced privileges

## Why Upgrade to Pro?

**More Events = More Engagement**
Keep your community active with multiple daily competitions. Different timeframes attract different traders.

**Bigger Competitions = Bigger Prizes**
With 75 participant capacity, your events can have prize pools that truly excite traders.

**Higher Earnings = Better ROI**
At 7.5% referral rate, just 8,000 credits in entry fees from your referrals pays back your subscription.

## Ideal For

- Growing Discord/Telegram trading communities
- Social media influencers with engaged audiences
- Active traders looking to monetize their network

*"Pro isn't just a tier—it's a statement. You're here to build something real."*`,
  category: "gamemaster",
  price: 599,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: ["gamemaster", "pro", "referral", "popular", "recommended"],
  riskLevel: "low",
  gameMasterConfig: {
    maxCompetitionsPerDay: 3,
    maxUsersPerCompetition: 75,
    referralFeePercentage: 7.5,
    subscriptionDurationDays: 30,
    canCreateCompetitions: true,
    canEarnFromChallenges: true,
    challengeReferralFeePercentage: 5,
  },
};

const GAMEMASTER_ELITE_PACKAGE: Partial<IMarketplaceItem> = {
  name: "Game Master Elite",
  slug: "game-master-elite",
  shortDescription:
    "The ultimate Game Master experience. 10 daily competitions, 150 participants, and maximum 10% referral earnings. For those who dominate.",
  fullDescription: `# Dominate the Arena

The **Elite Package** is for Game Masters who refuse to compromise. Maximum power. Maximum earnings. Maximum respect.

## What You Get

- **10 Competitions per Day** - Run events around the clock
- **Up to 150 Participants** - Host massive tournaments with huge prize pools
- **10% Referral Earnings** - The highest referral rate available
- **30 Days Duration** - Full month of elite privileges

## The Elite Advantage

**Unlimited Potential**
10 competitions per day means you can run specialized events:
- Morning scalp battles
- Lunch break quick trades
- Evening swing competitions
- Weekend tournaments

**Massive Scale**
150 participants per competition enables:
- Prize pools worth thousands of credits
- Tournament-style bracket competitions
- Community-wide events that go viral

**Maximum Earnings**
At 10% referral rate, your passive income potential is unmatched:
- 10,000 credits in referral entry fees = 1,000 credits earned
- Your subscription pays for itself with just one successful referral push

## Built For

- Professional trading community managers
- Large Discord servers (1000+ members)
- Influencers with substantial followings
- Trading educators and course creators

## Elite Perks

👑 Priority support for event issues
👑 Higher visibility in platform promotions
👑 Exclusive Elite badge on your profile

*"At the top, there's only one tier. Welcome to Elite."*`,
  category: "gamemaster",
  price: 999,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  codeTemplate: "{}",
  defaultSettings: {},
  supportedAssets: [],
  tags: [
    "gamemaster",
    "elite",
    "referral",
    "premium",
    "unlimited",
    "best-value",
  ],
  riskLevel: "low",
  gameMasterConfig: {
    maxCompetitionsPerDay: 10,
    maxUsersPerCompetition: 150,
    referralFeePercentage: 10,
    subscriptionDurationDays: 30,
    canCreateCompetitions: true,
    canEarnFromChallenges: true,
    challengeReferralFeePercentage: 7,
  },
};

// ============================================================================
// MARKETPLACE INDICATORS (rebuilt one-by-one)
// ============================================================================

const NEXUS_TREND_MATRIX: Partial<IMarketplaceItem> = {
  name: "Nexus Trend Matrix",
  slug: "nexus-trend-matrix",
  shortDescription:
    "Adaptive trend overlay combining KAMA core, ATR volatility bands, and multi-factor trend scoring with color-coded zones.",
  fullDescription: `# Nexus Trend Matrix

## Overview
The **Nexus Trend Matrix** is a premium all-in-one overlay indicator that combines three powerful analysis techniques into a single, clean visual directly on your price chart. No separate oscillator panel needed — everything you need is right on the candles.

## Three Core Components

### 1. Adaptive Trend Core (Center Line)
The orange center line uses the **Kaufman Adaptive Moving Average (KAMA)** algorithm. Unlike a standard moving average, KAMA automatically adjusts its sensitivity:
- **Trending markets**: The line reacts quickly to follow price
- **Choppy/ranging markets**: The line becomes smooth and filters out noise

This means you get fast signals when it matters and fewer false signals during sideways action.

### 2. Dynamic Volatility Bands (Upper & Lower)
The bands surrounding the core line expand and contract based on **Average True Range (ATR)**, the gold standard for measuring market volatility:
- **Wide bands** = high volatility, expect larger price swings
- **Narrow bands** = low volatility, potential breakout building
- **Price touching upper band** = extended to the upside
- **Price touching lower band** = extended to the downside

### 3. Trend Strength Coloring
The bands change color based on a composite score that combines:
- **KAMA slope** (trend direction and speed)
- **Directional strength** (bullish vs bearish pressure)
- **Price momentum** (position relative to the adaptive line)

**Color Guide:**
- **Green** = Strong uptrend confirmed — look for buy opportunities
- **Red** = Strong downtrend confirmed — look for sell opportunities
- **Gray** = Ranging / uncertain — stay out or reduce position size

## How to Trade With It

### Trend Following
1. Wait for bands to turn **green**
2. Enter long when price pulls back to the **core line** (orange)
3. Set stop-loss below the **lower band**
4. Take profit when bands turn **gray** or **red**

### Mean Reversion
1. When bands are **green**, buy dips to the **lower band**
2. When bands are **red**, sell rallies to the **upper band**
3. Avoid trading when bands are **gray** (no clear trend)

### Breakout Confirmation
1. Watch for bands to narrow (squeeze)
2. Enter on breakout when bands expand AND change color
3. Green expansion = long breakout confirmed
4. Red expansion = short breakout confirmed

## Settings Guide
- **Period** (20): KAMA efficiency ratio lookback — higher = smoother, lower = more responsive
- **Fast Period** (2): KAMA fast constant — lower = faster reaction in trends
- **Slow Period** (30): KAMA slow constant — higher = more filtering in ranges
- **ATR Period** (14): Volatility measurement lookback
- **ATR Multiplier** (2.0): Band width — higher = wider bands, fewer signals
- **Trend Smooth** (10): Trend score smoothing — higher = more stable colors

## Risk Warning
No indicator guarantees profits. The Nexus Trend Matrix is a tool to support your analysis, not replace it. Always use proper risk management and never risk more than you can afford to lose.`,
  category: "indicator",
  price: 89,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "nexus_trend_matrix",
  iconName: "Layers",
  codeTemplate: JSON.stringify({
    type: "nexus_trend_matrix",
    displayType: "overlay",
    description: "Adaptive KAMA core + ATR volatility bands + multi-factor trend scoring",
  }),
  defaultSettings: {
    period: 20,
    fastPeriod: 2,
    slowPeriod: 30,
    atrPeriod: 14,
    atrMultiplier: 2.0,
    trendSmoothPeriod: 10,
    color: "#ffa726",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["trend", "adaptive", "bands", "premium", "overlay", "kama", "volatility", "atr"],
  riskLevel: "medium",
};

const PHANTOM_FLOW_ZONES: Partial<IMarketplaceItem> = {
  name: "Phantom Flow Zones",
  slug: "phantom-flow-zones",
  shortDescription:
    "Institutional supply/demand zone detector using volume absorption analysis, wick rejection scoring, and dynamic zone projection.",
  fullDescription: `# Phantom Flow Zones

## Overview
**Phantom Flow Zones** is a premium overlay indicator that reveals where institutional "smart money" is likely accumulating or distributing. Instead of chasing price, this indicator shows you the invisible levels where large players are placing their orders — giving you a significant edge in identifying high-probability entries and exits.

## How It Works

### 1. Volume Absorption Detection
The indicator identifies candles where unusually high volume occurs with a small body size. This "absorption" pattern means large orders are being filled without significantly moving price — a classic sign of institutional activity:
- **High volume + small body** = Large orders absorbing selling/buying pressure
- The bigger the volume spike with the smaller the body, the stronger the signal

### 2. Wick Rejection Analysis
Long wicks (shadows) relative to the candle body indicate price rejection at key levels. When combined with volume absorption, these wick rejections pinpoint exact price levels where institutional orders are sitting:
- **Long lower wick** = Demand/buying interest (institutions buying the dip)
- **Long upper wick** = Supply/selling interest (institutions selling the rally)

### 3. Dynamic Zone Projection
When both absorption and wick rejection signals align, the indicator projects dynamic **supply and demand zones** directly on your chart:
- **Cyan/Blue zones** = Demand zones (institutional buying detected)
- **Magenta/Pink zones** = Supply zones (institutional selling detected)
- **Zones persist** until price breaks through them with conviction
- **Zones fade** as they age — more recent zones are more relevant

### 4. Institutional Flow Line
The center line (cyan) shows the **net institutional bias** — a volume-weighted smoothed midpoint that reveals the overall direction institutions are pushing price:
- **Flow line rising** = Net institutional buying
- **Flow line falling** = Net institutional selling
- **Flow line flat** = Institutions are neutral / range-bound

## How to Trade With It

### Zone Bounce Strategy
1. Wait for price to approach a **cyan demand zone** from above
2. Look for bullish candle patterns at the zone (hammer, engulfing)
3. Enter long with stop-loss below the zone
4. Target the nearest **magenta supply zone** above

### Zone Break Strategy
1. When price **breaks through** a supply/demand zone with strong volume
2. The broken zone is invalidated (removed from chart)
3. This signals a shift in institutional sentiment
4. Trade in the direction of the breakout

### Flow Line Confluence
1. Use the **flow line** as dynamic support/resistance
2. In uptrends: buy pullbacks to the flow line
3. In downtrends: sell rallies to the flow line
4. When flow line aligns with a zone, the level is extra strong

## Settings Guide
- **Period** (20): Volume SMA lookback — determines what counts as "normal" volume
- **Volume Threshold** (1.5): Minimum volume spike multiplier — lower = more zones, higher = only extreme events
- **Wick Threshold** (0.6): Minimum wick-to-range ratio for rejection signals
- **Zone Lookback** (50): How many bars a zone persists before expiring
- **Smooth Period** (10): Flow line EMA smoothing — higher = smoother line

## What Makes This Unique
Unlike simple support/resistance indicators, Phantom Flow Zones uses **real volume data** combined with **candle structure analysis** to identify levels that matter to institutional traders. This is the type of analysis that professional traders pay thousands for — now available as an overlay on your chart.

## Risk Warning
No indicator guarantees profits. Phantom Flow Zones is a tool to support your analysis, not replace it. Always use proper risk management and never risk more than you can afford to lose.`,
  category: "indicator",
  price: 119,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "phantom_flow_zones",
  iconName: "Layers",
  codeTemplate: JSON.stringify({
    type: "phantom_flow_zones",
    displayType: "overlay",
    description: "Institutional supply/demand zone detector with volume absorption and wick rejection analysis",
  }),
  defaultSettings: {
    period: 20,
    volumeThreshold: 1.5,
    wickThreshold: 0.6,
    zoneLookback: 50,
    smoothPeriod: 10,
    color: "#00bcd4",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["smart-money", "institutional", "supply-demand", "zones", "volume", "premium", "overlay"],
  riskLevel: "medium",
};

const FRACTAL_PULSE_GRID: Partial<IMarketplaceItem> = {
  name: "Fractal Pulse Grid",
  slug: "fractal-pulse-grid",
  shortDescription:
    "Adaptive market structure overlay using volatility-adaptive fractal swing detection, structural level tracking, and a pulse line revealing structural bias.",
  fullDescription: `# Fractal Pulse Grid

## Overview
**Fractal Pulse Grid** is a premium overlay indicator that automatically maps the most important structural levels on your chart. Instead of manually drawing support and resistance lines, this indicator uses a volatility-adaptive fractal algorithm to detect true swing highs and swing lows, then tracks which levels are still "alive" (holding) versus broken — giving you a real-time structural map of the market.

## How It Works

### 1. Adaptive Fractal Detection
Unlike basic Williams Fractals that use a fixed lookback, Fractal Pulse Grid adapts to current market conditions:
- In **high volatility**: requires more confirmation bars before confirming a swing point (reduces false signals)
- In **low volatility**: uses fewer confirmation bars (catches smaller but meaningful swings)
- The adaptation is driven by the ATR ratio (current ATR vs. average ATR)

### 2. Structural Level Tracking
Every confirmed swing high becomes a **resistance level** and every swing low becomes a **support level**. The indicator then tracks each level's lifecycle:
- **Active levels** are displayed on the chart as horizontal lines
- **Tested levels** (price approached but bounced) become stronger — they've proven themselves
- **Broken levels** (price closed beyond with conviction) are automatically removed
- **Aged levels** expire after a configurable number of bars

### 3. Best Level Selection
At each bar, the indicator selects the most relevant resistance and support based on:
- **Proximity**: Closer levels to current price are prioritized
- **Recency**: More recent levels are weighted higher
- **Test count**: Levels that have been tested multiple times are considered stronger

### 4. Pulse Line
The golden center line shows the **structural bias** — a smoothed midpoint between the active resistance and support that reveals:
- **Rising pulse** = Bullish market structure (higher highs, higher lows)
- **Falling pulse** = Bearish market structure (lower highs, lower lows)
- **Flat pulse** = Consolidating / range-bound structure

## How to Trade With It

### Structure-Based Entries
1. **Buy at support**: When price approaches the green support line, look for bullish confirmation (hammer, bullish engulfing)
2. **Sell at resistance**: When price approaches the red resistance line, look for bearish confirmation
3. **Use the pulse line** as a trend filter — only take longs when pulse is rising, shorts when falling

### Break of Structure (BOS) Strategy
1. When the **resistance line shifts higher** (old resistance broken, new one established above) = bullish BOS
2. When the **support line shifts lower** = bearish BOS
3. Trade in the direction of the structural break with the pulse line as confirmation

### Pulse Line Trend Following
1. Enter long when price pulls back to the **pulse line** in a rising structure
2. Enter short when price rallies to the **pulse line** in a falling structure
3. The pulse line acts as a dynamic equilibrium — price tends to revert to it

### Grid Width Analysis
1. When resistance and support are **far apart** = trending market with room to move
2. When they **converge** = market compression, expect a breakout
3. The direction of the breakout often aligns with the pulse line direction

## Settings Guide
- **Period** (20): Volatility normalization window for adaptive fractal detection
- **ATR Period** (14): ATR calculation period for volatility measurement
- **Base Lookback** (3): Minimum fractal confirmation bars per side — lower = more signals, higher = fewer but stronger
- **Max Age** (100): Maximum bars a level persists before expiring — increase for higher timeframes
- **Smooth Period** (8): Pulse line EMA smoothing — higher = smoother line, lower = more responsive
- **Break Tolerance** (0.25): ATR fraction needed to confirm a level break — lower = more sensitive to breaks

## What Makes This Unique
Fractal Pulse Grid combines **three disciplines** that traders usually do manually:
1. **Swing point identification** (usually done by eye)
2. **Support/resistance level management** (usually drawn manually)
3. **Market structure bias** (usually judged subjectively)

All three are automated, adaptive, and updated in real-time. The adaptive fractal detection ensures the indicator works across all timeframes and volatility regimes without parameter changes.

## Risk Warning
No indicator guarantees profits. Fractal Pulse Grid is a tool to support your analysis, not replace it. Always use proper risk management and never risk more than you can afford to lose.`,
  category: "indicator",
  price: 139,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "fractal_pulse_grid",
  iconName: "Grid3X3",
  codeTemplate: JSON.stringify({
    type: "fractal_pulse_grid",
    displayType: "overlay",
    description: "Adaptive market structure overlay with fractal swing detection and structural level tracking",
  }),
  defaultSettings: {
    period: 20,
    atrPeriod: 14,
    baseLookback: 3,
    maxAge: 100,
    smoothPeriod: 8,
    breakTolerance: 0.25,
    color: "#ffc107",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["structure", "fractals", "support-resistance", "swing", "adaptive", "premium", "overlay", "smart-money"],
  riskLevel: "medium",
};

const VORTEX_DRIFT_CLOUD: Partial<IMarketplaceItem> = {
  name: "Vortex Drift Cloud",
  slug: "vortex-drift-cloud",
  shortDescription:
    "Adaptive trend-following channel with zero-lag Super Smoother midline, ADX-weighted volatility bands, and per-bar momentum coloring.",
  fullDescription: `# Vortex Drift Cloud

## Overview
The **Vortex Drift Cloud** is a premium on-chart indicator that wraps price in an intelligent, adaptive channel. It combines a near-zero-lag midline with volatility bands that respond to trend strength — giving you a complete visual picture of trend direction, momentum, and volatility regime in one overlay.

Unlike traditional channels (Bollinger Bands, Keltner), the Vortex Drift Cloud uses an **Ehlers Super Smoother** filter for the midline — a digital signal processing technique that removes market noise with virtually no lag. The bands then adapt their width based on both volatility (ATR) and trend strength (ADX), so they widen during strong directional moves and compress during consolidation.

## Three Core Components

### 1. Super Smoother Midline (Center Line)
The midline uses the **Ehlers 2-pole Super Smoother** filter, a digital signal processing technique from aerospace engineering applied to trading:
- **Near-zero lag** — reacts to price changes almost instantly compared to traditional moving averages
- **Exceptional noise filtering** — removes random price fluctuations while preserving the true trend signal
- Acts as **dynamic support** in uptrends and **dynamic resistance** in downtrends

### 2. ADX-Weighted Adaptive Bands
The upper and lower bands are not fixed-width like Bollinger Bands. Instead, they adapt to both volatility AND trend strength:
- **Band width** = ATR × Multiplier × ADX Weight Factor
- In **strong trends** (high ADX): bands widen to accommodate momentum
- In **ranging markets** (low ADX): bands compress, signaling consolidation
- **Compression → Expansion** patterns signal potential breakouts

### 3. Per-Bar Momentum Coloring
Every bar's channel color shifts based on real-time trend classification:
- **Cyan/Teal** = Bullish momentum — midline rising AND price above midline
- **Orange** = Bearish pressure — midline falling AND price below midline
- **Gray** = Indecision/Neutral — mixed signals, no clear direction

The color changes happen bar-by-bar, giving you instant visual feedback on trend transitions.

## How to Trade With It

### Trend Following (Primary Strategy)
1. Wait for the cloud to turn **cyan** (bullish)
2. Enter long when price pulls back to the **midline** or **lower band**
3. Set stop-loss below the **lower band** (adaptive to volatility)
4. Hold as long as the cloud stays **cyan**
5. Exit when the cloud turns **gray** or **orange**

### Band Bounce Trading
1. In a **cyan cloud**: buy when price touches the **lower band** (support bounce)
2. In an **orange cloud**: sell when price touches the **upper band** (resistance rejection)
3. **Avoid trading bounces** in a gray cloud (no directional conviction)

### Breakout Anticipation
1. Watch for **band compression** (narrow channel + gray color)
2. This signals the market is coiling for a move
3. Enter in the direction of the **first colored band expansion**:
   - Cyan expansion = Long breakout
   - Orange expansion = Short breakout
4. The wider the preceding compression, the stronger the potential breakout

### Trend Reversal Detection
1. Watch for color transitions: **cyan → gray → orange** (bearish reversal)
2. Or: **orange → gray → cyan** (bullish reversal)
3. The **gray transition zone** acts as an early warning
4. Confirm reversal when price closes beyond the midline in the new direction

## Settings Guide
- **Smoother Period** (21): Super Smoother filter length — higher = smoother but slower, lower = more responsive
- **ATR Period** (14): Volatility lookback for band width calculation
- **Band Width** (2.0): Multiplier for band distance from midline — higher = wider bands
- **ADX Period** (14): Trend strength measurement lookback
- **Trend Threshold** (25): ADX level that distinguishes trending from ranging
- **Momentum Lookback** (10): Bars to compare for trend direction coloring

## Tips for Best Results
- Works on **all timeframes** — from 1-minute scalping to daily swing trading
- Best performance on **trending assets** (Forex majors, indices, trending crypto)
- Combine with **volume** for confirmation: high volume + color change = strong signal
- Use band width as a **position sizing guide**: wider bands = more volatile = smaller position

## Risk Warning
No indicator guarantees profits. The Vortex Drift Cloud is a decision-support tool, not a signal service. Always use proper risk management, set stop-losses, and never risk more than you can afford to lose.`,
  category: "indicator",
  price: 15,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "vortex_drift_cloud",
  iconName: "Waves",
  codeTemplate: JSON.stringify({
    type: "vortex_drift_cloud",
    displayType: "overlay",
    description: "Adaptive trend channel with Super Smoother midline and ADX-weighted volatility bands",
  }),
  defaultSettings: {
    smoothPeriod: 21,
    atrPeriod: 14,
    bandMultiplier: 2.0,
    adxPeriod: 14,
    adxThreshold: 25,
    momentumLookback: 10,
    color: "#22d3ee",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["trend", "channel", "volatility", "adaptive", "premium", "overlay", "momentum", "adx", "super-smoother"],
  riskLevel: "medium",
};

const ORION_MOMENTUM_SHIELD: Partial<IMarketplaceItem> = {
  name: "Orion Momentum Shield",
  slug: "orion-momentum-shield",
  shortDescription:
    "Momentum-reactive overlay with ultra-fast EHMA midline, volatility-normalized momentum coloring, and bands that expand on surges and compress on fades.",
  fullDescription: `# Orion Momentum Shield

## Overview
The **Orion Momentum Shield** is a premium on-chart overlay that makes momentum visible directly on price. Traditional momentum indicators (RSI, MACD) sit in a separate panel, forcing you to look away from the chart. Orion puts that information right where it matters — wrapping price in an adaptive shield that physically reacts to momentum changes.

The core innovation is **Volatility-Normalized Momentum (VNM)** — raw price momentum divided by current volatility. This means a 50-pip move in a volatile market registers differently than a 50-pip move in a quiet market, giving you a true picture of momentum strength relative to conditions.

## Three Core Components

### 1. Exponential Hull Moving Average (EHMA)
The midline uses a hybrid of Hull Moving Average speed with EMA smoothness:
- **Formula**: WMA(2×EMA(N/2) - EMA(N), √N)
- **Result**: Ultra-responsive to trend changes with minimal noise
- Reacts to reversals 2-3 bars faster than a standard EMA of the same period
- Acts as dynamic support in uptrends and resistance in downtrends

### 2. Momentum-Expanding Bands
Unlike fixed-width bands, Orion's bands physically react to momentum:
- **Surge phase** (strong momentum): Bands expand outward, showing the market has fuel
- **Drift phase** (moderate momentum): Normal band width, steady trend
- **Fade phase** (dying momentum): Bands compress inward, warning that the move is exhausting
- **Band width** = ATR × Multiplier × (1 + |VNM|/100 × 0.8)

This means you can literally see momentum building and fading by watching how wide the bands are.

### 3. Three-Phase Color System
Each bar is colored by its momentum phase:
- **Green (Surge+)** = Strong bullish momentum — price is surging upward
- **Red (Surge-)** = Strong bearish momentum — price is plunging
- **Teal (Drift+)** = Moderate bullish drift — steady upward movement
- **Orange (Drift-)** = Moderate bearish drift — steady downward movement
- **Gray (Fade)** = Momentum exhaustion — potential reversal zone

## How to Trade With It

### Momentum Trading (Primary Strategy)
1. Enter long when bands turn **green** (bullish surge) after a gray fade
2. Enter short when bands turn **red** (bearish surge) after a gray fade
3. **Wider bands = stronger conviction** — size up on expansion
4. Set stop-loss beyond the opposite band

### Exhaustion Reversal Trading
1. Watch for bands to be in **surge** (green/red) with wide expansion
2. When bands start **compressing** and color shifts to **gray fade**, the move is dying
3. Enter counter-trend at the fade signal, targeting the midline
4. This catches the transition from momentum to mean reversion

### Trend Riding
1. In a **green/teal drift**: stay long as long as price stays above the EHMA midline
2. In a **red/orange drift**: stay short as long as price stays below midline
3. Trail your stop-loss to the lower band (for longs) or upper band (for shorts)
4. Exit when color shifts to **gray** (momentum dying)

### Breakout Confirmation
1. Spot a chart pattern or consolidation
2. Wait for the bands to compress (gray fade phase)
3. Enter when bands suddenly expand AND change to surge color
4. Green surge expansion = confirmed bullish breakout
5. Red surge expansion = confirmed bearish breakout

## Settings Guide
- **EHMA Period** (16): Hull-EMA hybrid period — lower = faster response, higher = smoother
- **ATR Period** (14): Volatility lookback for band width calculation
- **Band Width** (1.8): Base multiplier for band distance from midline
- **Momentum Period** (12): Rate-of-change lookback for VNM calculation
- **Surge Threshold** (40): VNM level that triggers surge phase (lower = more sensitive)
- **Fade Smoothing** (5): Smoothing applied to VNM — higher = fewer phase flips

## What Makes It Different
| Feature | Traditional Indicators | Orion Momentum Shield |
|---------|----------------------|----------------------|
| Momentum display | Separate panel (RSI/MACD) | Directly on chart |
| Normalization | Raw values | Volatility-adjusted |
| Band behavior | Static width | Momentum-reactive expansion |
| Phase detection | Manual interpretation | Automatic 3-phase coloring |
| Lag | 3-5 bars typical | 1-2 bars (EHMA) |

## Tips for Best Results
- Combine with **volume** — surge phases with high volume are stronger
- Use on **5m-4H timeframes** for best balance of signals vs noise
- The **fade phase** is your early warning — prepare for a potential reversal
- When in doubt about direction, wait for a **surge after fade** (momentum restart)

## Risk Warning
No indicator guarantees profits. The Orion Momentum Shield helps visualize momentum, but markets can remain irrational longer than you can remain solvent. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 19,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "orion_momentum_shield",
  iconName: "Shield",
  codeTemplate: JSON.stringify({
    type: "orion_momentum_shield",
    displayType: "overlay",
    description: "Momentum-reactive overlay with EHMA midline and volatility-normalized momentum bands",
  }),
  defaultSettings: {
    hmaPeriod: 16,
    atrPeriod: 14,
    bandMultiplier: 1.8,
    momentumPeriod: 12,
    surgeThreshold: 40,
    fadeSmooth: 5,
    color: "#a78bfa",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["momentum", "volatility", "adaptive", "premium", "overlay", "hull", "bands", "reversal", "exhaustion"],
  riskLevel: "medium",
};

const NEBULA_PHASE_BANDS: Partial<IMarketplaceItem> = {
  name: "Nebula Phase Bands",
  slug: "nebula-phase-bands",
  shortDescription:
    "Kalman-filtered overlay with Shannon entropy phase detection — adaptive bands that morph through four market states: Plasma, Liquid, Gaseous, and Crystalline.",
  fullDescription: `# Nebula Phase Bands

## Overview
The **Nebula Phase Bands** is a premium on-chart overlay that brings aerospace-grade **Kalman Filtering** and information-theoretic **Shannon Entropy** to trading. While every other indicator uses some form of moving average for its core line, Nebula uses an optimal state estimator — the same mathematics used in missile guidance and spacecraft navigation — to track the "true" underlying price.

The second innovation is **Shannon Entropy** applied to price returns. This measures the actual information content (randomness vs order) in market movements, letting the indicator classify the market into four distinct phases with scientifically grounded precision.

## Four Core Components

### 1. Kalman Filter Midline
The midline uses a recursive Kalman filter instead of any moving average:
- **Process**: Predicts the next price state, then corrects based on actual observation
- **Adaptive noise model**: Automatically estimates measurement noise from local price variance
- **Result**: A line that is smooth in ranging markets but tracks aggressively during trends
- **Advantage**: Responds to true price changes without the lag penalty of traditional smoothing

Unlike an EMA that applies the same weight regardless of conditions, the Kalman filter dynamically balances between trusting its prediction and trusting the new price observation.

### 2. Shannon Entropy Measurement
Returns are binned into a probability distribution over a rolling window:
- **Formula**: H = -Σ p(x) × log₂(p(x)), normalized to 0–1
- **Entropy = 0**: All returns fall in one bin (perfectly ordered/trending)
- **Entropy = 1**: Returns equally distributed across all bins (maximum randomness)
- **Smoothed via EMA** to prevent noisy phase flips

This gives you a scientifically rigorous answer to "how random is this market right now?"

### 3. Four-Phase Detection System
Based on entropy, displacement from midline, and momentum:
- **🟣 Plasma** (Aggressive Trend): Low entropy + high displacement + fast momentum — the market has locked into a powerful directional move
- **🔵 Liquid** (Smooth Trending): Moderate conditions — price is flowing in a direction with normal volatility
- **🟠 Gaseous** (Chaotic): High entropy + volatile — the market is disordered, moves are unpredictable
- **⚪ Crystalline** (Consolidation): Low entropy + tight range + slow — the market has frozen, building energy for the next move

### 4. Phase-Adaptive Bands
Unlike fixed-multiplier bands, width changes per phase:
- **Plasma**: Bands tighten (1.3× multiplier) — trailing closely to the strong trend
- **Liquid**: Normal width (1.0×) — standard band behavior
- **Gaseous**: Bands expand (1.8×) — accommodating chaotic price swings
- **Crystalline**: Bands compress (0.6×) — reflecting the tight consolidation

This means band width directly reflects market behavior, not just volatility.

## How to Trade With It

### Phase Transition Trading (Primary Strategy)
1. Watch for **Crystalline → Plasma** transition (consolidation → aggressive trend)
2. Enter in the direction of the Plasma breakout (price above/below midline)
3. This is the highest-probability setup — stored energy releasing into a trend
4. Set stop-loss at the opposite band

### Entropy Divergence
1. Price making new highs but entropy is rising (phase shifting to Gaseous)
2. This means the move is becoming chaotic — divergence signals potential reversal
3. Tighten stops or take partial profits when Plasma degrades to Gaseous

### Gaseous Phase Avoidance
1. When phase is **Gaseous** (orange), reduce position sizes
2. The market is disordered — random moves dominate
3. Wait for entropy to drop (transition to Liquid or Crystalline) before re-engaging

### Crystalline Breakout Preparation
1. Crystalline phase = compressed bands = the market is coiling
2. Place bracket orders above and below the compressed bands
3. When phase shifts, the direction of breakout tells you which side to take
4. Crystalline phases that last longer produce larger subsequent moves

### Midline Mean Reversion
1. During **Liquid** phase, price tends to orbit the Kalman midline
2. Enter long when price touches the lower band in Liquid phase
3. Enter short when price touches the upper band in Liquid phase
4. Target the midline, stop beyond the touched band

## Settings Guide
- **Kalman Gain** (0.05): Process noise — lower = smoother midline, higher = more responsive
- **Entropy Period** (20): Window for Shannon entropy calculation — lower = faster phase detection
- **ATR Period** (14): Volatility lookback for base band width
- **Band Width** (2.0): Base multiplier before phase adjustment
- **Phase Smooth** (5): Entropy smoothing — higher = fewer phase transitions

## What Makes It Different
| Feature | Traditional Indicators | Nebula Phase Bands |
|---------|----------------------|-------------------|
| Core filter | Moving averages | Kalman filter (optimal state estimation) |
| Randomness measure | None | Shannon entropy |
| Market classification | Manual | Automatic 4-phase detection |
| Band adaptation | Volatility only | Phase + volatility |
| Theoretical basis | Statistical | Information theory + control theory |
| Consolidation detection | Poor | Crystalline phase with compressed bands |

## Tips for Best Results
- The **Crystalline → Plasma** transition is the highest-value signal
- Use on **15m–Daily** timeframes for best entropy calculation stability
- Combine with **volume** — Plasma phases with high volume have stronger follow-through
- When entropy rises rapidly, the market is becoming unpredictable — reduce exposure
- The Kalman midline acts as dynamic support/resistance across all phases

## Risk Warning
No indicator guarantees profits. The Nebula Phase Bands uses advanced mathematics to classify market states, but all models have limitations. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 25,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "nebula_phase_bands",
  iconName: "Sparkles",
  codeTemplate: JSON.stringify({
    type: "nebula_phase_bands",
    displayType: "overlay",
    description: "Kalman-filtered overlay with Shannon entropy phase detection and adaptive bands",
  }),
  defaultSettings: {
    kalmanGain: 0.05,
    entropyPeriod: 20,
    atrPeriod: 14,
    bandMultiplier: 2.0,
    phaseSmooth: 5,
    color: "#c084fc",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["kalman", "entropy", "adaptive", "premium", "overlay", "bands", "phase", "consolidation", "breakout", "information-theory"],
  riskLevel: "medium",
};

// ============================================================================
// ALL ITEMS - Indicators, Cosmetics, and Game Master Packages
// ============================================================================

const CIPHER_HARMONIC_VEIL: Partial<IMarketplaceItem> = {
  name: "Cipher Harmonic Veil",
  slug: "cipher-harmonic-veil",
  shortDescription:
    "Self-tuning overlay using autocorrelation cycle detection and Hurst exponent fractal analysis to adapt bands to the market's natural rhythm and regime.",
  fullDescription: `# Cipher Harmonic Veil

## Overview
The **Cipher Harmonic Veil** is a premium on-chart overlay that listens to the market's hidden rhythm. Every market has a dominant cycle — a natural period at which price patterns tend to repeat. Most traders use fixed-period moving averages that ignore this rhythm entirely. Cipher Harmonic Veil detects the dominant cycle automatically and tunes itself to it in real-time.

The second innovation is the **Hurst Exponent** — a fractal analysis technique from quantitative finance that determines whether the market is trending, mean-reverting, or in a random walk. This gives you a statistically grounded answer to the most important question in trading: **"Should I follow the trend or fade it?"**

## Three Core Components

### 1. Autocorrelation Cycle Detection
The indicator scans price returns for repeating patterns using autocorrelation analysis:
- **How it works**: Computes the correlation between returns and their lagged copies across multiple lag periods
- **Peak detection**: The lag with the strongest positive correlation reveals the dominant cycle
- **Auto-tuning**: The midline period automatically adjusts to half the dominant cycle (Nyquist-optimal filtering)
- **Result**: A midline that is always in sync with the market's natural rhythm — never too fast, never too slow

### 2. Hurst Exponent (Rescaled Range Analysis)
A mathematical measure of long-term memory in time series:
- **H > 0.55 (Persistent)**: Past trends tend to continue — momentum trading works
- **H < 0.45 (Antipersistent)**: Past moves tend to reverse — mean-reversion trading works
- **H ≈ 0.50 (Random)**: No statistical edge — market is efficient at this moment
- **Calculation**: Uses R/S (Rescaled Range) analysis over a rolling window

### 3. Regime-Adaptive Bands
Band width and behavior change based on the detected Hurst regime:
- **Persistent regime**: Tight bands (0.8× multiplier) — price is trending, bands trail closely
- **Antipersistent regime**: Wide bands (1.5× multiplier) — price is bouncing, bands mark reversal zones
- **Random regime**: Standard bands (1.0× multiplier) — no statistical edge, neutral positioning

## How to Trade With It

### Trend Following (Persistent Regime — Blue)
1. When the Veil turns **blue**, the Hurst exponent confirms trending conditions
2. Enter long when price is above the midline and bands are blue
3. Enter short when price is below the midline and bands are blue
4. **Tight bands = high conviction** — the market has strong serial correlation
5. Trail stop-loss to the opposite band

### Mean Reversion (Antipersistent Regime — Amber/Gold)
1. When the Veil turns **amber/gold**, the market is mean-reverting
2. Buy when price touches the lower band (expect snap-back to midline)
3. Sell when price touches the upper band (expect pullback to midline)
4. **Wide bands = reversal zones** — price is statistically likely to reverse
5. Set take-profit at the midline

### Regime Change Trading
1. Watch for the Veil to transition from **gray (random)** to **blue (persistent)**
2. This signals a new trending regime is forming — enter in the direction of the breakout
3. Watch for **blue → amber** transitions — the trend is dying, prepare for reversals
4. **Gray periods** = stay flat or reduce size — no statistical edge

### Cycle-Aware Entries
1. The detected cycle period appears in the indicator data
2. After a pullback in a persistent regime, expect continuation near the half-cycle mark
3. In antipersistent regime, expect reversal near the full cycle mark
4. Use the cycle length to time your entries and set time-based stops

## Settings Guide
- **Max Cycle Period** (50): Upper bound for cycle detection scan — higher catches longer cycles
- **Hurst Window** (100): Rolling window for R/S analysis — higher = more stable regime detection, lower = faster adaptation
- **ATR Period** (14): Volatility lookback for base band width
- **Band Width** (2.0): Base multiplier before regime adjustment
- **Smoothing** (5): Smoothing applied to cycle and Hurst estimates — higher = fewer regime flips

## What Makes It Different
| Feature | Traditional Indicators | Cipher Harmonic Veil |
|---------|----------------------|---------------------|
| Period selection | Fixed (user-chosen) | Auto-tuned to dominant cycle |
| Regime awareness | None | Hurst exponent classification |
| Band behavior | Static multiplier | Regime-adaptive (0.8× to 1.5×) |
| Theoretical basis | Simple math | Fractal analysis + signal processing |
| Adaptation | Manual parameter tuning | Self-adjusting every bar |

## Tips for Best Results
- Works best on **15m–Daily** timeframes where cycles are most stable
- Combine with **volume** — persistent regimes with rising volume are strongest
- The **amber/gold phase** is your mean-reversion signal — don't chase trends when bands are gold
- When Hurst hovers near **0.50** (gray), reduce position size — the market has no memory
- Use on **major forex pairs and indices** for the most reliable cycle detection

## Risk Warning
No indicator guarantees profits. The Cipher Harmonic Veil provides statistically grounded regime analysis, but past persistence does not guarantee future persistence. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 29,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "cipher_harmonic_veil",
  iconName: "AudioWaveform",
  codeTemplate: JSON.stringify({
    type: "cipher_harmonic_veil",
    displayType: "overlay",
    description: "Self-tuning overlay with autocorrelation cycle detection and Hurst exponent regime analysis",
  }),
  defaultSettings: {
    maxCyclePeriod: 50,
    hurstPeriod: 100,
    atrPeriod: 14,
    bandMultiplier: 2.0,
    smooth: 5,
    color: "#3b82f6",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["fractal", "hurst", "cycle", "adaptive", "premium", "overlay", "regime", "autocorrelation", "mean-reversion", "trend"],
  riskLevel: "medium",
};

const TITAN_PULSE_SIGNAL: Partial<IMarketplaceItem> = {
  name: "Titan Pulse Signal",
  slug: "titan-pulse-signal",
  shortDescription:
    "Adaptive single-line trend indicator with built-in buy/sell signal markers. Combines Kaufman adaptive filter, ATR-offset flip logic, and confluence-based signal detection.",
  fullDescription: `# Titan Pulse Signal

## Overview
**Titan Pulse Signal** is a premium on-chart overlay that breaks away from traditional band indicators. Instead of wrapping price in upper/lower bands, it plots a **single intelligent trend line** that flips between support and resistance — like a next-generation Supertrend powered by adaptive mathematics and a built-in signal engine.

The line turns **green when bullish** (acting as dynamic support below price) and **red when bearish** (acting as dynamic resistance above price). At key inflection points, **buy and sell signal markers** appear directly on the chart, removing guesswork entirely.

## Three Core Components

### 1. Kaufman Adaptive Moving Average (KAMA) Engine
The core uses KAMA — an efficiency-ratio adaptive filter:
- **In strong trends**: KAMA speeds up, keeping the line close to price
- **In choppy markets**: KAMA slows down, preventing false signals
- **Efficiency Ratio** = |Direction| / Volatility over N bars
- This means the indicator literally measures how efficient the market's movement is and adapts in real-time

### 2. ATR-Offset Flip Logic
Like Supertrend but adaptive:
- **Bullish mode**: Line = KAMA - (ATR × Multiplier) → acts as trailing support
- **Bearish mode**: Line = KAMA + (ATR × Multiplier) → acts as trailing resistance
- **Flip trigger**: When price crosses the line, direction reverses
- The line ratchets (only moves in the trend direction, never against), creating clean entries

### 3. Signal Confluence Engine
Three independent signal generators scored 0-100:
- **Trend Flip** (45 pts): When the line changes direction — the primary signal
- **Momentum Surge** (30 pts): Price accelerates away from line by >1.5× ATR in the first few bars
- **Squeeze Breakout** (25 pts): ATR was in the bottom 30th percentile, then suddenly expands
- Signals fire when combined score exceeds the threshold
- **Strong signals** (≥70): Triangle markers — high-conviction entries
- **Regular signals** (≥40): Circle markers — moderate-conviction entries

## How to Trade With It

### Trend Following (Primary Strategy)
1. Go **LONG** when the line turns green (flips to support)
2. Go **SHORT** when the line turns red (flips to resistance)
3. Use the line itself as your **trailing stop-loss**
4. Strong signal markers = size up, regular signals = standard size

### Signal Confirmation Trading
1. Wait for a **strong signal marker** (triangle) to appear
2. Enter in the signal direction
3. Place stop-loss just beyond the trend line
4. Target: Next major support/resistance or 2:1 risk-reward

### Squeeze Breakout Trading
1. Notice when the line stays flat and tight (low ATR period)
2. A signal marker during a squeeze breakout = explosive move incoming
3. Enter immediately on the marker, trail stop on the line
4. These are often the highest-probability signals

### Re-Entry Trading
1. In an established trend (line green/red for 20+ bars)
2. Price pulls back toward the line but doesn't cross
3. A regular signal appears as price bounces off the line
4. Enter as a continuation trade — ride the existing trend

## Settings Guide
- **KAMA Period** (10): Efficiency ratio lookback — higher = smoother, slower adaptation
- **KAMA Fast** (2): Fast smoothing constant — lower = more responsive to trend starts
- **KAMA Slow** (30): Slow smoothing constant — higher = more filtering in chop
- **ATR Period** (14): Volatility lookback for line offset
- **ATR Multiplier** (1.5): How far the line sits from KAMA — higher = fewer flips, wider stops
- **Squeeze Lookback** (20): Window for detecting volatility contraction
- **Signal Threshold** (40): Minimum confluence score to generate a signal — higher = fewer but stronger signals

## What Makes It Different
| Feature | Band Indicators | Supertrend | Titan Pulse Signal |
|---------|----------------|------------|-------------------|
| Lines | 3 (upper/mid/lower) | 1 (fixed speed) | 1 (adaptive speed) |
| Adaptation | Static or ATR-only | ATR-only | Efficiency-ratio + ATR |
| Signals | None (manual reading) | Direction only | Auto buy/sell markers |
| Confluence | N/A | N/A | 3-factor scoring engine |
| False signals in chop | Many | Moderate | Few (KAMA slows down) |

## Tips for Best Results
- Works on **all timeframes** — 1m scalping to weekly swing trading
- In **ranging markets**, raise the ATR Multiplier to 2.0+ to reduce whipsaws
- **Strong signals after a squeeze** are the highest-probability setups
- Combine with **volume** — signals with rising volume are more reliable
- The **line itself is your stop-loss** — no need to calculate separately

## Risk Warning
No indicator guarantees profits. Titan Pulse Signal helps identify trend direction and high-probability entries, but all trading involves risk. Always use proper position sizing and risk management.`,
  category: "indicator",
  price: 32,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "titan_pulse_signal",
  iconName: "Crosshair",
  codeTemplate: JSON.stringify({
    type: "titan_pulse_signal",
    displayType: "overlay",
    description: "Adaptive single-line trend with buy/sell signal markers and confluence scoring",
  }),
  defaultSettings: {
    kamaPeriod: 10,
    kamaFast: 2,
    kamaSlow: 30,
    atrPeriod: 14,
    atrMultiplier: 1.5,
    squeezeLookback: 20,
    signalThreshold: 40,
    color: "#3b82f6",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["trend", "signal", "adaptive", "premium", "overlay", "kama", "supertrend", "buy-sell", "confluence", "momentum"],
  riskLevel: "medium",
};

const AURORA_CASCADE_FLOW: Partial<IMarketplaceItem> = {
  name: "Aurora Cascade Flow",
  slug: "aurora-cascade-flow",
  shortDescription:
    "5-layer adaptive ribbon overlay using cascaded Kaufman filters. Layers fan out in trends and compress in chop, with alignment scoring for trend conviction.",
  fullDescription: `# Aurora Cascade Flow

## Overview
**Aurora Cascade Flow** is a premium on-chart ribbon overlay that renders **5 adaptive moving average layers** cascading from fast to slow. Unlike static ribbon indicators that use fixed-period EMAs, each layer is powered by a **Kaufman Adaptive Moving Average (KAMA)** with a different slow-smoothing constant, creating a living, breathing ribbon that expands during trends and contracts during consolidation.

## How It Works

### 5-Layer KAMA Cascade
Each layer shares the same efficiency ratio but adapts at a different speed:
- **Layer 1** (fastest): Reacts first to trend changes — the leading edge
- **Layer 2**: Slightly slower confirmation
- **Layer 3** (core): The central reference — acts like an intelligent midline
- **Layer 4**: Momentum confirmation layer
- **Layer 5** (slowest): The anchor — only turns when the trend is firmly established

### Alignment Scoring (0–5)
The indicator counts how many of the 5 layers agree on direction:
- **5/5 alignment**: All layers moving same direction — maximum trend conviction
- **4/5 alignment**: Strong trend, one layer lagging
- **3/5 alignment**: Transitional — trend weakening or starting
- **2/5 or less**: Choppy market — layers diverging, no clear direction

### Visual States
- **Fanned out + same direction**: Strong trend — green layers rising = bullish, red layers falling = bearish
- **Compressed/interleaved**: Consolidation or reversal zone
- **Layers crossing each other**: Transition — potential trend change forming

## How to Trade With It

### Trend Entry
1. Wait for all 5 layers to align in one direction (alignment 5/5)
2. Enter in the trend direction when price is above (bull) or below (bear) all layers
3. The space between Layer 1 and Layer 5 shows trend strength

### Compression Breakout
1. Watch for layers to compress tightly together (all nearly overlapping)
2. This signals a volatility squeeze — breakout imminent
3. Enter when layers start to fan out in one direction
4. Strong moves often follow maximum compression

### Layer Bounce (Pullback Trading)
1. In an established trend (4-5 layers aligned)
2. Price pulls back to Layer 2 or Layer 3
3. If price bounces off the layer, it's a continuation signal
4. Stop-loss: below Layer 5 (for longs) or above Layer 5 (for shorts)

### Reversal Detection
1. Fastest layer (L1) crosses through L3 in the opposite direction
2. If L2 follows shortly after, reversal is gaining momentum
3. Full reversal confirmed when all 5 layers flip — but by then you're late
4. Early traders watch L1–L3 crossovers for reversal entries

## Settings Guide
- **ER Period** (10): Efficiency ratio lookback — measures trend quality
- **Fast SC** (2): Fast smoothing constant — lower = more reactive leading edge
- **Slow Min** (10): Minimum slow period for fastest layer
- **Slow Max** (40): Maximum slow period for slowest layer (anchor)
- **Smooth Factor** (3): Extra smoothing on faster layers to reduce noise

## What Makes It Different
| Feature | Standard Ribbon | Aurora Cascade Flow |
|---------|----------------|-------------------|
| Layer type | Fixed-period EMAs | Adaptive KAMAs |
| In trends | Same spacing always | Fans out dynamically |
| In chop | Still spaced apart | Compresses automatically |
| Speed adaptation | None | Efficiency-ratio driven |
| Alignment score | Not available | Built-in 0–5 scoring |

## Risk Warning
No indicator guarantees profits. Aurora Cascade Flow visualizes trend structure and alignment, but all trading involves risk. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 27,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "aurora_cascade_flow",
  iconName: "Waves",
  codeTemplate: JSON.stringify({
    type: "aurora_cascade_flow",
    displayType: "overlay",
    description: "5-layer adaptive KAMA cascade ribbon with directional alignment scoring",
  }),
  defaultSettings: {
    erPeriod: 10,
    fastSC: 2,
    slowMin: 10,
    slowMax: 40,
    smoothFactor: 3,
    color: "#8b5cf6",
    lineWidth: 1,
  },
  supportedAssets: [],
  tags: ["ribbon", "cascade", "adaptive", "premium", "overlay", "kama", "trend", "alignment", "multi-layer", "flow"],
  riskLevel: "medium",
};

const ECLIPSE_STEALTH_TRAIL: Partial<IMarketplaceItem> = {
  name: "Eclipse Stealth Trail",
  slug: "eclipse-stealth-trail",
  shortDescription:
    "Adaptive stepping trend line that freezes during choppy markets and flows during trends, with a shadow trail for stop placement and signal markers.",
  fullDescription: `# Eclipse Stealth Trail

## Overview
**Eclipse Stealth Trail** is a premium on-chart overlay that behaves unlike any moving average or trend line. It uses a **McGinley Dynamic** for ultra-smooth trend tracking combined with **Fractal Dimension analysis** to detect market regime. During choppy, range-bound markets the line **freezes flat** (steps), refusing to whipsaw. During trending conditions it **flows smoothly** with price. A dashed **shadow trail** shows the exact stop/invalidation level.

## How It Works

### Stepping Logic
- **Fractal Dimension > Threshold** → Market is choppy → Line **holds flat** at its last value
- **Fractal Dimension < Threshold** → Market is trending → Line **follows** the McGinley Dynamic smoothly
- This creates distinctive "staircase" patterns during consolidation and smooth curves during trends

### McGinley Dynamic Core
Unlike standard MAs, the McGinley Dynamic self-adjusts its speed based on price-to-MA ratio. It accelerates when price moves away and decelerates when price is near — providing natural trend smoothing without lag spikes.

### Shadow Trail (Stop Level)
- In **bullish** mode: shadow sits below the trail at ATR × multiplier distance
- In **bearish** mode: shadow sits above the trail at ATR × multiplier distance
- This is your exact invalidation level — where your stop-loss should be

### Signal Markers
- **BULL** (green arrow): Direction flips from bearish to bullish
- **BEAR** (red arrow): Direction flips from bullish to bearish
- **BREAK** (yellow circle): Line unfreezes after a stepping period — potential breakout entry

## How to Trade With It

### Trend Following
1. Wait for a **BULL** or **BEAR** flip signal
2. Enter in the signal direction
3. Place stop-loss at the shadow trail level
4. Trail your stop using the shadow as it moves

### Breakout Trading
1. Observe the trail in "stepping" mode (flat horizontal line)
2. When a **BREAK** marker appears, the line is unfreezing
3. Enter in the break direction — momentum is returning
4. Use the shadow trail as your stop

### Chop Avoidance
1. When the trail is stepping (flat), the market is choppy
2. Avoid taking new trades during stepping periods
3. Wait for the line to start flowing again before entering

### Re-Entry
1. In an existing trend, price pulls back to the trail line
2. If the trail holds (doesn't flip), it's a re-entry opportunity
3. Shadow trail provides the exact risk level

## Settings Guide
- **McGinley Period** (14): Smoothing period for the core trend line
- **FD Period** (30): Lookback for fractal dimension calculation
- **FD Threshold** (1.5): Above this = choppy (stepping), below = trending (flowing)
- **ATR Period** (14): ATR lookback for shadow trail offset
- **ATR Multiplier** (1.8): Distance of shadow from trail (higher = wider stops)

## What Makes It Different
| Feature | Standard MA | Supertrend | Eclipse Stealth Trail |
|---------|------------|------------|----------------------|
| Chop behavior | Whipsaws constantly | Flips back and forth | **Freezes flat** |
| Trend behavior | Lags behind price | Fixed ATR offset | **Flows with McGinley** |
| Stop level | Not provided | Fixed distance | **Adaptive shadow trail** |
| Regime detection | None | None | **Fractal Dimension** |
| False signals | Many in ranges | Many in ranges | **Suppressed by stepping** |

## Risk Warning
No indicator guarantees profits. Eclipse Stealth Trail helps filter noise and identify trend vs chop, but all trading involves risk. Always use proper position sizing and risk management.`,
  category: "indicator",
  price: 35,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "eclipse_stealth_trail",
  iconName: "Eclipse",
  codeTemplate: JSON.stringify({
    type: "eclipse_stealth_trail",
    displayType: "overlay",
    description: "Adaptive stepping trend line with fractal dimension regime detection and shadow trail",
  }),
  defaultSettings: {
    mcgPeriod: 14,
    fdPeriod: 30,
    fdThreshold: 1.5,
    atrPeriod: 14,
    atrMultiplier: 1.8,
    color: "#a855f7",
    lineWidth: 3,
  },
  supportedAssets: [],
  tags: ["stealth", "stepping", "adaptive", "premium", "overlay", "mcginley", "fractal", "trend", "trail", "stop-loss", "regime"],
  riskLevel: "medium",
};

const WRAITH_CONVERGENCE_ENGINE: Partial<IMarketplaceItem> = {
  name: "Wraith Convergence Engine",
  slug: "wraith-convergence-engine",
  shortDescription:
    "Multi-method consensus overlay that fuses McGinley Dynamic, Super Smoother, KAMA, and Hull MA into one intelligent trend line. Fires signals only when all 4 methods converge.",
  fullDescription: `# Wraith Convergence Engine

## Overview
**Wraith Convergence Engine (WCE)** is a premium on-chart overlay that runs **4 completely different adaptive trend algorithms simultaneously** and fuses them into a single **consensus line**. Unlike simple moving averages or bands, WCE measures the **agreement level** between the 4 methods and only fires trade signals when all methods converge on the same direction.

## The 4 Methods
1. **McGinley Dynamic** — Self-adjusting MA that automatically speeds up in fast markets and slows in calm ones
2. **Ehlers 2-Pole Super Smoother** — Digital signal processing filter that removes high-frequency noise with minimal lag
3. **Kaufman Adaptive MA (KAMA)** — Efficiency-ratio driven adaptive filter
4. **Hull Moving Average (HMA)** — Ultra-responsive weighted MA using square root smoothing

## How It Works
- The **consensus line** is the weighted average of all 4 methods
- The **convergence score** (0–100) measures how tightly the 4 values agree, normalized by ATR
- **High convergence** (methods agree) = strong, reliable trend signal
- **Low convergence** (methods disagree) = uncertain market, stay cautious
- The line changes color: green = bullish consensus, red = bearish consensus

## Signal Types
- **CONV ▲** (Convergence Bull): All 4 methods are below price AND convergence is above threshold — unanimous bullish agreement
- **CONV ▼** (Convergence Bear): All 4 methods are above price AND convergence is above threshold — unanimous bearish agreement
- **DIV** (Divergence Warning): Methods were converged but have started to disagree — potential trend exhaustion

## How to Trade
1. **High-confidence entries**: Wait for CONV signals — all 4 methods must agree. This filters out 80%+ of false signals
2. **Trend following**: Stay in the trade while the line maintains its color. Exit or tighten stops on DIV signals
3. **Convergence filter**: Use the convergence score to filter other indicators — only take signals from your other tools when WCE convergence is above 70
4. **Divergence exits**: When DIV fires after a trend run, it means the 4 methods are starting to disagree — consider taking profits

## Settings
- **Period** (20): Base lookback period used by all 4 methods
- **KAMA Fast** (2): Fast smoothing constant for KAMA responsiveness
- **KAMA Slow** (30): Slow smoothing constant for KAMA noise filtering
- **Convergence Threshold** (70): Minimum convergence score (0-100) required for CONV signals

## What Makes It Different
| Feature | Single MA | Multi-MA Ribbon | WCE |
|---------|-----------|----------------|-----|
| Methods used | 1 | Multiple of same type | 4 different types |
| Lines shown | 1 | 4-8 lines | 1 intelligent line |
| Signal logic | Price cross | Visual interpretation | Unanimous convergence |
| False signal filter | Low | Medium | Very High |
| Convergence metric | None | None | Built-in 0-100 score |

## Risk Warning
No indicator guarantees profits. WCE provides high-confidence signals by requiring multi-method consensus, but all trading involves risk. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 38,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "wraith_convergence_engine",
  iconName: "Ghost",
  codeTemplate: JSON.stringify({
    type: "wraith_convergence_engine",
    displayType: "overlay",
    description: "4-method consensus trend line with convergence scoring and signal filtering",
  }),
  defaultSettings: {
    period: 20,
    kamaFast: 2,
    kamaSlow: 30,
    convergenceThreshold: 70,
    color: "#a855f7",
    lineWidth: 3,
  },
  supportedAssets: [],
  tags: ["convergence", "consensus", "multi-method", "premium", "overlay", "adaptive", "trend", "filter", "signal", "mcginley", "hull", "kama"],
  riskLevel: "medium",
};

const FLUX_MOMENTUM_TRAIL: Partial<IMarketplaceItem> = {
  name: "Flux Momentum Trail",
  slug: "flux-momentum-trail",
  shortDescription:
    "Per-bar gradient-colored momentum line. A single DEMA trail that shifts through a color spectrum from deep green to deep red based on real-time momentum strength.",
  fullDescription: `# Flux Momentum Trail

## Overview
**Flux Momentum Trail** is a premium on-chart overlay that renders a **single continuous line with per-bar dynamic color grading**. Unlike traditional indicators that use one or two colors, every single bar of this line has its own color drawn from a momentum spectrum — making trend strength and direction instantly visible at a glance.

## How It Works

### Adaptive Trail (DEMA)
The trail line uses a **Double Exponential Moving Average** for responsive yet smooth price tracking. It reacts faster than a standard EMA while filtering out noise.

### Composite Momentum Score (-100 to +100)
Three factors combine into a single momentum reading:
- **Trend Component**: Distance between fast DEMA and slow EMA, normalized by ATR
- **Rate of Change**: Price velocity over the ROC period
- **Volume Boost**: When volume exceeds its average, momentum scores are amplified in the trend direction

### Color Spectrum
Each bar gets its own color based on momentum strength:
- **Deep Green** (#15803d): Extreme bullish momentum (80-100)
- **Bright Green** (#22c55e): Strong bullish (60-80)
- **Light Green** (#4ade80): Moderate bullish (40-60)
- **Teal** (#06b6d4): Mild bullish (20-40)
- **Gray** (#94a3b8): Neutral / no momentum (0-20)
- **Orange** (#f97316): Mild bearish (-20 to -40)
- **Light Red** (#f87171): Moderate bearish (-40 to -60)
- **Bright Red** (#ef4444): Strong bearish (-60 to -80)
- **Deep Red** (#b91c1c): Extreme bearish (-80 to -100)

### Signal Markers
- **SURGE** (green arrow up): Momentum crosses above surge threshold — explosive bullish move
- **SURGE** (red arrow down): Momentum crosses below negative threshold — explosive bearish move
- **FADE** (yellow circle): Momentum collapses back to neutral — trend exhaustion warning

## How to Trade With It

### Trend Following
1. Enter long when the trail turns bright/deep green (momentum > 60)
2. Enter short when the trail turns bright/deep red (momentum < -60)
3. The color gradient shows conviction — deeper color = stronger trend

### Momentum Surge Entry
1. Wait for a SURGE marker (momentum breakout)
2. Enter in the surge direction — these mark the start of explosive moves
3. Stop-loss below/above the trail line

### Fade / Exit Signal
1. FADE markers warn that momentum is dying
2. Tighten stops or take profits when FADE appears
3. Don't re-enter until a new SURGE fires

### Color Transition Reading
1. Watch the color shift in real-time: green→teal→gray = bullish momentum fading
2. Gray→orange→red = bearish momentum building
3. Quick color flips (green→red) = sharp reversal — be cautious

## Settings Guide
- **Fast Period** (8): DEMA trail responsiveness — lower = faster
- **Slow Period** (21): Momentum reference EMA — the baseline for trend measurement
- **ROC Period** (12): Rate of change lookback — measures price velocity
- **ATR Period** (14): Normalization period — adapts to volatility
- **Surge Threshold** (70): Minimum momentum score for SURGE signals (0-100)

## What Makes It Different
| Feature | Standard MA | Flux Momentum Trail |
|---------|-----------|-------------------|
| Coloring | Single color | Per-bar gradient spectrum |
| Information | Direction only | Direction + strength + acceleration |
| Signals | None | SURGE + FADE markers |
| Momentum | Not shown | Built into color (-100 to +100) |
| Volume | Ignored | Amplifies momentum readings |

## Risk Warning
No indicator guarantees profits. Flux Momentum Trail visualizes momentum strength, but all trading involves risk. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 30,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "flux_momentum_trail",
  iconName: "Flame",
  codeTemplate: JSON.stringify({
    type: "flux_momentum_trail",
    displayType: "overlay",
    description: "Per-bar gradient-colored momentum line with SURGE/FADE signals",
  }),
  defaultSettings: {
    fastPeriod: 8,
    slowPeriod: 21,
    rocPeriod: 12,
    atrPeriod: 14,
    surgeThreshold: 70,
    lineWidth: 3,
  },
  supportedAssets: [],
  tags: ["momentum", "gradient", "color", "trail", "premium", "overlay", "dema", "volume", "surge", "fade", "spectrum"],
  riskLevel: "medium",
};

const APEX_PREDATOR_SIGNAL: Partial<IMarketplaceItem> = {
  name: "Apex Predator Signal",
  slug: "apex-predator-signal",
  shortDescription:
    "Multi-factor confluence signal engine. Runs 4 independent detectors (trend flip, momentum surge, volatility expansion, volume confirmation) and only fires when multiple factors align.",
  fullDescription: `# Apex Predator Signal

## Overview
**Apex Predator Signal** is a premium on-chart signal generator that combines **4 independent detection systems** running in parallel. Unlike trend-visualization indicators, this focuses on **WHEN to trade** — signals are rare but high-conviction because they require multi-factor confirmation.

## How It Works

### 4 Independent Detectors
1. **Trend Flip**: Zero-Lag EMA direction change detection
2. **Momentum Surge**: Rate of Change exceeding dynamic threshold
3. **Volatility Expansion**: ATR ratio detecting breakout conditions
4. **Volume Confirmation**: Volume spike above rolling average

### Confluence Scoring (0–4)
Each bar receives a score from 0 to 4 based on how many detectors are active:
- **4/4**: Maximum confluence — all systems agree
- **3/4**: High confluence — strong setup
- **2/4**: Moderate — potential setup forming
- **0–1/4**: No signal — stay out

### Signal Types
- **APEX** (3–4 confluence): Full-strength entry signal — the "predator strike"
- **STALK** (2 confluence on trend flip): Moderate setup — the "stalking phase"

## How to Trade
1. **Wait for APEX signals** — these are the highest-quality entries
2. **APEX ▲ (Bull)**: Price above ZLEMA + momentum surge + vol expansion + volume confirm → Long entry
3. **APEX ▼ (Bear)**: Price below ZLEMA + momentum surge + vol expansion + volume confirm → Short entry
4. **STALK signals**: Use for early positioning or to tighten existing stops
5. **No signal**: Stay flat — the predator waits for the perfect strike

## Settings
- **ZLEMA Period** (21): Zero-Lag EMA smoothing period
- **ROC Period** (12): Rate of change lookback
- **ATR Period** (14): Volatility measurement period
- **Volume Period** (20): Volume average lookback
- **Min Confluence** (2): Minimum factors for any signal

## Risk Warning
No indicator guarantees profits. Apex Predator Signal filters for high-probability setups but all trading involves risk. Always use stop-losses and proper position sizing.`,
  category: "indicator",
  price: 36,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "apex_predator_signal",
  iconName: "Crosshair",
  codeTemplate: JSON.stringify({
    type: "apex_predator_signal",
    displayType: "overlay",
    description: "Multi-factor confluence signal engine with 4 independent detectors",
  }),
  defaultSettings: {
    zlemaPeriod: 21,
    rocPeriod: 12,
    atrPeriod: 14,
    volPeriod: 20,
    minConfluence: 2,
    color: "#f59e0b",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["signal", "confluence", "multi-factor", "premium", "overlay", "predator", "entry", "zlema", "momentum", "volume"],
  riskLevel: "medium",
};

const PHANTOM_DIVERGENCE_TRACKER: Partial<IMarketplaceItem> = {
  name: "Phantom Divergence Tracker",
  slug: "phantom-divergence-tracker",
  shortDescription:
    "Dual-line overlay comparing smoothed price vs volume-adjusted price. Divergence between lines reveals hidden reversals; convergence confirms trends.",
  fullDescription: `# Phantom Divergence Tracker

## Overview
**Phantom Divergence Tracker** renders **two independent lines** on the chart that represent fundamentally different market perspectives:
- **Price Line**: Ehlers Super Smoother of actual close price — shows where price IS
- **Volume Line**: Volume-weighted adaptive price — shows where price SHOULD BE based on participation

When the two lines agree (converge), the trend has genuine volume backing. When they disagree (diverge), something is wrong — price is moving without conviction, signaling a potential reversal.

## How It Works
1. **Price Line** uses a 2-pole Super Smoother filter for ultra-clean trend extraction
2. **Volume Line** adjusts price by volume participation ratio before smoothing
3. **Divergence Score** (0–100) measures the normalized gap between lines
4. When divergence exceeds threshold → reversal warning
5. When lines converge after divergence → trend confirmation

## How to Trade
1. **Divergence Warning**: Lines spread apart → price moving on thin volume → expect reversal
2. **Convergence Confirmation**: Lines come together → volume backs the move → enter with trend
3. **DIV markers**: Critical divergence detected → prepare for reversal
4. **CONV markers**: Lines re-converge → trend resuming with conviction

## Settings
- **Smooth Period** (21): Smoothing period for both lines
- **Vol Period** (20): Volume average lookback
- **ATR Period** (14): Normalization period
- **Div Threshold** (60): Divergence level to trigger signals (0-100)

## Risk Warning
No indicator guarantees profits. Always use proper risk management.`,
  category: "indicator",
  price: 33,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "phantom_divergence_tracker",
  iconName: "GitBranchPlus",
  codeTemplate: JSON.stringify({
    type: "phantom_divergence_tracker",
    displayType: "overlay",
    description: "Dual-line price vs volume-adjusted divergence tracker with convergence signals",
  }),
  defaultSettings: {
    smoothPeriod: 21,
    volPeriod: 20,
    atrPeriod: 14,
    divThreshold: 60,
    color: "#a78bfa",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["divergence", "volume", "dual-line", "premium", "overlay", "convergence", "reversal", "confirmation"],
  riskLevel: "medium",
};

const CHAOS_SENTINEL: Partial<IMarketplaceItem> = {
  name: "Chaos Sentinel",
  slug: "chaos-sentinel",
  shortDescription:
    "Chaos theory overlay using Lyapunov exponent to detect orderly vs chaotic market regimes. Attractor line with regime-colored segments and transition signals.",
  fullDescription: `# Chaos Sentinel

## Overview
**Chaos Sentinel** applies chaos theory mathematics to market analysis. It calculates the **Lyapunov exponent** — a measure from dynamical systems theory — to determine whether the market is in an orderly (predictable/trending) state or a chaotic (random/unpredictable) state.

## How It Works

### Lyapunov Exponent
The Lyapunov exponent measures the rate of divergence between nearby trajectories in a dynamical system:
- **Low Lyapunov** (< threshold): Market is orderly — price movements are predictable, trends persist
- **High Lyapunov** (≥ threshold): Market is chaotic — price movements are random, mean-reverting noise dominates

### Attractor Line
A smoothed equilibrium price (DEMA) represents the market's "attractor" — the fair value price tends to gravitate toward.

### Three Regimes
- **Order** (blue segments): Market trending predictably — ideal for trend-following
- **Transition** (yellow): Shifting between states — reduce position size
- **Chaos** (red segments): Market random/unpredictable — avoid trading or use mean-reversion only

## How to Trade
1. **Trade only in Order regime**: When the line is blue, trend signals are reliable
2. **Reduce size in Transition**: Yellow = uncertainty, cut position size by half
3. **Avoid Chaos**: Red = random market, most indicators will whipsaw
4. **ORDER signal**: Market just entered orderly state → look for trend entries
5. **CHAOS signal**: Market just entered chaotic state → close trend positions

## Settings
- **Attractor Period** (21): DEMA period for the equilibrium line
- **Lyapunov Period** (14): Lookback for chaos measurement
- **Smoothing** (5): Lyapunov smoothing to reduce noise
- **Chaos Threshold** (50): Sensitivity (0-100, lower = more chaos detection)

## Risk Warning
No indicator guarantees profits. Always use proper position sizing and risk management.`,
  category: "indicator",
  price: 40,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "chaos_sentinel",
  iconName: "Flame",
  codeTemplate: JSON.stringify({
    type: "chaos_sentinel",
    displayType: "overlay",
    description: "Chaos theory overlay with Lyapunov exponent regime detection and attractor line",
  }),
  defaultSettings: {
    attractorPeriod: 21,
    lyapunovPeriod: 14,
    smoothing: 5,
    chaosThreshold: 50,
    color: "#3b82f6",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["chaos", "lyapunov", "regime", "premium", "overlay", "attractor", "order", "stability", "dynamical-systems"],
  riskLevel: "medium",
};

const HELIX_PHASE_ENGINE: Partial<IMarketplaceItem> = {
  name: "Helix Phase Engine",
  slug: "helix-phase-engine",
  shortDescription:
    "Hilbert Transform-based phase analysis overlay. Extracts instantaneous phase and amplitude from price to create a leading adaptive line with dynamic envelope and velocity-based regime coloring.",
  fullDescription: `# Helix Phase Engine

## Overview
**Helix Phase Engine** brings professional-grade **Hilbert Transform** signal processing to retail traders. It decomposes price into its analytic signal, extracting instantaneous phase and amplitude — the same mathematics used in radar, communications, and institutional quant models.

## How It Works

### Hilbert Transform
The Hilbert Transform computes the 90° phase-shifted version of the detrended price cycle:
- The **analytic signal** = original cycle + j × Hilbert(cycle)
- From this, we extract **instantaneous amplitude** (cycle strength) and **instantaneous phase** (cycle position)

### Phase-Adaptive Lead Line
Using the instantaneous frequency (rate of phase change), the indicator builds an adaptive moving average whose length naturally shortens during fast cycles and lengthens during slow ones. This causes the line to **lead price at turning points**.

### Phase Velocity Regimes
The rate of phase change (phase velocity) reveals market state:
- **Trending** (cyan): High phase velocity — strong directional movement, cycles turning fast
- **Consolidation** (gray): Low phase velocity — price range-bound, cycles stalling
- **Reversal** (magenta): Negative/extreme velocity — cycle phase is inverting, turn imminent

### Dynamic Amplitude Envelope
Upper and lower bands are offset by the instantaneous amplitude × multiplier. These bands widen during volatile cycles and narrow during calm periods.

## Signals
- **LEAD ▲ / LEAD ▼**: Phase line crosses price with high velocity — anticipates a turn before it completes
- **SYNC**: Phase velocity drops sharply — cycle compression, expect a breakout

## How to Trade
1. **Follow the Lead Line**: When it crosses above price with high velocity → bearish turn anticipated; below price → bullish turn
2. **Trade within the envelope**: Price touching upper band in trending regime = potential short; lower band = potential long
3. **Respect SYNC signals**: Cycle compression often precedes explosive moves — prepare for breakout in either direction
4. **Color confirms regime**: Only trade trends when line is cyan; avoid entries on gray (consolidation)
5. **Combine with volume**: LEAD signals with high volume confirmation are strongest

## Settings
- **Detrend Period** (20): DEMA period for extracting the cycle component
- **Hilbert Length** (7): FIR filter length for Hilbert Transform (higher = smoother but more lag)
- **Amplitude Multiplier** (1.5): Envelope width multiplier
- **Velocity Smooth** (5): Smoothing for phase velocity to reduce noise
- **Lead Sensitivity** (55): Threshold for regime classification (0-100)

## Risk Warning
No indicator guarantees profits. The Helix Phase Engine works best on instruments with clear cyclical behavior. Always use proper position sizing and risk management.`,
  category: "indicator",
  price: 55,
  isFree: false,
  status: "active",
  isPublished: true,
  isFeatured: true,
  version: "1.0.0",
  indicatorType: "helix_phase_engine",
  iconName: "Orbit",
  codeTemplate: JSON.stringify({
    type: "helix_phase_engine",
    displayType: "overlay",
    description: "Hilbert Transform phase analysis with adaptive lead line, amplitude envelope, and velocity regime coloring",
  }),
  defaultSettings: {
    detrendPeriod: 20,
    hilbertLength: 7,
    ampMultiplier: 1.5,
    velocitySmooth: 5,
    leadSensitivity: 55,
    color: "#06b6d4",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["hilbert", "phase", "signal-processing", "premium", "overlay", "adaptive", "leading", "cycle", "envelope", "velocity"],
  riskLevel: "medium",
};

const PRISM_WAVELET_CASCADE: Partial<IMarketplaceItem> = {
  name: "Prism Wavelet Cascade",
  slug: "prism-wavelet-cascade",
  shortDescription:
    "Multi-resolution wavelet decomposition that splits price into 4 frequency layers. A stunning rainbow cascade shows when all market timeframes align or diverge.",
  fullDescription: `# Prism Wavelet Cascade

## Overview
**Prism Wavelet Cascade** uses **Haar Wavelet Decomposition** — a technique from signal processing and quantum physics — to separate price data into distinct frequency layers. Each layer captures a different "speed" of the market, from fast intrabar noise to the slow underlying trend.

## How It Works

### Haar Wavelet Transform
The Haar wavelet is the simplest and most computationally efficient wavelet. It decomposes price into:
- **Layer 1 (Cyan)**: Fastest frequency — captures 2–4 bar micro-movements
- **Layer 2 (Blue)**: Fast — captures 4–8 bar short swings
- **Layer 3 (Purple)**: Medium — captures 8–16 bar intermediate cycles
- **Layer 4 (Magenta)**: Slowest — the underlying trend (approximation coefficients)

### Spectral Alignment Score
A proprietary metric measures how closely the 4 layers agree:
- **High alignment (>70%)**: All frequencies moving in the same direction → strong, high-confidence trend
- **Low alignment (<30%)**: Frequencies disagree → market is choppy/transitioning

## How to Trade
1. **ALIGN signal (all 4 layers converge)**: High-probability entry — all timeframes agree on direction
2. **SPLIT signal (layers diverge)**: Exit or avoid — market structure is breaking down
3. **Layer order matters**: When fast layers (cyan) cross above slow layers (magenta), bullish momentum is building
4. **Convergence zones**: Where all 4 lines narrow into a tight band = coiled spring, expect breakout
5. **Use with any asset**: Works on forex, crypto, stocks — anywhere price has cyclical behavior

## Best Practices
- Combine with volume confirmation for highest accuracy
- In strong trends, ride the trade as long as layers stay aligned
- Tighten stops when alignment score drops below 50%`,
  category: "indicator",
  subcategory: "premium",
  pricingModel: "one_time",
  price: 39.99,
  currency: "USD",
  indicatorType: "prism_wavelet_cascade",
  iconName: "Layers",
  codeTemplate: JSON.stringify({
    type: "prism_wavelet_cascade",
    displayType: "overlay",
    description: "Haar wavelet decomposition into 4 frequency layers with spectral alignment scoring and convergence/divergence signals",
  }),
  defaultSettings: {
    waveletDepth: 3,
    smoothPeriod: 8,
    alignThreshold: 70,
    splitThreshold: 30,
    color: "#00e5ff",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["wavelet", "multi-resolution", "frequency", "premium", "overlay", "cascade", "alignment", "spectral", "trend", "rainbow"],
  riskLevel: "medium",
};

const MIRAGE_DEPTH_SCANNER: Partial<IMarketplaceItem> = {
  name: "Mirage Depth Scanner",
  slug: "mirage-depth-scanner",
  shortDescription:
    "Singular Spectrum Analysis overlay that extracts the true trend via eigendecomposition, separating signal from noise with a pulsating depth corridor and emerge/submerge markers.",
  fullDescription: `# Mirage Depth Scanner

## Overview
**Mirage Depth Scanner** uses **Singular Spectrum Analysis (SSA)** — a powerful technique from climate science and geophysics — to decompose price into mathematically optimal **trend**, **oscillatory**, and **noise** components via eigendecomposition of the trajectory matrix. Unlike moving averages that blur price, SSA extracts the *true underlying trend* with minimal lag.

## How It Works

### Singular Spectrum Analysis
1. A **trajectory matrix** is built from rolling price windows
2. The **covariance matrix** is computed and its dominant eigenvectors extracted via power iteration
3. The **leading eigenvector** reconstructs the pure trend component
4. The **residual** captures oscillatory cycles and noise

### Depth Score (0–100)
Measures what percentage of total price variance is explained by the trend component:
- **High depth (>65)**: Strong trend dominates — reliable directional signals
- **Low depth (<35)**: Noise dominates — choppy, range-bound conditions
- **Transition**: Shifting between regimes

### Signal Corridor
The oscillatory component creates a dynamic corridor (upper/lower bands) around the trend line. Width reflects cycle amplitude — wider corridors indicate stronger oscillations.

## Visual Design
- **Depth Line**: Thick trend line — gold/emerald when bullish, crimson/violet when bearish
- **Signal Corridor**: Upper/lower bands showing oscillatory amplitude
- **EMERGE** marker: Trend emerging from noise (depth score crosses above threshold)
- **SUBMERGE** marker: Trend weakening (depth score drops below threshold)

## How to Trade
1. **Follow the Depth Line direction** when depth score is high (deep regime)
2. **EMERGE signals**: Strong entry — trend just became dominant, momentum aligning
3. **SUBMERGE signals**: Exit/reduce — trend dissolving into noise
4. **Corridor width**: Wide = strong oscillation (range trades), narrow = clean trend
5. **Color changes**: Gold→emerald = accelerating bull; crimson→violet = accelerating bear
6. **Avoid trading** in surface regime (low depth) — noise dominates

## Parameters
- **Window Length** (default 30): SSA embedding dimension — larger = smoother trend
- **Corridor Multiplier** (default 1.5): Scales oscillatory bands
- **Depth Smooth** (default 5): EMA smoothing on depth score
- **Signal Threshold** (default 65): Depth level for emerge/submerge signals`,
  category: "indicators",
  subcategory: "premium",
  price: 69.99,
  currency: "USD",
  status: "published",
  featured: true,
  indicatorType: "mirage_depth_scanner",
  iconName: "Layers",
  codeTemplate: JSON.stringify({
    type: "mirage_depth_scanner",
    displayType: "overlay",
    description: "SSA eigendecomposition trend extraction with depth corridor and regime detection",
  }),
  defaultSettings: {
    windowLength: 30,
    corridorMultiplier: 1.5,
    depthSmooth: 5,
    signalThreshold: 65,
    color: "#ffd700",
    lineWidth: 3,
  },
  supportedAssets: [],
  tags: ["ssa", "eigendecomposition", "trend-extraction", "premium", "overlay", "depth", "signal-processing", "corridor", "regime", "noise-separation"],
  riskLevel: "medium",
};

const ALL_ITEMS = [
  // Indicators
  NEXUS_TREND_MATRIX,
  PHANTOM_FLOW_ZONES,
  FRACTAL_PULSE_GRID,
  VORTEX_DRIFT_CLOUD,
  ORION_MOMENTUM_SHIELD,
  NEBULA_PHASE_BANDS,
  CIPHER_HARMONIC_VEIL,
  TITAN_PULSE_SIGNAL,
  AURORA_CASCADE_FLOW,
  ECLIPSE_STEALTH_TRAIL,
  WRAITH_CONVERGENCE_ENGINE,
  FLUX_MOMENTUM_TRAIL,
  APEX_PREDATOR_SIGNAL,
  PHANTOM_DIVERGENCE_TRACKER,
  CHAOS_SENTINEL,
  HELIX_PHASE_ENGINE,
  PRISM_WAVELET_CASCADE,
  MIRAGE_DEPTH_SCANNER,
  // Cosmetic Avatars
  AVATAR_SHADOW_TRADER,
  AVATAR_PHANTOM_OPERATIVE,
  AVATAR_CYBER_RONIN,
  AVATAR_CRYPTO_ORACLE,
  AVATAR_NEBULA_SNIPER,
  AVATAR_BLOOD_SHOGUN,
  AVATAR_VOID_HUNTER,
  AVATAR_INFERNO_LORD,
  AVATAR_ALCHEMIST_PRIME,
  AVATAR_STORM_CENTURION,
  AVATAR_QUANTUM_SAGE,
  AVATAR_DIGITAL_ASSASSIN,
  // Game Master Packages
  GAMEMASTER_STARTER_PACKAGE,
  GAMEMASTER_PRO_PACKAGE,
  GAMEMASTER_ELITE_PACKAGE,
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

export async function seedMarketplaceItems(
  adminId: string = "system",
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  await connectToDatabase();

  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  // NOTE: Stale items (including old indicators not in the seed list) are cleaned up
  // at the end of the seed function by comparing against processedSlugs.

  // ---- Load saved defaults JSON (contains imageUrl and admin-customized data) ----
  let savedDefaults: Record<string, any> = {};
  try {
    const possiblePaths = [
      path.join(process.cwd(), "apps", "admin", "lib", "data", "marketplace-defaults.json"),
      path.join(process.cwd(), "lib", "data", "marketplace-defaults.json"),
      path.join(process.cwd(), "..", "..", "apps", "admin", "lib", "data", "marketplace-defaults.json"),
    ];

    for (const jsonPath of possiblePaths) {
      try {
        const raw = await readFile(jsonPath, "utf-8");
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.slug) {
              savedDefaults[item.slug] = item;
            }
          }
          console.log(`📄 [Seed] Loaded ${items.length} saved defaults from ${jsonPath}`);
        }
        break;
      } catch {
        continue;
      }
    }

    if (Object.keys(savedDefaults).length === 0) {
      console.log(`📄 [Seed] No marketplace-defaults.json found, using hardcoded data only`);
    }
  } catch (err) {
    console.warn(`⚠️ [Seed] Could not load defaults JSON:`, err);
  }

  // ---- Build merged item list: hardcoded + JSON defaults (JSON wins for admin-customized fields) ----
  const mergedItems: any[] = [];
  const processedSlugs = new Set<string>();

  for (const hardcoded of ALL_ITEMS) {
    const slug = hardcoded.slug as string;
    if (!slug) { mergedItems.push(hardcoded); continue; }
    const jsonData = savedDefaults[slug];
    if (jsonData) {
      mergedItems.push({
        ...hardcoded,
        imageUrl: jsonData.imageUrl || hardcoded.imageUrl,
        iconName: jsonData.iconName || hardcoded.iconName,
        fullDescription: jsonData.fullDescription || hardcoded.fullDescription,
        shortDescription: jsonData.shortDescription || hardcoded.shortDescription,
        price: jsonData.price ?? hardcoded.price,
        originalPrice: jsonData.originalPrice ?? hardcoded.originalPrice,
        tags: (jsonData.tags && jsonData.tags.length > 0) ? jsonData.tags : hardcoded.tags,
        isFeatured: jsonData.isFeatured ?? hardcoded.isFeatured,
      });
    } else {
      mergedItems.push(hardcoded);
    }
    processedSlugs.add(slug);
  }

  // Also add any items from JSON that are NOT in the hardcoded list
  // (these are cosmetic items created manually by admin and saved as defaults)
  // SKIP indicator/strategy items — they were removed and will be rebuilt one-by-one
  for (const [slug, jsonData] of Object.entries(savedDefaults)) {
    if (!processedSlugs.has(slug)) {
      const cat = jsonData.category?.toLowerCase();
      if (cat === "indicator" || cat === "strategy") {
        console.log(`⏭️ [Seed] Skipping ${cat} from JSON: ${slug}`);
        continue;
      }
      mergedItems.push(jsonData);
      processedSlugs.add(slug);
    }
  }

  console.log(`📦 [Seed] Processing ${mergedItems.length} items (${ALL_ITEMS.length} hardcoded + ${Object.keys(savedDefaults).length} from JSON)`);

  for (const itemData of mergedItems) {
    try {
      const existing = await MarketplaceItem.findOne({ slug: itemData.slug });

      if (existing) {
        existing.indicatorType = itemData.indicatorType;
        existing.strategyConfig = itemData.strategyConfig as any;
        existing.cosmeticType = itemData.cosmeticType as any;
        if (!existing.imageUrl && itemData.imageUrl) {
          existing.imageUrl = itemData.imageUrl;
        }
        if (!existing.iconName && itemData.iconName) {
          existing.iconName = itemData.iconName;
        }
        existing.codeTemplate = itemData.codeTemplate || existing.codeTemplate;
        existing.defaultSettings =
          itemData.defaultSettings || existing.defaultSettings;
        if (!existing.fullDescription && itemData.fullDescription) {
          existing.fullDescription = itemData.fullDescription;
        }
        if (!existing.shortDescription && itemData.shortDescription) {
          existing.shortDescription = itemData.shortDescription;
        }
        existing.version = itemData.version || existing.version;
        existing.isPublished = itemData.isPublished ?? true;
        existing.status = itemData.status || "active";
        existing.category = itemData.category || existing.category;
        if (existing.price === 0 || existing.price === undefined) {
          existing.price = itemData.price ?? existing.price;
        }
        existing.isFree = itemData.isFree ?? existing.isFree;
        if (itemData.isFeatured !== undefined) {
          existing.isFeatured = itemData.isFeatured;
        }
        if (!existing.tags || existing.tags.length === 0) {
          existing.tags = itemData.tags || existing.tags;
        }
        if (itemData.gameMasterConfig) {
          existing.gameMasterConfig = itemData.gameMasterConfig as any;
        }
        await existing.save();
        result.updated++;
        continue;
      }

      await MarketplaceItem.create({
        ...itemData,
        createdBy: adminId,
      });
      result.created++;
    } catch (error) {
      result.errors.push(
        `Failed to create ${itemData.slug}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // ---- Final cleanup: remove any DB items NOT in the processed list ----
  // This prevents stale duplicates from lingering in the marketplace
  try {
    const validSlugs = Array.from(processedSlugs);
    const staleItems = await MarketplaceItem.find({
      slug: { $nin: validSlugs },
    });
    if (staleItems.length > 0) {
      const staleIds = staleItems.map((i: any) => i._id);
      const staleSlugs = staleItems.map((i: any) => `${i.slug} (${i.category})`);
      const { UserPurchase } = await import("@/database/models/marketplace/user-purchase.model");
      await UserPurchase.deleteMany({ itemId: { $in: staleIds } });
      await MarketplaceItem.deleteMany({ slug: { $nin: validSlugs } });
      console.log(`🗑️ [Seed] Removed ${staleItems.length} stale items not in seed list: ${staleSlugs.join(", ")}`);
    }
  } catch (cleanupErr) {
    console.warn(`⚠️ [Seed] Stale item cleanup failed:`, cleanupErr);
  }

  console.log(
    `✅ Marketplace seeded: ${result.created} created, ${result.updated} updated`,
  );

  return result;
}

export async function getMarketplaceStats(): Promise<{
  totalItems: number;
  totalIndicators: number;
  totalStrategies: number;
  totalCosmetics: number;
  totalGameMasterPackages: number;
  totalPurchases: number;
}> {
  await connectToDatabase();

  const [
    totalItems,
    totalIndicators,
    totalStrategies,
    totalCosmetics,
    totalGameMasterPackages,
  ] = await Promise.all([
    MarketplaceItem.countDocuments({ isPublished: true }),
    MarketplaceItem.countDocuments({
      isPublished: true,
      category: "indicator",
    }),
    MarketplaceItem.countDocuments({ isPublished: true, category: "strategy" }),
    MarketplaceItem.countDocuments({ isPublished: true, category: "cosmetic" }),
    MarketplaceItem.countDocuments({
      isPublished: true,
      category: "gamemaster",
    }),
  ]);

  const { UserPurchase } =
    await import("@/database/models/marketplace/user-purchase.model");
  const totalPurchases = await UserPurchase.countDocuments();

  return {
    totalItems,
    totalIndicators,
    totalStrategies,
    totalCosmetics,
    totalGameMasterPackages,
    totalPurchases,
  };
}

/**
 * Get available indicator types that have chart implementations
 */
export function getAvailableIndicatorTypes() {
  return [
    {
      type: "sma",
      name: "SMA",
      description: "Simple Moving Average",
      displayType: "overlay",
    },
    {
      type: "ema",
      name: "EMA",
      description: "Exponential Moving Average",
      displayType: "overlay",
    },
    {
      type: "bb",
      name: "Bollinger Bands",
      description: "Volatility bands",
      displayType: "overlay",
    },
    {
      type: "support_resistance",
      name: "S/R Levels",
      description: "Auto support/resistance",
      displayType: "overlay",
    },
    {
      type: "rsi",
      name: "RSI",
      description: "Relative Strength Index",
      displayType: "oscillator",
    },
    {
      type: "macd",
      name: "MACD",
      description: "Moving Average Convergence Divergence",
      displayType: "oscillator",
    },
  ];
}
