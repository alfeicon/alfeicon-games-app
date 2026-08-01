"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { Mail, Lock, Loader2, AlertCircle, CheckCircle2, UserPlus, LogIn, X, Eye, EyeOff, Sparkles, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useScrollLock } from "@/lib/useScrollLock";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  useScrollLock(true);
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");
    setAuthSuccess("");

    if (isLogin) {
      const { error, data } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      } else if (data?.user) {
        onSuccess(data.user);
      }
    } else {
      if (password !== confirmPassword) {
        setAuthError("Las contraseñas no coinciden.");
        setLoading(false);
        return;
      }
      
      const { error, data } = await supabase!.auth.signUp({ 
        email, 
        password
      });
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      } else {
        if (data.user?.identities?.length === 0) {
          setAuthError("El usuario ya existe. Por favor, inicia sesión.");
        } else {
          setAuthSuccess("¡Cuenta creada! Se ha iniciado sesión automáticamente.");
          setTimeout(() => {
            onSuccess(data.user);
          }, 1500);
        }
      }
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setAuthError("");
    setAuthSuccess("");
    setConfirmPassword("");
    setTimeout(() => {
      emailRef.current?.focus();
    }, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ 
        background: 'rgba(0, 0, 0, 0.4)', 
        backdropFilter: 'blur(18px) saturate(115%)', 
        WebkitBackdropFilter: 'blur(18px) saturate(115%)' 
      }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 80, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', damping: 26, stiffness: 340 } }}
        exit={{ y: 90, scale: 0.9, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
        className="catalog-detail-panel catalog-detail-panel--scroll"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header estético */}
        <div className="cdm-header flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
              <Sparkles size={14} />
            </span>
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
              Alfeicon Games
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="motion-press flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Contenido principal del login */}
        <div className="relative z-10 px-6 pb-6 pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login-title" : "register-title"}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="mb-6 flex flex-col items-center text-center"
            >
              <h2 className="text-2xl font-black uppercase tracking-widest text-white">
                {isLogin ? "Inicia Sesión" : "Crea tu Cuenta"}
              </h2>
              <p className="mt-2 text-xs text-gray-400">
                {isLogin 
                  ? "Ingresa tus credenciales para continuar." 
                  : "Únete para acumular puntos."}
              </p>
            </motion.div>
          </AnimatePresence>

          <form onSubmit={handleAuth} className="flex flex-col gap-3">
            <label className="block">
              <div className={`relative flex items-center overflow-hidden rounded-2xl border transition-all duration-300 ${focusedInput === 'email' ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-white/10 bg-black/30 hover:border-white/20'}`}>
                <div className={`pl-4 transition-colors ${focusedInput === 'email' ? 'text-blue-400' : 'text-gray-500'}`}>
                  <Mail size={18} />
                </div>
                <input 
                  ref={emailRef}
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  required
                  placeholder="Correo Electrónico"
                  className="w-full bg-transparent py-4 pl-3 pr-4 text-sm text-white outline-none placeholder:text-gray-500" 
                />
              </div>
            </label>

            <label className="block">
              <div className={`relative flex items-center overflow-hidden rounded-2xl border transition-all duration-300 ${focusedInput === 'password' ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'border-white/10 bg-black/30 hover:border-white/20'}`}>
                <div className={`pl-4 transition-colors ${focusedInput === 'password' ? 'text-blue-400' : 'text-gray-500'}`}>
                  <Lock size={18} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  onKeyUp={e => setCapsOn(e.getModifierState("CapsLock"))}
                  required minLength={6}
                  placeholder="Contraseña"
                  className="w-full bg-transparent py-4 pl-3 pr-12 text-sm text-white outline-none placeholder:text-gray-500" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {capsOn && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[10px] font-bold text-red-400 uppercase tracking-widest text-center">
                  Bloq Mayús Activado
                </motion.p>
              )}
            </label>

            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.label 
                  initial={{ opacity: 0, height: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, height: "auto", scale: 1 }} 
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="block overflow-hidden"
                >
                  <div className={`relative flex items-center overflow-hidden rounded-2xl border transition-all duration-300 mt-1 ${focusedInput === 'confirm' ? 'border-purple-500 bg-purple-500/5 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/10 bg-black/30 hover:border-white/20'}`}>
                    <div className={`pl-4 transition-colors ${focusedInput === 'confirm' ? 'text-purple-400' : 'text-gray-500'}`}>
                      <Lock size={18} />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedInput('confirm')}
                      onBlur={() => setFocusedInput(null)}
                      required={!isLogin}
                      minLength={6}
                      placeholder="Confirmar Contraseña"
                      className="w-full bg-transparent py-4 pl-3 pr-4 text-sm text-white outline-none placeholder:text-gray-500" 
                    />
                  </div>
                </motion.label>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {authError && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-2 flex items-center justify-center text-center gap-2 rounded-xl bg-red-500/10 p-3 border border-red-500/20"
                >
                  <AlertCircle size={18} className="shrink-0 text-red-400" />
                  <p className="text-xs text-red-200 leading-relaxed">{authError}</p>
                </motion.div>
              )}
              {authSuccess && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-2 flex items-center justify-center text-center gap-2 rounded-xl bg-green-500/10 p-3 border border-green-500/20"
                >
                  <CheckCircle2 size={18} className="shrink-0 text-green-400" />
                  <p className="text-xs text-green-200 leading-relaxed">{authSuccess}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {isLogin && (
              <div className="flex justify-center px-1">
                <button type="button" className="text-[11px] font-bold text-gray-500 hover:text-white transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white py-4 transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-70 h-[52px]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin text-black" />
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    <motion.span 
                      key={isLogin ? "login-btn" : "register-btn"}
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-[11px] font-black uppercase tracking-widest text-black absolute"
                    >
                      {isLogin ? "Entrar" : "Crear Cuenta"}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-[11px] font-black uppercase tracking-widest text-transparent pointer-events-none">Crear Cuenta</span>
                  <ArrowRight size={14} className="text-black transition-transform group-hover:translate-x-1" />
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent opacity-0 transition-all duration-700 ease-in-out group-hover:translate-x-full group-hover:opacity-100" />
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">O ingresa con</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase!.auth.signInWithOAuth({ 
                  provider: 'google',
                  options: {
                    redirectTo: window.location.origin
                  }
                });
              }}
              className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95 h-[52px]"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Google</span>
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center border-t border-white/5 pt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {isLogin ? "¿Aún no eres miembro?" : "¿Ya eres miembro?"}
            </p>
            <button 
              type="button"
              onClick={switchMode}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-6 py-3 text-xs font-bold text-white transition-colors hover:bg-white/10 active:scale-95"
            >
              {isLogin ? "Registrarme Ahora" : "Iniciar Sesión"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
