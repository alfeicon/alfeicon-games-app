"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart2, CalendarDays, DollarSign, Eye, Megaphone, Gamepad2, Gift, Handshake, Percent, Plus, Receipt, TrendingUp, Wallet, Zap,
} from "lucide-react";
import type { AdminGame, AdminPack, AdminSection, AdSpend, Sale, SettingsState } from "../_types";
import { fmt, fmtDate } from "../_helpers";

type Props = {
  games: AdminGame[];
  packs: AdminPack[];
  sales: Sale[];
  adSpend: AdSpend[];
  /** Visitas de los últimos 30 días (tabla page_views). */
  views: { created_at: string; item_id: string | null; source: string | null }[];
  settings: SettingsState;
  salesTableExists: boolean | null;
  firstLoadDone?: boolean;
  onNavigate: (s: AdminSection) => void;
  onRegisterSale: () => void;
};

// Formato compacto para etiquetas de gráficos ($87k, $1.2M).
const compact = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
};

export function Inicio({ games, packs, sales, adSpend, views, settings, salesTableExists, firstLoadDone = true, onNavigate, onRegisterSale }: Props) {
  const now = new Date();
  const partnerName = settings.partnerName || "Socio";

  // Dispara las animaciones de "dibujado" de los gráficos tras el primer paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const thisMonth = useMemo(
    () =>
      sales.filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales],
  );

  const totalRevenue = thisMonth.reduce((a, s) => a + s.price_sold, 0);
  const totalCost = thisMonth.reduce((a, s) => a + (s.cost_price || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const partnerProfit = thisMonth.reduce((a, s) => {
    const gain = s.price_sold - (s.cost_price ?? 0);
    const pct = s.partner_pct ?? 0;
    return a + gain * pct / 100;
  }, 0);
  const myShare = totalProfit - partnerProfit;

  const totalAdSpend = useMemo(() => {
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear());
    return adSpend.filter(a => a.date.startsWith(`${y}-${m}`)).reduce((a, s) => a + s.amount, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adSpend]);
  // La publicidad la paga el socio, se descuenta de su parte del reparto.
  const partnerNet = partnerProfit - totalAdSpend;

  // ── Rendimiento de la publicidad (este mes) ────────────────────────────────
  // ROAS: cuántos pesos de venta trae cada peso invertido en anuncios. Bajo 1
  // significa que la publicidad cuesta más de lo que genera.
  const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null;
  const costPerSale = totalAdSpend > 0 && thisMonth.length > 0 ? Math.round(totalAdSpend / thisMonth.length) : null;
  // Cuánto de la ganancia se va en publicidad.
  const adShareOfProfit = totalProfit > 0 ? Math.round((totalAdSpend / totalProfit) * 100) : null;

  // ── Hoy y los últimos 7 días ───────────────────────────────────────────────
  // Se comparan las fechas en local (es-CL), no en UTC: con UTC, una venta de
  // las 22:00 en Chile caería en el día siguiente.
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const todayKey = dayKey(now);

  const todaySales = useMemo(
    () => sales.filter(s => dayKey(new Date(s.created_at)) === todayKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales, todayKey],
  );
  const todayRevenue = todaySales.reduce((a, s) => a + s.price_sold, 0);
  const todayProfit = todaySales.reduce((a, s) => a + s.price_sold - (s.cost_price || 0), 0);

  const last7 = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return {
        key: dayKey(d),
        label: d.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""),
        revenue: 0,
        profit: 0,
        count: 0,
      };
    });
    sales.forEach(s => {
      const b = buckets.find(x => x.key === dayKey(new Date(s.created_at)));
      if (b) {
        b.revenue += s.price_sold;
        b.profit += s.price_sold - (s.cost_price || 0);
        b.count += 1;
      }
    });
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales]);

  const week7Revenue = last7.reduce((a, d) => a + d.revenue, 0);
  const week7Profit = last7.reduce((a, d) => a + d.profit, 0);
  const avg7 = Math.round(week7Revenue / 7);
  const maxDay = Math.max(...last7.map(d => d.revenue), 1);
  // Ayer es el penúltimo bucket; sirve de comparación directa con hoy.
  const yesterdayRevenue = last7[last7.length - 2]?.revenue ?? 0;

  // ── Visitas a la tienda ────────────────────────────────────────────────────
  const viewsToday = useMemo(
    () => views.filter(v => dayKey(new Date(v.created_at)) === todayKey).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [views, todayKey],
  );

  const views7 = useMemo(() => {
    const keys = new Set(last7.map(d => d.key));
    return views.filter(v => keys.has(dayKey(new Date(v.created_at)))).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, last7]);

  // Conversión: de cada 100 visitas de los últimos 7 días, cuántas terminaron
  // en venta. Es aproximada — una visita y su compra pueden caer en días
  // distintos — pero sirve para ver la tendencia.
  const sales7 = useMemo(() => {
    const keys = new Set(last7.map(d => d.key));
    return sales.filter(s => keys.has(dayKey(new Date(s.created_at)))).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, last7]);
  const conversion = views7 > 0 ? (sales7 / views7) * 100 : null;

  // Lo más mirado de los últimos 30 días, cruzado con el catálogo.
  const topViewed = useMemo(() => {
    const counts = new Map<string, number>();
    views.forEach(v => {
      if (!v.item_id) return;
      counts.set(v.item_id, (counts.get(v.item_id) ?? 0) + 1);
    });
    const nameOf = (id: string) =>
      games.find(g => g.id === id)?.title ?? packs.find(p => p.id === id)?.title ?? null;
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, title: nameOf(id) }))
      .filter(x => x.title)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [views, games, packs]);

  const maxViewed = Math.max(...topViewed.map(t => t.count), 1);

  // De dónde llega la gente (últimos 30 días).
  const bySource = useMemo(() => {
    const counts = new Map<string, number>();
    views.forEach(v => {
      const k = v.source || "directo";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [views]);
  const totalBySource = bySource.reduce((a, x) => a + x.count, 0);

  // Visitas por día de los últimos 30 días, para el gráfico.
  const viewsDaily = useMemo(() => {
    const buckets = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
      return { key: dayKey(d), date: d, count: 0 };
    });
    const index = new Map(buckets.map(b => [b.key, b]));
    views.forEach(v => {
      const b = index.get(dayKey(new Date(v.created_at)));
      if (b) b.count += 1;
    });
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  const maxViewsDay = Math.max(...viewsDaily.map(d => d.count), 1);

  // Mes actual vs mes anterior (por eso se traen 60 días de visitas).
  const viewsThisMonth = useMemo(
    () => views.filter(v => {
      const d = new Date(v.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [views],
  );

  const viewsLastMonth = useMemo(() => {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return views.filter(v => {
      const d = new Date(v.created_at);
      return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views]);

  const monthDelta = viewsLastMonth > 0
    ? Math.round(((viewsThisMonth - viewsLastMonth) / viewsLastMonth) * 100)
    : null;


  // ── Serie mensual (últimos 6 meses) para el gráfico de barras ──────────────
  const monthly = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleDateString("es-CL", { month: "short" }).replace(".", ""),
        month: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0,
        cost: 0,
      };
    });
    sales.forEach(s => {
      const d = new Date(s.created_at);
      const b = buckets.find(x => x.month === d.getMonth() && x.year === d.getFullYear());
      if (b) { b.revenue += s.price_sold; b.cost += s.cost_price || 0; }
    });
    return buckets.map(b => ({ ...b, profit: b.revenue - b.cost }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales]);

  const maxRevenue = Math.max(...monthly.map(m => m.revenue), 1);
  const hasMonthlyData = monthly.some(m => m.revenue > 0);

  // ── Ganancia por tipo (este mes) para la dona ──────────────────────────────
  const byType = useMemo(() => {
    const acc = { game: 0, pack: 0 };
    thisMonth.forEach(s => {
      const profit = s.price_sold - (s.cost_price || 0);
      if (s.item_type === "pack") acc.pack += profit; else acc.game += profit;
    });
    return acc;
  }, [thisMonth]);
  const typeTotal = byType.game + byType.pack;

  const topItems = useMemo(() => {
    const counts = new Map<string, { title: string; count: number; revenue: number }>();
    thisMonth.forEach(s => {
      const prev = counts.get(s.item_title) ?? { title: s.item_title, count: 0, revenue: 0 };
      counts.set(s.item_title, { ...prev, count: prev.count + 1, revenue: prev.revenue + s.price_sold });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [thisMonth]);

  const activeGames = games.filter(g => g.is_active).length;
  const activePacks = packs.filter(p => p.is_active).length;
  const noSales = salesTableExists === false;

  const metrics = [
    {
      label: "Ingresos", value: noSales ? "—" : `$${fmt(totalRevenue)}`, sub: "CLP este mes",
      Icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/10",
    },
    {
      label: "Margen", value: noSales || totalRevenue === 0 ? "—" : `${margin}%`, sub: "sobre ingresos",
      Icon: Percent, color: "text-emerald-400", bg: "bg-emerald-500/10",
    },
    {
      label: "Ventas", value: noSales ? "—" : String(thisMonth.length), sub: "pedidos este mes",
      Icon: Receipt, color: "text-purple-400", bg: "bg-purple-500/10",
    },
  ];

  const quickActions = [
    { label: "Registrar venta", Icon: Plus, onClick: onRegisterSale, border: "border-green-500/20", bg: "hover:bg-green-500/10", iconBg: "bg-green-500/15", iconColor: "text-green-400" },
    { label: "Agregar juego", Icon: Gamepad2, onClick: () => onNavigate("juegos"), border: "border-blue-500/20", bg: "hover:bg-blue-500/10", iconBg: "bg-blue-500/15", iconColor: "text-blue-400" },
    { label: "Agregar pack", Icon: Gift, onClick: () => onNavigate("packs"), border: "border-purple-500/20", bg: "hover:bg-purple-500/10", iconBg: "bg-purple-500/15", iconColor: "text-purple-400" },
  ];

  // ── Geometría del gráfico de barras ────────────────────────────────────────
  const CW = 340, CH = 176, padL = 6, padR = 6, padT = 22, padB = 24;
  const plotW = CW - padL - padR;
  const plotH = CH - padT - padB;
  const slot = plotW / monthly.length;
  const barW = Math.min(30, slot * 0.5);
  const baseY = padT + plotH;

  // ── Geometría de la dona ───────────────────────────────────────────────────
  const R = 46, DC = 2 * Math.PI * R;
  const gameFrac = typeTotal > 0 ? byType.game / typeTotal : 0;
  const packFrac = typeTotal > 0 ? byType.pack / typeTotal : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-y-auto px-6 pb-32 pt-16 space-y-8 md:pb-10 md:pt-8 lg:px-10">
      {/* Title */}
      <div className="dash-card-in flex items-start gap-3.5">
        <span className="mt-1 h-9 w-1.5 shrink-0 rounded-full bg-green-400" />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Inicio</h1>
          <p className="mt-1 text-xs text-gray-500 capitalize">
            {now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── HOY: cuánto se vendió en el día, con la semana de contexto ── */}
      <div style={{ animationDelay: "30ms" }}
        className="dash-card-in grid grid-cols-1 gap-5 rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/15">
              <CalendarDays size={17} className="text-yellow-500" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white">Hoy</p>
              <p className="text-[10px] text-gray-600 capitalize">
                {now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>

          {firstLoadDone ? (
            <p key={todayRevenue} className="dash-value-in text-4xl font-black leading-none tracking-tight text-white">
              {noSales ? "—" : `$${fmt(todayRevenue)}`}
            </p>
          ) : (
            <div className="h-9 w-32 animate-pulse rounded-lg bg-white/10" />
          )}
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
            {todaySales.length === 0 ? "Sin ventas todavía" : `${todaySales.length} ${todaySales.length === 1 ? "venta" : "ventas"} · $${fmt(todayProfit)} de ganancia`}
          </p>

          {!noSales && firstLoadDone && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3.5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Ayer</p>
                <p className="mt-0.5 text-sm font-black text-gray-300">${fmt(yesterdayRevenue)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Promedio 7 días</p>
                <p className="mt-0.5 text-sm font-black text-gray-300">${fmt(avg7)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Últimos 7 días: ingresos (barra completa) con la ganancia marcada
            dentro, para ver de un vistazo cuánto de lo vendido quedó. */}
        <div className="flex flex-col justify-end">
          <div className="mb-2 flex items-center justify-end gap-3">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500">
              <span className="h-2 w-2 rounded-sm bg-white/20" /> Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-500">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Ganancia
            </span>
          </div>

          {/* h-full en la columna: sin una altura definida, el % de la barra
              no resuelve contra nada y se colapsa a cero. */}
          <div className="flex h-[132px] items-end gap-2">
            {last7.map(d => {
              const isToday = d.key === todayKey;
              const barPct = Math.round((d.revenue / maxDay) * 100);
              const profitPct = d.revenue > 0 ? Math.round((Math.max(d.profit, 0) / d.revenue) * 100) : 0;
              return (
                <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className={`text-[9px] font-black leading-none ${isToday ? "text-yellow-500" : "text-gray-600"}`}>
                    {d.revenue > 0 ? `$${fmt(d.revenue)}` : ""}
                  </span>
                  <div
                    title={`${d.label}: $${fmt(d.revenue)} en ${d.count} ${d.count === 1 ? "venta" : "ventas"} · $${fmt(d.profit)} de ganancia`}
                    className={`relative flex w-full items-end justify-center overflow-hidden rounded-t-lg transition-[height] duration-700 ${
                      isToday ? "bg-yellow-500/25" : "bg-white/12"
                    }`}
                    style={{ height: mounted ? `${Math.max(barPct, d.revenue > 0 ? 8 : 3)}%` : "3%" }}
                  >
                    {/* Porción de ganancia, pintada desde abajo */}
                    <div
                      className={`w-full transition-[height] duration-700 ${isToday ? "bg-yellow-500" : "bg-emerald-400"}`}
                      style={{ height: mounted ? `${profitPct}%` : "0%" }}
                    />
                  </div>
                  <span className={`text-[9px] font-black uppercase leading-none ${isToday ? "text-yellow-500" : "text-gray-600"}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-2.5 text-[10px] text-gray-600">
            <span>Últimos 7 días: <b className="text-gray-400">${fmt(week7Revenue)}</b></span>
            <span>Ganancia: <b className="text-emerald-400">${fmt(week7Profit)}</b></span>
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Hero: ganancia total + reparto */}
        <div style={{ animationDelay: "60ms" }}
          className="dash-card-in relative overflow-hidden rounded-[1.75rem] border border-green-500/20 bg-gradient-to-br from-green-500/[0.14] via-green-500/[0.04] to-transparent p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500/15">
              <Wallet size={20} className="text-green-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">este mes</span>
          </div>
          {firstLoadDone ? (
            <p key={totalProfit} className="dash-value-in text-4xl font-black leading-none tracking-tight text-green-400">{noSales ? "—" : `$${fmt(totalProfit)}`}</p>
          ) : (
            <div className="h-9 w-32 animate-pulse rounded-lg bg-white/10" />
          )}
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Ganancia total</p>

          {!noSales && firstLoadDone && (
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Tu parte</p>
                <p className="mt-0.5 text-sm font-black text-white">${fmt(Math.round(myShare))}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-pink-400">
                  <Handshake size={10} /> Pago a {partnerName}
                </p>
                <p className={`mt-0.5 text-sm font-black ${partnerNet >= 0 ? "text-pink-300" : "text-red-400"}`}>
                  ${fmt(Math.round(partnerNet))}
                </p>
              </div>
            </div>
          )}
        </div>

        {metrics.map(({ label, value, sub, Icon, color, bg }, i) => (
          <div key={label} style={{ animationDelay: `${120 + i * 70}ms` }} className="dash-card-in brand-shell rounded-[1.75rem] p-5">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            {firstLoadDone ? (
              <p className="text-3xl font-black leading-none tracking-tight">{value}</p>
            ) : (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-white/10" />
            )}
            <p className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
            <p className="mt-0.5 text-[11px] text-gray-700">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── VISITAS: cuánta gente mira la tienda y qué mira ── */}
      <div style={{ animationDelay: "180ms" }}
        className="dash-card-in grid grid-cols-1 gap-6 rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-6 lg:grid-cols-[minmax(0,300px)_1fr]">
        <div>
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/12">
              <Eye size={15} className="text-sky-400" />
            </span>
            <h3 className="text-sm font-black uppercase tracking-widest">Visitas</h3>
          </div>

          <p className="text-4xl font-black leading-none tracking-tight text-white">{viewsToday}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500">visitas hoy</p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3.5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Últimos 7 días</p>
              <p className="mt-0.5 text-sm font-black text-gray-300">{views7}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Conversión</p>
              <p className="mt-0.5 text-sm font-black text-sky-300">
                {conversion === null ? "—" : `${conversion.toFixed(1)}%`}
              </p>
            </div>
          </div>
          {conversion !== null && (
            <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
              {sales7} {sales7 === 1 ? "venta" : "ventas"} sobre {views7} visitas en la semana.
            </p>
          )}

          {/* Mes actual contra el anterior */}
          <div className="mt-4 border-t border-white/10 pt-3.5">
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-black leading-none text-white">{viewsThisMonth}</p>
              {monthDelta !== null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  monthDelta >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                }`}>
                  {monthDelta >= 0 ? "+" : ""}{monthDelta}%
                </span>
              )}
            </div>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-600">
              este mes {viewsLastMonth > 0 && `· ${viewsLastMonth} el anterior`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Visitas por día. Barras finas: con 30 días, etiquetar cada una es
              ilegible, así que el detalle va en el tooltip. */}
          <div>
            <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-gray-600">
              Visitas por día · últimos 30 días
            </p>
            {views.length === 0 ? (
              <p className="text-[11px] text-gray-700">Sin visitas registradas todavía.</p>
            ) : (
              <>
                <div className="flex h-24 items-end gap-[3px]">
                  {viewsDaily.map(d => {
                    const isToday = d.key === todayKey;
                    return (
                      <div
                        key={d.key}
                        title={`${d.date.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}: ${d.count} ${d.count === 1 ? "visita" : "visitas"}`}
                        className={`flex-1 rounded-t transition-[height] duration-700 ${
                          isToday ? "bg-yellow-500" : "bg-sky-400/60"
                        }`}
                        style={{ height: mounted ? `${Math.max(Math.round((d.count / maxViewsDay) * 100), d.count > 0 ? 6 : 2)}%` : "2%" }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-[9px] font-black uppercase text-gray-700">
                  <span>{viewsDaily[0].date.toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                  <span>máx {maxViewsDay}/día</span>
                  <span>hoy</span>
                </div>
              </>
            )}
          </div>

        {/* Lo más mirado + de dónde llegan */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Cada columna del grid necesita su propio contenedor, o el título
              y la lista caen en celdas distintas. */}
          <div>
          <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-gray-600">
            Lo más visto · últimos 30 días
          </p>
          {topViewed.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <Eye size={22} className="mb-3 text-gray-700" />
              <p className="text-xs font-bold text-gray-600">Todavía no hay visitas registradas</p>
              <p className="mt-1 max-w-[280px] text-[10px] text-gray-700">
                Si acabas de activar el registro, corre <code className="rounded bg-white/10 px-1 py-0.5 font-mono">page-views.sql</code> en Supabase.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topViewed.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="w-[45%] shrink-0 truncate text-[11.5px] font-bold text-gray-300">{item.title}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-sky-400/70 transition-[width] duration-700"
                      style={{ width: mounted ? `${Math.round((item.count / maxViewed) * 100)}%` : "0%" }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] font-black text-white">{item.count}</span>
                </div>
              ))}
            </div>
          )}
          </div>

          <div>
            <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-gray-600">
              De dónde llegan
            </p>
            {bySource.length === 0 ? (
              <p className="text-[11px] text-gray-700">Sin datos todavía.</p>
            ) : (
              <div className="space-y-2">
                {bySource.map(s => (
                  <div key={s.source} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-24 shrink-0 truncate font-bold capitalize text-gray-300">{s.source}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-violet-400/70 transition-[width] duration-700"
                        style={{ width: mounted ? `${Math.round((s.count / (totalBySource || 1)) * 100)}%` : "0%" }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-black text-white">
                      {Math.round((s.count / (totalBySource || 1)) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* ── PUBLICIDAD: qué tan bien rinde lo invertido este mes ── */}
      <div style={{ animationDelay: "200ms" }}
        className="dash-card-in rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/12">
              <Megaphone size={15} className="text-orange-400" />
            </span>
            <h3 className="text-sm font-black uppercase tracking-widest">Publicidad</h3>
          </div>
          <button type="button" onClick={() => onNavigate("ventas")}
            className="text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white">
            Registrar gasto
          </button>
        </div>

        {totalAdSpend === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Megaphone size={24} className="mb-3 text-gray-700" />
            <p className="text-xs font-bold text-gray-600">Sin gastos de publicidad este mes</p>
            <p className="mt-1 text-[10px] text-gray-700">Regístralos en Ventas para ver cuánto te rinden.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Invertido</p>
              <p className="mt-1 text-2xl font-black leading-none text-orange-400">${fmt(totalAdSpend)}</p>
              <p className="mt-1.5 text-[10px] text-gray-600">este mes</p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Retorno</p>
              <p className={`mt-1 text-2xl font-black leading-none ${
                roas === null ? "text-gray-500" : roas >= 1 ? "text-emerald-400" : "text-red-400"
              }`}>
                {roas === null ? "—" : `${roas.toFixed(1)}x`}
              </p>
              <p className="mt-1.5 text-[10px] text-gray-600">
                {roas === null ? "sin datos" : `$${fmt(Math.round(roas))} de venta por cada $1`}
              </p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Costo por venta</p>
              <p className="mt-1 text-2xl font-black leading-none text-white">
                {costPerSale === null ? "—" : `$${fmt(costPerSale)}`}
              </p>
              <p className="mt-1.5 text-[10px] text-gray-600">
                {thisMonth.length} {thisMonth.length === 1 ? "venta" : "ventas"} este mes
              </p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Se lleva de la ganancia</p>
              <p className="mt-1 text-2xl font-black leading-none text-white">
                {adShareOfProfit === null ? "—" : `${adShareOfProfit}%`}
              </p>
              {/* Barra: cuánto de la ganancia se va en anuncios */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ${
                    (adShareOfProfit ?? 0) > 50 ? "bg-red-400" : "bg-orange-400"
                  }`}
                  style={{ width: mounted ? `${Math.min(adShareOfProfit ?? 0, 100)}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Bar chart — revenue vs profit */}
        <div style={{ animationDelay: "260ms" }} className="dash-card-in brand-shell rounded-[1.75rem] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/12">
                <BarChart2 size={15} className="text-green-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest">Ingresos y ganancia</h3>
            </div>
            <span className="text-[10px] text-gray-600">últimos 6 meses</span>
          </div>

          {/* Legend */}
          <div className="mb-2 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#34d399]" /> Ganancia
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-white/20" /> Costo
            </span>
          </div>

          {!firstLoadDone ? (
            <div className="h-44 animate-pulse rounded-xl bg-white/5" />
          ) : !hasMonthlyData ? (
            <div className="flex h-44 flex-col items-center justify-center text-center">
              <BarChart2 size={26} className="mb-3 text-gray-700" />
              <p className="text-xs font-bold text-gray-600">
                {noSales ? "Configura la tabla de ventas." : "Aún no hay ventas para graficar."}
              </p>
            </div>
          ) : (
            <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="Ingresos y ganancia por mes">
              <defs>
                <linearGradient id="dashProfitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6ee7b7" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="dashCostGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
                </linearGradient>
              </defs>
              {/* Gridlines */}
              {[0, 0.5, 1].map(t => {
                const y = padT + plotH * (1 - t);
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={CW - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                    <text x={padL} y={y - 3} fill="rgba(255,255,255,0.35)" fontSize={8} fontWeight={700}>
                      {compact(Math.round(maxRevenue * t))}
                    </text>
                  </g>
                );
              })}
              {monthly.map((m, i) => {
                const x = padL + i * slot + (slot - barW) / 2;
                const costH = (m.cost / maxRevenue) * plotH;
                const profitH = (m.profit / maxRevenue) * plotH;
                const costY = baseY - costH;
                const profitY = costY - profitH;
                const delay = `${i * 65}ms`;
                return (
                  <g key={i}>
                    {m.cost > 0 && (
                      <rect className="dash-bar" style={{ animationDelay: delay }}
                        x={x} y={costY} width={barW} height={costH} rx={2} fill="url(#dashCostGrad)" />
                    )}
                    {m.profit > 0 && (
                      <rect className="dash-bar" style={{ animationDelay: delay }}
                        x={x} y={profitY} width={barW} height={profitH} rx={2} fill="url(#dashProfitGrad)" />
                    )}
                    {m.revenue > 0 && (
                      <text className="dash-bar-label" style={{ animationDelay: `${i * 65 + 260}ms` }}
                        x={x + barW / 2} y={profitY - 5} fill="#e5e7eb" fontSize={8.5} fontWeight={800} textAnchor="middle">
                        {compact(m.revenue)}
                      </text>
                    )}
                    <text x={x + barW / 2} y={baseY + 14} fill="rgba(255,255,255,0.5)" fontSize={9} fontWeight={800} textAnchor="middle" className="uppercase">
                      {m.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Donut — profit by type */}
        <div style={{ animationDelay: "330ms" }} className="dash-card-in brand-shell rounded-[1.75rem] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/12">
              <Wallet size={15} className="text-green-400" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest">Ganancia por tipo</h3>
          </div>

          {!firstLoadDone ? (
            <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-white/5" />
          ) : typeTotal <= 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <Wallet size={24} className="mb-3 text-gray-700" />
              <p className="text-xs font-bold text-gray-600">Sin ganancias este mes.</p>
            </div>
          ) : (
            <>
              <div className="relative mx-auto h-40 w-40">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <defs>
                    <filter id="dashArcGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#34d399" floodOpacity="0.45" />
                    </filter>
                  </defs>
                  <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
                  {gameFrac > 0 && (
                    <circle className="dash-donut-arc" cx="60" cy="60" r={R} fill="none" stroke="#3b82f6" strokeWidth={14}
                      strokeDasharray={`${mounted ? gameFrac * DC : 0} ${DC}`} strokeLinecap="round" filter="url(#dashArcGlow)" />
                  )}
                  {packFrac > 0 && (
                    <circle className="dash-donut-arc" cx="60" cy="60" r={R} fill="none" stroke="#a855f7" strokeWidth={14}
                      strokeDasharray={`${mounted ? packFrac * DC : 0} ${DC}`} strokeDashoffset={`${-gameFrac * DC}`} strokeLinecap="round" filter="url(#dashArcGlow)" />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="dash-value-in text-lg font-black leading-none text-green-400" style={{ animationDelay: "500ms" }}>{compact(typeTotal)}</span>
                  <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-600">Ganancia</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="dash-value-in flex items-center justify-between" style={{ animationDelay: "560ms" }}>
                  <span className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" /> Juegos
                  </span>
                  <span className="text-xs font-black">${fmt(byType.game)}</span>
                </div>
                <div className="dash-value-in flex items-center justify-between" style={{ animationDelay: "620ms" }}>
                  <span className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#a855f7]" /> Packs
                  </span>
                  <span className="text-xs font-black">${fmt(byType.pack)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-600">Accesos rápidos</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map(({ label, Icon, onClick, border, bg, iconBg, iconColor }, i) => (
            <button key={label} onClick={onClick} style={{ animationDelay: `${400 + i * 70}ms` }}
              className={`dash-card-in magnetic flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${border} ${bg}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon size={18} className={iconColor} />
              </div>
              <span className="text-sm font-black text-white">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Top items + recent sales */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top selling */}
        <div style={{ animationDelay: "420ms" }} className="dash-card-in brand-shell rounded-[1.75rem] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/12">
                <TrendingUp size={15} className="text-blue-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest">Más vendido</h3>
            </div>
            <span className="text-[10px] text-gray-600">este mes</span>
          </div>
          {!firstLoadDone ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-4 animate-pulse rounded bg-white/10" style={{ width: `${90 - i * 20}%` }} />
              ))}
            </div>
          ) : topItems.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Zap size={26} className="mb-3 text-gray-700" />
              <p className="text-xs font-bold text-gray-600">
                {noSales ? "Configura la tabla de ventas para ver esto." : "Sin ventas registradas este mes."}
              </p>
              {!noSales && (
                <button onClick={onRegisterSale}
                  className="mt-3 text-xs font-black text-blue-400 hover:text-blue-300 transition-colors">
                  + Registrar primera venta
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {topItems.map((item, i) => {
                const pct = topItems[0].count ? Math.round((item.count / topItems[0].count) * 100) : 0;
                return (
                  <div key={item.title} className="dash-value-in" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <span className="w-4 shrink-0 text-[10px] font-black text-gray-600">#{i + 1}</span>
                      <p className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</p>
                      <span className="text-xs font-black text-gray-400">{item.count}×</span>
                      <span className="text-xs font-black">${fmt(item.revenue)}</span>
                    </div>
                    <div className="ml-7 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="dash-progress-fill h-full rounded-full bg-blue-500" style={{ width: mounted ? `${pct}%` : "0%" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sales */}
        <div style={{ animationDelay: "480ms" }} className="dash-card-in brand-shell rounded-[1.75rem] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/12">
                <Receipt size={15} className="text-green-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest">Últimas ventas</h3>
            </div>
            <button onClick={() => onNavigate("ventas")}
              className="text-[10px] font-black text-gray-600 hover:text-gray-400 transition-colors">
              Ver todas →
            </button>
          </div>
          {!firstLoadDone ? (
            <div className="divide-y divide-white/5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-white/10" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-white/10" />
                </div>
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Receipt size={26} className="mb-3 text-gray-700" />
              <p className="text-xs font-bold text-gray-600">
                {noSales ? "Configura la tabla de ventas." : "Sin ventas registradas."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sales.slice(0, 6).map((sale, i) => {
                const profit = sale.price_sold - (sale.cost_price || 0);
                return (
                  <div key={sale.id} className="dash-value-in flex items-center gap-3 py-2.5" style={{ animationDelay: `${i * 55}ms` }}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      sale.item_type === "pack" ? "bg-purple-500/15" : "bg-blue-500/15"
                    }`}>
                      {sale.item_type === "pack"
                        ? <Gift size={12} className="text-purple-400" />
                        : <Gamepad2 size={12} className="text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gray-300">{sale.item_title}</p>
                      {profit > 0 && <p className="text-[10px] font-bold text-green-500/80">+${fmt(profit)} ganancia</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-black text-white">${fmt(sale.price_sold)}</p>
                      <p className="text-[10px] text-gray-600">{fmtDate(sale.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Catalog snapshot */}
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-600">Estado del catálogo</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Juegos activos", value: activeGames, total: games.length || 1, bar: "bg-blue-500", nav: "juegos" as const },
            { label: "Juegos inactivos", value: games.length - activeGames, total: games.length || 1, bar: "bg-gray-600", nav: "juegos" as const },
            { label: "Packs activos", value: activePacks, total: packs.length || 1, bar: "bg-purple-500", nav: "packs" as const },
            { label: "En oferta", value: games.filter(g => g.is_offer).length, total: games.length || 1, bar: "bg-orange-500", nav: "juegos" as const },
          ].map(({ label, value, total, bar, nav }, i) => (
            <button key={label} onClick={() => onNavigate(nav)} style={{ animationDelay: `${540 + i * 60}ms` }}
              className="dash-card-in brand-glass rounded-2xl p-4 text-left transition-all hover:bg-white/8">
              {firstLoadDone
                ? <p className="text-2xl font-black">{value}</p>
                : <div className="h-6 w-10 animate-pulse rounded bg-white/10" />}
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
              <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
                <div className={`dash-progress-fill h-full rounded-full ${bar}`} style={{ width: mounted ? `${Math.round((value / total) * 100)}%` : "0%" }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
