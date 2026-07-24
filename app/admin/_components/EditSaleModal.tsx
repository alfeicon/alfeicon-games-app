"use client";

import { FormEvent, useState } from "react";
import { Gamepad2, Gift, Handshake, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Provider, Sale } from "../_types";
import { fmt, toPct, toPrice } from "../_helpers";

const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";
const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Débito", "Crédito", "Otro"];

type Props = {
  sale: Sale;
  providers: Provider[];
  partnerName: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
  onClose: () => void;
  onReload: () => Promise<void>;
};

export function EditSaleModal({ sale, providers, partnerName, loading, setLoading, showNotice, onClose, onReload }: Props) {
  const [price, setPrice] = useState(String(sale.price_sold));
  const [cost, setCost] = useState(sale.cost_price ? String(sale.cost_price) : "");
  const [method, setMethod] = useState(sale.payment_method || PAYMENT_METHODS[0]);
  const [provider, setProvider] = useState(sale.provider || "");
  const [notes, setNotes] = useState(sale.notes || "");
  const [splitEnabled, setSplitEnabled] = useState(sale.partner_pct != null);
  const [partnerPct, setPartnerPct] = useState(String(sale.partner_pct ?? 40));
  const activeProviders = providers.filter(p => p.is_active);

  const gain = toPrice(price) - toPrice(cost);

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const finalPrice = toPrice(price);
    if (finalPrice <= 0) { showNotice("error", "El precio de venta debe ser mayor a 0."); return; }
    setLoading(true);
    const { error } = await supabase.from("sales").update({
      price_sold: finalPrice, cost_price: toPrice(cost),
      payment_method: method, provider: provider || null,
      notes: notes.trim() || null,
      partner_pct: splitEnabled ? toPct(partnerPct) : null,
    }).eq("id", sale.id);
    setLoading(false);
    if (error) { showNotice("error", `No se pudo actualizar: ${error.message}`); return; }
    showNotice("success", "Venta actualizada.");
    await onReload();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg animate-soft-in overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] brand-shell">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-sm font-black uppercase tracking-widest">Editar venta</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-white/10 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={save} className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <div className={sale.item_type === "pack" ? "text-purple-400" : "text-blue-400"}>
              {sale.item_type === "pack" ? <Gift size={14} /> : <Gamepad2 size={14} />}
            </div>
            <p className="text-sm font-black text-white">{sale.item_title}</p>
          </div>

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

          {toPrice(price) > 0 && toPrice(cost) > 0 && (
            <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
              gain >= 0 ? "border border-green-500/15 bg-green-500/6" : "border border-red-500/15 bg-red-500/6"
            }`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Ganancia estimada</span>
              <span className={`font-black ${gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                ${fmt(gain)}
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
                    ${fmt(Math.round(gain * toPct(partnerPct) / 100))}
                  </span>
                </span>
                <span className="text-gray-500">
                  Tú ({100 - toPct(partnerPct)}%): <span className="font-black text-green-400">
                    ${fmt(Math.round(gain * (100 - toPct(partnerPct)) / 100))}
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

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading}
              className="magnetic flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-50">
              {loading ? <Loader2 size={13} className="animate-spin" /> : null}
              {loading ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-full border border-white/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-white/5">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
