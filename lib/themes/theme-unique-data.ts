// Reason: Every theme needs unique icons, hero text style, and content so that
// switching templates produces a completely different look AND feel — not just colors.
// This map is merged into allThemes at export time via enrichThemes().

export interface ThemeUniqueEntry {
  icons: { trophy: string; battle: string; users: string; currency: string; power: string; achievement: string; stats: string; special: string };
  hero: { titlePrefix: string; ctaIcon: string };
  content: { heroTitle: string; heroSubtitle: string; heroDescription: string; ctaPrimaryText: string; ctaSecondaryText: string };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const themeUniqueData: Record<string, ThemeUniqueEntry> = {
  // ── Gaming ───────────────────────────────────────────────────────────────
  "gaming-neon": {
    icons: { trophy: "🎯", battle: "🎮", users: "👾", currency: "💰", power: "⚡", achievement: "🏆", stats: "📊", special: "🕹️" },
    hero: { titlePrefix: "🎯", ctaIcon: "🕹️" },
    content: { heroTitle: "GAME ON. TRADE HARD.", heroSubtitle: "Where gamers become traders", heroDescription: "Level up your trading game in the ultimate neon-lit competitive arena. Battle other players, climb leaderboards, and cash out real profits.", ctaPrimaryText: "Start Gaming", ctaSecondaryText: "View Arena" },
  },
  "retro-arcade": {
    icons: { trophy: "👾", battle: "🕹️", users: "🎮", currency: "🪙", power: "🔥", achievement: "🏅", stats: "📟", special: "🎰" },
    hero: { titlePrefix: "👾", ctaIcon: "🕹️" },
    content: { heroTitle: "INSERT COIN. WIN BIG.", heroSubtitle: "Pixel-perfect precision trading", heroDescription: "Press start on your trading career. Every trade is a level, every profit is a high score. Retro vibes, real money.", ctaPrimaryText: "Insert Coin", ctaSecondaryText: "View Leaderboard" },
  },
  "rgb-gaming": {
    icons: { trophy: "💠", battle: "🎯", users: "👥", currency: "💲", power: "⚡", achievement: "🎖️", stats: "📈", special: "🌈" },
    hero: { titlePrefix: "💠", ctaIcon: "🌈" },
    content: { heroTitle: "RGB YOUR PORTFOLIO", heroSubtitle: "High-performance trading rig", heroDescription: "Overclock your portfolio with RGB-powered competitions. Max frames, max profits, maximum adrenaline.", ctaPrimaryText: "Overclock Now", ctaSecondaryText: "System Specs" },
  },
  "fire-storm": {
    icons: { trophy: "🔥", battle: "💥", users: "🔱", currency: "💰", power: "⚡", achievement: "🏆", stats: "📊", special: "🌋" },
    hero: { titlePrefix: "🔥", ctaIcon: "💥" },
    content: { heroTitle: "BURN THE MARKETS DOWN", heroSubtitle: "Ignite your trading fury", heroDescription: "Enter the inferno. Every trade is a firestorm, every profit fuels the blaze. Only the fearless survive.", ctaPrimaryText: "Light the Fuse", ctaSecondaryText: "View Flames" },
  },
  "neon-pink": {
    icons: { trophy: "💗", battle: "🎯", users: "👗", currency: "💎", power: "✨", achievement: "🏆", stats: "📊", special: "🌸" },
    hero: { titlePrefix: "💗", ctaIcon: "🌸" },
    content: { heroTitle: "GLOW DIFFERENT", heroSubtitle: "Pink neon trading excellence", heroDescription: "Stand out from the crowd in a neon-lit world where boldness is rewarded and conformity loses.", ctaPrimaryText: "Glow Up", ctaSecondaryText: "Explore" },
  },
  "matrix": {
    icons: { trophy: "🖥️", battle: "💊", users: "👤", currency: "₿", power: "🔋", achievement: "🏆", stats: "📊", special: "🔢" },
    hero: { titlePrefix: "🖥️", ctaIcon: "💊" },
    content: { heroTitle: "SEE THE CODE BEHIND THE MARKETS", heroSubtitle: "Take the green pill", heroDescription: "Wake up. The markets are a simulation. Those who see the code profit. Those who don't, get liquidated.", ctaPrimaryText: "Enter the Matrix", ctaSecondaryText: "Red or Green?" },
  },
  "volcanic": {
    icons: { trophy: "🌋", battle: "💥", users: "🔥", currency: "💰", power: "⚡", achievement: "🏆", stats: "📊", special: "🗻" },
    hero: { titlePrefix: "🌋", ctaIcon: "💥" },
    content: { heroTitle: "ERUPT YOUR PROFITS", heroSubtitle: "Molten markets. White-hot gains.", heroDescription: "Trade on the edge of the volcano. The lava flows, the pressure builds, and when it erupts — you cash in.", ctaPrimaryText: "Ignite", ctaSecondaryText: "View Eruptions" },
  },
  "neon-tokyo": {
    icons: { trophy: "🗼", battle: "🎌", users: "👹", currency: "💴", power: "⚡", achievement: "🏆", stats: "📊", special: "🌃" },
    hero: { titlePrefix: "🗼", ctaIcon: "🎌" },
    content: { heroTitle: "TRADE LIKE TOKYO NEVER SLEEPS", heroSubtitle: "Neon streets. Electric profits.", heroDescription: "Navigate the glowing alleyways of digital finance. In Tokyo's neon jungle, the bold eat first.", ctaPrimaryText: "Enter Tokyo", ctaSecondaryText: "Night Market" },
  },
  "blood-moon": {
    icons: { trophy: "🌑", battle: "💀", users: "👻", currency: "🩸", power: "⚡", achievement: "🏆", stats: "📊", special: "🦇" },
    hero: { titlePrefix: "🌑", ctaIcon: "🦇" },
    content: { heroTitle: "RISE WHEN THE MOON BLEEDS", heroSubtitle: "Darkness breeds opportunity", heroDescription: "Under the blood moon, the fearless hunt. Every shadow hides a profit. Only the brave trade in darkness.", ctaPrimaryText: "Hunt Now", ctaSecondaryText: "The Eclipse" },
  },
  "venom": {
    icons: { trophy: "☠️", battle: "🐍", users: "🕷️", currency: "💚", power: "⚡", achievement: "🏆", stats: "📊", special: "🧪" },
    hero: { titlePrefix: "☠️", ctaIcon: "🐍" },
    content: { heroTitle: "INJECT YOUR EDGE", heroSubtitle: "Lethal precision. Toxic gains.", heroDescription: "One bite is all it takes. Venom-class traders strike fast, strike hard, and extract maximum profit.", ctaPrimaryText: "Strike First", ctaSecondaryText: "The Lab" },
  },
  "iron-warlord": {
    icons: { trophy: "⚔️", battle: "🛡️", users: "💂", currency: "🏆", power: "⚡", achievement: "🏅", stats: "📊", special: "🦅" },
    hero: { titlePrefix: "⚔️", ctaIcon: "🛡️" },
    content: { heroTitle: "FORGE YOUR EMPIRE IN IRON", heroSubtitle: "Command. Conquer. Profit.", heroDescription: "The iron warlord takes no prisoners. Build your army of trades, fortify your positions, and crush the opposition.", ctaPrimaryText: "Take Command", ctaSecondaryText: "War Room" },
  },

  // ── RPG Themes ──────────────────────────────────────────────────────────
  "warrior": {
    icons: { trophy: "⚔️", battle: "🗡️", users: "🛡️", currency: "🪙", power: "💪", achievement: "🏰", stats: "📜", special: "🔥" },
    hero: { titlePrefix: "⚔️", ctaIcon: "🗡️" },
    content: { heroTitle: "DRAW YOUR BLADE, WARRIOR", heroSubtitle: "Battle-hardened. Market-proven.", heroDescription: "Every trade is a duel. Sharpen your sword, raise your shield, and charge into the arena of champions.", ctaPrimaryText: "Draw Blade", ctaSecondaryText: "Enter Arena" },
  },
  "wizard": {
    icons: { trophy: "🔮", battle: "✨", users: "🧙", currency: "💎", power: "⚡", achievement: "📚", stats: "🌟", special: "🪄" },
    hero: { titlePrefix: "🔮", ctaIcon: "🪄" },
    content: { heroTitle: "CAST YOUR SPELLS ON THE MARKET", heroSubtitle: "Arcane knowledge. Mystic profits.", heroDescription: "Wizards see what others cannot. Channel ancient market wisdom, cast profit spells, and enchant your portfolio.", ctaPrimaryText: "Cast Spell", ctaSecondaryText: "Arcane Library" },
  },
  "warlord": {
    icons: { trophy: "👑", battle: "⚔️", users: "🏴", currency: "🪙", power: "💀", achievement: "🏰", stats: "📜", special: "🐺" },
    hero: { titlePrefix: "👑", ctaIcon: "⚔️" },
    content: { heroTitle: "CONQUER ALL MARKETS", heroSubtitle: "Empires are built on bold trades", heroDescription: "The warlord does not negotiate. Seize territory, crush rivals, and claim the throne of trading supremacy.", ctaPrimaryText: "Conquer", ctaSecondaryText: "The Throne" },
  },
  "mage": {
    icons: { trophy: "🌙", battle: "✨", users: "🧝", currency: "💠", power: "🌟", achievement: "🔮", stats: "📊", special: "🌌" },
    hero: { titlePrefix: "🌙", ctaIcon: "✨" },
    content: { heroTitle: "CHANNEL THE CELESTIAL MARKETS", heroSubtitle: "Moon magic. Star profits.", heroDescription: "Mages trade by moonlight, reading the celestial charts that guide fortunes. Let the stars align your profits.", ctaPrimaryText: "Channel Magic", ctaSecondaryText: "Star Charts" },
  },
  "robot": {
    icons: { trophy: "🤖", battle: "⚡", users: "🔧", currency: "💰", power: "🔋", achievement: "🏆", stats: "📊", special: "🦾" },
    hero: { titlePrefix: "🤖", ctaIcon: "🦾" },
    content: { heroTitle: "EXECUTE WITH MACHINE PRECISION", heroSubtitle: "Circuits don't flinch. Neither should you.", heroDescription: "Trade with the cold efficiency of a machine. No emotions, no hesitation — just calculated moves and mechanical profits.", ctaPrimaryText: "Initialize", ctaSecondaryText: "System Status" },
  },
  "fallout": {
    icons: { trophy: "☢️", battle: "🔫", users: "🏚️", currency: "🪙", power: "💥", achievement: "🏜️", stats: "📊", special: "🐉" },
    hero: { titlePrefix: "☢️", ctaIcon: "💥" },
    content: { heroTitle: "SURVIVE THE MARKET WASTELAND", heroSubtitle: "Post-apocalyptic trading", heroDescription: "In the wasteland, only the resourceful survive. Scavenge opportunities, trade for survival, and rebuild your fortune.", ctaPrimaryText: "Enter Wasteland", ctaSecondaryText: "Bunker" },
  },
  "diablo": {
    icons: { trophy: "😈", battle: "🔥", users: "💀", currency: "🪙", power: "⚡", achievement: "👑", stats: "📊", special: "🌋" },
    hero: { titlePrefix: "😈", ctaIcon: "🔥" },
    content: { heroTitle: "DESCEND INTO THE PIT OF PROFITS", heroSubtitle: "Hellfire forges champions", heroDescription: "In the burning depths, fortunes await. Face your demons, trade through hellfire, and emerge with diabolical gains.", ctaPrimaryText: "Descend", ctaSecondaryText: "The Inferno" },
  },
  "assassin": {
    icons: { trophy: "🗡️", battle: "🥷", users: "👤", currency: "💰", power: "⚡", achievement: "🎯", stats: "📊", special: "🌑" },
    hero: { titlePrefix: "🥷", ctaIcon: "🗡️" },
    content: { heroTitle: "STRIKE FROM THE SHADOWS", heroSubtitle: "Silent. Deadly. Profitable.", heroDescription: "Assassins trade in silence. One precise strike, one clean exit. The market never sees you coming.", ctaPrimaryText: "Strike", ctaSecondaryText: "The Contract" },
  },
  "dragon": {
    icons: { trophy: "🐉", battle: "🔥", users: "🏰", currency: "💎", power: "⚡", achievement: "👑", stats: "📊", special: "🥚" },
    hero: { titlePrefix: "🐉", ctaIcon: "🔥" },
    content: { heroTitle: "UNLEASH THE DRAGON WITHIN", heroSubtitle: "Fire-breathing profits await", heroDescription: "Dragons hoard wealth. It's time to claim your treasure. Breathe fire on the competition and soar above the markets.", ctaPrimaryText: "Unleash Fire", ctaSecondaryText: "Dragon's Lair" },
  },
  "space-marine": {
    icons: { trophy: "🚀", battle: "🔫", users: "🛸", currency: "💎", power: "⚡", achievement: "🏆", stats: "📊", special: "🪐" },
    hero: { titlePrefix: "🚀", ctaIcon: "🔫" },
    content: { heroTitle: "DEFEND THE TRADING FRONTIER", heroSubtitle: "In space, profit echoes forever", heroDescription: "Strap into your power armor. The trading frontier is hostile, but Space Marines never retreat. Semper Fi.", ctaPrimaryText: "Deploy", ctaSecondaryText: "Mission Brief" },
  },
  "samurai": {
    icons: { trophy: "🏯", battle: "⚔️", users: "🎎", currency: "💰", power: "🌊", achievement: "🎋", stats: "📊", special: "🗡️" },
    hero: { titlePrefix: "⚔️", ctaIcon: "🗡️" },
    content: { heroTitle: "MASTER THE WAY OF THE BLADE", heroSubtitle: "Honor. Discipline. Victory.", heroDescription: "The samurai trades with precision and honor. Every move is deliberate, every exit is clean. Walk the path of the warrior.", ctaPrimaryText: "Draw Your Blade", ctaSecondaryText: "The Dojo" },
  },
  "viking": {
    icons: { trophy: "🪓", battle: "⚔️", users: "🛡️", currency: "💎", power: "⚡", achievement: "🏔️", stats: "📜", special: "🐺" },
    hero: { titlePrefix: "⚔️", ctaIcon: "🪓" },
    content: { heroTitle: "SAIL TO GLORY AND GOLD", heroSubtitle: "Conquer new horizons", heroDescription: "Viking traders fear nothing. Board the longship, raid the markets, and return home with legendary riches.", ctaPrimaryText: "Set Sail", ctaSecondaryText: "The Mead Hall" },
  },
  "pirate-bay": {
    icons: { trophy: "🏴‍☠️", battle: "⚓", users: "🦜", currency: "🪙", power: "💀", achievement: "🗺️", stats: "🧭", special: "☠️" },
    hero: { titlePrefix: "🏴‍☠️", ctaIcon: "⚓" },
    content: { heroTitle: "PLUNDER THE SEVEN MARKETS", heroSubtitle: "X marks the profit", heroDescription: "Ahoy, trader! Hoist the Jolly Roger, follow the treasure map, and plunder profits from the high seas of finance.", ctaPrimaryText: "Hoist the Flag", ctaSecondaryText: "Treasure Map" },
  },
  "enchanted-forest": {
    icons: { trophy: "🌟", battle: "🧝", users: "🍃", currency: "✨", power: "🦋", achievement: "🌿", stats: "🔮", special: "🌙" },
    hero: { titlePrefix: "🌿", ctaIcon: "✨" },
    content: { heroTitle: "DISCOVER ENCHANTED PROFITS", heroSubtitle: "Magic grows in every trade", heroDescription: "Deep in the enchanted forest, mystical profits bloom like flowers. Follow the fairy lights to your fortune.", ctaPrimaryText: "Enter the Forest", ctaSecondaryText: "The Glade" },
  },
  "crystal-cave": {
    icons: { trophy: "💎", battle: "⛏️", users: "🔮", currency: "💠", power: "✨", achievement: "🏔️", stats: "📊", special: "🪨" },
    hero: { titlePrefix: "💎", ctaIcon: "✨" },
    content: { heroTitle: "MINE CRYSTAL-CLEAR PROFITS", heroSubtitle: "Shimmering gems of opportunity", heroDescription: "Deep underground, rare crystals await the bold miner. Every facet reflects a new opportunity. Dig deep, profit big.", ctaPrimaryText: "Start Mining", ctaSecondaryText: "The Cavern" },
  },
  "pharaoh": {
    icons: { trophy: "🏺", battle: "🐍", users: "👁️", currency: "🪙", power: "☀️", achievement: "🏛️", stats: "📜", special: "🔱" },
    hero: { titlePrefix: "☀️", ctaIcon: "🔱" },
    content: { heroTitle: "BUILD YOUR TRADING DYNASTY", heroSubtitle: "Pharaohs ruled with golden wisdom", heroDescription: "Command the markets like a pharaoh commands the Nile. Ancient wisdom, modern profits, eternal legacy.", ctaPrimaryText: "Ascend the Throne", ctaSecondaryText: "The Temple" },
  },
  "jade-dragon": {
    icons: { trophy: "🐉", battle: "🏯", users: "🎎", currency: "💠", power: "🐲", achievement: "☯️", stats: "🀄", special: "🎐" },
    hero: { titlePrefix: "🐉", ctaIcon: "☯️" },
    content: { heroTitle: "AWAKEN THE JADE DRAGON", heroSubtitle: "Ancient power. Imperial profits.", heroDescription: "The jade dragon sleeps beneath the mountain. Awaken it with your trades, and harness imperial fortune.", ctaPrimaryText: "Awaken", ctaSecondaryText: "The Palace" },
  },

  // ── Futuristic ──────────────────────────────────────────────────────────
  "cyberpunk": {
    icons: { trophy: "🤖", battle: "🔫", users: "👁️‍🗨️", currency: "₿", power: "⚡", achievement: "🏆", stats: "📊", special: "🏙️" },
    hero: { titlePrefix: "🤖", ctaIcon: "🔫" },
    content: { heroTitle: "HACK THE SYSTEM. OWN THE FUTURE.", heroSubtitle: "In the neon underground, data is power", heroDescription: "Jack into the grid. The megacorps control the markets, but runners like you know how to extract real profit.", ctaPrimaryText: "Jack In", ctaSecondaryText: "The Grid" },
  },
  "holographic": {
    icons: { trophy: "💠", battle: "🔷", users: "👁️", currency: "💎", power: "✨", achievement: "🏆", stats: "📊", special: "🌀" },
    hero: { titlePrefix: "💠", ctaIcon: "🌀" },
    content: { heroTitle: "TRADE IN ANOTHER DIMENSION", heroSubtitle: "Holographic precision trading", heroDescription: "See through the noise. Holographic traders perceive markets in dimensions others cannot even imagine.", ctaPrimaryText: "Project", ctaSecondaryText: "Holo-Deck" },
  },
  "ocean-depth": {
    icons: { trophy: "🐋", battle: "🌊", users: "🐠", currency: "💎", power: "🔱", achievement: "🏆", stats: "📊", special: "🐚" },
    hero: { titlePrefix: "🐋", ctaIcon: "🔱" },
    content: { heroTitle: "DIVE INTO THE DEEP BLUE PROFITS", heroSubtitle: "Beneath the surface lies treasure", heroDescription: "The ocean floor is littered with opportunity. Dive deep, navigate the currents, and surface with untold riches.", ctaPrimaryText: "Dive Deep", ctaSecondaryText: "The Abyss" },
  },
  "arctic-frost": {
    icons: { trophy: "❄️", battle: "🏔️", users: "🐺", currency: "💎", power: "⚡", achievement: "🏆", stats: "📊", special: "🌨️" },
    hero: { titlePrefix: "❄️", ctaIcon: "🏔️" },
    content: { heroTitle: "FREEZE THE COMPETITION", heroSubtitle: "Ice-cold. Razor-sharp.", heroDescription: "In the frozen north, only the toughest survive. Trade with arctic precision and leave the competition in the frost.", ctaPrimaryText: "Freeze Them", ctaSecondaryText: "The Summit" },
  },
  "steampunk": {
    icons: { trophy: "⚙️", battle: "🔧", users: "🎩", currency: "🪙", power: "🔥", achievement: "🏆", stats: "📊", special: "🎭" },
    hero: { titlePrefix: "⚙️", ctaIcon: "🔧" },
    content: { heroTitle: "ENGINEER YOUR FORTUNE", heroSubtitle: "Gears of profit in motion", heroDescription: "In the age of steam and brass, fortunes are built by engineers. Wind the gears, stoke the furnace, and trade.", ctaPrimaryText: "Engage Gears", ctaSecondaryText: "The Workshop" },
  },
  "synthwave": {
    icons: { trophy: "🌅", battle: "🎹", users: "👾", currency: "💜", power: "⚡", achievement: "🏆", stats: "📊", special: "🌃" },
    hero: { titlePrefix: "🌅", ctaIcon: "🎹" },
    content: { heroTitle: "RIDE THE RETROWAVE TO PROFIT", heroSubtitle: "80s vibes. Future gains.", heroDescription: "Sunset palms, chrome dashboards, and synthwave beats. Ride the retrowave while banking modern-day profits.", ctaPrimaryText: "Ride the Wave", ctaSecondaryText: "The Sunset" },
  },
  "galactic-empire": {
    icons: { trophy: "🚀", battle: "🛸", users: "👽", currency: "💫", power: "⚡", achievement: "🏆", stats: "📊", special: "🌌" },
    hero: { titlePrefix: "🚀", ctaIcon: "🛸" },
    content: { heroTitle: "RULE THE GALACTIC MARKETS", heroSubtitle: "Trade across the stars", heroDescription: "The galaxy is your trading floor. Command star fleets of capital across light-years of opportunity.", ctaPrimaryText: "Launch", ctaSecondaryText: "Star Command" },
  },

  // ── Sports ──────────────────────────────────────────────────────────────
  "sports-betting": {
    icons: { trophy: "⚽", battle: "🏈", users: "👥", currency: "💰", power: "🏆", achievement: "🥇", stats: "📊", special: "🎯" },
    hero: { titlePrefix: "⚽", ctaIcon: "🥇" },
    content: { heroTitle: "PLAY THE GAME. WIN THE PRIZE.", heroSubtitle: "Champions trade. Legends profit.", heroDescription: "Think like an athlete, trade like a champion. The field is set, the crowd is roaring — time to score big.", ctaPrimaryText: "Enter the Field", ctaSecondaryText: "The Stadium" },
  },
  "championship": {
    icons: { trophy: "🥊", battle: "🏋️", users: "👑", currency: "💰", power: "🏆", achievement: "🥇", stats: "📊", special: "🎯" },
    hero: { titlePrefix: "🥊", ctaIcon: "🏋️" },
    content: { heroTitle: "CHAMPION MINDSET. CHAMPION RESULTS.", heroSubtitle: "Train. Trade. Triumph.", heroDescription: "Champions are made in practice and proven in battle. Step into the ring and fight for trading glory.", ctaPrimaryText: "Enter the Ring", ctaSecondaryText: "Training Camp" },
  },
  "thunder-strike": {
    icons: { trophy: "⚡", battle: "🌩️", users: "🔱", currency: "💰", power: "💥", achievement: "🏆", stats: "📊", special: "🦅" },
    hero: { titlePrefix: "⚡", ctaIcon: "🌩️" },
    content: { heroTitle: "STRIKE WITH THE FORCE OF THUNDER", heroSubtitle: "Electrifying speed. Shocking profits.", heroDescription: "When thunder strikes, markets move. Be the lightning — fast, powerful, and impossible to stop.", ctaPrimaryText: "Strike Now", ctaSecondaryText: "Storm Center" },
  },

  // ── Casino ──────────────────────────────────────────────────────────────
  "casino-royale": {
    icons: { trophy: "🎰", battle: "🃏", users: "👑", currency: "💰", power: "🎲", achievement: "🏆", stats: "📊", special: "♠️" },
    hero: { titlePrefix: "🎰", ctaIcon: "🃏" },
    content: { heroTitle: "ALL IN. NO LIMITS.", heroSubtitle: "High-stakes trading royale", heroDescription: "The casino floor is open. Place your bets with precision, play your hand wisely, and walk away a winner.", ctaPrimaryText: "Place Your Bet", ctaSecondaryText: "The Tables" },
  },
  "vegas-night": {
    icons: { trophy: "🎰", battle: "🎲", users: "🌃", currency: "💰", power: "🎯", achievement: "🏆", stats: "📊", special: "🍸" },
    hero: { titlePrefix: "🎰", ctaIcon: "🎲" },
    content: { heroTitle: "WHAT HAPPENS IN TRADING STAYS IN PROFIT", heroSubtitle: "Vegas lights. Big nights.", heroDescription: "The neon strip never sleeps and neither do the markets. Roll the dice, spin the wheel, and collect your winnings.", ctaPrimaryText: "Roll the Dice", ctaSecondaryText: "The Strip" },
  },
  "gold-luxury": {
    icons: { trophy: "👑", battle: "💎", users: "🏛️", currency: "💰", power: "✨", achievement: "🏆", stats: "📊", special: "🔱" },
    hero: { titlePrefix: "👑", ctaIcon: "💎" },
    content: { heroTitle: "TRADE IN PURE GOLD", heroSubtitle: "Luxury-class wealth creation", heroDescription: "Only the finest opportunities for the most discerning traders. Gold-standard execution, platinum-level returns.", ctaPrimaryText: "Go Premium", ctaSecondaryText: "The Vault" },
  },

  // ── Holiday ─────────────────────────────────────────────────────────────
  "christmas": {
    icons: { trophy: "🎄", battle: "🎁", users: "🎅", currency: "💰", power: "⭐", achievement: "🏆", stats: "📊", special: "🦌" },
    hero: { titlePrefix: "🎄", ctaIcon: "🎁" },
    content: { heroTitle: "UNWRAP YOUR TRADING GIFTS", heroSubtitle: "'Tis the season to profit", heroDescription: "Santa brought the best gift of all — a chance to trade and win big this holiday season. Ho ho ho!", ctaPrimaryText: "Unwrap Now", ctaSecondaryText: "Gift Guide" },
  },
  "easter": {
    icons: { trophy: "🐣", battle: "🌷", users: "🐰", currency: "💰", power: "🌸", achievement: "🏆", stats: "📊", special: "🥚" },
    hero: { titlePrefix: "🐣", ctaIcon: "🌷" },
    content: { heroTitle: "SPRING INTO FRESH PROFITS", heroSubtitle: "New season. New opportunities.", heroDescription: "Like flowers in spring, your portfolio is ready to bloom. Hunt for golden eggs of opportunity this Easter.", ctaPrimaryText: "Start the Hunt", ctaSecondaryText: "Egg Map" },
  },
  "black-friday": {
    icons: { trophy: "🏷️", battle: "🛒", users: "💳", currency: "💰", power: "🔥", achievement: "🏆", stats: "📊", special: "⚡" },
    hero: { titlePrefix: "🏷️", ctaIcon: "🛒" },
    content: { heroTitle: "THE BIGGEST TRADING EVENT OF THE YEAR", heroSubtitle: "Deals that trade themselves", heroDescription: "Black Friday prices on entry fees, boosted prize pools, and exclusive competitions. Don't miss the deal of a lifetime.", ctaPrimaryText: "Grab the Deal", ctaSecondaryText: "Doorbuster" },
  },
  "halloween": {
    icons: { trophy: "🎃", battle: "👻", users: "💀", currency: "🪙", power: "🔮", achievement: "🏆", stats: "📊", special: "🕸️" },
    hero: { titlePrefix: "🎃", ctaIcon: "👻" },
    content: { heroTitle: "TRICK OR TRADE", heroSubtitle: "Spooky-good profits await", heroDescription: "Ghosts, ghouls, and gains! This Halloween, the scariest thing is missing out on these monster profits.", ctaPrimaryText: "Trick or Trade", ctaSecondaryText: "The Crypt" },
  },

  // ── Classic ─────────────────────────────────────────────────────────────
  "minimal-dark": {
    icons: { trophy: "📐", battle: "🎯", users: "👤", currency: "💎", power: "⚡", achievement: "🏆", stats: "📊", special: "✨" },
    hero: { titlePrefix: "📐", ctaIcon: "🎯" },
    content: { heroTitle: "SIMPLE. POWERFUL. PROFITABLE.", heroSubtitle: "Less noise. More profits.", heroDescription: "Strip away the distractions. Focus on what matters. Clean interface, sharp execution, pure results.", ctaPrimaryText: "Start Trading", ctaSecondaryText: "Learn More" },
  },
  "royal-purple": {
    icons: { trophy: "👑", battle: "🔮", users: "🏛️", currency: "💎", power: "✨", achievement: "🏆", stats: "📊", special: "💜" },
    hero: { titlePrefix: "👑", ctaIcon: "🔮" },
    content: { heroTitle: "TRADE LIKE ROYALTY", heroSubtitle: "A regal approach to profits", heroDescription: "Purple is the color of royalty. Trade with the dignity and power of kings. Your throne awaits.", ctaPrimaryText: "Claim the Crown", ctaSecondaryText: "The Palace" },
  },
  "midnight-blue": {
    icons: { trophy: "🌙", battle: "💫", users: "🌌", currency: "💎", power: "✨", achievement: "🏆", stats: "📊", special: "🔵" },
    hero: { titlePrefix: "🌙", ctaIcon: "💫" },
    content: { heroTitle: "TRADE UNDER THE MIDNIGHT SKY", heroSubtitle: "When the world sleeps, traders rise", heroDescription: "Under the deep midnight blue, the greatest opportunities emerge. Quiet confidence. Stellar profits.", ctaPrimaryText: "Night Session", ctaSecondaryText: "The Observatory" },
  },
  "emerald-forest": {
    icons: { trophy: "🌿", battle: "🍃", users: "🌳", currency: "💎", power: "✨", achievement: "🏆", stats: "📊", special: "🦎" },
    hero: { titlePrefix: "🌿", ctaIcon: "🍃" },
    content: { heroTitle: "GROW YOUR WEALTH NATURALLY", heroSubtitle: "Organic growth. Real results.", heroDescription: "Like a mighty oak, great portfolios grow from small seeds. Plant your trades, nurture your strategy, harvest profits.", ctaPrimaryText: "Plant a Seed", ctaSecondaryText: "The Garden" },
  },
  "sunset-glow": {
    icons: { trophy: "🌅", battle: "🌇", users: "🌄", currency: "💰", power: "✨", achievement: "🏆", stats: "📊", special: "🔶" },
    hero: { titlePrefix: "🌅", ctaIcon: "🌇" },
    content: { heroTitle: "GOLDEN HOUR GAINS AWAIT", heroSubtitle: "Every sunset brings a new dawn of profit", heroDescription: "As the sky turns gold, so does your portfolio. Trade during the golden hour when opportunities glow brightest.", ctaPrimaryText: "Catch the Glow", ctaSecondaryText: "The Horizon" },
  },

  // ── Elegant ─────────────────────────────────────────────────────────────
  "aurora-borealis": {
    icons: { trophy: "🌌", battle: "✨", users: "🦌", currency: "💎", power: "💫", achievement: "🏆", stats: "📊", special: "🌠" },
    hero: { titlePrefix: "🌌", ctaIcon: "✨" },
    content: { heroTitle: "DANCE WITH THE NORTHERN LIGHTS", heroSubtitle: "Ethereal beauty. Real profits.", heroDescription: "Like the aurora borealis, your trading journey paints the sky with colors of success. Witness the spectacle.", ctaPrimaryText: "Watch the Lights", ctaSecondaryText: "The North" },
  },
  "desert-mirage": {
    icons: { trophy: "🏜️", battle: "🐪", users: "🌵", currency: "🪙", power: "☀️", achievement: "🏆", stats: "📊", special: "🌅" },
    hero: { titlePrefix: "🏜️", ctaIcon: "🐪" },
    content: { heroTitle: "FIND YOUR OASIS OF OPPORTUNITY", heroSubtitle: "Golden dunes. Golden gains.", heroDescription: "In the vast desert, mirages fool the weak. But true traders find the oasis — real profits in shifting sands.", ctaPrimaryText: "Find the Oasis", ctaSecondaryText: "The Caravan" },
  },
  "coral-reef": {
    icons: { trophy: "🐠", battle: "🐚", users: "🌊", currency: "💎", power: "🐋", achievement: "🏆", stats: "📊", special: "🦑" },
    hero: { titlePrefix: "🐠", ctaIcon: "🐚" },
    content: { heroTitle: "EXPLORE VIBRANT PROFIT REEFS", heroSubtitle: "A tropical paradise of opportunity", heroDescription: "Beneath the crystal waters lies a coral reef teeming with life and opportunity. Dive in and discover hidden treasures.", ctaPrimaryText: "Explore", ctaSecondaryText: "The Reef" },
  },
  "midnight-jazz": {
    icons: { trophy: "🎷", battle: "🎶", users: "🎭", currency: "💎", power: "✨", achievement: "🏆", stats: "📊", special: "🌙" },
    hero: { titlePrefix: "🎷", ctaIcon: "🎶" },
    content: { heroTitle: "SMOOTH PROFITS. COOL MOVES.", heroSubtitle: "Jazz up your trading game", heroDescription: "In the velvet lounge of midnight jazz, every trade has rhythm, every profit has soul. Play your notes wisely.", ctaPrimaryText: "Take the Stage", ctaSecondaryText: "The Lounge" },
  },
};
