// Complete Landing Page Theme System
// Each theme completely transforms the visual appearance

export interface LandingTheme {
  id: string;
  name: string;
  description: string;
  category: 'gaming' | 'sports' | 'casino' | 'holiday' | 'futuristic' | 'classic' | 'rpg';
  
  // RPG Theme Specific - icons that replace standard trading icons
  themeIcons?: {
    trophy?: string;      // Replaces Trophy icon
    battle?: string;      // Replaces Swords/Challenge
    users?: string;       // Replaces Users/Community
    currency?: string;    // Replaces DollarSign
    power?: string;       // Replaces Zap/Energy
    achievement?: string; // Replaces Award/Medal
    stats?: string;       // Replaces BarChart
    special?: string;     // Special theme icon
  };
  
  // Theme-specific hero text replacements
  heroTextStyle?: {
    titlePrefix?: string;   // e.g., "⚔️" for warrior
    subtitleStyle?: string; // CSS class for subtitle
    ctaIcon?: string;       // Icon before CTA button text
  };
  preview: string; // Preview image/gradient
  
  // Colors
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
    accent: string;
    accentGlow: string;
    background: string;
    backgroundSecondary: string;
    backgroundCard: string;
    backgroundOverlay: string;
    text: string;
    textMuted: string;
    textAccent: string;
    border: string;
    borderAccent: string;
    success: string;
    warning: string;
    error: string;
  };
  
  // Typography
  fonts: {
    heading: string;
    body: string;
    accent: string;
  };
  
  // Visual Effects
  effects: {
    glowColor: string;
    glowIntensity: 'none' | 'subtle' | 'medium' | 'intense';
    particleColor: string;
    particleType: 'none' | 'dots' | 'stars' | 'snow' | 'confetti' | 'sparkles' | 'matrix' | 'bubbles';
    gradientStyle: string;
    backgroundPattern: string;
    cardStyle: 'flat' | 'glass' | 'neon' | 'solid' | 'gradient';
    buttonStyle: 'solid' | 'gradient' | 'outline' | 'neon' | 'glow';
    animationStyle: 'none' | 'subtle' | 'dynamic' | 'intense';
  };
  
  // Decorative Elements
  decorations: {
    headerStyle: 'minimal' | 'bold' | 'gradient' | 'neon';
    dividerStyle: 'line' | 'gradient' | 'glow' | 'none';
    iconStyle: 'outline' | 'filled' | 'duotone' | 'glow';
    badgeStyle: 'pill' | 'square' | 'diamond' | 'hexagon';
  };
  
  // Custom CSS classes
  customClasses: {
    heroBackground: string;
    cardBackground: string;
    buttonPrimary: string;
    buttonSecondary: string;
    textGradient: string;
    glowEffect: string;
    borderGlow: string;
  };
}

// ==========================================
// GAMING THEMES
// ==========================================

export const gamingNeonTheme: LandingTheme = {
  id: 'gaming-neon',
  name: 'Neon Gaming',
  description: 'Vibrant neon colors with cyberpunk aesthetics',
  category: 'gaming',
  preview: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
  
  colors: {
    primary: '#00f5ff',
    primaryHover: '#00d4dd',
    secondary: '#ff00ff',
    accent: '#ffff00',
    accentGlow: 'rgba(0, 245, 255, 0.5)',
    background: '#0a0a0f',
    backgroundSecondary: '#12121a',
    backgroundCard: 'rgba(20, 20, 35, 0.8)',
    backgroundOverlay: 'rgba(0, 0, 0, 0.7)',
    text: '#ffffff',
    textMuted: '#8888aa',
    textAccent: '#00f5ff',
    border: '#2a2a4a',
    borderAccent: '#00f5ff',
    success: '#00ff88',
    warning: '#ffaa00',
    error: '#ff0055',
  },
  
  fonts: {
    heading: '"Orbitron", "Rajdhani", sans-serif',
    body: '"Rajdhani", "Exo 2", sans-serif',
    accent: '"Press Start 2P", monospace',
  },
  
  effects: {
    glowColor: '#00f5ff',
    glowIntensity: 'intense',
    particleColor: '#00f5ff',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(135deg, #00f5ff 0%, #ff00ff 50%, #ffff00 100%)',
    backgroundPattern: 'radial-gradient(circle at 20% 80%, rgba(0, 245, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.1) 0%, transparent 50%)',
    cardStyle: 'neon',
    buttonStyle: 'neon',
    animationStyle: 'dynamic',
  },
  
  decorations: {
    headerStyle: 'neon',
    dividerStyle: 'glow',
    iconStyle: 'glow',
    badgeStyle: 'hexagon',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a1a]',
    cardBackground: 'bg-[#14142380] backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(0,245,255,0.2)]',
    buttonPrimary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold shadow-[0_0_20px_rgba(0,245,255,0.5)] hover:shadow-[0_0_30px_rgba(0,245,255,0.8)]',
    buttonSecondary: 'border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500/20 shadow-[0_0_15px_rgba(0,245,255,0.3)]',
    textGradient: 'bg-gradient-to-r from-cyan-400 via-purple-500 to-yellow-400 bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(0,245,255,0.8)]',
    borderGlow: 'shadow-[0_0_15px_rgba(0,245,255,0.5),inset_0_0_15px_rgba(0,245,255,0.1)]',
  },
};

export const retroArcadeTheme: LandingTheme = {
  id: 'retro-arcade',
  name: 'Retro Arcade',
  description: '8-bit inspired with pixel art aesthetics',
  category: 'gaming',
  preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  
  colors: {
    primary: '#ff6b6b',
    primaryHover: '#ff5252',
    secondary: '#4ecdc4',
    accent: '#ffe66d',
    accentGlow: 'rgba(255, 107, 107, 0.5)',
    background: '#1a1a2e',
    backgroundSecondary: '#16213e',
    backgroundCard: 'rgba(22, 33, 62, 0.9)',
    backgroundOverlay: 'rgba(26, 26, 46, 0.8)',
    text: '#ffffff',
    textMuted: '#a8a8c8',
    textAccent: '#ffe66d',
    border: '#2d3561',
    borderAccent: '#ff6b6b',
    success: '#4ecdc4',
    warning: '#ffe66d',
    error: '#ff6b6b',
  },
  
  fonts: {
    heading: '"Press Start 2P", "VT323", monospace',
    body: '"VT323", "Courier New", monospace',
    accent: '"Press Start 2P", monospace',
  },
  
  effects: {
    glowColor: '#ff6b6b',
    glowIntensity: 'medium',
    particleColor: '#ffe66d',
    particleType: 'dots',
    gradientStyle: 'linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 50%, #ffe66d 100%)',
    backgroundPattern: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
    cardStyle: 'solid',
    buttonStyle: 'solid',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'bold',
    dividerStyle: 'line',
    iconStyle: 'filled',
    badgeStyle: 'square',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
    cardBackground: 'bg-[#16213e] border-4 border-[#ff6b6b] shadow-[4px_4px_0px_#ff6b6b]',
    buttonPrimary: 'bg-[#ff6b6b] hover:bg-[#ff5252] text-white font-bold border-4 border-[#ff5252] shadow-[4px_4px_0px_#4ecdc4] hover:shadow-[2px_2px_0px_#4ecdc4] hover:translate-x-[2px] hover:translate-y-[2px]',
    buttonSecondary: 'bg-transparent border-4 border-[#4ecdc4] text-[#4ecdc4] hover:bg-[#4ecdc4] hover:text-[#1a1a2e] shadow-[4px_4px_0px_#ffe66d]',
    textGradient: 'bg-gradient-to-r from-[#ff6b6b] via-[#4ecdc4] to-[#ffe66d] bg-clip-text text-transparent',
    glowEffect: '',
    borderGlow: '',
  },
};

