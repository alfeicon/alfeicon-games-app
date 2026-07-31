"use client";

import { useMemo, useState, useEffect } from "react";
import { LineChart, Users, MousePointerClick, Gamepad2, Gift, Search, TrendingUp, UserPlus, X, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAdminStore } from "../_store/adminStore";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

export function Analiticas() {
  const { views, games, packs } = useAdminStore();
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersList, setUsersList] = useState<{id: string, email: string, created_at: string}[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsersCount() {
      if (!supabase) return;
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true });
      if (count !== null) setTotalUsers(count);
    }
    fetchUsersCount();
  }, []);

  const handleOpenUsers = async () => {
    setShowUsersModal(true);
    setLoadingUsers(true);
    setUsersError(null);
    const { data, error } = await supabase.rpc('get_admin_user_emails');
    setLoadingUsers(false);
    
    if (error) {
      setUsersError("No se pudo cargar. Asegúrate de haber ejecutado el script get-user-emails.sql en Supabase.");
    } else {
      setUsersList(data || []);
    }
  };

  // Mapeamos los items (juegos y packs) para encontrarlos rápido
  const itemsMap = useMemo(() => {
    const map = new Map<string, { title: string; type: "game" | "pack"; img: string | null }>();
    games.forEach(g => map.set(g.id, { title: g.title, type: "game", img: g.image_url }));
    packs.forEach(p => map.set(p.id, { title: p.title, type: "pack", img: p.image_url }));
    return map;
  }, [games, packs]);

  // Top Juegos Más Vistos
  const topItems = useMemo(() => {
    const counts = new Map<string, number>();
    views.forEach(v => {
      if (v.item_id) {
        counts.set(v.item_id, (counts.get(v.item_id) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([id, viewsCount]) => ({
        id,
        viewsCount,
        info: itemsMap.get(id) || { title: "Juego Eliminado/Desconocido", type: "game", img: null }
      }))
      .sort((a, b) => b.viewsCount - a.viewsCount)
      .slice(0, 10);
  }, [views, itemsMap]);

  // Fuentes de Tráfico
  const trafficSources = useMemo(() => {
    const sources = new Map<string, number>();
    views.forEach(v => {
      const src = v.source || "directo";
      sources.set(src, (sources.get(src) || 0) + 1);
    });

    return Array.from(sources.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }, [views]);

  // Visitas por día (últimos 14 días)
  const dailyVisits = useMemo(() => {
    const counts = new Map<string, number>();
    const now = new Date();
    
    // Inicializar últimos 14 días en 0 con formato YYYY-MM-DD local
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      counts.set(`${y}-${m}-${day}`, 0);
    }

    views.forEach(v => {
      const d = new Date(v.created_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      
      if (counts.has(dateStr)) {
        counts.set(dateStr, counts.get(dateStr)! + 1);
      }
    });

    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }, [views]);

  const maxDailyVisits = Math.max(...dailyVisits.map(d => d.count), 1);

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-20 pt-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-black uppercase tracking-widest text-pink-400 flex items-center gap-2">
          <LineChart className="text-pink-400" /> Analíticas e Insights
        </h1>
        {totalUsers !== null && (
          <button 
            onClick={handleOpenUsers}
            className="flex items-center gap-3 bg-pink-500/10 border border-pink-500/20 px-5 py-2.5 rounded-2xl shadow-inner hover:bg-pink-500/20 transition-colors text-left"
          >
            <div className="bg-pink-500/20 p-1.5 rounded-xl shrink-0">
              <UserPlus size={18} className="text-pink-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500">Cuentas Creadas</p>
              <p className="text-xl font-black text-white leading-none">{totalUsers}</p>
            </div>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* GRAFICO DE TRÁFICO */}
        <div className="md:col-span-2 premium-control rounded-2xl p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
            <Users size={16} /> Visitas Últimos 14 Días
          </h2>
          
          <div className="h-48 flex items-end justify-between gap-1 sm:gap-2 mt-4">
            {dailyVisits.map((day, i) => {
              const heightPct = (day.count / maxDailyVisits) * 100;
              return (
                <div key={day.date} className="w-full flex flex-col items-center group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 bg-black border border-white/10 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {day.date}: {day.count} visitas
                  </div>
                  <div 
                    className="w-full bg-pink-500/20 rounded-t-sm hover:bg-pink-400 transition-colors"
                    style={{ height: `${heightPct}%`, minHeight: '4px' }}
                  />
                  <span className="text-[8px] sm:text-[10px] text-gray-500 mt-2 block w-full text-center truncate">
                    {day.date.split('-')[2]}/{day.date.split('-')[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* FUENTES DE TRÁFICO */}
        <div className="premium-control rounded-2xl p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
            <TrendingUp size={16} /> Fuentes de Tráfico
          </h2>
          <div className="space-y-4">
            {trafficSources.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos de tráfico aún.</p>
            ) : (
              trafficSources.map((ts, i) => {
                const total = views.length || 1;
                const pct = Math.round((ts.count / total) * 100);
                return (
                  <div key={ts.source}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-gray-300 capitalize">{ts.source}</span>
                      <span className="text-[10px] font-black text-gray-500">{pct}% ({ts.count})</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* TOP JUEGOS MÁS VISTOS */}
      <div className="premium-control rounded-2xl p-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
          <MousePointerClick size={16} /> Productos Más Vistos (Interés)
        </h2>
        
        {topItems.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No hay datos de visitas suficientes.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-xl hover:bg-white/[0.05] transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-pink-500/10 text-pink-400 text-[10px] font-black px-2 py-1 rounded-bl-lg">
                  #{index + 1}
                </div>
                {item.info.img ? (
                  <div className="w-12 h-12 relative rounded-md overflow-hidden shrink-0">
                    <Image src={item.info.img} alt={item.info.title} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-white/10 rounded-md flex items-center justify-center shrink-0">
                    <Gamepad2 size={20} className="text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-white line-clamp-1 pr-6">{item.info.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.viewsCount} vistas</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
