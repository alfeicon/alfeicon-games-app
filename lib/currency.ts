// Conversión de moneda para clientes internacionales.
//
// Los precios del catálogo se guardan y administran en CLP (peso chileno).
// Para clientes fuera de Chile mostramos el precio convertido a su moneda y
// sumamos un recargo fijo de US$7 por costos de cambio y transferencia.

export type CurrencyCode =
  | "CLP"
  | "USD"
  | "ARS"
  | "PEN"
  | "COP"
  | "MXN"
  | "BRL"
  | "EUR";

export type Currency = {
  code: CurrencyCode;
  /** Etiqueta legible para el selector, ej. "Dólar estadounidense". */
  label: string;
  /** País/zona para orientar al cliente. */
  region: string;
  /** Símbolo que se antepone al monto. */
  symbol: string;
  /** Bandera emoji para el selector. */
  flag: string;
  /** Locale usado para agrupar miles/decimales. */
  locale: string;
  /** Decimales a mostrar. */
  decimals: number;
  /** true para Chile: precio nativo, sin recargo internacional. */
  isBase?: boolean;
};

/** Recargo fijo en USD que se suma a cualquier precio no chileno. */
export const INTERNATIONAL_FEE_USD = 7;

/** Cada cuánto refrescamos las tasas en vivo (12 horas). */
const RATES_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const RATES_STORAGE_KEY = "alfeicon_fx_rates";
const CURRENCY_STORAGE_KEY = "alfeicon_currency";
const CURRENCY_PROMPT_KEY = "alfeicon_currency_prompted";
const LIVE_RATES_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

// El símbolo indica "dinero" y el código (CLP, ARS, USD…) en superíndice
// diferencia el país. Por eso las monedas tipo peso/dólar usan un "$" simple
// (evita repetir, ej. "AR$42.590 ARS"). Las de símbolo distinto lo conservan.
export const CURRENCIES: Currency[] = [
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "$", flag: "🇨🇱", locale: "es-CL", decimals: 0, isBase: true },
  { code: "USD", label: "Dólar estadounidense", region: "Internacional", symbol: "$", flag: "🌎", locale: "en-US", decimals: 0 },
  { code: "ARS", label: "Peso argentino", region: "Argentina", symbol: "$", flag: "🇦🇷", locale: "es-AR", decimals: 0 },
  { code: "PEN", label: "Sol peruano", region: "Perú", symbol: "S/", flag: "🇵🇪", locale: "es-PE", decimals: 0 },
  { code: "COP", label: "Peso colombiano", region: "Colombia", symbol: "$", flag: "🇨🇴", locale: "es-CO", decimals: 0 },
  { code: "MXN", label: "Peso mexicano", region: "México", symbol: "$", flag: "🇲🇽", locale: "es-MX", decimals: 0 },
  { code: "BRL", label: "Real brasileño", region: "Brasil", symbol: "R$", flag: "🇧🇷", locale: "pt-BR", decimals: 0 },
  { code: "EUR", label: "Euro", region: "Europa", symbol: "€", flag: "🇪🇺", locale: "es-ES", decimals: 0 },
];

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export const BASE_CURRENCY = CURRENCIES[0];

export function getCurrency(code: CurrencyCode): Currency {
  return CURRENCY_BY_CODE.get(code) ?? BASE_CURRENCY;
}

/**
 * Tasas expresadas como "unidades de la moneda por 1 USD" (base USD, igual que
 * la API pública). Ej: CLP 955 significa 1 USD ≈ 955 CLP.
 * Valores por defecto aproximados; se refrescan en vivo cuando hay red.
 */
export type Rates = Record<CurrencyCode, number>;

export const DEFAULT_RATES: Rates = {
  USD: 1,
  CLP: 955,
  ARS: 1180,
  PEN: 3.75,
  COP: 4050,
  MXN: 18.5,
  BRL: 5.55,
  EUR: 0.93,
};

function roundForCurrency(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Convierte un precio en CLP a la moneda destino, aplicando el recargo
 * internacional (US$7) para cualquier moneda que no sea chilena.
 */
export function convertFromClp(clp: number, code: CurrencyCode, rates: Rates): number {
  if (code === "CLP") return clp;

  const clpPerUsd = rates.CLP || DEFAULT_RATES.CLP;
  const unitsPerUsd = rates[code] || DEFAULT_RATES[code];

  const usd = clp / clpPerUsd + INTERNATIONAL_FEE_USD;
  return usd * unitsPerUsd;
}

/** Formatea un monto ya expresado en la moneda destino, ej. "US$33.90". */
export function formatMoney(value: number, currency: Currency): string {
  const rounded = roundForCurrency(value, currency.decimals);
  const num = rounded.toLocaleString(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });
  return `${currency.symbol}${num}`;
}

