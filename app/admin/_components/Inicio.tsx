"use client";

import { useMemo } from "react";
import {
  BarChart2, DollarSign, Gamepad2, Gift, Percent, Plus, Receipt, TrendingUp, Wallet, Zap,
} from "lucide-react";
import type { AdminGame, AdminPack, AdminSection, Sale } from "../_types";
import { fmt, fmtDate } from "../_helpers";

type Props = {
  games: AdminGame[];
  packs: AdminPack[];
  sales: Sale[];
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

export function Inicio({ games, packs, sales, salesTableExists, firstLoadDone = true, onNavigate, onRegisterSale }: Props) {
  const now = new Date();

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
      label: "Ganancia", value: noSales ? "—" : `$${fmt(totalProfit)}`, sub: "utilidad este mes",
      Icon: Wallet, color: "text-green-400", bg: "bg-green-500/10", highlight: true,
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
    <div className="flex-1 overflow-y-auto px-6 pb-32 pt-16 space-y-7 md:pb-6 md:pt-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black uppercase tracking-widest">Inicio</h1>
        <p className="mt-1 text-xs text-gray-500 capitalize">
          {now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(({ label, value, sub, Icon, color, bg, highlight }) => (
          <div
            key={label}
            className={`rounded-[1.4rem] p-5 ${highlight ? "border border-green-500/25 bg-green-500/[0.07]" : "brand-shell"}`}
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            {firstLoadDone ? (
              <p className={`text-3xl font-black leading-none tracking-tight ${highlight ? "text-green-400" : ""}`}>{value}</p>
            ) : (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-white/10" />
            )}
            <p className="mt-1.5 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
            <p className="mt-0.5 text-[11px] text-gray-700">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Bar chart — revenue vs profit */}
        <div className="brand-shell rounded-[1.4rem] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} className="text-green-400" />
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
                return (
                  <g key={i}>
                    {m.cost > 0 && (
                      <rect x={x} y={costY} width={barW} height={costH} rx={2} fill="rgba(255,255,255,0.16)" />
                    )}
                    {m.profit > 0 && (
                      <rect x={x} y={profitY} width={barW} height={profitH} rx={2} fill="#34d399" />
                    )}
                    {m.revenue > 0 && (
                      <text x={x + barW / 2} y={profitY - 5} fill="#e5e7eb" fontSize={8.5} fontWeight={800} textAnchor="middle">
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
        <div className="brand-shell rounded-[1.4rem] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Wallet size={15} className="text-green-400" />
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
                  <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
                  {gameFrac > 0 && (
                    <circle cx="60" cy="60" r={R} fill="none" stroke="#3b82f6" strokeWidth={14}
                      strokeDasharray={`${gameFrac * DC} ${DC}`} strokeLinecap="round" />
                  )}
                  {packFrac > 0 && (
                    <circle cx="60" cy="60" r={R} fill="none" stroke="#a855f7" strokeWidth={14}
                      strokeDasharray={`${packFrac * DC} ${DC}`} strokeDashoffset={`${-gameFrac * DC}`} strokeLinecap="round" />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black leading-none text-green-400">{compact(typeTotal)}</span>
                  <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-600">Ganancia</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" /> Juegos
                  </span>
                  <span className="text-xs font-black">${fmt(byType.game)}</span>
                </div>
                <div className="flex items-center justify-between">
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
          {quickActions.map(({ label, Icon, onClick, border, bg, iconBg, iconColor }) => (
            <button key={label} onClick={onClick}
              className={`magnetic flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all ${border} ${bg}`}>
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
        <div className="brand-shell rounded-[1.4rem] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-400" />
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
                  <div key={item.title}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <span className="w-4 shrink-0 text-[10px] font-black text-gray-600">#{i + 1}</span>
                      <p className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</p>
                      <span className="text-xs font-black text-gray-400">{item.count}×</span>
                      <span className="text-xs font-black">${fmt(item.revenue)}</span>
                    </div>
                    <div className="ml-7 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sales */}
        <div className="brand-shell rounded-[1.4rem] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={15} className="text-green-400" />
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
              {sales.slice(0, 6).map(sale => {
                const profit = sale.price_sold - (sale.cost_price || 0);
                return (
                  <div key={sale.id} className="flex items-center gap-3 py-2.5">
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
          ].map(({ label, value, total, bar, nav }) => (
            <button key={label} onClick={() => onNavigate(nav)}
              className="brand-glass rounded-2xl p-4 text-left transition-all hover:bg-white/8">
              {firstLoadDone
                ? <p className="text-2xl font-black">{value}</p>
                : <div className="h-6 w-10 animate-pulse rounded bg-white/10" />}
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</p>
              <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.round((value / total) * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
