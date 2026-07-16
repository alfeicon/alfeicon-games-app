"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Banknote, ChevronDown, ChevronUp, DollarSign, Gamepad2, Gift, Handshake, Loader2, Megaphone, Pencil, Plus, Receipt, RefreshCw, Trash2, TrendingDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { AdSpend, Provider, Sale, SettingsState } from "../_types";
import { fmt, fmtDate, fmtTime } from "../_helpers";
import { EditSaleModal } from "./EditSaleModal";

const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Débito", "Crédito", "Otro"];
const AD_PLATFORMS = ["Instagram", "Facebook", "TikTok", "Google", "Twitter / X", "Otro"];

type Props = {
  sales: Sale[];
  adSpend: AdSpend[];
  providers: Provider[];
  settings: SettingsState;
  salesTableExists: boolean | null;
  salesError: string | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onReload: () => Promise<void>;
};

type Tab = "ventas" | "publicidad";

export function Ventas({ sales, adSpend, providers, settings, salesTableExists, salesError, loading, setLoading, showNotice, onReload }: Props) {
  const partnerName = settings.partnerName || "Socio";
  const [tab, setTab] = useState<Tab>("ventas");
  const [showAddAd, setShowAddAd] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  /* Ad spend form */
  const [adForm, setAdForm] = useState({ platform: AD_PLATFORMS[0], amount: "", description: "", date: new Date().toISOString().slice(0, 10) });

  const now = new Date();
  const thisMonth = useMemo(
    () => sales.filter(s => {
      const d = new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales],
  );

  const totalRevenue = thisMonth.reduce((a, s) => a + s.price_sold, 0);
  const totalCost = thisMonth.reduce((a, s) => a + (s.cost_price ?? 0), 0);
  const grossProfit = totalRevenue - totalCost;

  const partnerProfit = thisMonth.reduce((a, s) => {
    const gain = s.price_sold - (s.cost_price ?? 0);
    const pct = s.partner_pct ?? 0;
    return a + gain * pct / 100;
  }, 0);
  const myProfit = grossProfit - partnerProfit;

  const thisMonthAdSpend = useMemo(() => {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear());
    return adSpend.filter(a => a.date.startsWith(`${y}-${m}`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adSpend]);

  const totalAdSpend = thisMonthAdSpend.reduce((a, s) => a + s.amount, 0);
  // La publicidad la paga el socio, así que se descuenta de su parte del reparto.
  const partnerNet = partnerProfit - totalAdSpend;

  const deleteSale = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("¿Eliminar esta venta?")) return;
    setLoading(true);
    await supabase.from("sales").delete().eq("id", id);
    setLoading(false);
    showNotice("success", "Venta eliminada."); await onReload();
  };

  const deleteAdSpend = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("¿Eliminar este gasto?")) return;
    setLoading(true);
    await supabase.from("ad_spend").delete().eq("id", id);
    setLoading(false);
    showNotice("success", "Gasto eliminado."); await onReload();
  };

  const saveAd = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const amount = Number(adForm.amount.replace(/[^0-9]/g, "")) || 0;
    if (!adForm.platform || amount <= 0) { showNotice("error", "Falta plataforma o monto."); return; }
    setLoading(true);
    const { error } = await supabase.from("ad_spend").insert({
      platform: adForm.platform, amount, description: adForm.description.trim() || null, date: adForm.date,
    });
    setLoading(false);
    if (error) { showNotice("error", "No se pudo guardar."); return; }
    showNotice("success", "Gasto de publicidad registrado.");
    setAdForm({ platform: AD_PLATFORMS[0], amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
    setShowAddAd(false); await onReload();
  };

  if (salesTableExists === false) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 pt-20 text-center md:pt-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/4">
          <Receipt size={22} className="text-gray-600" />
        </div>
        <div>
          <p className="text-lg font-black">Tablas no configuradas</p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            Las tablas <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono">sales</code> y{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono">ad_spend</code> no existen aún.
            Ve a <strong className="text-white">Ajustes</strong> para ver el SQL.
          </p>
        </div>

        {/* Show the actual Supabase error for debugging */}
        {salesError && (
          <div className="w-full max-w-md rounded-xl border border-red-500/15 bg-red-500/6 px-4 py-3 text-left">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-red-400">Error de Supabase</p>
            <code className="text-[11px] text-red-300/80 break-all">{salesError}</code>
          </div>
        )}

        <button onClick={onReload} disabled={loading}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-50 active:scale-95">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {loading ? "Verificando…" : "Ya las creé · Reintentar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-6 py-4">
        <h1 className="text-lg font-black uppercase tracking-widest">Ventas & Publicidad</h1>
        <div className="mt-3 flex gap-1">
          {(["ventas", "publicidad"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t ? "bg-white/15 text-white" : "text-gray-600 hover:text-gray-400"
              }`}>
              {t === "ventas" ? "Registro de ventas" : "Publicidad"}
            </button>
          ))}
        </div>
      </div>

      {tab === "ventas" && (
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          {/* Mini metrics */}
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {[
              { label: "Ventas este mes", value: thisMonth.length, icon: <Receipt size={14} className="text-blue-400" />, color: "" },
              { label: "Ingresos", value: `$${fmt(totalRevenue)}`, icon: <DollarSign size={14} className="text-green-400" />, color: "text-green-400" },
              { label: "Costo total", value: `$${fmt(totalCost)}`, icon: <Banknote size={14} className="text-orange-400" />, color: "text-orange-400" },
              { label: "Ganancia bruta", value: `$${fmt(grossProfit)}`, icon: <TrendingDown size={14} className={grossProfit >= 0 ? "text-green-400" : "text-red-400"} />, color: grossProfit >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Tu ganancia", value: `$${fmt(Math.round(myProfit))}`, icon: <DollarSign size={14} className="text-green-400" />, color: "text-green-400" },
              { label: `Ganancia ${partnerName}`, value: `$${fmt(Math.round(partnerProfit))}`, icon: <Handshake size={14} className="text-pink-400" />, color: "text-pink-400" },
              { label: `Pago a ${partnerName}`, value: `$${fmt(Math.round(partnerNet))}`, icon: <Megaphone size={14} className={partnerNet >= 0 ? "text-pink-400" : "text-red-400"} />, color: partnerNet >= 0 ? "text-pink-400" : "text-red-400" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="brand-glass rounded-2xl p-4">
                <div className="mb-2">{icon}</div>
                <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="px-4 pb-6">
            {sales.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Receipt size={28} className="mb-3 text-gray-700" />
                <p className="text-sm font-bold text-gray-600">Sin ventas registradas.</p>
              </div>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="space-y-2 sm:hidden">
                  {sales.map(sale => {
                    const gain = sale.price_sold - (sale.cost_price ?? 0);
                    const hasCost = (sale.cost_price ?? 0) > 0;
                    return (
                      <div key={sale.id} className="brand-shell rounded-2xl p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className={`mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${sale.item_type === "pack" ? "text-purple-400" : "text-blue-400"}`}>
                              {sale.item_type === "pack" ? <Gift size={10} /> : <Gamepad2 size={10} />}
                              {sale.item_type === "pack" ? "Pack" : "Juego"}
                            </div>
                            <p className="truncate text-sm font-semibold">{sale.item_title}</p>
                            {sale.provider && <p className="truncate text-[10px] text-gray-600">Proveedor: {sale.provider}</p>}
                            {sale.notes && <p className="truncate text-[10px] text-gray-600">{sale.notes}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button onClick={() => setEditingSale(sale)} disabled={loading}
                              className="rounded p-1 text-gray-700 hover:text-white transition-colors disabled:opacity-40">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => deleteSale(sale.id)} disabled={loading}
                              className="rounded p-1 text-gray-700 hover:text-red-400 transition-colors disabled:opacity-40">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Venta</p>
                            <p className="text-sm font-black text-green-400">${fmt(sale.price_sold)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Costo</p>
                            <p className="text-sm text-orange-400/80">{hasCost ? `$${fmt(sale.cost_price)}` : <span className="text-gray-700">—</span>}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Ganancia</p>
                            <p className={`text-sm font-black ${!hasCost ? "text-gray-700" : gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {hasCost ? `$${fmt(gain)}` : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400">{fmtDate(sale.created_at)}</p>
                            <p className="text-[9px] text-gray-600">{fmtTime(sale.created_at)}</p>
                          </div>
                        </div>
                        {hasCost && sale.partner_pct != null && (
                          <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2 text-[10px]">
                            <Handshake size={10} className="text-pink-400" />
                            <span className="text-gray-500">
                              {partnerName} {sale.partner_pct}%: <span className="font-black text-pink-400">${fmt(Math.round(gain * sale.partner_pct / 100))}</span>
                            </span>
                            <span className="text-gray-700">·</span>
                            <span className="text-gray-500">
                              Tú: <span className="font-black text-green-400">${fmt(Math.round(gain * (100 - sale.partner_pct) / 100))}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="brand-shell hidden overflow-hidden rounded-2xl sm:block">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto] gap-x-3 border-b border-white/5 px-4 py-2.5">
                    {["Artículo", "Tipo", "Venta", "Costo", "Ganancia", "Fecha", "", ""].map((h, i) => (
                      <p key={h || i} className="text-[9px] font-black uppercase tracking-widest text-gray-600">{h}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-white/5">
                    {sales.map(sale => {
                      const gain = sale.price_sold - (sale.cost_price ?? 0);
                      const hasCost = (sale.cost_price ?? 0) > 0;
                      return (
                        <div key={sale.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto] items-center gap-x-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{sale.item_title}</p>
                            {sale.provider && <p className="truncate text-[10px] text-gray-600">Proveedor: {sale.provider}</p>}
                            {sale.notes && <p className="truncate text-[10px] text-gray-600">{sale.notes}</p>}
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-black ${sale.item_type === "pack" ? "text-purple-400" : "text-blue-400"}`}>
                            {sale.item_type === "pack" ? <Gift size={11} /> : <Gamepad2 size={11} />}
                            {sale.item_type === "pack" ? "Pack" : "Juego"}
                          </div>
                          <p className="text-sm font-black text-green-400">${fmt(sale.price_sold)}</p>
                          <p className="text-sm text-orange-400/80">{hasCost ? `$${fmt(sale.cost_price)}` : <span className="text-gray-700">—</span>}</p>
                          <div>
                            <p className={`text-sm font-black ${!hasCost ? "text-gray-700" : gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {hasCost ? `$${fmt(gain)}` : "—"}
                            </p>
                            {hasCost && sale.partner_pct != null && (
                              <p className="mt-0.5 flex items-center gap-1 text-[9px] text-gray-600">
                                <Handshake size={9} className="text-pink-400" />
                                {partnerName} {sale.partner_pct}%: ${fmt(Math.round(gain * sale.partner_pct / 100))}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400">{fmtDate(sale.created_at)}</p>
                            <p className="text-[9px] text-gray-600">{fmtTime(sale.created_at)}</p>
                          </div>
                          <button onClick={() => setEditingSale(sale)} disabled={loading}
                            className="rounded p-1 text-gray-700 hover:text-white transition-colors disabled:opacity-40">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteSale(sale.id)} disabled={loading}
                            className="rounded p-1 text-gray-700 hover:text-red-400 transition-colors disabled:opacity-40">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "publicidad" && (
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          {/* Mini metrics */}
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              { label: "Ingresos este mes", value: `$${fmt(totalRevenue)}`, icon: <DollarSign size={14} className="text-green-400" />, c: "text-green-400" },
              { label: `Ganancia bruta ${partnerName}`, value: `$${fmt(Math.round(partnerProfit))}`, icon: <Handshake size={14} className="text-pink-400" />, c: "text-pink-400" },
              { label: `Gasto en publicidad (paga ${partnerName})`, value: `$${fmt(totalAdSpend)}`, icon: <Megaphone size={14} className="text-orange-400" />, c: "text-orange-400" },
              { label: `Pago a ${partnerName}`, value: `$${fmt(Math.round(partnerNet))}`, icon: <TrendingDown size={14} className={partnerNet >= 0 ? "text-green-400" : "text-red-400"} />, c: partnerNet >= 0 ? "text-green-400" : "text-red-400" },
            ].map(({ label, value, icon, c }) => (
              <div key={label} className="brand-glass rounded-2xl p-4">
                <div className="mb-2">{icon}</div>
                <p className={`text-xl font-black leading-none ${c}`}>{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {/* Add ad spend */}
          <div className="px-4 pb-2">
            <button onClick={() => setShowAddAd(v => !v)}
              className="magnetic flex w-full items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5">
              <span className="flex items-center gap-2 text-sm font-black">
                <Plus size={14} className="text-orange-400" /> Registrar gasto de publicidad
              </span>
              {showAddAd ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
            </button>
          </div>

          {showAddAd && (
            <form onSubmit={saveAd} className="mx-4 mb-4 brand-glass rounded-2xl p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={LABEL}>Plataforma</label>
                  <select value={adForm.platform} onChange={e => setAdForm({ ...adForm, platform: e.target.value })} className={INPUT + " focus:border-orange-500"}>
                    {AD_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Monto CLP</label>
                  <input value={adForm.amount} onChange={e => setAdForm({ ...adForm, amount: e.target.value })} inputMode="numeric" className={INPUT + " focus:border-orange-500"} />
                </div>
                <div>
                  <label className={LABEL}>Fecha</label>
                  <input type="date" value={adForm.date} onChange={e => setAdForm({ ...adForm, date: e.target.value })} className={INPUT + " focus:border-orange-500"} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Descripción (opcional)</label>
                <input value={adForm.description} onChange={e => setAdForm({ ...adForm, description: e.target.value })} className={INPUT + " focus:border-orange-500"} placeholder="Ej: campaña verano, boost post…" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading}
                  className="magnetic flex-1 rounded-full bg-orange-500 py-2.5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
                  {loading ? "Guardando…" : "Registrar gasto"}
                </button>
                <button type="button" onClick={() => setShowAddAd(false)}
                  className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-white/5">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Ad spend list */}
          <div className="px-4 pb-6">
            {adSpend.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Megaphone size={28} className="mb-3 text-gray-700" />
                <p className="text-sm font-bold text-gray-600">Sin gastos de publicidad registrados.</p>
              </div>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="space-y-2 sm:hidden">
                  {adSpend.map(spend => (
                    <div key={spend.id} className="brand-shell flex items-center justify-between gap-3 rounded-2xl p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{spend.platform}</p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">{spend.description || "—"}</p>
                        <p className="mt-0.5 text-[10px] text-gray-600">{fmtDate(spend.date)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-orange-400">${fmt(spend.amount)}</p>
                      <button onClick={() => deleteAdSpend(spend.id)} disabled={loading}
                        className="shrink-0 rounded p-1 text-gray-700 hover:text-red-400 transition-colors disabled:opacity-40">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="brand-shell hidden overflow-hidden rounded-2xl sm:block">
                  <div className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] gap-x-4 border-b border-white/5 px-4 py-2.5">
                    {["Plataforma", "Monto", "Fecha", "Descripción", ""].map(h => (
                      <p key={h} className="text-[9px] font-black uppercase tracking-widest text-gray-600">{h}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-white/5">
                    {adSpend.map(spend => (
                      <div key={spend.id} className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-center gap-x-4 px-4 py-3">
                        <p className="text-sm font-bold">{spend.platform}</p>
                        <p className="text-sm font-black text-orange-400">${fmt(spend.amount)}</p>
                        <p className="text-[11px] text-gray-400">{fmtDate(spend.date)}</p>
                        <p className="truncate text-[11px] text-gray-500">{spend.description || "—"}</p>
                        <button onClick={() => deleteAdSpend(spend.id)} disabled={loading}
                          className="rounded p-1 text-gray-700 hover:text-red-400 transition-colors disabled:opacity-40">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editingSale && (
        <EditSaleModal sale={editingSale} providers={providers} partnerName={partnerName}
          loading={loading} setLoading={setLoading}
          showNotice={showNotice}
          onClose={() => setEditingSale(null)}
          onReload={onReload} />
      )}
    </div>
  );
}