export const rgbGamingTheme: LandingTheme = {
  id: 'rgb-gaming',
  name: 'RGB Gaming',
  description: 'Animated RGB lighting effects like gaming peripherals',
  category: 'gaming',
  preview: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff, #ff0000)',
  
  colors: {
    primary: '#ff0080',
    primaryHover: '#ff00a0',
    secondary: '#00ff80',
    accent: '#8000ff',
    accentGlow: 'rgba(255, 0, 128, 0.5)',
    background: '#050510',
    backgroundSecondary: '#0a0a1a',
    backgroundCard: 'rgba(10, 10, 30, 0.9)',
    backgroundOverlay: 'rgba(5, 5, 16, 0.8)',
    text: '#ffffff',
    textMuted: '#8080a0',
    textAccent: '#ff0080',
    border: '#1a1a3a',
    borderAccent: '#ff0080',
    success: '#00ff80',
    warning: '#ffff00',
    error: '#ff0040',
  },
  
  fonts: {
    heading: '"Exo 2", "Orbitron", sans-serif',
    body: '"Exo 2", "Inter", sans-serif',
    accent: '"Orbitron", monospace',
  },
  
  effects: {
    glowColor: '#ff0080',
    glowIntensity: 'intense',
    particleColor: '#ffffff',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #00ffff, #0000ff, #8b00ff)',
    backgroundPattern: 'radial-gradient(ellipse at 50% 0%, rgba(255,0,128,0.15) 0%, transparent 50%)',
    cardStyle: 'glass',
    buttonStyle: 'glow',
    animationStyle: 'intense',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'gradient',
    iconStyle: 'glow',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-[#050510] relative before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,0,128,0.15)_0%,transparent_50%)]',
    cardBackground: 'bg-[#0a0a1a80] backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(255,0,128,0.1)]',
    buttonPrimary: 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-[length:200%_auto] animate-gradient hover:animate-none text-white font-bold shadow-[0_0_30px_rgba(255,0,128,0.5)]',
    buttonSecondary: 'border border-white/30 text-white hover:border-pink-500 hover:text-pink-500 hover:shadow-[0_0_20px_rgba(255,0,128,0.3)]',
    textGradient: 'bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 to-purple-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient',
    glowEffect: 'drop-shadow-[0_0_20px_rgba(255,0,128,0.8)]',
    borderGlow: 'shadow-[0_0_20px_rgba(255,0,128,0.3),0_0_40px_rgba(128,0,255,0.2),0_0_60px_rgba(0,255,128,0.1)]',
  },
};

// ==========================================
// FUTURISTIC THEMES
// ==========================================

export const cyberpunkTheme: LandingTheme = {
  id: 'cyberpunk',
  name: 'Cyberpunk 2077',
  description: 'High-tech low-life dystopian future',
  category: 'futuristic',
  preview: 'linear-gradient(135deg, #0d0d0d 0%, #1a0a2e 50%, #2d1b4e 100%)',
  
  colors: {
    primary: '#fcee09',
    primaryHover: '#e0d400',
    secondary: '#00f0ff',
    accent: '#ff2a6d',
    accentGlow: 'rgba(252, 238, 9, 0.5)',
    background: '#0d0d0d',
    backgroundSecondary: '#1a1a1a',
    backgroundCard: 'rgba(26, 10, 46, 0.8)',
    backgroundOverlay: 'rgba(13, 13, 13, 0.9)',
    text: '#ffffff',
    textMuted: '#888899',
    textAccent: '#fcee09',
    border: '#2d1b4e',
    borderAccent: '#fcee09',
    success: '#00f0ff',
    warning: '#fcee09',
    error: '#ff2a6d',
  },
  
  fonts: {
    heading: '"Rajdhani", "Orbitron", sans-serif',
    body: '"Rajdhani", "Exo 2", sans-serif',
    accent: '"Orbitron", monospace',
  },
  
  effects: {
    glowColor: '#fcee09',
    glowIntensity: 'intense',
    particleColor: '#fcee09',
    particleType: 'matrix',
    gradientStyle: 'linear-gradient(135deg, #fcee09 0%, #00f0ff 50%, #ff2a6d 100%)',
    backgroundPattern: 'linear-gradient(0deg, transparent 24%, rgba(252,238,9,0.05) 25%, rgba(252,238,9,0.05) 26%, transparent 27%, transparent 74%, rgba(252,238,9,0.05) 75%, rgba(252,238,9,0.05) 76%, transparent 77%), linear-gradient(90deg, transparent 24%, rgba(252,238,9,0.05) 25%, rgba(252,238,9,0.05) 26%, transparent 27%, transparent 74%, rgba(252,238,9,0.05) 75%, rgba(252,238,9,0.05) 76%, transparent 77%)',
    cardStyle: 'neon',
    buttonStyle: 'neon',
    animationStyle: 'dynamic',
  },
  
  decorations: {
    headerStyle: 'neon',
    dividerStyle: 'glow',
    iconStyle: 'glow',
    badgeStyle: 'diamond',
  },
  
  customClasses: {
    heroBackground: 'bg-[#0d0d0d] bg-[size:50px_50px]',
    cardBackground: 'bg-[#1a0a2e80] backdrop-blur-xl border-l-4 border-[#fcee09] shadow-[0_0_30px_rgba(252,238,9,0.2)]',
    buttonPrimary: 'bg-[#fcee09] hover:bg-[#e0d400] text-black font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(252,238,9,0.5)] hover:shadow-[0_0_40px_rgba(252,238,9,0.8)]',
    buttonSecondary: 'border-2 border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff]/20 uppercase tracking-wider',
    textGradient: 'bg-gradient-to-r from-[#fcee09] via-[#00f0ff] to-[#ff2a6d] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(252,238,9,0.8)] drop-shadow-[0_0_20px_rgba(252,238,9,0.4)]',
    borderGlow: 'shadow-[0_0_20px_rgba(252,238,9,0.4),inset_0_1px_0_rgba(252,238,9,0.2)]',
  },
};

export const holographicTheme: LandingTheme = {
  id: 'holographic',
  name: 'Holographic',
  description: 'Iridescent holographic display aesthetics',
  category: 'futuristic',
  preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
  
  colors: {
    primary: '#667eea',
    primaryHover: '#5a6fd6',
    secondary: '#f093fb',
    accent: '#4facfe',
    accentGlow: 'rgba(102, 126, 234, 0.5)',
    background: '#0f0f1a',
    backgroundSecondary: '#1a1a2e',
    backgroundCard: 'rgba(15, 15, 26, 0.6)',
    backgroundOverlay: 'rgba(15, 15, 26, 0.8)',
    text: '#ffffff',
    textMuted: '#9090b0',
    textAccent: '#f093fb',
    border: '#2a2a4a',
    borderAccent: '#667eea',
    success: '#4facfe',
    warning: '#f5576c',
    error: '#ff6b6b',
  },
  
  fonts: {
    heading: '"Space Grotesk", "Inter", sans-serif',
    body: '"Inter", "Helvetica Neue", sans-serif',
    accent: '"Space Mono", monospace',
  },
  
  effects: {
    glowColor: '#667eea',
    glowIntensity: 'medium',
    particleColor: '#f093fb',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
    backgroundPattern: 'radial-gradient(ellipse at 30% 20%, rgba(102,126,234,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(240,147,251,0.15) 0%, transparent 50%)',
    cardStyle: 'glass',
    buttonStyle: 'gradient',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'gradient',
    iconStyle: 'duotone',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-[#0f0f1a]',
    cardBackground: 'bg-white/5 backdrop-blur-xl border border-white/10 hover:border-purple-500/50',
    buttonPrimary: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white font-semibold',
    buttonSecondary: 'border border-purple-500/50 text-purple-300 hover:bg-purple-500/20',
    textGradient: 'bg-gradient-to-r from-indigo-400 via-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(102,126,234,0.6)]',
    borderGlow: 'shadow-[0_0_30px_rgba(102,126,234,0.2),0_0_60px_rgba(240,147,251,0.1)]',
  },
};

// ==========================================
// SPORTS BETTING THEMES
// ==========================================

export const sportsBettingTheme: LandingTheme = {
  id: 'sports-betting',
  name: 'Sports Betting',
  description: 'Professional sports betting platform style',
  category: 'sports',
  preview: 'linear-gradient(135deg, #1e3a5f 0%, #0d1f2d 50%, #1a1a2e 100%)',
  
  colors: {
    primary: '#00c853',
    primaryHover: '#00e676',
    secondary: '#ff6d00',
    accent: '#ffd600',
    accentGlow: 'rgba(0, 200, 83, 0.5)',
    background: '#0d1f2d',
    backgroundSecondary: '#1e3a5f',
    backgroundCard: 'rgba(30, 58, 95, 0.8)',
    backgroundOverlay: 'rgba(13, 31, 45, 0.9)',
    text: '#ffffff',
    textMuted: '#8899aa',
    textAccent: '#00c853',
    border: '#2a4a6a',
    borderAccent: '#00c853',
    success: '#00c853',
    warning: '#ffd600',
    error: '#ff1744',
  },
  
  fonts: {
    heading: '"Roboto Condensed", "Impact", sans-serif',
    body: '"Roboto", "Helvetica Neue", sans-serif',
    accent: '"Roboto Mono", monospace',
  },
  
  effects: {
    glowColor: '#00c853',
    glowIntensity: 'subtle',
    particleColor: '#ffd600',
    particleType: 'none',
    gradientStyle: 'linear-gradient(135deg, #00c853 0%, #ffd600 100%)',
    backgroundPattern: '',
    cardStyle: 'solid',
    buttonStyle: 'solid',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'bold',
    dividerStyle: 'line',
    iconStyle: 'filled',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0d1f2d] via-[#1e3a5f] to-[#0d1f2d]',
    cardBackground: 'bg-[#1e3a5f] border border-[#2a4a6a] hover:border-[#00c853]',
    buttonPrimary: 'bg-[#00c853] hover:bg-[#00e676] text-white font-bold uppercase',
    buttonSecondary: 'border-2 border-[#ff6d00] text-[#ff6d00] hover:bg-[#ff6d00] hover:text-white uppercase',
    textGradient: 'bg-gradient-to-r from-[#00c853] to-[#ffd600] bg-clip-text text-transparent',
    glowEffect: '',
    borderGlow: '',
  },
};

export const championshipTheme: LandingTheme = {
  id: 'championship',
  name: 'Championship Gold',
  description: 'Premium championship trophy aesthetics',
  category: 'sports',
  preview: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #ffd700 100%)',
  
  colors: {
    primary: '#ffd700',
    primaryHover: '#ffed4a',
    secondary: '#c0c0c0',
    accent: '#cd7f32',
    accentGlow: 'rgba(255, 215, 0, 0.5)',
    background: '#0a0a0a',
    backgroundSecondary: '#1a1a1a',
    backgroundCard: 'rgba(26, 26, 26, 0.9)',
    backgroundOverlay: 'rgba(10, 10, 10, 0.9)',
    text: '#ffffff',
    textMuted: '#888888',
    textAccent: '#ffd700',
    border: '#333333',
    borderAccent: '#ffd700',
    success: '#ffd700',
    warning: '#ff8c00',
    error: '#dc3545',
  },
  
  fonts: {
    heading: '"Cinzel", "Times New Roman", serif',
    body: '"Lato", "Helvetica Neue", sans-serif',
    accent: '"Cinzel Decorative", serif',
  },
  
  effects: {
    glowColor: '#ffd700',
    glowIntensity: 'medium',
    particleColor: '#ffd700',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(135deg, #ffd700 0%, #c0c0c0 50%, #cd7f32 100%)',
    backgroundPattern: 'radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.1) 0%, transparent 50%)',
    cardStyle: 'gradient',
    buttonStyle: 'gradient',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'gradient',
    iconStyle: 'filled',
    badgeStyle: 'diamond',
  },
  
  customClasses: {
    heroBackground: 'bg-[#0a0a0a]',
    cardBackground: 'bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#ffd700]/30 hover:border-[#ffd700]',
    buttonPrimary: 'bg-gradient-to-r from-[#ffd700] via-[#ffed4a] to-[#ffd700] hover:from-[#ffed4a] hover:via-[#fff68f] hover:to-[#ffed4a] text-black font-bold',
    buttonSecondary: 'border-2 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/20',
    textGradient: 'bg-gradient-to-r from-[#ffd700] via-[#fff68f] to-[#ffd700] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]',
    borderGlow: 'shadow-[0_0_20px_rgba(255,215,0,0.3)]',
  },
};

// ==========================================
// CASINO THEMES
// ==========================================

export const casinoRoyaleTheme: LandingTheme = {
  id: 'casino-royale',
  name: 'Casino Royale',
  description: 'Luxurious Vegas casino experience',
  category: 'casino',
  preview: 'linear-gradient(135deg, #1a0000 0%, #2d0a0a 50%, #8b0000 100%)',
  
  colors: {
    primary: '#dc143c',
    primaryHover: '#ff1744',
    secondary: '#ffd700',
    accent: '#00ff00',
    accentGlow: 'rgba(220, 20, 60, 0.5)',
    background: '#0a0505',
    backgroundSecondary: '#1a0a0a',
    backgroundCard: 'rgba(45, 10, 10, 0.9)',
    backgroundOverlay: 'rgba(10, 5, 5, 0.9)',
    text: '#ffffff',
    textMuted: '#aa8888',
    textAccent: '#ffd700',
    border: '#4a1a1a',
    borderAccent: '#dc143c',
    success: '#00ff00',
    warning: '#ffd700',
    error: '#dc143c',
  },
  
  fonts: {
    heading: '"Playfair Display", "Georgia", serif',
    body: '"Lato", "Helvetica Neue", sans-serif',
    accent: '"Cinzel", serif',
  },
  
  effects: {
    glowColor: '#dc143c',
    glowIntensity: 'medium',
    particleColor: '#ffd700',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(135deg, #dc143c 0%, #ffd700 50%, #00ff00 100%)',
    backgroundPattern: 'radial-gradient(ellipse at 50% 100%, rgba(220,20,60,0.2) 0%, transparent 50%)',
    cardStyle: 'gradient',
    buttonStyle: 'gradient',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'gradient',
    iconStyle: 'filled',
    badgeStyle: 'diamond',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a0505] via-[#1a0a0a] to-[#0a0505]',
    cardBackground: 'bg-gradient-to-br from-[#2d0a0a] to-[#1a0505] border border-[#dc143c]/30 hover:border-[#ffd700]',
    buttonPrimary: 'bg-gradient-to-r from-[#dc143c] to-[#8b0000] hover:from-[#ff1744] hover:to-[#dc143c] text-white font-bold',
    buttonSecondary: 'border-2 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/20',
    textGradient: 'bg-gradient-to-r from-[#dc143c] via-[#ffd700] to-[#dc143c] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(220,20,60,0.6)]',
    borderGlow: 'shadow-[0_0_20px_rgba(220,20,60,0.3),0_0_40px_rgba(255,215,0,0.1)]',
  },
};

export const vegasNightTheme: LandingTheme = {
  id: 'vegas-night',
  name: 'Vegas Nights',
  description: 'Neon-lit Las Vegas strip vibes',
  category: 'casino',
  preview: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b69 100%)',
  
  colors: {
    primary: '#ff00ff',
    primaryHover: '#ff33ff',
    secondary: '#00ffff',
    accent: '#ffff00',
    accentGlow: 'rgba(255, 0, 255, 0.5)',
    background: '#0a0a15',
    backgroundSecondary: '#15152a',
    backgroundCard: 'rgba(26, 26, 62, 0.8)',
    backgroundOverlay: 'rgba(10, 10, 21, 0.9)',
    text: '#ffffff',
    textMuted: '#9090c0',
    textAccent: '#ff00ff',
    border: '#3a3a6a',
    borderAccent: '#ff00ff',
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff0066',
  },
  
  fonts: {
    heading: '"Righteous", "Impact", sans-serif',
    body: '"Nunito", "Helvetica Neue", sans-serif',
    accent: '"Monoton", cursive',
  },
  
  effects: {
    glowColor: '#ff00ff',
    glowIntensity: 'intense',
    particleColor: '#ffff00',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(90deg, #ff00ff, #00ffff, #ffff00, #ff00ff)',
    backgroundPattern: 'radial-gradient(circle at 20% 20%, rgba(255,0,255,0.1) 0%, transparent 30%), radial-gradient(circle at 80% 80%, rgba(0,255,255,0.1) 0%, transparent 30%)',
    cardStyle: 'neon',
    buttonStyle: 'neon',
    animationStyle: 'dynamic',
  },
  
  decorations: {
    headerStyle: 'neon',
    dividerStyle: 'glow',
    iconStyle: 'glow',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-[#0a0a15]',
    cardBackground: 'bg-[#15152a80] backdrop-blur-xl border border-[#ff00ff]/30 shadow-[0_0_30px_rgba(255,0,255,0.2)]',
    buttonPrimary: 'bg-[#ff00ff] hover:bg-[#ff33ff] text-white font-bold shadow-[0_0_20px_rgba(255,0,255,0.5)] hover:shadow-[0_0_40px_rgba(255,0,255,0.8)]',
    buttonSecondary: 'border-2 border-[#00ffff] text-[#00ffff] hover:bg-[#00ffff]/20 shadow-[0_0_15px_rgba(0,255,255,0.3)]',
    textGradient: 'bg-gradient-to-r from-[#ff00ff] via-[#00ffff] to-[#ffff00] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(255,0,255,0.8)]',
    borderGlow: 'shadow-[0_0_20px_rgba(255,0,255,0.4),0_0_40px_rgba(0,255,255,0.2)]',
  },
};

// ==========================================
// HOLIDAY THEMES
// ==========================================

export const christmasTheme: LandingTheme = {
  id: 'christmas',
  name: 'Christmas Spirit',
  description: 'Festive holiday celebration theme',
  category: 'holiday',
  preview: 'linear-gradient(135deg, #165b33 0%, #bb2528 50%, #f8b229 100%)',
  
  colors: {
    primary: '#bb2528',
    primaryHover: '#d42d30',
    secondary: '#165b33',
    accent: '#f8b229',
    accentGlow: 'rgba(187, 37, 40, 0.5)',
    background: '#0a1a12',
    backgroundSecondary: '#122a1a',
    backgroundCard: 'rgba(22, 91, 51, 0.3)',
    backgroundOverlay: 'rgba(10, 26, 18, 0.9)',
    text: '#ffffff',
    textMuted: '#88aa88',
    textAccent: '#f8b229',
    border: '#2a4a2a',
    borderAccent: '#bb2528',
    success: '#165b33',
    warning: '#f8b229',
    error: '#bb2528',
  },
  
  fonts: {
    heading: '"Mountains of Christmas", "Comic Sans MS", cursive',
    body: '"Nunito", "Arial", sans-serif',
    accent: '"Great Vibes", cursive',
  },
  
  effects: {
    glowColor: '#f8b229',
    glowIntensity: 'medium',
    particleColor: '#ffffff',
    particleType: 'snow',
    gradientStyle: 'linear-gradient(135deg, #bb2528 0%, #165b33 50%, #f8b229 100%)',
    backgroundPattern: 'radial-gradient(circle at 30% 30%, rgba(248,178,41,0.1) 0%, transparent 30%), radial-gradient(circle at 70% 70%, rgba(187,37,40,0.1) 0%, transparent 30%)',
    cardStyle: 'glass',
    buttonStyle: 'gradient',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'gradient',
    iconStyle: 'filled',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a1a12] via-[#122a1a] to-[#0a1210]',
    cardBackground: 'bg-[#165b3330] backdrop-blur-xl border border-[#f8b229]/30 hover:border-[#f8b229]',
    buttonPrimary: 'bg-gradient-to-r from-[#bb2528] to-[#8b1a1d] hover:from-[#d42d30] hover:to-[#bb2528] text-white font-bold',
    buttonSecondary: 'border-2 border-[#165b33] text-[#165b33] hover:bg-[#165b33] hover:text-white',
    textGradient: 'bg-gradient-to-r from-[#bb2528] via-[#f8b229] to-[#165b33] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(248,178,41,0.6)]',
    borderGlow: 'shadow-[0_0_20px_rgba(248,178,41,0.2)]',
  },
};

export const easterTheme: LandingTheme = {
  id: 'easter',
  name: 'Easter Spring',
  description: 'Bright pastel spring celebration',
  category: 'holiday',
  preview: 'linear-gradient(135deg, #ffd1dc 0%, #e6e6fa 50%, #98fb98 100%)',
  
  colors: {
    primary: '#ff69b4',
    primaryHover: '#ff85c1',
    secondary: '#87ceeb',
    accent: '#ffd700',
    accentGlow: 'rgba(255, 105, 180, 0.5)',
    background: '#1a1520',
    backgroundSecondary: '#2a2030',
    backgroundCard: 'rgba(42, 32, 48, 0.8)',
    backgroundOverlay: 'rgba(26, 21, 32, 0.9)',
    text: '#ffffff',
    textMuted: '#b8a8c8',
    textAccent: '#ff69b4',
    border: '#4a3a5a',
    borderAccent: '#ff69b4',
    success: '#98fb98',
    warning: '#ffd700',
    error: '#ff6b6b',
  },
  
  fonts: {
    heading: '"Pacifico", "Comic Sans MS", cursive',
    body: '"Quicksand", "Arial", sans-serif',
    accent: '"Dancing Script", cursive',
  },
  
  effects: {
    glowColor: '#ff69b4',
    glowIntensity: 'subtle',
    particleColor: '#ffd1dc',
    particleType: 'confetti',
    gradientStyle: 'linear-gradient(135deg, #ff69b4 0%, #87ceeb 50%, #98fb98 100%)',
    backgroundPattern: 'radial-gradient(ellipse at 30% 30%, rgba(255,105,180,0.1) 0%, transparent 40%), radial-gradient(ellipse at 70% 70%, rgba(135,206,235,0.1) 0%, transparent 40%)',
    cardStyle: 'glass',
    buttonStyle: 'gradient',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'gradient',
    iconStyle: 'duotone',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#1a1520] via-[#2a2030] to-[#1a2020]',
    cardBackground: 'bg-[#2a203080] backdrop-blur-xl border border-[#ff69b4]/20 hover:border-[#ff69b4]/50',
    buttonPrimary: 'bg-gradient-to-r from-[#ff69b4] to-[#ff85c1] hover:from-[#ff85c1] hover:to-[#ffa0d0] text-white font-semibold',
    buttonSecondary: 'border-2 border-[#87ceeb] text-[#87ceeb] hover:bg-[#87ceeb]/20',
    textGradient: 'bg-gradient-to-r from-[#ff69b4] via-[#87ceeb] to-[#98fb98] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(255,105,180,0.4)]',
    borderGlow: 'shadow-[0_0_15px_rgba(255,105,180,0.2)]',
  },
};

export const blackFridayTheme: LandingTheme = {
  id: 'black-friday',
  name: 'Black Friday',
  description: 'High-impact sales and deals theme',
  category: 'holiday',
  preview: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #ff0000 100%)',
  
  colors: {
    primary: '#ff0000',
    primaryHover: '#ff3333',
    secondary: '#ffd700',
    accent: '#ffffff',
    accentGlow: 'rgba(255, 0, 0, 0.5)',
    background: '#000000',
    backgroundSecondary: '#0a0a0a',
    backgroundCard: 'rgba(26, 26, 26, 0.9)',
    backgroundOverlay: 'rgba(0, 0, 0, 0.95)',
    text: '#ffffff',
    textMuted: '#888888',
    textAccent: '#ff0000',
    border: '#333333',
    borderAccent: '#ff0000',
    success: '#00ff00',
    warning: '#ffd700',
    error: '#ff0000',
  },
  
  fonts: {
    heading: '"Impact", "Arial Black", sans-serif',
    body: '"Roboto", "Helvetica Neue", sans-serif',
    accent: '"Bebas Neue", sans-serif',
  },
  
  effects: {
    glowColor: '#ff0000',
    glowIntensity: 'intense',
    particleColor: '#ffd700',
    particleType: 'confetti',
    gradientStyle: 'linear-gradient(135deg, #ff0000 0%, #ffd700 100%)',
    backgroundPattern: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,0,0,0.03) 20px, rgba(255,0,0,0.03) 40px)',
    cardStyle: 'solid',
    buttonStyle: 'solid',
    animationStyle: 'dynamic',
  },
  
  decorations: {
    headerStyle: 'bold',
    dividerStyle: 'line',
    iconStyle: 'filled',
    badgeStyle: 'square',
  },
  
  customClasses: {
    heroBackground: 'bg-black',
    cardBackground: 'bg-[#1a1a1a] border-2 border-[#ff0000]',
    buttonPrimary: 'bg-[#ff0000] hover:bg-[#ff3333] text-white font-black uppercase tracking-wider',
    buttonSecondary: 'border-4 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700] hover:text-black font-black uppercase',
    textGradient: 'bg-gradient-to-r from-[#ff0000] to-[#ffd700] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]',
    borderGlow: 'shadow-[0_0_30px_rgba(255,0,0,0.5)]',
  },
};

export const halloweenTheme: LandingTheme = {
  id: 'halloween',
  name: 'Halloween Spooky',
  description: 'Spooky Halloween night theme',
  category: 'holiday',
  preview: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #ff6600 100%)',
  
  colors: {
    primary: '#ff6600',
    primaryHover: '#ff8533',
    secondary: '#8b00ff',
    accent: '#00ff00',
    accentGlow: 'rgba(255, 102, 0, 0.5)',
    background: '#0a050f',
    backgroundSecondary: '#150a1f',
    backgroundCard: 'rgba(26, 10, 46, 0.8)',
    backgroundOverlay: 'rgba(10, 5, 15, 0.9)',
    text: '#ffffff',
    textMuted: '#9080a0',
    textAccent: '#ff6600',
    border: '#3a2a4a',
    borderAccent: '#ff6600',
    success: '#00ff00',
    warning: '#ff6600',
    error: '#ff0000',
  },
  
  fonts: {
    heading: '"Creepster", "Impact", cursive',
    body: '"Nunito", "Arial", sans-serif',
    accent: '"Nosifer", cursive',
  },
  
  effects: {
    glowColor: '#ff6600',
    glowIntensity: 'medium',
    particleColor: '#ff6600',
    particleType: 'sparkles',
    gradientStyle: 'linear-gradient(135deg, #ff6600 0%, #8b00ff 50%, #00ff00 100%)',
    backgroundPattern: 'radial-gradient(ellipse at 50% 100%, rgba(139,0,255,0.2) 0%, transparent 50%)',
    cardStyle: 'glass',
    buttonStyle: 'gradient',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'gradient',
    dividerStyle: 'glow',
    iconStyle: 'filled',
    badgeStyle: 'hexagon',
  },
  
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a050f] via-[#150a1f] to-[#0a0510]',
    cardBackground: 'bg-[#1a0a2e80] backdrop-blur-xl border border-[#ff6600]/30 hover:border-[#ff6600]',
    buttonPrimary: 'bg-gradient-to-r from-[#ff6600] to-[#ff3300] hover:from-[#ff8533] hover:to-[#ff6600] text-white font-bold',
    buttonSecondary: 'border-2 border-[#8b00ff] text-[#8b00ff] hover:bg-[#8b00ff]/20',
    textGradient: 'bg-gradient-to-r from-[#ff6600] via-[#8b00ff] to-[#00ff00] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(255,102,0,0.6)]',
    borderGlow: 'shadow-[0_0_20px_rgba(255,102,0,0.3),0_0_40px_rgba(139,0,255,0.2)]',
  },
};

// ==========================================
// CLASSIC THEMES
// ==========================================

export const minimalDarkTheme: LandingTheme = {
  id: 'minimal-dark',
  name: 'Minimal Dark',
  description: 'Clean, professional dark theme',
  category: 'classic',
  preview: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #3a3a3a 100%)',
  
  colors: {
    primary: '#ffffff',
    primaryHover: '#e0e0e0',
    secondary: '#888888',
    accent: '#4a9eff',
    accentGlow: 'rgba(255, 255, 255, 0.3)',
    background: '#0a0a0a',
    backgroundSecondary: '#141414',
    backgroundCard: 'rgba(26, 26, 26, 0.8)',
    backgroundOverlay: 'rgba(10, 10, 10, 0.9)',
    text: '#ffffff',
    textMuted: '#888888',
    textAccent: '#4a9eff',
    border: '#2a2a2a',
    borderAccent: '#ffffff',
    success: '#00c853',
    warning: '#ffc107',
    error: '#ff5252',
  },
  
  fonts: {
    heading: '"Inter", "Helvetica Neue", sans-serif',
    body: '"Inter", "Helvetica Neue", sans-serif',
    accent: '"JetBrains Mono", monospace',
  },
  
  effects: {
    glowColor: '#ffffff',
    glowIntensity: 'none',
    particleColor: '#ffffff',
    particleType: 'none',
    gradientStyle: 'linear-gradient(135deg, #ffffff 0%, #888888 100%)',
    backgroundPattern: '',
    cardStyle: 'flat',
    buttonStyle: 'solid',
    animationStyle: 'subtle',
  },
  
  decorations: {
    headerStyle: 'minimal',
    dividerStyle: 'line',
    iconStyle: 'outline',
    badgeStyle: 'pill',
  },
  
  customClasses: {
    heroBackground: 'bg-[#0a0a0a]',
    cardBackground: 'bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a]',
    buttonPrimary: 'bg-white hover:bg-gray-100 text-black font-medium',
    buttonSecondary: 'border border-white/30 text-white hover:bg-white/10',
    textGradient: 'text-white',
    glowEffect: '',
    borderGlow: '',
  },
};

// ==========================================
// NEW THEMES - 10 Additional
// ==========================================

export const oceanDepthTheme: LandingTheme = {
  id: 'ocean-depth',
  name: 'Ocean Depth',
  description: 'Deep sea underwater aesthetic',
  category: 'futuristic',
  preview: 'linear-gradient(135deg, #001a33 0%, #003366 50%, #004d99 100%)',
  colors: {
    primary: '#00d4ff', primaryHover: '#00b8e6', secondary: '#0099cc',
    accent: '#00ffcc', accentGlow: 'rgba(0, 212, 255, 0.5)',
    background: '#001122', backgroundSecondary: '#002244',
    backgroundCard: 'rgba(0, 68, 136, 0.4)', backgroundOverlay: 'rgba(0, 17, 34, 0.9)',
    text: '#ffffff', textMuted: '#66b3cc', textAccent: '#00ffcc',
    border: '#004488', borderAccent: '#00d4ff',
    success: '#00ff99', warning: '#ffcc00', error: '#ff6666',
  },
  fonts: { heading: '"Exo 2", sans-serif', body: '"Lato", sans-serif', accent: '"Orbitron", monospace' },
  effects: {
    glowColor: '#00d4ff', glowIntensity: 'medium', particleColor: '#00ffcc',
    particleType: 'bubbles', gradientStyle: 'linear-gradient(135deg, #00d4ff 0%, #00ffcc 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'glow', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#001122] via-[#002244] to-[#003355]',
    cardBackground: 'bg-[#00336680] backdrop-blur-xl border border-[#00d4ff]/30',
    buttonPrimary: 'bg-gradient-to-r from-[#00d4ff] to-[#00ffcc] text-black font-bold',
    buttonSecondary: 'border-2 border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff]/20',
    textGradient: 'bg-gradient-to-r from-[#00d4ff] to-[#00ffcc] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(0,212,255,0.6)]',
    borderGlow: 'shadow-[0_0_20px_rgba(0,212,255,0.3)]',
  },
};

export const fireStormTheme: LandingTheme = {
  id: 'fire-storm',
  name: 'Fire Storm',
  description: 'Intense fiery volcanic theme',
  category: 'gaming',
  preview: 'linear-gradient(135deg, #1a0000 0%, #330000 50%, #660000 100%)',
  colors: {
    primary: '#ff4400', primaryHover: '#ff6633', secondary: '#ff8800',
    accent: '#ffcc00', accentGlow: 'rgba(255, 68, 0, 0.5)',
    background: '#0f0505', backgroundSecondary: '#1a0a0a',
    backgroundCard: 'rgba(51, 17, 0, 0.6)', backgroundOverlay: 'rgba(15, 5, 5, 0.9)',
    text: '#ffffff', textMuted: '#cc8866', textAccent: '#ff8800',
    border: '#441100', borderAccent: '#ff4400',
    success: '#44ff00', warning: '#ffcc00', error: '#ff0044',
  },
  fonts: { heading: '"Bebas Neue", sans-serif', body: '"Roboto Condensed", sans-serif', accent: '"Rajdhani", sans-serif' },
  effects: {
    glowColor: '#ff4400', glowIntensity: 'intense', particleColor: '#ff8800',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #ff4400 0%, #ffcc00 100%)',
    backgroundPattern: '', cardStyle: 'neon', buttonStyle: 'glow', animationStyle: 'intense',
  },
  decorations: { headerStyle: 'bold', dividerStyle: 'glow', iconStyle: 'filled', badgeStyle: 'hexagon' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0f0505] via-[#1a0a0a] to-[#330a00]',
    cardBackground: 'bg-[#33110080] backdrop-blur-xl border border-[#ff4400]/40',
    buttonPrimary: 'bg-gradient-to-r from-[#ff4400] to-[#ff8800] text-white font-bold',
    buttonSecondary: 'border-2 border-[#ff4400] text-[#ff4400] hover:bg-[#ff4400]/20',
    textGradient: 'bg-gradient-to-r from-[#ff4400] via-[#ff8800] to-[#ffcc00] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_20px_rgba(255,68,0,0.7)]',
    borderGlow: 'shadow-[0_0_30px_rgba(255,68,0,0.4)]',
  },
};

export const matrixTheme: LandingTheme = {
  id: 'matrix',
  name: 'Matrix Code',
  description: 'Classic Matrix digital rain aesthetic',
  category: 'futuristic',
  preview: 'linear-gradient(135deg, #000500 0%, #001a00 50%, #003300 100%)',
  colors: {
    primary: '#00ff00', primaryHover: '#33ff33', secondary: '#00cc00',
    accent: '#88ff88', accentGlow: 'rgba(0, 255, 0, 0.5)',
    background: '#000500', backgroundSecondary: '#001000',
    backgroundCard: 'rgba(0, 26, 0, 0.8)', backgroundOverlay: 'rgba(0, 5, 0, 0.95)',
    text: '#00ff00', textMuted: '#008800', textAccent: '#88ff88',
    border: '#004400', borderAccent: '#00ff00',
    success: '#00ff00', warning: '#88ff00', error: '#ff0000',
  },
  fonts: { heading: '"VT323", monospace', body: '"JetBrains Mono", monospace', accent: '"Press Start 2P", monospace' },
  effects: {
    glowColor: '#00ff00', glowIntensity: 'intense', particleColor: '#00ff00',
    particleType: 'matrix', gradientStyle: 'linear-gradient(135deg, #00ff00 0%, #88ff88 100%)',
    backgroundPattern: '', cardStyle: 'neon', buttonStyle: 'neon', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'neon', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'square' },
  customClasses: {
    heroBackground: 'bg-[#000500]',
    cardBackground: 'bg-[#001a0080] backdrop-blur border border-[#00ff00]/30',
    buttonPrimary: 'bg-[#00ff00] hover:bg-[#33ff33] text-black font-mono font-bold',
    buttonSecondary: 'border-2 border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00]/20',
    textGradient: 'text-[#00ff00]',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(0,255,0,0.8)]',
    borderGlow: 'shadow-[0_0_25px_rgba(0,255,0,0.4)]',
  },
};

export const royalPurpleTheme: LandingTheme = {
  id: 'royal-purple',
  name: 'Royal Purple',
  description: 'Elegant purple and gold royal theme',
  category: 'classic',
  preview: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #4a2c7a 100%)',
  colors: {
    primary: '#a855f7', primaryHover: '#9333ea', secondary: '#7c3aed',
    accent: '#fbbf24', accentGlow: 'rgba(168, 85, 247, 0.5)',
    background: '#0f0a1a', backgroundSecondary: '#1a0f2e',
    backgroundCard: 'rgba(45, 27, 78, 0.6)', backgroundOverlay: 'rgba(15, 10, 26, 0.9)',
    text: '#f5f3ff', textMuted: '#a78bfa', textAccent: '#fbbf24',
    border: '#4c1d95', borderAccent: '#a855f7',
    success: '#10b981', warning: '#fbbf24', error: '#ef4444',
  },
  fonts: { heading: '"Cinzel", serif', body: '"Lato", sans-serif', accent: '"Playfair Display", serif' },
  effects: {
    glowColor: '#a855f7', glowIntensity: 'medium', particleColor: '#fbbf24',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #a855f7 0%, #fbbf24 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'gradient', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'gradient', iconStyle: 'duotone', badgeStyle: 'diamond' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0f0a1a] via-[#1a0f2e] to-[#2d1b4e]',
    cardBackground: 'bg-[#2d1b4e80] backdrop-blur-xl border border-[#a855f7]/30',
    buttonPrimary: 'bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-semibold',
    buttonSecondary: 'border-2 border-[#fbbf24] text-[#fbbf24] hover:bg-[#fbbf24]/20',
    textGradient: 'bg-gradient-to-r from-[#a855f7] to-[#fbbf24] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]',
    borderGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  },
};

export const midnightBlueTheme: LandingTheme = {
  id: 'midnight-blue',
  name: 'Midnight Blue',
  description: 'Sleek midnight blue professional theme',
  category: 'classic',
  preview: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 50%, #2563eb 100%)',
  colors: {
    primary: '#3b82f6', primaryHover: '#2563eb', secondary: '#1d4ed8',
    accent: '#06b6d4', accentGlow: 'rgba(59, 130, 246, 0.5)',
    background: '#0a1628', backgroundSecondary: '#0f1f3c',
    backgroundCard: 'rgba(30, 58, 95, 0.5)', backgroundOverlay: 'rgba(10, 22, 40, 0.9)',
    text: '#f8fafc', textMuted: '#94a3b8', textAccent: '#06b6d4',
    border: '#1e3a5f', borderAccent: '#3b82f6',
    success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
  },
  fonts: { heading: '"Space Grotesk", sans-serif', body: '"Inter", sans-serif', accent: '"JetBrains Mono", monospace' },
  effects: {
    glowColor: '#3b82f6', glowIntensity: 'subtle', particleColor: '#06b6d4',
    particleType: 'dots', gradientStyle: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'gradient', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'minimal', dividerStyle: 'gradient', iconStyle: 'outline', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a1628] via-[#0f1f3c] to-[#1e3a5f]',
    cardBackground: 'bg-[#1e3a5f50] backdrop-blur-xl border border-[#3b82f6]/20',
    buttonPrimary: 'bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white font-medium',
    buttonSecondary: 'border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10',
    textGradient: 'bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]',
    borderGlow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
  },
};

export const goldLuxuryTheme: LandingTheme = {
  id: 'gold-luxury',
  name: 'Gold Luxury',
  description: 'Premium gold and black luxury theme',
  category: 'casino',
  preview: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)',
  colors: {
    primary: '#d4af37', primaryHover: '#c9a227', secondary: '#b8860b',
    accent: '#ffd700', accentGlow: 'rgba(212, 175, 55, 0.5)',
    background: '#050505', backgroundSecondary: '#0a0a0a',
    backgroundCard: 'rgba(26, 26, 26, 0.8)', backgroundOverlay: 'rgba(5, 5, 5, 0.95)',
    text: '#f5f5f5', textMuted: '#888888', textAccent: '#ffd700',
    border: '#333333', borderAccent: '#d4af37',
    success: '#50c878', warning: '#ffd700', error: '#dc143c',
  },
  fonts: { heading: '"Cinzel", serif', body: '"Lato", sans-serif', accent: '"Playfair Display", serif' },
  effects: {
    glowColor: '#d4af37', glowIntensity: 'medium', particleColor: '#ffd700',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #d4af37 0%, #ffd700 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'gradient', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'gradient', iconStyle: 'filled', badgeStyle: 'diamond' },
  customClasses: {
    heroBackground: 'bg-[#050505]',
    cardBackground: 'bg-[#1a1a1a80] backdrop-blur-xl border border-[#d4af37]/30',
    buttonPrimary: 'bg-gradient-to-r from-[#d4af37] to-[#ffd700] text-black font-bold',
    buttonSecondary: 'border-2 border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/20',
    textGradient: 'bg-gradient-to-r from-[#d4af37] to-[#ffd700] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]',
    borderGlow: 'shadow-[0_0_20px_rgba(212,175,55,0.3)]',
  },
};

export const neonPinkTheme: LandingTheme = {
  id: 'neon-pink',
  name: 'Neon Pink',
  description: 'Vibrant hot pink neon aesthetic',
  category: 'gaming',
  preview: 'linear-gradient(135deg, #1a0a14 0%, #2e0f23 50%, #4a1937 100%)',
  colors: {
    primary: '#ff1493', primaryHover: '#ff69b4', secondary: '#ff00ff',
    accent: '#00ffff', accentGlow: 'rgba(255, 20, 147, 0.5)',
    background: '#0a0508', backgroundSecondary: '#140a10',
    backgroundCard: 'rgba(46, 15, 35, 0.7)', backgroundOverlay: 'rgba(10, 5, 8, 0.9)',
    text: '#ffffff', textMuted: '#ff99cc', textAccent: '#00ffff',
    border: '#4a1937', borderAccent: '#ff1493',
    success: '#00ff88', warning: '#ffff00', error: '#ff0055',
  },
  fonts: { heading: '"Righteous", cursive', body: '"Nunito", sans-serif', accent: '"Orbitron", monospace' },
  effects: {
    glowColor: '#ff1493', glowIntensity: 'intense', particleColor: '#ff00ff',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #ff1493 0%, #00ffff 100%)',
    backgroundPattern: '', cardStyle: 'neon', buttonStyle: 'glow', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'neon', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a0508] via-[#140a10] to-[#2e0f23]',
    cardBackground: 'bg-[#2e0f2380] backdrop-blur-xl border border-[#ff1493]/40',
    buttonPrimary: 'bg-gradient-to-r from-[#ff1493] to-[#ff00ff] text-white font-bold',
    buttonSecondary: 'border-2 border-[#00ffff] text-[#00ffff] hover:bg-[#00ffff]/20',
    textGradient: 'bg-gradient-to-r from-[#ff1493] via-[#ff00ff] to-[#00ffff] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_20px_rgba(255,20,147,0.7)]',
    borderGlow: 'shadow-[0_0_25px_rgba(255,20,147,0.4)]',
  },
};

export const emeraldForestTheme: LandingTheme = {
  id: 'emerald-forest',
  name: 'Emerald Forest',
  description: 'Rich emerald green nature theme',
  category: 'classic',
  preview: 'linear-gradient(135deg, #052e16 0%, #065f46 50%, #059669 100%)',
  colors: {
    primary: '#10b981', primaryHover: '#059669', secondary: '#047857',
    accent: '#84cc16', accentGlow: 'rgba(16, 185, 129, 0.5)',
    background: '#022c22', backgroundSecondary: '#064e3b',
    backgroundCard: 'rgba(6, 78, 59, 0.5)', backgroundOverlay: 'rgba(2, 44, 34, 0.9)',
    text: '#f0fdf4', textMuted: '#6ee7b7', textAccent: '#84cc16',
    border: '#065f46', borderAccent: '#10b981',
    success: '#22c55e', warning: '#eab308', error: '#ef4444',
  },
  fonts: { heading: '"Quicksand", sans-serif', body: '"Nunito", sans-serif', accent: '"Space Grotesk", sans-serif' },
  effects: {
    glowColor: '#10b981', glowIntensity: 'subtle', particleColor: '#84cc16',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #10b981 0%, #84cc16 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'gradient', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'gradient', iconStyle: 'duotone', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#065f46]',
    cardBackground: 'bg-[#064e3b80] backdrop-blur-xl border border-[#10b981]/30',
    buttonPrimary: 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white font-semibold',
    buttonSecondary: 'border-2 border-[#84cc16] text-[#84cc16] hover:bg-[#84cc16]/20',
    textGradient: 'bg-gradient-to-r from-[#10b981] to-[#84cc16] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    borderGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)]',
  },
};

export const sunsetGlowTheme: LandingTheme = {
  id: 'sunset-glow',
  name: 'Sunset Glow',
  description: 'Warm sunset orange and pink gradient',
  category: 'classic',
  preview: 'linear-gradient(135deg, #1a0a0f 0%, #2e0f1a 50%, #4a1f2e 100%)',
  colors: {
    primary: '#f97316', primaryHover: '#ea580c', secondary: '#fb923c',
    accent: '#ec4899', accentGlow: 'rgba(249, 115, 22, 0.5)',
    background: '#0f0808', backgroundSecondary: '#1a0f0f',
    backgroundCard: 'rgba(46, 15, 26, 0.6)', backgroundOverlay: 'rgba(15, 8, 8, 0.9)',
    text: '#fff7ed', textMuted: '#fdba74', textAccent: '#ec4899',
    border: '#4a1f2e', borderAccent: '#f97316',
    success: '#22c55e', warning: '#fbbf24', error: '#ef4444',
  },
  fonts: { heading: '"Pacifico", cursive', body: '"Nunito", sans-serif', accent: '"Dancing Script", cursive' },
  effects: {
    glowColor: '#f97316', glowIntensity: 'medium', particleColor: '#ec4899',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'gradient', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'gradient', iconStyle: 'duotone', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0f0808] via-[#1a0f0f] to-[#2e0f1a]',
    cardBackground: 'bg-[#2e0f1a80] backdrop-blur-xl border border-[#f97316]/30',
    buttonPrimary: 'bg-gradient-to-r from-[#f97316] to-[#ec4899] text-white font-semibold',
    buttonSecondary: 'border-2 border-[#ec4899] text-[#ec4899] hover:bg-[#ec4899]/20',
    textGradient: 'bg-gradient-to-r from-[#f97316] to-[#ec4899] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]',
    borderGlow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',
  },
};

export const arcticFrostTheme: LandingTheme = {
  id: 'arctic-frost',
  name: 'Arctic Frost',
  description: 'Cool icy blue winter theme',
  category: 'futuristic',
  preview: 'linear-gradient(135deg, #0a1929 0%, #1e3a5f 50%, #3b82f6 100%)',
  colors: {
    primary: '#38bdf8', primaryHover: '#0ea5e9', secondary: '#7dd3fc',
    accent: '#e0f2fe', accentGlow: 'rgba(56, 189, 248, 0.5)',
    background: '#0a1520', backgroundSecondary: '#0f2030',
    backgroundCard: 'rgba(30, 58, 95, 0.4)', backgroundOverlay: 'rgba(10, 21, 32, 0.9)',
    text: '#f0f9ff', textMuted: '#7dd3fc', textAccent: '#e0f2fe',
    border: '#1e3a5f', borderAccent: '#38bdf8',
    success: '#34d399', warning: '#fbbf24', error: '#f87171',
  },
  fonts: { heading: '"Exo 2", sans-serif', body: '"Inter", sans-serif', accent: '"Space Grotesk", sans-serif' },
  effects: {
    glowColor: '#38bdf8', glowIntensity: 'medium', particleColor: '#e0f2fe',
    particleType: 'snow', gradientStyle: 'linear-gradient(135deg, #38bdf8 0%, #e0f2fe 100%)',
    backgroundPattern: '', cardStyle: 'glass', buttonStyle: 'glow', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'glow', iconStyle: 'outline', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a1520] via-[#0f2030] to-[#1e3a5f]',
    cardBackground: 'bg-[#1e3a5f60] backdrop-blur-xl border border-[#38bdf8]/30',
    buttonPrimary: 'bg-gradient-to-r from-[#38bdf8] to-[#7dd3fc] text-black font-semibold',
    buttonSecondary: 'border-2 border-[#38bdf8] text-[#38bdf8] hover:bg-[#38bdf8]/20',
    textGradient: 'bg-gradient-to-r from-[#38bdf8] to-[#e0f2fe] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]',
    borderGlow: 'shadow-[0_0_20px_rgba(56,189,248,0.3)]',
  },
};

// ==========================================
// RPG THEMES - Complete Visual Transformations
// ==========================================

export const warriorTheme: LandingTheme = {
  id: 'warrior',
  name: '⚔️ Warrior Arena',
  description: 'Battle-hardened warrior with swords and shields',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #1a0a05 0%, #3d1a0a 50%, #8b4513 100%)',
  themeIcons: {
    trophy: '🏆', battle: '⚔️', users: '🛡️', currency: '💰',
    power: '💪', achievement: '🎖️', stats: '📊', special: '🗡️',
  },
  heroTextStyle: { titlePrefix: '⚔️', subtitleStyle: 'tracking-widest uppercase', ctaIcon: '🗡️' },
  colors: {
    primary: '#cd7f32', primaryHover: '#b8860b', secondary: '#8b4513',
    accent: '#ffd700', accentGlow: 'rgba(205, 127, 50, 0.6)',
    background: '#0d0503', backgroundSecondary: '#1a0a05',
    backgroundCard: 'rgba(61, 26, 10, 0.7)', backgroundOverlay: 'rgba(13, 5, 3, 0.95)',
    text: '#f5e6d3', textMuted: '#cd9b6a', textAccent: '#ffd700',
    border: '#5c3317', borderAccent: '#cd7f32',
    success: '#228b22', warning: '#daa520', error: '#8b0000',
  },
  fonts: { heading: '"Cinzel", serif', body: '"Roboto Condensed", sans-serif', accent: '"MedievalSharp", cursive' },
  effects: {
    glowColor: '#cd7f32', glowIntensity: 'medium', particleColor: '#ffd700',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #cd7f32 0%, #ffd700 100%)',
    backgroundPattern: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5L35 25H55L40 35L45 55L30 42L15 55L20 35L5 25H25L30 5Z\' fill=\'%23cd7f3210\'/%3E%3C/svg%3E")',
    cardStyle: 'solid', buttonStyle: 'gradient', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'bold', dividerStyle: 'gradient', iconStyle: 'filled', badgeStyle: 'hexagon' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0d0503] via-[#1a0a05] to-[#3d1a0a]',
    cardBackground: 'bg-[#3d1a0a80] backdrop-blur border-2 border-[#cd7f32]/40 hover:border-[#ffd700]',
    buttonPrimary: 'bg-gradient-to-r from-[#8b4513] via-[#cd7f32] to-[#daa520] text-white font-bold uppercase tracking-wider',
    buttonSecondary: 'border-2 border-[#cd7f32] text-[#cd7f32] hover:bg-[#cd7f32]/20 uppercase',
    textGradient: 'bg-gradient-to-r from-[#cd7f32] via-[#ffd700] to-[#cd7f32] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_20px_rgba(205,127,50,0.6)]',
    borderGlow: 'shadow-[0_0_30px_rgba(205,127,50,0.3),inset_0_0_20px_rgba(139,69,19,0.2)]',
  },
};

export const wizardTheme: LandingTheme = {
  id: 'wizard',
  name: '🧙 Wizard Tower',
  description: 'Mystical magic with arcane symbols and spells',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0520 0%, #1a0a40 50%, #4b0082 100%)',
  themeIcons: {
    trophy: '🏆', battle: '🔮', users: '📚', currency: '💎',
    power: '⚡', achievement: '🌟', stats: '📜', special: '✨',
  },
  heroTextStyle: { titlePrefix: '🔮', subtitleStyle: 'italic tracking-wide', ctaIcon: '✨' },
  colors: {
    primary: '#9370db', primaryHover: '#8a2be2', secondary: '#4b0082',
    accent: '#00ffff', accentGlow: 'rgba(147, 112, 219, 0.6)',
    background: '#050210', backgroundSecondary: '#0a0520',
    backgroundCard: 'rgba(26, 10, 64, 0.8)', backgroundOverlay: 'rgba(5, 2, 16, 0.95)',
    text: '#e6e6fa', textMuted: '#9370db', textAccent: '#00ffff',
    border: '#4b0082', borderAccent: '#9370db',
    success: '#00ff7f', warning: '#ffd700', error: '#dc143c',
  },
  fonts: { heading: '"Cinzel Decorative", serif', body: '"Lato", sans-serif', accent: '"Satisfy", cursive' },
  effects: {
    glowColor: '#9370db', glowIntensity: 'intense', particleColor: '#00ffff',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #9370db 0%, #00ffff 100%)',
    backgroundPattern: 'radial-gradient(circle at 20% 80%, rgba(147,112,219,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,255,255,0.1) 0%, transparent 50%)',
    cardStyle: 'glass', buttonStyle: 'glow', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'neon', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'diamond' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#050210] via-[#0a0520] to-[#1a0a40]',
    cardBackground: 'bg-[#1a0a4080] backdrop-blur-xl border border-[#9370db]/40 hover:border-[#00ffff]',
    buttonPrimary: 'bg-gradient-to-r from-[#4b0082] via-[#9370db] to-[#00ffff] text-white font-bold',
    buttonSecondary: 'border-2 border-[#9370db] text-[#9370db] hover:bg-[#9370db]/20',
    textGradient: 'bg-gradient-to-r from-[#9370db] via-[#e6e6fa] to-[#00ffff] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_25px_rgba(147,112,219,0.7)]',
    borderGlow: 'shadow-[0_0_40px_rgba(147,112,219,0.4),0_0_80px_rgba(0,255,255,0.2)]',
  },
};

export const warlordTheme: LandingTheme = {
  id: 'warlord',
  name: '👑 Warlord Empire',
  description: 'Dark conquest with armies and empires',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2d2d2d 100%)',
  themeIcons: {
    trophy: '👑', battle: '⚔️', users: '🏰', currency: '💀',
    power: '🔥', achievement: '🏅', stats: '📋', special: '🦅',
  },
  heroTextStyle: { titlePrefix: '👑', subtitleStyle: 'uppercase font-black tracking-[0.3em]', ctaIcon: '⚔️' },
  colors: {
    primary: '#dc143c', primaryHover: '#b22222', secondary: '#8b0000',
    accent: '#ffd700', accentGlow: 'rgba(220, 20, 60, 0.6)',
    background: '#050505', backgroundSecondary: '#0a0a0a',
    backgroundCard: 'rgba(26, 26, 26, 0.9)', backgroundOverlay: 'rgba(5, 5, 5, 0.98)',
    text: '#f5f5f5', textMuted: '#808080', textAccent: '#ffd700',
    border: '#333333', borderAccent: '#dc143c',
    success: '#228b22', warning: '#ffd700', error: '#8b0000',
  },
  fonts: { heading: '"Bebas Neue", sans-serif', body: '"Roboto Condensed", sans-serif', accent: '"Oswald", sans-serif' },
  effects: {
    glowColor: '#dc143c', glowIntensity: 'medium', particleColor: '#dc143c',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #dc143c 0%, #ffd700 100%)',
    backgroundPattern: '',
    cardStyle: 'solid', buttonStyle: 'solid', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'bold', dividerStyle: 'line', iconStyle: 'filled', badgeStyle: 'square' },
  customClasses: {
    heroBackground: 'bg-[#050505]',
    cardBackground: 'bg-[#1a1a1a] border-l-4 border-[#dc143c] hover:border-[#ffd700]',
    buttonPrimary: 'bg-[#dc143c] hover:bg-[#b22222] text-white font-black uppercase tracking-widest',
    buttonSecondary: 'border-2 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/10 uppercase',
    textGradient: 'bg-gradient-to-r from-[#dc143c] to-[#ffd700] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(220,20,60,0.5)]',
    borderGlow: 'shadow-[0_0_20px_rgba(220,20,60,0.3)]',
  },
};

