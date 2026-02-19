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
import { readFile, access } from "fs/promises";
import { constants } from "fs";
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

## How to Trade With It

### Trend Following
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
3. Enter in the direction of the **first colored band expansion**
4. The wider the preceding compression, the stronger the potential breakout

### Trend Reversal Detection
1. Watch for color transitions: **cyan → gray → orange** (bearish reversal)
2. Or: **orange → gray → cyan** (bullish reversal)
3. The **gray transition zone** acts as an early warning
4. Confirm reversal when price closes beyond the midline in the new direction

## Settings Guide
- **Smoother Period** (21): Super Smoother filter length — higher = smoother but slower
- **ATR Period** (14): Volatility lookback for band width calculation
- **Band Width** (2.0): Multiplier for band distance from midline
- **ADX Period** (14): Trend strength measurement lookback
- **Trend Threshold** (25): ADX level that distinguishes trending from ranging
- **Momentum Lookback** (10): Bars to compare for trend direction coloring

## Risk Warning
No indicator guarantees profits. The Vortex Drift Cloud is a decision-support tool. Always use proper risk management and never risk more than you can afford to lose.`,
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

### 2. Momentum-Expanding Bands
Unlike fixed-width bands, Orion's bands physically react to momentum:
- **Surge phase** (strong momentum): Bands expand outward
- **Drift phase** (moderate momentum): Normal band width
- **Fade phase** (dying momentum): Bands compress inward, warning of exhaustion

### 3. Three-Phase Color System
- **Green (Surge+)** = Strong bullish momentum
- **Red (Surge-)** = Strong bearish momentum
- **Teal (Drift+)** / **Orange (Drift-)** = Moderate directional movement
- **Gray (Fade)** = Momentum exhaustion — potential reversal zone

## How to Trade With It

### Momentum Trading
1. Enter long when bands turn **green** (bullish surge) after a gray fade
2. Enter short when bands turn **red** (bearish surge) after a gray fade
3. **Wider bands = stronger conviction**
4. Set stop-loss beyond the opposite band

### Exhaustion Reversal Trading
1. Watch for bands in **surge** (green/red) with wide expansion
2. When bands start **compressing** and shift to **gray fade**, the move is dying
3. Enter counter-trend at the fade signal, targeting the midline

### Trend Riding
1. In **green/teal drift**: stay long above the EHMA midline
2. In **red/orange drift**: stay short below midline
3. Trail stop-loss to the lower band (longs) or upper band (shorts)
4. Exit when color shifts to **gray**

## Settings Guide
- **EHMA Period** (16): Hull-EMA hybrid period — lower = faster, higher = smoother
- **ATR Period** (14): Volatility lookback for band width
- **Band Width** (1.8): Base multiplier for band distance
- **Momentum Period** (12): Rate-of-change lookback for VNM
- **Surge Threshold** (40): VNM level triggering surge phase
- **Fade Smoothing** (5): Smoothing on VNM — higher = fewer phase flips

## Risk Warning
No indicator guarantees profits. Always use stop-losses and proper position sizing.`,
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

### 2. Shannon Entropy Measurement
Returns are binned into a probability distribution over a rolling window:
- **Formula**: H = -Σ p(x) × log₂(p(x)), normalized to 0–1
- **Entropy = 0**: All returns fall in one bin (perfectly ordered/trending)
- **Entropy = 1**: Returns equally distributed across all bins (maximum randomness)

### 3. Four-Phase Detection System
- **🟣 Plasma** (Aggressive Trend): Low entropy + high displacement + fast momentum
- **🔵 Liquid** (Smooth Trending): Moderate conditions — price flowing directionally
- **🟠 Gaseous** (Chaotic): High entropy + volatile — disordered, unpredictable
- **⚪ Crystalline** (Consolidation): Low entropy + tight range + slow — energy building

### 4. Phase-Adaptive Bands
- **Plasma**: Tight (1.3×) — trailing the strong trend
- **Liquid**: Normal (1.0×) — standard behavior
- **Gaseous**: Wide (1.8×) — accommodating chaos
- **Crystalline**: Compressed (0.6×) — reflecting consolidation

## How to Trade With It

### Phase Transition Trading
1. Watch for **Crystalline → Plasma** transition (consolidation → aggressive trend)
2. Enter in the direction of the Plasma breakout
3. Set stop-loss at the opposite band

### Entropy Divergence
1. Price making new highs but entropy rising = move becoming chaotic
2. Tighten stops or take partial profits

### Crystalline Breakout Preparation
1. Crystalline phase = compressed bands = market coiling
2. Place bracket orders above and below compressed bands
3. Longer Crystalline phases produce larger subsequent moves

## Settings Guide
- **Kalman Gain** (0.05): Process noise — lower = smoother, higher = responsive
- **Entropy Period** (20): Window for Shannon entropy calculation
- **ATR Period** (14): Volatility lookback for base band width
- **Band Width** (2.0): Base multiplier before phase adjustment
- **Phase Smooth** (5): Entropy smoothing — higher = fewer phase transitions

