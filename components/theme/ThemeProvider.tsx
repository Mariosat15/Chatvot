'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LandingTheme, getThemeById, getActiveHolidayTheme, HolidaySchedule, defaultHolidaySchedule } from '@/lib/themes/landing-themes';
import GlobalThemeEffects from './GlobalThemeEffects';

interface ThemeSettings {
  activeTheme: string;
  holidayThemesEnabled: boolean;
  holidaySchedule: HolidaySchedule[];
  globalThemeEffects: {
    snowEnabled: boolean;
    bloodDripsEnabled: boolean;
    confettiEnabled: boolean;
    particlesEnabled: boolean;
    glowEffectsEnabled: boolean;
    animationsEnabled: boolean;
  };
  themeCustomizations: Record<string, Partial<LandingTheme>>;
}

interface ThemeContextType {
  theme: LandingTheme | undefined;
  themeId: string;
  settings: ThemeSettings;
  isHolidayTheme: boolean;
  refreshTheme: () => void;
}

const defaultSettings: ThemeSettings = {
  activeTheme: 'gaming-neon',
  holidayThemesEnabled: true,
  holidaySchedule: defaultHolidaySchedule,
  globalThemeEffects: {
    snowEnabled: false,
    bloodDripsEnabled: false,
    confettiEnabled: false,
    particlesEnabled: true,
    glowEffectsEnabled: true,
    animationsEnabled: true,
  },
  themeCustomizations: {},
};

const ThemeContext = createContext<ThemeContextType>({
  theme: undefined,
  themeId: 'gaming-neon',
  settings: defaultSettings,
  isHolidayTheme: false,
  refreshTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: ReactNode;
  initialSettings?: Partial<ThemeSettings>;
}

export function ThemeProvider({ children, initialSettings }: ThemeProviderProps) {
  const [settings, setSettings] = useState<ThemeSettings>({ ...defaultSettings, ...initialSettings });
  const [isHolidayTheme, setIsHolidayTheme] = useState(false);
  const [effectiveThemeId, setEffectiveThemeId] = useState(settings.activeTheme);

  // Determine active theme (considering holiday overrides)
  useEffect(() => {
    let themeId = settings.activeTheme;
    let holiday = false;

    if (settings.holidayThemesEnabled) {
      const holidayTheme = getActiveHolidayTheme(settings.holidaySchedule);
      if (holidayTheme) {
        themeId = holidayTheme;
        holiday = true;
      }
    }

    setEffectiveThemeId(themeId);
    setIsHolidayTheme(holiday);
  }, [settings.activeTheme, settings.holidayThemesEnabled, settings.holidaySchedule]);

  // Get theme with customizations applied
  const getCustomizedTheme = (): LandingTheme | undefined => {
    const baseTheme = getThemeById(effectiveThemeId);
    if (!baseTheme) return undefined;

    const customizations = settings.themeCustomizations[effectiveThemeId];
    if (!customizations) return baseTheme;

    // Merge customizations with base theme
    return {
      ...baseTheme,
      colors: { ...baseTheme.colors, ...(customizations.colors || {}) },
      fonts: { ...baseTheme.fonts, ...(customizations.fonts || {}) },
      effects: { ...baseTheme.effects, ...(customizations.effects || {}) },
      decorations: { ...baseTheme.decorations, ...(customizations.decorations || {}) },
      customClasses: { ...baseTheme.customClasses, ...(customizations.customClasses || {}) },
    };
  };

  const theme = getCustomizedTheme();

  const refreshTheme = async () => {
    try {
      const response = await fetch('/api/hero-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({
            activeTheme: data.settings.activeTheme || 'gaming-neon',
            holidayThemesEnabled: data.settings.holidayThemesEnabled ?? true,
            holidaySchedule: data.settings.holidaySchedule || defaultHolidaySchedule,
            globalThemeEffects: data.settings.globalThemeEffects || defaultSettings.globalThemeEffects,
            themeCustomizations: data.settings.themeCustomizations || {},
          });
        }
      }
    } catch (error) {
      console.error('Failed to refresh theme settings:', error);
    }
  };

  // Apply global CSS variables
  useEffect(() => {
    if (theme) {
      const root = document.documentElement;
      
      // Set CSS variables for global theming
      root.style.setProperty('--theme-primary', theme.colors.primary);
      root.style.setProperty('--theme-secondary', theme.colors.secondary);
      root.style.setProperty('--theme-accent', theme.colors.accent);
      root.style.setProperty('--theme-background', theme.colors.background);
      root.style.setProperty('--theme-background-secondary', theme.colors.backgroundSecondary);
      root.style.setProperty('--theme-background-card', theme.colors.backgroundCard);
      root.style.setProperty('--theme-text', theme.colors.text);
      root.style.setProperty('--theme-text-muted', theme.colors.textMuted);
      root.style.setProperty('--theme-text-accent', theme.colors.textAccent);
      root.style.setProperty('--theme-border', theme.colors.border);
      root.style.setProperty('--theme-border-accent', theme.colors.borderAccent);
      root.style.setProperty('--theme-success', theme.colors.success);
      root.style.setProperty('--theme-warning', theme.colors.warning);
      root.style.setProperty('--theme-error', theme.colors.error);
      root.style.setProperty('--theme-glow', theme.effects.glowColor);
      root.style.setProperty('--theme-gradient', theme.effects.gradientStyle);
      root.style.setProperty('--theme-font-heading', theme.fonts.heading);
      root.style.setProperty('--theme-font-body', theme.fonts.body);
      root.style.setProperty('--theme-font-accent', theme.fonts.accent);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeId: effectiveThemeId, settings, isHolidayTheme, refreshTheme }}>
      {/* Global theme font styles */}
      {theme && (
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Press+Start+2P&family=VT323&family=Exo+2:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&family=Cinzel:wght@400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;700&family=Righteous&family=Monoton&family=Nunito:wght@300;400;500;600;700;800&family=Mountains+of+Christmas:wght@400;700&family=Great+Vibes&family=Pacifico&family=Quicksand:wght@300;400;500;600;700&family=Dancing+Script:wght@400;500;600;700&family=Bebas+Neue&family=Creepster&family=Nosifer&family=Inter:wght@300;400;500;600;700;800;900&family=Lato:wght@300;400;700;900&family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap');
          
          :root {
            --theme-primary: ${theme.colors.primary};
            --theme-secondary: ${theme.colors.secondary};
            --theme-accent: ${theme.colors.accent};
            --theme-background: ${theme.colors.background};
            --theme-text: ${theme.colors.text};
            --theme-glow: ${theme.effects.glowColor};
          }
          
          @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .animate-gradient { animation: gradient 3s ease infinite; }
        `}</style>
      )}
      
      {/* Global theme effects (snow, blood drips, etc.) */}
      <GlobalThemeEffects themeId={effectiveThemeId} effects={settings.globalThemeEffects} />
      
      {children}
    </ThemeContext.Provider>
  );
}

