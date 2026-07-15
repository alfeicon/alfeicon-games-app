"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff,
  Gamepad2, Gift, Home, Loader2, LogOut, Newspaper, Receipt, Settings, ShieldCheck, PackageCheck, LayoutGrid, X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { DEFAULT_APP_SETTINGS, SETTING_KEYS } from "@/lib/settings";
import { PARTNER_PCT_KEY } from "./_helpers";
import type { AdminGame, AdminPack, AdminNews, AdSpend, AdminSection, Provider, Sale, SettingsState } from "./_types";
import { Inicio } from "./_components/Inicio";
import { JuegosCatalog } from "./_components/JuegosCatalog";
import { PacksCatalog } from "./_components/PacksCatalog";
import { Noticias } from "./_components/Noticias";
import { Ventas } from "./_components/Ventas";
import { Entregas } from "./_components/Entregas";
import { Ajustes } from "./_components/Ajustes";
import { SaleModal } from "./_components/SaleModal";
import type { Order } from "./_types";

const defaultSettings: SettingsState = {
  nintendoOnlinePrice: String(DEFAULT_APP_SETTINGS.nintendoOnlinePrice),
  packPriceIncrease: String(DEFAULT_APP_SETTINGS.packPriceIncrease),
  partnerSplitPct: "40",
};

