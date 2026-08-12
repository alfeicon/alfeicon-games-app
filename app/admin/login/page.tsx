"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ShieldCheck, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const router = useRouter();

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setAuthError("");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("auth-timeout")), 12_000);
        }),
      ]);

      if (error) {
        setAuthError("Login inválido o usuario sin acceso.");
        return;
      }

      window.location.href = "/admin";
    } catch {
      setAuthError("No se pudo conectar con Supabase. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  if (!supabase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#090b0d] p-8 text-center">
        <ShieldCheck size={36} className="text-gray-700" />
        <p className="text-lg font-black uppercase tracking-widest text-white">Panel no disponible</p>
        <p className="max-w-xs text-sm text-gray-600">Supabase no está configurado en este entorno.</p>
        <Link href="/" className="mt-2 text-xs font-black text-gray-600 hover:text-white transition-colors">← Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#090b0d] p-6 text-white">
      {/* Background Dots */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      {/* Dynamic Ambient Glows */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.05, 0.03] }} 
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 blur-[120px]" 
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.02, 0.04, 0.02] }} 
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="pointer-events-none absolute bottom-0 right-1/4 h-[25rem] w-[25rem] rounded-full bg-purple-500 blur-[100px]" 
      />

      <motion.div 
        initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="liquid-glass relative z-10 w-full max-w-sm rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-8 shadow-2xl backdrop-blur-3xl"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
          className="mb-10 text-center flex flex-col items-center"
        >
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Acceso Admin</h1>
          <p className="mt-1.5 text-xs font-bold tracking-widest uppercase text-gray-500">Panel de gestión Alfeicon</p>
        </motion.div>

        <form onSubmit={signIn} className="space-y-4">
          <motion.label 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="block"
          >
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-2xl border border-white/5 bg-black/20 px-4 py-4 text-sm text-white outline-none transition-all hover:bg-black/30 focus:border-white/20 focus:bg-black/40 focus:ring-4 focus:ring-white/5 shadow-inner" 
            />
          </motion.label>

          <motion.label 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="block"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Contraseña</span>
              {capsOn && (
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-yellow-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" /> Bloq Mayús
                </span>
              )}
            </div>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => setCapsOn(e.getModifierState("CapsLock"))}
                onKeyUp={e => setCapsOn(e.getModifierState("CapsLock"))}
                required
                className="w-full rounded-2xl border border-white/5 bg-black/20 py-4 pl-4 pr-12 text-sm text-white outline-none transition-all hover:bg-black/30 focus:border-white/20 focus:bg-black/40 focus:ring-4 focus:ring-white/5 shadow-inner" 
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </motion.label>

          {authError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"
            >
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <p className="text-xs font-semibold text-red-300">{authError}</p>
            </motion.div>
          )}

          <motion.button 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            type="submit" disabled={loading}
            className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white py-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-70 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            {loading ? <Loader2 size={16} className="animate-spin text-black" /> : (
              <>
                <span className="text-[11px] font-black uppercase tracking-widest text-black">Entrar al panel</span>
                <ArrowRight size={14} className="text-black transition-transform group-hover:translate-x-1" />
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent opacity-0 transition-all duration-700 ease-in-out group-hover:translate-x-full group-hover:opacity-100" />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="relative z-10 mt-8"
      >
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-gray-500 transition-colors hover:text-white group">
          <ArrowRight size={12} className="rotate-180 transition-transform group-hover:-translate-x-1" /> Volver a la tienda
        </Link>
      </motion.div>
    </div>
  );
}