export const mageTheme: LandingTheme = {
  id: 'mage',
  name: '🌙 Mage Sanctum',
  description: 'Celestial magic with moon and stars',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #2a2a5a 100%)',
  themeIcons: {
    trophy: '🌟', battle: '🌙', users: '⭐', currency: '💫',
    power: '✨', achievement: '🌠', stats: '🔭', special: '🌌',
  },
  heroTextStyle: { titlePrefix: '🌙', subtitleStyle: 'tracking-[0.2em] font-light', ctaIcon: '✨' },
  colors: {
    primary: '#c0c0ff', primaryHover: '#a0a0ff', secondary: '#8080ff',
    accent: '#ffd700', accentGlow: 'rgba(192, 192, 255, 0.5)',
    background: '#05050f', backgroundSecondary: '#0a0a1a',
    backgroundCard: 'rgba(26, 26, 58, 0.7)', backgroundOverlay: 'rgba(5, 5, 15, 0.95)',
    text: '#e6e6ff', textMuted: '#8888cc', textAccent: '#ffd700',
    border: '#3a3a6a', borderAccent: '#c0c0ff',
    success: '#7fff00', warning: '#ffd700', error: '#ff6b6b',
  },
  fonts: { heading: '"Philosopher", serif', body: '"Quicksand", sans-serif', accent: '"Great Vibes", cursive' },
  effects: {
    glowColor: '#c0c0ff', glowIntensity: 'intense', particleColor: '#ffd700',
    particleType: 'stars', gradientStyle: 'linear-gradient(135deg, #c0c0ff 0%, #ffd700 100%)',
    backgroundPattern: 'radial-gradient(2px 2px at 20px 30px, #c0c0ff, transparent), radial-gradient(2px 2px at 40px 70px, #ffd700, transparent), radial-gradient(1px 1px at 90px 40px, #ffffff, transparent)',
    cardStyle: 'glass', buttonStyle: 'glow', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'gradient', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'diamond' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#05050f] via-[#0a0a1a] to-[#1a1a3a]',
    cardBackground: 'bg-[#1a1a3a60] backdrop-blur-xl border border-[#c0c0ff]/30 hover:border-[#ffd700]',
    buttonPrimary: 'bg-gradient-to-r from-[#8080ff] to-[#c0c0ff] text-black font-semibold',
    buttonSecondary: 'border-2 border-[#c0c0ff] text-[#c0c0ff] hover:bg-[#c0c0ff]/20',
    textGradient: 'bg-gradient-to-r from-[#c0c0ff] via-[#ffd700] to-[#c0c0ff] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_30px_rgba(192,192,255,0.6)]',
    borderGlow: 'shadow-[0_0_40px_rgba(192,192,255,0.3),0_0_80px_rgba(255,215,0,0.1)]',
  },
};