/** Convierte desde CLP y formatea en un solo paso. */
export function formatFromClp(clp: number, code: CurrencyCode, rates: Rates): string {
  return formatMoney(convertFromClp(clp, code, rates), getCurrency(code));
}

// ── Persistencia de la moneda elegida ──

export function loadStoredCurrency(): CurrencyCode {
  return readStoredCurrency() ?? BASE_CURRENCY.code;
}

/** Moneda guardada, o null si el visitante nunca eligió una. */
export function readStoredCurrency(): CurrencyCode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (raw && CURRENCY_BY_CODE.has(raw as CurrencyCode)) {
      return raw as CurrencyCode;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function storeCurrency(code: CurrencyCode): void {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/** true si ya mostramos el prompt de bienvenida de moneda a este visitante. */
export function hasSeenCurrencyPrompt(): boolean {
  try {
    return window.localStorage.getItem(CURRENCY_PROMPT_KEY) === "1";
  } catch {
    return true; // ante duda, no molestar
  }
}

export function markCurrencyPromptSeen(): void {
  try {
    window.localStorage.setItem(CURRENCY_PROMPT_KEY, "1");
  } catch {
    /* ignore */
  }
}

// ── Detección automática de país/moneda por el navegador ──

// Zona horaria → moneda (más confiable que el idioma para inferir el país).
const TZ_TO_CURRENCY: Record<string, CurrencyCode> = {
  "America/Santiago": "CLP",
  "Pacific/Easter": "CLP",
  "America/Punta_Arenas": "CLP",
  "America/Lima": "PEN",
  "America/Bogota": "COP",
  "America/Mexico_City": "MXN",
  "America/Monterrey": "MXN",
  "America/Cancun": "MXN",
  "America/Tijuana": "MXN",
  "America/Sao_Paulo": "BRL",
  "America/Fortaleza": "BRL",
  "America/Recife": "BRL",
  "America/Bahia": "BRL",
  "America/Manaus": "BRL",
};

// Región del idioma (ej. "es-CL" → "CL") → moneda.
const REGION_TO_CURRENCY: Record<string, CurrencyCode> = {
  CL: "CLP", AR: "ARS", PE: "PEN", CO: "COP", MX: "MXN", BR: "BRL", US: "USD",
  ES: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", PT: "EUR", NL: "EUR", IE: "EUR",
  AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", MT: "EUR",
};

/**
 * Intenta inferir la moneda del visitante desde el navegador (zona horaria y,
 * como respaldo, la región de su idioma). Devuelve null si no hay match seguro
 * (en ese caso el prompt deja Chile por defecto y el cliente elige).
 */
export function detectCurrencyFromBrowser(): CurrencyCode | null {
  if (typeof window === "undefined") return null;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.startsWith("America/Argentina")) return "ARS";
    if (TZ_TO_CURRENCY[tz]) return TZ_TO_CURRENCY[tz];
    if (tz.startsWith("Europe/")) return "EUR";
  } catch {
    /* ignore */
  }

  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const lang of langs) {
      const region = lang?.split("-")[1]?.toUpperCase();
      if (region && REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];
    }
  } catch {
    /* ignore */
  }

  return null;
}

// ── Tasas en vivo (best-effort, con fallback a DEFAULT_RATES) ──

type CachedRates = { ts: number; rates: Rates };

function readCachedRates(): CachedRates | null {
  try {
    const raw = window.localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (!parsed?.rates || typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeRates(remote: Partial<Record<string, number>>): Rates {
  const next = { ...DEFAULT_RATES };
  for (const code of Object.keys(next) as CurrencyCode[]) {
    const value = remote[code];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      next[code] = value;
    }
  }
  return next;
}

/**
 * Devuelve las tasas más recientes disponibles. Usa caché local si es fresca;
 * si no, intenta la API pública y cae a DEFAULT_RATES ante cualquier error.
 */
export async function fetchLiveRates(): Promise<Rates> {
  if (typeof window === "undefined") return DEFAULT_RATES;

  const cached = readCachedRates();
  if (cached && Date.now() - cached.ts < RATES_MAX_AGE_MS) {
    return cached.rates;
  }

  try {
    const res = await fetch(LIVE_RATES_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) throw new Error("FX payload inválido");

    const rates = mergeRates(data.rates);
    try {
      window.localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify({ ts: Date.now(), rates }));
    } catch {
      /* ignore */
    }
    return rates;
  } catch {
    return cached?.rates ?? DEFAULT_RATES;
  }
}
