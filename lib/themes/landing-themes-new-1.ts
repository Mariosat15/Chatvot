// 10 New Landing Page Themes — Part 1
// Samurai, Viking, Steampunk, Synthwave, Volcanic, Neon Tokyo, Pirate Bay, Thunder Strike, Enchanted Forest, Crystal Cave

import type { LandingTheme } from "./landing-themes";

export const samuraiTheme: LandingTheme = {
  id: "samurai",
  name: "Samurai",
  description: "Japanese warrior honor and discipline",
  category: "rpg",
  themeIcons: { trophy: "🏯", battle: "⚔️", users: "🎎", currency: "💰", power: "🌊", achievement: "🎋", stats: "📊", special: "🗡️" },
  heroTextStyle: { titlePrefix: "⚔️", ctaIcon: "🗡️" },
  preview: "linear-gradient(135deg, #1a0a0a 0%, #2d0a0a 40%, #8b0000 100%)",
  colors: {
    primary: "#c62828", primaryHover: "#e53935", secondary: "#ffd54f", accent: "#ff5252",
    accentGlow: "rgba(198,40,40,0.4)", background: "#0d0505", backgroundSecondary: "#1a0a0a",
    backgroundCard: "rgba(26,10,10,0.85)", backgroundOverlay: "rgba(13,5,5,0.9)",
    text: "#f5f0e8", textMuted: "#b0a090", textAccent: "#ff5252",
    border: "rgba(198,40,40,0.25)", borderAccent: "rgba(255,82,82,0.5)",
    success: "#43a047", warning: "#ffd54f", error: "#ff1744",
  },
  fonts: { heading: "'Noto Serif JP', serif", body: "'Inter', sans-serif", accent: "'Noto Serif JP', serif" },
  effects: {
    glowColor: "rgba(198,40,40,0.5)", glowIntensity: "medium", particleColor: "#ff5252",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #c62828, #ff5252)",
    backgroundPattern: "radial-gradient(ellipse at 20% 80%, rgba(198,40,40,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,213,79,0.08) 0%, transparent 50%)",
    cardStyle: "glass", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "gradient", iconStyle: "duotone", badgeStyle: "square" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#0d0505] via-[#1a0a0a] to-[#2d0a0a]", cardBackground: "bg-[#1a0a0a]/80 backdrop-blur-md", buttonPrimary: "bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500", buttonSecondary: "border border-red-800/50 hover:bg-red-900/30", textGradient: "bg-gradient-to-r from-red-400 via-yellow-300 to-red-400 bg-clip-text text-transparent" },
};

export const vikingTheme: LandingTheme = {
  id: "viking",
  name: "Viking",
  description: "Norse mythology and conquest",
  category: "rpg",
  themeIcons: { trophy: "🪓", battle: "⚔️", users: "🛡️", currency: "💎", power: "⚡", achievement: "🏔️", stats: "📜", special: "🐺" },
  heroTextStyle: { titlePrefix: "⚔️", ctaIcon: "🪓" },
  preview: "linear-gradient(135deg, #0a1628 0%, #1a2a4a 40%, #3a5a8a 100%)",
  colors: {
    primary: "#64b5f6", primaryHover: "#90caf9", secondary: "#ffab40", accent: "#ffd740",
    accentGlow: "rgba(100,181,246,0.4)", background: "#0a1020", backgroundSecondary: "#0f1830",
    backgroundCard: "rgba(15,24,48,0.85)", backgroundOverlay: "rgba(10,16,32,0.9)",
    text: "#e8eaf6", textMuted: "#90a4ae", textAccent: "#64b5f6",
    border: "rgba(100,181,246,0.2)", borderAccent: "rgba(255,215,64,0.4)",
    success: "#66bb6a", warning: "#ffab40", error: "#ef5350",
  },
  fonts: { heading: "'Cinzel Decorative', serif", body: "'Inter', sans-serif", accent: "'MedievalSharp', cursive" },
  effects: {
    glowColor: "rgba(100,181,246,0.4)", glowIntensity: "medium", particleColor: "#64b5f6",
    particleType: "snow", gradientStyle: "linear-gradient(135deg, #64b5f6, #ffab40)",
    backgroundPattern: "radial-gradient(ellipse at 50% 0%, rgba(100,181,246,0.1) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(255,171,64,0.08) 0%, transparent 50%)",
    cardStyle: "solid", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "bold", dividerStyle: "line", iconStyle: "filled", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#0a1020] via-[#0f1830] to-[#1a2a4a]", cardBackground: "bg-[#0f1830]/85 backdrop-blur-md", buttonPrimary: "bg-gradient-to-r from-blue-500 to-amber-500 hover:from-blue-400 hover:to-amber-400", buttonSecondary: "border border-blue-500/40 hover:bg-blue-900/30", textGradient: "bg-gradient-to-r from-blue-300 via-amber-300 to-blue-300 bg-clip-text text-transparent" },
};

export const steampunkTheme: LandingTheme = {
  id: "steampunk",
  name: "Steampunk",
  description: "Victorian industrial sci-fi aesthetics",
  category: "futuristic",
  preview: "linear-gradient(135deg, #1a1209 0%, #2d1e0e 40%, #8b6914 100%)",
  colors: {
    primary: "#d4a017", primaryHover: "#e6b422", secondary: "#cd7f32", accent: "#b87333",
    accentGlow: "rgba(212,160,23,0.4)", background: "#0e0a05", backgroundSecondary: "#1a1209",
    backgroundCard: "rgba(26,18,9,0.9)", backgroundOverlay: "rgba(14,10,5,0.9)",
    text: "#f5e6c8", textMuted: "#a89070", textAccent: "#d4a017",
    border: "rgba(212,160,23,0.25)", borderAccent: "rgba(184,115,51,0.5)",
    success: "#4caf50", warning: "#ff9800", error: "#f44336",
  },
  fonts: { heading: "'Playfair Display', serif", body: "'Lora', serif", accent: "'Cinzel', serif" },
  effects: {
    glowColor: "rgba(212,160,23,0.3)", glowIntensity: "subtle", particleColor: "#d4a017",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #d4a017, #b87333)",
    backgroundPattern: "radial-gradient(circle at 30% 70%, rgba(212,160,23,0.1) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(184,115,51,0.08) 0%, transparent 50%)",
    cardStyle: "solid", buttonStyle: "solid", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "line", iconStyle: "filled", badgeStyle: "square" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#0e0a05] via-[#1a1209] to-[#2d1e0e]", cardBackground: "bg-[#1a1209]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-amber-700 to-orange-800 hover:from-amber-600 hover:to-orange-700", buttonSecondary: "border border-amber-700/50 hover:bg-amber-900/30", textGradient: "bg-gradient-to-r from-amber-300 via-orange-300 to-amber-300 bg-clip-text text-transparent" },
};

export const synthwaveTheme: LandingTheme = {
  id: "synthwave",
  name: "Synthwave",
  description: "80s retrowave neon sunset vibes",
  category: "futuristic",
  preview: "linear-gradient(135deg, #0d001a 0%, #1a0033 30%, #ff006e 70%, #ff8c00 100%)",
  colors: {
    primary: "#ff006e", primaryHover: "#ff3385", secondary: "#00d4ff", accent: "#ff8c00",
    accentGlow: "rgba(255,0,110,0.5)", background: "#0d001a", backgroundSecondary: "#15002e",
    backgroundCard: "rgba(21,0,46,0.85)", backgroundOverlay: "rgba(13,0,26,0.9)",
    text: "#fff0f5", textMuted: "#b080c0", textAccent: "#ff006e",
    border: "rgba(255,0,110,0.25)", borderAccent: "rgba(0,212,255,0.4)",
    success: "#00e676", warning: "#ff8c00", error: "#ff1744",
  },
  fonts: { heading: "'Orbitron', sans-serif", body: "'Exo 2', sans-serif", accent: "'Press Start 2P', monospace" },
  effects: {
    glowColor: "rgba(255,0,110,0.5)", glowIntensity: "intense", particleColor: "#ff006e",
    particleType: "stars", gradientStyle: "linear-gradient(135deg, #ff006e, #00d4ff)",
    backgroundPattern: "linear-gradient(180deg, rgba(255,0,110,0.05) 0%, transparent 30%, rgba(0,212,255,0.05) 70%, transparent 100%), repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,0,110,0.03) 40px, rgba(255,0,110,0.03) 41px)",
    cardStyle: "neon", buttonStyle: "neon", animationStyle: "intense",
  },
  decorations: { headerStyle: "neon", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "pill" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#0d001a] via-[#15002e] to-[#1a0033]", cardBackground: "bg-[#15002e]/80 backdrop-blur-lg border border-pink-500/20", buttonPrimary: "bg-gradient-to-r from-pink-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 shadow-lg shadow-pink-500/20", buttonSecondary: "border border-pink-500/40 hover:bg-pink-900/30 hover:shadow-lg hover:shadow-pink-500/10", textGradient: "bg-gradient-to-r from-pink-400 via-cyan-400 to-orange-400 bg-clip-text text-transparent" },
};

export const volcanicTheme: LandingTheme = {
  id: "volcanic",
  name: "Volcanic",
  description: "Molten lava and magma eruption",
  category: "gaming",
  preview: "linear-gradient(135deg, #0a0000 0%, #2d0a00 40%, #ff4500 80%, #ff8c00 100%)",
  colors: {
    primary: "#ff4500", primaryHover: "#ff6633", secondary: "#ff8c00", accent: "#ffd700",
    accentGlow: "rgba(255,69,0,0.5)", background: "#0a0000", backgroundSecondary: "#1a0800",
    backgroundCard: "rgba(26,8,0,0.9)", backgroundOverlay: "rgba(10,0,0,0.9)",
    text: "#fff3e0", textMuted: "#bf8a60", textAccent: "#ff4500",
    border: "rgba(255,69,0,0.3)", borderAccent: "rgba(255,215,0,0.4)",
    success: "#76ff03", warning: "#ffd700", error: "#ff1744",
  },
  fonts: { heading: "'Bebas Neue', sans-serif", body: "'Inter', sans-serif", accent: "'Oswald', sans-serif" },
  effects: {
    glowColor: "rgba(255,69,0,0.6)", glowIntensity: "intense", particleColor: "#ff4500",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #ff4500, #ff8c00, #ffd700)",
    backgroundPattern: "radial-gradient(ellipse at 50% 100%, rgba(255,69,0,0.2) 0%, transparent 50%), radial-gradient(circle at 20% 60%, rgba(255,140,0,0.1) 0%, transparent 40%)",
    cardStyle: "gradient", buttonStyle: "glow", animationStyle: "intense",
  },
  decorations: { headerStyle: "bold", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-b from-[#0a0000] via-[#1a0800] to-[#2d0a00]", cardBackground: "bg-[#1a0800]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-orange-700 to-red-600 hover:from-orange-600 hover:to-red-500 shadow-lg shadow-orange-600/30", buttonSecondary: "border border-orange-600/40 hover:bg-orange-900/30", textGradient: "bg-gradient-to-r from-orange-400 via-yellow-400 to-red-400 bg-clip-text text-transparent" },
};

export const neonTokyoTheme: LandingTheme = {
  id: "neon-tokyo",
  name: "Neon Tokyo",
  description: "Japanese neon cityscape at night",
  category: "gaming",
  preview: "linear-gradient(135deg, #05001a 0%, #0a0033 30%, #e91e63 60%, #00bcd4 100%)",
  colors: {
    primary: "#e91e63", primaryHover: "#f06292", secondary: "#00bcd4", accent: "#ffeb3b",
    accentGlow: "rgba(233,30,99,0.5)", background: "#05001a", backgroundSecondary: "#0a0028",
    backgroundCard: "rgba(10,0,40,0.85)", backgroundOverlay: "rgba(5,0,26,0.9)",
    text: "#f8f0ff", textMuted: "#9575cd", textAccent: "#e91e63",
    border: "rgba(233,30,99,0.25)", borderAccent: "rgba(0,188,212,0.4)",
    success: "#00e676", warning: "#ffeb3b", error: "#ff1744",
  },
  fonts: { heading: "'Rajdhani', sans-serif", body: "'Inter', sans-serif", accent: "'Share Tech Mono', monospace" },
  effects: {
    glowColor: "rgba(233,30,99,0.5)", glowIntensity: "intense", particleColor: "#e91e63",
    particleType: "dots", gradientStyle: "linear-gradient(135deg, #e91e63, #00bcd4)",
    backgroundPattern: "radial-gradient(ellipse at 30% 20%, rgba(233,30,99,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,188,212,0.1) 0%, transparent 50%)",
    cardStyle: "neon", buttonStyle: "neon", animationStyle: "dynamic",
  },
  decorations: { headerStyle: "neon", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "pill" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#05001a] via-[#0a0028] to-[#0a0033]", cardBackground: "bg-[#0a0028]/80 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 shadow-lg shadow-pink-500/25", buttonSecondary: "border border-pink-500/40 hover:bg-pink-900/20", textGradient: "bg-gradient-to-r from-pink-400 via-cyan-300 to-yellow-300 bg-clip-text text-transparent" },
};

export const pirateBayTheme: LandingTheme = {
  id: "pirate-bay",
  name: "Pirate Bay",
  description: "High seas treasure hunting adventure",
  category: "rpg",
  themeIcons: { trophy: "🏴‍☠️", battle: "⚓", users: "🦜", currency: "🪙", power: "💀", achievement: "🗺️", stats: "🧭", special: "☠️" },
  heroTextStyle: { titlePrefix: "🏴‍☠️", ctaIcon: "⚓" },
  preview: "linear-gradient(135deg, #0a1520 0%, #0d2030 40%, #1565c0 70%, #ffd54f 100%)",
  colors: {
    primary: "#1565c0", primaryHover: "#1976d2", secondary: "#ffd54f", accent: "#ff8f00",
    accentGlow: "rgba(21,101,192,0.4)", background: "#0a1015", backgroundSecondary: "#0d1a25",
    backgroundCard: "rgba(13,26,37,0.9)", backgroundOverlay: "rgba(10,16,21,0.9)",
    text: "#e8f0f8", textMuted: "#78909c", textAccent: "#ffd54f",
    border: "rgba(21,101,192,0.3)", borderAccent: "rgba(255,213,79,0.4)",
    success: "#4caf50", warning: "#ff8f00", error: "#e53935",
  },
  fonts: { heading: "'Pirata One', cursive", body: "'Inter', sans-serif", accent: "'MedievalSharp', cursive" },
  effects: {
    glowColor: "rgba(255,213,79,0.3)", glowIntensity: "medium", particleColor: "#ffd54f",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #1565c0, #ffd54f)",
    backgroundPattern: "radial-gradient(ellipse at 50% 100%, rgba(21,101,192,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,213,79,0.08) 0%, transparent 40%)",
    cardStyle: "solid", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "bold", dividerStyle: "line", iconStyle: "filled", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#0a1015] via-[#0d1a25] to-[#0d2030]", cardBackground: "bg-[#0d1a25]/90 backdrop-blur", buttonPrimary: "bg-gradient-to-r from-blue-800 to-amber-600 hover:from-blue-700 hover:to-amber-500", buttonSecondary: "border border-blue-700/50 hover:bg-blue-900/30", textGradient: "bg-gradient-to-r from-blue-300 via-amber-300 to-blue-300 bg-clip-text text-transparent" },
};

export const thunderStrikeTheme: LandingTheme = {
  id: "thunder-strike",
  name: "Thunder Strike",
  description: "Electric lightning storm energy",
  category: "sports",
  preview: "linear-gradient(135deg, #050510 0%, #0a0a30 40%, #ffd700 80%, #ffffff 100%)",
  colors: {
    primary: "#ffd700", primaryHover: "#ffe033", secondary: "#4fc3f7", accent: "#ffffff",
    accentGlow: "rgba(255,215,0,0.5)", background: "#050510", backgroundSecondary: "#0a0a20",
    backgroundCard: "rgba(10,10,32,0.9)", backgroundOverlay: "rgba(5,5,16,0.9)",
    text: "#f0f0ff", textMuted: "#8888aa", textAccent: "#ffd700",
    border: "rgba(255,215,0,0.2)", borderAccent: "rgba(79,195,247,0.4)",
    success: "#00e676", warning: "#ffd700", error: "#ff5252",
  },
  fonts: { heading: "'Oswald', sans-serif", body: "'Inter', sans-serif", accent: "'Bebas Neue', sans-serif" },
  effects: {
    glowColor: "rgba(255,215,0,0.5)", glowIntensity: "intense", particleColor: "#ffd700",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #ffd700, #4fc3f7)",
    backgroundPattern: "radial-gradient(ellipse at 50% 30%, rgba(255,215,0,0.1) 0%, transparent 50%), radial-gradient(circle at 30% 70%, rgba(79,195,247,0.08) 0%, transparent 40%)",
    cardStyle: "glass", buttonStyle: "glow", animationStyle: "intense",
  },
  decorations: { headerStyle: "bold", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "diamond" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#050510] via-[#0a0a20] to-[#0a0a30]", cardBackground: "bg-[#0a0a20]/85 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-yellow-500 to-cyan-400 hover:from-yellow-400 hover:to-cyan-300 shadow-lg shadow-yellow-500/30 text-black", buttonSecondary: "border border-yellow-500/40 hover:bg-yellow-900/20", textGradient: "bg-gradient-to-r from-yellow-300 via-white to-cyan-300 bg-clip-text text-transparent" },
};

export const enchantedForestTheme: LandingTheme = {
  id: "enchanted-forest",
  name: "Enchanted Forest",
  description: "Magical glowing forest wonderland",
  category: "rpg",
  themeIcons: { trophy: "🌟", battle: "🧝", users: "🍃", currency: "✨", power: "🦋", achievement: "🌿", stats: "🔮", special: "🌙" },
  heroTextStyle: { titlePrefix: "🌿", ctaIcon: "✨" },
  preview: "linear-gradient(135deg, #001a0a 0%, #003320 40%, #00e676 80%, #69f0ae 100%)",
  colors: {
    primary: "#00e676", primaryHover: "#69f0ae", secondary: "#b388ff", accent: "#ffeb3b",
    accentGlow: "rgba(0,230,118,0.4)", background: "#001a0a", backgroundSecondary: "#002815",
    backgroundCard: "rgba(0,40,21,0.85)", backgroundOverlay: "rgba(0,26,10,0.9)",
    text: "#e8fff0", textMuted: "#6aab85", textAccent: "#00e676",
    border: "rgba(0,230,118,0.2)", borderAccent: "rgba(179,136,255,0.4)",
    success: "#00e676", warning: "#ffeb3b", error: "#ff5252",
  },
  fonts: { heading: "'Cinzel', serif", body: "'Inter', sans-serif", accent: "'MedievalSharp', cursive" },
  effects: {
    glowColor: "rgba(0,230,118,0.4)", glowIntensity: "medium", particleColor: "#00e676",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #00e676, #b388ff)",
    backgroundPattern: "radial-gradient(ellipse at 20% 80%, rgba(0,230,118,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(179,136,255,0.08) 0%, transparent 50%)",
    cardStyle: "glass", buttonStyle: "gradient", animationStyle: "subtle",
  },
  decorations: { headerStyle: "gradient", dividerStyle: "glow", iconStyle: "duotone", badgeStyle: "hexagon" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#001a0a] via-[#002815] to-[#003320]", cardBackground: "bg-[#002815]/80 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-green-500 to-purple-400 hover:from-green-400 hover:to-purple-300", buttonSecondary: "border border-green-500/40 hover:bg-green-900/20", textGradient: "bg-gradient-to-r from-green-300 via-purple-300 to-yellow-300 bg-clip-text text-transparent" },
};

export const crystalCaveTheme: LandingTheme = {
  id: "crystal-cave",
  name: "Crystal Cave",
  description: "Shimmering gems and crystals underground",
  category: "rpg",
  themeIcons: { trophy: "💎", battle: "⛏️", users: "🔮", currency: "💠", power: "✨", achievement: "🏔️", stats: "📊", special: "🪨" },
  heroTextStyle: { titlePrefix: "💎", ctaIcon: "✨" },
  preview: "linear-gradient(135deg, #0a0020 0%, #150040 40%, #7c4dff 70%, #e040fb 100%)",
  colors: {
    primary: "#7c4dff", primaryHover: "#b388ff", secondary: "#e040fb", accent: "#00e5ff",
    accentGlow: "rgba(124,77,255,0.5)", background: "#08001a", backgroundSecondary: "#100030",
    backgroundCard: "rgba(16,0,48,0.85)", backgroundOverlay: "rgba(8,0,26,0.9)",
    text: "#f0e8ff", textMuted: "#9575cd", textAccent: "#b388ff",
    border: "rgba(124,77,255,0.25)", borderAccent: "rgba(224,64,251,0.4)",
    success: "#00e676", warning: "#ffc400", error: "#ff5252",
  },
  fonts: { heading: "'Rajdhani', sans-serif", body: "'Inter', sans-serif", accent: "'Exo 2', sans-serif" },
  effects: {
    glowColor: "rgba(124,77,255,0.5)", glowIntensity: "intense", particleColor: "#b388ff",
    particleType: "sparkles", gradientStyle: "linear-gradient(135deg, #7c4dff, #e040fb, #00e5ff)",
    backgroundPattern: "radial-gradient(ellipse at 40% 60%, rgba(124,77,255,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(224,64,251,0.1) 0%, transparent 40%), radial-gradient(circle at 20% 20%, rgba(0,229,255,0.06) 0%, transparent 30%)",
    cardStyle: "glass", buttonStyle: "glow", animationStyle: "dynamic",
  },
  decorations: { headerStyle: "neon", dividerStyle: "glow", iconStyle: "glow", badgeStyle: "diamond" },
  customClasses: { heroBackground: "bg-gradient-to-br from-[#08001a] via-[#100030] to-[#150040]", cardBackground: "bg-[#100030]/80 backdrop-blur-lg", buttonPrimary: "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 shadow-lg shadow-purple-500/30", buttonSecondary: "border border-purple-500/40 hover:bg-purple-900/20", textGradient: "bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent" },
};