export const robotTheme: LandingTheme = {
  id: 'robot',
  name: '🤖 Robot Factory',
  description: 'Industrial tech with circuits and machinery',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0f0a 0%, #1a2f1a 50%, #2a4f2a 100%)',
  themeIcons: {
    trophy: '🏆', battle: '⚙️', users: '🤖', currency: '🔋',
    power: '⚡', achievement: '🎯', stats: '📟', special: '🔧',
  },
  heroTextStyle: { titlePrefix: '⚙️', subtitleStyle: 'font-mono tracking-tight', ctaIcon: '🚀' },
  colors: {
    primary: '#00ff00', primaryHover: '#00cc00', secondary: '#008800',
    accent: '#ffff00', accentGlow: 'rgba(0, 255, 0, 0.5)',
    background: '#050805', backgroundSecondary: '#0a100a',
    backgroundCard: 'rgba(10, 47, 10, 0.8)', backgroundOverlay: 'rgba(5, 8, 5, 0.95)',
    text: '#e0ffe0', textMuted: '#88ff88', textAccent: '#ffff00',
    border: '#1a4f1a', borderAccent: '#00ff00',
    success: '#00ff00', warning: '#ffff00', error: '#ff4444',
  },
  fonts: { heading: '"Share Tech Mono", monospace', body: '"JetBrains Mono", monospace', accent: '"Orbitron", sans-serif' },
  effects: {
    glowColor: '#00ff00', glowIntensity: 'intense', particleColor: '#00ff00',
    particleType: 'matrix', gradientStyle: 'linear-gradient(135deg, #00ff00 0%, #ffff00 100%)',
    backgroundPattern: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.03) 2px, rgba(0,255,0,0.03) 4px)',
    cardStyle: 'neon', buttonStyle: 'neon', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'neon', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'square' },
  customClasses: {
    heroBackground: 'bg-[#050805]',
    cardBackground: 'bg-[#0a100a] border border-[#00ff00]/40 hover:border-[#00ff00]',
    buttonPrimary: 'bg-[#00ff00] hover:bg-[#00cc00] text-black font-mono font-bold',
    buttonSecondary: 'border-2 border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00]/20 font-mono',
    textGradient: 'text-[#00ff00]',
    glowEffect: 'drop-shadow-[0_0_20px_rgba(0,255,0,0.8)]',
    borderGlow: 'shadow-[0_0_30px_rgba(0,255,0,0.4)]',
  },
};

