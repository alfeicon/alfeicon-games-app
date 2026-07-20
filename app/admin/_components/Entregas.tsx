"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, CheckCircle2, Clock, Loader2, PackageCheck, Plus, RefreshCw, Save, Trash2, X, Search, Gamepad2, Gift, Copy, KeyRound, Hash, Check, HelpCircle, Handshake, Send, MessageCircle, Receipt, ArrowLeft, CheckCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Order, OrderMessage, AdminGame, AdminPack, Provider, SettingsState } from "../_types";
import { fmt, fmtDate, fmtTime } from "../_helpers";
import { FloatingWindow, type WinId, type WinState } from "./FloatingWindow";

type OrderForm = {
  game_name: string;
  status: Order["status"];
  account_email: string;
  account_password: string;
  sale_price: number | "";
  cost_price: number | "";
  provider: string;
  partner_pct: number | "";
  // null = no se sabe (orden creada antes de que existiera este seguimiento).
  // [] = se sabe con certeza que no incluye ningún pack.
  pack_ids: string[] | null;
};

const emptyForm: OrderForm = {
  game_name: "",
  status: "pending_console_code",
  account_email: "",
  account_password: "",
  sale_price: "",
  cost_price: "",
  provider: "",
  partner_pct: "",
  pack_ids: [],
};

const toForm = (o: Order): OrderForm => ({
  game_name: o.game_name,
  status: o.status,
  account_email: o.account_email || "",
  account_password: o.account_password || "",
  sale_price: o.sale_price ?? "",
  cost_price: o.cost_price ?? "",
  provider: o.provider || "",
  partner_pct: o.partner_pct ?? "",
  pack_ids: o.pack_ids ?? null,
});

const STATUS_LABELS: Record<Order["status"], string> = {
  draft: "Nueva Consulta",
  pending_console_code: "Esperando código",
  pending_setup: "Código recibido",
  preparing: "Avisado",
  ready: "Credenciales listas",
  completed: "Entrega completa",
  issue: "Problema instalación",
};

const STATUS_COLORS: Record<Order["status"], string> = {
  draft: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  pending_console_code: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  pending_setup: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  preparing: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  ready: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  completed: "text-green-400 bg-green-500/10 border-green-500/20",
  issue: "text-red-400 bg-red-500/10 border-red-500/20",
};

// Pestañas del modal de una orden. La orden en sí, la validación del pago, el
// chat con el cliente y los números son cuatro tareas distintas; separarlas
// evita el muro de formulario que había antes.
type ModalTab = "orden" | "pago" | "chat" | "finanzas";

const MODAL_TABS: { id: ModalTab; label: string; Icon: React.ElementType }[] = [
  { id: "orden",    label: "Orden",    Icon: PackageCheck },
  { id: "pago",     label: "Pago",     Icon: Receipt },
  { id: "chat",     label: "Chat",     Icon: MessageCircle },
  { id: "finanzas", label: "Finanzas", Icon: Handshake },
];

// Posición inicial de cada ventana. Se reparten para que al abrir una orden ya
// se vean las cuatro sin encimarse: Orden a la izquierda, Chat a la derecha.
// La clave es el "hueco" (slot) y `section` lo que muestra: intercambiar dos
// ventanas es solo permutar ese campo, la geometría se queda donde está.
const DEFAULT_WINS: Record<WinId, WinState> = {
  orden:    { x: 24,   y: 96,  w: 620, h: 620, z: 4, minimized: false, locked: false, section: "orden" },
  chat:     { x: 668,  y: 96,  w: 440, h: 520, z: 3, minimized: false, locked: false, section: "chat" },
  pago:     { x: 668,  y: 632, w: 440, h: 220, z: 2, minimized: true,  locked: false, section: "pago" },
  finanzas: { x: 1128, y: 96,  w: 460, h: 420, z: 1, minimized: true,  locked: false, section: "finanzas" },
};

type WinCtx = {
  showAll: boolean;
  bounds: { w: number; h: number };
  wins: Record<WinId, WinState>;
  patch: (id: WinId, p: Partial<WinState>) => void;
  focus: (id: WinId) => void;
  swap: (slot: WinId, section: WinId) => void;
};

// Cada bloque de la orden: ventana flotante en escritorio, tarjeta normal en
// móvil. Vive fuera del componente a propósito — definirlo dentro crearía un
// tipo nuevo en cada render y React remontaría el chat con cada tecla.
function Shell({ id, title, Icon, ctx, fill, children }: {
  id: WinId; title: string; Icon: React.ElementType; ctx: WinCtx; fill?: boolean; children: React.ReactNode;
}) {
  if (!ctx.showAll) return <>{children}</>;
  // Esta sección se dibuja en el slot que la tenga asignada, no en el suyo.
  const slot = (Object.keys(ctx.wins) as WinId[]).find(s => ctx.wins[s].section === id);
  if (!slot) return null;
  return (
    <FloatingWindow
      title={title}
      Icon={Icon}
      state={ctx.wins[slot]}
      onChange={(patch) => ctx.patch(slot, patch)}
      onFocus={() => ctx.focus(slot)}
      options={MODAL_TABS.map(t => ({ id: t.id, label: t.label }))}
      onSwap={(section) => ctx.swap(slot, section)}
      fill={fill}
      bounds={ctx.bounds}
      others={(Object.keys(ctx.wins) as WinId[])
        .filter(s2 => s2 !== slot && !ctx.wins[s2].minimized)
        .map(s2 => ({ x: ctx.wins[s2].x, y: ctx.wins[s2].y, w: ctx.wins[s2].w, h: ctx.wins[s2].h }))}
    >
      {children}
    </FloatingWindow>
  );
}

// Una orden "por validar": pagó por transferencia, subió comprobante y todavía
// no lo apruebas. Es lo único que debería aparecer en la pestaña Validación.
const needsValidation = (o: Order | null) =>
  !!o && o.payment_status === "pending" && !!o.receipt_url;

const LABEL = "mb-1.5 block text-[9px] font-black uppercase tracking-widest text-gray-600";
const INPUT = "w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all duration-150 placeholder:text-gray-700 focus:border-yellow-500/50 focus:bg-white/7";

// Etapas visibles del progreso de una entrega (para el stepper del modal).
const STEPS: { key: Order["status"]; label: string }[] = [
  { key: "pending_console_code", label: "Código" },
  { key: "pending_setup", label: "Recibido" },
  { key: "preparing", label: "Avisado" },
  { key: "ready", label: "Credenciales" },
  { key: "completed", label: "Completa" },
];

