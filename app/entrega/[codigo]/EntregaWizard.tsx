"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { ArrowRight, ArrowLeft, Smartphone, Maximize, X, CheckCircle2, Copy, Gamepad2, Loader2, PackageCheck, MonitorSmartphone, KeyRound, Check, AlertCircle, Hash, Camera, LifeBuoy, BellRing, Send, ChevronDown, MessageCircle, CheckCheck, ShieldCheck, ImagePlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import TransferDetailsPanel from "@/components/app-store/TransferDetailsPanel";
import SupportTicketModal from "@/components/app-store/SupportTicketModal";
import { playNotificationSound, playSuccessSound, playErrorSound } from "@/lib/sounds";
import { diasGarantia, diasRestantesGarantia, fechaVencimientoLegible, garantiaVencida } from "@/lib/garantia";
import { marcarImagen, urlImagen } from "@/lib/chat-image";
import type { Order, OrderItem, OrderMessage } from "../../../app/admin/_types"; // we can redefine it here to be safe

// Cada cuánto se puede repetir el aviso de Telegram por mensajes del chat.
const MSG_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;
// Cuánto puede esperar un cliente (con su código ya enviado) antes de que
// avisemos por Telegram que sigue ahí.
const WAITING_ALERT_MS = 20 * 60 * 1000;

// Soporte de la tienda: Instagram. ig.me/m abre el chat directo.
const INSTAGRAM_DM = "https://ig.me/m/alfeicon_games";

// Cada consola tiene su set de fotos. Switch 2 usa /instrucciones_2/: basta
// crear esa carpeta y subir paso_1.png … paso_18.png. Mientras una foto de
// Switch 2 no exista, `pasoImg` deja que el respaldo (Switch 1) la reemplace.
const carpetaInstrucciones = (consola: "switch1" | "switch2" | null) =>
  consola === "switch2" ? "instrucciones_2" : "instrucciones_1";

const pasoImg = (consola: "switch1" | "switch2" | null, paso: number) =>
  `/${carpetaInstrucciones(consola)}/paso_${paso}.png`;

// Respaldo a Switch 1 mientras faltan las fotos de Switch 2. Se aplica en el
// onError de la imagen; el flag evita un bucle si tampoco existe el respaldo.
const usarRespaldoInstruccion = (e: React.SyntheticEvent<HTMLImageElement>, paso: number) => {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.src = `/instrucciones_1/paso_${paso}.png`;
};

type WizardState =
  | "loading"
  | "error"
  | "payment"
  | "select_console"
  | "tutorial"
  | "input_code"
  | "waiting_setup"
  | "credentials_ready"
  | "tutorial_download"
  | "ready"
  | "expired";

