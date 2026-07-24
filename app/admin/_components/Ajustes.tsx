"use client";

import { FormEvent, useState } from "react";
import { Handshake, Loader2, Plus, Save, Settings, ShieldCheck, Trash2, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SETTING_KEYS } from "@/lib/settings";
import type { Provider, SettingsState } from "../_types";
import { Descuentos } from "./Descuentos";
import { DEFAULT_PARTNER_NAME, PARTNER_NAME_KEY, PARTNER_PCT_KEY, revalidarTienda, toPct, toPrice } from "../_helpers";

// Días de garantía: entero entre 1 y 90. Un 0 dejaría la entrega vencida al
// instante y le borraría la cuenta al cliente en el siguiente cron.
const toDias = (valor: string, fallback: number) => {
  const n = Math.trunc(Number(String(valor).replace(/[^0-9]/g, "")));
  return Number.isFinite(n) && n >= 1 && n <= 90 ? n : fallback;
};

const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:border-white/40";

type Props = {
  settings: SettingsState;
  providers: Provider[];
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onReloadProviders: () => Promise<void>;
};

export function Ajustes({ settings, providers, loading, setLoading, showNotice, onReloadProviders }: Props) {
  const [form, setForm] = useState<SettingsState>(settings);
  const [newProvider, setNewProvider] = useState("");

  const saveSetting = async (key: string, value: number) => {
    if (!supabase) return;
    await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
  };

  const saveTextSetting = async (key: string, value: string) => {
    if (!supabase) return;
    await supabase.from("app_settings").upsert({ key, value: 0, value_text: value }, { onConflict: "key" });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    setLoading(true);
    try {
      await Promise.all([
        saveSetting(SETTING_KEYS.nintendoOnlinePrice, toPrice(form.nintendoOnlinePrice)),
        saveSetting(SETTING_KEYS.packPriceIncrease, toPrice(form.packPriceIncrease)),
        saveSetting(SETTING_KEYS.garantiaJuegoDias, toDias(form.garantiaJuegoDias, 7)),
        saveSetting(SETTING_KEYS.garantiaPackDias, toDias(form.garantiaPackDias, 3)),
        saveSetting(PARTNER_PCT_KEY, toPct(form.partnerSplitPct)),
        saveTextSetting(PARTNER_NAME_KEY, form.partnerName.trim() || DEFAULT_PARTNER_NAME),
      ]);
      // El precio de Nintendo Online y el incremento de packs se muestran en la
      // tienda, así que hay que botar su caché para que el cambio se vea ya.
      revalidarTienda(["settings", "catalog"]);
      showNotice("success", "Configuración guardada.");
    } catch {
      showNotice("error", "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const addProvider = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const name = newProvider.trim();
    if (!name) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("providers").insert({ name });
      if (error) throw error;
      setNewProvider("");
      showNotice("success", "Proveedor agregado.");
      await onReloadProviders();
    } catch (err: any) {
      showNotice("error", `No se pudo agregar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeProvider = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("¿Eliminar este proveedor?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("providers").delete().eq("id", id);
      if (error) throw error;
      showNotice("success", "Proveedor eliminado.");
      await onReloadProviders();
    } catch (err: any) {
      showNotice("error", `No se pudo eliminar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-32 pt-16 space-y-6 md:pb-6 md:pt-6">
      <div>
        <h1 className="text-base font-black uppercase tracking-[0.15em]">Ajustes</h1>
        <p className="mt-0.5 text-xs text-gray-600">Precios y configuración de base de datos</p>
      </div>

      {/* Price settings */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/8">
            <Settings size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest">Precios base</h2>
            <p className="text-[10px] text-gray-600">Afectan el catálogo público</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Nintendo Online (CLP/año)</span>
              <input value={form.nintendoOnlinePrice}
                onChange={e => setForm({ ...form, nintendoOnlinePrice: e.target.value })}
                inputMode="numeric" className={INPUT} />
              <p className="mt-1 text-[10px] text-gray-700">Precio para la membresía</p>
            </label>
            <label>
              <span className={LABEL}>Incremento packs (%)</span>
              <input value={form.packPriceIncrease}
                onChange={e => setForm({ ...form, packPriceIncrease: e.target.value })}
                inputMode="numeric" className={INPUT} />
              <p className="mt-1 text-[10px] text-gray-700">Sobre el precio base de cada juego</p>
            </label>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/12">
                <ShieldCheck size={14} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest">Garantía</h2>
                <p className="text-[10px] text-gray-600">Solo afecta a las entregas nuevas</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block max-w-[10rem]">
                <span className={LABEL}>Juegos (días)</span>
                <input value={form.garantiaJuegoDias}
                  onChange={e => setForm({ ...form, garantiaJuegoDias: e.target.value })}
                  inputMode="numeric" className={INPUT} />
              </label>
              <label className="block max-w-[10rem]">
                <span className={LABEL}>Packs (días)</span>
                <input value={form.garantiaPackDias}
                  onChange={e => setForm({ ...form, garantiaPackDias: e.target.value })}
                  inputMode="numeric" className={INPUT} />
              </label>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-gray-700">
              El plazo se congela en cada entrega: si lo cambias, las cuentas ya entregadas
              conservan la garantía que se les prometió. Es también lo que dura el enlace de la
              boleta — al vencer, se borran las credenciales.
            </p>
          </div>

          <div className="border-t border-white/5 pt-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/12">
                <Handshake size={14} className="text-pink-400" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest">Reparto con socio</h2>
                <p className="text-[10px] text-gray-600">Nombre y % sugerido al registrar una venta nueva</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Nombre del socio</span>
                <input value={form.partnerName}
                  onChange={e => setForm({ ...form, partnerName: e.target.value })}
                  placeholder={DEFAULT_PARTNER_NAME} className={INPUT} />
                <p className="mt-1 text-[10px] text-gray-700">Aparece en el reparto de ganancia y en el pago de publicidad</p>
              </label>
              <label className="block max-w-[10rem]">
                <span className={LABEL}>Porcentaje del socio</span>
                <div className="relative">
                  <input value={form.partnerSplitPct}
                    onChange={e => setForm({ ...form, partnerSplitPct: e.target.value })}
                    inputMode="numeric" className={INPUT + " pr-8"} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-500">%</span>
                </div>
                <p className="mt-1 text-[10px] text-gray-700">Se puede ajustar en cada venta individual</p>
              </label>
            </div>
          </div>

          <button disabled={loading}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-white/90 disabled:opacity-60 active:scale-95">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {loading ? "Guardando…" : "Guardar ajustes"}
          </button>
        </form>
      </div>

      <Descuentos loading={loading} setLoading={setLoading} showNotice={showNotice} />

      {/* Providers */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/12">
            <Truck size={14} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest">Proveedores</h2>
            <p className="text-[10px] text-gray-600">Aparecen como opción al registrar una venta</p>
          </div>
        </div>

        <form onSubmit={addProvider} className="mb-3 flex gap-2">
          <input value={newProvider} onChange={e => setNewProvider(e.target.value)}
            placeholder="Nombre del proveedor" className={INPUT} />
          <button type="submit" disabled={loading || !newProvider.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-white/90 disabled:opacity-60 active:scale-95">
            <Plus size={13} /> Agregar
          </button>
        </form>

        {providers.length === 0 ? (
          <p className="text-xs text-gray-600">Sin proveedores registrados aún.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {providers.map(p => (
              <span key={p.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-1.5 text-xs font-semibold">
                {p.name}
                <button onClick={() => removeProvider(p.id)} disabled={loading}
                  className="rounded-full p-1 text-gray-600 hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-40">
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
