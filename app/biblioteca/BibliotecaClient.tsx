"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Order } from "@/app/admin/_types";
import { Gamepad2, LogOut, Clock, Play, Calendar, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";

type Props = {
  initialOrders: Order[];
  userEmail: string;
};

export default function BibliotecaClient({ initialOrders, userEmail }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [schedulingOrder, setSchedulingOrder] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showConsoleAlert, setShowConsoleAlert] = useState<string | null>(null);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  };

  const handleSchedule = async (orderId: string) => {
    if (!scheduleDate || !scheduleTime || !supabase) return;
    
    // Convert to ISO string
    const dateObj = new Date(`${scheduleDate}T${scheduleTime}`);
    const scheduled_at = dateObj.toISOString();

    const { error } = await supabase
      .from("orders")
      .update({ scheduled_at })
      .eq("id", orderId);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, scheduled_at } : o));
      setSchedulingOrder(null);
    } else {
      alert("Error al programar la entrega.");
    }
  };

  // Validación de horario: 13:00 a 23:59
  const isInstallTimeValid = () => {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 13 && hours <= 23;
  };

  const pendingOrders = orders.filter(o => o.status !== "completed" && o.status !== "draft");
  const completedOrders = orders.filter(o => o.status === "completed");

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString("es-CL", { 
      day: "2-digit", month: "2-digit", year: "numeric", 
      hour: "2-digit", minute: "2-digit" 
    });
  };

  return (
    <div className="min-h-screen bg-[#090b0d] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#090b0d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <Gamepad2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">Mi Biblioteca</h1>
              <p className="text-[10px] text-gray-400">{userEmail}</p>
            </div>
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        
        {/* Entregas Pendientes */}
        <section className="mb-12">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
              <Clock size={16} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest">Entregas Pendientes</h2>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-gray-500">
              No tienes entregas pendientes.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingOrders.map(order => (
                <div key={order.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6 shadow-xl">
                  
                  {order.scheduled_at && (
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                      <Calendar size={12} />
                      Programado para: {formatDate(order.scheduled_at)}
                    </div>
                  )}

                  <h3 className="text-lg font-bold">{order.game_name}</h3>
                  <p className="mt-1 text-xs text-gray-400">Orden: {order.short_code}</p>

                  <div className="mt-6 flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        if (!isInstallTimeValid()) {
                          alert("El horario de instalación es de 13:00 a 23:59. Por favor, vuelve más tarde o programa tu entrega.");
                          return;
                        }
                        setShowConsoleAlert(order.short_code);
                      }}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all ${
                        isInstallTimeValid() 
                          ? "bg-white text-black hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)]" 
                          : "bg-white/10 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      <Play size={14} /> Instalar Ahora
                    </button>

                    {schedulingOrder !== order.id ? (
                      <button 
                        onClick={() => setSchedulingOrder(order.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 py-3 text-xs font-bold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <Calendar size={14} /> Programar Instalación
                      </button>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <label className="block mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Selecciona fecha y hora:</label>
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={scheduleDate} 
                            onChange={e => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none"
                          />
                          <input 
                            type="time" 
                            value={scheduleTime} 
                            onChange={e => setScheduleTime(e.target.value)}
                            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none"
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button 
                            onClick={() => setSchedulingOrder(null)}
                            className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-bold text-gray-400 hover:bg-white/20"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleSchedule(order.id)}
                            className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial (Juegos Instalados) */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
              <CheckCircle2 size={16} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest">Juegos Instalados</h2>
          </div>

          {completedOrders.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-gray-500">
              Aún no tienes juegos en tu historial.
            </div>
          ) : (
            <div className="grid gap-3">
              {completedOrders.map(order => (
                <Link 
                  key={order.id} 
                  href={`/entrega/${order.short_code}`}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-6 py-4 transition-all hover:bg-white/5 hover:border-white/10 group"
                >
                  <div>
                    <h3 className="font-bold">{order.game_name}</h3>
                    <p className="text-xs text-gray-500">Entregado el {formatDate(order.completed_at || order.created_at)}</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal de Alerta Consola */}
      <AnimatePresence>
        {showConsoleAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowConsoleAlert(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0f1217] p-8 shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20">
                <AlertCircle size={32} className="text-orange-500" />
              </div>
              <h3 className="mb-2 text-center text-xl font-black uppercase tracking-widest">¡Atención!</h3>
              <p className="text-center text-sm text-gray-400">
                Recuerda que debes tener tu <strong className="text-white">consola Nintendo Switch encendida y en tus manos</strong> antes de continuar con la instalación.
              </p>
              
              <div className="mt-8 flex flex-col gap-3">
                <Link 
                  href={`/entrega/${showConsoleAlert}`}
                  className="flex w-full items-center justify-center rounded-xl bg-orange-500 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)]"
                >
                  La tengo en mis manos
                </Link>
                <button 
                  onClick={() => setShowConsoleAlert(null)}
                  className="w-full rounded-xl border border-white/10 py-3.5 text-xs font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Aún no
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
