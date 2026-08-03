"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Order } from "@/app/admin/_types";
import { Clock, Play, Calendar, AlertCircle, ArrowRight, ArrowLeft, CheckCircle2, Loader2, LogOut, ShieldCheck, Settings, Star, LifeBuoy, Send, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import OnboardingForm from "./OnboardingForm";
import ProfileSettingsModal from "./ProfileSettingsModal";

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  alias: string | null;
  birth_date: string | null;
  points: number;
}

interface EmbeddedLibraryProps {
  user: any;
  onLogout: () => void;
  onSettingsChange?: (isOpen: boolean) => void;
}

export default function EmbeddedLibrary({ user, onLogout, onSettingsChange }: EmbeddedLibraryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedulingOrder, setSchedulingOrder] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showConsoleAlert, setShowConsoleAlert] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRewardsSoon, setShowRewardsSoon] = useState(false);
  const [activeView, setActiveView] = useState<'profile' | 'settings' | 'entregas' | 'historial' | 'soporte'>('profile');
  const [isAdmin, setIsAdmin] = useState(false);

  const [supportMessage, setSupportMessage] = useState("");
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  useEffect(() => {
    onSettingsChange?.(activeView !== 'profile');
  }, [activeView, onSettingsChange]);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id || !supabase) return;
      
      const [ordersRes, profileRes, adminRes] = await Promise.all([
        supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle()
      ]);

      if (!ordersRes.error && ordersRes.data) {
        setOrders(ordersRes.data as Order[]);
      }
      
      if (!profileRes.error && profileRes.data) {
        setProfile(profileRes.data as UserProfile);
      }
      
      if (adminRes.data || (user.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL)) {
        setIsAdmin(true);
      }

      setLoading(false);
    }
    fetchData();
  }, [user]);

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

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim() || !supabase) return;
    
    setIsSubmittingSupport(true);
    const { error } = await supabase.from("support_requests").insert({
      name: profile?.alias || user.email.split("@")[0],
      contact: user.email,
      message: supportMessage.trim(),
      status: "nueva"
    });
    
    setIsSubmittingSupport(false);
    if (error) {
      alert("Error al enviar el mensaje.");
    } else {
      setSupportSent(true);
      setSupportMessage("");
      setTimeout(() => setSupportSent(false), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full py-20 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-500" />
      </div>
    );
  }

  const needsOnboarding = !profile || !profile.first_name || !profile.alias;

  if (needsOnboarding) {
    return <OnboardingForm user={user} onComplete={setProfile} />;
  }

  return (
    <div className="w-full text-left relative min-h-[400px]">
      <AnimatePresence mode="wait">
        {activeView === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full relative mt-4"
          >
            <ProfileSettingsModal 
              user={user} 
              profile={profile!} 
              onClose={() => setActiveView('profile')} 
              onUpdate={setProfile}
              onLogout={onLogout}
            />
          </motion.div>
        )}

        {activeView === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full flex flex-col"
          >
            <div className="relative mb-8 w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-900/40 to-purple-900/20 p-5 shadow-2xl">
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <button 
                  onClick={() => setShowLogoutConfirm(true)}
                  className="rounded-full bg-red-500/10 p-2 text-red-400 backdrop-blur-md transition-colors hover:bg-red-500/20 hover:text-red-300"
                  aria-label="Cerrar Sesión"
                >
                  <LogOut size={18} />
                </button>
                <button 
                  onClick={() => setActiveView('settings')}
                  className="rounded-full bg-white/5 p-2 text-white/50 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Configuración"
                >
                  <Settings size={18} />
                </button>
              </div>
              
              <div className="flex items-center gap-4 pr-16 mt-2">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#120a0a]">
                    <span className="text-lg font-black text-white">{profile?.alias?.[0]?.toUpperCase() || profile?.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-start justify-center text-left">
                  <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-blue-300">Bienvenido</p>
                  <h2 className="text-xl font-black text-white leading-none truncate max-w-[150px]">{profile?.alias || profile?.first_name || user.email.split('@')[0]}</h2>
                </div>
              </div>
            </div>

            {/* Banner de Puntos Alfeicon */}
            <div className="relative mb-8 flex w-full items-center justify-between overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 p-5 shadow-[0_0_30px_-5px_rgba(245,158,11,0.2)]">
              {/* Brillos decorativos */}
              <div className="absolute -left-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-amber-500/20 blur-2xl" />
              <div className="absolute -right-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-amber-500/20 blur-2xl" />
              
              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-600 shadow-lg">
                  <Star size={24} className="text-white fill-white" />
                </div>
                <div className="text-left">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-amber-500">Alfeicon Rewards</p>
                  <h3 className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 leading-none">
                    {profile?.points || 0} PTS
                  </h3>
                </div>
              </div>
              
              <div className="relative">
                 <button 
                   onClick={() => setShowRewardsSoon(true)}
                   className="rounded-full border border-amber-500/50 bg-amber-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-400 backdrop-blur-sm transition-colors hover:bg-amber-500/30 shadow-[0_0_15px_-5px_rgba(245,158,11,0.4)]"
                 >
                   Usar
                 </button>
              </div>
            </div>
              
            {isAdmin && (
              <Link 
                href="/admin"
                className="group relative mx-auto mb-8 flex w-full items-center justify-between overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 p-5 shadow-[0_0_30px_-5px_rgba(59,130,246,0.4)] transition-all hover:scale-[1.02] active:scale-95 border border-white/10"
              >
                <div className="absolute -left-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/20 blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner">
                    <ShieldCheck size={24} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-blue-200">Acceso Exclusivo</p>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white leading-tight">Panel de<br/>Administración</h3>
                  </div>
                </div>
                <ArrowRight size={20} className="relative z-10 text-white/50 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </Link>
            )}

            <div className="w-full rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex flex-col mb-12">
               <button 
                 onClick={() => setActiveView('entregas')} 
                 className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-white/10 border-b border-white/5 group"
               >
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500 group-hover:scale-105 transition-transform">
                    <Clock size={20} />
                 </div>
                 <span className="flex-1 text-left text-sm font-bold text-white">Entregas Reprogramadas</span>
                 <ArrowRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
               </button>

               <button 
                 onClick={() => setActiveView('historial')} 
                 className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-white/10 border-b border-white/5 group"
               >
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-green-500 group-hover:scale-105 transition-transform">
                    <CheckCircle2 size={20} />
                 </div>
                 <span className="flex-1 text-left text-sm font-bold text-white">Historial de Compras</span>
                 <ArrowRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
               </button>

               <button 
                 onClick={() => setActiveView('soporte')} 
                 className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-white/10 group"
               >
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-500 group-hover:scale-105 transition-transform">
                    <LifeBuoy size={20} />
                 </div>
                 <span className="flex-1 text-left text-sm font-bold text-white">Soporte y Ayuda</span>
                 <ArrowRight size={18} className="text-gray-500 group-hover:text-white transition-colors" />
               </button>
            </div>
            <p className="text-center text-xs font-bold text-white/30 uppercase tracking-widest mt-auto">Alfeicon Games © 2026</p>
          </motion.div>
        )}

        {activeView === 'entregas' && (
          <motion.div 
            key="entregas"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="w-full relative mt-4"
          >
            <div className="mb-6 flex items-center gap-3">
              <button onClick={() => setActiveView('profile')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-500">
                <Clock size={20} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white">Entregas</h2>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-gray-500">
                No tienes entregas pendientes.
              </div>
            ) : (
              <div className="grid gap-3">
                {pendingOrders.map(order => (
                  <div key={order.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-5 shadow-xl">
                    
                    {order.scheduled_at && (
                      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[9px] font-bold text-blue-400 uppercase tracking-widest">
                        <Calendar size={10} />
                        Programado: {formatDate(order.scheduled_at)}
                      </div>
                    )}

                    <h3 className="text-base font-bold text-white">{order.game_name}</h3>
                    <p className="mt-1 text-[10px] text-gray-400">Orden: {order.short_code}</p>

                    <div className="mt-4 flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          if (!isInstallTimeValid()) {
                            alert("El horario de instalación es de 13:00 a 23:59. Por favor, vuelve más tarde o programa tu entrega.");
                            return;
                          }
                          setShowConsoleAlert(order.short_code);
                        }}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                          isInstallTimeValid() 
                            ? "bg-white text-black hover:scale-[1.02] shadow-[0_0_15px_-5px_rgba(255,255,255,0.4)]" 
                            : "bg-white/10 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <Play size={12} /> Instalar Ahora
                      </button>

                      {schedulingOrder !== order.id ? (
                        <button 
                          onClick={() => setSchedulingOrder(order.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 py-2.5 text-[10px] font-bold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Calendar size={12} /> Programar
                        </button>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                          <label className="block mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">Fecha y hora:</label>
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              value={scheduleDate} 
                              onChange={e => setScheduleDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs outline-none"
                            />
                            <input 
                              type="time" 
                              value={scheduleTime} 
                              onChange={e => setScheduleTime(e.target.value)}
                              className="w-full rounded-lg bg-white/10 px-2 py-1.5 text-xs outline-none"
                            />
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button 
                              onClick={() => setSchedulingOrder(null)}
                              className="flex-1 rounded-lg bg-white/10 py-1.5 text-[10px] font-bold text-gray-400 hover:bg-white/20"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => handleSchedule(order.id)}
                              className="flex-1 rounded-lg bg-blue-600 py-1.5 text-[10px] font-bold text-white hover:bg-blue-500"
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
          </motion.div>
        )}

        {activeView === 'historial' && (
          <motion.div 
            key="historial"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full relative mt-4"
          >
            <div className="mb-6 flex items-center gap-3">
              <button onClick={() => setActiveView('profile')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-green-500">
                <CheckCircle2 size={20} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white">Historial</h2>
            </div>

            {completedOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-xs text-gray-500">
                Aún no tienes historial de compras.
              </div>
            ) : (
              <div className="grid gap-3">
                {completedOrders.map(order => (
                  <Link 
                    key={order.id} 
                    href={`/entrega/${order.short_code}`}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-all hover:bg-white/5 hover:border-white/10 group"
                  >
                      <div>
                        <h3 className="text-sm font-bold text-white">{order.game_name}</h3>
                        <p className="text-[10px] text-gray-500">Completado: {formatDate(order.completed_at || order.created_at)}</p>
                      </div>
                      <ArrowRight size={14} className="text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </Link>
                  ))}
                </div>
              )}
          </motion.div>
        )}

        {activeView === 'soporte' && (
          <motion.div 
            key="soporte"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
          >
            <div className="mb-8 flex items-center gap-4">
              <button 
                onClick={() => setActiveView('profile')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-black uppercase tracking-widest">Soporte</h2>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <p className="mb-6 text-sm text-gray-400 text-left">
                ¿Tienes algún problema con un juego o una consulta general? Escríbenos y te responderemos a tu correo (<strong className="text-white">{user.email}</strong>).
              </p>

              {supportSent ? (
                <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400 text-left">
                  <CheckCircle2 size={20} />
                  <div>
                    <p className="text-sm font-bold">¡Mensaje enviado!</p>
                    <p className="text-xs">Te responderemos pronto a tu correo.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="flex flex-col gap-4">
                  <textarea 
                    value={supportMessage}
                    onChange={e => setSupportMessage(e.target.value)}
                    placeholder="Explícanos tu problema o duda aquí..."
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    required
                  />
                  <button 
                    type="submit" 
                    disabled={isSubmittingSupport || !supportMessage.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                  >
                    {isSubmittingSupport ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Enviar Mensaje
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <h3 className="mb-2 text-center text-xl font-black uppercase tracking-widest text-white">¡Atención!</h3>
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

      {/* Modal Confirmación Cerrar Sesión */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0f1217] p-8 shadow-2xl"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <LogOut size={32} className="text-red-500" />
              </div>
              <h3 className="mb-2 text-center text-xl font-black uppercase tracking-widest text-white">¿Cerrar Sesión?</h3>
              <p className="text-center text-sm text-gray-400 mb-8">
                ¿Estás seguro de que deseas salir de tu cuenta?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-xl bg-white/10 py-3.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={onLogout}
                  className="flex-1 rounded-xl bg-red-600 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-transform hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(220,38,38,0.4)]"
                >
                  Sí, Salir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Próximamente Rewards */}
      <AnimatePresence>
        {showRewardsSoon && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowRewardsSoon(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-500/30 bg-[#0f1217] p-8 shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)] text-center"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-yellow-600 shadow-lg">
                <Star size={40} className="text-white fill-white" />
              </div>
              <h3 className="mb-2 text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">Próximamente</h3>
              <p className="text-sm text-gray-400 mb-8">
                Estamos preparando el catálogo de recompensas de Alfeicon. ¡Sigue acumulando puntos para canjearlos pronto por juegos y descuentos exclusivos!
              </p>
              
              <button 
                onClick={() => setShowRewardsSoon(false)}
                className="w-full rounded-xl bg-white/10 py-3.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
