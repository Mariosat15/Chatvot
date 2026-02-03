/**
 * Game Icons Registry for Admin
 * 
 * Centralized mapping of game icons for consistent usage across the admin app.
 * Icons are served from the main app's /public/game-icons/ directory.
 * 
 * For white-label deployments:
 * - Set NEXT_PUBLIC_APP_URL to point to the main app (e.g., https://app.yourcompany.com)
 * - Icons will be loaded from {NEXT_PUBLIC_APP_URL}/game-icons/...
 */

/**
 * Get the base URL for assets (main app URL for white-label support)
 * Falls back to empty string for local development where icons are in admin's public folder
 */
export function getAssetsBaseUrl(): string {
  // In browser, use the env variable; in development, icons are copied locally
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || '';
  }
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

// Relative paths to game icons (without base URL)
const GAME_ICON_PATHS = {
  // ========================================
  // Navigation & Core
  // ========================================
  dashboard: '/game-icons/hedset.png',
  competitions: '/game-icons/1. TROPHY.png',
  challenges: '/game-icons/9. Sword.png',
  leaderboard: '/game-icons/3. GOLD MEDAL.png',
  wallet: '/game-icons/chest 1.png',
  profile: '/game-icons/helmet 1.png',
  marketplace: '/game-icons/pouch 1.png',
  settings: '/game-icons/15. Key.png',
  help: '/game-icons/20. GuideBook.png',
  notifications: '/game-icons/17. Flag.png',

  // ========================================
  // Trading Actions
  // ========================================
  buy: '/game-icons/incrase provit.png',
  sell: '/game-icons/stock down.png',
  profit: '/game-icons/3. profit.png',
  loss: '/game-icons/20. Financial Loss.png',
  trade: '/game-icons/2. trade.png',
  investment: '/game-icons/1. invest portfolio.png',
  portfolio: '/game-icons/portofolio.png',

  // ========================================
  // Rankings & Achievements
  // ========================================
  rank1: '/game-icons/16. Crown.png',
  rank2: '/game-icons/medal 1.png',
  rank3: '/game-icons/medal 2.png',
  rank4: '/game-icons/medal 3.png',
  rank5: '/game-icons/medal 4.png',
  rank6: '/game-icons/medal 5.png',
  rank7: '/game-icons/medal 6 .png',
  
  trophy: '/game-icons/1. TROPHY.png',
  trophyStar: '/game-icons/2. STAR TROPHY.png',
  trophyGame: '/game-icons/16. GAME TROPHY.png',
  trophyFootball: '/game-icons/15. FOOTBALL TROPHY.png',
  
  goldMedal: '/game-icons/3. GOLD MEDAL.png',
  champion: '/game-icons/11. CHAMPION AWARD.png',
  victory: '/game-icons/20. VICTORY AWARD.png',
  
  // ========================================
  // Badges & Awards
  // ========================================
  starAward: '/game-icons/9. STAR AWARD.png',
  starBadge: '/game-icons/14. STAR BADGE.png',
  shieldAward: '/game-icons/5. SHIELD AWARD.png',
  certificateAward: '/game-icons/4. CERTIFICATE AWARD.png',
  graduationAward: '/game-icons/6. GRADUATION AWARD.png',
  scrollAward: '/game-icons/7. SCROLL AWARD.png',
  award: '/game-icons/8. AWARD.png',
  giftAward: '/game-icons/10. GIFT AWARD.png',
  studyAward: '/game-icons/19. STUDY AWARD.png',

  // ========================================
  // Currency & Credits
  // ========================================
  coin: '/game-icons/coin.png',
  coins: '/game-icons/3. Coin.png',
  gems: '/game-icons/gems.png',
  gemsAlt: '/game-icons/4. Gems.png',
  treasure: '/game-icons/treasure.png',
  chest: '/game-icons/chest.png',
  chest1: '/game-icons/chest 1.png',
  chest2: '/game-icons/chest 2.png',
  chest3: '/game-icons/chest 3.png',
  chest4: '/game-icons/chest 4.png',
  pouch1: '/game-icons/pouch 1.png',
  pouch2: '/game-icons/pouch 2.png',
  money: '/game-icons/5. money.png',
  moneyDeposit: '/game-icons/money deposite.png',
  moneyBalance: '/game-icons/money balance.png',
  capital: '/game-icons/8. capital.png',

  // ========================================
  // Status & Alerts
  // ========================================
  warning: '/game-icons/warning 1.png',
  warning2: '/game-icons/warning 2.png',
  warning3: '/game-icons/warning 3.png',
  riskWarning: '/game-icons/1. Risk Warning.png',
  riskManagement: '/game-icons/2. Risk Management.png',
  riskAnalysis: '/game-icons/5. Risk Analysis.png',
  riskControl: '/game-icons/7. Risk Control.png',
  riskMonitoring: '/game-icons/9. Risk Monitoring.png',
  target: '/game-icons/target.png',
  timer: '/game-icons/timer.png',
  timerAlt: '/game-icons/13. Timer.png',
  skull: '/game-icons/skull.png',

  // ========================================
  // Game Weapons
  // ========================================
  sword: '/game-icons/sword.png',
  sword1: '/game-icons/sword 1 .png',
  sword2: '/game-icons/sword 2 .png',
  sword3: '/game-icons/sword 3 .png',
  sword4: '/game-icons/sword 4.png',
  sword5: '/game-icons/sword 5.png',
  sword6: '/game-icons/sword 6.png',
  swordKnight3D: '/game-icons/Sword Knight 3D.png',
  swordNumbered: '/game-icons/9. Sword.png',
  
  axe1: '/game-icons/axe 1.png',
  axe2: '/game-icons/axe 2.png',
  axe3: '/game-icons/axe 3.png',
  axe4: '/game-icons/axe 4.png',
  axe3D: '/game-icons/Axe 3D.png',
  axeNumbered: '/game-icons/10. Axe.png',
  
  hammer1: '/game-icons/hammer 1.png',
  hammer2: '/game-icons/hammer 2.png',
  hammer3: '/game-icons/hammer 3.png',
  hammer3D: '/game-icons/Hammer 3D.png',
  
  bow3D: '/game-icons/Bow 3D.png',
  bomb1: '/game-icons/bomb 1.png',
  bomb2: '/game-icons/bomb 2.png',
  bombNumbered: '/game-icons/12. Bomb.png',

  // ========================================
  // Game Items & Equipment
  // ========================================
  shield1: '/game-icons/shield 1.png',
  shield2: '/game-icons/shield 2.png',
  shield3: '/game-icons/shield 3.png',
  shield4: '/game-icons/shield 4.png',
  magicShield3D: '/game-icons/Magic Shiled 3D.png',
  
  helmet1: '/game-icons/helmet 1.png',
  helmet2: '/game-icons/helmet 2.png',
  helmet3: '/game-icons/helmet 3.png',
  helmet4: '/game-icons/helmet 4.png',
  
  armor1: '/game-icons/armor 1.png',
  armor2: '/game-icons/armor 2.png',
  
  key: '/game-icons/15. Key.png',
  banner: '/game-icons/18. Banner.png',
  flag: '/game-icons/17. Flag.png',
  crown: '/game-icons/16. Crown.png',
  map1: '/game-icons/map 1.png',
  map2: '/game-icons/map 2.png',
  maps: '/game-icons/19. Maps.png',
  guideBook: '/game-icons/20. GuideBook.png',

  // ========================================
  // Potions & Spells
  // ========================================
  healthPotion: '/game-icons/healt potion.png',
  energyPotion: '/game-icons/energi potion.png',
  lightningPotion: '/game-icons/lightning potion.png',
  ragePotion: '/game-icons/rage potion.png',
  poisonPotion: '/game-icons/poson potion.png',
  
  spellBrown: '/game-icons/1. Spell Brown.png',
  spellGreen: '/game-icons/2. Spell Green.png',
  fireSpell: '/game-icons/fire spell.png',
  blueFireSpell: '/game-icons/blu fire speel.png',
  iceSpell: '/game-icons/ice speel.png',
  energySpell: '/game-icons/energi spell.png',
  lightningSpell: '/game-icons/lightning speel.png',
  healthSpell: '/game-icons/health speel.png',
  poisonSpell: '/game-icons/poison speel.png',

  // ========================================
  // Characters & Levels
  // ========================================
  rookie: '/game-icons/7. Rookie.png',
  lord: '/game-icons/8. Lord.png',
  archer: '/game-icons/11. Archer.png',
  war: '/game-icons/6. War.png',
  
  wolf1: '/game-icons/Wolf1 (1).png',
  wolf2: '/game-icons/Wolf1 (2).png',
  wolf3: '/game-icons/Wolf1 (3).png',
  
  animal1: '/game-icons/animal 1.png',
  animal2: '/game-icons/animal 2.png',
  animal3: '/game-icons/animal 3.png',
  animal4: '/game-icons/animal 4.png',
  animal5: '/game-icons/animal 5.png',

  // ========================================
  // Gaming Hardware
  // ========================================
  joystick1: '/game-icons/joystick 1.png',
  joystick2: '/game-icons/joystick 2.png',
  joystick3: '/game-icons/joystick 3.png',
  headset: '/game-icons/hedset.png',
  keyboard: '/game-icons/keyboard.png',
  wasd: '/game-icons/WASD.png',
  mic: '/game-icons/mic.png',

  // ========================================
  // Finance Specific
  // ========================================
  dollarFinance1: '/game-icons/dollar finance 1.png',
  dollarFinance2: '/game-icons/dollar finance 2.png',
  euroFinance1: '/game-icons/euro finance 1.png',
  euroFinance2: '/game-icons/euro finance 2.png',
  finance1: '/game-icons/finance 1.png',
  finance2: '/game-icons/finance 2.png',
  financialCalculation: '/game-icons/financial calculation.png',
  financialPlanning: '/game-icons/6. Financial planning.png',
  equity: '/game-icons/Equity.png',
  dividend: '/game-icons/10. dividend.png',
  valuation: '/game-icons/9. valuation.png',
  inflation: '/game-icons/7. inflation.png',
  hedge: '/game-icons/17. hedge.png',
  gain: '/game-icons/13. gain.png',
  fluctuation: '/game-icons/fluctuation.png',
  longTermInvestment: '/game-icons/Long Term Investment.png',
  returnOfInvest: '/game-icons/19. return of invest.png',
  investStock: '/game-icons/20. invest stock.png',
  investEducation: '/game-icons/invest education.png',
  goldInvest: '/game-icons/gold invest.png',
  attractingMoney: '/game-icons/atracting money.png',
  dollarPlant: '/game-icons/dolar plant.png',
  retirementSaving: '/game-icons/retriement saving.png',

  // ========================================
  // Rewards
  // ========================================
  reward1: '/game-icons/reward 1.png',
  reward2: '/game-icons/reward 2.png',
  reward3: '/game-icons/reward 3.png',
  reward4: '/game-icons/reward 4.png',
  reward5: '/game-icons/reward 5.png',

  // ========================================
  // Stars
  // ========================================
  star1: '/game-icons/star 1.png',
  star2: '/game-icons/star 2.png',
  star3: '/game-icons/star 3.png',

  // ========================================
  // Miscellaneous
  // ========================================
  meat: '/game-icons/5. Meat.png',
  heart: '/game-icons/hearth.png',
  dream: '/game-icons/dreem.png',
  medKit1: '/game-icons/med kit 1 .png',
  medKit2: '/game-icons/med kit 2 .png',
  crisisRecovery: '/game-icons/6. Crysis Recovery.png',
} as const;