export const falloutTheme: LandingTheme = {
  id: 'fallout',
  name: '☢️ Wasteland',
  description: 'Post-apocalyptic nuclear wasteland survival',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #1a1a0a 0%, #2a2a1a 50%, #4a4a2a 100%)',
  themeIcons: {
    trophy: '🏆', battle: '☢️', users: '🛡️', currency: '💊',
    power: '⚡', achievement: '🎖️', stats: '📻', special: '🔫',
  },
  heroTextStyle: { titlePrefix: '☢️', subtitleStyle: 'uppercase tracking-[0.25em] font-bold', ctaIcon: '💀' },
  colors: {
    primary: '#c8b400', primaryHover: '#a89600', secondary: '#887800',
    accent: '#ff6b00', accentGlow: 'rgba(200, 180, 0, 0.5)',
    background: '#0a0a05', backgroundSecondary: '#1a1a0a',
    backgroundCard: 'rgba(42, 42, 26, 0.8)', backgroundOverlay: 'rgba(10, 10, 5, 0.95)',
    text: '#e8e8c8', textMuted: '#a8a888', textAccent: '#ff6b00',
    border: '#4a4a2a', borderAccent: '#c8b400',
    success: '#7fff00', warning: '#ff6b00', error: '#ff0000',
  },
  fonts: { heading: '"Special Elite", cursive', body: '"Roboto Condensed", sans-serif', accent: '"VT323", monospace' },
  effects: {
    glowColor: '#c8b400', glowIntensity: 'subtle', particleColor: '#c8b400',
    particleType: 'dots', gradientStyle: 'linear-gradient(135deg, #c8b400 0%, #ff6b00 100%)',
    backgroundPattern: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z\' fill=\'%23c8b40008\'/%3E%3C/svg%3E")',
    cardStyle: 'solid', buttonStyle: 'solid', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'bold', dividerStyle: 'line', iconStyle: 'filled', badgeStyle: 'hexagon' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#0a0a05] via-[#1a1a0a] to-[#2a2a1a]',
    cardBackground: 'bg-[#2a2a1a] border-2 border-[#4a4a2a] hover:border-[#c8b400]',
    buttonPrimary: 'bg-[#c8b400] hover:bg-[#a89600] text-black font-bold uppercase',
    buttonSecondary: 'border-2 border-[#ff6b00] text-[#ff6b00] hover:bg-[#ff6b00]/20 uppercase',
    textGradient: 'bg-gradient-to-r from-[#c8b400] to-[#ff6b00] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_15px_rgba(200,180,0,0.4)]',
    borderGlow: 'shadow-[0_0_20px_rgba(200,180,0,0.2)]',
  },
};

