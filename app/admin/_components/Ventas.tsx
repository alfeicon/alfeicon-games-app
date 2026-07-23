"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Gamepad2, Gift, Loader2, Pencil, Receipt, RefreshCw, Search, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Provider, Sale, SettingsState } from "../_types";
import { fmt, fmtDate, fmtTime } from "../_helpers";
import { EditSaleModal } from "./EditSaleModal";

const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";

type Props = {
  sales: Sale[];
  providers: Provider[];
  settings: SettingsState;
  salesTableExists: boolean | null;
  salesError: string | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onReload: () => Promise<void>;
};

export function Ventas({ sales, providers, settings, salesTableExists, salesError, loading, setLoading, showNotice, onReload }: Props) {
  const partnerName = settings.partnerName || "Socio";
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [salesSearch, setSalesSearch] = useState("");

  const filteredSales = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(s =>
      s.item_title.toLowerCase().includes(q) ||
      (s.provider || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q)
    );
  }, [sales, salesSearch]);

  const salesGroups = useMemo(() => {
    const groups = new Map<string, Sale[]>();
    filteredSales.forEach(s => {
      const key = new Date(s.created_at).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });
    return Array.from(groups.entries());
  }, [filteredSales]);

  const deleteSale = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("¿Eliminar esta venta?")) return;
    setLoading(true);
    await supabase.from("sales").delete().eq("id", id);
    setLoading(false);
    showNotice("success", "Venta eliminada."); await onReload();
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
            La tabla <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono">sales</code> no existe aún.
            Ve a <strong className="text-white">Ajustes</strong> para ver el SQL.
          </p>
        </div>

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
      <div className="shrink-0 border-b border-white/5 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-widest">Historial de Ventas</h1>
          <p className="mt-1 text-[11px] text-gray-500">Registro detallado de todas las ventas concretadas.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
        {/* Table */}
        <div className="px-4 py-6">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Receipt size={28} className="mb-3 text-gray-700" />
              <p className="text-sm font-bold text-gray-600">Sin ventas registradas.</p>
            </div>
          ) : (
            <>
              <div className="relative mb-4">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  value={salesSearch}
                  onChange={e => setSalesSearch(e.target.value)}
                  placeholder="Buscar por artículo, proveedor o nota..."
                  className={INPUT + " pl-9 bg-white/5"}
                />
              </div>

              {filteredSales.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Receipt size={28} className="mb-3 text-gray-700" />
                  <p className="text-sm font-bold text-gray-600">Sin resultados para tu búsqueda.</p>
                </div>
              ) : (
            <>
              {/* Mobile: stacked cards */}
              <div className="space-y-2 sm:hidden">
                {salesGroups.map(([month, items]) => (
                  <Fragment key={month}>
                    <p className="px-1 pt-2 text-[10px] font-black uppercase tracking-widest text-gray-500 capitalize first:pt-0">{month} ({items.length})</p>
                    {items.map(sale => {
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
                    </div>
                  );
                })}
                  </Fragment>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="brand-shell hidden overflow-hidden rounded-2xl sm:block">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto] gap-x-3 border-b border-white/5 px-4 py-2.5">
                  {["Artículo", "Tipo", "Venta", "Costo", "Ganancia", "Fecha", "", ""].map((h, i) => (
                    <p key={h || i} className="text-[9px] font-black uppercase tracking-widest text-gray-600">{h}</p>
                  ))}
                </div>
                <div className="divide-y divide-white/5">
                  {salesGroups.map(([month, items]) => (
                    <Fragment key={month}>
                      <div className="bg-white/[0.02] px-4 py-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 capitalize">{month} ({items.length})</p>
                      </div>
                      {items.map(sale => {
                    const gain = sale.price_sold - (sale.cost_price ?? 0);
                    const hasCost = (sale.cost_price ?? 0) > 0;
                    return (
                      <div key={sale.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto] items-center gap-x-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
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
                    </Fragment>
                  ))}
                </div>
              </div>
            </>
              )}
            </>
          )}
        </div>
      </div>

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
