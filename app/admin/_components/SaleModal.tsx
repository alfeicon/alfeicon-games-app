"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Gamepad2, Gift, Handshake, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { AdminGame, AdminPack, Provider, SettingsState } from "../_types";
import { fmt, toPct, toPrice } from "../_helpers";

const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";
const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Débito", "Crédito", "Otro"];

type Props = {
  games: AdminGame[];
  packs: AdminPack[];
  providers: Provider[];
  settings: SettingsState;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onClose: () => void;
  onReload: () => Promise<void>;
};

type ItemType = "game" | "pack";

export function SaleModal({ games, packs, providers, settings, loading, setLoading, showNotice, onClose, onReload }: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ItemType>("game");
  const [selected, setSelected] = useState<{ id: string; title: string; price: number; cost_price: number } | null>(null);
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [partnerPct, setPartnerPct] = useState(settings.partnerSplitPct || "40");
  const partnerName = settings.partnerName || "Socio";
  const [saved, setSaved] = useState<{ title: string; price: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const activeProviders = providers.filter(p => p.is_active);

  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current); }, []);

  const pool = useMemo(
    () =>
      type === "game"
        ? games.filter(g => g.is_active).map(g => ({ id: g.id, title: g.title, price: g.is_offer && g.offer_price ? g.offer_price : g.price, cost_price: g.cost_price ?? 0 }))
        : packs.filter(p => p.is_active).map(p => ({ id: p.id, title: p.title, price: p.price, cost_price: p.cost_price ?? 0 })),
    [type, games, packs],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool.slice(0, 6);
    return pool.filter(i => i.title.toLowerCase().includes(q)).slice(0, 6);
  }, [pool, query]);

  const pickItem = (item: typeof selected) => {
    setSelected(item);
    if (item) {
      setPrice(String(item.price));
      setCost(item.cost_price > 0 ? String(item.cost_price) : "");
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase || !selected) return;
    const finalPrice = toPrice(price) || selected.price;
    const finalCost = toPrice(cost);
    setLoading(true);
    const { error } = await supabase.from("sales").insert({
      item_type: type, item_id: selected.id, item_title: selected.title,
      price_sold: finalPrice, cost_price: finalCost,
      payment_method: method, provider: provider || null,
      notes: notes.trim() || null,
      partner_pct: splitEnabled ? toPct(partnerPct) : null,
    });
    if (!error && type === "pack") {
      await supabase.from("pack_items").delete().eq("pack_id", selected.id);
      await supabase.from("packs").delete().eq("id", selected.id);
    }
    setLoading(false);
    if (error) { showNotice("error", `No se pudo registrar: ${error.message}`); return; }
    showNotice("success", `Venta de "${selected.title}" registrada.`);
    setSaved({ title: selected.title, price: finalPrice });
    await onReload();
    closeTimerRef.current = window.setTimeout(onClose, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-lg animate-soft-in overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] brand-shell">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-sm font-black uppercase tracking-widest">Registrar venta</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-white/10 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="sale-success-ring absolute inset-0 rounded-full border-2 border-green-500/50" />
              <span className="sale-success-icon flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                <Check size={28} strokeWidth={3} />
              </span>
            </div>
            <div className="sale-success-text">
              <p className="text-sm font-black uppercase tracking-widest text-white">Venta registrada</p>
              <p className="mt-1 text-xs text-gray-500">{saved.title} · ${fmt(saved.price)}</p>
            </div>
          </div>
        ) : (
        <form onSubmit={save} className="flex flex-col gap-4 p-6">
          {/* Type toggle */}
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-600">Tipo</p>
            <div className="premium-surface relative flex overflow-hidden rounded-full p-1">
              <span className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white transition-transform duration-300 ${type === "pack" ? "translate-x-[calc(100%+0.5rem)]" : ""}`} />
              {([["game", "Juego"], ["pack", "Pack"]] as [ItemType, string][]).map(([t, l]) => (
                <button key={t} type="button" onClick={() => { setType(t); setSelected(null); setPrice(""); setQuery(""); }}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-black uppercase tracking-widest transition-colors ${type === t ? "text-black" : "text-gray-500 hover:text-white"}`}>
                  {t === "game" ? <Gamepad2 size={11} /> : <Gift size={11} />} {l}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          {!selected ? (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-600">Buscar {type === "game" ? "juego" : "pack"}</p>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={`Buscar ${type === "game" ? "juego" : "pack"}…`}
                  className="premium-control w-full rounded-xl py-2.5 pl-8 pr-3 text-sm outline-none" autoFocus />
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/8">
                {results.map(item => (
                  <button key={item.id} type="button" onClick={() => pickItem(item)}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left last:border-0 hover:bg-white/8 transition-colors">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${type === "pack" ? "bg-purple-500/15" : "bg-blue-500/15"}`}>
                      {type === "pack" ? <Gift size={12} className="text-purple-400" /> : <Gamepad2 size={12} className="text-blue-400" />}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title}</p>
                    <p className="shrink-0 text-sm font-black">${fmt(item.price)}</p>
                  </button>
                ))}
                {results.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-gray-600">Sin resultados</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className={`flex items-center gap-2.5 ${type === "pack" ? "text-purple-400" : "text-blue-400"}`}>
                {type === "pack" ? <Gift size={14} /> : <Gamepad2 size={14} />}
                <p className="text-sm font-black text-white">{selected.title}</p>
              </div>
              <button type="button" onClick={() => { setSelected(null); setPrice(""); }}
                className="rounded-full p-1 text-gray-600 hover:text-white transition-colors">
                <X size={13} />
              </button>
            </div>
          )}

          {selected && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Precio cobrado</p>
                  <input value={price} onChange={e => setPrice(e.target.value)} inputMode="numeric"
                    className={INPUT + " focus:border-green-500"} />
                </label>
                <label>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Costo (lo que pagaste)</p>
                  <input value={cost} onChange={e => setCost(e.target.value)} inputMode="numeric"
                    className={INPUT + " focus:border-orange-500"} placeholder="0" />
                </label>
              </div>

              {/* Profit preview */}
              {toPrice(price) > 0 && toPrice(cost) > 0 && (
                <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                  toPrice(price) - toPrice(cost) >= 0
                    ? "border border-green-500/15 bg-green-500/6"
                    : "border border-red-500/15 bg-red-500/6"
                }`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Ganancia estimada</span>
                  <span className={`font-black ${toPrice(price) - toPrice(cost) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    ${(toPrice(price) - toPrice(cost)).toLocaleString("es-CL")}
                    <span className="ml-1.5 text-[10px] opacity-70">
                      ({Math.round((1 - toPrice(cost) / toPrice(price)) * 100)}%)
                    </span>
                  </span>
                </div>
              )}

              {/* Partner split */}
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <input type="checkbox" checked={splitEnabled} onChange={e => setSplitEnabled(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-pink-500" />
                    <Handshake size={13} className="text-pink-400" /> Dividir ganancia con {partnerName}
                  </label>
                  {splitEnabled && (
                    <div className="flex items-center gap-1">
                      <input value={partnerPct} onChange={e => setPartnerPct(e.target.value.replace(/[^0-9]/g, ""))}
                        inputMode="numeric"
                        className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-sm font-black text-white outline-none focus:border-pink-500" />
                      <span className="text-xs font-black text-gray-500">%</span>
                    </div>
                  )}
                </div>
                {splitEnabled && toPrice(price) > 0 && (
                  <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                    <span className="text-gray-500">
                      {partnerName} ({toPct(partnerPct)}%): <span className="font-black text-pink-400">
                        ${fmt(Math.round((toPrice(price) - toPrice(cost)) * toPct(partnerPct) / 100))}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Tú ({100 - toPct(partnerPct)}%): <span className="font-black text-green-400">
                        ${fmt(Math.round((toPrice(price) - toPrice(cost)) * (100 - toPct(partnerPct)) / 100))}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Método de pago</p>
                  <select value={method} onChange={e => setMethod(e.target.value)} className={INPUT + " focus:border-green-500"}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Proveedor</p>
                  <select value={provider} onChange={e => setProvider(e.target.value)} className={INPUT + " focus:border-green-500"}>
                    <option value="">Sin proveedor</option>
                    {activeProviders.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Notas (opcional)</p>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cliente, canal, observaciones…"
                  className={INPUT + " focus:border-white/30"} />
              </label>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading || !selected}
              className="magnetic flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50">
              {loading ? <Loader2 size={13} className="animate-spin" /> : null}
              {loading ? "Guardando…" : "Registrar venta"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-full border border-white/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