export const diabloTheme: LandingTheme = {
  id: 'diablo',
  name: '😈 Diablo Inferno',
  description: 'Hellish flames and demonic darkness',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0000 0%, #2a0505 50%, #4a0a0a 100%)',
  themeIcons: {
    trophy: '💀', battle: '🔥', users: '😈', currency: '💎',
    power: '⚡', achievement: '👹', stats: '📜', special: '🩸',
  },
  heroTextStyle: { titlePrefix: '🔥', subtitleStyle: 'uppercase tracking-[0.3em] font-black', ctaIcon: '💀' },
  colors: {
    primary: '#ff4400', primaryHover: '#ff6600', secondary: '#cc3300',
    accent: '#ffcc00', accentGlow: 'rgba(255, 68, 0, 0.6)',
    background: '#050000', backgroundSecondary: '#0a0000',
    backgroundCard: 'rgba(42, 5, 5, 0.9)', backgroundOverlay: 'rgba(5, 0, 0, 0.98)',
    text: '#ffccaa', textMuted: '#cc8866', textAccent: '#ffcc00',
    border: '#4a0a0a', borderAccent: '#ff4400',
    success: '#44ff00', warning: '#ffcc00', error: '#ff0000',
  },
  fonts: { heading: '"Nosifer", cursive', body: '"Roboto Condensed", sans-serif', accent: '"Creepster", cursive' },
  effects: {
    glowColor: '#ff4400', glowIntensity: 'intense', particleColor: '#ff4400',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #ff4400 0%, #ffcc00 100%)',
    backgroundPattern: 'radial-gradient(ellipse at bottom, rgba(255,68,0,0.1) 0%, transparent 70%)',
    cardStyle: 'solid', buttonStyle: 'glow', animationStyle: 'intense',
  },
  decorations: { headerStyle: 'neon', dividerStyle: 'glow', iconStyle: 'filled', badgeStyle: 'hexagon' },
  customClasses: {
    heroBackground: 'bg-gradient-to-b from-[#050000] via-[#0a0000] to-[#2a0505]',
    cardBackground: 'bg-[#2a0505] border-2 border-[#ff4400]/50 hover:border-[#ff4400]',
    buttonPrimary: 'bg-gradient-to-r from-[#cc3300] via-[#ff4400] to-[#ff6600] text-white font-black uppercase',
    buttonSecondary: 'border-2 border-[#ffcc00] text-[#ffcc00] hover:bg-[#ffcc00]/20 uppercase',
    textGradient: 'bg-gradient-to-r from-[#ff4400] via-[#ffcc00] to-[#ff4400] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_30px_rgba(255,68,0,0.8)]',
    borderGlow: 'shadow-[0_0_50px_rgba(255,68,0,0.5),0_0_100px_rgba(255,68,0,0.2)]',
  },
};