## Risk Warning
No indicator guarantees profits. Always use stop-losses and proper position sizing.`,
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
- **Peak detection**: The lag with the strongest positive correlation reveals the dominant cycle
- **Auto-tuning**: The midline period automatically adjusts to half the dominant cycle (Nyquist-optimal filtering)
- **Result**: A midline that is always in sync with the market's natural rhythm

### 2. Hurst Exponent (Rescaled Range Analysis)
A mathematical measure of long-term memory in time series:
- **H > 0.55 (Persistent)**: Past trends tend to continue — momentum trading works
- **H < 0.45 (Antipersistent)**: Past moves tend to reverse — mean-reversion trading works
- **H ≈ 0.50 (Random)**: No statistical edge — market is efficient

### 3. Regime-Adaptive Bands
- **Persistent regime**: Tight bands (0.8×) — trend-following mode
- **Antipersistent regime**: Wide bands (1.5×) — mean-reversion zones
- **Random regime**: Standard bands (1.0×) — neutral positioning

## How to Trade With It

### Trend Following (Persistent Regime — Blue)
1. When blue, enter in the direction of the midline slope
2. Trail stop-loss to the opposite band
3. Tight bands = high conviction trending

### Mean Reversion (Antipersistent Regime — Amber)
1. When amber, buy at lower band / sell at upper band
2. Target the midline for take-profit
3. Wide bands = strong reversal zones

### Regime Change Trading
1. Gray → Blue = new trend forming, enter breakout direction
2. Blue → Amber = trend dying, prepare for reversals
3. Gray = no edge, reduce size

## Settings Guide
- **Max Cycle Period** (50): Upper bound for cycle scan
- **Hurst Window** (100): R/S analysis lookback
- **ATR Period** (14): Volatility base for bands
- **Band Width** (2.0): Base multiplier before regime adjustment
- **Smoothing** (5): Cycle and Hurst estimate smoothing

## Risk Warning
No indicator guarantees profits. Always use stop-losses and proper position sizing.`,
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
**Titan Pulse Signal** is a premium on-chart overlay that plots a **single intelligent trend line** that flips between support and resistance, powered by Kaufman adaptive mathematics and a built-in signal engine.

The line turns **green when bullish** (dynamic support below price) and **red when bearish** (dynamic resistance above price). At key inflection points, **buy and sell signal markers** appear directly on the chart.

## Three Core Components

### 1. Kaufman Adaptive Moving Average (KAMA) Engine
- In strong trends: speeds up, keeping the line close to price
- In choppy markets: slows down, preventing false signals
- Efficiency Ratio = |Direction| / Volatility over N bars

### 2. ATR-Offset Flip Logic
- Bullish: Line = KAMA - (ATR × Multiplier) → trailing support
- Bearish: Line = KAMA + (ATR × Multiplier) → trailing resistance
- Flips when price crosses the line; ratchets in trend direction only

### 3. Signal Confluence Engine (scored 0-100)
- **Trend Flip** (45 pts): Direction change
- **Momentum Surge** (30 pts): Price accelerates >1.5× ATR from line
- **Squeeze Breakout** (25 pts): ATR expands after contraction
- Strong signals (≥70) show triangle markers, regular (≥40) show circles

## How to Trade
1. **LONG** when line turns green, **SHORT** when red
2. Use the line as your **trailing stop-loss**
3. Strong signal markers = high-conviction entries
4. Squeeze breakout signals = highest-probability setups

## Settings Guide
- **KAMA Period** (10): Efficiency ratio lookback
- **KAMA Fast** (2): Fast smoothing constant
- **KAMA Slow** (30): Slow smoothing constant
- **ATR Period** (14): Volatility lookback
- **ATR Multiplier** (1.5): Line offset distance
- **Squeeze Lookback** (20): Volatility contraction window
- **Signal Threshold** (40): Minimum confluence score

## Risk Warning
No indicator guarantees profits. Always use proper position sizing and risk management.`,
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
**Aurora Cascade Flow** renders **5 adaptive KAMA layers** cascading from fast to slow. Each layer adapts via an efficiency ratio, creating a ribbon that expands during trends and contracts during consolidation.

## How It Works
- **Layer 1** (fastest): Leading edge, reacts first
- **Layer 3** (core): Central reference midline
- **Layer 5** (slowest): Anchor, turns only in firm trends
- **Alignment score (0–5)**: Counts how many layers agree on direction
- Fanned out = strong trend, compressed = squeeze/reversal zone

## How to Trade
1. **Trend entry**: All 5 layers aligned, price above/below all → enter
2. **Compression breakout**: Layers compress → enter when they fan out
3. **Layer bounce**: In trend, price pulls back to L2/L3 → continuation entry
4. **Reversal**: L1 crosses L3 against trend → early reversal signal

## Settings
- **ER Period** (10): Efficiency ratio lookback
- **Fast SC** (2): Fast smoothing constant
- **Slow Min/Max** (10/40): Range for 5 layers
- **Smooth Factor** (3): Extra noise reduction on faster layers

## Risk Warning
No indicator guarantees profits. Always use stop-losses and proper position sizing.`,
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

### McGinley Dynamic Core
Unlike standard MAs, the McGinley Dynamic self-adjusts its speed based on price-to-MA ratio. It accelerates when price moves away and decelerates when price is near.

### Shadow Trail (Stop Level)
- In **bullish** mode: shadow sits below the trail at ATR × multiplier distance
- In **bearish** mode: shadow sits above the trail at ATR × multiplier distance

### Signal Markers
- **BULL** (green arrow): Direction flips from bearish to bullish
- **BEAR** (red arrow): Direction flips from bullish to bearish
- **BREAK** (yellow circle): Line unfreezes after a stepping period — potential breakout entry

## How to Trade
1. Wait for a **BULL** or **BEAR** flip signal, enter in signal direction
2. Place stop-loss at the shadow trail level
3. Watch for **BREAK** markers after flat periods for breakout entries
4. Avoid trading when the trail is stepping (flat) — market is choppy

