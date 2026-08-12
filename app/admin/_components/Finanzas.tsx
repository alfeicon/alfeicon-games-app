"use client";

import { FormEvent, useMemo, useState, useEffect, useId } from "react";
import {
  Banknote, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, DollarSign, Gamepad2, Gift, Handshake, Loader2, Megaphone, Plus, Receipt, RefreshCw, Trash2, TrendingDown, TrendingUp, Bot, X
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { saleNetProfit, saleNetRevenue, salePaymentFee } from "@/lib/sales-finance";
import type { AdSpend, AdminGame, AdminPack, Provider, Sale, SettingsState } from "../_types";
import { fmt, fmtDate, fmtTime, formatPriceInput, inicioCampana, ventaDentroDeCampana } from "../_helpers";
import { Ventas } from "./Ventas";

const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "premium-control w-full rounded-xl px-3 py-2.5 text-sm outline-none";

const AD_PLATFORMS = ["Instagram", "Facebook", "TikTok", "Google", "Twitter / X", "Otro"];

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};
const finCampana = (campaign: AdSpend) => {
  const end = new Date(inicioCampana(campaign));
  end.setDate(end.getDate() + Math.max(1, Number(campaign.duration_days) || 1));
  return end;
};
const campanaCerrada = (campaign: AdSpend, nowMs = Date.now()) => finCampana(campaign).getTime() <= nowMs;

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
const MoneyJar = ({ amount, goal }: { amount: number; goal: number }) => {
  const [fill, setFill] = useState(0);
  const svgId = useId().replace(/:/g, "");
  const targetFill = Math.min(100, Math.max(0, (amount / goal) * 100));
  const bills = Array.from({ length: 15 }, (_, index) => ({
    x: [17, 29, 41][index % 3],
    y: 103 - Math.floor(index / 3) * 12,
    rotation: [-8, 4, -4, 6, -6][index % 5],
  }));
  const visibleBills = fill > 0 ? Math.max(1, Math.ceil((fill / 100) * bills.length)) : 0;

  useEffect(() => {
    const timer = setTimeout(() => setFill(targetFill), 400);
    return () => clearTimeout(timer);
  }, [targetFill]);

  return (
    <div className="relative mb-2 flex items-center justify-center drop-shadow-[0_0_20px_rgba(52,211,153,0.3)] z-10">
      <svg viewBox="0 0 100 120" className="w-20 h-24 md:w-28 md:h-32" aria-label={`Progreso de ganancia: ${Math.round(targetFill)}% de la meta`} role="img">
        <defs>
          <clipPath id={`${svgId}-jarClip`}>
            <path d="M 30 15 L 30 25 C 15 30 15 45 15 60 L 15 105 C 15 115 25 115 50 115 C 75 115 85 115 85 105 L 85 60 C 85 45 85 30 70 25 L 70 15 Z" />
          </clipPath>
          <linearGradient id={`${svgId}-moneyGrad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {/* Fondo */}
        <path d="M 30 15 L 30 25 C 15 30 15 45 15 60 L 15 105 C 15 115 25 115 50 115 C 75 115 85 115 85 105 L 85 60 C 85 45 85 30 70 25 L 70 15 Z" fill="rgba(255,255,255,0.02)" />
        {/* Billetes acumulados: el porcentaje decide cuántos entran al frasco. */}
        <g clipPath={`url(#${svgId}-jarClip)`}>
          <rect x="0" y="20" width="100" height="100" fill="rgba(16,185,129,0.06)" />
          {bills.slice(0, visibleBills).map((bill, index) => (
            <g
              key={`${Math.round(fill)}-${index}`}
              className="money-bill"
              style={{ animationDelay: `${index * 85}ms` }}
              transform={`rotate(${bill.rotation} ${bill.x + 21} ${bill.y + 6.5})`}
            >
              <rect x={bill.x} y={bill.y} width="42" height="13" rx="2" fill="#43c58e" stroke="#063b2a" strokeWidth="1.2" />
              <rect x={bill.x + 2} y={bill.y + 2} width="38" height="9" rx="1.2" fill="none" stroke="#b8f5d7" strokeWidth="0.7" opacity="0.9" />
              <circle cx={bill.x + 21} cy={bill.y + 6.5} r="4.2" fill="#8be8b9" stroke="#0b5b40" strokeWidth="0.8" />
              <text x={bill.x + 21} y={bill.y + 8.5} textAnchor="middle" fill="#063b2a" fontSize="6.5" fontWeight="900">$</text>
              <path d={`M ${bill.x + 5} ${bill.y + 5} H ${bill.x + 12} M ${bill.x + 30} ${bill.y + 5} H ${bill.x + 37}`} stroke="#d1fae5" strokeWidth="0.8" strokeLinecap="round" opacity="0.9" />
              <path d={`M ${bill.x + 5} ${bill.y + 8.5} H ${bill.x + 12} M ${bill.x + 30} ${bill.y + 8.5} H ${bill.x + 37}`} stroke="#0b5b40" strokeWidth="0.6" strokeLinecap="round" opacity="0.8" />
            </g>
          ))}
        </g>
        {/* Borde */}
        <path d="M 30 15 L 30 25 C 15 30 15 45 15 60 L 15 105 C 15 115 25 115 50 115 C 75 115 85 115 85 105 L 85 60 C 85 45 85 30 70 25 L 70 15 Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
        {/* Tapa */}
        <rect x="25" y="5" width="50" height="12" rx="4" fill="rgba(255,255,255,0.9)" />
        <rect x="22" y="10" width="56" height="4" rx="2" fill="rgba(0,0,0,0.1)" />
        {/* Reflejo */}
        <path d="M 25 45 C 25 70 25 90 30 100" stroke="rgba(255,255,255,0.25)" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
};

type Tab = "resumen" | "publicidad" | "historial";

export function Finanzas({ sales, adSpend, games, packs, providers, settings, salesTableExists, salesError, loading, setLoading, showNotice, onReload }: Props) {
  const partnerName = settings.partnerName || "Socio";
  const [tab, setTab] = useState<Tab>("resumen");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showAddAd, setShowAddAd] = useState(false);
  const [adForm, setAdForm] = useState({ platform: AD_PLATFORMS[0], amount: "", description: "", date: localDate(), time: localTime(), duration_days: "7" });

  const handleAdAmountChange = (value: string) => {
    setAdForm(previous => ({ ...previous, amount: formatPriceInput(value) }));
  };

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

  const totalRevenue = thisMonth.reduce((a, s) => a + saleNetRevenue(s), 0);
  const totalPaymentFees = thisMonth.reduce((a, s) => a + salePaymentFee(s), 0);
  const totalCost = thisMonth.reduce((a, s) => a + (s.cost_price ?? 0), 0);
  const grossProfit = totalRevenue - totalCost;

  const thisMonthAdSpend = useMemo(() => {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear());
    return adSpend.filter(a => a.date.startsWith(`${y}-${m}`));
  }, [adSpend, now]);

  const totalAdSpend = thisMonthAdSpend.reduce((a, s) => a + s.amount, 0);
  const profitGoal = Math.max(1, Number(String(settings.profitGoal || "").replace(/[^0-9]/g, "")) || 1000000);

  const activeCampaign = useMemo(() => {
    const nowMs = Date.now();
    return [...adSpend]
      .filter(campaign => {
        const start = inicioCampana(campaign);
        return nowMs >= start.getTime() && nowMs < finCampana(campaign).getTime();
      })
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  }, [adSpend]);

  // -- NUEVA LOGICA DE DEUDA GLOBAL (Desde Agosto 2026) --
  const { globalAdSpend, campaignAdSpend, globalGrossProfit, campaignGrossProfit, globalAdDebt, globalRealProfit, campaignRealProfit, partnerNet, myProfit, daysRemaining } = useMemo(() => {
    const newSales = sales.filter(s => new Date(s.created_at) >= CUTOFF_DATE);
    const newAdSpends = adSpend.filter(a => new Date(a.date) >= CUTOFF_DATE);
    
    const globalAdSpend = newAdSpends.reduce((a, b) => a + b.amount, 0);
    const globalGrossProfit = newSales.reduce((a, s) => a + saleNetProfit(s), 0);
    
    const campaignGrossProfit = newSales
      .filter(s => activeCampaign && ventaDentroDeCampana(s.created_at, [activeCampaign]))
      .reduce((a, s) => a + saleNetProfit(s), 0);
    const campaignAdSpend = activeCampaign?.amount || 0;
    const campaignBalance = campaignGrossProfit - campaignAdSpend;
    const nowMs = Date.now();
    const campaignForSale = (sale: Sale) => newAdSpends.find(campaign => ventaDentroDeCampana(sale.created_at, [campaign]));
    const outsideCampaignProfit = newSales
      .filter(sale => !campaignForSale(sale))
      .reduce((sum, sale) => sum + saleNetProfit(sale), 0);
    const settledCampaignProfit = newAdSpends
      .filter(campaign => campanaCerrada(campaign, nowMs))
      .reduce((sum, campaign) => {
        const profit = newSales
          .filter(sale => ventaDentroDeCampana(sale.created_at, [campaign]))
          .reduce((campaignSum, sale) => campaignSum + saleNetProfit(sale), 0);
        return sum + Math.max(0, profit - campaign.amount);
      }, 0);
    
    let daysRemaining = 0;
    const n = new Date();
    if (activeCampaign) {
      const a = activeCampaign;
      const start = inicioCampana(a);
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(1, Number(a.duration_days) || 1));
      if (end > n) {
        const remaining = Math.ceil((end.getTime() - n.getTime()) / (1000 * 3600 * 24));
        if (remaining > daysRemaining) daysRemaining = remaining;
      }
    }

    return {
      globalAdSpend,
      campaignAdSpend,
      globalGrossProfit,
      campaignGrossProfit,
      globalAdDebt: Math.max(0, -campaignBalance),
      // Las utilidades de una campaña se liberan recién cuando termina.
      globalRealProfit: outsideCampaignProfit + settledCampaignProfit,
      campaignRealProfit: activeCampaign ? 0 : settledCampaignProfit,
      partnerNet: settledCampaignProfit * 0.15,
      myProfit: outsideCampaignProfit + settledCampaignProfit * 0.85,
      daysRemaining,
    };
  }, [sales, adSpend, activeCampaign]);

  const adProgress = campaignAdSpend > 0 ? Math.round((campaignGrossProfit / campaignAdSpend) * 100) : 0;
  const campaignRemaining = Math.max(0, campaignAdSpend - campaignGrossProfit);
  const campaignOverTarget = Math.max(0, campaignGrossProfit - campaignAdSpend);
  const primaryProfit = activeCampaign ? campaignGrossProfit : globalGrossProfit;
  const primaryMyProfit = activeCampaign ? campaignRealProfit * 0.85 : myProfit;

  // -- AGRUPAR POR DÍAS (Calendario / Historial Diario) --
  const dailyStats = useMemo(() => {
    const map = new Map<string, { dateStr: string; rev: number; grossRev: number; fee: number; cost: number; ad: number; sales: Sale[]; pendingCampaign: boolean }>();
    const month = calendarMonth.getMonth();
    const year = calendarMonth.getFullYear();
    
    // Add sales to map
    sales
      .filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .forEach(s => {
      const d = dateKey(new Date(s.created_at));
      if (!map.has(d)) map.set(d, { dateStr: d, rev: 0, grossRev: 0, fee: 0, cost: 0, ad: 0, sales: [], pendingCampaign: false });
      const stat = map.get(d)!;
      stat.rev += saleNetRevenue(s);
      stat.grossRev += s.price_sold;
      stat.fee += salePaymentFee(s);
      stat.cost += (s.cost_price ?? 0);
      stat.sales.push(s);

      const campaign = adSpend.find(item => ventaDentroDeCampana(s.created_at, [item]));
      stat.pendingCampaign ||= !!campaign && !campanaCerrada(campaign);
    });

    // Add ad spend to map
    adSpend
      .filter(a => {
        const d = new Date(`${a.date}T00:00:00`);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .forEach(a => {
      const d = a.date; // already YYYY-MM-DD
      if (!map.has(d)) map.set(d, { dateStr: d, rev: 0, grossRev: 0, fee: 0, cost: 0, ad: 0, sales: [], pendingCampaign: false });
      const stat = map.get(d)!;
      stat.ad += a.amount;
    });

    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [sales, adSpend, calendarMonth]);

  const dailyStatsByDate = useMemo(
    () => new Map(dailyStats.map(day => [day.dateStr, day])),
    [dailyStats],
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (first.getDay() + 6) % 7;
    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
  }, [calendarMonth]);

  const calendarLabel = calendarMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  const selectedMonthSales = dailyStats.reduce((sum, d) => sum + d.sales.length, 0);

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
    const startAt = new Date(`${adForm.date}T${adForm.time || "00:00"}:00`).toISOString();
    const payload = { platform: adForm.platform, amount, description: adForm.description.trim() || null, date: adForm.date, start_at: startAt, duration_days: duration };
    let { error } = await supabase.from("ad_spend").insert(payload);
    if (error?.code === "42703") {
      const fallback = await supabase.from("ad_spend").insert({ ...payload, start_at: undefined });
      error = fallback.error;
    }
    setLoading(false);
    if (error) { showNotice("error", "No se pudo guardar."); return; }
    showNotice("success", "Gasto de publicidad registrado.");
    setAdForm({ platform: AD_PLATFORMS[0], amount: "", description: "", date: localDate(), time: localTime(), duration_days: "7" });
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
      `- Ingresos recibidos totales (CLP): $${totalRevenue}`,
      `- Comisiones Mercado Pago (CLP): $${totalPaymentFees}`,
      `- Costos totales (CLP): $${totalCost}`,
      `- Ganancia real antes de publicidad (CLP): $${grossProfit}`,
      `- Gasto en publicidad (CLP): $${totalAdSpend}`,
      `- Ganancia neta final (CLP): $${grossProfit - totalAdSpend}`,
      `- Utilidad de campañas ya cerradas (CLP): $${globalRealProfit}`,
      `- Parte de ${partnerName} (solo campañas cerradas): $${partnerNet}`,
      `- Tu parte (solo utilidades ya liberadas): $${myProfit}`,
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
         const dMargin = d.rev - d.cost;
         return [
           `### ${d.dateStr} (Total del Día: Cobrado $${d.grossRev}, Comisión MP $${d.fee}, Recibido $${d.rev}, Costos $${d.cost}, Publicidad Pagada Hoy $${d.ad})`,
           `- Margen de las ventas: $${dMargin}${d.pendingCampaign ? " | Campaña en curso: la utilidad se liquida al cierre." : ""}`,
           `**Detalle de Ventas del Día:**`,
           ...(d.sales.length > 0 ? d.sales.map(s => {
              const fee = salePaymentFee(s);
              const net = saleNetRevenue(s);
              const gain = saleNetProfit(s);
              const isPack = s.item_type === "pack" || s.item_title.toLowerCase().includes("pack");
              return `- [${isPack ? "PACK" : "GAME"}] ${s.item_title} | Cobrado: $${s.price_sold} | Comisión MP: $${fee} | Recibido: $${net} | Costo: $${s.cost_price ?? 0} | Margen: $${gain}`;
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
      `4. **Equidad del Socio**: Las utilidades de una campaña se calculan y reparten únicamente al completar su duración. Evalúa la inversión publicitaria y las utilidades ya liberadas de ${partnerName} ($${partnerNet}) frente a tu parte ($${myProfit}).`,
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

            <MoneyJar amount={primaryProfit} goal={profitGoal} />

            <span className="relative z-10 mb-2 flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
              <DollarSign size={12} /> {activeCampaign ? "Ganancia bruta · campaña activa" : "Ganancia bruta acumulada"}
            </span>
            <h2 className="relative z-10 text-5xl md:text-6xl font-black text-white tracking-tight">${fmt(Math.round(primaryProfit))}</h2>
            <p className="relative z-10 mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">
              {activeCampaign ? `Recuperación: ${adProgress}% · ${daysRemaining} días restantes` : `Meta: $${fmt(profitGoal)} · ${Math.min(100, Math.round((primaryProfit / profitGoal) * 100))}%`}
            </p>
            
            {campaignAdSpend > 0 && (
              <div className="relative z-10 mt-5 w-full">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-100 mb-2">
                  <span>{activeCampaign ? "Campaña activa · recuperación" : "Sin campaña activa"}</span>
                  <span className="text-emerald-400">{adProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-1000" style={{ width: `${Math.min(adProgress, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-white/50 mt-2">
                  <span>Gasto campaña: ${fmt(campaignAdSpend)}</span>
                  {daysRemaining > 0 ? <span className="text-blue-300">Faltan {daysRemaining} días</span> : <span className="text-gray-500">Campaña finalizada</span>}
                </div>
                <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">
                  {campaignRemaining > 0 ? (
                    <span className="text-yellow-300">Falta recuperar: ${fmt(campaignRemaining)}</span>
                  ) : (
                    <span className="text-emerald-300">Sobre meta: ${fmt(campaignOverTarget)}</span>
                  )}
                </div>
              </div>
            )}
            
            <div className="relative z-10 mt-6 flex w-full justify-between border-t border-emerald-500/20 pt-4 px-2">
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1">{activeCampaign ? "Tu ganancia campaña" : "Tu ganancia total"}</span>
                 <span className="text-xl font-black text-emerald-100">${fmt(Math.round(primaryMyProfit))}</span>
              </div>
              <div className="flex flex-col text-right">
                 <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1">Pago a {partnerName} (15% campaña)</span>
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
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Ingresos recibidos</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={40} /></div>
             </div>
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <Banknote size={16} className="mb-2 text-orange-400" />
               <span className="text-2xl font-black text-orange-400">${fmt(totalCost)}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Costo Total</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><Banknote size={40} /></div>
             </div>
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <Receipt size={16} className="mb-2 text-sky-400" />
               <span className="text-2xl font-black text-sky-400">${fmt(totalPaymentFees)}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Comisión MP</span>
               <div className="absolute top-0 right-0 p-4 opacity-10"><Receipt size={40} /></div>
             </div>
             <div className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
               <TrendingDown size={16} className={`mb-2 ${grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`} />
               <span className={`text-2xl font-black ${grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>${fmt(grossProfit)}</span>
               <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Ganancia real del mes</span>
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
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                  <CalendarDays size={16} className="text-emerald-400" />
                  Calendario de Ganancias
                </h2>
                <p className="mt-1 text-[11px] text-gray-500">Los puntos rojos marcan ventas. Las campañas en curso se liquidan al terminar.</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-300">
                  <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.035] px-2 py-1"><span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" /> Venta registrada</span>
                  <span className="flex items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-400/[0.07] px-2 py-1 text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-400" /> Campaña en curso</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 self-start rounded-xl border border-slate-300/20 bg-[#20262d] p-1 shadow-sm lg:self-auto">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="min-w-[170px] text-center">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white capitalize">{calendarLabel}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-400">{selectedMonthSales} {selectedMonthSales === 1 ? "venta" : "ventas"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-400/35 bg-[#1a1f25] shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                <div className="grid grid-cols-7 border-b border-slate-300/25 bg-[#313943]">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(day => (
                    <div key={day} className="px-2 py-2.5 text-center text-[9px] font-black uppercase tracking-widest text-slate-300">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="min-h-[108px] border-b border-r border-slate-400/20 bg-[#171d23] last:border-r-0" aria-hidden />;
                    }
                    const key = dateKey(day);
                    const stats = dailyStatsByDate.get(key);
                    const dayMargin = stats ? stats.rev - stats.cost : 0;
                    const hasSales = (stats?.sales.length || 0) > 0;
                    const hasActivity = !!stats;
                    const isToday = key === localDate();
                    const pendingCampaign = !!stats?.pendingCampaign;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => stats && setSelectedDay(stats)}
                        disabled={!hasActivity}
                        className={`relative min-h-[108px] border-b border-r border-slate-400/20 p-2.5 text-left transition-colors last:border-r-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400/70 ${
                          hasSales ? "bg-[#25342e] hover:bg-[#2d4038] active:bg-[#354a41]" : hasActivity ? "bg-[#383225] hover:bg-[#483f2d] active:bg-[#544a34]" : "cursor-default bg-[#20262d] text-slate-500"
                        }`}
                        aria-label={stats ? `${fmtDate(key)}, ${stats.sales.length} ventas` : fmtDate(key)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black ${
                            isToday ? "bg-emerald-400 text-black shadow-[0_0_16px_rgba(52,211,153,0.45)]" : hasActivity ? "bg-white/15 text-white" : "text-slate-400"
                          }`}>
                            {day.getDate()}
                          </span>
                          {hasSales && (
                            <span className="mt-1 flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.65)]" />
                              <span className="hidden text-[9px] font-black text-red-300 sm:inline">{stats?.sales.length}</span>
                            </span>
                          )}
                        </div>
                        {stats && (
                          <div className="mt-3 space-y-1.5">
                            <p className={`truncate text-[11px] font-black ${pendingCampaign ? "text-amber-200" : dayMargin >= 0 ? "text-emerald-200" : "text-red-300"}`}>
                              {pendingCampaign ? `Cobrado $${fmt(Math.round(stats.rev))}` : `Margen $${fmt(Math.round(dayMargin))}`}
                            </p>
                            <p className="truncate text-[9px] font-bold text-slate-300">
                              {stats.sales.length} {stats.sales.length === 1 ? "venta" : "ventas"}
                            </p>
                            {pendingCampaign ? <p className="inline-flex rounded bg-amber-400/15 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-amber-200">EN CAMPANA</p> : stats.fee > 0 && <p className="truncate text-[9px] font-bold text-sky-300">MP -${fmt(stats.fee)}</p>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
            </div>
            {dailyStats.length === 0 && (
              <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-xs font-bold text-gray-600">
                No hay actividad registrada en este mes.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "publicidad" && (
        <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
          <div className="px-4 pt-4 pb-2">
            <button onClick={() => setShowAddAd(v => !v)}
              className={`magnetic flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all ${showAddAd ? "border-orange-400/40 bg-orange-500/10" : "border-orange-400/25 bg-orange-500/[0.06] hover:border-orange-400/50 hover:bg-orange-500/10"}`}>
              <span className="flex items-center gap-3 text-sm font-black">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white shadow-[0_0_18px_rgba(249,115,22,0.3)]">
                  {showAddAd ? <ChevronUp size={16} /> : <Plus size={16} />}
                </span>
                <span>
                  <span className="block">{showAddAd ? "Cerrar formulario" : "Agregar campaña"}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Registra inversión y duración</span>
                </span>
              </span>
              <ChevronDown size={16} className={`text-orange-300 transition-transform ${showAddAd ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showAddAd && (
            <form onSubmit={saveAd} className="mx-4 mb-5 brand-glass rounded-2xl border border-orange-400/15 p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3 border-b border-white/10 pb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                  <Megaphone size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Nueva campaña publicitaria</h3>
                  <p className="mt-1 text-[11px] text-gray-500">La inversión se usará para calcular la recuperación de esta campaña.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={LABEL}>Plataforma</label>
                  <select value={adForm.platform} onChange={e => setAdForm({ ...adForm, platform: e.target.value })} className={INPUT + " focus:border-orange-500"}>
                    {AD_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Monto invertido (CLP)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-black text-orange-300">$</span>
                    <input value={adForm.amount} onChange={e => handleAdAmountChange(e.target.value)} inputMode="numeric" className={INPUT + " pl-8 focus:border-orange-500"} placeholder="0" aria-label="Monto invertido en pesos chilenos" />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-600">Separación de miles automática: $23.877</p>
                </div>
                <div>
                  <label className={LABEL}>Fecha de inicio</label>
                  <input type="date" value={adForm.date} onChange={e => setAdForm({ ...adForm, date: e.target.value })} className={INPUT + " focus:border-orange-500"} />
                </div>
                <div>
                  <label className={LABEL}>Hora de inicio</label>
                  <input type="time" value={adForm.time} onChange={e => setAdForm({ ...adForm, time: e.target.value })} className={INPUT + " focus:border-orange-500"} />
                  <p className="mt-1 text-[10px] text-gray-600">La campaña vencerá a esta misma hora.</p>
                </div>
                <div>
                  <label className={LABEL}>Duración (días)</label>
                  <input type="number" min="1" value={adForm.duration_days} onChange={e => setAdForm({ ...adForm, duration_days: e.target.value })} className={INPUT + " focus:border-orange-500"} placeholder="Ej: 7" />
                </div>
              </div>
              <div>
                <label className={LABEL}>Descripción (opcional)</label>
                <input value={adForm.description} onChange={e => setAdForm({ ...adForm, description: e.target.value })} className={INPUT + " focus:border-orange-500"} placeholder="Ej: campaña Nintendo, promoción de packs…" />
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 pt-1 sm:flex-row">
                <button type="submit" disabled={loading}
                  className="magnetic flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_18px_rgba(249,115,22,0.2)] transition-colors hover:bg-orange-400 disabled:opacity-60">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {loading ? "Guardando…" : "Guardar campaña"}
                </button>
                <button type="button" onClick={() => setShowAddAd(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-white/5">
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
                    const campaignSales = sales.filter(s => ventaDentroDeCampana(s.created_at, [spend]));
                    const campaignProfit = campaignSales.reduce((a, s) => a + saleNetProfit(s), 0);
                    const progress = Math.min(100, Math.round((campaignProfit / spend.amount) * 100));
                    const remaining = spend.amount - campaignProfit;
                    const isNegative = remaining > 0;

                    return (
                      <div key={spend.id} className="brand-shell flex flex-col gap-2 rounded-2xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{spend.platform} <span className="text-xs text-gray-500 font-normal">({spend.duration_days || 1} días)</span></p>
                            <p className="mt-0.5 text-[10px] text-gray-600">{fmtDate(spend.date)} · {spend.start_at ? fmtTime(spend.start_at) : "00:00"}</p>
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
                      // Calculate specific campaign recovery
                      const campaignSales = sales.filter(s => ventaDentroDeCampana(s.created_at, [spend]));
                      const campaignProfit = campaignSales.reduce((a, s) => a + saleNetProfit(s), 0);
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
                          <p className="text-[11px] text-gray-400">{fmtDate(spend.date)} · {spend.start_at ? fmtTime(spend.start_at) : "00:00"}</p>
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Recibido</p>
                  <p className="text-xl font-black text-green-400">${fmt(selectedDay.rev)}</p>
                  {selectedDay.fee > 0 && (
                    <p className="mt-1 text-[10px] font-bold text-sky-400">MP -${fmt(selectedDay.fee)}</p>
                  )}
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Costo de productos</p>
                  <p className="text-xl font-black text-orange-400">${fmt(selectedDay.cost)}</p>
                </div>
              </div>
              <div className={`mb-6 rounded-xl border px-4 py-3 ${selectedDay.pendingCampaign ? "border-amber-400/20 bg-amber-400/[0.06]" : "border-emerald-400/15 bg-emerald-400/[0.05]"}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${selectedDay.pendingCampaign ? "text-amber-300" : "text-emerald-300"}`}>
                  {selectedDay.pendingCampaign ? "Campaña en curso" : "Margen de las ventas"}
                </p>
                <p className="mt-1 text-sm font-bold text-gray-200">
                  {selectedDay.pendingCampaign
                    ? "La ganancia y su reparto se generarán al completar la campaña."
                    : `Margen antes de publicidad: $${fmt(selectedDay.rev - selectedDay.cost)}`}
                </p>
              </div>

              <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                <Receipt size={14} className="text-emerald-400" /> Ventas de la jornada ({selectedDay.sales.length})
              </h4>

              {selectedDay.sales.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No hay ventas registradas este día (solo publicidad).</p>
              ) : (
                <div className="space-y-3">
                  {selectedDay.sales.map(s => {
                    const fee = salePaymentFee(s);
                    const netRevenue = saleNetRevenue(s);
                    const gain = saleNetProfit(s);
                    
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
                            {fee > 0 && <p className="text-[10px] font-bold text-sky-400">Recibido ${fmt(netRevenue)}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Com. MP</p>
                            <p className="text-xs font-bold text-sky-400">${fmt(fee)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Costo</p>
                            <p className="text-xs font-bold text-orange-400">${fmt(s.cost_price ?? 0)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Margen</p>
                            <p className="text-xs font-black text-emerald-400">${fmt(gain)}</p>
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