const NAV_ITEMS: { id: AdminSection; label: string; Icon: React.ElementType; accent: string }[] = [
  { id: "inicio",  label: "Inicio",  Icon: Home,     accent: "text-white" },
  { id: "juegos",  label: "Juegos",  Icon: Gamepad2, accent: "text-blue-400" },
  { id: "packs",   label: "Packs",   Icon: Gift,     accent: "text-purple-400" },
  { id: "entregas", label: "Entregas", Icon: PackageCheck, accent: "text-yellow-400" },
  { id: "noticias", label: "Noticias", Icon: Newspaper, accent: "text-orange-400" },
  { id: "ventas",  label: "Ventas",  Icon: Receipt,  accent: "text-green-400" },
  { id: "ajustes", label: "Ajustes", Icon: Settings,  accent: "text-gray-400" },
];

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");

  const [section, setSection] = useState<AdminSection>("inicio");
  const [sectionKey, setSectionKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const noticeTimer = useRef<number | null>(null);

  const [games, setGames] = useState<AdminGame[]>([]);
  const [packs, setPacks] = useState<AdminPack[]>([]);
  const [news, setNews] = useState<AdminNews[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [adSpend, setAdSpend] = useState<AdSpend[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [salesTableExists, setSalesTableExists] = useState<boolean | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [newsTableExists, setNewsTableExists] = useState<boolean | null>(null);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const didLoadRef = useRef(false);

  const showNotice = useCallback((type: "success" | "error", text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500) as unknown as number;

    // Reportar a Telegram si es un error
    if (type === "error") {
      fetch("/api/notify-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, source: "Panel Admin Web" }),
      }).catch(console.error);
    }
  }, []);

  const loadGames = useCallback(async () => {
    if (!supabase) return;
    let { data, error } = await supabase
      .from("games")
      .select("id,title,price,cost_price,image_url,storage_required,console,is_offer,offer_price,is_active")
      .order("title", { ascending: true });
    if (error?.message?.toLowerCase().includes("console")) {
      const fb = await supabase
        .from("games")
        .select("id,title,price,cost_price,image_url,storage_required,is_offer,offer_price,is_active")
        .order("title", { ascending: true });
      data = fb.data?.map(g => ({ ...g, console: "switch" })) || null;
      error = fb.error;
    }
    if (error) {
      console.error("[loadGames]", error);
      showNotice("error", `No se pudieron cargar los juegos: ${error.message}`);
      return;
    }
    setGames((data || []) as AdminGame[]);
  }, [showNotice]);

  const loadPacks = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("packs")
      .select("id,title,price,cost_price,image_url,console,is_new,is_active,pack_items(title,sort_order)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[loadPacks]", error);
      showNotice("error", `No se pudieron cargar los packs: ${error.message}`);
      return;
    }
    setPacks((data || []) as AdminPack[]);
  }, [showNotice]);

  const loadNews = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("news")
      .select("id,title,description,image_url,is_active,sort_order,created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      const code = error.code ?? "";
      const msg = error.message ?? "";
      const tableNotFound = code === "42P01" || code === "PGRST205" || (msg.includes("relation") && msg.includes("does not exist"));
      setNewsTableExists(tableNotFound ? false : true);
      if (tableNotFound) setNews([]);
      return;
    }
    setNewsTableExists(true);
    setNews((data || []) as AdminNews[]);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[loadOrders]", error);
      showNotice("error", `No se pudieron cargar las entregas: ${error.message}`);
      return;
    }
    setOrders((data || []) as Order[]);
  }, [showNotice]);

  const loadSales = useCallback(async () => {
    if (!supabase) return;
    setSalesError(null);
    const { data, error } = await supabase
      .from("sales")
      .select("id,item_type,item_id,item_title,price_sold,cost_price,payment_method,provider,notes,partner_pct,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      const code = error.code ?? "";
      const msg = error.message ?? "";
      const tableNotFound = code === "42P01" || code === "PGRST205" || (msg.includes("relation") && msg.includes("does not exist"));
      setSalesTableExists(tableNotFound ? false : true);
      setSalesError(`[${code}] ${msg}`);
      if (tableNotFound) setSales([]);
      return;
    }
    setSalesTableExists(true);
    setSalesError(null);
    setSales((data || []) as Sale[]);
  }, []);

  const loadAdSpend = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("ad_spend")
      .select("id,platform,amount,description,date,created_at")
      .order("date", { ascending: false })
      .limit(200);
    if (error) { console.error("[loadAdSpend]", error); return; }
    setAdSpend((data || []) as AdSpend[]);
    // ad_spend no es crítico: si falla (tabla/políticas faltantes) solo lo logueamos
  }, []);

  const loadProviders = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("providers")
      .select("id,name,is_active")
      .order("name", { ascending: true });
    if (error) { console.error("[loadProviders]", error); return; }
    setProviders((data || []) as Provider[]);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("app_settings").select("key,value").in("key", [...Object.values(SETTING_KEYS), PARTNER_PCT_KEY]);
    if (error) { setSettings(defaultSettings); return; }
    const rows = new Map((data || []).map(r => [r.key, r.value]));
    setSettings({
      nintendoOnlinePrice: String(rows.get(SETTING_KEYS.nintendoOnlinePrice) || DEFAULT_APP_SETTINGS.nintendoOnlinePrice),
      packPriceIncrease: String(rows.get(SETTING_KEYS.packPriceIncrease) || DEFAULT_APP_SETTINGS.packPriceIncrease),
      partnerSplitPct: String(rows.get(PARTNER_PCT_KEY) ?? defaultSettings.partnerSplitPct),
    });
  }, []);

  const navigate = (s: AdminSection) => {
    setSection(s);
    setSectionKey(k => k + 1);
    if (s === "ventas") {
      loadSales();
      loadAdSpend();
    }
    if (s === "entregas") {
      loadOrders();
    }
  };

  const loadAll = useCallback(async () => {
    // 1. Cargar primero lo indispensable para la pantalla de Inicio
    try {
      await Promise.all([loadGames(), loadPacks(), loadSales()]);
    } catch (err) {
      console.error("[loadAll] Error inesperado (posible AdBlock o fallo de red):", err);
      showNotice("error", "Error de conexión. Revisa tu internet o desactiva tu AdBlock.");
    } finally {
      setFirstLoadDone(true);
    }

    // 2. Cargar el resto en segundo plano (escalonado para no saturar la conexión / rate limits)
    setTimeout(() => {
      loadOrders().catch(console.error);
      loadNews().catch(console.error);
    }, 100);
    setTimeout(() => {
      loadAdSpend().catch(console.error);
      loadSettings().catch(console.error);
      loadProviders().catch(console.error);
    }, 300);
  }, [loadGames, loadPacks, loadSales, loadOrders, loadNews, loadAdSpend, loadSettings, loadProviders]);

  useEffect(() => {
    if (!supabase) return;
    // getSession() y onAuthStateChange(INITIAL_SESSION) se disparan casi juntos:
    // este ref evita que loadAll corra dos veces y duplique las consultas.
    const runLoadOnce = () => {
      if (didLoadRef.current) return;
      didLoadRef.current = true;
      loadAll();
    };
    supabase.auth.getSession().then(({ data }) => {
      const ok = Boolean(data.session);
      setIsLoggedIn(ok); setSessionReady(true);
      if (ok) runLoadOnce();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      const ok = Boolean(session);
      setIsLoggedIn(ok);
      if (ok) runLoadOnce();
      if (!ok) {
        didLoadRef.current = false;
        setFirstLoadDone(false);
        setGames([]); setPacks([]); setNews([]); setSales([]); setAdSpend([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadAll]);

  // Realtime para actualizar las Entregas y notificar
  useEffect(() => {
    if (!supabase || !isLoggedIn) return;
    const channel = supabase
      .channel("admin_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        loadOrders();
        
        // Notificaciones visuales
        if (payload.eventType === "INSERT") {
          const num = payload.new.order_number ? `#${payload.new.order_number}` : '';
          showNotice("success", `¡Nueva orden ${num} creada!`);
        } else if (payload.eventType === "UPDATE") {
          const old = payload.old as Order;
          const updated = payload.new as Order;
          if (!old.console_code && updated.console_code) {
             const num = updated.order_number ? `#${updated.order_number}` : '';
             showNotice("success", `¡Código recibido en la orden ${num}: ${updated.console_code}!`);
          }
        }
      })
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [isLoggedIn, loadOrders, showNotice]);

  const signIn = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    setLoading(true); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setAuthError("Login inválido o usuario sin acceso.");
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setGames([]); setPacks([]); setNews([]); setSales([]); setAdSpend([]);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b0d]">
        <Loader2 className="animate-spin text-gray-700" size={22} />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#090b0d] p-8 text-center">
        <ShieldCheck size={36} className="text-gray-700" />
        <p className="text-lg font-black uppercase tracking-widest">Panel no disponible</p>
        <p className="max-w-xs text-sm text-gray-600">Supabase no está configurado en este entorno.</p>
        <Link href="/" className="mt-2 text-xs font-black text-gray-600 hover:text-white transition-colors">← Volver al inicio</Link>
      </div>
    );
  }

  // ── Login ────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#090b0d] p-6">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-3xl" />

        <div className="animate-soft-in relative z-10 w-full max-w-sm">
          <div className="mb-10">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-widest">Acceso admin</h1>
            <p className="mt-1 text-sm text-gray-600">Panel de gestión Alfeicon</p>
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-600">Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="premium-control w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all focus:border-white/30" />
            </label>
            <label className="block">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Contraseña</span>
                {capsOn && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" /> Caps Lock
                  </span>
                )}
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => setCapsOn(e.getModifierState("CapsLock"))}
                  onKeyUp={e => setCapsOn(e.getModifierState("CapsLock"))}
                  required
                  className="premium-control w-full rounded-2xl py-3.5 pl-4 pr-11 text-sm outline-none transition-all focus:border-white/30" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-600 transition-colors hover:text-white">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            {authError && (
              <div className="animate-soft-in flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/8 px-3.5 py-2.5">
                <AlertCircle size={13} className="shrink-0 text-red-400" />
                <p className="text-xs font-semibold text-red-300">{authError}</p>
              </div>
            )}

            <button disabled={loading}
              className="magnetic mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-black uppercase tracking-widest text-black disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {loading ? "Verificando…" : "Entrar"}
            </button>
          </form>

          <Link href="/" className="mt-8 flex items-center gap-1.5 text-xs font-bold text-gray-700 transition-colors hover:text-gray-400">
            <ArrowLeft size={12} /> Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find(i => i.id === section) ?? NAV_ITEMS[0];

  // ── Main shell ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#090b0d]">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0c0f12]/95 px-4 py-3.5 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <activeItem.Icon size={13} className={activeItem.accent} />
          </div>
          <p className="truncate text-xs font-black uppercase tracking-widest text-white">{activeItem.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link href="/" className="rounded-lg p-2 text-gray-500 transition-colors hover:text-white">
            <ArrowLeft size={15} />
          </Link>
          <button onClick={signOut} className="rounded-lg p-2 text-gray-500 transition-colors hover:text-red-400">
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Mobile bottom dock (simplified) */}
      <div className="app-dock-wrapper md:hidden">
        <nav aria-label="Navegación admin" className="app-glass-dock relative flex h-[66px] w-full items-center justify-around overflow-hidden rounded-[2rem] px-1.5">
          {/* We only show a selection of items on the main dock */}
          {[
            NAV_ITEMS.find(i => i.id === "inicio")!,
            NAV_ITEMS.find(i => i.id === "entregas")!,
            NAV_ITEMS.find(i => i.id === "ventas")!
          ].map(({ id, label, Icon, accent }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => navigate(id)}
                className="relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-0.5">
                {active && (
                  <span className="absolute inset-x-2 top-1.5 h-[54px] rounded-[1.8rem] bg-white/[0.08]" />
                )}
                <Icon size={18} className={active ? accent : "text-white/65"} strokeWidth={active ? 2.6 : 2.1} />
                <span className={`text-[8.5px] font-black uppercase tracking-wider ${active ? "text-white" : "text-white/55"}`}>{label}</span>
              </button>
            );
          })}
          
          {/* Menu button */}
          <button onClick={() => setShowMobileMenu(true)}
            className="relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-0.5">
            <LayoutGrid size={18} className="text-white/65" strokeWidth={2.1} />
            <span className="text-[8.5px] font-black uppercase tracking-wider text-white/55">Menú</span>
          </button>
        </nav>
      </div>

      {/* Mobile Bottom Sheet Menu */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileMenu(false)} />
          <div className="animate-slide-up relative w-full rounded-t-3xl border-t border-white/[0.08] bg-[#0c0f12]/95 backdrop-blur-xl p-6 pb-10">
            <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-white/20" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black uppercase tracking-widest text-white">Navegación</h2>
              <button onClick={() => setShowMobileMenu(false)} className="rounded-full bg-white/5 p-2 text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {NAV_ITEMS.map(({ id, label, Icon, accent }) => {
                const active = section === id;
                return (
                  <button key={id} onClick={() => { navigate(id); setShowMobileMenu(false); }}
                    className="flex flex-col items-center gap-2">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all ${
                      active ? `border-${accent.split('-')[1]}-500/30 bg-${accent.split('-')[1]}-500/10` : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05]'
                    }`}>
                      <Icon size={22} className={active ? accent : "text-gray-400"} />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${active ? "text-white" : "text-gray-500"}`}>{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 border-t border-white/[0.05] pt-6 flex flex-col gap-3">
               <Link href="/" className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                 <ArrowLeft size={14} /> Ver Tienda
               </Link>
               <button onClick={() => { signOut(); setShowMobileMenu(false); }} className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 py-3 text-[10px] font-black uppercase tracking-widest text-red-400">
                 <LogOut size={14} /> Cerrar Sesión
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar (desktop) */}
      <nav
        className="relative hidden w-[210px] shrink-0 flex-col overflow-hidden md:flex"
        style={{
          background: "linear-gradient(180deg, #0c0f12 0%, #090b0d 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Subtle top glow */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 bg-gradient-to-b from-white/[0.035] to-transparent" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 px-5 py-5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ShieldCheck size={14} className="text-white/80" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/90">Admin</p>
            <p className="truncate text-[9px] font-bold tracking-widest text-gray-600">Alfeicon Games</p>
          </div>
        </div>

        {/* Nav items */}
        <div className="relative flex-1 overflow-y-auto px-2.5 py-1">
          {NAV_ITEMS.map(({ id, label, Icon, accent }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => navigate(id)}
                className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200"
                style={{
                  background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                }}>
                {/* Hover bg */}
                {!active && (
                  <span className="absolute inset-0 rounded-xl bg-white/0 transition-all duration-200 group-hover:bg-white/[0.04]" />
                )}
                {/* Active accent line */}
                {active && (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-white/60" />
                )}
                <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                  active ? accent : "text-gray-700 group-hover:text-gray-500"
                }`}
                  style={{ background: active ? "rgba(255,255,255,0.06)" : "transparent" }}>
                  <Icon size={14} />
                </div>
                <span className={`relative text-[10.5px] font-black uppercase tracking-widest transition-colors duration-200 ${
                  active ? "text-white" : "text-gray-700 group-hover:text-gray-400"
                }`}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="relative border-t border-white/[0.05] px-2.5 py-3 space-y-0.5">
          <Link href="/" className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-white/[0.04]">
            <ArrowLeft size={13} className="text-gray-700 transition-colors group-hover:text-gray-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 transition-colors group-hover:text-gray-500">Ver tienda</span>
          </Link>
          <button onClick={signOut}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-red-500/8">
            <LogOut size={13} className="text-gray-700 transition-colors group-hover:text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 transition-colors group-hover:text-red-400">Cerrar sesión</span>
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div key={sectionKey} className="flex h-full flex-col animate-soft-in">
          {section === "inicio" && (
            <Inicio games={games} packs={packs} sales={sales}
              salesTableExists={salesTableExists}
              firstLoadDone={firstLoadDone}
              onNavigate={navigate}
              onRegisterSale={() => setShowSaleModal(true)} />
          )}
          {section === "juegos" && (
            <JuegosCatalog games={games} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadGames} />
          )}
          {section === "packs" && (
            <PacksCatalog packs={packs} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadPacks} />
          )}
          {section === "noticias" && (
            <Noticias news={news} newsTableExists={newsTableExists} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadNews} />
          )}
          {section === "entregas" && (
            <Entregas orders={orders} games={games} packs={packs} providers={providers} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadOrders} />
          )}
          {section === "ventas" && (
            <Ventas sales={sales} adSpend={adSpend}
              salesTableExists={salesTableExists}
              salesError={salesError}
              loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadAll} />
          )}
          {section === "ajustes" && (
            <Ajustes settings={settings} providers={providers} loading={loading}
              setLoading={setLoading} showNotice={showNotice} onReloadProviders={loadProviders} />
          )}
        </div>

        {/* Toast */}
        {notice && (
          <div className={`animate-soft-in pointer-events-none fixed bottom-[70px] left-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-sm sm:bottom-6 sm:left-auto sm:right-6 ${
            notice.type === "success"
              ? "border border-green-500/20 bg-green-500/12 text-green-300"
              : "border border-red-500/20 bg-red-500/12 text-red-300"
          }`}>
            {notice.type === "success"
              ? <CheckCircle2 size={14} className="shrink-0" />
              : <AlertCircle size={14} className="shrink-0" />}
            {notice.text}
          </div>
        )}
      </div>

      {showSaleModal && (
        <SaleModal games={games} packs={packs} providers={providers} settings={settings}
          loading={loading} setLoading={setLoading}
          showNotice={showNotice}
          onClose={() => setShowSaleModal(false)}
          onReload={loadAll} />
      )}
    </div>
  );
}
