"use client";

import { useMemo } from "react";
import { BarChart2, DollarSign, Gamepad2, Gift, Plus, Receipt, TrendingUp, Package, Zap } from "lucide-react";
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
  const avgTicket = thisMonth.length > 0 ? Math.round(totalRevenue / thisMonth.length) : 0;

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

  const metrics = [
    {
      label: "Ventas este mes",
      value: salesTableExists === false ? "—" : String(thisMonth.length),
      sub: salesTableExists === false ? "Sin tabla configurada" : "pedidos",
      Icon: Receipt, color: "text-blue-400", bg: "bg-blue-500/10",
    },
    {
      label: "Ingresos",
      value: salesTableExists === false ? "—" : `$${fmt(totalRevenue)}`,
      sub: "CLP este mes",
      Icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10",
    },
    {
      label: "Ticket promedio",
      value: avgTicket > 0 ? `$${fmt(avgTicket)}` : "—",
      sub: "por venta",
      Icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10",
    },
    {
      label: "Catálogo activo",
      value: String(activeGames + activePacks),
      sub: `${activeGames} juegos · ${activePacks} packs`,
      Icon: Package, color: "text-orange-400", bg: "bg-orange-500/10",
    },
  ];

  const quickActions = [
    { label: "Registrar venta", Icon: Plus, onClick: onRegisterSale, border: "border-green-500/20", bg: "hover:bg-green-500/10", iconBg: "bg-green-500/15", iconColor: "text-green-400" },
    { label: "Agregar juego", Icon: Gamepad2, onClick: () => onNavigate("juegos"), border: "border-blue-500/20", bg: "hover:bg-blue-500/10", iconBg: "bg-blue-500/15", iconColor: "text-blue-400" },
    { label: "Agregar pack", Icon: Gift, onClick: () => onNavigate("packs"), border: "border-purple-500/20", bg: "hover:bg-purple-500/10", iconBg: "bg-purple-500/15", iconColor: "text-purple-400" },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-32 pt-16 space-y-7 md:pb-6 md:pt-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-black uppercase tracking-widest">Inicio</h1>
        <p className="mt-1 text-xs text-gray-500 capitalize">
          {now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className="brand-shell rounded-[1.4rem] p-5">
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
              <BarChart2 size={15} className="text-blue-400" />
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
                {salesTableExists === false
                  ? "Configura la tabla de ventas para ver esto."
                  : "Sin ventas registradas este mes."}
              </p>
              {salesTableExists !== false && (
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
                {salesTableExists === false ? "Configura la tabla de ventas." : "Sin ventas registradas."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sales.slice(0, 6).map(sale => (
                <div key={sale.id} className="flex items-center gap-3 py-2.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    sale.item_type === "pack" ? "bg-purple-500/15" : "bg-blue-500/15"
                  }`}>
                    {sale.item_type === "pack"
                      ? <Gift size={12} className="text-purple-400" />
                      : <Gamepad2 size={12} className="text-blue-400" />}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-300">{sale.item_title}</p>
                  <p className="shrink-0 text-xs font-black text-green-400">${fmt(sale.price_sold)}</p>
                  <p className="shrink-0 text-[10px] text-gray-600">{fmtDate(sale.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Catalog snapshot */}
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-600">Estado del catálogo</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Juegos activos", value: activeGames, total: games.length, bar: "bg-blue-500", nav: "juegos" as const },
            { label: "Juegos inactivos", value: games.length - activeGames, total: games.length, bar: "bg-gray-600", nav: "juegos" as const },
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