## Settings
- **McGinley Period** (14): Smoothing period for the core trend line
- **FD Period** (30): Lookback for fractal dimension calculation
- **FD Threshold** (1.5): Above = choppy (stepping), below = trending (flowing)
- **ATR Period** (14): ATR lookback for shadow trail offset
- **ATR Multiplier** (1.8): Distance of shadow from trail

## Risk Warning
No indicator guarantees profits. Always use proper position sizing and risk management.`,
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
**Wraith Convergence Engine (WCE)** runs **4 different adaptive trend algorithms simultaneously** and fuses them into a single **consensus line**. It measures the agreement level between the methods and fires trade signals only when all converge.

## The 4 Methods
1. **McGinley Dynamic** — Self-adjusting MA
2. **Ehlers 2-Pole Super Smoother** — DSP noise filter with minimal lag
3. **Kaufman Adaptive MA (KAMA)** — Efficiency-ratio driven filter
4. **Hull Moving Average (HMA)** — Ultra-responsive weighted MA

## Signals
- **CONV ▲**: All 4 methods bullish + high convergence
- **CONV ▼**: All 4 methods bearish + high convergence
- **DIV**: Methods were converged but started disagreeing

## Settings
- **Period** (20): Base lookback period
- **KAMA Fast** (2): Fast smoothing constant
- **KAMA Slow** (30): Slow smoothing constant
- **Convergence Threshold** (70): Minimum score for CONV signals

No indicator guarantees profits. Always use proper position sizing and risk management.`,
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
**Flux Momentum Trail** renders a single continuous line with **per-bar dynamic color grading** based on a composite momentum score (-100 to +100). Every bar gets its own color from a spectrum — making trend strength instantly visible.

## How It Works
- **DEMA trail** for responsive, smooth price tracking
- **Composite momentum** from trend distance + ROC + volume boost
- **9-color spectrum**: deep green → bright green → teal → gray → orange → light red → bright red → deep red
- **SURGE markers** when momentum breaks the threshold — explosive move starting
- **FADE markers** when momentum collapses — trend exhaustion warning

## How to Trade
1. **Trend follow**: Enter when trail turns bright/deep green (long) or red (short)
2. **SURGE entry**: Enter on SURGE markers — marks start of explosive moves
3. **FADE exit**: Tighten stops on FADE — momentum dying
4. **Color reading**: Watch gradient shifts in real-time for early warnings

## Settings
- **Fast Period** (8): DEMA responsiveness
- **Slow Period** (21): Momentum reference baseline
- **ROC Period** (12): Price velocity lookback
- **ATR Period** (14): Volatility normalization
- **Surge Threshold** (70): Minimum for SURGE signals

## Risk Warning
No indicator guarantees profits. Always use stop-losses and proper position sizing.`,
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
    "Multi-factor confluence signal engine. Runs 4 independent detectors and only fires when multiple factors align for high-conviction entries.",
  fullDescription: `# Apex Predator Signal

## Overview
**Apex Predator Signal** combines **4 independent detection systems** running in parallel. Signals are rare but high-conviction because they require multi-factor confirmation.

## 4 Independent Detectors
1. **Trend Flip**: Zero-Lag EMA direction change
2. **Momentum Surge**: ROC exceeding dynamic threshold
3. **Volatility Expansion**: ATR ratio detecting breakout conditions
4. **Volume Confirmation**: Volume spike above rolling average

## Signal Types
- **APEX** (3–4 confluence): Full-strength entry signal
- **STALK** (2 confluence): Moderate setup forming

## Settings
- **ZLEMA Period** (21), **ROC Period** (12), **ATR Period** (14), **Volume Period** (20), **Min Confluence** (2)

No indicator guarantees profits. Always use stop-losses and proper position sizing.`,
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
  tags: ["signal", "confluence", "multi-factor", "premium", "overlay", "predator", "entry"],
  riskLevel: "medium",
};

const PHANTOM_DIVERGENCE_TRACKER: Partial<IMarketplaceItem> = {
  name: "Phantom Divergence Tracker",
  slug: "phantom-divergence-tracker",
  shortDescription:
    "Dual-line overlay comparing smoothed price vs volume-adjusted price. Divergence reveals hidden reversals; convergence confirms trends.",
  fullDescription: `# Phantom Divergence Tracker

## Overview
Two independent lines: **Price Line** (smoothed close) vs **Volume Line** (volume-adjusted price). Divergence = price moving without conviction. Convergence = volume-backed trend.

## How to Trade
1. **Lines spread apart** → reversal warning (price on thin volume)
2. **Lines converge** → trend confirmation (volume backs the move)
3. **DIV markers** → critical divergence, prepare for reversal
4. **CONV markers** → re-convergence, trend resuming

## Settings
- **Smooth Period** (21), **Vol Period** (20), **ATR Period** (14), **Div Threshold** (60)

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
    description: "Dual-line price vs volume-adjusted divergence tracker",
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
  tags: ["divergence", "volume", "dual-line", "premium", "overlay", "convergence", "reversal"],
  riskLevel: "medium",
};

