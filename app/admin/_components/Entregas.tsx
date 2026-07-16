"use client";

import { FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, CheckCircle2, Clock, Loader2, PackageCheck, Plus, RefreshCw, Save, Trash2, X, Search, Gamepad2, Gift, Copy, KeyRound, Hash, Check, HelpCircle, Handshake
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Order, AdminGame, AdminPack, Provider, SettingsState } from "../_types";
import { fmt, fmtDate } from "../_helpers";

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
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  
  // Tabs: Nuevas (drafts), Activas, Historial
  const [activeTab, setActiveTab] = useState<'drafts' | 'active' | 'history'>('active');

  // Búsqueda dentro del Historial
  const [historySearch, setHistorySearch] = useState("");

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

  const draftOrders = useMemo(() => orders.filter(o => o.status === 'draft'), [orders]);
  const activeOrders = useMemo(() => orders.filter(o => !['draft', 'completed', 'issue'].includes(o.status)), [orders]);
  const historyOrders = useMemo(() => orders.filter(o => ['completed', 'issue'].includes(o.status)), [orders]);

  const counts = {
    drafts: draftOrders.length,
    active: activeOrders.length,
    history: historyOrders.length,
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
    setSelectedOrder(o); setForm(toForm(o)); setSplitEnabled(o.partner_pct != null);
    setQuery(""); setShowSuggestions(false); setCreatedCode(null); setModalOpen(true);
  };
  const newOrder = () => {
    setSelectedOrder(null); setForm({ ...emptyForm, partner_pct: Number(settings.partnerSplitPct) || 40 }); setSplitEnabled(false);
    setQuery(""); setShowSuggestions(false); setCreatedCode(null); setModalOpen(true);
  };
  const close = () => { setModalOpen(false); setSelectedOrder(null); setShowSuggestions(false); setCreatedCode(null); };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    const finalGameName = form.game_name.replace(/\+\s*$/, '').trim();

    // Solo se guardan los ids de packs cuyo título siga apareciendo en el texto
    // final — si el admin borró esa parte a mano, no se arrastra un id viejo.
    // Si pack_ids es null (orden vieja, nunca se supo con certeza) se mantiene
    // null: así el trigger sigue usando el respaldo por texto solo para ella,
    // en vez de asumir "cero packs" y saltarse ese respaldo por error.
    const finalGameNameLower = finalGameName.toLowerCase();
    const validPackIds = form.pack_ids === null ? null : form.pack_ids.filter(id => {
      const pack = (packs || []).find(p => p.id === id);
      return pack && finalGameNameLower.includes(pack.title.toLowerCase());
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
          <p className="truncate text-[13px] font-bold leading-tight text-white">
            {item.order_number ? `Orden #${item.order_number}` : item.short_code} · {item.game_name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-gray-600">
            {item.short_code} · {fmtDate(item.created_at)} {item.console_code ? `· Código Cliente: ${item.console_code}` : ''}
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

  // Tabla de Historial para desktop: aprovecha el ancho disponible mostrando
  // precio y ganancia sin tener que abrir cada orden.
  const HistoryTable = ({ items }: { items: Order[] }) => (
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
            <tr key={item.id} onClick={() => select(item)}
              className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]">
              <td className="px-4 py-2.5 text-[11px] font-bold text-gray-400">{item.order_number ? `#${item.order_number}` : item.short_code}</td>
              <td className="max-w-[240px] truncate px-2 py-2.5 text-[12px] font-bold text-white">{item.game_name}</td>
              <td className="px-2 py-2.5 text-[11px] text-gray-500">{fmtDate(item.created_at)}</td>
              <td className="px-2 py-2.5 text-[11px] text-gray-500">{item.console_code || "—"}</td>
              <td className="px-2 py-2.5 text-right text-[11px] font-bold text-gray-300">{item.sale_price ? `$${fmt(item.sale_price)}` : "—"}</td>
              <td className="px-2 py-2.5 text-right text-[11px] font-bold text-green-400">{item.sale_price ? `$${fmt(yourCut)}` : "—"}</td>
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

  return (
    <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
      {/* Header */}
      <div className="flex shrink-0 flex-col border-b border-white/[0.06]">
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex-1">
            <h1 className="text-base font-black uppercase tracking-[0.15em] text-white">Entregas</h1>
            <p className="mt-0.5 text-[10px] text-gray-600">{orders.length} órdenes totales</p>
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
          <button onClick={() => setActiveTab('drafts')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'drafts' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Nuevas {counts.drafts > 0 && <span className="bg-purple-500 text-black px-1.5 py-0.5 rounded-full text-[8px]">{counts.drafts}</span>}</span>
          </button>
          <button onClick={() => setActiveTab('active')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'active' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Activas {counts.active > 0 && <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">{counts.active}</span>}</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'history' ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20' : 'text-gray-500 hover:bg-white/5 border border-transparent'}`}>
            <span className="flex items-center gap-1.5">Historial {counts.history > 0 && <span className="bg-slate-400 text-black px-1.5 py-0.5 rounded-full text-[8px]">{counts.history}</span>}</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-32 md:pb-0">
        
        {/* Vista: Nuevas Consultas (Borradores) */}
        {activeTab === 'drafts' && (
          <div>
            {draftOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <HelpCircle size={24} className="text-gray-800" />
                <p className="text-xs text-gray-700">No hay consultas recientes</p>
                <p className="text-[10px] text-gray-600 max-w-[200px]">Cuando un cliente pregunte por WhatsApp, aparecerá aquí por 15 minutos.</p>
              </div>
            ) : (
              <div className="p-4 mb-2 bg-purple-500/5 border-b border-purple-500/10">
                 <p className="text-[10px] text-purple-400 font-bold">Estas órdenes fueron generadas automáticamente y expirarán en 15 minutos si no las confirmas.</p>
              </div>
            )}
            {draftOrders.map(item => <OrderItem key={item.id} item={item} />)}
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
              activeSections.map(section => (
                section.items.length > 0 && (
                  <div key={section.status} className="mb-6">
                    <div className="flex items-center gap-2 px-6 py-2 bg-[rgb(12,12,14)] border-y border-white/5">
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

        {/* Vista: Historial */}
        {activeTab === 'history' && (
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
                  <HistoryTable items={items} />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={close} />

          <div className="animate-soft-in relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden sm:h-auto sm:min-h-[500px] sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-white/[0.07]"
            style={{ background: "rgb(9,9,11)" }}>
            <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.05] bg-gradient-to-b from-white/[0.04] to-transparent px-5 py-4">
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10 sm:flex">
                <PackageCheck size={18} className="text-yellow-500" />
              </div>
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
                <button onClick={close} type="button"
                  className="rounded-xl border border-white/8 p-2 text-gray-600 transition-all hover:border-white/14 hover:bg-white/5 hover:text-white active:scale-95">
                  <X size={13} />
                </button>
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
                  <div className="flex-1 space-y-5 overflow-y-auto p-5 pb-8">

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

                  <div className="relative">
                    <label>
                      <span className={LABEL}>Juego / Pack comprado</span>
                      <input value={form.game_name} onChange={e => setForm({ ...form, game_name: e.target.value })}
                        onFocus={() => setShowSuggestions(true)}
                        className={INPUT} placeholder="Ej: Mario Kart 8 Deluxe" required />
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
                        <span className={LABEL}>Progreso de la entrega</span>
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
                        <span className={LABEL}>Cambiar estado manualmente</span>
                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Order["status"] })}
                          className={INPUT + " appearance-none cursor-pointer"}>
                          <option value="draft">0 · Borrador (Nueva Consulta)</option>
                          <option value="pending_console_code">1 · Esperando código del cliente</option>
                          <option value="pending_setup">2 · Código recibido</option>
                          <option value="preparing">3 · Avisado (prepárate, 85%)</option>
                          <option value="ready">4 · Credenciales entregadas</option>
                          <option value="completed">5 · Entrega completa</option>
                          <option value="issue">⚠ Problema en instalación (soporte)</option>
                        </select>
                      </label>

                      <div className="rounded-xl border border-green-500/15 bg-green-500/[0.03] p-4 mt-2">
                        <div className="mb-3 flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-green-500" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Datos para la Venta (Auto)</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <label>
                            <span className={LABEL}>Precio Venta ($)</span>
                            <input type="number" min="0" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value ? Number(e.target.value) : "" })} className={INPUT} placeholder="Ej: 15000" />
                          </label>
                          <label>
                            <span className={LABEL}>Precio Costo ($)</span>
                            <input type="number" min="0" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value ? Number(e.target.value) : "" })} className={INPUT} placeholder="Ej: 5000" />
                          </label>
                          <label>
                            <span className={LABEL}>Proveedor</span>
                            <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={INPUT + " appearance-none cursor-pointer"}>
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

                      <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-4 mt-2">
                        <div className="mb-3 flex items-center gap-2">
                          <KeyRound size={13} className="text-yellow-500" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Datos que recibirá el cliente</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <label>
                            <span className={LABEL}>Código (5 dígitos)</span>
                            <input inputMode="numeric" value={form.account_email}
                              onChange={e => setForm({ ...form, account_email: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                              className={INPUT + " text-center font-mono text-lg font-black tracking-[0.4em]"} placeholder="12345" maxLength={5} />
                          </label>

                          <label>
                            <span className={LABEL}>Contraseña</span>
                            <input type="text" value={form.account_password} onChange={e => setForm({ ...form, account_password: e.target.value })}
                              className={INPUT} placeholder="Contraseña123" />
                          </label>
                        </div>
                        <p className="mt-2.5 text-[10px] text-gray-600">El cliente verá estos datos al marcar la orden como "Listo".</p>
                      </div>

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
                    </>
                  )}

                  </div>

                  <div className="shrink-0 space-y-2.5 border-t border-white/[0.06] bg-[rgb(9,9,11)] p-4">
                    <button disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-yellow-500 py-3 text-xs font-black uppercase tracking-widest text-black transition-all duration-200 hover:bg-yellow-400 disabled:opacity-50 active:scale-[0.98]">
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {loading ? (selectedOrder ? "Guardando…" : "Creando…") : (selectedOrder ? "Guardar Orden" : "Crear Orden")}
                    </button>

                    {selectedOrder && (
                      <button type="button" onClick={restartOrder} disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-3 text-xs font-black uppercase tracking-widest text-gray-400 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-50 active:scale-[0.98]">
                        <RefreshCw size={13} /> Editar Orden (reiniciar proceso)
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
