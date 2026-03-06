"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface AppSettings {
  currency: {
    code: string;
    symbol: string;
    name: string;
    exchangeRateToEUR: number;
  };
  credits: {
    name: string;
    symbol: string;
    icon: string;
    valueInEUR: number;
    showEUREquivalent: boolean;
    decimals: number;
  };
  branding: {
    primaryColor: string;
    accentColor: string;
    appLogo?: string;
    emailLogo?: string;
    favicon?: string;
    profileImage?: string;
  };
}

interface AppSettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  formatCredits: (amount: number, showEquivalent?: boolean) => string;
  formatCurrency: (amount: number) => string;
  /** Converts credits to base currency value. Named "EUR" for legacy reasons — works with any base currency. */
  creditsToEUR: (credits: number) => number;
  /** Converts base currency value to credits. Named "EUR" for legacy reasons — works with any base currency. */
  eurToCredits: (eur: number) => number;
  /** Alias for creditsToEUR — converts credits to the configured base currency value. */
  creditsToBaseCurrency: (credits: number) => number;
  /** Alias for eurToCredits — converts base currency value to credits. */
  baseCurrencyToCredits: (baseCurrencyAmount: number) => number;
}

const defaultSettings: AppSettings = {
  currency: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    exchangeRateToEUR: 1.0,
  },
  credits: {
    name: "Volt Credits",
    symbol: "⚡",
    icon: "zap",
    valueInEUR: 1.0,
    showEUREquivalent: true,
    decimals: 2,
  },
  branding: {
    primaryColor: "#EAB308",
    accentColor: "#F59E0B",
    appLogo: "/assets/images/logo.png",
    emailLogo: "/assets/images/logo.png",
    favicon: "/favicon.ico",
    profileImage: "/assets/images/PROFILE.png",
  },
};

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
  formatCredits: (amount: number) => `${amount.toFixed(2)}`,
  formatCurrency: (amount: number) => `€${amount.toFixed(2)}`,
  creditsToEUR: (credits: number) => credits,
  eurToCredits: (eur: number) => eur,
  creditsToBaseCurrency: (credits: number) => credits,
  baseCurrencyToCredits: (baseCurrencyAmount: number) => baseCurrencyAmount,
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error fetching app settings:", error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const refreshSettings = async () => {
    await fetchSettings();
  };

  // Reason: "EUR" in function names is legacy — these convert between credits and
  // whatever base currency the admin configured in Settings → Currency.
  const creditsToEUR = (credits: number): number => {
    if (!settings) return credits;
    return credits * settings.credits.valueInEUR;
  };

  const eurToCredits = (eur: number): number => {
    if (!settings) return eur;
    return eur / settings.credits.valueInEUR;
  };

  // Clear-name aliases
  const creditsToBaseCurrency = creditsToEUR;
  const baseCurrencyToCredits = eurToCredits;

  const formatCredits = (
    amount: number,
    showEquivalent: boolean = true,
  ): string => {
    if (!settings) return `${amount.toFixed(2)}`;

    const { name, symbol, showEUREquivalent, decimals } = settings.credits;
    const formattedAmount = amount.toFixed(decimals);
    const creditText = `${symbol} ${formattedAmount} ${name}`;

    if (showEquivalent && showEUREquivalent) {
      const eurValue = creditsToEUR(amount);
      return `${creditText} (${settings.currency.symbol}${eurValue.toFixed(2)})`;
    }

    return creditText;
  };

  const formatCurrency = (amount: number): string => {
    const symbol = settings?.currency?.symbol || "€";
    return `${symbol}${amount.toFixed(2)}`;
  };

  return (
    <AppSettingsContext.Provider
      value={{
        settings: settings || defaultSettings,
        loading,
        refreshSettings,
        formatCredits,
        formatCurrency,
        creditsToEUR,
        eurToCredits,
        creditsToBaseCurrency,
        baseCurrencyToCredits,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return context;
}
