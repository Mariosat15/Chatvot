/**
 * Game Icons Registry for Admin
 * 
 * Centralized mapping of ALL game icons for consistent usage across the admin app.
 * Icons are served from the main app's /public/game-icons/ directory.
 * 
 * IMPORTANT: This must stay in sync with lib/constants/game-icons.ts
 * 
 * For white-label deployments:
 * - Set NEXT_PUBLIC_APP_URL to point to the main app
 * - Icons will be loaded from {NEXT_PUBLIC_APP_URL}/game-icons/...
 */

/**
 * Get the base URL for assets (main app URL for white-label support)
 */
export function getAssetsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || '';
  }
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

// Import from main app registry to keep in sync
// Since admin is a separate app, we duplicate the paths here
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
  profitAlt: '/game-icons/profit.png',
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
  medal7: '/game-icons/medal 7.png',
  
  trophy: '/game-icons/1. TROPHY.png',
  trophyStar: '/game-icons/2. STAR TROPHY.png',
  trophyGame: '/game-icons/16. GAME TROPHY.png',
  trophyFootball: '/game-icons/15. FOOTBALL TROPHY.png',
  trophyMusic: '/game-icons/17. MUSIC TROPHY.png',
  trophyMovie: '/game-icons/18. MOVIE TROPHY.png',
  trophy1: '/game-icons/trophy 1 .png',
  trophy2: '/game-icons/trophy 2 .png',
  trophy3: '/game-icons/trophy 3 .png',
  
  goldMedal: '/game-icons/3. GOLD MEDAL.png',
  champion: '/game-icons/11. CHAMPION AWARD.png',
  victory: '/game-icons/20. VICTORY AWARD.png',

  trophyCol1: '/game-icons/0Trophy015 (1).png',
  trophyCol2: '/game-icons/0Trophy015 (2).png',
  trophyCol3: '/game-icons/0Trophy015 (3).png',
  trophyCol4: '/game-icons/0Trophy015 (4).png',
  trophyCol5: '/game-icons/0Trophy015 (5).png',
  trophyCol6: '/game-icons/0Trophy015 (6).png',
  trophyCol7: '/game-icons/0Trophy015 (7).png',
  trophyCol8: '/game-icons/0Trophy015 (8).png',
  trophyCol9: '/game-icons/0Trophy015 (9).png',
  trophyCol10: '/game-icons/0Trophy015 (10).png',
  trophyCol11: '/game-icons/0Trophy015 (11).png',
  trophyCol12: '/game-icons/0Trophy015 (12).png',
  trophyCol13: '/game-icons/0Trophy015 (13).png',
  trophyCol14: '/game-icons/0Trophy015 (14).png',
  trophyCol15: '/game-icons/0Trophy015 (15).png',
  
  // ========================================
  // Badges & Awards
  // ========================================
  starAward: '/game-icons/9. STAR AWARD.png',
  starAward12: '/game-icons/12. STAR AWARD.png',
  starBadge: '/game-icons/14. STAR BADGE.png',
  shieldAward: '/game-icons/5. SHIELD AWARD.png',
  certificateAward: '/game-icons/4. CERTIFICATE AWARD.png',
  graduationAward: '/game-icons/6. GRADUATION AWARD.png',
  scrollAward: '/game-icons/7. SCROLL AWARD.png',
  award: '/game-icons/8. AWARD.png',
  giftAward: '/game-icons/10. GIFT AWARD.png',
  giftAward13: '/game-icons/13. GIFT AWARD.png',
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
  chest14: '/game-icons/14. Chest.png',
  pouch1: '/game-icons/pouch 1.png',
  pouch2: '/game-icons/pouch 2.png',
  money: '/game-icons/5. money.png',
  moneyDeposit: '/game-icons/money deposite.png',
  moneyBalance: '/game-icons/money balance.png',
  capital: '/game-icons/8. capital.png',
  pirateCoin: '/game-icons/Pirate Coins.png',

  // ========================================
  // Status & Alerts
  // ========================================
  warning: '/game-icons/warning 1.png',
  warning2: '/game-icons/warning 2.png',
  warning3: '/game-icons/warning 3.png',
  warning4: '/game-icons/warning 4.png',
  warning5: '/game-icons/warning 5.png',
  warning6: '/game-icons/warning 6.png',
  warning7: '/game-icons/warning 7.png',
  warning8: '/game-icons/warning 8.png',
  warning9: '/game-icons/warning 9.png',
  warning10: '/game-icons/warning 10.png',
  riskWarning: '/game-icons/1. Risk Warning.png',
  riskManagement: '/game-icons/2. Risk Management.png',
  riskIdentification: '/game-icons/3. Risk Identification.png',
  riskMeasurement: '/game-icons/4. Risk Measurement.png',
  riskAnalysis: '/game-icons/5. Risk Analysis.png',
  riskControl: '/game-icons/7. Risk Control.png',
  riskMonitoring: '/game-icons/9. Risk Monitoring.png',
  marketRisk: '/game-icons/8. Market risk.png',
  operationalRisk: '/game-icons/10. Operational Risk.png',
  externalRisk: '/game-icons/11. External Risk.png',
  systemFailures: '/game-icons/12. System Failures.png',
  internalControl: '/game-icons/13. Internal Control.png',
  marketMonitoring: '/game-icons/14. Market Monitoring.png',
  riskScale: '/game-icons/15. Risk Scale.png',
  qualitativeAnalysis: '/game-icons/16. Qualitative Analysis.png',
  quantitativeAnalysis: '/game-icons/17. Quantitative analysis.png',
  impactAssessment: '/game-icons/18. Impact Assesment.png',
  riskAssessment: '/game-icons/19. Risk Assesment.png',
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
  pirateSword: '/game-icons/Pirate Sword.png',
  piratesSword: '/game-icons/Pirates Sword.png',
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
  bomb3: '/game-icons/bomb 3.png',
  bomb4: '/game-icons/bomb 4.png',
  bombLarge: '/game-icons/Bomb.png',
  bombNumbered: '/game-icons/12. Bomb.png',
  piratePistol: '/game-icons/Pirate Pistol.png',
  pirateCannon: '/game-icons/Pirate Cannon.png',
  cannon: '/game-icons/Cannon.png',

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
  pirateHat: '/game-icons/Pirate Hat.png',
  piratesHat: '/game-icons/Pirates Hat.png',
  armor1: '/game-icons/armor 1.png',
  armor2: '/game-icons/armor 2.png',
  key: '/game-icons/15. Key.png',
  banner: '/game-icons/18. Banner.png',
  flag: '/game-icons/17. Flag.png',
  pirateFlag: '/game-icons/Pirate Flag.png',
  piratesFlag: '/game-icons/Pirates Flag.png',
  crown: '/game-icons/16. Crown.png',
  map1: '/game-icons/map 1.png',
  map2: '/game-icons/map 2.png',
  mapLarge: '/game-icons/Map.png',
  pirateMap: '/game-icons/Pirate Map.png',
  maps: '/game-icons/19. Maps.png',
  guideBook: '/game-icons/20. GuideBook.png',
  compass: '/game-icons/Compass.png',
  eyePatch: '/game-icons/Eye Patch.png',
  pirateHook: '/game-icons/Pirate Hook.png',
  piratesHook: '/game-icons/Pirates Hook.png',
  piratePegLeg: '/game-icons/Pirate Peg Leg.png',
  barrel: '/game-icons/Barrel.png',
  islandRock: '/game-icons/Island Rock.png',

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
  wolf4: '/game-icons/Wolf1 (4).png',
  wolf5: '/game-icons/Wolf1 (5).png',
  wolf6: '/game-icons/Wolf1 (6).png',
  wolf7: '/game-icons/Wolf1 (7).png',
  wolf8: '/game-icons/Wolf1 (8).png',
  wolf9: '/game-icons/Wolf1 (9).png',
  wolf10: '/game-icons/Wolf1 (10).png',
  wolf11: '/game-icons/Wolf1 (11).png',
  wolf12: '/game-icons/Wolf1 (12).png',
  wolf13: '/game-icons/Wolf1 (13).png',
  wolf14: '/game-icons/Wolf1 (14).png',
  wolf15: '/game-icons/Wolf1 (15).png',
  wolf16: '/game-icons/Wolf1 (16).png',
  wolf17: '/game-icons/Wolf1 (17).png',
  wolf18: '/game-icons/Wolf1 (18).png',
  wolf19: '/game-icons/Wolf1 (19).png',
  wolf20: '/game-icons/Wolf1 (20).png',
  animal1: '/game-icons/animal 1.png',
  animal2: '/game-icons/animal 2.png',
  animal3: '/game-icons/animal 3.png',
  animal4: '/game-icons/animal 4.png',
  animal5: '/game-icons/animal 5.png',
  animal6: '/game-icons/animal 6.png',
  animal7: '/game-icons/animal 7.png',
  animal8: '/game-icons/animal 8.png',
  animal9: '/game-icons/animal 9.png',
  animal10: '/game-icons/animal 10.png',
  parrot: '/game-icons/Parrot.png',

  // Pirate Ships & Vessels
  pirateShip: '/game-icons/Pirate Ship.png',
  piratesShip: '/game-icons/Pirates Ship.png',
  anchor: '/game-icons/Anchor.png',
  anchor1: '/game-icons/1Anchor (1).png',
  anchor2: '/game-icons/1Anchor (2).png',
  anchor3: '/game-icons/1Anchor (3).png',
  anchor4: '/game-icons/1Anchor (4).png',

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
  dollarFinance3: '/game-icons/dollar finance 3.png',
  dollarFinance4: '/game-icons/dollar finance 4.png',
  dollarFinance5: '/game-icons/dollar finance 5.png',
  dollarFinance6: '/game-icons/dollar finance 6.png',
  dollarFinance7: '/game-icons/dollar finance 7.png',
  dollarFinance8: '/game-icons/dollar finance 8.png',
  dollarFinance9: '/game-icons/dollar finance 9.png',
  dollarFinance10: '/game-icons/dollar finance 10.png',
  euroFinance1: '/game-icons/euro finance 1.png',
  euroFinance2: '/game-icons/euro finance 2.png',
  euroFinance3: '/game-icons/euro finance 3.png',
  euroFinance4: '/game-icons/euro finance 4.png',
  euroFinance5: '/game-icons/euro finance 5.png',
  euroFinance6: '/game-icons/euro finance 6.png',
  euroFinance7: '/game-icons/euro finance 7.png',
  euroFinance8: '/game-icons/euro finance 8.png',
  euroFinance9: '/game-icons/euro finance 9.png',
  euroFinance10: '/game-icons/euro finance 10.png',
  finance1: '/game-icons/finance 1.png',
  finance2: '/game-icons/finance 2.png',
  finance3: '/game-icons/finance 3.png',
  finance4: '/game-icons/finance 4.png',
  finance5: '/game-icons/finance 5.png',
  finance6: '/game-icons/finance 6.png',
  finance7: '/game-icons/finance 7.png',
  finance8: '/game-icons/finance 8.png',
  finance9: '/game-icons/finance 9.png',
  finance10: '/game-icons/finance 10.png',
  financialCalculation: '/game-icons/financial calculation.png',
  financialPlanning: '/game-icons/6. Financial planning.png',
  equity: '/game-icons/Equity.png',
  equities: '/game-icons/11. equitities.png',
  dividend: '/game-icons/10. dividend.png',
  valuation: '/game-icons/9. valuation.png',
  inflation: '/game-icons/7. inflation.png',
  hedge: '/game-icons/17. hedge.png',
  gain: '/game-icons/13. gain.png',
  fluctuation: '/game-icons/fluctuation.png',
  overPrice: '/game-icons/14. over price.png',
  redemption: '/game-icons/15. redemtion.png',
  riskRating: '/game-icons/16. risk rating.png',
  repository: '/game-icons/18. repository.png',
  investmentModel: '/game-icons/4. investment model.png',
  fixIncome: '/game-icons/12. fix income.png',
  longTermInvestment: '/game-icons/Long Term Investment.png',
  returnOfInvest: '/game-icons/19. return of invest.png',
  investStock: '/game-icons/20. invest stock.png',
  investEducation: '/game-icons/invest education.png',
  goldInvest: '/game-icons/gold invest.png',
  attractingMoney: '/game-icons/atracting money.png',
  dollarPlant: '/game-icons/dolar plant.png',
  retirementSaving: '/game-icons/retriement saving.png',
  finance900_1: '/game-icons/finance 900 (1).png',
  finance900_2: '/game-icons/finance 900 (2).png',
  finance900_3: '/game-icons/finance 900 (3).png',
  finance900_4: '/game-icons/finance 900 (4).png',
  finance900_5: '/game-icons/finance 900 (5).png',
  finance900_6: '/game-icons/finance 900 (6).png',
  finance900_7: '/game-icons/finance 900 (7).png',
  finance900_8: '/game-icons/finance 900 (8).png',
  finance900_9: '/game-icons/finance 900 (9).png',
  finance900_10: '/game-icons/finance 900 (10).png',
  finance22_1: '/game-icons/finance22 7 (1).png',
  finance22_2: '/game-icons/finance22 7 (2).png',
  finance22_3: '/game-icons/finance22 7 (3).png',
  finance22_4: '/game-icons/finance22 7 (4).png',
  finance22_5: '/game-icons/finance22 7 (5).png',
  finance22_6: '/game-icons/finance22 7 (6).png',
  finance22_7: '/game-icons/finance22 7 (7).png',
  finance22_8: '/game-icons/finance22 7 (8).png',
  finance22_9: '/game-icons/finance22 7 (9).png',
  finance22_10: '/game-icons/finance22 7 (10).png',

  // ========================================
  // Rewards & Misc
  // ========================================
  reward1: '/game-icons/reward 1.png',
  reward2: '/game-icons/reward 2.png',
  reward3: '/game-icons/reward 3.png',
  reward4: '/game-icons/reward 4.png',
  reward5: '/game-icons/reward 5.png',
  star1: '/game-icons/star 1.png',
  star2: '/game-icons/star 2.png',
  star3: '/game-icons/star 3.png',
  meat: '/game-icons/5. Meat.png',
  heart: '/game-icons/hearth.png',
  dream: '/game-icons/dreem.png',
  medKit1: '/game-icons/med kit 1 .png',
  medKit2: '/game-icons/med kit 2 .png',
  crisisRecovery: '/game-icons/6. Crysis Recovery.png',

  // ========================================
  // Numbered Icons
  // ========================================
  num1: '/game-icons/1.png',
  num2: '/game-icons/2.png',
  num3: '/game-icons/3.png',
  num4: '/game-icons/4.png',
  num5: '/game-icons/5.png',
  num6: '/game-icons/6.png',
  num7: '/game-icons/7.png',
  num8: '/game-icons/8.png',
  num9: '/game-icons/9.png',
  num10: '/game-icons/10.png',
  icon0001: '/game-icons/0001.png',
  icon0002: '/game-icons/0002.png',
  icon0003: '/game-icons/0003.png',
  icon0004: '/game-icons/0004.png',
  icon0005: '/game-icons/0005.png',
  icon0006: '/game-icons/0006.png',
  icon0007: '/game-icons/0007.png',
  icon0008: '/game-icons/0008.png',
  icon0009: '/game-icons/0009.png',
  icon0010: '/game-icons/0010.png',
  icon0011: '/game-icons/0011.png',
  icon0012: '/game-icons/0012.png',
  icon0013: '/game-icons/0013.png',
  icon0014: '/game-icons/0014.png',
  icon0015: '/game-icons/0015.png',
  icon0016: '/game-icons/0016.png',
  icon0017: '/game-icons/0017.png',
  icon0018: '/game-icons/0018.png',
  icon0019: '/game-icons/0019.png',
  icon0020: '/game-icons/0020.png',

  // ========================================
  // Game Theme Collections
  // ========================================
  gameFirst1: '/game-icons/game first (1).png',
  gameFirst2: '/game-icons/game first (2).png',
  gameFirst3: '/game-icons/game first (3).png',
  gameFirst4: '/game-icons/game first (4).png',
  gameFirst5: '/game-icons/game first (5).png',
  gameFirst6: '/game-icons/game first (6).png',
  gameFirst7: '/game-icons/game first (7).png',
  gameFirst8: '/game-icons/game first (8).png',
  gameFirst9: '/game-icons/game first (9).png',
  gameFirst10: '/game-icons/game first (10).png',
  gameSecond1: '/game-icons/gamesecond (1).png',
  gameSecond2: '/game-icons/gamesecond (2).png',
  gameSecond3: '/game-icons/gamesecond (3).png',
  gameSecond4: '/game-icons/gamesecond (4).png',
  gameSecond5: '/game-icons/gamesecond (5).png',
  gameSecond6: '/game-icons/gamesecond (6).png',
  gameSecond7: '/game-icons/gamesecond (7).png',
  gameSecond8: '/game-icons/gamesecond (8).png',
  gameSecond9: '/game-icons/gamesecond (9).png',
  gameSecond10: '/game-icons/gamesecond (10).png',
  gameThird1: '/game-icons/gamethurt (1).png',
  gameThird2: '/game-icons/gamethurt (2).png',
  gameThird3: '/game-icons/gamethurt (3).png',
  gameThird4: '/game-icons/gamethurt (4).png',
  gameThird5: '/game-icons/gamethurt (5).png',
  gameThird6: '/game-icons/gamethurt (6).png',
  gameThird7: '/game-icons/gamethurt (7).png',
  gameThird8: '/game-icons/gamethurt (8).png',
  gameThird9: '/game-icons/gamethurt (9).png',
  gameThird10: '/game-icons/gamethurt (10).png',
  gameFourth1: '/game-icons/gameforth (1).png',
  gameFourth2: '/game-icons/gameforth (2).png',
  gameFourth3: '/game-icons/gameforth (3).png',
  gameFourth4: '/game-icons/gameforth (4).png',
  gameFourth5: '/game-icons/gameforth (5).png',
  gameFourth6: '/game-icons/gameforth (6).png',
  gameFourth7: '/game-icons/gameforth (7).png',
  gameFourth8: '/game-icons/gameforth (8).png',
  gameFourth9: '/game-icons/gameforth (9).png',
  gameFourth10: '/game-icons/gameforth (10).png',
  gameFifth1: '/game-icons/gamefifth (1).png',
  gameFifth2: '/game-icons/gamefifth (2).png',
  gameFifth3: '/game-icons/gamefifth (3).png',
  gameFifth4: '/game-icons/gamefifth (4).png',
  gameFifth5: '/game-icons/gamefifth (5).png',
  gameFifth6: '/game-icons/gamefifth (6).png',
  gameFifth7: '/game-icons/gamefifth (7).png',
  gameFifth8: '/game-icons/gamefifth (8).png',
  gameFifth9: '/game-icons/gamefifth (9).png',
  gameFifth10: '/game-icons/gamefifth (10).png',
  gameBlack1: '/game-icons/gameblack (1).png',
  gameBlack2: '/game-icons/gameblack (2).png',
  gameBlack3: '/game-icons/gameblack (3).png',
  gameBlack4: '/game-icons/gameblack (4).png',
  gameBlack5: '/game-icons/gameblack (5).png',
  gameBlack6: '/game-icons/gameblack (6).png',
  gameBlack7: '/game-icons/gameblack (7).png',
  gameBlack8: '/game-icons/gameblack (8).png',
  gameBlack9: '/game-icons/gameblack (9).png',
  gameBlack10: '/game-icons/gameblack (10).png',

  // Sword collection (sw0005)
  sw1: '/game-icons/sw0005 (1).png',
  sw2: '/game-icons/sw0005 (2).png',
  sw3: '/game-icons/sw0005 (3).png',
  sw4: '/game-icons/sw0005 (4).png',
  sw5: '/game-icons/sw0005 (5).png',
  sw6: '/game-icons/sw0005 (6).png',
  sw7: '/game-icons/sw0005 (7).png',
  sw8: '/game-icons/sw0005 (8).png',
  sw9: '/game-icons/sw0005 (9).png',
  sw10: '/game-icons/sw0005 (10).png',
  sw11: '/game-icons/sw0005 (11).png',
  sw12: '/game-icons/sw0005 (12).png',
  sw13: '/game-icons/sw0005 (13).png',
  sw14: '/game-icons/sw0005 (14).png',
  sw15: '/game-icons/sw0005 (15).png',

  // Final Render collection
  render1: '/game-icons/Final Render-0001.png',
  render2: '/game-icons/Final Render-0002.png',
  render3: '/game-icons/Final Render-0003.png',
  render4: '/game-icons/Final Render-0004.png',
  render5: '/game-icons/Final Render-0005.png',
  render6: '/game-icons/Final Render-0006.png',
  render7: '/game-icons/Final Render-0007.png',
  render8: '/game-icons/Final Render-0008.png',
  render9: '/game-icons/Final Render-0009.png',
  render10: '/game-icons/Final Render-0010.png',
  render11: '/game-icons/Final Render-0011.png',
  render12: '/game-icons/Final Render-0012.png',
  render13: '/game-icons/Final Render-0013.png',
  render14: '/game-icons/Final Render-0014.png',
  render15: '/game-icons/Final Render-0015.png',
  render16: '/game-icons/Final Render-0016.png',
  render17: '/game-icons/Final Render-0017.png',
  render18: '/game-icons/Final Render-0018.png',
  render19: '/game-icons/Final Render-0019.png',
  render20: '/game-icons/Final Render-0020.png',

  // ========================================
  // Technology
  // ========================================
  tech1: '/game-icons/technology 1.png',
  tech2: '/game-icons/technology 2.png',
  tech3: '/game-icons/technology 3.png',
  tech4: '/game-icons/technology 4.png',
  tech5: '/game-icons/technology 5.png',
  tech6: '/game-icons/technology 6.png',
  tech7: '/game-icons/technology 7.png',
  tech8: '/game-icons/technology 8.png',
  tech9: '/game-icons/technology 9.png',
  tech10: '/game-icons/technology 10.png',
  tech100_1: '/game-icons/technology 100 (1).png',
  tech100_2: '/game-icons/technology 100 (2).png',
  tech100_3: '/game-icons/technology 100 (3).png',
  tech100_4: '/game-icons/technology 100 (4).png',
  tech100_5: '/game-icons/technology 100 (5).png',
  tech100_6: '/game-icons/technology 100 (6).png',
  tech100_7: '/game-icons/technology 100 (7).png',
  tech100_8: '/game-icons/technology 100 (8).png',
  tech100_9: '/game-icons/technology 100 (9).png',
  tech100_10: '/game-icons/technology 100 (10).png',
  tech1110_1: '/game-icons/technology 1110 (1).png',
  tech1110_2: '/game-icons/technology 1110 (2).png',
  tech1110_3: '/game-icons/technology 1110 (3).png',
  tech1110_4: '/game-icons/technology 1110 (4).png',
  tech1110_5: '/game-icons/technology 1110 (5).png',
  tech1110_6: '/game-icons/technology 1110 (6).png',
  tech1110_7: '/game-icons/technology 1110 (7).png',
  tech1110_8: '/game-icons/technology 1110 (8).png',
  tech1110_9: '/game-icons/technology 1110 (9).png',
  tech1110_10: '/game-icons/technology 1110 (10).png',
  tech44_1: '/game-icons/technology44 4 (1).png',
  tech44_2: '/game-icons/technology44 4 (2).png',
  tech44_3: '/game-icons/technology44 4 (3).png',
  tech44_4: '/game-icons/technology44 4 (4).png',
  tech44_5: '/game-icons/technology44 4 (5).png',
  tech44_6: '/game-icons/technology44 4 (6).png',
  tech44_7: '/game-icons/technology44 4 (7).png',
  tech44_8: '/game-icons/technology44 4 (8).png',
  tech44_9: '/game-icons/technology44 4 (9).png',
  tech44_10: '/game-icons/technology44 4 (10).png',

  // ========================================
  // Seasonal
  // ========================================
  christmas1: '/game-icons/christmas icon 1.png',
  christmas2: '/game-icons/christmas icon 2.png',
  christmas3: '/game-icons/christmas icon 3.png',
  christmas4: '/game-icons/christmas icon 4.png',
  christmas5: '/game-icons/christmas icon 5.png',
  christmas6: '/game-icons/christmas icon 6.png',
  christmas7: '/game-icons/christmas icon 7.png',
  christmas8: '/game-icons/christmas icon 8.png',
  christmas9: '/game-icons/christmas icon 9.png',
  christmas10: '/game-icons/christmas icon 10.png',
  christmas11: '/game-icons/christmas icon 11.png',
  christmas12: '/game-icons/christmas icon 12.png',
  christmas13: '/game-icons/christmas icon 13.png',
  christmas14: '/game-icons/christmas icon 14.png',
  christmas15: '/game-icons/christmas icon 15.png',
  christmas16: '/game-icons/christmas icon 16.png',
  christmas17: '/game-icons/christmas icon 17.png',
  christmas18: '/game-icons/christmas icon 18.png',
  christmas19: '/game-icons/christmas icon 19.png',
  christmas20: '/game-icons/christmas icon 20.png',
  halloween1: '/game-icons/halloween 1.png',
  halloween2: '/game-icons/halloween 2.png',
  halloween3: '/game-icons/halloween 3.png',
  halloween4: '/game-icons/halloween 4.png',
  halloween5: '/game-icons/halloween 5.png',
  halloween6: '/game-icons/halloween 6.png',
  halloween7: '/game-icons/halloween 7.png',
  halloween8: '/game-icons/halloween 8.png',
  halloween9: '/game-icons/halloween 9.png',
  halloween10: '/game-icons/halloween 10.png',
  blackFriday1: '/game-icons/black friday 1.png',
  blackFriday2: '/game-icons/black friday 2.png',
  blackFriday3: '/game-icons/black friday 3.png',
  blackFriday4: '/game-icons/black friday 4.png',
  blackFriday5: '/game-icons/black friday 5.png',
  blackFriday6: '/game-icons/black friday 6.png',
  blackFriday7: '/game-icons/black friday 7.png',
  blackFriday8: '/game-icons/black friday 8.png',
  blackFriday9: '/game-icons/black friday 9.png',
  blackFriday10: '/game-icons/black friday 10.png',
  cyber1: '/game-icons/cyber 1.png',
  cyber2: '/game-icons/cyber 2.png',
  cyber3: '/game-icons/cyber 3.png',
  cyber4: '/game-icons/cyber 4.png',
  cyber5: '/game-icons/cyber 5.png',
  cyber6: '/game-icons/cyber 6.png',
  cyber7: '/game-icons/cyber 7.png',
  cyber8: '/game-icons/cyber 8.png',
  cyber9: '/game-icons/cyber 9.png',
  cyber10: '/game-icons/cyber 10.png',

  // School & Education
  school1: '/game-icons/school 1.png',
  school2: '/game-icons/school 2.png',
  school3: '/game-icons/school 3.png',
  school4: '/game-icons/school 4.png',
  school5: '/game-icons/school 5.png',
  school6: '/game-icons/school 6.png',
  school7: '/game-icons/school 7.png',
  school8: '/game-icons/school 8.png',
  school9: '/game-icons/school 9.png',
  school10: '/game-icons/school 10.png',

  // Marketing
  marketing1: '/game-icons/marketing 1.png',
  marketing2: '/game-icons/marketing 2.png',
  marketing3: '/game-icons/marketing 3.png',
  marketing4: '/game-icons/marketing 4.png',
  marketing5: '/game-icons/marketing 5.png',
  marketing6: '/game-icons/marketing 6.png',
  marketing7: '/game-icons/marketing 7.png',
  marketing8: '/game-icons/marketing 8.png',
  marketing9: '/game-icons/marketing 9.png',
  marketing10: '/game-icons/marketing 10.png',

  // Badge Prototypes
  roundProto: '/game-icons/_round med prototype.png',
  roundProto1: '/game-icons/_round med prototype1.png',
  roundProto2: '/game-icons/_round med prototype2.png',
  roundProto3: '/game-icons/_round med prototype3.png',
  roundProto4: '/game-icons/_round med prototype4.png',
  shieldProto: '/game-icons/_shield med prototype.png',
  shieldProto1: '/game-icons/_shield med prototype1.png',
  shieldProto2: '/game-icons/_shield med prototype2.png',
  shieldProto3: '/game-icons/_shield med prototype3.png',
  shieldProto4: '/game-icons/_shield med prototype4.png',
} as const;

// Type for icon names
export type GameIconName = keyof typeof GAME_ICON_PATHS;

/**
 * GAME_ICONS - Static icon path registry (without base URL)
 */
export const GAME_ICONS: Record<GameIconName, string> = Object.fromEntries(
  Object.entries(GAME_ICON_PATHS).map(([key, path]) => [key, path])
) as Record<GameIconName, string>;

/**
 * Helper to get icon path with dynamic base URL support
 */
export function getGameIconPath(name: GameIconName): string {
  const basePath = GAME_ICON_PATHS[name];
  if (!basePath) return '';
  
  const baseUrl = getAssetsBaseUrl();
  return baseUrl ? `${baseUrl}${basePath}` : basePath;
}

/**
 * Get all icon paths with dynamic base URL
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
