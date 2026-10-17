// 10 New Landing Page Themes — Part 2
// Pharaoh, Jade Dragon, Blood Moon, Aurora Borealis, Desert Mirage, Galactic Empire, Venom, Coral Reef, Midnight Jazz, Warlord

import type { LandingTheme } from "./landing-themes";

export const pharaohTheme: LandingTheme = {
  id: "pharaoh",
  name: "Pharaoh",
  description: "Ancient Egyptian gold and mystery",
  category: "rpg",
  themeIcons: { trophy: "🏺", battle: "🐍", users: "👁️", currency: "🪙", power: "☀️", achievement: "🏛️", stats: "📜", special: "🔱" },
  heroTextStyle: { titlePrefix: "☀️", ctaIcon: "🔱" },
  preview: "linear-gradient(135deg, #0a0800 0%, #1a1200 40%, #c6a300 80%, #ffd700 100%)",
  colors: {
    primary: "#c6a300", primaryHover: "#dab700", secondary: "#00897b", accent: "#ffd700",
    accentGlow: "rgba(198,163,0,0.5)", background: "#0a0800", backgroundSecondary: "#141005",
    backgroundCard: "rgba(20,16,5,0.9)", backgroundOverlay: "rgba(10,8,0,0.9)",
    text: "#fff8e0", textMuted: "#a09060", textAccent: "#ffd700",
    border: "rgba(198,163,0,0.25)", borderAccent: "rgba(255,215,0,0.5)",
    success: "#4caf50", warning: "#ffd700", error: "#e53935",
  },
  fonts: { heading: "'Cinzel Decorative', serif", body: "'Lora', serif", accent: "'Cinzel', serif" },
  effects: {
    glowColor: "rgba(255,215,0,0.4)", glowIntensity: "medium", particleColor: "#ffd700",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #c6a300, #ffd700)",
    backgroundPattern: "radial-gradient(ellipse at 50% 80%, rgba(198,163,0,0.15) 0%, transparent 55%), radial-gradient(ellipse at 50% 10%, rgba(255,215,0,0.08) 0%, transparent 40%)",
    cardStyle: "solid", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "gradient", iconStyle: "filled", badgeStyle: "diamond" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#0a0800] via-[#141005] to-[#1a1200]", cardBackground: "bg-[#141005]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-yellow-700 to-amber-500 hover:from-yellow-600 hover:to-amber-400 text-black", buttonSecondary: "border border-yellow-600/50 hover:bg-yellow-900/30", textGradient: "bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300 bg-clip-text text-transparent" },
};

export const jadeDragonTheme: LandingTheme = {
  id: "jade-dragon",
  name: "Jade Dragon",
  description: "Imperial jade and dragon mythology",
  category: "rpg",
  themeIcons: { trophy: "🐉", battle: "🏯", users: "🎎", currency: "💠", power: "🐲", achievement: "☯️", stats: "🀄", special: "🎐" },
  heroTextStyle: { titlePrefix: "🐉", ctaIcon: "☯️" },
  preview: "linear-gradient(135deg, #001a10 0%, #003320 40%, #00c853 70%, #b9f6ca 100%)",
  colors: {
    primary: "#00c853", primaryHover: "#00e676", secondary: "#ff6e40", accent: "#b9f6ca",
    accentGlow: "rgba(0,200,83,0.4)", background: "#001a10", backgroundSecondary: "#002818",
    backgroundCard: "rgba(0,40,24,0.9)", backgroundOverlay: "rgba(0,26,16,0.9)",
    text: "#e8fff0", textMuted: "#6aab80", textAccent: "#00e676",
    border: "rgba(0,200,83,0.25)", borderAccent: "rgba(185,246,202,0.4)",
    success: "#00e676", warning: "#ffd740", error: "#ff5252",
  },
  fonts: { heading: "'Noto Serif SC', serif", body: "'Inter', sans-serif", accent: "'Noto Serif SC', serif" },
  effects: {
    glowColor: "rgba(0,200,83,0.4)", glowIntensity: "medium", particleColor: "#00e676",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #00c853, #b9f6ca)",
    backgroundPattern: "radial-gradient(ellipse at 30% 70%, rgba(0,200,83,0.12) 0%, transparent 50%), radial-gradient(circle at 70% 20%, rgba(185,246,202,0.06) 0%, transparent 40%)",
    cardStyle: "solid", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "line", iconStyle: "duotone", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#001a10] via-[#002818] to-[#003320]", cardBackground: "bg-[#002818]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-green-700 to-green-400 hover:from-green-600 hover:to-green-300", buttonSecondary: "border border-green-600/40 hover:bg-green-900/20", textGradient: "bg-gradient-to-r from-green-300 via-emerald-200 to-green-300 bg-clip-text text-transparent" },
};

export const bloodMoonTheme: LandingTheme = {
  id: "blood-moon",
  name: "Blood Moon",
  description: "Crimson eclipse supernatural darkness",
  category: "gaming",
  preview: "linear-gradient(135deg, #0a0005 0%, #1a000f 40%, #b71c1c 70%, #d50000 100%)",
  colors: {
    primary: "#d50000", primaryHover: "#ff1744", secondary: "#880e4f", accent: "#ff8a80",
    accentGlow: "rgba(213,0,0,0.5)", background: "#08000a", backgroundSecondary: "#12000e",
    backgroundCard: "rgba(18,0,14,0.9)", backgroundOverlay: "rgba(8,0,10,0.9)",
    text: "#fff0f0", textMuted: "#a06070", textAccent: "#ff5252",
    border: "rgba(213,0,0,0.3)", borderAccent: "rgba(255,138,128,0.4)",
    success: "#69f0ae", warning: "#ffc400", error: "#ff1744",
  },
  fonts: { heading: "'Nosifer', cursive", body: "'Inter', sans-serif", accent: "'Creepster', cursive" },
  effects: {
    glowColor: "rgba(213,0,0,0.5)", glowIntensity: "intense", particleColor: "#d50000",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #d50000, #880e4f)",
    backgroundPattern: "radial-gradient(circle at 50% 30%, rgba(213,0,0,0.2) 0%, transparent 40%), radial-gradient(ellipse at 50% 80%, rgba(136,14,79,0.1) 0%, transparent 50%)",
    cardStyle: "solid", buttonStyle: "glow", animationStyle: "dynamic",
  },
  decorations: { headerStyle: "bold", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#08000a] via-[#12000e] to-[#1a000f]", cardBackground: "bg-[#12000e]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-red-900 to-red-600 hover:from-red-800 hover:to-red-500 shadow-lg shadow-red-600/30", buttonSecondary: "border border-red-800/50 hover:bg-red-950/40", textGradient: "bg-gradient-to-r from-red-400 via-pink-300 to-red-400 bg-clip-text text-transparent" },
};

export const auroraBorealisTheme: LandingTheme = {
  id: "aurora-borealis",
  name: "Aurora Borealis",
  description: "Northern lights celestial beauty",
  category: "elegant",
  preview: "linear-gradient(135deg, #001020 0%, #002040 30%, #00bfa5 60%, #76ff03 100%)",
  colors: {
    primary: "#00bfa5", primaryHover: "#1de9b6", secondary: "#76ff03", accent: "#7c4dff",
    accentGlow: "rgba(0,191,165,0.4)", background: "#001020", backgroundSecondary: "#001830",
    backgroundCard: "rgba(0,24,48,0.85)", backgroundOverlay: "rgba(0,16,32,0.9)",
    text: "#e0f7fa", textMuted: "#60a0b0", textAccent: "#1de9b6",
    border: "rgba(0,191,165,0.2)", borderAccent: "rgba(118,255,3,0.3)",
    success: "#00e676", warning: "#ffc400", error: "#ff5252",
  },
  fonts: { heading: "'Quicksand', sans-serif", body: "'Inter', sans-serif", accent: "'Comfortaa', sans-serif" },
  effects: {
    glowColor: "rgba(0,191,165,0.4)", glowIntensity: "medium", particleColor: "#1de9b6",
    particleType: "stars", gradientStyle: "linear-gradient(135deg, #00bfa5, #76ff03, #7c4dff)",
    backgroundPattern: "radial-gradient(ellipse at 20% 30%, rgba(0,191,165,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(118,255,3,0.08) 0%, transparent 40%), radial-gradient(ellipse at 50% 10%, rgba(124,77,255,0.06) 0%, transparent 35%)",
    cardStyle: "glass", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "gradient", iconStyle: "duotone", badgeStyle: "pill" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#001020] via-[#001830] to-[#002040]", cardBackground: "bg-[#001830]/80 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-teal-500 to-lime-500 hover:from-teal-400 hover:to-lime-400 text-black", buttonSecondary: "border border-teal-500/40 hover:bg-teal-900/20", textGradient: "bg-gradient-to-r from-teal-300 via-lime-300 to-purple-300 bg-clip-text text-transparent" },
};

export const desertMirageTheme: LandingTheme = {
  id: "desert-mirage",
  name: "Desert Mirage",
  description: "Golden dunes and shimmering heat haze",
  category: "elegant",
  preview: "linear-gradient(135deg, #1a1008 0%, #2d1b10 40%, #e6a44e 80%, #f4d9a0 100%)",
  colors: {
    primary: "#e6a44e", primaryHover: "#f0b968", secondary: "#5d4037", accent: "#f4d9a0",
    accentGlow: "rgba(230,164,78,0.4)", background: "#120c05", backgroundSecondary: "#1a1008",
    backgroundCard: "rgba(26,16,8,0.9)", backgroundOverlay: "rgba(18,12,5,0.9)",
    text: "#faf0e0", textMuted: "#a09080", textAccent: "#e6a44e",
    border: "rgba(230,164,78,0.2)", borderAccent: "rgba(244,217,160,0.3)",
    success: "#66bb6a", warning: "#ffb300", error: "#ef5350",
  },
  fonts: { heading: "'Playfair Display', serif", body: "'Inter', sans-serif", accent: "'Cormorant Garamond', serif" },
  effects: {
    glowColor: "rgba(230,164,78,0.3)", glowIntensity: "subtle", particleColor: "#e6a44e",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #e6a44e, #f4d9a0)",
    backgroundPattern: "radial-gradient(ellipse at 50% 100%, rgba(230,164,78,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(244,217,160,0.08) 0%, transparent 40%)",
    cardStyle: "solid", buttonStyle: "solid", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "line", iconStyle: "filled", badgeStyle: "square" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#120c05] via-[#1a1008] to-[#2d1b10]", cardBackground: "bg-[#1a1008]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 text-black", buttonSecondary: "border border-amber-600/40 hover:bg-amber-900/20", textGradient: "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent" },
};

export const galacticEmpireTheme: LandingTheme = {
  id: "galactic-empire",
  name: "Galactic Empire",
  description: "Vast space empire and starship command",
  category: "futuristic",
  preview: "linear-gradient(135deg, #000010 0%, #000830 30%, #283593 60%, #5c6bc0 100%)",
  colors: {
    primary: "#5c6bc0", primaryHover: "#7986cb", secondary: "#ff7043", accent: "#b0bec5",
    accentGlow: "rgba(92,107,192,0.4)", background: "#000010", backgroundSecondary: "#000820",
    backgroundCard: "rgba(0,8,32,0.9)", backgroundOverlay: "rgba(0,0,16,0.9)",
    text: "#e8eaf6", textMuted: "#7986cb", textAccent: "#9fa8da",
    border: "rgba(92,107,192,0.25)", borderAccent: "rgba(255,112,67,0.3)",
    success: "#69f0ae", warning: "#ffab40", error: "#ff5252",
  },
  fonts: { heading: "'Orbitron', sans-serif", body: "'Inter', sans-serif", accent: "'Exo 2', sans-serif" },
  effects: {
    glowColor: "rgba(92,107,192,0.4)", glowIntensity: "medium", particleColor: "#5c6bc0",
    particleType: "stars", gradientStyle: "linear-gradient(135deg, #5c6bc0, #ff7043)",
    backgroundPattern: "radial-gradient(ellipse at 50% 50%, rgba(92,107,192,0.08) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(255,112,67,0.05) 0%, transparent 30%)",
    cardStyle: "glass", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "bold", dividerStyle: "line", iconStyle: "filled", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#000010] via-[#000820] to-[#000830]", cardBackground: "bg-[#000820]/85 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-indigo-600 to-orange-500 hover:from-indigo-500 hover:to-orange-400", buttonSecondary: "border border-indigo-500/40 hover:bg-indigo-950/30", textGradient: "bg-gradient-to-r from-indigo-300 via-orange-300 to-indigo-300 bg-clip-text text-transparent" },
};

export const venomTheme: LandingTheme = {
  id: "venom",
  name: "Venom",
  description: "Toxic neon green on absolute black",
  category: "gaming",
  preview: "linear-gradient(135deg, #000000 0%, #0a0f0a 40%, #00ff41 80%, #76ff03 100%)",
  colors: {
    primary: "#00ff41", primaryHover: "#33ff66", secondary: "#76ff03", accent: "#b2ff59",
    accentGlow: "rgba(0,255,65,0.5)", background: "#000000", backgroundSecondary: "#050a05",
    backgroundCard: "rgba(5,10,5,0.9)", backgroundOverlay: "rgba(0,0,0,0.9)",
    text: "#e0ffe0", textMuted: "#408040", textAccent: "#00ff41",
    border: "rgba(0,255,65,0.2)", borderAccent: "rgba(118,255,3,0.4)",
    success: "#00ff41", warning: "#ffd740", error: "#ff1744",
  },
  fonts: { heading: "'Share Tech Mono', monospace", body: "'IBM Plex Mono', monospace", accent: "'Fira Code', monospace" },
  effects: {
    glowColor: "rgba(0,255,65,0.5)", glowIntensity: "intense", particleColor: "#00ff41",
    particleType: "dots", gradientStyle: "linear-gradient(135deg, #00ff41, #76ff03)",
    backgroundPattern: "repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(0,255,65,0.02) 30px, rgba(0,255,65,0.02) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(0,255,65,0.02) 30px, rgba(0,255,65,0.02) 31px)",
    cardStyle: "neon", buttonStyle: "neon", animationStyle: "dynamic",
  },
  decorations: { headerStyle: "neon", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "square" },
  customClasses: { heroBackground: "bg-black", cardBackground: "bg-[#050a05]/90 backdrop-blur border border-green-500/10", buttonPrimary: "bg-[#00ff41] text-black hover:bg-[#33ff66] font-mono shadow-lg shadow-green-500/30", buttonSecondary: "border border-green-500/40 hover:bg-green-950/30 font-mono", textGradient: "bg-gradient-to-r from-green-400 via-lime-300 to-green-400 bg-clip-text text-transparent" },
};

export const coralReefTheme: LandingTheme = {
  id: "coral-reef",
  name: "Coral Reef",
  description: "Vibrant underwater tropical paradise",
  category: "elegant",
  preview: "linear-gradient(135deg, #001520 0%, #002838 30%, #0097a7 60%, #ff7043 100%)",
  colors: {
    primary: "#0097a7", primaryHover: "#00bcd4", secondary: "#ff7043", accent: "#ffab91",
    accentGlow: "rgba(0,151,167,0.4)", background: "#001520", backgroundSecondary: "#002030",
    backgroundCard: "rgba(0,32,48,0.85)", backgroundOverlay: "rgba(0,21,32,0.9)",
    text: "#e0f7fa", textMuted: "#60a0a8", textAccent: "#00bcd4",
    border: "rgba(0,151,167,0.25)", borderAccent: "rgba(255,112,67,0.4)",
    success: "#69f0ae", warning: "#ffab40", error: "#ff5252",
  },
  fonts: { heading: "'Quicksand', sans-serif", body: "'Inter', sans-serif", accent: "'Comfortaa', sans-serif" },
  effects: {
    glowColor: "rgba(0,151,167,0.3)", glowIntensity: "subtle", particleColor: "#00bcd4",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #0097a7, #ff7043)",
    backgroundPattern: "radial-gradient(ellipse at 30% 80%, rgba(0,151,167,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(255,112,67,0.08) 0%, transparent 40%)",
    cardStyle: "glass", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "gradient", iconStyle: "duotone", badgeStyle: "pill" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#001520] via-[#002030] to-[#002838]", cardBackground: "bg-[#002030]/80 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-cyan-700 to-orange-500 hover:from-cyan-600 hover:to-orange-400", buttonSecondary: "border border-cyan-700/40 hover:bg-cyan-900/20", textGradient: "bg-gradient-to-r from-cyan-300 via-orange-300 to-cyan-300 bg-clip-text text-transparent" },
};

export const midnightJazzTheme: LandingTheme = {
  id: "midnight-jazz",
  name: "Midnight Jazz",
  description: "Smooth velvet lounge and golden spotlights",
  category: "elegant",
  preview: "linear-gradient(135deg, #0a0510 0%, #120820 40%, #4a148c 70%, #ffd700 100%)",
  colors: {
    primary: "#ce93d8", primaryHover: "#e1bee7", secondary: "#ffd700", accent: "#ffab40",
    accentGlow: "rgba(206,147,216,0.4)", background: "#0a0510", backgroundSecondary: "#100818",
    backgroundCard: "rgba(16,8,24,0.9)", backgroundOverlay: "rgba(10,5,16,0.9)",
    text: "#f3e5f5", textMuted: "#9575cd", textAccent: "#ce93d8",
    border: "rgba(206,147,216,0.2)", borderAccent: "rgba(255,215,0,0.3)",
    success: "#69f0ae", warning: "#ffd700", error: "#ff5252",
  },
  fonts: { heading: "'Playfair Display', serif", body: "'Lora', serif", accent: "'Cormorant Garamond', serif" },
  effects: {
    glowColor: "rgba(206,147,216,0.3)", glowIntensity: "subtle", particleColor: "#ce93d8",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #ce93d8, #ffd700)",
    backgroundPattern: "radial-gradient(ellipse at 50% 50%, rgba(206,147,216,0.1) 0%, transparent 50%), radial-gradient(circle at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 30%)",
    cardStyle: "solid", buttonStyle: "solid", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "line", iconStyle: "filled", badgeStyle: "pill" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#0a0510] via-[#100818] to-[#120820]", cardBackground: "bg-[#100818]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-purple-400 to-amber-500 hover:from-purple-300 hover:to-amber-400", buttonSecondary: "border border-purple-400/40 hover:bg-purple-950/30", textGradient: "bg-gradient-to-r from-purple-300 via-amber-300 to-purple-300 bg-clip-text text-transparent" },
};

export const ironWarlordTheme: LandingTheme = {
  id: "iron-warlord",
  name: "Iron Warlord",
  description: "Dark iron and crimson conquest banners",
  category: "gaming",
  preview: "linear-gradient(135deg, #080808 0%, #1a1010 40%, #455a64 60%, #bf360c 100%)",
  colors: {
    primary: "#bf360c", primaryHover: "#e64a19", secondary: "#455a64", accent: "#ff6d00",
    accentGlow: "rgba(191,54,12,0.4)", background: "#080808", backgroundSecondary: "#121010",
    backgroundCard: "rgba(18,16,16,0.9)", backgroundOverlay: "rgba(8,8,8,0.9)",
    text: "#eceff1", textMuted: "#78909c", textAccent: "#ff6d00",
    border: "rgba(69,90,100,0.3)", borderAccent: "rgba(191,54,12,0.4)",
    success: "#66bb6a", warning: "#ff6d00", error: "#d50000",
  },
  fonts: { heading: "'Bebas Neue', sans-serif", body: "'Inter', sans-serif", accent: "'Oswald', sans-serif" },
  effects: {
    glowColor: "rgba(191,54,12,0.4)", glowIntensity: "medium", particleColor: "#bf360c",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #bf360c, #455a64)",
    backgroundPattern: "radial-gradient(ellipse at 50% 100%, rgba(191,54,12,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(69,90,100,0.08) 0%, transparent 40%)",
    cardStyle: "solid", buttonStyle: "solid", animationStyle: "dynamic",
  },
  decorations: { headerStyle: "bold", dividerStyle: "line", iconStyle: "filled", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#080808] via-[#121010] to-[#1a1010]", cardBackground: "bg-[#121010]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-red-900 to-gray-700 hover:from-red-800 hover:to-gray-600", buttonSecondary: "border border-red-900/50 hover:bg-red-950/30", textGradient: "bg-gradient-to-r from-red-400 via-gray-300 to-orange-400 bg-clip-text text-transparent" },
};
