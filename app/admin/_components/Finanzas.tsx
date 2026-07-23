"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Banknote, CalendarDays, ChevronDown, ChevronUp, DollarSign, Handshake, Loader2, Megaphone, Plus, Receipt, RefreshCw, Trash2, TrendingDown, TrendingUp, Bot
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { AdSpend, AdminGame, AdminPack, Sale, SettingsState } from "../_types";
import { fmt, fmtDate } from "../_helpers";

const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";

const AD_PLATFORMS = ["Instagram", "Facebook", "TikTok", "Google", "Twitter / X", "Otro"];

type Props = {
  sales: Sale[];
  adSpend: AdSpend[];
  games: AdminGame[];
  packs: AdminPack[];
  settings: SettingsState;
  salesTableExists: boolean | null;
  salesError: string | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onReload: () => Promise<void>;
};

type Tab = "resumen" | "publicidad";

export function Finanzas({ sales, adSpend, games, packs, settings, salesTableExists, salesError, loading, setLoading, showNotice, onReload }: Props) {
  const partnerName = settings.partnerName || "Socio";
  const [tab, setTab] = useState<Tab>("resumen");
  const [showAddAd, setShowAddAd] = useState(false);
  const [adForm, setAdForm] = useState({ platform: AD_PLATFORMS[0], amount: "", description: "", date: new Date().toISOString().slice(0, 10) });

  const now = new Date();
  
  // -- CALCULOS GENERALES --
  const thisMonth = useMemo(
    () => sales.filter(s => {
      const d = new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }),
    [sales, now]
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
  }, [adSpend, now]);

  const totalAdSpend = thisMonthAdSpend.reduce((a, s) => a + s.amount, 0);
  const partnerNet = partnerProfit - totalAdSpend; // La publicidad la paga el socio

  // -- AGRUPAR POR DÍAS (Calendario / Historial Diario) --
  const dailyStats = useMemo(() => {
    const map = new Map<string, { dateStr: string; rev: number; cost: number; ad: number; salesCount: number }>();
    
    // Add sales to map
    thisMonth.forEach(s => {
      const d = new Date(s.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
      if (!map.has(d)) map.set(d, { dateStr: d, rev: 0, cost: 0, ad: 0, salesCount: 0 });
      const stat = map.get(d)!;
      stat.rev += s.price_sold;
      stat.cost += (s.cost_price ?? 0);
      stat.salesCount++;
    });

    // Add ad spend to map
    thisMonthAdSpend.forEach(a => {
      const d = a.date; // already YYYY-MM-DD
      if (!map.has(d)) map.set(d, { dateStr: d, rev: 0, cost: 0, ad: 0, salesCount: 0 });
      const stat = map.get(d)!;
      stat.ad += a.amount;
    });

    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [thisMonth, thisMonthAdSpend]);

  // -- GESTION DE PUBLICIDAD --
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

  // -- REPORTE PARA IA --
  const generateAIReport = () => {
    // Calculamos top vendidos del mes
    const itemCounts = new Map<string, number>();
    thisMonth.forEach(s => {
      itemCounts.set(s.item_title, (itemCounts.get(s.item_title) || 0) + 1);
    });
    const topSelling = Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const lines = [
      `# Reporte Financiero Avanzado - ${new Date().toLocaleDateString("es-CL")}`,
      `Generado para análisis por Inteligencia Artificial.`,
      ``,
      `## Resumen Global (Mes Actual)`,
      `- Ventas totales: ${thisMonth.length}`,
      `- Ingresos totales (CLP): ${totalRevenue}`,
      `- Costos totales (CLP): ${totalCost}`,
      `- Ganancia bruta (CLP): ${grossProfit}`,
      `- Gasto en publicidad (CLP): ${totalAdSpend}`,
      `- Ganancia neta final (CLP): ${grossProfit - totalAdSpend}`,
      ``,
      `## Catálogo de Productos y Precios Actuales`,
      `### Juegos`,
      ...games.map(g => `- ${g.title}: $${g.price} (Costo: $${g.cost_price})`),
      `### Packs`,
      ...packs.map(p => `- ${p.title}: $${p.price} (Costo: $${p.cost_price})`),
      ``,
      `## Top 10 Artículos Más Vendidos (Mes Actual)`,
      ...topSelling.map(([title, count], i) => `${i + 1}. ${title} (${count} ventas)`),
      ``,
      `## Desglose Diario (Mes Actual)`,
      `Formato: Fecha | Ingresos | Costos | Ganancia Bruta | Gasto Publicidad | Ganancia Neta del Día`,
      ...dailyStats.map(d => {
         const dGross = d.rev - d.cost;
         const dNet = dGross - d.ad;
         return `- ${d.dateStr} | Ingresos: $${d.rev} | Costos: $${d.cost} | G. Bruta: $${dGross} | Publicidad: $${d.ad} | Neta: $${dNet}`;
      }),
      ``,
      `## Detalle de Gastos en Publicidad (Mes Actual)`,
      ...(thisMonthAdSpend.length > 0 
          ? thisMonthAdSpend.map(ad => `- ${ad.platform}: $${ad.amount} (${ad.description || "Sin descripción"})`)
          : ["- No hay gastos de publicidad registrados este mes."]),
      ``,
      `## INSTRUCCIONES PARA LA IA`,
      `Actúa como un analista financiero experto y asesor de negocios para esta tienda de videojuegos digitales.`,
      `1. Analiza los márgenes de ganancia basándote en los precios de los juegos/packs y sus costos.`,
      `2. Observa el desglose diario para identificar patrones (ej. si algunos días venden mucho más y por qué).`,
      `3. Evalúa la eficiencia del gasto publicitario frente a las ganancias generadas.`,
      `4. Entrégame un diagnóstico claro de la salud financiera del negocio este mes.`,
      `5. Provee entre 3 y 5 recomendaciones accionables y estratégicas para optimizar la rentabilidad (ej. subir/bajar precios, cambiar estrategias de ads, enfocar ventas en ciertos packs/juegos).`
    ];

    const blob = new Blob([lines.join("\\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas_avanzadas_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotice("success", "Reporte para IA descargado con éxito.");
  };

  if (salesTableExists === false) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 pt-20 text-center md:pt-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/4">
          <Banknote size={22} className="text-gray-600" />
        </div>
        <div>
          <p className="text-lg font-black">Tablas no configuradas</p>
          <p className="mt-2 max-w-sm text-sm text-gray-600">
            Faltan las tablas para Finanzas.
          </p>
        </div>
        <button onClick={onReload} disabled={loading}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 disabled:opacity-50 active:scale-95">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-widest text-emerald-400">Finanzas</h1>
          <div className="mt-3 flex gap-1">
            {(["resumen", "publicidad"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t ? "bg-emerald-500/15 text-emerald-300" : "text-gray-600 hover:text-gray-400"
                }`}>
                {t === "resumen" ? "Resumen & Calendario" : "Publicidad"}
              </button>
            ))}
          </div>
        </div>
        <button 
          onClick={generateAIReport}
          className="magnetic flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500/20"
        >
          <Bot size={14} />
          Reporte IA Avanzado
        </button>
      </div>

      {tab === "resumen" && (
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          {/* Mini metrics */}
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {[
              { label: "Ventas este mes", value: thisMonth.length, icon: <Receipt size={14} className="text-blue-400" />, color: "" },
              { label: "Ingresos", value: `$${fmt(totalRevenue)}`, icon: <TrendingUp size={14} className="text-green-400" />, color: "text-green-400" },
              { label: "Costo total", value: `$${fmt(totalCost)}`, icon: <Banknote size={14} className="text-orange-400" />, color: "text-orange-400" },
              { label: "Ganancia bruta", value: `$${fmt(grossProfit)}`, icon: <TrendingDown size={14} className={grossProfit >= 0 ? "text-emerald-400" : "text-red-400"} />, color: grossProfit >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Tu ganancia", value: `$${fmt(Math.round(myProfit))}`, icon: <DollarSign size={14} className="text-emerald-400" />, color: "text-emerald-400" },
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

          <div className="px-4 pb-2 mt-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
              <CalendarDays size={16} className="text-emerald-400" />
              Calendario de Ganancias (Día a Día)
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 mb-4">Resumen de ingresos, costos y publicidad de cada día con actividad en el mes.</p>
            
            {dailyStats.length === 0 ? (
              <div className="brand-shell rounded-2xl p-8 text-center">
                <p className="text-sm font-bold text-gray-600">No hay actividad registrada este mes aún.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {dailyStats.map((d, i) => {
                  const dGross = d.rev - d.cost;
                  const dNet = dGross - d.ad;
                  
                  // Darle un poco de estilo si fue un día muy bueno
                  const isGreatDay = dNet > 15000; // Ejemplo estático > 15k
                  const isLoss = dNet < 0;

                  return (
                    <div key={d.dateStr} className={`rounded-2xl p-4 border transition-all ${isGreatDay ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : isLoss ? 'bg-red-500/5 border-red-500/20' : 'brand-shell border-white/5'}`}>
                      <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
                        <p className="font-black tracking-widest text-white">{fmtDate(d.dateStr)}</p>
                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded-full text-gray-300">
                          {d.salesCount} {d.salesCount === 1 ? 'venta' : 'ventas'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ingresos</span>
                          <span className="font-semibold text-green-400">+${fmt(d.rev)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Costos</span>
                          <span className="font-semibold text-orange-400">-${fmt(d.cost)}</span>
                        </div>
                        {d.ad > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Publicidad</span>
                            <span className="font-semibold text-pink-400">-${fmt(d.ad)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Neto</span>
                        <span className={`text-lg font-black ${dNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${fmt(dNet)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "publicidad" && (
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          <div className="px-4 pt-4 pb-2">
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
                      <div key={spend.id} className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-center gap-x-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
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
    </div>
  );
}
