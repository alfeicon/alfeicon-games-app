import { supabase } from "@/lib/supabase/client";

export type AppSettings = {
  nintendoOnlinePrice: number;
  packPriceIncrease: number;
  /**
   * Días de garantía para las entregas NUEVAS. El plazo se congela en cada
   * ítem al crearlo, así que cambiarlos aquí no le recorta la garantía a nadie
   * que ya haya comprado.
   */
  garantiaJuegoDias: number;
  garantiaPackDias: number;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  nintendoOnlinePrice: 25500,
  packPriceIncrease: 15000,
  garantiaJuegoDias: 7,
  garantiaPackDias: 3,
};

type SettingRow = {
  key: string;
  value: number | string | null;
};

const SETTING_KEYS = {
  nintendoOnlinePrice: "nintendo_online_price",
  packPriceIncrease: "pack_price_increase",
  garantiaJuegoDias: "garantia_juego_dias",
  garantiaPackDias: "garantia_pack_dias",
} as const;

const toSettingNumber = (value: number | string | null | undefined, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(String(value || "").replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export async function fetchAppSettings(): Promise<AppSettings> {
  if (!supabase) return DEFAULT_APP_SETTINGS;

  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", Object.values(SETTING_KEYS));

  if (error) {
    if (error.code !== "PGRST205") {
      console.warn("Using default app settings:", error.message);
    }

    return DEFAULT_APP_SETTINGS;
  }

  const settings = new Map((data || []).map((row: SettingRow) => [row.key, row.value]));

  return {
    nintendoOnlinePrice: toSettingNumber(
      settings.get(SETTING_KEYS.nintendoOnlinePrice),
      DEFAULT_APP_SETTINGS.nintendoOnlinePrice,
    ),
    packPriceIncrease: toSettingNumber(
      settings.get(SETTING_KEYS.packPriceIncrease),
      DEFAULT_APP_SETTINGS.packPriceIncrease,
    ),
    garantiaJuegoDias: toSettingNumber(
      settings.get(SETTING_KEYS.garantiaJuegoDias),
      DEFAULT_APP_SETTINGS.garantiaJuegoDias,
    ),
    garantiaPackDias: toSettingNumber(
      settings.get(SETTING_KEYS.garantiaPackDias),
      DEFAULT_APP_SETTINGS.garantiaPackDias,
    ),
  };
}

export { SETTING_KEYS };