// Type for icon names (based on the paths object)
export type GameIconName = keyof typeof GAME_ICON_PATHS;

/**
 * GAME_ICONS - Dynamic icon URL registry
 * 
 * Returns full URLs for icons, supporting white-label deployments.
 * When NEXT_PUBLIC_APP_URL is set, icons load from the main app.
 * Otherwise, falls back to local paths (for development).
 */
export const GAME_ICONS: Record<GameIconName, string> = Object.fromEntries(
  Object.entries(GAME_ICON_PATHS).map(([key, path]) => [key, path])
) as Record<GameIconName, string>;

/**
 * Helper to get icon path with dynamic base URL support
 * Use this for runtime URL generation in white-label deployments
 */
export function getGameIconPath(name: GameIconName): string {
  const basePath = GAME_ICON_PATHS[name];
  if (!basePath) return '';
  
  const baseUrl = getAssetsBaseUrl();
  return baseUrl ? `${baseUrl}${basePath}` : basePath;
}

/**
 * Get all icon paths with dynamic base URL
 * Useful for preloading or listing all available icons
 */
export function getAllGameIconPaths(): Record<GameIconName, string> {
  const baseUrl = getAssetsBaseUrl();
  return Object.fromEntries(
    Object.entries(GAME_ICON_PATHS).map(([key, path]) => [
      key,
      baseUrl ? `${baseUrl}${path}` : path
    ])
  ) as Record<GameIconName, string>;
}

// Check if a string is a valid GameIconName
export function isValidGameIconName(name: string): name is GameIconName {
  return name in GAME_ICON_PATHS;
}