// Tabla de Historial para desktop: aprovecha el ancho disponible mostrando
// precio y ganancia sin tener que abrir cada orden. Vive fuera de Entregas
// para no perder su identidad (y remontar toda la tabla) en cada tecla que
// se escribe en el buscador de Historial.
function HistoryTable({ items, onSelect }: { items: Order[]; onSelect: (item: Order) => void }) {
  return (
    <table className="hidden w-full md:table">
      <thead>
        <tr className="border-b border-white/10 text-left text-[9px] font-black uppercase tracking-widest text-gray-600">
          <th className="px-4 py-2 font-black">Orden</th>
          <th className="px-2 py-2 font-black">Juego</th>
          <th className="px-2 py-2 font-black">Fecha</th>
          <th className="px-2 py-2 font-black">Código cliente</th>
          <th className="px-2 py-2 text-right font-black">Precio</th>
          <th className="px-2 py-2 text-right font-black">Ganancia</th>
          <th className="px-4 py-2 text-right font-black">Estado</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          const profit = (item.sale_price ?? 0) - (item.cost_price ?? 0);
          const yourCut = item.partner_pct != null ? Math.round(profit * (100 - item.partner_pct) / 100) : profit;
          const isIssue = item.status === "issue";
          return (
            <tr key={item.id} onClick={() => onSelect(item)}
              className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]">
              <td className="px-4 py-2.5 text-[11px] font-bold text-gray-400">{item.order_number ? `#${item.order_number}` : item.short_code}</td>
              <td className="max-w-[240px] truncate px-2 py-2.5 text-[12px] font-bold text-white">{item.game_name}</td>
              <td className="px-2 py-2.5 text-[11px] text-gray-500">{fmtDate(item.created_at)}</td>
              <td className="px-2 py-2.5 text-[11px] text-gray-500">{item.console_code || "—"}</td>
              <td className="px-2 py-2.5 text-right text-[11px] font-bold text-gray-300">{item.sale_price != null ? `$${fmt(item.sale_price)}` : "—"}</td>
              <td className="px-2 py-2.5 text-right text-[11px] font-bold text-green-400">{item.sale_price != null ? `$${fmt(yourCut)}` : "—"}</td>
              <td className="px-4 py-2.5 text-right">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[item.status]}`}>
                  {isIssue ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                  {isIssue ? "Problema" : "Completa"}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// En pantallas grandes el panel de la orden muestra todo a la vez y las
// pestañas sobran; en móvil siguen siendo necesarias (si no, es un scroll
// interminable).
function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

// Chat de soporte con el cliente, ligado a una orden. El cliente lo ve como una
// burbuja flotante en /entrega/[code] mientras sigue con su instalación, así que
// lo que se escriba aquí le llega en tiempo real (order_messages + realtime).
function AdminOrderChat({ orderId, fill }: { orderId: string; fill?: boolean }) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientTyping, setClientTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const chanRef = useRef<any>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Marca como leídos los mensajes del cliente. Si la columna read_at todavía
  // no existe (falta correr order-messages-read.sql) simplemente no hace nada.
  const markRead = async (list: OrderMessage[]) => {
    if (!supabase) return;
    const ids = list.filter(m => m.sender === "customer" && !m.read_at).map(m => m.id);
    if (ids.length === 0) return;
    await supabase.from("order_messages").update({ read_at: new Date().toISOString() }).in("id", ids);
  };

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    client
      .from("order_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError("No se pudo cargar la conversación."); return; }
        if (data) { setMessages(data as OrderMessage[]); markRead(data as OrderMessage[]); }
      });

    const channel = client
      .channel(`admin-order-messages-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as OrderMessage;
          setMessages((prev) => [...prev, msg]);
          if (msg.sender === "customer") { setClientTyping(false); markRead([msg]); }
        },
      )
      // El "visto" del cliente llega como UPDATE de read_at.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const msg = payload.new as OrderMessage;
          setMessages((prev) => prev.map(m => (m.id === msg.id ? msg : m)));
        },
      )
      // "Escribiendo…" va por broadcast: es efímero, no vale una fila en la BD.
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.from !== "customer") return;
        setClientTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setClientTyping(false), 3000);
      })
      .subscribe();

    chanRef.current = channel;
    return () => {
      cancelled = true;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      client.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, clientTyping]);

  const notifyTyping = () => {
    chanRef.current?.send({ type: "broadcast", event: "typing", payload: { from: "admin" } });
  };

  const send = async () => {
    const body = input.trim();
    if (!body || !supabase || sending) return;
    setSending(true);
    const { error } = await supabase.from("order_messages").insert({ order_id: orderId, sender: "admin", body });
    setSending(false);
    if (error) { console.error("Error enviando mensaje al cliente", error); setError("No se pudo enviar el mensaje."); return; }
    setError(null);
    setInput("");
  };

  return (
    <div className={fill
      ? "flex min-h-0 flex-1 flex-col"
      : "mb-5 rounded-2xl border border-white/10 bg-black/30 p-3"}>
      {/* Dentro de una ventana el título ya lo pone la barra de la ventana. */}
      {!fill && (
        <div className="mb-2 flex items-center gap-2">
          <MessageCircle size={13} className="text-yellow-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Chat con el cliente</p>
        </div>
      )}

      <div className={fill
        ? "min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
        : "max-h-56 space-y-2 overflow-y-auto rounded-xl bg-black/30 p-2.5"}>
        {messages.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-gray-600">Sin mensajes todavía.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === "admin";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[12.5px] leading-snug ${
                  mine ? "bg-yellow-500 text-black" : "bg-white/10 text-white"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <span className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${
                    mine ? "text-black/50" : "text-gray-500"
                  }`}>
                    {fmtTime(m.created_at)}
                    {/* Doble check solo en los míos: gris enviado, azul visto. */}
                    {mine && (
                      m.read_at
                        ? <CheckCheck size={11} className="text-blue-700" />
                        : <Check size={11} className="text-black/40" />
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {clientTyping && (
          <p className="px-1 text-[10px] font-bold italic text-gray-500">El cliente está escribiendo…</p>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 px-3 text-[11px] font-semibold text-red-400">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <div className={`flex items-center gap-2 ${fill ? "border-t border-white/[0.07] p-2.5" : "mt-2"}`}>
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); notifyTyping(); }}
          // Enter envía el mensaje, no el formulario de la orden que lo envuelve.
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          placeholder="Escribe al cliente..."
          className={INPUT + " flex-1"}
        />
        <button type="button" onClick={send} disabled={sending || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500 text-black disabled:opacity-40">
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}

type Props = {
  orders: Order[];
  games: AdminGame[];
  packs: AdminPack[];
  providers: Provider[];
  settings: SettingsState;
  loading: boolean;
  setLoading: (v: boolean) => void;
  showNotice: (type: "success" | "error", text: string) => void;
  onReload: () => Promise<void>;
};

// Genera un código aleatorio alfanumérico (ej: ALF-Y8K2)
function generateShortCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "ALF-";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Postgres error 42703 = undefined_column. Permite seguir guardando la orden
// (sin id de pack) si todavía no se corrió orders-delete-pack-on-sale.sql.
function isMissingPackIdsColumn(error: { code?: string; message?: string }) {
  return error?.code === "42703" && (error.message || "").includes("pack_ids");
}

export function Entregas({ orders, games, packs, providers, settings, loading, setLoading, showNotice, onReload }: Props) {
  const partnerName = settings.partnerName || "Socio";
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  // Copia del form tal como quedó al abrir el modal, para detectar cambios sin
  // guardar antes de cerrarlo por accidente (click afuera o la X).
  const [openedForm, setOpenedForm] = useState<OrderForm>(emptyForm);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Pestaña activa del modal de una orden. Antes todo (datos, comprobante,
  // finanzas y chat) vivía apilado en la misma vista.
  const [modalTab, setModalTab] = useState<ModalTab>("orden");
  // En ancho de escritorio no se usan pestañas: cada bloque es una ventana
  // flotante que se mueve, se redimensiona y se puede minimizar.
  const isWide = useIsWide();
  const showAll = isWide && !!selectedOrder;
  const [wins, setWins] = useState<Record<WinId, WinState>>(DEFAULT_WINS);
  const topZ = useRef(10);

  const patchWin = (id: WinId, patch: Partial<WinState>) =>
    setWins(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const focusWin = (id: WinId) => {
    topZ.current += 1;
    patchWin(id, { z: topZ.current });
  };

  // Área donde flotan las ventanas: se mide para repartir el layout inicial y
  // para que las ventanas no se salgan ni se encimen.
  const deskRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = deskRef.current;
    if (!showAll || !el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBounds({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [showAll]);

  // Reparto inicial en mosaico: Orden ocupa la izquierda y Chat la derecha, los
  // dos a lo alto. En píxeles fijos no calzaba en todas las pantallas.
  // Guarda para qué orden se hizo el reparto: al abrir otra se vuelve a repartir,
  // pero mientras trabajas en la misma no te mueve las ventanas.
  const tiledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showAll || !selectedOrder) { tiledRef.current = null; return; }
    if (tiledRef.current === selectedOrder.id || bounds.w < 600) return;
    tiledRef.current = selectedOrder.id;
    const pad = 10;
    const chatW = Math.max(320, Math.round(bounds.w * 0.34));
    const mainW = bounds.w - chatW - pad * 3;
    const h = bounds.h - pad * 2;
    const mainX = pad;
    const sideX = pad * 2 + mainW;

    // Una orden por validar se abre mostrando el comprobante: es lo único que
    // hay que hacer con ella. El resto abre en los datos de la entrega.
    const validando = needsValidation(selectedOrder);

    setWins(prev => ({
      ...prev,
      orden:    { ...prev.orden,    x: mainX, y: pad, w: mainW, h, minimized: validando },
      pago:     { ...prev.pago,     x: mainX, y: pad, w: mainW, h, minimized: !validando },
      chat:     { ...prev.chat,     x: sideX, y: pad, w: chatW, h, minimized: false },
      finanzas: { ...prev.finanzas, x: mainX, y: pad, w: Math.min(560, mainW), h: Math.min(460, h), minimized: true },
    }));
  }, [showAll, bounds.w, bounds.h, selectedOrder?.id]);

  // Intercambia lo que muestran dos ventanas. Como siempre es una permutación,
  // ninguna sección queda sin slot ni aparece duplicada.
  const swapWin = (slot: WinId, section: WinId) => {
    setWins(prev => {
      const other = (Object.keys(prev) as WinId[]).find(s => prev[s].section === section);
      if (!other || other === slot) return prev;
      return {
        ...prev,
        [slot]: { ...prev[slot], section },
        [other]: { ...prev[other], section: prev[slot].section },
      };
    });
  };

  const winCtx: WinCtx = { showAll, bounds, wins, patch: patchWin, focus: focusWin, swap: swapWin };
  // Comprobante ampliado (modo validación de pago).
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  
  // Tabs: Nuevas (drafts), Activas, Historial
  const [activeTab, setActiveTab] = useState<'validacion' | 'active' | 'problemas' | 'completadas'>('active');

  // Búsqueda dentro del Historial
  const [historySearch, setHistorySearch] = useState("");
  // Las canceladas van plegadas: son registro, no trabajo pendiente.
  const [showCancelled, setShowCancelled] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);

  // Para sugerencias de autocompletado
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const pool = useMemo(() => {
    const allGames = (games || []).filter(g => g.is_active).map(g => ({ id: g.id, title: g.title, type: "game" as const, price: g.is_offer ? g.offer_price : g.price, cost: g.cost_price }));
    const allPacks = (packs || []).filter(p => p.is_active).map(p => ({ id: p.id, title: p.title, type: "pack" as const, price: p.price, cost: p.cost_price }));
    return [...allGames, ...allPacks];
  }, [games, packs]);

  const suggestions = useMemo(() => {
    const parts = form.game_name.split('+');
    const currentSearch = parts[parts.length - 1].trim().toLowerCase();
    if (!currentSearch) return pool.slice(0, 5);
    return pool.filter(t => t.title.toLowerCase().includes(currentSearch)).slice(0, 5);
  }, [pool, form.game_name]);

  const addSuggestion = (item: { id: string, title: string, type: "game" | "pack", price: number | null, cost: number | null }) => {
    const parts = form.game_name.split('+').map(p => p.trim()).filter(Boolean);
    if (form.game_name.includes('+') || parts.length > 0) {
       parts.pop();
    }
    parts.push(item.title);

    // Se guarda el id del pack elegido para poder eliminarlo del catálogo al
    // completar la orden sin depender de matchear el nombre por texto. Elegir
    // un pack aquí es lo que nos permite pasar de "no se sabe" (null) a
    // "se sabe con certeza" (array), aunque la orden fuera vieja.
    const currentPackIds = form.pack_ids || [];
    const pack_ids = item.type !== "pack"
      ? form.pack_ids
      : currentPackIds.includes(item.id)
        ? form.pack_ids
        : [...currentPackIds, item.id];

    // Auto-fill prices if empty
    setForm({
      ...form,
      game_name: parts.join(' + ') + ' + ',
      sale_price: form.sale_price === "" ? (item.price || "") : form.sale_price,
      cost_price: form.cost_price === "" ? (item.cost || "") : form.cost_price,
      pack_ids,
    });
  };

  // Validación = solo lo que requiere una decisión tuya: un comprobante de
  // transferencia esperando aprobación. Una orden recién creada todavía no
  // pagó nada, y las de Mercado Pago las resuelve el webhook solo.
  const draftOrders = useMemo(
    () => orders.filter(o =>
      o.status === 'draft' &&
      o.payment_status === 'pending' &&
      !!o.receipt_url,
    ),
    [orders],
  );

  // Compras a medio camino: eligieron método de pago y no completaron. No son
  // trabajo pendiente, pero saber cuántas son dice mucho, así que van aparte.
  const awaitingPayment = useMemo(
    () => orders.filter(o =>
      o.status === 'draft' &&
      o.payment_status === 'pending' &&
      !o.receipt_url,
    ),
    [orders],
  );
  const cancelledOrders = useMemo(() => orders.filter(o => o.payment_status === 'cancelled'), [orders]);
  const activeOrders = useMemo(() => orders.filter(o => !['draft', 'completed', 'issue'].includes(o.status)), [orders]);
  // Los problemas tienen su propia pestaña: son tickets abiertos, no entregas
  // terminadas. Antes caían en el historial junto a las completadas.
  const issueOrders = useMemo(() => orders.filter(o => o.status === 'issue'), [orders]);
  const historyOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  const counts = {
    drafts: draftOrders.length,
    active: activeOrders.length,
    issues: issueOrders.length,
    history: historyOrders.length,
  };

  // Cerrar un ticket: la orden vuelve al paso que le corresponde según lo que
  // ya tenga cargado (mismo criterio que usa el portal del cliente).
  const resolverProblema = async (o: Order) => {
    if (!supabase) return;
    const next: Order["status"] =
      o.account_email && o.account_password ? "ready"
      : o.console_code ? "pending_setup"
      : "pending_console_code";
    setLoading(true);
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    setLoading(false);
    if (error) { showNotice("error", `No se pudo resolver: ${error.message}`); return; }
    showNotice("success", "Problema resuelto — la orden volvió a Activas.");
    await onReload();
  };

  // Historial filtrado por búsqueda (juego, número de orden, código corto o código del cliente)
  const filteredHistoryOrders = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyOrders;
    return historyOrders.filter(o =>
      o.game_name.toLowerCase().includes(q) ||
      o.short_code.toLowerCase().includes(q) ||
      String(o.order_number ?? "").includes(q) ||
      (o.console_code || "").toLowerCase().includes(q)
    );
  }, [historyOrders, historySearch]);

  // Historial agrupado por mes para que no sea una lista infinita
  const historyGroups = useMemo(() => {
    const groups = new Map<string, Order[]>();
    filteredHistoryOrders.forEach(o => {
      const key = new Date(o.created_at).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    });
    return Array.from(groups.entries());
  }, [filteredHistoryOrders]);

  // Secciones para "Activas"
  const activeSections = [
    { label: "Esperando código de Nintendo", status: "pending_console_code", items: activeOrders.filter(o => o.status === 'pending_console_code'), icon: Clock },
    { label: "Código recibido (¡Tienes que preparar!)", status: "pending_setup", items: activeOrders.filter(o => o.status === 'pending_setup'), icon: AlertCircle, color: "text-yellow-500" },
    { label: "Cliente avisado (Barra en 85%)", status: "preparing", items: activeOrders.filter(o => o.status === 'preparing'), icon: CheckCircle2 },
    { label: "Credenciales Listas (Esperando confirmación)", status: "ready", items: activeOrders.filter(o => o.status === 'ready'), icon: KeyRound },
  ];

  // Índice del paso actual en el stepper (‑1 si es "issue", que no está en STEPS).
  const currentStepIndex = STEPS.findIndex(s => s.key === form.status);

  const select = (o: Order) => {
    const f = toForm(o);
    setSelectedOrder(o); setForm(f); setOpenedForm(f); setSplitEnabled(o.partner_pct != null);
    setQuery(""); setShowSuggestions(false); setCreatedCode(null); setModalOpen(true);
    // Si hay un comprobante esperando, el modal abre directo en Pago: es lo
    // único accionable en ese momento.
    setModalTab(o.payment_status === "pending" && o.receipt_url ? "pago" : "orden");
  };
  const newOrder = () => {
    const f = { ...emptyForm, partner_pct: Number(settings.partnerSplitPct) || 40 };
    setSelectedOrder(null); setForm(f); setOpenedForm(f); setSplitEnabled(false);
    setQuery(""); setShowSuggestions(false); setCreatedCode(null); setModalOpen(true);
    setModalTab("orden");
  };
  const close = () => { setModalOpen(false); setSelectedOrder(null); setShowSuggestions(false); setCreatedCode(null); };
  // Antes de cerrar por click afuera o por la X, avisa si hay cambios sin guardar
  // (el botón "Cerrar" tras crear la orden no pasa por acá: ya quedó guardada).
  const closeIfConfirmed = () => {
    const dirty = JSON.stringify(form) !== JSON.stringify(openedForm);
    if (dirty && !window.confirm("Tienes cambios sin guardar en esta orden. ¿Cerrar de todas formas?")) return;
    close();
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const finalGameName = form.game_name.replace(/\+\s*$/, '').trim();

    // Solo se guardan los ids de packs cuyo título siga siendo, exactamente,
    // uno de los segmentos separados por "+" del nombre final (mismo criterio
    // que usa el respaldo por texto del trigger) — si el admin reescribió esa
    // parte a mano y el título del pack quedó solo como substring de otra
    // frase, no se arrastra el id viejo. Si pack_ids es null (orden vieja,
    // nunca se supo con certeza) se mantiene null: así el trigger sigue
    // usando el respaldo por texto solo para ella, en vez de asumir "cero
    // packs" y saltarse ese respaldo por error.
    const finalGameNameSegments = finalGameName.split('+').map(s => s.trim().toLowerCase());
    const validPackIds = form.pack_ids === null ? null : form.pack_ids.filter(id => {
      const pack = (packs || []).find(p => p.id === id);
      return pack && finalGameNameSegments.includes(pack.title.toLowerCase());
    });

    const payload = {
      game_name: finalGameName,
      status: form.status,
      account_email: form.account_email.trim() || null,
      account_password: form.account_password.trim() || null,
      sale_price: form.sale_price === "" ? null : form.sale_price,
      cost_price: form.cost_price === "" ? null : form.cost_price,
      provider: form.provider || null,
      partner_pct: splitEnabled ? Math.min(100, Math.max(0, Number(form.partner_pct) || 0)) : null,
      pack_ids: validPackIds,
    };
    if (!payload.game_name) { showNotice("error", "Falta el nombre del juego."); return; }

    // Al guardar código de acceso + contraseña por PRIMERA vez, la orden pasa a "Listo"
    const firstCredentialSave =
      selectedOrder && payload.account_email && payload.account_password && !selectedOrder.account_password;
    if (firstCredentialSave && payload.status === "preparing") payload.status = "ready";

    setLoading(true);
    let missingPackIdsColumn = false;
    try {
      if (selectedOrder) {
        let { error } = await supabase.from("orders").update(payload).eq("id", selectedOrder.id);
        if (error && isMissingPackIdsColumn(error)) {
          missingPackIdsColumn = true;
          const { pack_ids: _omit, ...payloadWithoutPackIds } = payload;
          ({ error } = await supabase.from("orders").update(payloadWithoutPackIds).eq("id", selectedOrder.id));
        }
        if (error) throw error;
        showNotice("success", missingPackIdsColumn
          ? "Orden actualizada — falta correr orders-delete-pack-on-sale.sql en Supabase para el borrado automático de packs."
          : (firstCredentialSave ? "Datos guardados — orden marcada como Lista." : "Orden actualizada."));
        close();
        await onReload();
      } else {
        const generatedCode = generateShortCode();
        let { error } = await supabase.from("orders").insert({ ...payload, short_code: generatedCode });
        if (error && isMissingPackIdsColumn(error)) {
          missingPackIdsColumn = true;
          const { pack_ids: _omit, ...payloadWithoutPackIds } = payload;
          ({ error } = await supabase.from("orders").insert({ ...payloadWithoutPackIds, short_code: generatedCode }));
        }
        if (error) throw error;
        showNotice(missingPackIdsColumn ? "error" : "success", missingPackIdsColumn
          ? "Orden creada — falta correr orders-delete-pack-on-sale.sql en Supabase para el borrado automático de packs."
          : "Orden creada.");
        setCreatedCode(generatedCode);
        await onReload();
      }
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setLoading(false);
    }
  };

  const del = async (orderToDel = selectedOrder) => {
    if (!supabase || !orderToDel) return;
    if (!window.confirm(`¿Eliminar la orden ${orderToDel.short_code}?`)) return;
    setLoading(true);
    const { error } = await supabase.from("orders").delete().eq("id", orderToDel.id);
    setLoading(false);
    if (error) { showNotice("error", "No se pudo eliminar."); return; }
    showNotice("success", "Orden eliminada."); 
    if (orderToDel === selectedOrder) close(); 
    await onReload();
  };

  const confirmDraft = async (order: Order) => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from("orders").update({ status: "pending_console_code" }).eq("id", order.id);
    setLoading(false);
    if (error) { showNotice("error", `No se pudo confirmar: ${error.message}`); return; }
    showNotice("success", "Entrega confirmada y movida a Activas.");
    setActiveTab("active");
    await onReload();
  };

  // Reinicia el proceso: el cliente vuelve a empezar.
  const restartOrder = async () => {
    if (!supabase || !selectedOrder) return;
    if (!window.confirm("Esto reiniciará el proceso: el cliente volverá al inicio (elegir consola e ingresar código de nuevo). ¿Continuar?")) return;
    const gameName = form.game_name.replace(/\+\s*$/, "").trim();
    setLoading(true);
    const { error } = await supabase.from("orders").update({
      game_name: gameName || selectedOrder.game_name,
      status: "pending_console_code",
      console_code: null,
      account_email: null,
      account_password: null,
    }).eq("id", selectedOrder.id);
    setLoading(false);
    if (error) { showNotice("error", `No se pudo reiniciar: ${error.message}`); return; }
    showNotice("success", "Proceso reiniciado. El cliente comenzará de nuevo.");
    close();
    await onReload();
  };

  // Componente interno para renderizar cada item de la lista
  const OrderItem = ({ item }: { item: Order }) => (
    <div className="group relative flex w-full items-center gap-4 px-4 py-3 text-left transition-all duration-150 hover:bg-white/[0.04]">

      <button onClick={() => select(item)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
        <div className={`flex shrink-0 items-center justify-center rounded-xl border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[item.status]}`}>
          {item.status === 'ready' || item.status === 'completed' ? <CheckCircle2 size={11} className="mr-1" /> :
           item.status === 'issue' ? <AlertCircle size={11} className="mr-1" /> :
           item.status === 'draft' ? <HelpCircle size={11} className="mr-1" /> :
           <Clock size={11} className="mr-1" />}
          {STATUS_LABELS[item.status]}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-bold leading-tight text-white">
            <span className="truncate">
              {item.order_number ? `Orden #${item.order_number}` : item.short_code} · {item.game_name}
            </span>
            {/* Pagó por transferencia y subió comprobante: hay que validarlo. */}
            {item.payment_status === "pending" && item.receipt_url && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-yellow-500">
                <Receipt size={9} /> Comprobante
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-gray-600">
            {item.short_code} · {fmtTime(item.created_at)} · {fmtDate(item.created_at)}
            {item.console_code ? ` · Código Cliente: ${item.console_code}` : ''}
          </p>
        </div>
      </button>

      {item.status === "draft" && (
        <div className="flex shrink-0 gap-2">
           <button onClick={() => del(item)} disabled={loading} className="p-2 text-gray-600 hover:text-red-400 hover:bg-white/5 rounded-full transition-colors"><X size={16} /></button>
           <button onClick={() => confirmDraft(item)} disabled={loading} className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-purple-500 hover:bg-purple-400 text-black rounded-full transition-colors flex items-center gap-1.5"><Check size={12} strokeWidth={3} /> Confirmar</button>
        </div>
      )}

      {item.status === "pending_setup" && (
        <button
          onClick={async () => {
            if (!supabase) return;
            setLoading(true);
            const { error } = await supabase.from("orders").update({ status: "preparing" }).eq("id", item.id);
            setLoading(false);
            if (error) { showNotice("error", `No se pudo avisar: ${error.message}`); return; }
            showNotice("success", "Cliente avisado — barra al 85%.");
            await onReload();
          }}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
        >
          <PackageCheck size={12} /> Avisar
        </button>
      )}

      {item.status === "preparing" && (
        <div className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-600/30 bg-gray-600/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500 cursor-not-allowed">
          <CheckCircle2 size={12} /> Avisado
        </div>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.04]" />
    </div>
  );

  // Contenido del panel de una orden (cabecera + formulario). Se monta en dos
  // contenedores distintos: pantalla completa para una orden existente, modal
  // para la creación de una nueva.
  const orderPanel = (
    <>
            <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.05] bg-gradient-to-b from-white/[0.04] to-transparent px-5 py-4">
              {selectedOrder ? (
                <button onClick={closeIfConfirmed} type="button" title="Volver a la lista"
                  className="flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-white/8 px-3 text-gray-400 transition-all hover:bg-white/5 hover:text-white active:scale-95">
                  <ArrowLeft size={15} />
                  <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">Volver</span>
                </button>
              ) : (
                <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10 sm:flex">
                  <PackageCheck size={18} className="text-yellow-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500">
                    {selectedOrder
                      ? `Orden ${selectedOrder.order_number ? `#${selectedOrder.order_number} · ${selectedOrder.short_code}` : selectedOrder.short_code}`
                      : "Nueva Orden"}
                  </p>
                  {selectedOrder && (
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${STATUS_COLORS[form.status]}`}>
                      {STATUS_LABELS[form.status]}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm font-black text-white">{form.game_name || "Sin juego"}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {selectedOrder && (
                  <button onClick={() => del(selectedOrder)} type="button"
                    className="rounded-xl border border-red-500/15 p-2 text-red-500/50 transition-all hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-400 active:scale-95">
                    <Trash2 size={13} />
                  </button>
                )}
                {/* En pantalla completa el cierre es el botón "Volver". */}
                {!selectedOrder && (
                  <button onClick={closeIfConfirmed} type="button"
                    className="rounded-xl border border-white/8 p-2 text-gray-600 transition-all hover:border-white/14 hover:bg-white/5 hover:text-white active:scale-95">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {createdCode ? (
                <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="mb-2 text-xl font-black uppercase tracking-widest text-white">Orden Creada</h2>
                  <p className="mb-6 text-sm text-gray-400">El cliente ingresará al portal usando este código.</p>
                  
                  <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Código Único</p>
                    <p className="text-3xl font-black tracking-widest text-yellow-500">{createdCode}</p>
                  </div>
                  
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Link directo para el cliente</p>
                  <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-2 mb-6">
                    <input readOnly value={`${window.location.origin}/entrega/${createdCode}`} className="flex-1 bg-transparent px-2 text-[11px] text-gray-400 outline-none" />
                    
                    <a href={`/entrega/${createdCode}`} target="_blank" rel="noreferrer" 
                      className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/20 transition-colors">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Abrir</span>
                    </a>

                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/entrega/${createdCode}`);
                      showNotice("success", "Enlace copiado");
                    }} type="button" className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2 text-yellow-500 hover:bg-yellow-500/30 transition-colors">
                      <Copy size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">Copiar</span>
                    </button>
                  </div>
                  
                  <button onClick={close} type="button" className="w-full rounded-full bg-white py-3 text-xs font-black uppercase tracking-widest text-black hover:bg-gray-200 active:scale-95 transition-transform">
                    Cerrar
                  </button>
                </div>
              ) : (
                <form onSubmit={save} className="flex flex-1 flex-col overflow-hidden">
                  {/* Pestañas: solo en móvil y sobre una orden existente. En
                      escritorio se ve todo junto y no hacen falta. */}
                  {selectedOrder && !showAll && (
                    <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 pt-1">
                      {MODAL_TABS.map(({ id, label, Icon }) => {
                        const active = modalTab === id;
                        const alerta = id === "pago" && selectedOrder.payment_status === "pending" && !!selectedOrder.receipt_url;
                        return (
                          <button key={id} type="button" onClick={() => setModalTab(id)}
                            className={`relative flex items-center gap-1.5 rounded-t-xl px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                              active ? "bg-white/[0.06] text-white" : "text-gray-600 hover:text-gray-300"
                            }`}>
                            <Icon size={12} /> {label}
                            {alerta && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-yellow-500" />}
                            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-yellow-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* En escritorio es el "escritorio" donde flotan las ventanas
                      (posicionadas en absoluto); en móvil, una lista normal. */}
                  <div ref={deskRef} className={showAll
                    ? "relative flex-1 overflow-hidden"
                    : "flex-1 space-y-5 overflow-y-auto p-5 pb-8"}>

                  {selectedOrder && (showAll || modalTab === "pago") && (
                  <Shell id="pago" title="Pago" Icon={Receipt} ctx={winCtx}>
                    {selectedOrder.receipt_url ? (
                    // Comprobante a la izquierda y los datos al lado: se compara
                    // el monto transferido con el que corresponde sin scrollear.
                    <div className="flex flex-col gap-4 py-2 lg:flex-row lg:items-start">
                      <button type="button" onClick={() => setFullscreenImage(selectedOrder.receipt_url ?? null)}
                        className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 lg:flex-[1.3]">
                        <img src={selectedOrder.receipt_url} alt="Comprobante" className="max-h-[70vh] w-full bg-black/40 object-contain" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-full bg-black/80 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                            Ampliar Imagen
                          </span>
                        </span>
                      </button>

                      <div className="w-full space-y-3 lg:flex-1">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Está comprando</p>
                          <p className="mt-1 text-[13px] font-black leading-snug text-white">{selectedOrder.game_name}</p>
                          <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-gray-500">Debería pagar</p>
                          <p className="text-2xl font-black text-green-400">${fmt(selectedOrder.sale_price ?? 0)}</p>
                          <p className="mt-2 border-t border-white/5 pt-2 text-[10px] leading-relaxed text-gray-600">
                            Orden {selectedOrder.order_number ? `#${selectedOrder.order_number}` : selectedOrder.short_code}<br />
                            {fmtTime(selectedOrder.created_at)} · {fmtDate(selectedOrder.created_at)}
                          </p>
                        </div>

                        {selectedOrder.payment_status === "pending" ? (
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={async () => {
                              if(!supabase) return;
                              // "approved" es el valor que destraba el gate de pago en
                              // /entrega/[code] y deja pasar al tutorial. No cambiar.
                              await supabase.from("orders").update({ payment_status: "approved" }).eq("id", selectedOrder.id);
                              setSelectedOrder({ ...selectedOrder, payment_status: "approved" });
                              showNotice("success", "Pago aprobado");
                              onReload();
                            }} className="w-full rounded-full bg-green-500 py-2.5 text-[11px] font-black uppercase tracking-widest text-black transition-colors hover:bg-green-400 active:scale-95">
                              Aprobar Pago
                            </button>
                            <button type="button" onClick={async () => {
                              if(!supabase) return;
                              if(!confirm("¿Rechazar este comprobante y borrar la orden?")) return;
                              await supabase.from("orders").delete().eq("id", selectedOrder.id);
                              onReload();
                              close();
                            }} className="w-full rounded-full border border-red-500/20 bg-red-500/10 py-2.5 text-[11px] font-black uppercase tracking-widest text-red-500 transition-colors hover:bg-red-500/20 active:scale-95">
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-green-400">
                            <CheckCircle2 size={14} /> Pago aprobado
                          </div>
                        )}
                      </div>
                    </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <Receipt size={28} className="text-gray-700" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-600">Sin comprobante</p>
                        <p className="max-w-xs text-[11.5px] leading-snug text-gray-600">
                          {selectedOrder.payment_method === "transferencia"
                            ? "El cliente todavía no sube su comprobante de transferencia."
                            : selectedOrder.payment_method === "mercadopago"
                            ? selectedOrder.payment_status === "approved"
                              ? "Pagada por Mercado Pago y confirmada automáticamente. No hay nada que validar."
                              : "Pago por Mercado Pago sin confirmar todavía. Se aprueba sola cuando llega el aviso de Mercado Pago; no la apruebes a mano salvo que sepas que el pago entró."
                            : "Esta orden no se pagó por transferencia, así que no hay comprobante que validar."}
                        </p>
                      </div>
                    )}
                  </Shell>
                  )}

                  {selectedOrder && (showAll || modalTab === "chat") && (
                  <Shell id="chat" title="Chat con el cliente" Icon={MessageCircle} ctx={winCtx} fill>
                    <AdminOrderChat orderId={selectedOrder.id} fill={showAll} />
                  </Shell>
                  )}

                  {selectedOrder && (showAll || modalTab === "finanzas") && (
                  <Shell id="finanzas" title="Finanzas" Icon={Handshake} ctx={winCtx}>
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="rounded-xl border border-green-500/15 bg-green-500/[0.03] p-4 mt-2">
                      <div className="mb-3 flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-green-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Datos para la Venta (Auto)</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label>
                          <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Precio Venta ($)</span>
                          <input type="number" min="0" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value ? Number(e.target.value) : "" })} className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Ej: 15000" />
                        </label>
                        <label>
                          <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Precio Costo ($)</span>
                          <input type="number" min="0" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value ? Number(e.target.value) : "" })} className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Ej: 5000" />
                        </label>
                        <label>
                          <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Proveedor</span>
                          <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50 appearance-none cursor-pointer"}>
                            <option value="">- Seleccionar -</option>
                            {providers.filter(p => p.is_active).map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                            <input type="checkbox" checked={splitEnabled} onChange={e => setSplitEnabled(e.target.checked)}
                              className="h-3.5 w-3.5 rounded accent-pink-500" />
                            <Handshake size={13} className="text-pink-400" /> Dividir ganancia con {partnerName}
                          </label>
                          {splitEnabled && (
                            <div className="flex items-center gap-1">
                              <input value={form.partner_pct} onChange={e => setForm({ ...form, partner_pct: e.target.value === "" ? "" : Number(e.target.value.replace(/[^0-9]/g, "")) })}
                                inputMode="numeric"
                                className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-sm font-black text-white outline-none focus:border-pink-500" />
                              <span className="text-xs font-black text-gray-500">%</span>
                            </div>
                          )}
                        </div>
                        {splitEnabled && Number(form.sale_price) > 0 && (
                          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                            <span className="text-gray-500">
                              {partnerName} ({Number(form.partner_pct) || 0}%): <span className="font-black text-pink-400">
                                ${Math.round((Number(form.sale_price) - Number(form.cost_price || 0)) * (Number(form.partner_pct) || 0) / 100).toLocaleString("es-CL")}
                              </span>
                            </span>
                            <span className="text-gray-500">
                              Tú ({100 - (Number(form.partner_pct) || 0)}%): <span className="font-black text-green-400">
                                ${Math.round((Number(form.sale_price) - Number(form.cost_price || 0)) * (100 - (Number(form.partner_pct) || 0)) / 100).toLocaleString("es-CL")}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="mt-2.5 text-[10px] text-gray-600">Al pasar a estado "Completada", estos datos se registrarán automáticamente en tus Ventas. Si lo vendido es un pack, se eliminará del catálogo.</p>
                    </div>
                  </div>
                  </Shell>
                  )}

                  {(!selectedOrder || showAll || modalTab === "orden") && (
                  <Shell id="orden" title="Orden" Icon={PackageCheck} ctx={winCtx}>

                  <div className="flex flex-col md:flex-row gap-5">
                    <div className="flex-[1.2] space-y-5">
                      {/* Left Column content */}
                      <div className="relative">
                        <label>
                          <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Juego / Pack comprado</span>
                          <input value={form.game_name} onChange={e => setForm({ ...form, game_name: e.target.value })}
                            onFocus={() => setShowSuggestions(true)}
                            className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Ej: Mario Kart 8 Deluxe" required />
                        </label>
                        
                        {showSuggestions && (
                          <div className="mt-2 rounded-xl border border-white/10 bg-[#0c0f12] p-2 shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 px-1">Catálogo</p>
                            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                              {suggestions.map(item => (
                                <button key={`${item.type}-${item.id}`} type="button" onClick={() => addSuggestion(item)}
                                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10 transition-colors">
                                  {item.type === "pack" ? <Gift size={13} className="text-purple-400 shrink-0" /> : <Gamepad2 size={13} className="text-blue-400 shrink-0" />}
                                  <span className="text-[12px] font-bold text-gray-300 leading-tight">{item.title}</span>
                                </button>
                              ))}
                              {suggestions.length === 0 && (
                                <p className="py-3 text-center text-[11px] text-gray-600">Sin resultados</p>
                              )}
                            </div>
                            <div className="mt-2 text-center pt-2 border-t border-white/5">
                              <button type="button" onClick={() => setShowSuggestions(false)}
                                className="text-[10px] w-full py-2 font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors rounded hover:bg-white/5">Cerrar catálogo</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedOrder && (
                        <>
                          {/* Stepper visual del progreso */}
                          <div>
                            <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Progreso de la entrega</span>
                            <div className="flex items-start rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3.5">
                              {STEPS.map((step, i) => {
                                const done = currentStepIndex > i;
                                const current = currentStepIndex === i;
                                return (
                                  <div key={step.key} className="flex flex-1 items-center">
                                    <div className="flex flex-col items-center gap-1.5">
                                      <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-black transition-all duration-300 ${
                                        current ? "border-yellow-500 bg-yellow-500 text-black shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                                        : done ? "border-green-500/40 bg-green-500/20 text-green-400"
                                        : "border-white/10 bg-white/5 text-gray-600"
                                      }`}>
                                        {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                                      </div>
                                      <span className={`text-[8px] font-black uppercase tracking-wider ${
                                        current ? "text-white" : done ? "text-green-400/70" : "text-gray-600"
                                      }`}>{step.label}</span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                      <div className={`mx-1 mt-3.5 h-0.5 flex-1 self-start rounded-full transition-colors duration-300 ${done ? "bg-green-500/40" : "bg-white/10"}`} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <label className="block">
                            <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Cambiar estado manualmente</span>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Order["status"] })}
                              className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50 appearance-none cursor-pointer"}>
                              <option value="draft">0 · Borrador (Nueva Consulta)</option>
                              <option value="pending_console_code">1 · Esperando código del cliente</option>
                              <option value="pending_setup">2 · Código recibido</option>
                              <option value="preparing">3 · Avisado (prepárate, 85%)</option>
                              <option value="ready">4 · Credenciales entregadas</option>
                              <option value="completed">5 · Entrega completa</option>
                              <option value="issue">⚠ Problema en instalación (soporte)</option>
                            </select>
                          </label>

                          <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-4 mt-2">
                            <div className="mb-3 flex items-center gap-2">
                              <KeyRound size={13} className="text-yellow-500" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-white">Datos que recibirá el cliente</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Código (5 dígitos)</span>
                                <input inputMode="numeric" value={form.account_email}
                                  onChange={e => setForm({ ...form, account_email: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                                  className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50 text-center font-mono text-lg font-black tracking-[0.4em]"} placeholder="12345" maxLength={5} />
                              </label>

                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Contraseña</span>
                                <input type="text" value={form.account_password} onChange={e => setForm({ ...form, account_password: e.target.value })}
                                  className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Contraseña123" />
                              </label>
                            </div>
                            <p className="mt-2.5 text-[10px] text-gray-600">El cliente verá estos datos al marcar la orden como "Listo".</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex-[0.8] space-y-5">
                      {/* Right Column content */}
                      {!selectedOrder && (
                        <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.04] p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <PackageCheck size={14} className="text-yellow-500" />
                            <p className="text-[11px] font-black uppercase tracking-widest text-white">Cómo funciona</p>
                          </div>
                          <ol className="space-y-2 text-[11.5px] leading-tight text-gray-400">
                            <li className="flex gap-2.5"><span className="font-black text-yellow-500">1.</span> Escribe el juego o pack que compró el cliente.</li>
                            <li className="flex gap-2.5"><span className="font-black text-yellow-500">2.</span> Se genera un <b className="text-gray-200">código único (ALF-XXXX)</b> y un link.</li>
                            <li className="flex gap-2.5"><span className="font-black text-yellow-500">3.</span> Le envías el link al cliente por WhatsApp.</li>
                          </ol>
                        </div>
                      )}

                      {selectedOrder && form.status !== 'draft' && (
                        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-4">
                          <div className="mb-2.5 flex items-center gap-2">
                            <Hash size={13} className="text-gray-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Código proporcionado por el cliente</p>
                          </div>
                          {selectedOrder.console_code ? (
                            <div className="flex flex-col items-center gap-2.5">
                              <div className="flex w-full items-center gap-2">
                                <p className="flex-1 rounded-xl border border-white/10 bg-black/30 p-3.5 text-center font-mono text-2xl font-black tracking-[0.25em] text-white">{selectedOrder.console_code}</p>
                                <button type="button" title="Copiar código"
                                  onClick={() => { navigator.clipboard.writeText(selectedOrder.console_code || ""); showNotice("success", "Código del cliente copiado"); }}
                                  className="flex shrink-0 items-center justify-center self-stretch rounded-xl border border-white/10 bg-white/5 px-3.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95">
                                  <Copy size={16} />
                                </button>
                              </div>
                              {form.status === "pending_setup" ? (
                                <button type="button" onClick={async () => {
                                  if (!supabase) return;
                                  const { error } = await supabase.from("orders").update({ status: "preparing" }).eq("id", selectedOrder.id);
                                  if (error) { showNotice("error", `No se pudo avisar: ${error.message}`); return; }
                                  setForm({ ...form, status: "preparing" });
                                  showNotice("success", "Cliente avisado — barra al 85%.");
                                  await onReload();
                                }} className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors border border-green-500/30 rounded-lg py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                  <PackageCheck size={14} /> Avisar que te estás preparando (Salta a 85%)
                                </button>
                              ) : (
                                <div className="w-full rounded-lg border border-white/8 bg-white/[0.03] py-2 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500 flex items-center justify-center gap-2">
                                  <CheckCircle2 size={13} className="text-green-500/70" /> Cliente ya avisado
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 italic">El cliente aún no ha ingresado el código.</p>
                          )}
                          <p className="text-[10px] text-gray-600 mt-2">
                            Usa este código en la web de Nintendo para vincular la cuenta. Luego ingresa las credenciales abajo y cambia el estado a "Listo".
                          </p>
                        </div>
                      )}

                      {selectedOrder && (
                        <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4 mt-2">
                          <div className="mb-2 flex items-center gap-2">
                            <Copy size={13} className="text-blue-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Link para el cliente</p>
                          </div>
                          <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-2">
                            <input readOnly value={`${window.location.origin}/entrega/${selectedOrder.short_code}`} className="flex-1 bg-transparent px-2 text-[11px] text-gray-400 outline-none" />
                            <button onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/entrega/${selectedOrder.short_code}`);
                              showNotice("success", "Enlace copiado");
                            }} type="button" className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2 text-blue-400 hover:bg-blue-500/30 transition-colors">
                              <span className="text-[10px] font-bold uppercase tracking-wider">Copiar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </Shell>
                  )}
                  </div>
  
                  {/* Barra inferior: acciones compactas + ventanas minimizadas,
                      para poder traerlas de vuelta. */}
                  {(!selectedOrder || showAll || modalTab === "orden" || modalTab === "finanzas") && (
                  <div className={`shrink-0 border-t border-white/[0.06] bg-[rgb(9,9,11)] px-4 py-2.5 ${
                    showAll ? "flex items-center gap-2" : "space-y-2.5"
                  }`}>
                    {showAll && (
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {/* Se listan los slots minimizados, etiquetados por la
                            sección que tengan asignada en ese momento. */}
                        {(Object.keys(wins) as WinId[]).filter(slot => wins[slot].minimized).map(slot => {
                          const tab = MODAL_TABS.find(t => t.id === wins[slot].section)!;
                          return (
                            <button key={slot} type="button"
                              onClick={() => { patchWin(slot, { minimized: false }); focusWin(slot); }}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 hover:text-white">
                              <tab.Icon size={11} /> {tab.label}
                            </button>
                          );
                        })}
                        {(Object.keys(wins) as WinId[]).every(slot => !wins[slot].minimized) && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">
                            Arrastra por el título · cambia la sección en su menú · 🔒 fija la ventana
                          </span>
                        )}
                      </div>
                    )}

                    <button disabled={loading}
                      className={`flex items-center justify-center gap-2 rounded-full bg-yellow-500 text-[10px] font-black uppercase tracking-widest text-black transition-all duration-200 hover:bg-yellow-400 disabled:opacity-50 active:scale-[0.98] ${
                        showAll ? "px-4 py-2" : "w-full py-2.5 text-xs"
                      }`}>
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {loading ? (selectedOrder ? "Guardando…" : "Creando…") : (selectedOrder ? "Guardar" : "Crear Orden")}
                    </button>

                    {selectedOrder && (
                      <button type="button" onClick={restartOrder} disabled={loading}
                        className={`flex items-center justify-center gap-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-400 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-50 active:scale-[0.98] ${
                          showAll ? "px-4 py-2" : "w-full py-2.5"
                        }`}>
                        <RefreshCw size={12} /> {showAll ? "Reiniciar" : "Editar Orden (reiniciar proceso)"}
                      </button>
                    )}
                  </div>
                  )}
                </form>
              )}
            </div>
    </>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* Header */}
      <div className="flex shrink-0 flex-col border-b border-white/[0.06]">
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex-1">
            <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Entregas</h1>
            <p className="mt-0.5 text-[10px] text-gray-600">
              {orders.length} órdenes totales
              {cancelledOrders.length > 0 && ` · ${cancelledOrders.length} canceladas por el cliente`}
            </p>
          </div>
          <button onClick={onReload} disabled={loading} className="rounded-full bg-white/5 p-2 text-white hover:bg-white/10 active:scale-95 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={newOrder}
            className="flex items-center gap-1.5 rounded-full bg-yellow-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all duration-200 hover:bg-yellow-400 active:scale-95">
            <Plus size={12} strokeWidth={3} /> Nueva
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-2 pb-2">
          <button onClick={() => setActiveTab('validacion')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'validacion' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Validación {counts.drafts > 0 && <span className="bg-purple-500 text-black px-1.5 py-0.5 rounded-full text-[8px]">{counts.drafts}</span>}</span>
          </button>
          <button onClick={() => setActiveTab('active')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'active' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Activas {counts.active > 0 && <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">{counts.active}</span>}</span>
          </button>
          <button onClick={() => setActiveTab('problemas')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'problemas' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Problemas {counts.issues > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">{counts.issues}</span>}</span>
          </button>
          <button onClick={() => setActiveTab('completadas')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'completadas' ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Completadas {counts.history > 0 && <span className="bg-slate-400 text-black px-1.5 py-0.5 rounded-full text-[8px]">{counts.history}</span>}</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
        
        {/* Vista: Nuevas Consultas (Borradores) */}
        {activeTab === 'validacion' && (
          <div>
            {draftOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <HelpCircle size={24} className="text-gray-800" />
                <p className="text-xs text-gray-700">Nada por validar</p>
                <p className="text-[10px] text-gray-600 max-w-[240px]">
                  Aquí aparecen solo las transferencias con comprobante subido, esperando que lo revises.
                </p>
              </div>
            ) : (
              <div className="p-4 mb-2 bg-purple-500/5 border-b border-purple-500/10">
                 <p className="text-[10px] text-purple-400 font-bold">
                   Cada una subió su comprobante y espera que lo apruebes o lo rechaces.
                 </p>
              </div>
            )}
            {draftOrders.map(item => <OrderItem key={item.id} item={item} />)}

            {/* Compras a medio camino: eligieron pagar y no completaron. Van
                plegadas porque no hay nada que hacer con ellas todavía. */}
            {awaitingPayment.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowAwaiting(v => !v)}
                  className="flex w-full items-center gap-2 border-y border-white/5 bg-[rgb(12,12,14)] px-6 py-2 text-left"
                >
                  <Clock size={12} className="text-gray-600" />
                  <h2 className="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Esperando pago ({awaitingPayment.length})
                  </h2>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-700">
                    {showAwaiting ? "Ocultar" : "Ver"}
                  </span>
                </button>

                {showAwaiting && (
                  <>
                    <p className="px-6 py-2 text-[10px] leading-relaxed text-gray-600">
                      Eligieron un método de pago y no completaron. Las de Mercado Pago se aprueban solas
                      cuando llega la confirmación; las de transferencia, cuando suban su comprobante.
                    </p>
                    {awaitingPayment.map(item => <OrderItem key={item.id} item={item} />)}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vista: Activas (Agrupadas por secciones) */}
        {activeTab === 'active' && (
          <div>
            {activeOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PackageCheck size={24} className="text-gray-800" />
                <p className="text-xs text-gray-700">No hay entregas activas</p>
              </div>
            ) : (
              activeSections.map((section, i) => (
                section.items.length > 0 && (
                  <div key={section.status} className="mb-6">
                    {/* Cabecera de estado: numerada para que se lea como las
                        etapas por las que va pasando la entrega. */}
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-white/5 bg-[rgb(12,12,14)] px-6 py-2">
                       <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[8px] font-black text-gray-300">{i + 1}</span>
                       <section.icon size={13} className={section.color || "text-gray-500"} />
                       <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">{section.label} ({section.items.length})</h2>
                    </div>
                    {section.items.map(item => <OrderItem key={item.id} item={item} />)}
                  </div>
                )
              ))
            )}
          </div>
        )}

        {/* Vista: Problemas (tickets abiertos) */}
        {activeTab === 'problemas' && (
          <div>
            {issueOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <CheckCircle2 size={24} className="text-gray-800" />
                <p className="text-xs text-gray-700">Sin problemas abiertos</p>
                <p className="max-w-[220px] text-[10px] text-gray-600">Aquí aparecen las entregas donde el cliente reportó un problema durante la instalación.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 border-b border-red-500/10 bg-red-500/5 p-4">
                  <p className="text-[10px] font-bold text-red-400">
                    Cada uno es un ticket abierto. Ábrelo para hablar con el cliente por el chat y, cuando esté solucionado, márcalo como resuelto: la orden vuelve a Activas donde quedó.
                  </p>
                </div>
                {issueOrders.map(item => (
                  <div key={item.id} className="flex items-center gap-2 border-b border-white/[0.04] pr-4">
                    <div className="min-w-0 flex-1">
                      <OrderItem item={item} />
                    </div>
                    <button type="button" onClick={() => resolverProblema(item)} disabled={loading}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50">
                      <Check size={12} strokeWidth={3} /> Resuelto
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Vista: Historial */}
        {activeTab === 'completadas' && (
          <div>
            {historyOrders.length > 0 && (
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[rgb(9,9,11)] px-4 py-3">
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Buscar por juego, orden o código..."
                    className="w-full rounded-xl border border-white/8 bg-white/5 py-2 pl-9 pr-3 text-[12px] text-white outline-none placeholder:text-gray-700 focus:border-yellow-500/40"
                  />
                </div>
              </div>
            )}

            {filteredHistoryOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <CheckCircle2 size={24} className="text-gray-800" />
                <p className="text-xs text-gray-700">
                  {historySearch ? "Sin resultados para tu búsqueda" : "No hay historial"}
                </p>
              </div>
            ) : (
              historyGroups.map(([month, items]) => (
                <div key={month}>
                  <div className="flex items-center gap-2 px-6 py-2 bg-[rgb(12,12,14)] border-y border-white/5">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400 capitalize">{month} ({items.length})</h2>
                  </div>
                  <div className="md:hidden">
                    {items.map(item => <OrderItem key={item.id} item={item} />)}
                  </div>
                  <HistoryTable items={items} onSelect={select} />
                </div>
              ))
            )}

            {/* Canceladas: quedan como registro, no como pendientes. Se pueden
                borrar una por una cuando ya no sirvan de referencia. */}
            {cancelledOrders.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowCancelled(v => !v)}
                  className="flex w-full items-center gap-2 border-y border-white/5 bg-[rgb(12,12,14)] px-6 py-2 text-left"
                >
                  <X size={12} className="text-gray-600" />
                  <h2 className="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Canceladas por el cliente ({cancelledOrders.length})
                  </h2>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-700">
                    {showCancelled ? "Ocultar" : "Ver"}
                  </span>
                </button>

                {showCancelled && cancelledOrders.map(item => (
                  <div key={item.id} className="flex items-center gap-2 border-b border-white/[0.04] pr-4 opacity-60">
                    <div className="min-w-0 flex-1">
                      <OrderItem item={item} />
                    </div>
                    <button
                      type="button"
                      onClick={() => del(item)}
                      disabled={loading}
                      title="Eliminar del registro"
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-500/70 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 size={11} /> Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel de la orden. Una orden existente ocupa toda la pantalla del
          admin: hay demasiado (datos, pago, chat, finanzas) para un modal.
          Crear una orden nueva es un formulario corto, así que sigue en modal. */}
      {modalOpen && (selectedOrder ? (
        <div className="absolute inset-0 z-30 flex flex-col overflow-hidden" style={{ background: "rgb(9,9,11)" }}>
          {orderPanel}
        </div>
      ) : createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeIfConfirmed} />

          <div className="animate-soft-in relative z-10 flex h-full w-full sm:max-w-4xl flex-col overflow-hidden sm:h-auto sm:min-h-[500px] sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-white/[0.07]"
            style={{ background: "rgb(9,9,11)" }}>
            {orderPanel}
          </div>
        </div>,
        document.body,
      ))}

      {/* Comprobante ampliado */}
      {fullscreenImage && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setFullscreenImage(null)}
        >
          <button type="button" onClick={() => setFullscreenImage(null)} aria-label="Cerrar"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
            <X size={18} />
          </button>
          <img src={fullscreenImage} alt="Comprobante" className="max-h-full max-w-full object-contain" />
        </div>,
        document.body,
      )}
    </div>
  );
}
