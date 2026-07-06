"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BASE_CURRENCY,
  CURRENCIES,
  DEFAULT_RATES,
  INTERNATIONAL_FEE_USD,
  convertFromClp,
  detectCurrencyFromBrowser,
  fetchLiveRates,
  formatMoney,
  getCurrency,
  readStoredCurrency,
  storeCurrency,
  type Currency,
  type CurrencyCode,
  type Rates,
} from "@/lib/currency";

type CurrencyContextValue = {
  currency: Currency;
  code: CurrencyCode;
  currencies: Currency[];
  rates: Rates;
  isBase: boolean;
  feeUsd: number;
  setCurrency: (code: CurrencyCode) => void;
  /** Convierte un precio CLP a la moneda activa (número, con recargo si aplica). */
  convert: (clp: number) => number;
  /** Formatea un precio CLP en la moneda activa, ej. "US$33.90". */
  format: (clp: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>(BASE_CURRENCY.code);
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);

  // Hidrata en el cliente para evitar mismatch de hidratación (el servidor no
  // tiene localStorage ni Intl del navegador). Prioridad: elección guardada →
  // país detectado por el navegador → Chile por defecto.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const resolved = readStoredCurrency() ?? detectCurrencyFromBrowser();
    if (resolved) setCode(resolved);

    let active = true;
    fetchLiveRates().then((live) => {
      if (active) setRates(live);
    });
    return () => {
      active = false;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCode(next);
    storeCurrency(next);
  }, []);

  const currency = getCurrency(code);

  const convert = useCallback((clp: number) => convertFromClp(clp, code, rates), [code, rates]);
  const format = useCallback(
    (clp: number) => formatMoney(convertFromClp(clp, code, rates), getCurrency(code)),
    [code, rates],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      code,
      currencies: CURRENCIES,
      rates,
      isBase: Boolean(currency.isBase),
      feeUsd: INTERNATIONAL_FEE_USD,
      setCurrency,
      convert,
      format,
    }),
    [currency, code, rates, setCurrency, convert, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency debe usarse dentro de <CurrencyProvider>");
  }
  return ctx;
}
