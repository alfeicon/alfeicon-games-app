"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus, Save, Settings, Trash2, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SETTING_KEYS } from "@/lib/settings";
import type { Provider, SettingsState } from "../_types";
import { toPrice } from "../_helpers";

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

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    setLoading(true);
    try {
      await Promise.all([
        saveSetting(SETTING_KEYS.nintendoOnlinePrice, toPrice(form.nintendoOnlinePrice)),
        saveSetting(SETTING_KEYS.packPriceIncrease, toPrice(form.packPriceIncrease)),
      ]);
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

          <button disabled={loading}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-white/90 disabled:opacity-60 active:scale-95">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {loading ? "Guardando…" : "Guardar ajustes"}
          </button>
        </form>
      </div>

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
