"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { ArrowRight, ArrowLeft, Smartphone, Maximize, X, CheckCircle2, Copy, Gamepad2, Loader2, PackageCheck, MonitorSmartphone, KeyRound, Check, AlertCircle, Hash, Camera, LifeBuoy, BellRing } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { playNotificationSound, playSuccessSound, playErrorSound } from "@/lib/sounds";
import type { Order } from "../../../app/admin/_types"; // we can redefine it here to be safe

// Soporte por WhatsApp (mismo número de la tienda).
const WHATSAPP = "56926411278";

type WizardState =
  | "loading"
  | "error"
  | "select_console"
  | "tutorial"
  | "input_code"
  | "waiting_setup"
  | "credentials_ready"
  | "tutorial_download"
  | "ready"
  | "support";

export function EntregaWizard() {
  const params = useParams<{ codigo: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<WizardState>("loading");
  const [consoleType, setConsoleType] = useState<"switch1" | "switch2" | null>(null);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [downloadStep, setDownloadStep] = useState(9);
  const [inputCode, setInputCode] = useState("");
  const [codeWarning, setCodeWarning] = useState(false);
  const codeWarnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const codeSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showSupportConfirm, setShowSupportConfirm] = useState(false);
  const progressRef = useRef(0);
  const subscriptionRef = useRef<any>(null);
  const playedPreparingSound = useRef(false);
  const wakeLockRef = useRef<any>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "default">("default");

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        setNotificationStatus(Notification.permission);
      }
    } catch (e) {
      console.warn("Notifications API not fully supported:", e);
    }
  }, []);

  const requestNotifications = () => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        const handlePermission = (permission: NotificationPermission) => {
          setNotificationStatus(permission);
          if (permission === "granted") {
            try {
              new Notification("Notificaciones activadas", { 
                body: "Te avisaremos cuando haya novedades con tu orden.", 
                icon: "/logo.png", 
                badge: "/logo.png" 
              });
            } catch (e) {
              console.warn("Could not show notification:", e);
            }
          } else if (permission === "denied") {
            alert("Las notificaciones están bloqueadas. Debes activarlas desde la configuración de tu navegador.");
          }
        };

        const promise = Notification.requestPermission(handlePermission);
        if (promise && typeof promise.then === "function") {
          promise.then(handlePermission).catch(() => {});
        }
      } else {
        alert("Tu navegador (ej. iPhone/Safari) no permite notificaciones web aquí.\n\nPero no te preocupes: ¡hemos activado un sistema para mantener tu pantalla encendida mientras esperas!");
      }
    } catch (e) {
      console.warn("Error requesting notifications:", e);
    }
  };

  // Escuchar cambios de estado principales para sonidos
  useEffect(() => {
    if (state === "credentials_ready") {
      playSuccessSound();
    } else if (state === "support") {
      playErrorSound();
    }
  }, [state]);

  // Sonido de alerta al llegar al paso 8 del tutorial (donde el código aparece
  // en la consola) para reforzar que ingrese y envíe el código.
  useEffect(() => {
    if (state === "tutorial" && tutorialStep === 8) {
      playNotificationSound();
    }
  }, [state, tutorialStep]);

  // Mantener la pantalla encendida (Wake Lock) durante la espera
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && state === "waiting_setup") {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err: any) {
        console.warn(`Wake lock error: ${err.name}, ${err.message}`);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && state === "waiting_setup") {
        requestWakeLock();
      }
    };

    if (state === "waiting_setup") {
      requestWakeLock();
      document.addEventListener("visibilitychange", handleVisibilityChange);
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [state]);

  // Progreso simulado para waiting_setup (lento)
  useEffect(() => {
    let interval: any;
    if (state === "waiting_setup") {
      if (order?.status === "preparing" && progressRef.current < 85) {
        progressRef.current = 85;
        setProgress(85);
      }
      
      interval = setInterval(() => {
        if (order?.status === "preparing" && progressRef.current < 85) {
          progressRef.current = 85;
        }

        if (progressRef.current < 40) progressRef.current += 0.5; // Rápido hasta el 40%
        else if (progressRef.current < 75) progressRef.current += 0.1; // Lento hasta el 75% (~6 minutos)
        else if (progressRef.current < 85 && order?.status !== "preparing") progressRef.current += 0.05; // Muy lento hasta el 85%
        else if (progressRef.current < 99) progressRef.current += 0.01; // Casi estático hasta el 99%
        
        const currentProgress = Math.floor(progressRef.current);
        setProgress(currentProgress);

        // Sonido de alerta cuando llega al 85% o preparing
        if ((order?.status === "preparing" || currentProgress >= 85) && !playedPreparingSound.current) {
          playNotificationSound();
          playedPreparingSound.current = true;
          if (!notifiedRef.current.has("85")) {
             notifiedRef.current.add("85");
             notifyClient("¡Estamos por terminar! ⏳", "El proceso va en un 85%, prepárate para recibir tus credenciales.");
          }
        }

      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state, order?.status]);

  useEffect(() => {
    if (!params.codigo) return;
    loadOrder();

    return () => {
      if (subscriptionRef.current) {
        supabase?.removeChannel(subscriptionRef.current);
      }
      if (codeWarnTimer.current) clearTimeout(codeWarnTimer.current);
      if (codeSentTimer.current) clearTimeout(codeSentTimer.current);
    };
  }, [params.codigo]);

  const loadOrder = async () => {
    if (!supabase) {
      console.error("[entrega] supabase es null — faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY en este build. Se queda en 'buscando'.");
      return;
    }
    // El código va en la URL: normalizamos (trim + mayúsculas) para evitar
    // fallos por espacios o minúsculas al copiar/pegar el enlace.
    const code = (params.codigo || "").trim().toUpperCase();
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("short_code", code)
        .maybeSingle();

      if (error) {
        // Error real (RLS, red, etc.) — distinto de "no existe".
        console.error("[entrega] error al buscar la orden", code, error);
        setState("error");
        return;
      }
      if (!data) {
        console.warn("[entrega] no existe ninguna orden con código:", code);
        setState("error");
        return;
      }

      setOrder(data as Order);
      determineNextState(data as Order);
      setupRealtime(data.id);
    } catch (e) {
      console.error("[entrega] excepción al cargar la orden", e);
      setState("error");
    }
  };

  const setupRealtime = (orderId: string) => {
    if (!supabase) return;
    
    // Subscribe to changes on this specific order
    subscriptionRef.current = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const updatedOrder = payload.new as Order;
          setOrder(updatedOrder);
          determineNextState(updatedOrder);

          // Avisar al cliente (notificación del navegador) cuando le enviamos
          // las credenciales (status "ready"). Una sola vez por incidente.
          if (updatedOrder.status === "ready" && !notifiedRef.current.has("ready")) {
            notifiedRef.current.add("ready");
            notifyClient(
              "¡Tus credenciales están listas! 🎮",
              "Ya puedes continuar con la instalación de tu juego en Alfeicon Games.",
            );
          }
        }
      )
      .subscribe();
  };

  // Fallback: Polling de seguridad cada 5 segundos
  // Por si el Realtime de Supabase no está activado en la tabla 'orders' o se desconecta.
  useEffect(() => {
    let pollInterval: any;
    if (["loading", "select_console", "tutorial", "input_code"].includes(state)) return; // No hacer polling si aún no envía el código
    if (["credentials_ready", "tutorial_download", "ready", "support"].includes(state)) return; // No hacer polling si ya terminó

    if (order?.id && supabase) {
      pollInterval = setInterval(async () => {
        try {
          if (!supabase) return;
          const { data, error } = await supabase.from("orders").select("*").eq("id", order.id).maybeSingle();
          if (data && !error) {
            // Si el estado o los datos clave cambiaron, actualizamos.
            if (data.status !== order.status || data.account_email !== order.account_email) {
              setOrder(data as Order);
              determineNextState(data as Order);
            }
          }
        } catch (e) {
          console.warn("Error polling order:", e);
        }
      }, 5000); // 5 segundos
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [state, order?.id, order?.status, order?.account_email]);

  const determineNextState = (o: Order) => {
    if (o.status === "completed") {
      setState("ready"); // boleta final (estado 5: entrega completa)
    } else if (o.status === "issue") {
      setState("support"); // soporte activado / problema durante la instalación
    } else if (o.status === "ready") {
      // Estado 4: credenciales entregadas → check, luego pasos de descarga.
      // Si ya está en el flujo (check / pasos / boleta), se respeta.
      setState((prev) => ["credentials_ready", "tutorial_download", "ready"].includes(prev) ? prev : "credentials_ready");
    } else if (
      o.status === "pending_setup" ||
      o.status === "preparing" ||
      o.console_code                // si ya ingresó su código, va a la pantalla de espera
    ) {
      setState("waiting_setup");
    } else {
      // pending_console_code sin código aún: elegir consola.
      // Si está a mitad del tutorial, no lo devolvemos al inicio.
      setState((prev) =>
        ["select_console", "tutorial", "input_code"].includes(prev) ? prev : "select_console",
      );
    }
  };

  // Estado 5: el cliente confirma que terminó → orden "completa" + boleta.
  const confirmCompleted = async () => {
    if (supabase && order) {
      await supabase.from("orders").update({ status: "completed" }).eq("id", order.id);
      setOrder({ ...order, status: "completed" });
      
      // Notificar por Telegram
      fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'COMPLETED', order })
      }).catch(err => console.error("Error sending notification", err));
    }
    setState("ready"); // boleta final
    
    // Animación de confeti de celebración
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#eab308', '#ffffff']
    });
  };

  // Soporte: marca la orden con problema (para que el admin lo vea) y abre WhatsApp.
  const openSupport = async () => {
    if (supabase && order) {
      await supabase.from("orders").update({ status: "issue" }).eq("id", order.id);
      setOrder({ ...order, status: "issue" });

      // Notificar por Telegram
      fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ISSUE', order })
      }).catch(err => console.error("Error sending notification", err));
    }
    const code = order?.short_code || "";
    const juego = order?.game_name ? ` (${order.game_name})` : "";
    const msg = `Hola, necesito ayuda con mi orden ${code}${juego}.`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
    setShowSupportConfirm(false);
    setState("support");
  };

  // Maneja lo que escribe/pega el cliente: deja solo letras A–Z y, si intentó
  // meter números o símbolos, muestra un aviso temporal.
  const handleCodeInput = (raw: string) => {
    const noAccents = raw.normalize("NFD").replace(/[̀-ͯ]/g, "");
    setInputCode(noAccents.toUpperCase().replace(/[^A-Z]/g, ""));

    // ¿Escribió algo que no sea letra (ni espacio)? → avisar.
    if (/[^A-Za-z\s]/.test(noAccents)) {
      setCodeWarning(true);
      if (codeWarnTimer.current) clearTimeout(codeWarnTimer.current);
      codeWarnTimer.current = setTimeout(() => setCodeWarning(false), 2800);
    }
  };

  // Muestra una notificación del navegador (si el cliente dio permiso). Sirve
  // para avisarle cuando lleguen sus credenciales aunque tenga la pestaña de
  // fondo o el teléfono bloqueado con la página abierta.
  const notifyClient = (title: string, body: string) => {
    try {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/logo.png", badge: "/logo.png" });
      }
    } catch { /* no-op */ }
  };

  const submitCode = async () => {
    // Sanitiza de nuevo por seguridad: solo 8 letras mayúsculas A–Z.
    const cleanCode = inputCode
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    if (cleanCode.length !== 8 || !order || !supabase) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from("orders")
      .update({
        console_code: cleanCode,
        status: "pending_setup"
      })
      .eq("id", order.id);

    setIsSubmitting(false);

    if (!error) {
      const updatedOrder = { ...order, console_code: cleanCode, status: "pending_setup" as const };
      setOrder(updatedOrder);

      // Confirmación visible de "código enviado" + sonido de éxito.
      setCodeSent(true);
      playSuccessSound();
      if (codeSentTimer.current) clearTimeout(codeSentTimer.current);
      codeSentTimer.current = setTimeout(() => setCodeSent(false), 3500);

      // Pedimos permiso de notificaciones AQUÍ (es un gesto del usuario) para
      // poder avisarle cuando le enviemos las credenciales.
      try {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          const promise = Notification.requestPermission((perm) => setNotificationStatus(perm));
          if (promise && typeof promise.then === "function") {
            promise.then(perm => setNotificationStatus(perm)).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("Error requesting notifications silently:", e);
      }

      setState("waiting_setup");

      // Notificar por Telegram (al admin): "tal orden envió código".
      fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CODE_SUBMITTED', order: updatedOrder })
      }).catch(err => console.error("Error sending notification", err));
    }
  };

  const copyToClipboard = (text: string, type: 'email' | 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const variants = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
    exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2 } }
  };

  // Campo de código reutilizable (input filtrado A–Z + aviso). Se usa tanto en
  // el paso 8 del tutorial como en la pantalla dedicada de ingreso de código.
  const codeField = (
    <div>
      <input
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={inputCode}
        onChange={e => handleCodeInput(e.target.value)}
        placeholder="Ej: ABCDEFGH"
        className={`w-full rounded-2xl border bg-black/50 px-4 py-5 text-center text-2xl font-black tracking-[0.2em] text-white outline-none transition-all focus:bg-white/5 placeholder:text-white/20 uppercase ${
          codeWarning ? "border-red-500/70" : "border-white/10 focus:border-yellow-500/50"
        }`}
        maxLength={8}
      />
      {codeWarning ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold text-red-400">
          <AlertCircle size={13} /> Esos caracteres no son válidos. Solo letras de la A a la Z.
        </p>
      ) : (
        <p className="mt-2 text-center text-[11px] text-gray-500">
          Solo letras (A–Z). Sin números ni símbolos.
        </p>
      )}
    </div>
  );

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-y-auto overflow-x-hidden bg-[#090b0d] p-6 text-white">
      {/* HEADER LOGO + SOPORTE */}
      <div className="flex items-center justify-between shrink-0 mb-4 mt-2 w-full">
        {/* Logo pegado a la izquierda */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shadow-lg shadow-yellow-500/10">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col">
            <p className="font-black text-xs tracking-[0.2em] text-white leading-none">ALFEICON</p>
            <p className="font-black text-[9px] tracking-[0.3em] text-yellow-500 mt-1 leading-none">GAMES</p>
          </div>
        </div>

        {/* Soporte pegado a la derecha */}
        {state !== "loading" && state !== "error" && state !== "support" && (
          <button onClick={() => setShowSupportConfirm(true)}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-[10px] font-black uppercase tracking-widest text-gray-300 shadow-lg transition-colors hover:bg-white/10 hover:text-white">
            <LifeBuoy size={14} /> Soporte
          </button>
        )}
      </div>

      {/* MODAL: confirmación de soporte */}
      {showSupportConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSupportConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c0f12] p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-500">
              <LifeBuoy size={26} />
            </div>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">¿Contactar soporte?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Esto <b className="text-white">pausará tu proceso actual</b> y te llevará a hablar con nosotros por WhatsApp. ¿Estás seguro?
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button onClick={openSupport}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-green-500 py-3.5 text-xs font-black uppercase tracking-widest text-black transition-colors hover:bg-green-400">
                <LifeBuoy size={14} /> Sí, hablar con soporte
              </button>
              <button onClick={() => setShowSupportConfirm(false)}
                className="w-full rounded-full border border-white/10 py-3.5 text-xs font-black uppercase tracking-widest text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
                No, seguir con el proceso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
            onClick={() => setFullscreenImage(null)}
          >
            <button onClick={() => setFullscreenImage(null)} className="absolute top-6 right-6 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 z-[101]">
              <X size={24} />
            </button>
            <img src={fullscreenImage} alt="Fullscreen" className="max-h-full max-w-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMACIÓN: código enviado */}
      <AnimatePresence>
        {codeSent && (
          <motion.div
            key="code-sent"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed left-1/2 top-4 z-[90] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-green-500/30 bg-[#0c1510]/95 px-4 py-3 shadow-2xl shadow-green-500/20 backdrop-blur-xl"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-black">
              <CheckCircle2 size={16} strokeWidth={3} />
            </span>
            <div className="pr-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Código enviado</p>
              <p className="text-[11px] font-bold text-white">Estamos preparando tu pedido</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* LOADING */}
        {state === "loading" && (
          <motion.div key="loading" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 items-center justify-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Loader2 className="animate-spin text-yellow-500" size={28} />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest">Buscando Orden</h1>
            <p className="mt-2 text-sm text-gray-400">Verificando tu código de entrega...</p>
          </motion.div>
        )}

        {/* ERROR */}
        {state === "error" && (
          <motion.div key="error" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 items-center justify-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
              <AlertCircle className="text-red-400" size={28} />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest">Orden no encontrada</h1>
            <p className="mt-2 text-sm text-gray-400">El código ingresado no existe o ha expirado. Por favor contacta a soporte.</p>
          </motion.div>
        )}

        {/* 1. SELECT CONSOLE */}
        {state === "select_console" && (
          <motion.div key="select" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 justify-center">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
                <Gamepad2 className="text-yellow-500" size={28} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Paso 1 de 3</p>
              <h1 className="text-2xl font-black uppercase tracking-widest">¿Qué consola tienes?</h1>
              <p className="mt-2 text-sm text-gray-400">Selecciona el modelo de tu Nintendo Switch para ver las instrucciones correctas.</p>
            </div>

            <div className="flex flex-col gap-4">
              <button onClick={() => { 
                  setConsoleType("switch1"); 
                  setState("tutorial");
                }}
                className="group flex items-center p-5 w-full rounded-2xl border border-white/10 bg-black/50 hover:bg-white/5 transition-all text-left">
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mr-4">
                  <MonitorSmartphone className="text-gray-400 group-hover:text-yellow-400 transition-colors" size={20} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">Nintendo Switch 1</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Consola principal</p>
                </div>
                <ArrowRight className="text-gray-600 group-hover:text-yellow-500 transition-transform group-hover:translate-x-1" size={16} />
              </button>

              <button onClick={() => { 
                  setConsoleType("switch2"); 
                  setState("tutorial");
                }}
                className="group flex items-center p-5 w-full rounded-2xl border border-white/10 bg-black/50 hover:bg-white/5 transition-all text-left">
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mr-4">
                  <MonitorSmartphone className="text-gray-400 group-hover:text-yellow-400 transition-colors" size={20} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">Nintendo Switch 2</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Próxima generación</p>
                </div>
                <ArrowRight className="text-gray-600 group-hover:text-yellow-500 transition-transform group-hover:translate-x-1" size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* 2. TUTORIAL PRIMERA PARTE */}
        {state === "tutorial" && (
          <motion.div key="tutorial" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 justify-center py-6">
            <div className="mb-6 landscape:mb-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Instrucciones</p>
              <h1 className="text-xl font-black uppercase tracking-widest">Paso {tutorialStep} de 18</h1>
            </div>

            <div className="mb-8 landscape:mb-2 w-full rounded-2xl border border-white/10 bg-black/50 shadow-xl overflow-hidden relative flex items-center justify-center min-h-[200px]">
              {/* Mostrar imagen según el paso */}
              <motion.img 
                key={tutorialStep}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                src={`/instrucciones_1/paso_${tutorialStep}.png`} 
                alt={`Paso ${tutorialStep}`} 
                className="w-full h-auto max-h-[50vh] landscape:max-h-[65vh] object-contain cursor-pointer" 
                onClick={() => setFullscreenImage(`/instrucciones_1/paso_${tutorialStep}.png`)} 
              />
              
              <button onClick={() => setFullscreenImage(`/instrucciones_1/paso_${tutorialStep}.png`)}
                className="absolute bottom-3 right-3 rounded-xl bg-black/70 p-2 text-white backdrop-blur-md hover:bg-black transition-colors shadow-xl">
                <Maximize size={16} />
              </button>
            </div>

            {tutorialStep === 8 ? (
              // Paso 8: el código aparece en la consola → se ingresa y envía aquí mismo.
              <>
                <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-yellow-500/30 bg-yellow-500/[0.08] px-4 py-3">
                  <BellRing size={18} className="shrink-0 animate-pulse text-yellow-500" />
                  <p className="text-left text-[13px] font-bold leading-snug text-white">
                    Escribe aquí el código que aparece en tu consola y toca <span className="text-yellow-400">Enviar Código</span>.
                  </p>
                </div>

                <div className="mb-5">{codeField}</div>

                <div className="flex gap-3">
                  <button onClick={() => setTutorialStep(7)} disabled={isSubmitting}
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white transition-all hover:bg-white/5 disabled:opacity-50">
                    <ArrowLeft size={18} />
                  </button>
                  <button onClick={submitCode} disabled={inputCode.length !== 8 || isSubmitting}
                    className="flex-[2] flex items-center justify-center gap-2 rounded-full bg-yellow-500 py-3.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-yellow-400 disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <>Enviar Código <ArrowRight size={16}/></>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-6 landscape:mb-2 text-center text-sm text-gray-300 leading-relaxed">
                  Sigue las indicaciones mostradas en tu consola.
                </p>

                <div className="flex gap-3">
                  <button onClick={() => {
                      if (tutorialStep === 1) setState("select_console");
                      else setTutorialStep(prev => prev - 1);
                    }}
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white transition-all hover:bg-white/5">
                    <ArrowLeft size={18} />
                  </button>
                  <button onClick={() => setTutorialStep(prev => prev + 1)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-full bg-white py-3.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-gray-200">
                    Continuar <ArrowRight size={16}/>
                  </button>
                </div>

                {tutorialStep < 8 && (
                  <button
                    onClick={() => setState("input_code")}
                    className="mt-6 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors w-full text-center"
                  >
                    Ya conozco los pasos, saltar al código
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* 4. INPUT CODE */}
        {state === "input_code" && (
          <motion.div key="input" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 justify-center">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
                <PackageCheck className="text-yellow-500" size={28} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Paso 2 de 3</p>
              <h1 className="text-2xl font-black uppercase tracking-widest">Ingresa el código</h1>
              <p className="mt-2 text-sm text-gray-400">Escribe el código que aparece en la pantalla de tu consola.</p>
            </div>

            <div className="mb-8">{codeField}</div>

            <div className="flex gap-3">
              <button onClick={() => { setState("tutorial"); setTutorialStep(8); }} disabled={isSubmitting}
                className="flex-1 rounded-full border border-white/10 bg-transparent py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-white/5 disabled:opacity-50">
                Volver
              </button>
              <button onClick={submitCode} disabled={inputCode.length !== 8 || isSubmitting}
                className="flex-[2] flex items-center justify-center gap-2 rounded-full bg-yellow-500 py-3.5 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-yellow-400 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Enviar Código"}
              </button>
            </div>
          </motion.div>
        )}

        {/* 5. WAITING SETUP (Realtime) */}
        {state === "waiting_setup" && (
          <motion.div key="waiting" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 items-center justify-center text-center">
            <div className="relative mb-2">
               <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse"></div>
               <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10 shadow-2xl overflow-hidden">
                 <motion.div
                   animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                   transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                 >
                   <PackageCheck className="text-green-400" size={22} />
                 </motion.div>
               </div>
            </div>
            
            <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-0.5">Paso 3 de 3</p>
            <h1 className="text-lg font-black uppercase tracking-widest mb-2">{order?.status === "preparing" ? "¡Casi listo!" : "En Preparación"}</h1>

            {order?.status === "preparing" || progress >= 85 ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="mb-3 flex w-full max-w-[280px] items-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2">
                <BellRing size={16} className="shrink-0 animate-pulse text-yellow-500" />
                <p className="text-left text-[11px] font-bold leading-tight text-white">
                  ¡Prepárate! En breve recibirás tus credenciales.
                </p>
              </motion.div>
            ) : (
              <p className="text-[11px] text-gray-400 mb-3 max-w-[280px] leading-tight">
                Estamos configurando todo. Esta pantalla se actualizará sola.
              </p>
            )}

            <div className="w-full max-w-[280px] grid grid-cols-2 gap-2 mb-3">
              {/* Card del juego */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-left flex flex-col items-start gap-1 shadow-lg overflow-hidden">
                <div className="flex items-center gap-1.5 w-full">
                  <Gamepad2 className="text-gray-400 shrink-0" size={12} />
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 truncate">Juego</p>
                </div>
                <p className="font-bold text-white text-[11px] truncate w-full">{order?.game_name}</p>
              </div>

              {/* Card del código */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-left flex flex-col items-start gap-1 shadow-lg overflow-hidden">
                <div className="flex items-center gap-1.5 w-full">
                  <KeyRound className="text-gray-400 shrink-0" size={12} />
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 truncate">Código</p>
                </div>
                <p className="font-mono font-bold text-white text-[11px] truncate w-full">{order?.console_code || inputCode}</p>
              </div>
            </div>

            <div className="mb-3 w-full max-w-[280px] rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-left">
              <p className="text-[9px] font-bold text-red-400 flex items-center gap-1.5 mb-0.5"><AlertCircle size={10} /> IMPORTANTE</p>
              <p className="text-[9px] text-gray-300 leading-tight">
                <strong className="text-white">NO salgas</strong> de la pantalla del código en tu consola. Si lo haces, el código cambiará.
              </p>
            </div>

            <div className="mb-3 w-full max-w-[280px]">
              <p className="text-[9px] text-gray-400 mb-1.5 text-left leading-tight">
                💡 <strong className="text-gray-300">Recomendación:</strong> Activa las notificaciones para avisarte cuando esté listo, incluso si bloqueas el celular.
              </p>
              
              {notificationStatus === "granted" ? (
                <button 
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-not-allowed"
                >
                  <CheckCircle2 size={14} /> Notificaciones activadas
                </button>
              ) : (
                <button 
                  onClick={requestNotifications}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/30 px-3 py-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest transition-colors hover:bg-blue-500/20"
                >
                  <BellRing size={14} /> Activar Notificaciones
                </button>
              )}
            </div>

            {/* Barra de progreso */}
            <div className="w-full max-w-[280px] mx-auto mb-1">
              <div className="flex justify-between items-end mb-1 px-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Progreso</span>
                <span className="text-[10px] font-mono font-bold text-green-400">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner mb-1.5">
                <motion.div 
                  className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <p className="text-[8px] text-gray-500 uppercase tracking-widest text-center">Tiempo estimado: 5 a 120 min</p>
            </div>

            <button onClick={() => setState("input_code")} className="mt-1 text-[8px] text-gray-500 hover:text-white uppercase tracking-widest underline decoration-gray-700 underline-offset-4 transition-colors">
              ¿Te equivocaste de código? Volver
            </button>
          </motion.div>
        )}

        {/* ESTADO 4: check de credenciales recibidas */}
        {state === "credentials_ready" && (
          <motion.div key="cred_ready" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 items-center justify-center text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl"></div>
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-green-500/30 bg-green-500/15 text-green-400">
                <Check size={40} strokeWidth={3} />
              </div>
            </div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-green-500">Credenciales recibidas</p>
            <h1 className="mb-2 text-2xl font-black uppercase tracking-tight text-white">¡Ya tienes acceso!</h1>
            <p className="mb-6 max-w-[290px] text-sm leading-relaxed text-gray-400">
              Recibimos tus credenciales. Ahora sigue las indicaciones para descargar tu juego — tu código y contraseña estarán a la vista en cada paso.
            </p>

            {(order?.account_email || order?.account_password) && (
              <div className="mb-6 grid w-full max-w-[290px] grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-gray-500">Tu código</p>
                  <p className="font-mono text-lg font-black tracking-widest text-white">{order?.account_email}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-gray-500">Contraseña</p>
                  <p className="break-all text-sm font-bold text-white">{order?.account_password}</p>
                </div>
              </div>
            )}

            <button onClick={() => { setDownloadStep(9); setState("tutorial_download"); }}
              className="flex w-full max-w-[290px] items-center justify-center gap-2 rounded-full bg-yellow-500 py-4 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-yellow-400">
              Continuar con la instalación <ArrowRight size={14} />
            </button>
          </motion.div>
        )}

        {/* SOPORTE (problema durante la instalación) */}
        {state === "support" && (
          <motion.div key="support" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 items-center justify-center text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-yellow-500/30 bg-yellow-500/15 text-yellow-500">
              <LifeBuoy size={40} />
            </div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-yellow-500">Soporte activado</p>
            <h1 className="mb-2 text-2xl font-black uppercase tracking-tight text-white">Estamos contigo</h1>
            <p className="mb-6 max-w-[290px] text-sm leading-relaxed text-gray-400">
              Tu proceso está en pausa. Escríbenos por WhatsApp y resolveremos tu caso lo antes posible.
            </p>
            <button onClick={() => {
                const code = order?.short_code || "";
                const juego = order?.game_name ? ` (${order.game_name})` : "";
                window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, necesito ayuda con mi orden ${code}${juego}.`)}`, "_blank");
              }}
              className="flex w-full max-w-[290px] items-center justify-center gap-2 rounded-full bg-green-500 py-4 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-green-400">
              <LifeBuoy size={14} /> Escribir por WhatsApp
            </button>
            <p className="mt-4 max-w-[260px] text-[10px] text-gray-600">Cuando resolvamos tu caso, esta pantalla se actualizará sola.</p>
          </motion.div>
        )}

        {/* ESTADO 5: BOLETA (entrega completa) */}
        {state === "ready" && (
          <motion.div key="ready" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 justify-center py-6">

            {/* Aviso destacado (blanco, arriba) */}
            <div className="mx-auto mb-5 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/[0.08] px-4 py-3">
              <Camera size={20} className="shrink-0 text-yellow-500" />
              <p className="text-left text-[13px] font-bold leading-snug text-white">
                Toma una captura de esta pantalla. Guarda tu código y contraseña para acceder a tu juego cuando quieras.
              </p>
            </div>

            {/* The Ticket / Receipt */}
            <div className="relative mx-auto w-full max-w-sm rounded-3xl bg-white text-black overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              {/* Barra de marca superior */}
              <div className="h-1.5 w-full bg-yellow-500"></div>

              <div className="p-7 pt-7 pb-6 text-center">
                <div className="mx-auto mb-4 flex items-center justify-center gap-2.5">
                  <div className="h-11 w-11 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                    <img src="/logo.png" alt="Alfeicon Games" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col items-start">
                    <p className="font-black text-sm tracking-[0.2em] text-gray-900 leading-none">ALFEICON</p>
                    <p className="font-black text-[10px] tracking-[0.3em] text-yellow-500 mt-1 leading-none">GAMES</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1">
                  <CheckCircle2 size={13} className="text-green-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-700">Entrega completada</span>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-black">¡Gracias por tu compra!</h1>
              </div>

              <div className="border-t border-dashed border-gray-300 mx-6 relative">
                {/* Cutout circles */}
                <div className="absolute -left-9 -top-3 h-6 w-6 rounded-full bg-[#090b0d]"></div>
                <div className="absolute -right-9 -top-3 h-6 w-6 rounded-full bg-[#090b0d]"></div>
              </div>

              <div className="p-6 space-y-5 bg-[#f8f9fa]">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Juego Adquirido</p>
                  <p className="font-bold text-gray-900 leading-tight">{order?.game_name}</p>
                  {order?.sale_price != null && (
                    <p className="mt-1.5 text-sm font-black text-green-600">
                      ${order.sale_price.toLocaleString("es-CL")}
                    </p>
                  )}
                </div>
                
                <div className="pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5"><Hash size={12}/> Código de Acceso</p>
                  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                    <p className="font-mono text-2xl font-black tracking-[0.35em] text-gray-900">{order?.account_email}</p>
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5"><KeyRound size={12}/> Contraseña</p>
                  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                    <p className="text-sm font-bold text-gray-900 break-all">{order?.account_password}</p>
                  </div>
                </div>
              </div>
              
              {/* Bottom ticket stub */}
              <div className="border-t border-dashed border-gray-300 mx-6 relative">
                 <div className="absolute -left-9 -top-3 h-6 w-6 rounded-full bg-[#090b0d]"></div>
                 <div className="absolute -right-9 -top-3 h-6 w-6 rounded-full bg-[#090b0d]"></div>
              </div>
              <div className="p-6 bg-gray-100 text-center">
                 <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Orden de Compra</p>
                 <p className="font-mono font-bold text-gray-700 tracking-wider text-sm mt-1">{order?.short_code}</p>
                 <div className="mt-4 opacity-40 mx-auto w-3/4 flex justify-between h-8 items-end gap-[1px]">
                   {/* Código de barras determinístico (estable por orden) */}
                   {Array.from({length: 40}).map((_, i) => {
                     const code = order?.short_code || "ALFEICON";
                     const seed = code.charCodeAt(i % code.length) + i * 7;
                     return <div key={i} className="bg-black" style={{ width: seed % 3 === 0 ? '4px' : '2px', height: `${45 + (seed % 55)}%` }}></div>;
                   })}
                 </div>
              </div>
            </div>
            
            <button onClick={() => {
                setDownloadStep(9);
                setState("tutorial_download");
              }}
              className="mt-6 w-full rounded-full border border-white/10 bg-transparent py-4 text-xs font-black uppercase tracking-widest text-gray-300 transition-all hover:bg-white/5 flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Revisar pasos de descarga
            </button>
          </motion.div>
        )}

        {/* 6. TUTORIAL DE DESCARGA */}
        {state === "tutorial_download" && (
          <motion.div key="tutorial_download" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 justify-center py-6">
            <div className="mb-6 landscape:mb-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Descarga tu juego</p>
              <h1 className="text-xl font-black uppercase tracking-widest">Paso {downloadStep} de 18</h1>
            </div>

            <div className="mb-8 landscape:mb-2 w-full rounded-2xl border border-white/10 bg-black/50 shadow-xl overflow-hidden relative flex items-center justify-center min-h-[200px]">
              <motion.img 
                key={`dl_${downloadStep}`}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                src={`/instrucciones_1/paso_${downloadStep}.png`} 
                alt={`Paso de descarga ${downloadStep}`} 
                className="w-full h-auto max-h-[50vh] landscape:max-h-[65vh] object-contain cursor-pointer" 
                onClick={() => setFullscreenImage(`/instrucciones_1/paso_${downloadStep}.png`)} 
              />
              
              <button onClick={() => setFullscreenImage(`/instrucciones_1/paso_${downloadStep}.png`)}
                className="absolute bottom-3 right-3 rounded-xl bg-black/70 p-2 text-white backdrop-blur-md hover:bg-black transition-colors shadow-xl">
                <Maximize size={16} />
              </button>
            </div>

            <div className="mb-6 landscape:mb-2 min-h-[40px] flex items-center justify-center text-center px-4">
              {downloadStep === 11 || downloadStep === 17 ? (
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                  <p className="text-[11px] text-blue-400 font-bold uppercase tracking-wider mb-1">Paso Opcional</p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Si no te sale este paso no te preocupes, solo dale a continuar.
                  </p>
                </div>
              ) : downloadStep === 18 ? (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <p className="text-[11px] text-yellow-500 font-bold uppercase tracking-wider mb-1">¡Casi listo!</p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Ahora solo queda esperar a que se descargue el juego. <b>Continúa con el proceso</b> para ver las recomendaciones y la boleta (no es necesario esperar a que termine la descarga para aceptar).
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-300 leading-relaxed">
                  Sigue las indicaciones mostradas en tu consola para descargar el juego.
                </p>
              )}
            </div>

            {/* Recordatorio del código y contraseña */}
            {(order?.account_email || order?.account_password) && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                {downloadStep === 9 ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-gray-500">Tu código</p>
                      <p className="font-mono text-base font-black leading-none tracking-[0.2em] text-white">{order?.account_email || "—"}</p>
                    </div>
                    <div className="h-8 w-px shrink-0 bg-white/10" />
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-gray-500">Contraseña</p>
                      <p className="truncate text-sm font-bold leading-none text-white">{order?.account_password || "—"}</p>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0 flex-1 text-center">
                    <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-gray-500">
                      Contraseña <span className="text-gray-500 normal-case tracking-normal">(normalmente no se utiliza)</span>
                    </p>
                    <p className="truncate text-sm font-bold leading-none text-white">{order?.account_password || "—"}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {downloadStep > 9 && (
                <button onClick={() => setDownloadStep(prev => prev - 1)}
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white transition-all hover:bg-white/5">
                  <ArrowLeft size={18} />
                </button>
              )}
              <button onClick={() => {
                  if (downloadStep === 18) confirmCompleted();
                  else setDownloadStep(prev => prev + 1);
                }}
                className={`flex-1 flex items-center justify-center gap-2 rounded-full py-3.5 text-xs font-black uppercase tracking-widest transition-all ${downloadStep === 18 ? "bg-green-500 text-black hover:bg-green-400" : "bg-white text-black hover:bg-gray-200"}`}>
                {downloadStep === 18 ? <>Confirmar que empezó a descargar <Check size={16}/></> : <>Continuar <ArrowRight size={16}/></>}
              </button>
            </div>
            
            {downloadStep !== 18 && (
              <button onClick={() => setDownloadStep(18)} className="mt-6 text-[9px] text-gray-500 hover:text-white uppercase tracking-widest underline decoration-gray-700 underline-offset-4 transition-colors">
                Ya me sé los pasos, ir al paso final
              </button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