export const assassinTheme: LandingTheme = {
  id: 'assassin',
  name: '🗡️ Shadow Assassin',
  description: 'Stealthy shadows and deadly precision',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #050508 0%, #0a0a10 50%, #15151f 100%)',
  themeIcons: {
    trophy: '🏆', battle: '🗡️', users: '👤', currency: '💰',
    power: '💨', achievement: '🎯', stats: '📊', special: '🌑',
  },
  heroTextStyle: { titlePrefix: '🗡️', subtitleStyle: 'tracking-[0.4em] uppercase font-light', ctaIcon: '💀' },
  colors: {
    primary: '#6b7280', primaryHover: '#9ca3af', secondary: '#4b5563',
    accent: '#ef4444', accentGlow: 'rgba(107, 114, 128, 0.5)',
    background: '#030305', backgroundSecondary: '#050508',
    backgroundCard: 'rgba(21, 21, 31, 0.9)', backgroundOverlay: 'rgba(3, 3, 5, 0.98)',
    text: '#d1d5db', textMuted: '#6b7280', textAccent: '#ef4444',
    border: '#1f2937', borderAccent: '#6b7280',
    success: '#10b981', warning: '#f59e0b', error: '#ef4444',
  },
  fonts: { heading: '"Rajdhani", sans-serif', body: '"Inter", sans-serif', accent: '"Share Tech", sans-serif' },
  effects: {
    glowColor: '#6b7280', glowIntensity: 'subtle', particleColor: '#6b7280',
    particleType: 'dots', gradientStyle: 'linear-gradient(135deg, #6b7280 0%, #ef4444 100%)',
    backgroundPattern: '',
    cardStyle: 'flat', buttonStyle: 'solid', animationStyle: 'subtle',
  },
  decorations: { headerStyle: 'minimal', dividerStyle: 'line', iconStyle: 'outline', badgeStyle: 'pill' },
  customClasses: {
    heroBackground: 'bg-[#030305]',
    cardBackground: 'bg-[#0a0a10] border border-[#1f2937] hover:border-[#ef4444]',
    buttonPrimary: 'bg-[#6b7280] hover:bg-[#9ca3af] text-white font-medium',
    buttonSecondary: 'border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10',
    textGradient: 'text-[#d1d5db]',
    glowEffect: 'drop-shadow-[0_0_10px_rgba(107,114,128,0.3)]',
    borderGlow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
  },
};