const CHAOS_SENTINEL: Partial<IMarketplaceItem> = {
  name: "Chaos Sentinel",
  slug: "chaos-sentinel",
  shortDescription:
    "Chaos theory overlay using Lyapunov exponent to detect orderly vs chaotic market regimes. Attractor line with regime-colored segments and transition signals.",
  fullDescription: `# Chaos Sentinel

## Overview
**Chaos Sentinel** applies chaos theory mathematics to detect whether the market is in an orderly (predictable) or chaotic (random) state using the Lyapunov exponent.

## How It Works
- **Low Lyapunov**: Market is orderly — trends persist, signals reliable
- **High Lyapunov**: Market is chaotic — random noise dominates

## Three Regimes
- **Order** (blue): Ideal for trend-following
- **Transition** (yellow): Reduce position size
- **Chaos** (red): Avoid trading or use mean-reversion only

## Settings
- **Attractor Period** (21): DEMA period for equilibrium line
- **Lyapunov Period** (14): Lookback for chaos measurement
- **Smoothing** (5): Noise reduction
- **Chaos Threshold** (50): Sensitivity (0-100)

No indicator guarantees profits. Always use proper risk management.`,
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
    description: "Chaos theory overlay with Lyapunov exponent regime detection",
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
  tags: ["chaos", "lyapunov", "regime", "premium", "overlay", "attractor", "order", "stability"],
  riskLevel: "medium",
};

const HELIX_PHASE_ENGINE: Partial<IMarketplaceItem> = {
  name: "Helix Phase Engine",
  slug: "helix-phase-engine",
  shortDescription:
    "Hilbert Transform-based phase analysis overlay with adaptive lead line, amplitude envelope, and velocity regime coloring.",
  fullDescription: `# Helix Phase Engine

## Overview
**Helix Phase Engine** uses the **Hilbert Transform** from signal processing to extract instantaneous phase and amplitude from price cycles, creating a leading adaptive line.

## How It Works
- **Hilbert Transform**: Extracts analytic signal → instantaneous amplitude and phase
- **Phase-Adaptive Lead Line**: MA length adapts to detected cycle, naturally leading price at turns
- **Phase Velocity Regimes**: Trending (cyan), Consolidation (gray), Reversal (magenta)

## Signals
- **LEAD ▲ / ▼**: Phase line anticipates a turn with high velocity
- **SYNC**: Cycle compression — expect breakout

## Settings
- **Detrend Period** (20): DEMA period for cycle extraction
- **Hilbert Length** (7): FIR filter length
- **Amplitude Multiplier** (1.5): Envelope width
- **Velocity Smooth** (5): Phase velocity smoothing
- **Lead Sensitivity** (55): Regime threshold (0-100)

No indicator guarantees profits. Always use proper risk management.`,
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
    description: "Hilbert Transform phase analysis with adaptive lead line and velocity regime coloring",
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
  tags: ["hilbert", "phase", "signal-processing", "premium", "overlay", "adaptive", "leading", "cycle"],
  riskLevel: "medium",
};

