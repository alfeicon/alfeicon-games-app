"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import {
  Banknote, CalendarDays, ChevronDown, ChevronUp, DollarSign, Gamepad2, Gift, Handshake, Loader2, Megaphone, Plus, Receipt, RefreshCw, Trash2, TrendingDown, TrendingUp, Bot, X
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { AdSpend, AdminGame, AdminPack, Provider, Sale, SettingsState } from "../_types";
import { fmt, fmtDate, fmtTime } from "../_helpers";
import { Ventas } from "./Ventas";

const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";

const AD_PLATFORMS = ["Instagram", "Facebook", "TikTok", "Google", "Twitter / X", "Otro"];

type Props = {
  sales: Sale[];
  adSpend: AdSpend[];
  games: AdminGame[];
  packs: AdminPack[];
  providers: Provider[];
  settings: SettingsState;
  salesTableExists: boolean | null;
  salesError: string | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error" | "info", text: string, playSound?: boolean) => void;
  onReload: () => Promise<void>;
};

/* ── Frasco animado que se llena según la ganancia ── */
const MoneyJar = ({ amount }: { amount: number }) => {
  const [fill, setFill] = useState(0);
  const MAX_GOAL = 1000000;
  const targetFill = Math.min(100, Math.max(0, (amount / MAX_GOAL) * 100));

  useEffect(() => {
    const timer = setTimeout(() => setFill(targetFill), 400);
    return () => clearTimeout(timer);
  }, [targetFill]);

  return (
    <div className="relative mb-2 flex items-center justify-center drop-shadow-[0_0_20px_rgba(52,211,153,0.3)] z-10">
      <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-24 md:h-28">
        <defs>
          <clipPath id="jarClip">
            <path d="M 30 15 L 30 25 C 15 30 15 45 15 60 L 15 105 C 15 115 25 115 50 115 C 75 115 85 115 85 105 L 85 60 C 85 45 85 30 70 25 L 70 15 Z" />
          </clipPath>
          <linearGradient id="moneyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* Fondo */}
        <path d="M 30 15 L 30 25 C 15 30 15 45 15 60 L 15 105 C 15 115 25 115 50 115 C 75 115 85 115 85 105 L 85 60 C 85 45 85 30 70 25 L 70 15 Z" fill="rgba(255,255,255,0.02)" />
        {/* Llenado */}
        <rect x="0" y={115 - (100 * (fill / 100))} width="100" height="100" fill="url(#moneyGrad)" clipPath="url(#jarClip)" className="transition-all duration-[2000ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]" />
        {/* Borde */}
        <path d="M 30 15 L 30 25 C 15 30 15 45 15 60 L 15 105 C 15 115 25 115 50 115 C 75 115 85 115 85 105 L 85 60 C 85 45 85 30 70 25 L 70 15 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
        {/* Tapa */}
        <rect x="25" y="5" width="50" height="12" rx="4" fill="rgba(255,255,255,0.9)" />
        <rect x="22" y="10" width="56" height="4" rx="2" fill="rgba(0,0,0,0.1)" />
        {/* Reflejo */}
        <path d="M 25 45 C 25 70 25 90 30 100" stroke="rgba(255,255,255,0.25)" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
      {fill > 0 && (
        <div className="absolute top-0 pointer-events-none animate-[fadeIn_1s_ease-in_2s_both]">
          <div className="absolute -left-6 top-8 animate-[bounce_2s_infinite]">
            <div className="h-4 w-4 rounded-full bg-emerald-400 border-2 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.8)] flex items-center justify-center text-[#0c0f12]">
              <span className="text-[9px] font-black leading-none">$</span>
            </div>
          </div>
          <div className="absolute left-6 -top-2 animate-[bounce_2.5s_infinite]">
            <div className="h-5 w-5 rounded-full bg-emerald-300 border-2 border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,1)] flex items-center justify-center text-[#0c0f12]">
              <span className="text-[10px] font-black leading-none">$</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type Tab = "resumen" | "publicidad" | "historial";

export function Finanzas({ sales, adSpend, games, packs, providers, settings, salesTableExists, salesError, loading, setLoading, showNotice, onReload }: Props) {
  const partnerName = settings.partnerName || "Socio";
  const [tab, setTab] = useState<Tab>("resumen");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [showAddAd, setShowAddAd] = useState(false);
  const [adForm, setAdForm] = useState({ platform: AD_PLATFORMS[0], amount: "", description: "", date: new Date().toISOString().slice(0, 10), duration_days: "7" });

  const now = new Date();
  const CUTOFF_DATE = new Date("2026-08-01T00:00:00-04:00");
  
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

  const partnerProfitOldLogic = thisMonth.reduce((a, s) => {
    const gain = s.price_sold - (s.cost_price ?? 0);
    const pct = s.partner_pct ?? 0;
    return a + gain * pct / 100;
  }, 0);

  const thisMonthAdSpend = useMemo(() => {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear());
    return adSpend.filter(a => a.date.startsWith(`${y}-${m}`));
  }, [adSpend, now]);

  const totalAdSpend = thisMonthAdSpend.reduce((a, s) => a + s.amount, 0);

  // -- NUEVA LOGICA DE DEUDA GLOBAL (Desde Agosto 2026) --
  const { globalAdSpend, globalGrossProfit, globalAdDebt, globalRealProfit, partnerNet, myProfit, daysRemaining } = useMemo(() => {
    const newSales = sales.filter(s => new Date(s.created_at) >= CUTOFF_DATE);
    const newAdSpends = adSpend.filter(a => new Date(a.date) >= CUTOFF_DATE);
    
    const globalAdSpend = newAdSpends.reduce((a, b) => a + b.amount, 0);
    const globalGrossProfit = newSales.reduce((a, s) => a + (s.price_sold - (s.cost_price ?? 0)), 0);
    
    const balance = globalGrossProfit - globalAdSpend;
    
    let daysRemaining = 0;
    const n = new Date();
    newAdSpends.forEach(a => {
      const start = new Date(a.date);
      const end = new Date(start);
      end.setDate(end.getDate() + (a.duration_days || 1));
      if (end > n) {
        const remaining = Math.ceil((end.getTime() - n.getTime()) / (1000 * 3600 * 24));
        if (remaining > daysRemaining) daysRemaining = remaining;
      }
    });

    if (balance <= 0) {
      return { globalAdSpend, globalGrossProfit, globalAdDebt: Math.abs(balance), globalRealProfit: 0, partnerNet: 0, myProfit: 0, daysRemaining };
    } else {
      return { globalAdSpend, globalGrossProfit, globalAdDebt: 0, globalRealProfit: balance, partnerNet: balance * 0.15, myProfit: balance * 0.85, daysRemaining };
    }
  }, [sales, adSpend]);

  const adProgress = globalAdSpend > 0 ? Math.round((globalGrossProfit / globalAdSpend) * 100) : 0;

  // -- AGRUPAR POR DÍAS (Calendario / Historial Diario) --
  const dailyStats = useMemo(() => {
    const map = new Map<string, { dateStr: string; rev: number; cost: number; ad: number; sales: Sale[]; partnerProfit: number }>();
    
    // Add sales to map
    thisMonth.forEach(s => {
      const d = new Date(s.created_at).toISOString().slice(0, 10); // YYYY-MM-DD
      if (!map.has(d)) map.set(d, { dateStr: d, rev: 0, cost: 0, ad: 0, sales: [], partnerProfit: 0 });
      const stat = map.get(d)!;
      stat.rev += s.price_sold;
      stat.cost += (s.cost_price ?? 0);
      stat.sales.push(s);

      const gain = s.price_sold - (s.cost_price ?? 0);
      const pct = s.partner_pct ?? 0;
      stat.partnerProfit += gain * pct / 100;
    });

    // Add ad spend to map
    thisMonthAdSpend.forEach(a => {
      const d = a.date; // already YYYY-MM-DD
      if (!map.has(d)) map.set(d, { dateStr: d, rev: 0, cost: 0, ad: 0, sales: [], partnerProfit: 0 });
      const stat = map.get(d)!;
      stat.ad += a.amount;
    });

    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [thisMonth, thisMonthAdSpend]);

  const [selectedDay, setSelectedDay] = useState<typeof dailyStats[0] | null>(null);

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
    const duration = Number(adForm.duration_days) || 1;
    if (!adForm.platform || amount <= 0) { showNotice("error", "Falta plataforma o monto."); return; }
    setLoading(true);
    const { error } = await supabase.from("ad_spend").insert({
      platform: adForm.platform, amount, description: adForm.description.trim() || null, date: adForm.date, duration_days: duration,
    });
    setLoading(false);
    if (error) { showNotice("error", "No se pudo guardar."); return; }
    showNotice("success", "Gasto de publicidad registrado.");
    setAdForm({ platform: AD_PLATFORMS[0], amount: "", description: "", date: new Date().toISOString().slice(0, 10), duration_days: "7" });
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
      `- Ingresos totales (CLP): $${totalRevenue}`,
      `- Costos totales (CLP): $${totalCost}`,
      `- Ganancia bruta (CLP): $${grossProfit}`,
      `- Gasto en publicidad (CLP): $${totalAdSpend}`,
      `- Ganancia neta final (CLP): $${grossProfit - totalAdSpend}`,
      `- Parte de ${partnerName} (Neto tras publicidad): $${partnerNet}`,
      `- Tu parte (Neto): $${myProfit}`,
      ``,
      `## Catálogo de Productos y Precios Actuales`,
      `### Juegos`,
      ...games.map(g => `- ${g.title}: $${g.price}`),
      `### Packs`,
      ...packs.map(p => `- ${p.title}: $${p.price}`),
      ``,
      `## Top 10 Artículos Más Vendidos (Mes Actual)`,
      ...topSelling.map(([title, count], i) => `${i + 1}. ${title} (${count} ventas)`),
      ``,
      `## Desglose Diario Detallado (Mes Actual)`,
      ...dailyStats.map(d => {
         const dGross = d.rev - d.cost;
         const dMyNet = dGross - d.partnerProfit;
         return [
           `### ${d.dateStr} (Total del Día: Ingresos $${d.rev}, Costos $${d.cost}, Publicidad Pagada Hoy $${d.ad})`,
           `- Ganancia Bruta del Día: $${dGross} | Parte ${partnerName} (de las ventas): $${d.partnerProfit} | Tu Parte: $${dMyNet}`,
           `**Detalle de Ventas del Día:**`,
           ...(d.sales.length > 0 ? d.sales.map(s => {
              const gain = s.price_sold - (s.cost_price ?? 0);
              const pct = s.partner_pct ?? 0;
              const pGain = gain * pct / 100;
              const mGain = gain - pGain;
              const isPack = s.item_type === "pack" || s.item_title.toLowerCase().includes("pack");
              return `- [${isPack ? "PACK" : "GAME"}] ${s.item_title} | Venta: $${s.price_sold} | Costo: $${s.cost_price ?? 0} | G. Bruta: $${gain} | ${partnerName} (${pct}%): $${pGain} | Tú: $${mGain}`;
           }) : ["- Sin ventas este día (solo registro de publicidad)."]),
           ""
         ].join("\\n");
      }),
      ``,
      `## Detalle de Gastos en Publicidad (Mes Actual)`,
      ...(thisMonthAdSpend.length > 0 
          ? thisMonthAdSpend.map(ad => `- ${ad.platform}: $${ad.amount} (${ad.description || "Sin descripción"})`)
          : ["- No hay gastos de publicidad registrados este mes."]),
      ``,
      `## INSTRUCCIONES PARA LA IA`,
      `Actúa como un analista financiero experto y consultor de negocios para esta tienda de videojuegos digitales.`,
      `Revisa cuidadosamente el informe detallado arriba y provee el siguiente análisis:`,
      `1. **Rentabilidad y Márgenes**: Analiza los márgenes de ganancia basándote en las ventas reales (ingreso vs costo). Identifica cuáles productos dejan más ganancia real.`,
      `2. **Tendencias Diarias**: Observa el desglose diario para identificar patrones de venta.`,
      `3. **Eficiencia Publicitaria**: Evalúa la eficiencia del gasto publicitario total frente a las ganancias netas generadas en el mes.`,
      `4. **Equidad del Socio**: Ten en cuenta que el socio (${partnerName}) recibe un porcentaje de ganancia solo sobre ciertas ventas (como verás en el detalle diario), pero él es quien paga el 100% de los gastos de publicidad (como se ve en el total global). Revisa si la ganancia neta final de ${partnerName} ($${partnerNet}) luego de descontar la publicidad justifica su inversión, o si hay desbalances respecto a tu ganancia ($${myProfit}).`,
      `5. **Recomendaciones de Alto Valor**: Provee entre 3 y 5 recomendaciones accionables y estratégicas para optimizar la rentabilidad general de la empresa.`
    ];

    const blob = new Blob([lines.join("\\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas_avanzadas_${new Date().toISOString().slice(0, 10)}.txt`;
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

  // Escuchar evento del botón de IA en la pastilla flotante
  useEffect(() => {
    const handler = () => generateAIReport();
    document.addEventListener('generate-ai-report', handler);
    return () => document.removeEventListener('generate-ai-report', handler);
  });

  const TAB_LABELS: Record<Tab, string> = { resumen: "Resumen", publicidad: "Publicidad", historial: "Historial" };

  return (
    <div className="flex h-full flex-col overflow-hidden pt-4 md:pt-0">
      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-4 pt-4 pb-3 flex items-center justify-between">
        {/* Título clickeable con dropdown */}
        <div className="relative">
          <button 
            onClick={() => setTabMenuOpen(v => !v)}
            className="flex items-center gap-2 text-lg font-black uppercase tracking-widest text-emerald-400 transition-colors hover:text-emerald-300 active:scale-95"
          >
            {TAB_LABELS[tab]}
            <ChevronDown size={18} className={`transition-transform duration-200 ${tabMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {tabMenuOpen && (
            <>
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <div 
                className="fixed inset-0 z-30" 
                onPointerUp={(e) => {
                  try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
                  setTabMenuOpen(false);
                }}
              />
              <div className="absolute left-0 top-full mt-2 z-40 min-w-[180px] rounded-2xl border border-white/10 bg-[#151212] p-1.5 shadow-2xl backdrop-blur-xl">
                {(["resumen", "publicidad", "historial"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setTabMenuOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
                      tab === t ? "bg-emerald-500/15 text-emerald-400" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {tab === "resumen" && (
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          {/* Dashboard Balance Card */}
          <div className="mx-4 mt-6 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 p-6 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)] relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
            
            <MoneyJar amount={globalGrossProfit} />
            
            <span className="relative z-10 mb-2 flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
              <DollarSign size={12} /> Ganancia Bruta (Total)
            </span>
            <h2 className="relative z-10 text-5xl md:text-6xl font-black text-white tracking-tight">${fmt(Math.round(globalGrossProfit))}</h2>
            
            {globalAdSpend > 0 && (
              <div className="relative z-10 mt-5 w-full">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-100 mb-2">
                  <span>Recuperación de Publicidad</span>
                  <span className="text-emerald-400">{adProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-1000" style={{ width: `${Math.min(adProgress, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-white/50 mt-2">
                  <span>Gasto: ${fmt(globalAdSpend)}</span>
                  {daysRemaining > 0 && <span className="text-blue-300">Faltan {daysRemaining} días</span>}
                </div>
              </div>
            )}
            
            <div className="relative z-10 mt-6 flex w-full justify-between border-t border-emerald-500/20 pt-4 px-2">
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1">Ganancia Bastian (85%)</span>
                 <span className="text-xl font-black text-emerald-100">${fmt(Math.round(myProfit))}</span>
              </div>
              <div className="flex flex-col text-right">
                 <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1">Pago a {partnerName} (15%)</span>
                 <span className="text-xl font-black text-emerald-100">${fmt(Math.round(partnerNet))}</span>
              </div>
            </div>
          </div>

          {/* Secondary Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <Receipt size={16} className="mb-2 text-blue-400" />
               <span className="text-2xl font-black text-white">{thisMonth.length}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Ventas este mes</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><Receipt size={40} /></div>
             </div>
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <TrendingUp size={16} className="mb-2 text-green-400" />
               <span className="text-2xl font-black text-green-400">${fmt(totalRevenue)}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Ingresos</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={40} /></div>
             </div>
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <Banknote size={16} className="mb-2 text-orange-400" />
               <span className="text-2xl font-black text-orange-400">${fmt(totalCost)}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Costo Total</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><Banknote size={40} /></div>
             </div>
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <TrendingDown size={16} className={`mb-2 ${grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`} />
               <span className={`text-2xl font-black ${grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>${fmt(grossProfit)}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Ganancia Bruta</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingDown size={40} /></div>
             </div>
          </div>

          <div className="px-4 pb-2 md:hidden">
            <button 
              onClick={generateAIReport}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-4 py-4 text-xs font-black uppercase tracking-widest text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
            >
              <Bot size={18} />
              Generar Reporte IA Avanzado
            </button>
          </div>

          <div className="px-4 pb-2 mt-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
              <CalendarDays size={16} className="text-emerald-400" />
              Calendario de Ganancias (Día a Día)
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 mb-4">Resumen de ingresos, costos y publicidad de cada día con actividad en el mes. Haz clic en un día para ver el detalle de cada venta.</p>
            
            {dailyStats.length === 0 ? (
              <div className="brand-shell rounded-2xl p-8 text-center">
                <p className="text-sm font-bold text-gray-600">No hay actividad registrada este mes aún.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {dailyStats.map((d, i) => {
                  const dGross = d.rev - d.cost;
                  const dNet = dGross; // Para el día a día no descontamos publicidad del neto para no alterar percepción
                  const dPartnerProfit = d.partnerProfit;
                  const dMyNet = dGross - d.partnerProfit;
                  
                  // Darle un poco de estilo si fue un día muy bueno
                  const isGreatDay = dNet > 15000;
                  const isLoss = dNet < 0;

                  return (
                    <div key={d.dateStr} 
                      onClick={() => setSelectedDay(d)}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all hover:scale-[1.02] active:scale-95 ${isGreatDay ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:border-emerald-500/40' : isLoss ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' : 'brand-shell border-white/5 hover:border-white/20'}`}>
                      <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
                        <p className="font-black tracking-widest text-white">{fmtDate(d.dateStr)}</p>
                        <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded-full text-gray-300">
                          {d.sales.length} {d.sales.length === 1 ? 'venta' : 'ventas'}
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
                        <div className="pt-2 mt-2 border-t border-white/5 flex justify-between">
                          <span className="text-gray-400">Tú ganas</span>
                          <span className="font-semibold text-emerald-400">${fmt(dMyNet)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Paga {partnerName} (Ventas)</span>
                          <span className="font-semibold text-pink-400">${fmt(dPartnerProfit)}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">G. Bruta del Día</span>
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
                  <label className={LABEL}>Fecha de inicio</label>
                  <input type="date" value={adForm.date} onChange={e => setAdForm({ ...adForm, date: e.target.value })} className={INPUT + " focus:border-orange-500"} />
                </div>
                <div>
                  <label className={LABEL}>Duración (días)</label>
                  <input type="number" min="1" value={adForm.duration_days} onChange={e => setAdForm({ ...adForm, duration_days: e.target.value })} className={INPUT + " focus:border-orange-500"} placeholder="Ej: 7" />
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
                  {adSpend.map(spend => {
                    const startDate = new Date(spend.date);
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + (spend.duration_days || 1));
                    
                    const campaignSales = sales.filter(s => {
                      const sDate = new Date(s.created_at);
                      return sDate >= startDate && sDate <= endDate;
                    });
                    const campaignProfit = campaignSales.reduce((a, s) => a + (s.price_sold - (s.cost_price ?? 0)), 0);
                    const progress = Math.min(100, Math.round((campaignProfit / spend.amount) * 100));
                    const remaining = spend.amount - campaignProfit;
                    const isNegative = remaining > 0;

                    return (
                      <div key={spend.id} className="brand-shell flex flex-col gap-2 rounded-2xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{spend.platform} <span className="text-xs text-gray-500 font-normal">({spend.duration_days || 1} días)</span></p>
                            <p className="mt-0.5 text-[10px] text-gray-600">{fmtDate(spend.date)}</p>
                          </div>
                          <p className="shrink-0 text-sm font-black text-orange-400">${fmt(spend.amount)}</p>
                          <button onClick={() => deleteAdSpend(spend.id)} disabled={loading}
                            className="shrink-0 rounded p-1 ml-2 text-gray-700 hover:text-red-400 transition-colors disabled:opacity-40">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <div className="w-full bg-white/10 rounded-full h-1.5 flex overflow-hidden">
                            <div className="bg-emerald-400 h-full" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <p className="text-[10px] text-gray-500">Recuperado: ${fmt(campaignProfit)}</p>
                            <p className={`text-[10px] font-bold ${isNegative ? "text-red-400" : "text-emerald-400"}`}>
                              {progress}% {isNegative ? `(-$${fmt(remaining)})` : "(Superada)"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="brand-shell hidden overflow-hidden rounded-2xl sm:block">
                  <div className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] gap-x-4 border-b border-white/5 px-4 py-2.5">
                    {["Plataforma", "Monto", "Fecha", "Descripción", ""].map(h => (
                      <p key={h} className="text-[9px] font-black uppercase tracking-widest text-gray-600">{h}</p>
                    ))}
                  </div>
                  <div className="divide-y divide-white/5">
                    {adSpend.map(spend => {
                      const startDate = new Date(spend.date);
                      const endDate = new Date(startDate);
                      endDate.setDate(endDate.getDate() + (spend.duration_days || 1));
                      
                      // Calculate specific campaign recovery
                      const campaignSales = sales.filter(s => {
                        const sDate = new Date(s.created_at);
                        return sDate >= startDate && sDate <= endDate;
                      });
                      const campaignProfit = campaignSales.reduce((a, s) => a + (s.price_sold - (s.cost_price ?? 0)), 0);
                      const progress = Math.min(100, Math.round((campaignProfit / spend.amount) * 100));
                      const remaining = spend.amount - campaignProfit;
                      const isNegative = remaining > 0;

                      return (
                        <div key={spend.id} className="grid grid-cols-[1fr_1fr_1fr_2fr_auto] items-center gap-x-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                          <div className="flex flex-col">
                            <p className="text-sm font-bold">{spend.platform}</p>
                            <p className="text-[10px] text-gray-500">{spend.duration_days || 1} días</p>
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-black text-orange-400">${fmt(spend.amount)}</p>
                            <div className="mt-1 w-full bg-white/10 rounded-full h-1.5 flex overflow-hidden">
                              <div className="bg-emerald-400 h-full" style={{ width: `${progress}%` }} />
                            </div>
                            <p className={`text-[10px] mt-0.5 font-bold ${isNegative ? "text-red-400" : "text-emerald-400"}`}>
                              {progress}% {isNegative ? `(-$${fmt(remaining)})` : "(Superada)"}
                            </p>
                          </div>
                          <p className="text-[11px] text-gray-400">{fmtDate(spend.date)}</p>
                          <p className="truncate text-[11px] text-gray-500">{spend.description || "—"}</p>
                          <button onClick={() => deleteAdSpend(spend.id)} disabled={loading}
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

      {/* DETALLE DEL DIA (MODAL) */}
      {selectedDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
             onClick={() => setSelectedDay(null)}>
          <div className="brand-shell relative w-full max-w-2xl overflow-hidden rounded-3xl max-h-[90vh] flex flex-col" 
               onClick={e => e.stopPropagation()}>
            <div className="border-b border-white/10 px-6 py-5 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-lg font-black tracking-widest text-emerald-400 uppercase">Detalle del Día</h3>
                <p className="text-sm text-gray-300 font-bold">{fmtDate(selectedDay.dateStr)}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} className="text-gray-400 hover:text-white" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Resumen del dia en modal */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Ingresos</p>
                  <p className="text-xl font-black text-green-400">${fmt(selectedDay.rev)}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Tu Parte (Neta)</p>
                  <p className="text-xl font-black text-emerald-400">${fmt(selectedDay.rev - selectedDay.cost - selectedDay.partnerProfit)}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Parte {partnerName} (Ventas)</p>
                  <p className="text-xl font-black text-pink-400">${fmt(selectedDay.partnerProfit)}</p>
                </div>
              </div>

              <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                <Receipt size={14} className="text-emerald-400" /> Ventas de la jornada ({selectedDay.sales.length})
              </h4>

              {selectedDay.sales.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No hay ventas registradas este día (solo publicidad).</p>
              ) : (
                <div className="space-y-3">
                  {selectedDay.sales.map(s => {
                    const gain = s.price_sold - (s.cost_price ?? 0);
                    const pct = s.partner_pct ?? 0;
                    const pGain = gain * pct / 100;
                    const mGain = gain - pGain;
                    
                    return (
                      <div key={s.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-colors hover:bg-white/[0.05]">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className={`mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${s.item_type === "pack" ? "text-purple-400" : "text-blue-400"}`}>
                              {s.item_type === "pack" ? <Gift size={10} /> : <Gamepad2 size={10} />}
                              {s.item_type === "pack" ? "Pack" : "Juego"}
                            </div>
                            <p className="text-sm font-bold text-white">{s.item_title}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{fmtTime(s.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Venta</p>
                            <p className="text-lg font-black text-green-400">${fmt(s.price_sold)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/5">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Costo</p>
                            <p className="text-xs font-bold text-orange-400">${fmt(s.cost_price ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">G. Bruta</p>
                            <p className="text-xs font-bold text-gray-300">${fmt(gain)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Tú Ganas</p>
                            <p className="text-xs font-black text-emerald-400">${fmt(mGain)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">{partnerName} ({pct}%)</p>
                            <p className="text-xs font-black text-pink-400">${fmt(pGain)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "historial" && (
        <Ventas sales={sales} providers={providers} settings={settings}
          salesTableExists={salesTableExists}
          salesError={salesError}
          loading={loading} setLoading={setLoading}
          showNotice={showNotice} onReload={onReload} />
      )}
    </div>
  );
}
