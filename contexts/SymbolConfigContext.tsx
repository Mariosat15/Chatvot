"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { FOREX_PAIRS, type ForexSymbol } from "@/lib/services/pnl-calculator.service";

export interface ClientSymbolConfig {
  pip: number;
  contractSize: number;
  minLotSize: number;
  maxLotSize: number;
  lotStep: number;
}

interface SymbolConfigContextType {
  getConfig: (symbol: string) => ClientSymbolConfig;
  isLoaded: boolean;
}

const fallbackConfig = (symbol: string): ClientSymbolConfig => {
  const hc = FOREX_PAIRS[symbol as ForexSymbol];
  return {
    pip: hc?.pip ?? 0.0001,
    contractSize: hc?.contractSize ?? 100000,
    minLotSize: 0.01,
    maxLotSize: 100,
    lotStep: 0.01,
  };
};

const SymbolConfigContext = createContext<SymbolConfigContextType>({
  getConfig: fallbackConfig,
  isLoaded: false,
});

export function SymbolConfigProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<Map<string, ClientSymbolConfig>>(
    new Map(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/trading/symbols")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, ClientSymbolConfig>();
        if (data.symbols && Array.isArray(data.symbols)) {
          for (const sym of data.symbols) {
            map.set(sym.symbol, {
              pip: sym.pip,
              contractSize: sym.contractSize,
              minLotSize: sym.minLotSize ?? 0.01,
              maxLotSize: sym.maxLotSize ?? 100,
              lotStep: sym.lotStep ?? 0.01,
            });
          }
        }
        setConfigs(map);
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const getConfig = useCallback(
    (symbol: string): ClientSymbolConfig => {
      const cached = configs.get(symbol);
      if (cached) return cached;
      return fallbackConfig(symbol);
    },
    [configs],
  );

  return (
    <SymbolConfigContext.Provider value={{ getConfig, isLoaded }}>
      {children}
    </SymbolConfigContext.Provider>
  );
}

export function useSymbolConfig() {
  return useContext(SymbolConfigContext);
}