const PRISM_WAVELET_CASCADE: Partial<IMarketplaceItem> = {
  name: "Prism Wavelet Cascade",
  slug: "prism-wavelet-cascade",
  shortDescription:
    "Multi-resolution wavelet decomposition that splits price into 4 frequency layers with alignment scoring and convergence/divergence signals.",
  fullDescription: `# Prism Wavelet Cascade\n\nHaar Wavelet Decomposition splits price into 4 distinct frequency layers — from fast noise to slow trend. A stunning rainbow cascade of lines shows when all market timeframes align (high-probability entry) or diverge (exit/avoid).\n\n## Layers\n- Layer 1 (Cyan): Fastest micro-movements\n- Layer 2 (Blue): Short swings\n- Layer 3 (Purple): Intermediate cycles\n- Layer 4 (Magenta): Underlying trend\n\n## Signals\n- ALIGN: All layers converge → strong trend entry\n- SPLIT: Layers diverge → exit or reduce size`,
  category: "indicator",
  subcategory: "premium",
  pricingModel: "one_time",
  price: 39.99,
  currency: "USD",
  status: "active",
  isPublished: true,
  indicatorType: "prism_wavelet_cascade",
  iconName: "Layers",
  codeTemplate: JSON.stringify({
    type: "prism_wavelet_cascade",
    displayType: "overlay",
    description: "Haar wavelet decomposition into 4 frequency layers with spectral alignment scoring",
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
  tags: ["wavelet", "multi-resolution", "frequency", "premium", "overlay", "cascade", "alignment", "spectral"],
  riskLevel: "medium",
};

const MIRAGE_DEPTH_SCANNER: Partial<IMarketplaceItem> = {
  name: "Mirage Depth Scanner",
  slug: "mirage-depth-scanner",
  shortDescription:
    "Singular Spectrum Analysis overlay — extracts true trend via eigendecomposition, pulsating depth corridor, emerge/submerge regime signals.",
  fullDescription: "# Mirage Depth Scanner\n\nUses **Singular Spectrum Analysis (SSA)** to decompose price into trend, oscillatory, and noise components via eigendecomposition. The **Depth Line** shows the true extracted trend (gold/emerald for bull, crimson/violet for bear). The **Signal Corridor** visualizes oscillatory cycle amplitude. **EMERGE** signals when trend surfaces from noise; **SUBMERGE** when it weakens.\n\n## How to Trade\n1. Follow Depth Line direction when depth score is high\n2. EMERGE = strong entry, SUBMERGE = exit/reduce\n3. Corridor width indicates oscillation strength\n4. Avoid trading in surface regime (noise dominates)",
  category: "indicator",
  subcategory: "premium",
  price: 69.99,
  currency: "USD",
  status: "active",
  isPublished: true,
  isFeatured: true,
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
  tags: ["ssa", "eigendecomposition", "trend-extraction", "premium", "overlay", "depth", "corridor", "regime"],
  riskLevel: "medium",
};

const QUANTUM_DRIFT_MAPPER: Partial<IMarketplaceItem> = {
  name: "Quantum Drift Mapper",
  slug: "quantum-drift-mapper",
  shortDescription:
    "Detrended Fluctuation Analysis overlay that measures long-range price correlations to predict trending vs mean-reverting regimes. Adaptive drift line with persistence corridor.",
  fullDescription: `# Quantum Drift Mapper\n\n## Overview\n**Quantum Drift Mapper** applies **Detrended Fluctuation Analysis (DFA)** — a technique from statistical physics — to measure long-range correlations in price data.\n\n## How It Works\n- **α > 0.6** (Persistent): Trending market — momentum continues\n- **α ≈ 0.5** (Random Walk): Neutral\n- **α < 0.4** (Anti-Persistent): Mean-reverting market — price snaps back\n\n## Visual Guide\n- **Electric blue/white** = Persistent (trending)\n- **Amber/orange** = Anti-persistent (mean-reverting)\n- **DRIFT ▲**: Trend starting | **SNAP ▼**: Mean-reversion imminent`,
  category: "indicator",
  subcategory: "premium",
  price: 49.99,
  status: "active",
  isPublished: true,
  indicatorType: "quantum_drift_mapper",
  iconName: "Zap",
  codeTemplate: JSON.stringify({
    type: "quantum_drift_mapper",
    displayType: "overlay",
    description: "DFA-based long-range correlation analysis with adaptive drift line and persistence corridor",
  }),
  defaultSettings: {
    dfaWindow: 30,
    dfaOrder: 2,
    corridorMultiplier: 1.5,
    persistenceSmooth: 5,
    driftSensitivity: 60,
    color: "#4fc3f7",
    lineWidth: 3,
  },
  supportedAssets: [],
  tags: ["dfa", "persistence", "correlation", "premium", "overlay", "adaptive", "regime", "mean-reversion", "trending", "statistical-physics"],
  riskLevel: "medium",
};

const SOVEREIGN_GRAVITY_ARC: Partial<IMarketplaceItem> = {
  name: "Sovereign Gravity Arc",
  slug: "sovereign-gravity-arc",
  shortDescription:
    "Volume-weighted gravity field with orbital mechanics — maps price into orbital and escape states, firing high-conviction breakout and capture signals.",
  fullDescription: `# Sovereign Gravity Arc\n\n## Overview\n**Sovereign Gravity Arc** applies orbital mechanics and gravitational physics to price action. It computes a **Volume-Weighted Gravity Center** — the price level with the highest transactional mass — and wraps it in an **Orbital Arc Band** whose width adapts to real volatility (ATR).\n\n## State Classification\n- 🟣 **Orbital** — price orbiting the gravity center (consolidation)\n- ⚡ **Escape Up** — breakout above the arc with high radial velocity\n- ⚡ **Escape Down** — breakdown below the arc with high radial velocity\n- 🔵 **Capturing** — escaped price returning to orbit (reversal warning)\n\n## Signals\n- **ESCAPE ↑ / ↓** arrows: First bar of an escape event — high-conviction breakout entry\n- **ORBIT**: Price recaptured — potential reversal or pullback\n\n## Visual Guide\n- Deep violet center line → Orbital state (slow velocity)\n- Bright magenta → white center line → High velocity, approaching escape\n- Dashed violet arcs → Orbital boundary (upper and lower)\n\n## How to Trade\n1. **ESCAPE ↑** arrow: Enter long, stop below the lower arc\n2. **ESCAPE ↓** arrow: Enter short, stop above the upper arc\n3. **ORBIT** marker: Close breakout trade or fade extremes\n4. **Arc width**: Dynamic stop-loss guide — outside arc = outside gravity`,
  category: "indicator",
  subcategory: "premium",
  price: 54.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "sovereign_gravity_arc",
  iconName: "Globe2",
  codeTemplate: JSON.stringify({
    type: "sovereign_gravity_arc",
    displayType: "overlay",
    description: "Volume-weighted gravity field with orbital mechanics — detects escape breakouts and orbital capture reversals",
  }),
  defaultSettings: {
    gravityWindow: 30,
    orbitalRadius: 2.0,
    velocitySmooth: 5,
    escapeMultiplier: 1.8,
    color: "#ce93d8",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["gravity", "orbital", "volume-weighted", "breakout", "premium", "overlay", "adaptive", "physics", "momentum", "escape"],
  riskLevel: "medium",
};

const SOLARIS_TREND_ENGINE: Partial<IMarketplaceItem> = {
  name: "Solaris Trend Engine",
  slug: "solaris-trend-engine",
  shortDescription:
    "Hybrid composite overlay fusing KAMA + Supertrend + ADX + Parabolic SAR + EMA Cross into a single adaptive trend system with FUSION signals and SAR acceleration dots.",
  fullDescription: `# Solaris Trend Engine\n\n## Overview\n**Solaris Trend Engine** fuses five institutional-grade trend systems into one beautiful overlay: KAMA adaptive spine, Supertrend bands, ADX strength gating, Parabolic SAR dots, and EMA cross confirmation.\n\n## Signal Types\n- **FUSION BULL ▲**: All components aligned bullish + ADX confirmed — enter long\n- **FUSION BEAR ▼**: All components aligned bearish + ADX confirmed — enter short\n\n## Visual Guide\n- 🟡 Gold Solar Core → Strong bull trend\n- 🔴 Crimson Solar Core → Strong bear trend\n- ⚪ Silver Solar Core → Neutral/choppy\n- SAR dots above price → deceleration/exit warning\n- SAR dots below price → acceleration/hold signal\n\n## How to Trade\n1. Enter on FUSION signal, stop beyond Supertrend band\n2. Trail stops with SAR dot migration\n3. Ignore signals when Solar Core is silver (ADX < threshold)`,
  category: "indicator",
  subcategory: "premium",
  price: 59.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "solaris_trend_engine",
  iconName: "Sun",
  codeTemplate: JSON.stringify({
    type: "solaris_trend_engine",
    displayType: "overlay",
    description: "Hybrid composite: KAMA + Supertrend + ADX + Parabolic SAR + EMA cross — five fusion engines in one chart overlay",
  }),
  defaultSettings: {
    kamaFast: 2,
    kamaSlow: 30,
    atrPeriod: 14,
    supertrendMult: 3.0,
    adxPeriod: 14,
    adxThreshold: 25,
    color: "#ffd700",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["kama", "supertrend", "adx", "parabolic-sar", "ema-cross", "hybrid", "composite", "trend", "premium", "overlay", "fusion", "adaptive"],
  riskLevel: "medium",
};

const STELLAR_CONFLUENCE_RIBBON: Partial<IMarketplaceItem> = {
  name: "Stellar Confluence Ribbon",
  slug: "stellar-confluence-ribbon",
  shortDescription:
    "Hybrid overlay blending KAMA, Hull MA and McGinley Dynamic into one glowing adaptive ribbon with ATR bands, confluence scoring, node markers and STELLAR fusion signals.",
  fullDescription: `# Stellar Confluence Ribbon (SCR)\n\n## Overview\n**Stellar Confluence Ribbon** weaves KAMA, Hull MA, and McGinley Dynamic into a single inverse-distance weighted core line, surrounded by inner (1.5 ATR) and outer (2.8 ATR) adaptive arcs. A real-time Confluence Score (0–100) measures how aligned all three MAs are with price direction, and glowing node markers appear at peak agreement moments.\n\n## Signal Types\n- **✦ STELLAR BULL**: All 3 MAs aligned bullish + Confluence Score ≥ threshold → enter long\n- **✦ STELLAR BEAR**: All 3 MAs aligned bearish + Confluence Score ≥ threshold → enter short\n\n## Visual Guide\n- 💎 Neon Cyan core → strong bull trend\n- 🔴 Hot Crimson core → strong bear trend\n- ⚪ Silver core → neutral/wait\n- Node dots → peak confluence, best add-to-position moments\n- Inner ribbon → active trend zone\n- Outer arc → extended / extreme zone\n\n## How to Trade\n1. Enter on STELLAR signal, stop beyond outer arc\n2. Trail stop to inner ribbon as profit builds\n3. Add on node dot appearances during trend\n4. Avoid new entries when core line is silver`,
  category: "indicator",
  subcategory: "premium",
  price: 64.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "stellar_confluence_ribbon",
  iconName: "Sparkles",
  codeTemplate: JSON.stringify({
    type: "stellar_confluence_ribbon",
    displayType: "overlay",
    description: "Hybrid: KAMA + Hull MA + McGinley Dynamic with ATR ribbon, confluence scoring, node markers and STELLAR signals",
  }),
  defaultSettings: {
    blendPeriod: 21,
    atrPeriod: 14,
    innerMult: 1.5,
    outerMult: 2.8,
    confluenceThreshold: 70,
    nodeThreshold: 80,
    color: "#00f0ff",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["kama", "hull-ma", "mcginley", "hybrid", "composite", "trend", "ribbon", "premium", "overlay", "adaptive", "confluence", "multi-ma", "node"],
  riskLevel: "medium",
};

const KINETIC_PRESSURE_ZONES: Partial<IMarketplaceItem> = {
  name: "Kinetic Pressure Zones",
  slug: "kinetic-pressure-zones",
  shortDescription:
    "Five momentum oscillators (RSI, Stochastic, CCI, Williams %R, ROC) fused into a composite score that paints institutional-grade demand and supply zone bands directly on the chart.",
  fullDescription: `# Kinetic Pressure Zones (KPZ)\n\n## Overview\n**Kinetic Pressure Zones** translates five elite momentum oscillators into a single on-chart zone-band overlay. It fuses RSI, Stochastic %K, CCI, Williams %R, and Rate of Change into a single Kinetic Momentum Score (0–100), then maps that score to horizontal price zone bands — demand zones (cyan/teal) where momentum was exhausted bearishly, and supply zones (violet/purple) where momentum was exhausted bullishly.\n\n## Zone Formation\n- **Demand Zones** (teal): Form when Kinetic Score drops below oversold — price level becomes a demand band\n- **Supply Zones** (violet): Form when Kinetic Score rises above overbought — price level becomes a supply band\n- **Zone Strength %**: How extreme the momentum reading was at zone creation\n\n## KINETIC Signals\n- **⚡ KINETIC BULL ▲**: Score crosses midline upward after oversold → enter long\n- **⚡ KINETIC BEAR ▼**: Score crosses midline downward after overbought → enter short\n\n## How to Trade\n1. Zone bounce + KINETIC BULL → long, stop below zone lower\n2. Zone resistance + KINETIC BEAR → short, stop above zone upper\n3. Zone break with no reversal → zone flip\n4. Prioritize zones with strength % > 60`,
  category: "indicator",
  subcategory: "premium",
  price: 59.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "kinetic_pressure_zones",
  iconName: "Zap",
  codeTemplate: JSON.stringify({
    type: "kinetic_pressure_zones",
    displayType: "overlay",
    description: "RSI + Stoch + CCI + Williams %R + ROC fusion mapped to on-chart demand/supply zone bands",
  }),
  defaultSettings: {
    period: 14,
    rocPeriod: 10,
    atrPeriod: 14,
    zoneWidthMult: 1.2,
    oversoldLevel: 30,
    overboughtLevel: 70,
    color: "#00e5ff",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["rsi", "stochastic", "cci", "williams", "roc", "momentum", "zones", "demand", "supply", "hybrid", "composite", "premium", "overlay"],
  riskLevel: "medium",
};

const NOVA_RESONANCE_FIELD: Partial<IMarketplaceItem> = {
  name: "Nova Resonance Field",
  slug: "nova-resonance-field",
  shortDescription:
    "Six momentum oscillators (RSI, Stoch, CCI, Williams %R, Momentum, ROC) fused into a composite score that maps back to price space as a glowing echo line, with on-chart divergence detection.",
  fullDescription: `# Nova Resonance Field (NRF)\n\n## Overview\n**Nova Resonance Field** maps six momentum oscillators back into price space as a **Resonance Echo Line** — floats above price in bullish momentum surges, below in bearish collapses.\n\n## The Echo Formula\nEcho = EMA(close) + ((ResonanceScore − 50) / 50) × ATR × Sensitivity\n\n## Signals\n- **🌟 NOVA BULL ▲**: All 6 engines crossing nova threshold → enter long\n- **🌟 NOVA BEAR ▼**: All 6 engines collapsing → enter short\n- **⚡ ECHO CROSS ▲/▼**: Echo Line crosses Signal Line → momentum acceleration\n- **💜 BULL DIV ◆**: Price at new low but momentum higher — hidden strength\n- **🟣 BEAR DIV ◆**: Price at new high but momentum lower — hidden weakness\n\n## Visual Guide\n- 🌟 Amber Echo: NOVA BULL (score ≥ 70)\n- 🟢 Green Echo: Building bull\n- 🔴 Crimson Echo: NOVA BEAR (score ≤ 30)\n- 🟠 Orange Echo: Building bear\n- ⚪ Silver Echo: Neutral\n- 💜 Violet Echo: Divergence detected\n\n## Risk Warning\nNo indicator guarantees profits. This indicator is a decision-support tool. Always use proper risk management and never risk more than you can afford to lose.`,
  category: "indicator",
  subcategory: "premium",
  price: 62.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "nova_resonance_field",
  iconName: "Waves",
  codeTemplate: JSON.stringify({
    type: "nova_resonance_field",
    displayType: "overlay",
    description: "Six-oscillator momentum composite mapped to price space as a resonance echo line with divergence detection",
  }),
  defaultSettings: {
    period: 14,
    sensitivity: 2.0,
    signalPeriod: 9,
    novaThreshold: 70,
    divergenceLookback: 20,
    color: "#ff9800",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["rsi", "stochastic", "cci", "williams", "momentum", "roc", "echo", "divergence", "resonance", "hybrid", "composite", "premium", "overlay"],
  riskLevel: "medium",
};

const RADIANT_FIBONACCI_MATRIX: Partial<IMarketplaceItem> = {
  name: "Radiant Fibonacci Matrix",
  slug: "radiant-fibonacci-matrix",
  shortDescription:
    "Auto-Fibonacci indicator detecting swing highs/lows and drawing all key Fib levels (23.6%–161.8%) on price with BOUNCE and BREAK signals at key ratios.",
  fullDescription: `# Radiant Fibonacci Matrix (RFM)\n\n## Overview\n**Radiant Fibonacci Matrix** auto-detects the dominant price swing using a rolling O(n) algorithm and paints all nine Fibonacci levels directly on your chart.\n\n## Levels\n- **0%** Steel gray — swing low\n- **23.6%** Cyan — shallow retracement\n- **38.2%** Blue — moderate pullback\n- **50%** Purple — psychological midpoint\n- **61.8%** 🌟 GOLD (thick) — Golden Ratio, highest-probability bounce zone\n- **78.6%** Orange — deep retracement\n- **100%** Steel gray — swing high\n- **127.2%** Light gold (dashed) — conservative extension target\n- **161.8%** 🌟 Gold — Golden Extension (primary price target)\n\n## Dynamic Swing\nThe indicator uses an O(n) monotonic deque to continuously detect the rolling swing high and low. Direction auto-adapts: bullish swing = extensions above HH; bearish swing = extensions below LL.\n\n## Signals\n- **BREAK ▲/▼**: Price closes through a Fib level (large arrow)\n- **BOUNCE ▲/▼**: Price touches a Fib level and reverses (small arrow)\nAll signals include the exact Fib label (e.g. "BOUNCE ▲ 61.8%").\n\n## Risk Warning\nNo indicator guarantees profits. This indicator is a decision-support tool. Always use proper risk management and never risk more than you can afford to lose.`,
  category: "indicator",
  subcategory: "premium",
  price: 149.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "radiant_fibonacci_matrix",
  iconName: "TrendingUp",
  codeTemplate: JSON.stringify({
    type: "radiant_fibonacci_matrix",
    displayType: "overlay",
    description: "Dynamic auto-Fibonacci retracement (23.6%–78.6%) and extensions (127.2%, 161.8%) with rolling swing detection",
  }),
  defaultSettings: {
    lookback: 55,
    atrPeriod: 14,
    color: "#ffd700",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["fibonacci", "retracement", "extension", "golden-ratio", "swing", "support", "resistance", "auto-fib", "premium", "overlay"],
  riskLevel: "medium",
};

const SPECTRE_LIQUIDITY_MATRIX: Partial<IMarketplaceItem> = {
  name: "Spectre Liquidity Matrix",
  slug: "spectre-liquidity-matrix",
  shortDescription:
    "Smart Money indicator mapping Order Blocks, Fair Value Gaps, BOS/CHoCH structure and Liquidity Pools on-chart with a Volume-Weighted Bias Line.",
  fullDescription: `# Spectre Liquidity Matrix (SLM)\n\n## Overview\n**Spectre Liquidity Matrix** maps Order Blocks, FVGs, BOS/CHoCH structural signals and Liquidity Pools directly onto your price chart using Smart Money Concepts.\n\n## Components\n- **📦 Order Blocks**: Last opposing candle before an institutional impulse move (cyan = bullish OB, magenta = bearish OB)\n- **⬛ Fair Value Gaps**: 3-candle price imbalance zones that markets tend to revisit and fill\n- **🔴 BOS/CHoCH**: Break of Structure (trend continuation) and Change of Character (trend reversal) labels at structural levels\n- **💧 Liquidity Pools**: Gold dashed lines at un-swept swing highs/lows where stop-losses cluster\n- **📊 Volume-Weighted Bias Line**: VWAP-EMA hybrid line colored cyan (bullish) or magenta (bearish)\n\n## How to Trade\n1. Enter at unmitigated Order Blocks in the direction of the Bias Line\n2. Use FVG zones as pullback entry targets\n3. CHoCH signals mark early trend reversals — enter after BOS confirmation\n4. Trade liquidity sweeps: when price spikes through a gold line and reverses, that is an institutional stop hunt\n\n## Risk Warning\nNo indicator guarantees profits. This indicator is a decision-support tool. Always use proper risk management and never risk more than you can afford to lose.`,
  category: "indicator",
  subcategory: "premium",
  price: 179.99,
  status: "active",
  isPublished: true,
  isFeatured: true,
  indicatorType: "spectre_liquidity_matrix",
  iconName: "Layers",
  codeTemplate: JSON.stringify({
    type: "spectre_liquidity_matrix",
    displayType: "overlay",
    description: "Smart Money: Order Blocks, FVGs, BOS/CHoCH, Liquidity Pools, Volume-Weighted Bias Line",
  }),
  defaultSettings: {
    swingLookback: 5,
    obStrength: 1.5,
    period: 20,
    maxFVGAge: 50,
    color: "#00e5ff",
    lineWidth: 2,
  },
  supportedAssets: [],
  tags: ["order-blocks", "fair-value-gap", "fvg", "bos", "choch", "liquidity", "smart-money", "institutional", "smc", "market-structure", "premium", "overlay"],
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
  QUANTUM_DRIFT_MAPPER,
  SOVEREIGN_GRAVITY_ARC,
  SOLARIS_TREND_ENGINE,
  STELLAR_CONFLUENCE_RIBBON,
  KINETIC_PRESSURE_ZONES,
  NOVA_RESONANCE_FIELD,
  SPECTRE_LIQUIDITY_MATRIX,
  RADIANT_FIBONACCI_MATRIX,
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
// HELPER: Backfill imageData to DB from disk (for multi-server persistence)
// ============================================================================

async function backfillImageToDb(slug: string, imageUrl: string | undefined): Promise<void> {
  if (!imageUrl) return;

  // Check if the item already has imageData
  const existing = await MarketplaceItem.findOne({ slug }).select("+imageData").lean() as any;
  if (existing?.imageData) return; // Already has image in DB

  // Try to find the image file on disk
  const urlPath = imageUrl.split("?")[0];
  const filename = urlPath.split("/").pop();
  if (!filename) return;

  const cwd = process.cwd();
  const searchDirs = [
    path.join(cwd, "public", "assets", "marketplace"),
    path.join(cwd, "public", "uploads", "marketplace"),
    path.join(cwd, "..", "..", "public", "assets", "marketplace"),
    path.join(cwd, "..", "..", "public", "uploads", "marketplace"),
  ];

  for (const dir of searchDirs) {
    const filePath = path.join(dir, filename);
    try {
      await access(filePath, constants.R_OK);
      const imgBuffer = await readFile(filePath);
      const base64Data = imgBuffer.toString("base64");
      await MarketplaceItem.updateOne(
        { slug },
        { $set: { imageData: base64Data, imageContentType: "image/webp" } },
      );
      console.log(`  💾 [Seed] Backfilled image to DB for "${slug}" (${Math.round(base64Data.length / 1024)}KB)`);
      return;
    } catch {
      // File not found at this path, try next
    }
  }
}

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
        // Backfill image to DB if on disk and not yet in DB
        await backfillImageToDb(itemData.slug, existing.imageUrl || itemData.imageUrl).catch(() => {});
        continue;
      }

      const newItem = await MarketplaceItem.create({
        ...itemData,
        createdBy: adminId,
      });
      result.created++;
      // Backfill image to DB if on disk
      await backfillImageToDb(itemData.slug, newItem.imageUrl || itemData.imageUrl).catch(() => {});
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
