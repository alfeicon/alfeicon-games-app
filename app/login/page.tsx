"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Gamepad2, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, UserPlus, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setAuthError("");
    setAuthSuccess("");

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message === "Invalid login credentials" ? "Credenciales inválidas." : error.message);
        setLoading(false);
      } else {
        router.push("/biblioteca");
      }
    } else {
      if (password !== confirmPassword) {
        setAuthError("Las contraseñas no coinciden.");
        setLoading(false);
        return;
      }
      
      const { error, data } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      setLoading(false);
      if (error) {
        setAuthError(error.message);
      } else {
        if (data?.session) {
          router.push("/biblioteca");
        } else {
          setAuthSuccess("Revisa tu correo para confirmar tu cuenta.");
        }
      }
    }
  };

  if (!supabase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#090b0d] p-8 text-center">
        <Gamepad2 size={36} className="text-gray-700" />
        <p className="text-lg font-black uppercase tracking-widest text-white">Servicio no disponible</p>
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
            <Gamepad2 size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </h1>
          <p className="mt-1.5 text-xs font-bold tracking-widest uppercase text-gray-500">
            {isLogin ? "Accede a tu biblioteca de juegos" : "Únete para beneficios exclusivos"}
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                minLength={6}
                className="w-full rounded-2xl border border-white/5 bg-black/20 py-4 pl-4 pr-12 text-sm text-white outline-none transition-all hover:bg-black/30 focus:border-white/20 focus:bg-black/40 focus:ring-4 focus:ring-white/5 shadow-inner" 
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </motion.label>

          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.label 
                initial={{ opacity: 0, height: 0, scale: 0.95 }} 
                animate={{ opacity: 1, height: "auto", scale: 1 }} 
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="block overflow-hidden"
              >
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Confirmar Contraseña</span>
                <div className="relative mb-1">
                  <input type={showPassword ? "text" : "password"} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                    minLength={6}
                    className="w-full rounded-2xl border border-white/5 bg-black/20 py-4 pl-4 pr-12 text-sm text-white outline-none transition-all hover:bg-black/30 focus:border-white/20 focus:bg-black/40 focus:ring-4 focus:ring-white/5 shadow-inner" 
                  />
                </div>
              </motion.label>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {authError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"
              >
                <AlertCircle size={14} className="shrink-0 text-red-400" />
                <p className="text-xs font-semibold text-red-300">{authError}</p>
              </motion.div>
            )}
            {authSuccess && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3"
              >
                <AlertCircle size={14} className="shrink-0 text-green-400" />
                <p className="text-xs font-semibold text-green-300">{authSuccess}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            type="submit" disabled={loading}
            className="group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white py-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-70 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            {loading ? <Loader2 size={16} className="animate-spin text-black" /> : (
              <>
                <AnimatePresence mode="popLayout">
                  <motion.span 
                    key={isLogin ? "login" : "register"}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[11px] font-black uppercase tracking-widest text-black absolute"
                  >
                    {isLogin ? "Entrar" : "Crear Cuenta"}
                  </motion.span>
                </AnimatePresence>
                {/* Spacer invisible para mantener el alto del botón fijo durante la animación absoluta */}
                <span className="text-[11px] font-black uppercase tracking-widest text-transparent pointer-events-none">Crear Cuenta</span>
                
                {isLogin ? (
                  <LogIn size={14} className="text-black transition-transform group-hover:translate-x-1" />
                ) : (
                  <UserPlus size={14} className="text-black transition-transform group-hover:translate-x-1" />
                )}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent opacity-0 transition-all duration-700 ease-in-out group-hover:translate-x-full group-hover:opacity-100" />
              </>
            )}
          </motion.button>
        </form>

        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-6 text-center"
        >
          <button 
            type="button" 
            onClick={() => {
              setIsLogin(!isLogin);
              setAuthError("");
              setAuthSuccess("");
              setConfirmPassword("");
            }}
            className="text-xs font-bold text-gray-500 hover:text-white transition-colors overflow-hidden flex flex-col h-[20px]"
          >
            <AnimatePresence mode="popLayout">
              <motion.span
                key={isLogin ? "to-register" : "to-login"}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
              </motion.span>
            </AnimatePresence>
          </button>
        </motion.div>
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