export function EntregaWizard() {
  const params = useParams<{ codigo: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  // Cuentas de esta compra. Un pack + un juego son dos ítems: el cliente
  // instala uno, confirma, y el wizard lo lleva al siguiente.
  const [items, setItems] = useState<OrderItem[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
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
  // Ticket de problemas (support_requests). Se abre desde la boleta y desde la
  // pantalla de garantía vencida.
  const [showTicketModal, setShowTicketModal] = useState(false);
  // Chat de soporte tipo burbuja (estilo Messenger): vive por encima del wizard,
  // así el cliente sigue con su instalación con la conversación abierta.
  // `chatOpen` = panel desplegado. La burbuja en sí está siempre presente
  // mientras haya una orden cargada.
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatError, setChatError] = useState<string | null>(null);
  const [adminTyping, setAdminTyping] = useState(false);
  const chatChannelRef = useRef<any>(null);
  const typingTimerRef = useRef<number | null>(null);
  const chatOpenRef = useRef(false);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  // Momento del último aviso de chat enviado (0 = nunca).
  const lastMsgNotifyRef = useRef(0);
  // Aviso de cliente esperando, para no repetirlo.
  const notifiedWaitingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
    }
  }, [state]);

  // Sonido de alerta al llegar al paso 8 del tutorial (donde el código aparece
  // en la consola) para reforzar que ingrese y envíe el código.
  useEffect(() => {
    if (state === "tutorial" && tutorialStep === 8) {
      playNotificationSound();
    }
  }, [state, tutorialStep]);

  // Si el cliente lleva demasiado rato esperando sus credenciales con la
  // página abierta, se avisa por Telegram. El aviso inicial (CODE_SUBMITTED)
  // pudo perderse entre otros mensajes, y acá sabemos algo que un cron no
  // sabría: que la persona sigue ahí, esperando en vivo.
  useEffect(() => {
    if (state !== "waiting_setup" || !order || notifiedWaitingRef.current) return;

    const desde = new Date(order.created_at).getTime();
    const restante = Math.max(WAITING_ALERT_MS - (Date.now() - desde), 0);

    const t = window.setTimeout(() => {
      if (notifiedWaitingRef.current) return;
      notifiedWaitingRef.current = true;
      const minutos = Math.round((Date.now() - desde) / 60000);
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "WAITING_TOO_LONG",
          order,
          message: minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`,
        }),
      }).catch(err => console.error("Error sending notification", err));
    }, restante);

    return () => window.clearTimeout(t);
  }, [state, order?.id, order?.created_at]);

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
    if (order?.payment_status === "rejected") {
      setShowRejectModal(true);
    }
  }, [order?.payment_status]);

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

  // Las cuentas van en su propia tabla desde que una compra puede traer varias.
  // Las órdenes creadas a mano en el admin pueden no tener ítems: en ese caso
  // se sigue usando la cuenta de la orden (modelo antiguo).
  const loadItems = async (orderId: string): Promise<OrderItem[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("[entrega] no se pudieron cargar los ítems", error.message);
      return [];
    }
    const lista = (data || []) as OrderItem[];
    setItems(lista);
    return lista;
  };

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
      const cargados = await loadItems(data.id);
      determineNextState(data as Order, cargados);
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
    if (["credentials_ready", "tutorial_download", "ready"].includes(state)) return; // No hacer polling si ya terminó

    if (order?.id && supabase) {
      pollInterval = setInterval(async () => {
        try {
          if (!supabase) return;
          const { data, error } = await supabase.from("orders").select("*").eq("id", order.id).maybeSingle();
          if (data && !error) {
            const lista = await loadItems(order.id);
            const siguiente = lista.find(i => !i.completed_at);
            // Si el estado o los datos clave cambiaron, actualizamos.
            if (data.status !== order.status || data.account_email !== order.account_email) {
              setOrder(data as Order);
              determineNextState(data as Order, lista);
            } else if (state === "waiting_setup" && siguiente?.account_email && data.status === "ready") {
              // Cargamos la cuenta que faltaba y la orden ya está Lista: el cliente avanza.
              playNotificationSound();
              setState("credentials_ready");
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

  // Chat de soporte: carga el historial y se suscribe a mensajes nuevos en
  // tiempo real mientras la burbuja está activa (mismo patrón de canal/limpieza
  // que setupRealtime, arriba). Si llega un mensaje del admin con el panel
  // cerrado, se cuenta como no leído para el badge de la burbuja.
  useEffect(() => {
    if (!order?.id || !supabase) return;
    const client = supabase;
    const orderId = order.id;
    let cancelled = false;

    client
      .from("order_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const list = data as OrderMessage[];
        setMessages(list);
        // Lo que nos escribió y todavía no ve entra al badge de la burbuja.
        setUnreadCount(list.filter(m => m.sender === "admin" && !m.read_at).length);
      });

    const channel = client
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as OrderMessage;
          setMessages((prev) => [...prev, msg]);
          if (msg.sender === "admin" && !chatOpenRef.current) {
            setUnreadCount((n) => n + 1);
            playNotificationSound();
          }
        },
      )
      // El "visto" del admin llega como UPDATE de read_at.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as OrderMessage;
          setMessages((prev) => prev.map(m => (m.id === msg.id ? msg : m)));
        },
      )
      // "Escribiendo…" del admin: efímero, va por broadcast y no toca la BD.
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.from !== "admin") return;
        setAdminTyping(true);
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => setAdminTyping(false), 3000);
      })
      .subscribe();

    chatChannelRef.current = channel;
    return () => {
      cancelled = true;
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      client.removeChannel(channel);
    };
  }, [order?.id]);

  // Marca como leídos los mensajes del admin cuando el panel está abierto.
  // Si falta correr order-messages-read.sql, el update falla sin romper nada.
  useEffect(() => {
    if (!chatOpen || !supabase || messages.length === 0) return;
    const ids = messages.filter(m => m.sender === "admin" && !m.read_at).map(m => m.id);
    if (ids.length === 0) return;
    supabase.from("order_messages").update({ read_at: new Date().toISOString() }).in("id", ids)
      .then(({ error }) => { if (error) console.warn("[entrega] no se pudo marcar leído", error.message); });
  }, [chatOpen, messages]);

  // Auto-scroll al último mensaje del chat de soporte.
  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // Abrir el panel marca todo como leído.
  const openChat = () => {
    chatOpenRef.current = true;
    setChatOpen(true);
    setUnreadCount(0);
  };

  const closeChat = () => {
    chatOpenRef.current = false;
    setChatOpen(false);
  };

  const sendSupportMessage = async () => {
    const body = messageInput.trim();
    if (!body || !supabase || !order || sendingMessage) return;
    setSendingMessage(true);
    const { error } = await supabase.from("order_messages").insert({ order_id: order.id, sender: "customer", body });
    setSendingMessage(false);
    if (error) {
      // Antes esto solo iba a la consola: el cliente veía que "no pasaba nada".
      console.error("Error enviando mensaje de soporte", error);
      setChatError("No pudimos enviar tu mensaje. Escríbenos por Instagram y te ayudamos igual.");
      return;
    }
    setChatError(null);
    setMessageInput("");

    // Avisar por Telegram con enfriamiento: el primer mensaje siempre, y los
    // siguientes solo si pasaron MSG_NOTIFY_COOLDOWN_MS desde el último aviso.
    // Antes solo se avisaba del primero: si el cliente insistía porque no le
    // respondían, ese mensaje no llegaba a ninguna parte.
    const ahora = Date.now();
    if (ahora - lastMsgNotifyRef.current > MSG_NOTIFY_COOLDOWN_MS) {
      lastMsgNotifyRef.current = ahora;
      fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NEW_MESSAGE', order, message: body })
      }).catch(err => console.error("Error sending notification", err));
    }
  };

  // Envía una foto por el chat: la sube al mismo bucket y guarda el mensaje con
  // la URL marcada, para que el admin la vea como imagen. Sirve tanto para una
  // foto tomada en el momento como para una elegida de la galería.
  const enviarFotoChat = async (file: File) => {
    if (!supabase || !order || sendingMessage) return;
    if (!file.type.startsWith("image/")) {
      setChatError("Ese archivo no es una imagen. Envía una foto.");
      return;
    }
    setSendingMessage(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${order.short_code}-chat-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("comprobantes").getPublicUrl(path);

      const { error: msgErr } = await supabase.from("order_messages").insert({
        order_id: order.id, sender: "customer", body: marcarImagen(pub.publicUrl),
      });
      if (msgErr) throw msgErr;
      setChatError(null);

      const ahora = Date.now();
      if (ahora - lastMsgNotifyRef.current > MSG_NOTIFY_COOLDOWN_MS) {
        lastMsgNotifyRef.current = ahora;
        fetch("/api/notify-order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "NEW_MESSAGE", order, message: "📷 Te envió una foto" }),
        }).catch(err => console.error("Error sending notification", err));
      }
    } catch (e) {
      console.error("Error enviando foto de soporte", e);
      setChatError("No pudimos enviar la foto. Inténtalo de nuevo.");
    } finally {
      setSendingMessage(false);
    }
  };

  // Sube la foto del comprobante al bucket `comprobantes` y la asocia a la orden.
  // Deja payment_status en 'pending' (a la espera de que el admin apruebe/rechace).
  const subirComprobante = async (file: File) => {
    if (!supabase || !order || uploadingReceipt) return;
    setUploadingReceipt(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${order.short_code}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("comprobantes").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: updErr } = await supabase.from("orders").update({ receipt_url: url, payment_status: "pending" }).eq("id", order.id);
      if (updErr) throw updErr;
      setOrder({ ...order, receipt_url: url, payment_status: "pending" });

      // Avisar por Telegram: esto sí requiere que el admin entre a validar.
      fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RECEIPT_UPLOADED", order }),
      }).catch(err => console.error("Error sending notification", err));
    } catch (e) {
      console.error("[entrega] error subiendo comprobante", e);
      alert("No pudimos subir el comprobante. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const determineNextState = (o: Order, lista: OrderItem[] = items) => {
    // Gate de pago: una orden por transferencia que aún no está aprobada muestra
    // la pantalla de pago (datos + subir comprobante), antes de la instalación.
    // Las órdenes de siempre (payment_method null) saltan el gate y siguen igual.
    // Vale tanto para transferencia (comprobante) como para Mercado Pago
    // (confirmación del webhook). Las órdenes viejas, sin payment_method,
    // siguen pasando derecho como siempre.
    if ((o.payment_method === "transferencia" || o.payment_method === "mercadopago") && o.payment_status !== "approved") {
      setState("payment");
      return;
    }
    if (o.status === "completed") {
      // El enlace dura lo mismo que la garantía: pasada esa ventana la boleta
      // ya no muestra credenciales, solo la vía para abrir un ticket. Con
      // varias cuentas, basta que UNA siga vigente para mantener la boleta.
      const vencido = lista.length > 0
        ? lista.every(i => garantiaVencida(i))
        : garantiaVencida(o);
      setState(vencido ? "expired" : "ready");
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

  // La cuenta que el cliente está instalando ahora: el primer ítem que aún no
  // confirma. Si la orden no tiene ítems (creada a mano), se cae a la cuenta de
  // la orden, que es como funcionaba antes.
  const itemActual = items.find(i => !i.completed_at) || null;
  const cuenta = items.length > 0
    ? { email: itemActual?.account_email || null, password: itemActual?.account_password || null, titulo: itemActual?.title || "" }
    : { email: order?.account_email || null, password: order?.account_password || null, titulo: order?.game_name || "" };
  // Para rotular "Cuenta 1 de 2" solo cuando hay más de una.
  const totalItems = items.length;
  const indiceActual = itemActual ? items.indexOf(itemActual) + 1 : totalItems;

  // La boleta muestra TODO lo que compró: una tarjeta por cuenta, cada una con
  // su garantía. Al vencer, el cron le borra las credenciales y la tarjeta pasa
  // a decirlo en vez de mostrar datos vacíos.
  type LineaBoleta = Pick<OrderItem, "id" | "title" | "kind" | "account_email" | "account_password" | "completed_at" | "created_at" | "dias_garantia">
    & { pack_ids?: string[] | null; item_type?: OrderItem["item_type"] };
  const fuenteBoleta: LineaBoleta[] =
    items.length > 0
      ? items
      : order
        ? [{ id: order.id, title: order.game_name, kind: "compra",
             account_email: order.account_email, account_password: order.account_password,
             completed_at: order.completed_at ?? null, created_at: order.created_at,
             pack_ids: order.pack_ids, dias_garantia: null }]
        : [];
  const boletaLineas = fuenteBoleta.map(i => ({
    id: i.id,
    titulo: i.title,
    email: i.account_email,
    password: i.account_password,
    esRecuperacion: i.kind === "recuperacion",
    dias: diasGarantia(i),
    vence: fechaVencimientoLegible(i),
    restantes: diasRestantesGarantia(i),
    // Sin credenciales = ya las liberó el cron al vencer.
    vencida: garantiaVencida(i) || !i.account_email,
  }));

  // Estado 5: el cliente confirma que terminó con ESTA cuenta.
  // Si quedan más cuentas por instalar, el wizard vuelve al paso de
  // credenciales con la siguiente en vez de cerrar la entrega.
  const confirmCompleted = async () => {
    const ahora = new Date().toISOString();

    if (supabase && itemActual) {
      // Marca la cuenta recién instalada: aquí empieza SU garantía.
      const { error } = await supabase
        .from("order_items")
        .update({ completed_at: ahora })
        .eq("id", itemActual.id);
      if (error) console.error("[entrega] no se pudo cerrar el ítem", error);

      const restantes = items.filter(i => i.id !== itemActual.id && !i.completed_at);
      setItems(prev => prev.map(i => i.id === itemActual.id ? { ...i, completed_at: ahora } : i));

      if (restantes.length > 0) {
        // Siguiente cuenta: se reinicia el tutorial de descarga. Si todavía no
        // le cargamos las credenciales, el cliente espera en la pantalla de
        // siempre y el sondeo lo hace avanzar solo cuando aparezcan.
        setDownloadStep(9);
        setState(restantes[0].account_email ? "credentials_ready" : "waiting_setup");
        playSuccessSound();
        return;
      }
    }

    if (supabase && order) {
      // La orden se cierra cuando ya no queda ninguna cuenta por instalar.
      const completed_at = ahora;
      const { error } = await supabase
        .from("orders")
        .update({ status: "completed", completed_at })
        .eq("id", order.id);
      if (error?.code === "42703") {
        await supabase.from("orders").update({ status: "completed" }).eq("id", order.id);
      }
      setOrder({ ...order, status: "completed", completed_at });
      
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

  // Soporte: marca la orden con problema (para que el admin lo vea) y abre la
  // burbuja de chat. El cliente NO pierde su paso: sigue instalando con el chat
  // encima. Instagram queda como enlace secundario dentro del panel.
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
    setShowSupportConfirm(false);
    openChat();
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
    // pb-24: deja aire abajo para que la burbuja de soporte no tape los
    // botones principales de cada paso en pantallas angostas.
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-y-auto overflow-x-hidden bg-[#090b0d] px-5 pb-24 pt-4 text-white">
      {/* HEADER LOGO */}
      <div className="flex items-center justify-between shrink-0 mb-2 w-full">
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

      </div>

      {/* MODAL: confirmación de soporte */}
      {showSupportConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSupportConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c0f12] p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-500">
              <LifeBuoy size={26} />
            </div>
            <h2 className="text-lg font-black uppercase tracking-widest text-white">¿Tienes problemas o dudas con la instalación?</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Te abrimos un chat con nosotros aquí mismo. <b className="text-white">No pierdes tu avance</b>: sigues con la instalación y el chat queda flotando.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button onClick={openSupport}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-green-500 py-3.5 text-xs font-black uppercase tracking-widest text-black">
                <LifeBuoy size={14} /> Sí, necesito ayuda
              </button>
              <button onClick={() => setShowSupportConfirm(false)}
                className="w-full rounded-full border border-white/10 py-3.5 text-xs font-black uppercase tracking-widest text-gray-400">
                No, seguir con el proceso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BURBUJA DE SOPORTE — acompaña toda la instalación: el cliente puede
          escribirnos en cualquier paso y nosotros a él.
          Se sube por encima de la zona de botones en los pasos que tienen un
          botón abajo (ej. "Enviar código"), para no taparlo, y baja de nuevo en
          las pantallas de solo espera. El chat sigue abriéndose hacia arriba,
          que es donde hay pantalla libre. */}
      {order && state !== "loading" && state !== "error" && (
        <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3 transition-[bottom] duration-300">
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                key="chat-panel"
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="chat-panel-glass flex h-[32rem] w-[min(24rem,calc(100vw-2.5rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl"
              >
                <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-500">
                    <LifeBuoy size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black text-white">Soporte Alfeicon</p>
                    <p className="text-[10px] font-bold text-gray-500">Te respondemos aquí mismo</p>
                  </div>
                  <button onClick={closeChat} aria-label="Minimizar chat"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 active:bg-white/10">
                    <ChevronDown size={18} />
                  </button>
                </div>

                {/* Aviso fijo: acota para qué es el chat. */}
                <div className="border-b border-white/10 bg-yellow-500/[0.06] px-4 py-2">
                  <p className="text-[11px] leading-snug text-yellow-500/90">
                    Este chat es solo para coordinar tu instalación en caso de necesitar ayuda.
                  </p>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
                  {messages.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-xs text-gray-600">Escríbenos cuando quieras, en cualquier paso.</p>
                      {/* Escalar: marca la orden como problema y nos avisa por
                          Telegram, para lo que no es solo una duda. */}
                      {order?.status !== "issue" && (
                        <button
                          type="button"
                          onClick={() => setShowSupportConfirm(true)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 active:bg-white/5"
                        >
                          <LifeBuoy size={12} /> Tengo un problema
                        </button>
                      )}
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender === "customer";
                      const foto = urlImagen(m.body);
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                            mine ? "bg-yellow-500 text-black" : "bg-white/10 text-white"
                          }`}>
                            {foto ? (
                              <img src={foto} alt="Foto enviada" onClick={() => setFullscreenImage(foto)}
                                className="mb-1 max-h-48 w-full cursor-pointer rounded-lg object-cover" />
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            )}
                            <span className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${
                              mine ? "text-black/50" : "text-gray-500"
                            }`}>
                              {new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                              {/* Doble check solo en los míos: gris enviado, azul visto. */}
                              {mine && (m.read_at
                                ? <CheckCheck size={12} className="text-blue-700" />
                                : <Check size={12} className="text-black/40" />)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {adminTyping && (
                    <p className="px-1 text-[11px] font-bold italic text-gray-500">Soporte está escribiendo…</p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {chatError && (
                  <div className="mx-2.5 mb-1 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-2.5 text-[11.5px] font-semibold text-red-300">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="flex-1">
                      {chatError}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          const code = order?.short_code || "";
                          const juego = order?.game_name ? ` (${order.game_name})` : "";
                          // Instagram no admite texto prellenado: se copia para
                          // que el cliente solo pegue y envíe.
                          navigator.clipboard?.writeText(`Hola, necesito ayuda con mi orden ${code}${juego}.`).catch(() => {});
                          window.open(INSTAGRAM_DM, "_blank", "noopener");
                        }}
                        className="font-black text-white underline"
                      >
                        Abrir Instagram
                      </button>
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-white/10 p-2.5">
                  {/* Adjuntar foto. Sin `capture`, el móvil ofrece elegir entre
                      tomar una foto o buscarla en la galería. */}
                  <label className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 ${sendingMessage ? "opacity-40" : "cursor-pointer active:bg-white/10"}`}
                    aria-label="Enviar una foto">
                    <ImagePlus size={18} />
                    <input type="file" accept="image/*" className="hidden" disabled={sendingMessage}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFotoChat(f); e.target.value = ""; }} />
                  </label>
                  <input
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      chatChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { from: "customer" } });
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSupportMessage(); } }}
                    placeholder="Escribe tu mensaje..."
                    className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-yellow-500/50"
                  />
                  <button onClick={sendSupportMessage} disabled={sendingMessage || !messageInput.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-black disabled:opacity-40">
                    {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón burbuja + badge de mensajes sin leer. El badge va FUERA del
              botón: `.chat-fab` tiene overflow:hidden (recorta su brillo) y si
              estuviera dentro, recortaría también el badge y se vería "comido". */}
          <div className="relative">
            <button
              onClick={() => (chatOpen ? closeChat() : openChat())}
              aria-label={chatOpen ? "Minimizar soporte" : `Abrir soporte${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
              className="chat-fab flex h-14 w-14 items-center justify-center rounded-full text-[#1c1400] active:scale-95"
            >
              {chatOpen ? <ChevronDown size={24} /> : <MessageCircle size={24} />}
            </button>
            {!chatOpen && unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 18 }}
                className="chat-fab-badge pointer-events-none absolute -right-1 -top-1 z-[2] flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#0c0f12] bg-red-500 px-1 text-[11px] font-black text-white"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
            onClick={() => setFullscreenImage(null)}
          >
            <button onClick={() => setFullscreenImage(null)} className="absolute right-6 top-6 z-[101] rounded-full bg-white/10 p-3 text-white hover:bg-white/20">
              <X size={24} />
            </button>
            <img src={fullscreenImage} alt="Fullscreen" className="max-h-full max-w-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* REJECT MODAL */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative z-10 w-full max-w-sm rounded-3xl border border-red-500/30 bg-[#120a0a] p-6 text-center shadow-2xl shadow-red-500/20">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                <AlertCircle size={28} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-widest text-white">Comprobante Rechazado</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                Tu comprobante no pudo ser validado. Por favor, asegúrate de que la imagen sea clara y los datos coincidan.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex w-full items-center justify-center gap-2 rounded-full bg-red-500 py-3.5 text-xs font-black uppercase tracking-widest text-black transition-colors hover:bg-red-400">
                  Subir nuevo comprobante
                </button>
                <button onClick={() => { setShowRejectModal(false); setShowCancelModal(true); }} className="flex w-full items-center justify-center rounded-full border border-white/10 py-3.5 text-xs font-black uppercase tracking-widest text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
                  Volver a la tienda
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CANCEL MODAL */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-[#120a0a] p-6 text-center shadow-2xl">
              <h2 className="text-lg font-black uppercase tracking-widest text-white">Cancelar Orden</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-300">
                Tu orden <strong className="text-yellow-500">{order?.short_code}</strong> se cancelará. ¿Estás seguro de volver a la tienda?
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button onClick={async () => {
                  if (order && supabase) {
                    await supabase.from('orders').update({ payment_status: 'cancelled' }).eq('id', order.id);
                  }
                  window.location.href = "/";
                }} className="flex w-full items-center justify-center rounded-full bg-white/10 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-red-500/20 hover:text-red-400">
                  Sí, Cancelar Orden
                </button>
                <button onClick={() => setShowCancelModal(false)} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-xs font-black uppercase tracking-widest text-black transition-colors hover:bg-gray-200">
                  No, Continuar Pago
                </button>
              </div>
            </motion.div>
          </div>
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
            <a href="/" className="mt-8 rounded-full bg-white/10 px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-white/20 transition-colors">
              Ir a la tienda
            </a>
          </motion.div>
        )}

        {/* GATE DE PAGO — transferencia pendiente / rechazada */}
        {/* Mercado Pago: no hay nada que subir, solo esperar la confirmación
            del webhook. Llega por realtime y la pantalla avanza sola. */}
        {state === "payment" && order && order.payment_method === "mercadopago" && (
          <motion.div key="payment-mp" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-yellow-500/30 bg-yellow-500/10">
              {order.payment_status === "rejected"
                ? <AlertCircle size={28} className="text-red-400" />
                : <Loader2 size={28} className="animate-spin text-yellow-500" />}
            </div>

            {order.payment_status === "rejected" ? (
              <>
                <h1 className="text-xl font-black uppercase tracking-tight text-white">Pago rechazado</h1>
                <p className="max-w-[290px] text-xs leading-relaxed text-gray-400">
                  Mercado Pago no aprobó el pago de tu orden <b className="text-white">{order.short_code}</b>. Puedes intentarlo otra vez desde la tienda o escribirnos.
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">Confirmando tu pago</p>
                <h1 className="text-xl font-black uppercase tracking-tight text-white">Un momento…</h1>
                <p className="max-w-[290px] text-xs leading-relaxed text-gray-400">
                  Estamos esperando la confirmación de Mercado Pago. Esta pantalla avanza sola en cuanto llegue — no cierres la página.
                </p>
                <p className="text-[11px] text-gray-600">Orden <b className="text-gray-400">{order.short_code}</b> · ${(order.sale_price ?? 0).toLocaleString("es-CL")} CLP</p>
              </>
            )}

            {/* Pasa por el modal de cancelación: irse de acá es abandonar la
                compra, y la orden tiene que quedar marcada como cancelada. */}
            <button type="button" onClick={() => setShowCancelModal(true)}
              className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-500 underline">
              Volver a la tienda
            </button>
          </motion.div>
        )}

        {state === "payment" && order && order.payment_method !== "mercadopago" && (
          <motion.div key="payment" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-1 flex-col justify-center gap-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/40 p-3">
              <TransferDetailsPanel
                code={order.short_code}
                totalLabel={`$${(order.sale_price ?? 0).toLocaleString("es-CL")} CLP`}
                isCollapsed={(!!order.receipt_url && order.payment_status !== "rejected") || uploadingReceipt}
              />
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-black/40 p-3">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-yellow-500">Comprobante</p>

              {order.payment_status === "rejected" && (
                <div className="mb-2.5 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-2.5 text-[11.5px] font-semibold text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  Comprobante rechazado. Vuelve a subirlo o escríbenos.
                </div>
              )}

              {(uploadingReceipt || (order.receipt_url && order.payment_status !== "rejected")) && (
                <div className="mb-2.5 flex flex-col gap-2 rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-2.5 text-[11.5px] font-semibold text-yellow-300">
                  <div className="flex items-center gap-2">
                    <Loader2 size={15} className="shrink-0 animate-spin" />
                    {uploadingReceipt ? "Subiendo comprobante..." : "Comprobante en revisión. Te avisaremos aquí mismo."}
                  </div>
                  <div className="relative h-1 w-full overflow-hidden rounded-full bg-yellow-500/20">
                    <motion.div
                      className="absolute left-0 top-0 h-full w-1/2 rounded-full bg-yellow-500"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              )}

              {order.receipt_url && (
                <button type="button" onClick={() => setFullscreenImage(order.receipt_url!)} className="mb-2 block w-full overflow-hidden rounded-xl border border-white/10">
                  <img src={order.receipt_url} alt="Comprobante" className="max-h-24 w-full bg-black/40 object-contain" />
                </button>
              )}

              <label className={`flex w-full items-center justify-center gap-2 rounded-full py-2 text-xs font-black uppercase tracking-wide ${uploadingReceipt ? "bg-white/10 text-gray-400" : "cursor-pointer bg-white text-black"}`}>
                {uploadingReceipt ? (
                  <><Loader2 size={15} className="animate-spin" /> Subiendo...</>
                ) : (
                  <><Camera size={15} /> {order.receipt_url ? "Cambiar comprobante" : "Subir comprobante"}</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingReceipt}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.currentTarget.value = ""; }}
                />
              </label>

              <p className="mt-2 text-center text-[10.5px] leading-snug text-gray-500">
                Al confirmar tu pago continúas con la instalación.
              </p>
            </div>

            <div className="mt-2 text-center">
              <button onClick={() => setShowCancelModal(true)} className="text-[11px] font-black uppercase tracking-wide text-gray-500 underline decoration-white/20 underline-offset-4 transition hover:text-white">
                Volver a la tienda
              </button>
            </div>
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
                src={pasoImg(consoleType, tutorialStep)}
                onError={(e) => usarRespaldoInstruccion(e, tutorialStep)}
                alt={`Paso ${tutorialStep}`}
                className="w-full h-auto max-h-[50vh] landscape:max-h-[65vh] object-contain cursor-pointer"
                onClick={() => setFullscreenImage(pasoImg(consoleType, tutorialStep))}
              />

              <button onClick={() => setFullscreenImage(pasoImg(consoleType, tutorialStep))}
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
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-green-500">
              {totalItems > 1 ? `Cuenta ${indiceActual} de ${totalItems}` : "Credenciales recibidas"}
            </p>
            <h1 className="mb-2 text-2xl font-black uppercase tracking-tight text-white">¡Ya tienes acceso!</h1>
            {totalItems > 1 && cuenta.titulo && (
              <p className="mb-2 max-w-[290px] text-sm font-black leading-tight text-yellow-500">{cuenta.titulo}</p>
            )}
            <p className="mb-6 max-w-[290px] text-sm leading-relaxed text-gray-400">
              {totalItems > 1
                ? "Cada juego viene en su propia cuenta, así que este proceso se repite una vez por cada uno. Instala esta y te llevamos a la siguiente."
                : "Recibimos tus credenciales. Ahora sigue las indicaciones para descargar tu juego — tu código y contraseña estarán a la vista en cada paso."}
            </p>

            {(cuenta.email || cuenta.password) && (
              <div className="mb-6 grid w-full max-w-[290px] grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-gray-500">Tu código</p>
                  <p className="font-mono text-lg font-black tracking-widest text-white">{cuenta.email}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-gray-500">Contraseña</p>
                  <p className="break-all text-sm font-bold text-white">{cuenta.password}</p>
                </div>
              </div>
            )}

            <button onClick={() => { setDownloadStep(9); setState("tutorial_download"); }}
              className="flex w-full max-w-[290px] items-center justify-center gap-2 rounded-full bg-yellow-500 py-4 text-xs font-black uppercase tracking-widest text-black transition-all hover:bg-yellow-400">
              Continuar con la instalación <ArrowRight size={14} />
            </button>
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">
                    {boletaLineas.length > 1 ? `Lo que compraste (${boletaLineas.length})` : "Juego Adquirido"}
                  </p>
                  {boletaLineas.length <= 1 && (
                    <p className="font-bold text-gray-900 leading-tight">{order?.game_name}</p>
                  )}
                  {order?.sale_price != null && (
                    <p className="mt-1.5 text-sm font-black text-green-600">
                      ${order.sale_price.toLocaleString("es-CL")}
                    </p>
                  )}
                </div>

                {/* Una tarjeta por cuenta entregada: cada una con sus datos y su
                    garantía, que corre desde que el cliente la instaló. */}
                {boletaLineas.map((linea, i) => (
                  <div key={linea.id} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
                    <div className="mb-2.5 flex items-start gap-2">
                      {boletaLineas.length > 1 && (
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-900 text-[10px] font-black text-white">
                          {i + 1}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black leading-tight text-gray-900">{linea.titulo}</p>
                        {linea.esRecuperacion && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700">
                            <LifeBuoy size={9} /> Reposición por garantía
                          </span>
                        )}
                      </div>
                    </div>

                    {linea.vencida ? (
                      <p className="text-[11px] font-bold leading-snug text-gray-400">
                        Garantía finalizada el {linea.vence}. Los datos de acceso ya no se muestran aquí.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-500"><Hash size={10}/> Código</p>
                            <p className="font-mono text-lg font-black tracking-[0.2em] text-gray-900">{linea.email || "—"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-500"><KeyRound size={10}/> Contraseña</p>
                            <p className="break-all text-[13px] font-bold text-gray-900">{linea.password || "—"}</p>
                          </div>
                        </div>
                        <p className="mt-2.5 flex items-start gap-1.5 border-t border-gray-100 pt-2 text-[11px] leading-snug text-gray-500">
                          <ShieldCheck size={12} className="mt-0.5 shrink-0 text-green-600" />
                          <span>
                            <b className="text-gray-900">{linea.dias} días</b> de garantía · vence el {linea.vence}
                            {linea.restantes > 0 && ` (quedan ${linea.restantes})`}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                ))}

                <p className="text-[11px] leading-snug text-gray-500">
                  Esta boleta y tus datos de acceso están disponibles mientras dure la garantía.
                  Guarda una captura.
                </p>
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
            
            {/* Acceso al ticket de problemas: mientras corre la garantía. */}
            <button onClick={() => setShowTicketModal(true)}
              className="mt-6 w-full rounded-full border border-yellow-500/30 bg-yellow-500/[0.08] py-4 text-xs font-black uppercase tracking-widest text-yellow-500 flex items-center justify-center gap-2 active:bg-yellow-500/20">
              <LifeBuoy size={14} /> ¿Tuviste problemas con tus juegos?
            </button>

            <button onClick={() => {
                setDownloadStep(9);
                setState("tutorial_download");
              }}
              className="mt-3 w-full rounded-full border border-white/10 bg-transparent py-4 text-xs font-black uppercase tracking-widest text-gray-300 transition-all hover:bg-white/5 flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Revisar pasos de descarga
            </button>
          </motion.div>
        )}

        {/* GARANTÍA VENCIDA: el enlace ya no muestra credenciales. */}
        {state === "expired" && (
          <motion.div key="expired" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-400">
              <ShieldCheck size={30} />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-white">Garantía finalizada</h1>
              <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-gray-400">
                {boletaLineas.length > 1
                  ? "La garantía de todo lo que compraste ya terminó, así que esta boleta dejó de mostrar los datos de acceso."
                  : "Tu garantía ya terminó, así que esta boleta dejó de mostrar tus datos de acceso."}
                {" "}Si guardaste la captura, tus cuentas siguen funcionando igual.
              </p>
              {boletaLineas.length > 1 && (
                <ul className="mt-3 space-y-1 text-left">
                  {boletaLineas.map(l => (
                    <li key={l.id} className="text-[11px] leading-snug text-gray-500">
                      <b className="text-gray-400">{l.titulo}</b> · venció el {l.vence}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setShowTicketModal(true)}
              className="mt-2 w-full max-w-[290px] rounded-full bg-white py-4 text-xs font-black uppercase tracking-widest text-black flex items-center justify-center gap-2 active:bg-gray-200">
              <LifeBuoy size={14} /> Abrir un ticket
            </button>
          </motion.div>
        )}

        {/* 6. TUTORIAL DE DESCARGA */}
        {state === "tutorial_download" && (
          <motion.div key="tutorial_download" variants={variants} initial="initial" animate="animate" exit="exit" className="flex flex-col flex-1 justify-center py-6">
            <div className="mb-6 landscape:mb-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">
                {totalItems > 1 && cuenta.titulo ? `${cuenta.titulo} · ${indiceActual} de ${totalItems}` : "Descarga tu juego"}
              </p>
              <h1 className="text-xl font-black uppercase tracking-widest">Paso {downloadStep} de 18</h1>
            </div>

            <div className="mb-8 landscape:mb-2 w-full rounded-2xl border border-white/10 bg-black/50 shadow-xl overflow-hidden relative flex items-center justify-center min-h-[200px]">
              <motion.img 
                key={`dl_${downloadStep}`}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                src={pasoImg(consoleType, downloadStep)}
                onError={(e) => usarRespaldoInstruccion(e, downloadStep)}
                alt={`Paso de descarga ${downloadStep}`}
                className="w-full h-auto max-h-[50vh] landscape:max-h-[65vh] object-contain cursor-pointer"
                onClick={() => setFullscreenImage(pasoImg(consoleType, downloadStep))}
              />

              <button onClick={() => setFullscreenImage(pasoImg(consoleType, downloadStep))}
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
            {(cuenta.email || cuenta.password) && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                {downloadStep === 9 ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-gray-500">Tu código</p>
                      <p className="font-mono text-base font-black leading-none tracking-[0.2em] text-white">{cuenta.email || "—"}</p>
                    </div>
                    <div className="h-8 w-px shrink-0 bg-white/10" />
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-gray-500">Contraseña</p>
                      <p className="truncate text-sm font-bold leading-none text-white">{cuenta.password || "—"}</p>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0 flex-1 text-center">
                    <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-gray-500">
                      Contraseña <span className="text-gray-500 normal-case tracking-normal">(normalmente no se utiliza)</span>
                    </p>
                    <p className="truncate text-sm font-bold leading-none text-white">{cuenta.password || "—"}</p>
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
                {downloadStep === 18
                  ? (itemActual && indiceActual < totalItems
                      ? <>Listo, ir a la siguiente cuenta <ArrowRight size={16}/></>
                      : <>Confirmar que empezó a descargar <Check size={16}/></>)
                  : <>Continuar <ArrowRight size={16}/></>}
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

      <SupportTicketModal
        open={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        referencia={order ? `Orden ${order.short_code}` : undefined}
        opciones={boletaLineas.map(l => l.titulo)}
      />
    </div>
  );
}