export const dragonTheme: LandingTheme = {
  id: 'dragon',
  name: '🐉 Dragon Lair',
  description: 'Ancient dragons with fire and treasure',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0505 0%, #1a0a0a 50%, #3a1515 100%)',
  themeIcons: {
    trophy: '👑', battle: '🐉', users: '🛡️', currency: '💎',
    power: '🔥', achievement: '⚔️', stats: '📜', special: '🪙',
  },
  heroTextStyle: { titlePrefix: '🐉', subtitleStyle: 'uppercase tracking-widest', ctaIcon: '🔥' },
  colors: {
    primary: '#ff6b35', primaryHover: '#ff8c5a', secondary: '#cc5500',
    accent: '#ffd700', accentGlow: 'rgba(255, 107, 53, 0.6)',
    background: '#050303', backgroundSecondary: '#0a0505',
    backgroundCard: 'rgba(58, 21, 21, 0.8)', backgroundOverlay: 'rgba(5, 3, 3, 0.95)',
    text: '#ffe4d6', textMuted: '#cc9988', textAccent: '#ffd700',
    border: '#5a2020', borderAccent: '#ff6b35',
    success: '#22c55e', warning: '#ffd700', error: '#dc2626',
  },
  fonts: { heading: '"Cinzel", serif', body: '"Lato", sans-serif', accent: '"UnifrakturMaguntia", cursive' },
  effects: {
    glowColor: '#ff6b35', glowIntensity: 'intense', particleColor: '#ffd700',
    particleType: 'sparkles', gradientStyle: 'linear-gradient(135deg, #ff6b35 0%, #ffd700 100%)',
    backgroundPattern: 'radial-gradient(ellipse at 30% 80%, rgba(255,107,53,0.15) 0%, transparent 50%)',
    cardStyle: 'solid', buttonStyle: 'gradient', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'bold', dividerStyle: 'gradient', iconStyle: 'filled', badgeStyle: 'hexagon' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#050303] via-[#0a0505] to-[#1a0a0a]',
    cardBackground: 'bg-[#1a0a0a] border-2 border-[#5a2020] hover:border-[#ff6b35]',
    buttonPrimary: 'bg-gradient-to-r from-[#cc5500] via-[#ff6b35] to-[#ff8c5a] text-white font-bold uppercase',
    buttonSecondary: 'border-2 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700]/20 uppercase',
    textGradient: 'bg-gradient-to-r from-[#ff6b35] via-[#ffd700] to-[#ff6b35] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_25px_rgba(255,107,53,0.7)]',
    borderGlow: 'shadow-[0_0_40px_rgba(255,107,53,0.4),0_0_80px_rgba(255,215,0,0.2)]',
  },
};

export const spaceMarineTheme: LandingTheme = {
  id: 'space-marine',
  name: '🚀 Space Marine',
  description: 'Galactic warfare with power armor and plasma',
  category: 'rpg',
  preview: 'linear-gradient(135deg, #0a0a15 0%, #151530 50%, #202050 100%)',
  themeIcons: {
    trophy: '🏆', battle: '🔫', users: '🛡️', currency: '⚡',
    power: '💥', achievement: '🎖️', stats: '📡', special: '🚀',
  },
  heroTextStyle: { titlePrefix: '🚀', subtitleStyle: 'uppercase tracking-[0.3em] font-black', ctaIcon: '⚔️' },
  colors: {
    primary: '#3b82f6', primaryHover: '#60a5fa', secondary: '#1d4ed8',
    accent: '#fbbf24', accentGlow: 'rgba(59, 130, 246, 0.5)',
    background: '#05050a', backgroundSecondary: '#0a0a15',
    backgroundCard: 'rgba(21, 21, 48, 0.8)', backgroundOverlay: 'rgba(5, 5, 10, 0.95)',
    text: '#e0e7ff', textMuted: '#818cf8', textAccent: '#fbbf24',
    border: '#312e81', borderAccent: '#3b82f6',
    success: '#22c55e', warning: '#fbbf24', error: '#ef4444',
  },
  fonts: { heading: '"Orbitron", sans-serif', body: '"Exo 2", sans-serif', accent: '"Rajdhani", sans-serif' },
  effects: {
    glowColor: '#3b82f6', glowIntensity: 'intense', particleColor: '#3b82f6',
    particleType: 'stars', gradientStyle: 'linear-gradient(135deg, #3b82f6 0%, #fbbf24 100%)',
    backgroundPattern: 'radial-gradient(2px 2px at 50px 50px, #3b82f6, transparent), radial-gradient(1px 1px at 100px 100px, #fbbf24, transparent)',
    cardStyle: 'glass', buttonStyle: 'glow', animationStyle: 'dynamic',
  },
  decorations: { headerStyle: 'neon', dividerStyle: 'glow', iconStyle: 'glow', badgeStyle: 'hexagon' },
  customClasses: {
    heroBackground: 'bg-gradient-to-br from-[#05050a] via-[#0a0a15] to-[#151530]',
    cardBackground: 'bg-[#15153080] backdrop-blur-xl border border-[#3b82f6]/40 hover:border-[#fbbf24]',
    buttonPrimary: 'bg-gradient-to-r from-[#1d4ed8] via-[#3b82f6] to-[#60a5fa] text-white font-black uppercase',
    buttonSecondary: 'border-2 border-[#fbbf24] text-[#fbbf24] hover:bg-[#fbbf24]/20 uppercase',
    textGradient: 'bg-gradient-to-r from-[#3b82f6] via-[#fbbf24] to-[#3b82f6] bg-clip-text text-transparent',
    glowEffect: 'drop-shadow-[0_0_25px_rgba(59,130,246,0.7)]',
    borderGlow: 'shadow-[0_0_40px_rgba(59,130,246,0.4),0_0_80px_rgba(251,191,36,0.2)]',
  },
};

// ==========================================
// ALL THEMES EXPORT
// ==========================================

export const allThemes: LandingTheme[] = [
  // Gaming
  gamingNeonTheme,
  retroArcadeTheme,
  rgbGamingTheme,
  fireStormTheme,
  neonPinkTheme,
  matrixTheme,
  
  // RPG Themes (NEW!)
  warriorTheme,
  wizardTheme,
  warlordTheme,
  mageTheme,
  robotTheme,
  falloutTheme,
  diabloTheme,
  assassinTheme,
  dragonTheme,
  spaceMarineTheme,
  
  // Futuristic
  cyberpunkTheme,
  holographicTheme,
  oceanDepthTheme,
  arcticFrostTheme,
  
  // Sports
  sportsBettingTheme,
  championshipTheme,
  
  // Casino
  casinoRoyaleTheme,
  vegasNightTheme,
  goldLuxuryTheme,
  
  // Holiday
  christmasTheme,
  easterTheme,
  blackFridayTheme,
  halloweenTheme,
  
  // Classic
  minimalDarkTheme,
  royalPurpleTheme,
  midnightBlueTheme,
  emeraldForestTheme,
  sunsetGlowTheme,
];

// Holiday schedule for automatic theme switching
export interface HolidaySchedule {
  id: string;
  name: string;
  themeId: string;
  startMonth: number; // 1-12
  startDay: number;
  endMonth: number;
  endDay: number;
  enabled: boolean;
}

export const defaultHolidaySchedule: HolidaySchedule[] = [
  { id: 'christmas', name: 'Christmas', themeId: 'christmas', startMonth: 12, startDay: 1, endMonth: 12, endDay: 31, enabled: true },
  { id: 'halloween', name: 'Halloween', themeId: 'halloween', startMonth: 10, startDay: 15, endMonth: 11, endDay: 1, enabled: true },
  { id: 'easter', name: 'Easter', themeId: 'easter', startMonth: 3, startDay: 15, endMonth: 4, endDay: 30, enabled: true },
  { id: 'black-friday', name: 'Black Friday', themeId: 'black-friday', startMonth: 11, startDay: 20, endMonth: 11, endDay: 30, enabled: true },
];

// Check if a holiday theme should be active
export function getActiveHolidayTheme(schedule: HolidaySchedule[]): string | null {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  
  for (const holiday of schedule) {
    if (!holiday.enabled) continue;
    
    // Handle year-wrap (e.g., Dec to Jan)
    if (holiday.startMonth > holiday.endMonth) {
      // Holiday spans year boundary
      if ((month >= holiday.startMonth && day >= holiday.startDay) ||
          (month <= holiday.endMonth && day <= holiday.endDay)) {
        return holiday.themeId;
      }
    } else {
      // Normal date range
      const afterStart = month > holiday.startMonth || (month === holiday.startMonth && day >= holiday.startDay);
      const beforeEnd = month < holiday.endMonth || (month === holiday.endMonth && day <= holiday.endDay);
      if (afterStart && beforeEnd) {
        return holiday.themeId;
      }
    }
  }
  
  return null;
}

export const themeCategories = [
  { id: 'rpg', name: '⚔️ RPG & Fantasy', icon: '🎮' },
  { id: 'gaming', name: '🎮 Gaming', icon: '🕹️' },
  { id: 'futuristic', name: '🚀 Futuristic', icon: '🔮' },
  { id: 'sports', name: '🏆 Sports', icon: '⚽' },
  { id: 'casino', name: '🎰 Casino', icon: '🎲' },
  { id: 'holiday', name: '🎄 Holiday', icon: '🎁' },
  { id: 'classic', name: '🎨 Classic', icon: '✨' },
];

export function getThemeById(id: string): LandingTheme | undefined {
  return allThemes.find(theme => theme.id === id);
}

export function getThemesByCategory(category: string): LandingTheme[] {
  return allThemes.filter(theme => theme.category === category);
}

