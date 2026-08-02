"use client";

import { useMemo, useState, useEffect } from "react";
import { Eye, UserPlus, Users, X, Loader2, AlertCircle, LineChart, Package, Gamepad2 } from "lucide-react";
import { useAdminStore } from "../_store/adminStore";
import { supabase } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";

function getLocalYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function Analiticas() {
  const { views, games, packs, sales } = useAdminStore();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersList, setUsersList] = useState<{id: string, email: string, created_at: string}[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      if (!supabase) return;
      setLoadingUsers(true);
      const { data, error } = await supabase.rpc('get_admin_user_emails');
      if (error) {
        setUsersError("No se pudo cargar la lista de cuentas.");
      } else if (data) {
        const uniqueUsers: typeof data = [];
        const seen = new Set();
        for (const u of data) {
          const emailClean = (u.email || "").trim().toLowerCase();
          if (!seen.has(emailClean)) {
            seen.add(emailClean);
            uniqueUsers.push(u);
          }
        }
        setUsersList(uniqueUsers);
        setTotalUsers(uniqueUsers.length);
      }
      setLoadingUsers(false);
    }
    fetchUsers();
  }, []);

  const handleOpenUsers = () => {
    setShowUsersModal(true);
  };

  const {
    todayVisits, last7DaysVisits, last7DaysSales, conversionRate,
    thisMonthVisits, lastMonthVisits, monthChange,
    days30, maxDaily,
    topGames, topPacks, maxGameCount, maxPackCount,
    topSources, total30d
  } = useMemo(() => {
    const now = new Date();
    
    // Array for 30 days chart
    const days30: { date: string; count: number; label: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days30.push({ 
        date: getLocalYMD(d), 
        count: 0, 
        label: `${d.getDate()} ${MONTHS[d.getMonth()]}` 
      });
    }

    const d30 = new Date(now); d30.setDate(d30.getDate() - 29); d30.setHours(0,0,0,0);
    const d7 = new Date(now); d7.setDate(d7.getDate() - 6); d7.setHours(0,0,0,0);
    
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    let thisMonthVisits = 0;
    let lastMonthVisits = 0;
    
    const itemCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    let total30dVisits = 0;

    views.forEach(v => {
      const d = new Date(v.created_at);
      const ymd = getLocalYMD(d);
      const dayObj = days30.find(x => x.date === ymd);
      if (dayObj) dayObj.count++;

      if (d >= startThisMonth) thisMonthVisits++;
      else if (d >= startLastMonth && d <= endLastMonth) lastMonthVisits++;

      if (d >= d30) {
        total30dVisits++;
        if (v.item_id) itemCounts.set(v.item_id, (itemCounts.get(v.item_id) || 0) + 1);
        const src = v.source || "Directo";
        // Normalize common sources
        const normSrc = src.toLowerCase().includes('ig') || src.toLowerCase().includes('instagram') ? 'Ig' : 
                        src.toLowerCase().includes('fb') || src.toLowerCase().includes('facebook') ? 'Fb' : 
                        src;
        sourceCounts.set(normSrc, (sourceCounts.get(normSrc) || 0) + 1);
      }
    });

    const todayVisits = days30[29].count;
    const last7DaysVisits = days30.slice(23).reduce((a, b) => a + b.count, 0);

    let last7DaysSales = 0;
    sales.forEach(s => {
      if (new Date(s.created_at) >= d7) last7DaysSales++;
    });

    const conversionRate = last7DaysVisits > 0 ? ((last7DaysSales / last7DaysVisits) * 100).toFixed(1) : "0.0";
    
    let monthChange = 0;
    if (lastMonthVisits > 0) {
      monthChange = Math.round(((thisMonthVisits - lastMonthVisits) / lastMonthVisits) * 100);
    } else if (thisMonthVisits > 0) {
      monthChange = 100;
    }

    const maxDaily = Math.max(...days30.map(d => d.count), 1);

    const itemsMap = new Map<string, {title: string, type: 'game' | 'pack'}>();
    games.forEach(g => itemsMap.set(g.id, {title: g.title, type: 'game'}));
    packs.forEach(p => itemsMap.set(p.id, {title: p.title, type: 'pack'}));

    const allItems = Array.from(itemCounts.entries())
      .map(([id, count]) => {
         const info = itemsMap.get(id);
         return { title: info ? info.title : "Desconocido", count, type: info?.type || 'game' };
      });

    const topGames = allItems.filter(i => i.type === 'game').sort((a,b) => b.count - a.count).slice(0, 5);
    const topPacks = allItems.filter(i => i.type === 'pack').sort((a,b) => b.count - a.count).slice(0, 5);

    const maxGameCount = topGames[0]?.count || 1;
    const maxPackCount = topPacks[0]?.count || 1;

    const topSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ 
        source: source.charAt(0).toUpperCase() + source.slice(1), 
        count,
        pct: total30dVisits > 0 ? Math.round((count / total30dVisits) * 100) : 0
      }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 5);

    return {
      todayVisits, last7DaysVisits, last7DaysSales, conversionRate,
      thisMonthVisits, lastMonthVisits, monthChange,
      days30, maxDaily,
      topGames, topPacks, maxGameCount, maxPackCount,
      topSources, total30d: total30dVisits
    };
  }, [views, sales, games, packs]);

  return (
    <div className="flex-1 overflow-y-auto pb-24 pt-6 px-4 md:px-8 w-full max-w-[1400px] mx-auto custom-scrollbar">
      
      {/* HEADER WITH USERS BUTTON */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black uppercase tracking-widest text-[#0ea5e9] flex items-center gap-2">
          <LineChart className="text-[#0ea5e9]" /> Analíticas e Insights
        </h1>
        {totalUsers !== null && (
          <button 
            onClick={handleOpenUsers}
            className="flex items-center gap-3 bg-[#0b0e11] border border-white/5 px-5 py-2.5 rounded-2xl shadow-lg hover:bg-white/5 transition-colors text-left"
          >
            <div className="bg-[#0ea5e9]/10 p-1.5 rounded-xl shrink-0">
              <UserPlus size={18} className="text-[#0ea5e9]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Cuentas Registradas</p>
              <p className="text-xl font-black text-white leading-none">{totalUsers}</p>
            </div>
          </button>
        )}
      </div>

      {/* DASHBOARD CARD (matches third photo) */}
      <div className="bg-[#0b0e11] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col lg:flex-row gap-8 lg:gap-12 mb-8">
        
        {/* LEFT COLUMN */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#0f1923] p-2.5 rounded-2xl">
              <Eye className="text-[#0ea5e9]" size={20} />
            </div>
            <h2 className="text-base font-black uppercase tracking-widest text-white">Visitas</h2>
          </div>
          
          <div className="mt-2">
            <h3 className="text-5xl font-black text-white leading-none tracking-tight">{todayVisits}</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-2">Visitas Hoy</p>
          </div>
          
          <div className="border-t border-white/[0.04] pt-6 flex justify-between gap-4 mt-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Últimos 7 días</p>
              <p className="text-xl font-black text-white mt-1">{last7DaysVisits}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Conversión</p>
              <p className="text-xl font-black text-[#0ea5e9] mt-1">{conversionRate}%</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 font-bold">{last7DaysSales} venta{last7DaysSales !== 1 ? 's' : ''} sobre {last7DaysVisits} visitas en la semana.</p>
          
          <div className="border-t border-white/[0.04] pt-6 flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black text-white leading-none tracking-tight">{thisMonthVisits}</p>
              {monthChange !== 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${monthChange > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {monthChange > 0 ? '+' : ''}{monthChange}%
                </span>
              )}
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">Este mes · {lastMonthVisits} el anterior</p>
          </div>
        </div>
        
        {/* RIGHT COLUMN */}
        <div className="w-full lg:w-2/3 flex flex-col pt-1 lg:pt-0">
          
          {/* Chart */}
          <div className="flex justify-between items-end mb-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Visitas por día · Últimos 30 días</p>
          </div>
          
          <div className="h-32 flex items-end justify-between gap-1 mt-auto border-b border-white/[0.08] pb-1">
            {days30.map((d, i) => {
              const heightPct = Math.max((d.count / maxDaily) * 100, 2);
              const isToday = i === 29;
              return (
                <div key={d.date} className="w-full h-full flex flex-col justify-end items-center group relative">
                  <div className="absolute -top-8 bg-black border border-white/10 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {d.label}: {d.count}
                  </div>
                  <div 
                    className={`w-full rounded-sm transition-colors ${isToday ? 'bg-[#fbbf24] hover:bg-[#f59e0b]' : 'bg-[#0369a1] hover:bg-[#0284c7]'}`}
                    style={{ height: `${heightPct}%`, minHeight: '4px' }}
                  />
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between mt-2 mb-10">
            <p className="text-[9px] font-bold text-gray-600 uppercase">{days30[0].label}</p>
            <p className="text-[9px] font-bold text-gray-600">MÁX {maxDaily}/DÍA</p>
            <p className="text-[9px] font-bold text-gray-600 uppercase">HOY</p>
          </div>
          
          {/* Bottom sections of Main Card */}
          <div className="mt-auto">
            {/* Traffic Sources */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4">De dónde llegan</p>
              <div className="space-y-4 max-w-lg">
                {topSources.length === 0 ? (
                  <p className="text-[10px] text-gray-600">Sin datos suficientes.</p>
                ) : (
                  topSources.map((src, i) => {
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <p className="text-[11px] font-bold text-white w-24 truncate shrink-0">{src.source}</p>
                        <div className="flex-1 bg-white/[0.03] h-2 rounded-full overflow-hidden">
                          <div className="h-full bg-[#8b5cf6] rounded-full" style={{ width: `${src.pct}%` }} />
                        </div>
                        <p className="text-[10px] font-black text-white w-8 text-right">{src.pct}%</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* LO MÁS VISTO CARD */}
      <div className="bg-[#0b0e11] border border-white/5 rounded-3xl p-6 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Top Packs */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <Package size={14} className="text-[#0ea5e9]" /> Packs más vistos · Últimos 30 días
          </p>
          <div className="space-y-4">
            {topPacks.length === 0 ? (
              <p className="text-[10px] text-gray-600">Sin datos suficientes.</p>
            ) : (
              topPacks.map((item, i) => {
                const pct = (item.count / maxPackCount) * 100;
                return (
                  <div key={i} className="flex items-center gap-3 group">
                    <p className="text-[12px] font-bold text-white w-32 truncate shrink-0 group-hover:text-[#0ea5e9] transition-colors">{item.title}</p>
                    <div className="flex-1 bg-white/[0.03] h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0ea5e9] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] font-black text-gray-300 w-8 text-right">{item.count}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Games */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <Gamepad2 size={14} className="text-[#0ea5e9]" /> Juegos más vistos · Últimos 30 días
          </p>
          <div className="space-y-4">
            {topGames.length === 0 ? (
              <p className="text-[10px] text-gray-600">Sin datos suficientes.</p>
            ) : (
              topGames.map((item, i) => {
                const pct = (item.count / maxGameCount) * 100;
                return (
                  <div key={i} className="flex items-center gap-3 group">
                    <p className="text-[12px] font-bold text-white w-32 truncate shrink-0 group-hover:text-[#0ea5e9] transition-colors">{item.title}</p>
                    <div className="flex-1 bg-white/[0.03] h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0ea5e9] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] font-black text-gray-300 w-8 text-right">{item.count}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL CUENTAS */}
      <AnimatePresence>
        {showUsersModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowUsersModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0f1217] p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-500/20 p-2 rounded-xl text-pink-400">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest text-white">Detalle de Cuentas</h3>
                    <p className="text-xs text-gray-400">{totalUsers} cuentas registradas</p>
                  </div>
                </div>
                <button onClick={() => setShowUsersModal(false)} className="rounded-full bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {loadingUsers ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-pink-500 mb-4" />
                    <p className="text-sm text-gray-400">Cargando usuarios...</p>
                  </div>
                ) : usersError ? (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                    <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300 leading-relaxed">{usersError}</p>
                  </div>
                ) : usersList && usersList.length > 0 ? (
                  usersList.map((u, i) => (
                    <div key={u.id} className="flex items-center justify-between bg-white/5 border border-white/5 p-3 rounded-xl hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-xs font-black text-pink-400">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{u.email}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-600">#{usersList.length - i}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-gray-500 py-8">No hay usuarios registrados.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
