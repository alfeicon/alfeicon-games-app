"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, ChevronLeft,
  Gamepad2, Gift, Home, Loader2, LogOut, Newspaper, Receipt, Settings, ShieldCheck, PackageCheck, LayoutGrid, LifeBuoy, X, PiggyBank,
  Pin, PinOff, RefreshCw, Search, Plus, Store, Bell, Trash2, LineChart
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { DEFAULT_APP_SETTINGS, SETTING_KEYS } from "@/lib/settings";
import { DEFAULT_PARTNER_NAME, PARTNER_NAME_KEY, PARTNER_PCT_KEY, revalidarTienda } from "./_helpers";
import type { AdminGame, AdminPack, AdminNews, AdSpend, AdminSection, Provider, Sale, SettingsState, SupportRequest } from "./_types";
import { Inicio } from "./_components/Inicio";
import { JuegosCatalog } from "./_components/JuegosCatalog";
import { PacksCatalog } from "./_components/PacksCatalog";
import { Noticias } from "./_components/Noticias";
import { Analiticas } from "./_components/Analiticas";
import { Finanzas } from "./_components/Finanzas";
import { Entregas } from "./_components/Entregas";
import { Ajustes } from "./_components/Ajustes";
import { Soporte } from "./_components/Soporte";
import { SaleModal } from "./_components/SaleModal";
import { CommandPalette, type Command } from "./_components/CommandPalette";
import { useAdminStore } from "./_store/adminStore";
import type { Order } from "./_types";

const defaultSettings: SettingsState = {
  nintendoOnlinePrice: String(DEFAULT_APP_SETTINGS.nintendoOnlinePrice),
  packPriceIncrease: String(DEFAULT_APP_SETTINGS.packPriceIncrease),
  garantiaJuegoDias: String(DEFAULT_APP_SETTINGS.garantiaJuegoDias),
  garantiaPackDias: String(DEFAULT_APP_SETTINGS.garantiaPackDias),
  partnerSplitPct: "40",
  partnerName: DEFAULT_PARTNER_NAME,
};

/**
 * `rgb` va aparte del `accent` de Tailwind porque las tarjetas del menú móvil
 * necesitan el color en runtime (border/background con opacidad). Construirlo
 * concatenando strings —`bg-${x}-500/10`— no funciona: Tailwind no ve esas
 * clases al compilar y quedaban sin estilo.
 */
const NAV_ITEMS: { id: AdminSection; label: string; hint: string; Icon: React.ElementType; accent: string; rgb: string }[] = [
  { id: "inicio",   label: "Inicio",    hint: "Resumen y métricas del negocio",   Icon: Home,         accent: "text-white",         rgb: "255,255,255" },
  { id: "juegos",   label: "Juegos",    hint: "Catálogo de juegos individuales",  Icon: Gamepad2,     accent: "text-blue-400",      rgb: "96,165,250" },
  { id: "packs",    label: "Packs",     hint: "Combos y packs de la tienda",      Icon: Gift,         accent: "text-purple-400",    rgb: "192,132,252" },
  { id: "entregas", label: "Entregas",  hint: "Órdenes activas y seguimiento",    Icon: PackageCheck, accent: "text-yellow-400",    rgb: "250,204,21" },
  { id: "finanzas", label: "Finanzas",  hint: "Ingresos, historial y ventas",     Icon: PiggyBank,    accent: "text-emerald-400",   rgb: "52,211,153" },
  { id: "noticias", label: "Noticias",  hint: "Novedades visibles en la tienda",  Icon: Newspaper,    accent: "text-orange-400",    rgb: "251,146,60" },
  { id: "analiticas", label: "Analíticas", hint: "Métricas de tráfico e interés", Icon: LineChart,    accent: "text-pink-400",      rgb: "244,114,182" },
  { id: "soporte",  label: "Soporte",   hint: "Consultas entrantes de clientes",  Icon: LifeBuoy,     accent: "text-sky-400",       rgb: "56,189,248" },
  { id: "ajustes",  label: "Ajustes",   hint: "Precios, garantías y proveedores", Icon: Settings,     accent: "text-gray-400",      rgb: "156,163,175" },
];

/** Secciones que viven en el dock inferior de móvil; el resto va en el menú. */
const DOCK_IDS: AdminSection[] = ["inicio", "entregas", "finanzas"];

const SECTION_STORAGE_KEY = "admin:section";
const SIDEBAR_STORAGE_KEY = "admin:sidebar-pinned";
const TOAST_MS = 3500;

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authError, setAuthError] = useState("");

  const [section, setSection] = useState<AdminSection>("inicio");
  // Sidebar de desktop: plegado a iconos. Se abre al acercar el cursor y se
  // puede fijar abierto (se recuerda entre sesiones).
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const sidebarOpen = sidebarPinned || sidebarHover;
  const [sectionKey, setSectionKey] = useState(0);
  // Dirección de la transición: +1 si vamos a una sección más abajo del menú.
  const [navDir, setNavDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  type AppNotice = { id: string; type: "success" | "error" | "info"; text: string; timestamp: number; leaving: boolean; showToast: boolean };
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [noticesClosing, setNoticesClosing] = useState(false);
  const [bellY, setBellY] = useState<number | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Arrastre del bottom sheet en móvil: el dedo lo baja y al soltar decide
  // entre cerrar o volver a su sitio.
  const [sheetDrag, setSheetDrag] = useState(0);
  const [sheetPhase, setSheetPhase] = useState<"in" | "drag" | "settle">("in");
  const sheetStartY = useRef(0);

  const {
    games, setGames,
    packs, setPacks,
    news, setNews,
    orders, setOrders,
    sales, setSales,
    adSpend, setAdSpend,
    views, setViews,
    providers, setProviders,
    supportRequests, setSupportRequests,
    settings, setSettings,
    resetAll
  } = useAdminStore();

  const [salesTableExists, setSalesTableExists] = useState<boolean | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [newsTableExists, setNewsTableExists] = useState<boolean | null>(null);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const didLoadRef = useRef(false);

  const closeNoticesPanel = useCallback(() => {
    setNoticesClosing(true);
    setTimeout(() => {
      setNoticesOpen(false);
      setNoticesClosing(false);
    }, 300);
  }, []);


  const showNotice = useCallback((type: "success" | "error" | "info", text: string, playSound = false) => {
    const id = Date.now().toString() + Math.random().toString();
    const timestamp = Date.now();
    const noticeType = type === "info" ? "success" : type;
    
    setNotices(prev => [{ id, type: noticeType, text, timestamp, leaving: false, showToast: true }, ...prev]);
    
    window.setTimeout(() => {
      setNotices(prev => prev.map(n => n.id === id ? { ...n, leaving: true } : n));
      window.setTimeout(() => {
        setNotices(prev => prev.map(n => n.id === id ? { ...n, showToast: false } : n));
      }, 220);
    }, TOAST_MS);

    if (playSound) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (type === "error") {
          osc.type = "square";
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        } else {
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(type === "success" ? 1200 : 600, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc.start(); osc.stop(ctx.currentTime + 0.5);
        }
      } catch(e) {}
    }

    // Reportar a Telegram si es un error, ignorando errores de búsqueda esperados
    if (type === "error" && text !== "No game found" && text !== "No se encontró el juego en eShop") {
      fetch("/api/notify-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, source: "Panel Admin Web" }),
      }).catch(console.error);
    }
  }, []);

  // Inactividad: Cierre de sesión automático tras 15 minutos sin interactuar.
  useEffect(() => {
    if (!isLoggedIn || !supabase) return;
    
    let idleTimer: number;
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(async () => {
        showNotice("info", "Sesión cerrada por inactividad", true);
        if (supabase) {
          await supabase.auth.signOut();
        }
        resetAll();
        window.location.href = "/admin/login";
      }, 15 * 60 * 1000);
    };

    resetIdleTimer();
    const events = ["mousemove", "keydown", "wheel", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));

    return () => {
      window.clearTimeout(idleTimer);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    };
  }, [isLoggedIn, supabase, showNotice]);

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

  const loadSupport = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    // Sin la tabla (falta support-requests.sql) el panel sigue funcionando.
    if (error) { setSupportRequests([]); return; }
    setSupportRequests((data || []) as SupportRequest[]);
  }, []);

  const loadViews = useCallback(async () => {
    if (!supabase) return;
    // 60 días: alcanza para el gráfico diario del mes y para comparar con el
    // mes anterior. Si el tráfico crece mucho habrá que agregar por día en SQL
    // en vez de traer fila por fila.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("page_views")
      .select("created_at,item_id,source")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000);
    // Si falta correr page-views.sql, el panel sigue funcionando sin visitas.
    if (error) { setViews([]); return; }
    setViews(data || []);
  }, []);

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
      .from("app_settings").select("key,value,value_text").in("key", [...Object.values(SETTING_KEYS), PARTNER_PCT_KEY, PARTNER_NAME_KEY]);
    if (error) { setSettings(defaultSettings); return; }
    const rows = new Map((data || []).map(r => [r.key, r]));
    setSettings({
      nintendoOnlinePrice: String(rows.get(SETTING_KEYS.nintendoOnlinePrice)?.value || DEFAULT_APP_SETTINGS.nintendoOnlinePrice),
      packPriceIncrease: String(rows.get(SETTING_KEYS.packPriceIncrease)?.value || DEFAULT_APP_SETTINGS.packPriceIncrease),
      garantiaJuegoDias: String(rows.get(SETTING_KEYS.garantiaJuegoDias)?.value || DEFAULT_APP_SETTINGS.garantiaJuegoDias),
      garantiaPackDias: String(rows.get(SETTING_KEYS.garantiaPackDias)?.value || DEFAULT_APP_SETTINGS.garantiaPackDias),
      partnerSplitPct: String(rows.get(PARTNER_PCT_KEY)?.value ?? defaultSettings.partnerSplitPct),
      partnerName: rows.get(PARTNER_NAME_KEY)?.value_text || defaultSettings.partnerName,
    });
  }, []);

  const navigate = useCallback((s: AdminSection) => {
    setSection(prev => {
      if (prev !== s) {
        const from = NAV_ITEMS.findIndex(i => i.id === prev);
        const to = NAV_ITEMS.findIndex(i => i.id === s);
        setNavDir(to >= from ? 1 : -1);
      }
      return s;
    });
    setSectionKey(k => k + 1);
    try { localStorage.setItem(SECTION_STORAGE_KEY, s); } catch {}
    if (s === "finanzas") {
      loadSales();
      loadAdSpend();
    }
    if (s === "entregas") {
      loadOrders();
    }
  }, [loadSales, loadAdSpend, loadOrders]);

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
      loadSupport().catch(console.error);
    }, 100);
    setTimeout(() => {
      loadAdSpend().catch(console.error);
      loadViews().catch(console.error);
      loadSettings().catch(console.error);
      loadProviders().catch(console.error);
    }, 300);
  }, [loadGames, loadPacks, loadSales, loadOrders, loadNews, loadSupport, loadAdSpend, loadViews, loadSettings, loadProviders]);

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
        resetAll();
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
          showNotice("info", `¡Nueva orden ${num} creada!`, true);
        } else if (payload.eventType === "UPDATE") {
          const old = payload.old as Order;
          const updated = payload.new as Order;
          const num = updated.order_number ? `#${updated.order_number}` : '';

          if (!old.console_code && updated.console_code) {
             showNotice("success", `¡Código recibido en la orden ${num}: ${updated.console_code}!`, true);
          } else if (old.status !== updated.status) {
             if (updated.status === 'completed') {
                showNotice("success", `¡Orden ${num} completada por el cliente!`, true);
             } else if (updated.status === 'issue') {
                showNotice("error", `¡Problema reportado en la orden ${num}!`, true);
             } else {
                showNotice("info", `Orden ${num} pasó a: ${updated.status}`);
             }
          }
        }
      })
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [isLoggedIn, loadOrders, showNotice]);

  // Preferencias del panel: última sección abierta y sidebar fijado.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTION_STORAGE_KEY) as AdminSection | null;
      if (saved && NAV_ITEMS.some(i => i.id === saved)) setSection(saved);
      setSidebarPinned(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {}
  }, []);

  const toggleSidebarPin = () => {
    setSidebarPinned(v => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const closeMobileMenu = useCallback(() => {
    setMenuClosing(true);
    window.setTimeout(() => { setShowMobileMenu(false); setMenuClosing(false); }, 240);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    // Mínimo visible: sin esto el spinner parpadea y no se lee como refresco.
    window.setTimeout(() => setRefreshing(false), 500);
  }, [loadAll]);

  // Atajos de teclado (solo desktop tiene sentido, pero no estorban en móvil).
  useEffect(() => {
    if (!isLoggedIn) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(v => !v);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        return;
      }
      // Alt + 1..9 salta directo a una sección, incluso escribiendo.
      if (e.altKey && /^[1-9]$/.test(e.key)) {
        const item = NAV_ITEMS[Number(e.key) - 1];
        if (item) { e.preventDefault(); navigate(item.id); }
        return;
      }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoggedIn, navigate]);

  /**
   * Los catálogos se recargan justo después de guardar o borrar, así que este
   * es el punto por el que pasan todas las ediciones sin tener que tocar cada
   * componente. Refrescar de más es inofensivo: solo invalida un caché.
   */
  const reloadGamesYTienda = useCallback(async () => {
    await loadGames();
    revalidarTienda(["catalog"]);
  }, [loadGames]);

  const reloadPacksYTienda = useCallback(async () => {
    await loadPacks();
    revalidarTienda(["catalog"]);
  }, [loadPacks]);

  const reloadNewsYTienda = useCallback(async () => {
    await loadNews();
    revalidarTienda(["news"]);
  }, [loadNews]);

  const openMobileMenu = () => {
    setSheetDrag(0);
    setSheetPhase("in");
    setShowMobileMenu(true);
  };

  const onSheetTouchStart = (e: React.TouchEvent) => {
    sheetStartY.current = e.touches[0].clientY;
    setSheetPhase("drag");
  };
  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (sheetPhase !== "drag") return;
    // Solo hacia abajo: tirar hacia arriba no debe despegar la hoja.
    setSheetDrag(Math.max(0, e.touches[0].clientY - sheetStartY.current));
  };
  const onSheetTouchEnd = () => {
    if (sheetDrag > 90) { closeMobileMenu(); return; }
    setSheetPhase("settle");
    setSheetDrag(0);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  // Comandos de la paleta: las secciones más las acciones globales.
  const commands = useMemo<Command[]>(() => [
    ...NAV_ITEMS.map((item, i) => ({
      id: `nav-${item.id}`,
      label: item.label,
      hint: `${item.hint} · Alt+${i + 1}`,
      group: "Ir a",
      accent: item.accent,
      Icon: item.Icon,
      run: () => navigate(item.id),
    })),
    { id: "act-sale",    label: "Registrar venta", hint: "Anotar una venta manual",       group: "Acciones", accent: "text-green-400", Icon: Plus,    run: () => setShowSaleModal(true) },
    { id: "act-refresh", label: "Recargar datos",  hint: "Vuelve a leer todo de Supabase", group: "Acciones", accent: "text-blue-400",  Icon: RefreshCw, run: () => { refreshAll(); } },
    { id: "act-store",   label: "Ver tienda",      hint: "Abrir el sitio público",         group: "Acciones", accent: "text-gray-400",  Icon: Store,   run: () => { window.location.href = "/"; } },
    { id: "act-logout",  label: "Cerrar sesión",   hint: "Salir del panel",                group: "Acciones", accent: "text-red-400",   Icon: LogOut,  run: () => { signOut(); } },
  ], [navigate, refreshAll]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#090b0d]">
        <Loader2 className="animate-spin text-gray-700" size={22} />
      </div>
    );
  }

  // ── Renderizado del Panel ────────────────────────────────────────────────
  const activeOrdersCount = orders.filter(o => o.status === "pending_setup" || o.status === "issue").length;
  const newSupportCount = supportRequests.filter(r => r.status === "nueva").length;
  const badgeFor = (id: AdminSection) =>
    id === "entregas" ? activeOrdersCount : id === "soporte" ? newSupportCount : 0;

  const activeItem = NAV_ITEMS.find(i => i.id === section) ?? NAV_ITEMS[0];
  // Cuando la sección activa no está en el dock, la píldora se posa sobre
  // "Menú" para que el dock nunca quede sin indicar dónde estás.
  const dockIndex = DOCK_IDS.indexOf(section) === -1 ? DOCK_IDS.length : DOCK_IDS.indexOf(section);
  const dockSlots = DOCK_IDS.length + 1;
  const busy = !firstLoadDone || refreshing;

  // ── Main shell ────────────────────────────────────────────────────────────
  return (
    <div className="admin-shell flex h-screen overflow-hidden bg-[#090b0d]">
      {/* Barra de progreso global: carga inicial y refrescos manuales */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
        {busy && <div className="admin-topbar-progress h-full w-full bg-gradient-to-r from-transparent via-white/70 to-transparent" />}
      </div>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0c0f12]/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            key={section}
            className="admin-tile-in flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `rgba(${activeItem.rgb},0.10)`, border: `1px solid rgba(${activeItem.rgb},0.22)` }}
          >
            <activeItem.Icon size={14} className={activeItem.accent} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black uppercase tracking-widest text-white">{activeItem.label}</p>
            <p className="truncate text-[9.5px] text-gray-600">{activeItem.hint}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={refreshAll} disabled={refreshing} aria-label="Recargar datos"
            className="admin-press rounded-xl p-2 text-gray-500 disabled:opacity-40">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setPaletteOpen(true)} aria-label="Buscar"
            className="admin-press rounded-xl p-2 text-gray-500">
            <Search size={15} />
          </button>
          <Link href="/" aria-label="Ver tienda" className="admin-press rounded-xl p-2 text-gray-500">
            <ArrowLeft size={15} />
          </Link>
        </div>
      </div>

      {/* Mobile bottom dock */}
      <div className="app-dock-wrapper md:hidden">
        <nav aria-label="Navegación admin" className="app-glass-dock relative flex h-[66px] w-full items-center justify-around overflow-hidden rounded-[2rem] px-1.5">
          {/* Píldora deslizante: se mueve al item activo en vez de reaparecer */}
          <span
            className="admin-dock-pill"
            style={{
              left: `calc(${(dockIndex / dockSlots) * 100}% + 6px)`,
              width: `calc(${100 / dockSlots}% - 12px)`,
            }}
          />

          {DOCK_IDS.map(id => {
            const { label, Icon, accent } = NAV_ITEMS.find(i => i.id === id)!;
            const active = section === id;
            const badge = badgeFor(id);
            return (
              <button key={id} onClick={() => navigate(id)} aria-current={active ? "page" : undefined}
                className="admin-dock-item relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-0.5">
                <div className="admin-dock-icon relative">
                  <Icon size={18} className={active ? accent : "text-white/60"} strokeWidth={active ? 2.6 : 2.1} />
                  {badge > 0 && (
                    <span className="admin-badge absolute -right-2 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white">
                      {badge}
                    </span>
                  )}
                </div>
                <span className={`text-[8.5px] font-black uppercase tracking-wider ${active ? "text-white" : "text-white/55"}`}>{label}</span>
              </button>
            );
          })}

          {/* Menú completo */}
          <button onClick={openMobileMenu} aria-label="Abrir menú"
            className="admin-dock-item relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-0.5">
            <div className="admin-dock-icon relative">
              <LayoutGrid size={18} className={dockIndex === DOCK_IDS.length ? activeItem.accent : "text-white/60"} strokeWidth={dockIndex === DOCK_IDS.length ? 2.6 : 2.1} />
              {newSupportCount > 0 && !DOCK_IDS.includes("soporte") && (
                <span className="admin-badge absolute -right-2 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white">
                  {newSupportCount}
                </span>
              )}
            </div>
            <span className={`text-[8.5px] font-black uppercase tracking-wider ${dockIndex === DOCK_IDS.length ? "text-white" : "text-white/55"}`}>Menú</span>
          </button>
        </nav>
      </div>

      {/* Mobile bottom sheet */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className={`absolute inset-0 bg-black/65 backdrop-blur-sm ${menuClosing ? "admin-backdrop-out" : "admin-backdrop"}`}
            onClick={closeMobileMenu} />

          <div
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
            style={{
              transform: sheetDrag ? `translateY(${sheetDrag}px)` : undefined,
              paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))",
            }}
            className={`relative w-full touch-pan-y rounded-t-3xl border-t border-white/[0.08] bg-[#0c0f12]/96 p-6 backdrop-blur-xl ${
              menuClosing ? "admin-sheet-out"
                : sheetPhase === "drag" ? "admin-sheet-dragging"
                : sheetPhase === "settle" ? "admin-sheet-settle"
                : "admin-sheet"
            }`}
          >
            {/* Tirador: además de decorar, indica que la hoja se puede arrastrar */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/25" />

            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-black uppercase tracking-widest text-white">Navegación</h2>
              <button onClick={closeMobileMenu} aria-label="Cerrar"
                className="admin-press rounded-full bg-white/[0.06] p-2 text-gray-400">
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {NAV_ITEMS.map(({ id, label, Icon, accent, rgb }, i) => {
                const active = section === id;
                const badge = badgeFor(id);
                return (
                  <button key={id} onClick={() => { navigate(id); closeMobileMenu(); }}
                    style={{ ["--i" as string]: i }}
                    aria-current={active ? "page" : undefined}
                    className="admin-tile-in flex flex-col items-center gap-2">
                    <div
                      className="admin-tile-box relative flex h-14 w-full items-center justify-center rounded-2xl border"
                      style={{
                        background: active ? `rgba(${rgb},0.12)` : "rgba(255,255,255,0.025)",
                        borderColor: active ? `rgba(${rgb},0.32)` : "rgba(255,255,255,0.05)",
                      }}
                    >
                      <Icon size={21} className={active ? accent : "text-gray-400"} />
                      {badge > 0 && (
                        <span className="admin-badge absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                          {badge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${active ? "text-white" : "text-gray-500"}`}>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-white/[0.05] pt-5">
              <button onClick={() => { setShowSaleModal(true); closeMobileMenu(); }}
                className="admin-press col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[10px] font-black uppercase tracking-widest text-black">
                <Plus size={14} /> Registrar venta
              </button>
              <Link href="/" className="admin-press flex items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <Store size={14} /> Tienda
              </Link>
              <button onClick={() => { signOut(); closeMobileMenu(); }}
                className="admin-press flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 py-3 text-[10px] font-black uppercase tracking-widest text-red-400">
                <LogOut size={14} /> Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar (desktop) — plegado a iconos, se abre al acercar el cursor o
          fijado con el pin. El hueco de 64px queda fijo y el menú crece por
          encima del contenido, así abrirlo no reacomoda toda la pantalla. */}
      <div className={`relative hidden shrink-0 md:block ${sidebarPinned ? "w-[210px]" : "w-[64px]"}`}>
        <nav
          onMouseEnter={() => setSidebarHover(true)}
          onMouseLeave={() => setSidebarHover(false)}
          className={`admin-sidebar absolute inset-y-0 left-0 z-40 flex flex-col ${
            sidebarOpen ? "w-[210px]" : "w-[64px]"
          } ${sidebarOpen && !sidebarPinned ? "shadow-2xl shadow-black/60" : ""}`}
        >
          {/* Subtle top glow */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 bg-gradient-to-b from-white/[0.035] to-transparent" />

          {/* Logo + pin */}
          <div className={`relative flex items-center py-5 ${sidebarOpen ? "gap-3 px-5" : "justify-center px-2"}`}>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <img src="/logo.png" alt="Alfeicon Games" className="h-full w-full object-cover" />
            </div>
            {sidebarOpen && (
              <div className="admin-nav-label flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/90">Admin</p>
                  <p className="truncate text-[9px] font-bold tracking-widest text-gray-600">Alfeicon Games</p>
                </div>
                <button onClick={toggleSidebarPin} aria-label={sidebarPinned ? "Soltar menú" : "Fijar menú"}
                  className="admin-press rounded-lg p-1.5 text-gray-600 hover:text-white">
                  {sidebarPinned ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
              </div>
            )}
          </div>

          {/* Buscador / paleta */}
          <div className="relative px-2.5 pb-2">
            <button onClick={() => setPaletteOpen(true)}
              className={`admin-press flex w-full items-center rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 hover:bg-white/[0.06] ${
                sidebarOpen ? "gap-2 px-2.5" : "justify-center px-0"
              }`}>
              <Search size={13} className="shrink-0 text-gray-600" />
              {sidebarOpen && (
                <span className="admin-nav-label flex flex-1 items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-600">Buscar…</span>
                  <kbd className="ml-auto rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[8.5px] font-black text-gray-600">⌘K</kbd>
                </span>
              )}
            </button>
          </div>

          {/* Nav items */}
          <div className="relative flex-1 overflow-y-auto px-2.5 py-1">
            {NAV_ITEMS.map(({ id, label, Icon, accent }) => {
              const active = section === id;
              const badge = badgeFor(id);
              return (
                <button key={id} onClick={() => navigate(id)}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={`admin-nav-item group flex w-full items-center rounded-xl py-2.5 ${
                    sidebarOpen ? "gap-3 px-3 text-left" : "justify-center px-0"
                  } ${active ? accent : "text-gray-700"}`}
                  style={{
                    background: active ? "rgba(255,255,255,0.07)" : "transparent",
                    boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
                  }}>
                  <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    active ? accent : "text-gray-700 group-hover:text-gray-400"
                  }`}
                    style={{ background: active ? "rgba(255,255,255,0.06)" : "transparent" }}>
                    <Icon size={16} strokeWidth={2.5} />
                    {badge > 0 && (
                      <span className="admin-badge absolute -right-1.5 -top-1.5 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-[#0c0f12]">
                        {badge}
                      </span>
                    )}
                  </div>
                  {sidebarOpen ? (
                    <span className={`admin-nav-label text-[10.5px] font-black uppercase tracking-widest ${
                      active ? "text-white" : "text-gray-700 group-hover:text-gray-400"
                    }`}>{label}</span>
                  ) : (
                    <span className="admin-tip">{label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom */}
          <div className="relative space-y-0.5 border-t border-white/[0.05] px-2.5 py-3">
            <button onClick={refreshAll} disabled={refreshing}
              className={`admin-nav-item group flex w-full items-center rounded-xl py-2.5 disabled:opacity-50 ${
                sidebarOpen ? "gap-3 px-3" : "justify-center px-0"
              }`}>
              <RefreshCw size={13} className={`shrink-0 text-gray-700 group-hover:text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
              {sidebarOpen
                ? <span className="admin-nav-label text-[10px] font-black uppercase tracking-widest text-gray-700 group-hover:text-gray-400">Recargar</span>
                : <span className="admin-tip">Recargar</span>}
            </button>
            <Link href="/"
              className={`admin-nav-item group flex items-center rounded-xl py-2.5 ${
                sidebarOpen ? "gap-3 px-3" : "justify-center px-0"
              }`}>
              <ArrowLeft size={13} className="shrink-0 text-gray-700 group-hover:text-gray-400" />
              {sidebarOpen
                ? <span className="admin-nav-label text-[10px] font-black uppercase tracking-widest text-gray-700 group-hover:text-gray-400">Ver tienda</span>
                : <span className="admin-tip">Ver tienda</span>}
            </Link>
            <button onClick={signOut}
              className={`admin-nav-item group flex w-full items-center rounded-xl py-2.5 hover:bg-red-500/[0.08] ${
                sidebarOpen ? "gap-3 px-3" : "justify-center px-0"
              }`}>
              <LogOut size={13} className="shrink-0 text-gray-700 group-hover:text-red-400" />
              {sidebarOpen
                ? <span className="admin-nav-label text-[10px] font-black uppercase tracking-widest text-gray-700 group-hover:text-red-400">Cerrar sesión</span>
                : <span className="admin-tip">Cerrar sesión</span>}
            </button>
          </div>
        </nav>
      </div>

      {/* Main */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div key={sectionKey} className={`flex h-full flex-col ${navDir >= 0 ? "admin-section-in-right" : "admin-section-in-left"}`}>
          {section === "inicio" && (
            <Inicio games={games} packs={packs} sales={sales} adSpend={adSpend} views={views} settings={settings}
              salesTableExists={salesTableExists}
              firstLoadDone={firstLoadDone}
              onNavigate={navigate}
              onRegisterSale={() => setShowSaleModal(true)} />
          )}
          {section === "juegos" && (
            <JuegosCatalog games={games} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={reloadGamesYTienda} />
          )}
          {section === "packs" && (
            <PacksCatalog packs={packs} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={reloadPacksYTienda} />
          )}
          {section === "noticias" && (
            <Noticias news={news} newsTableExists={newsTableExists} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={reloadNewsYTienda} />
          )}
          {section === "analiticas" && (
            <Analiticas />
          )}
          {section === "entregas" && (
            <Entregas orders={orders} games={games} packs={packs} providers={providers} settings={settings} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadOrders} />
          )}
          {section === "finanzas" && (
            <Finanzas sales={sales} adSpend={adSpend} games={games} packs={packs} settings={settings} providers={providers}
              salesTableExists={salesTableExists}
              salesError={salesError}
              loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadAll} />
          )}
          {section === "soporte" && (
            <Soporte requests={supportRequests} loading={loading} setLoading={setLoading}
              showNotice={showNotice} onReload={loadSupport} />
          )}
          {section === "ajustes" && (
            <Ajustes settings={settings} providers={providers} loading={loading}
              setLoading={setLoading} showNotice={showNotice} onReloadProviders={loadProviders} />
          )}
        </div>

        {/* Trigger invisible en el borde derecho (Hover para asomar, Clic para abrir) */}
        <div className="group fixed bottom-0 right-0 top-0 z-[90] hidden w-6 cursor-pointer items-center justify-center transition-all hover:w-16 sm:flex"
             onClick={() => setNoticesOpen(true)}
             onMouseMove={(e) => setBellY(e.clientY)}
             onMouseLeave={() => setBellY(null)}
             aria-label="Abrir notificaciones">
          
          {/* Zona de hover (gradiente sutil) */}
          <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-white/[0.03] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          
          {/* Indicador visual que se asoma */}
          <div 
            style={bellY !== null ? { top: `${bellY}px`, marginTop: '-32px' } : {}}
            className="absolute right-0 flex h-16 w-12 translate-x-full items-center justify-start rounded-l-2xl border border-r-0 border-white/[0.08] bg-[#0c0f12]/80 pl-2 text-white/40 shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 group-hover:translate-x-0 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            <ChevronLeft size={16} className="shrink-0 transition-transform duration-300 group-hover:-translate-x-1" />
            <div className="relative ml-1">
              <Bell size={16} />
              {notices.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-[#0c0f12] bg-blue-500 px-1 text-[8px] font-black text-white">
                  {notices.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botón tradicional de campana (Sólo visible en móviles) */}
        <div className="fixed bottom-4 right-4 z-[90] sm:hidden">
          <button onClick={() => setNoticesOpen(true)} aria-label="Notificaciones"
            className="admin-press relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0c0f12]/90 text-gray-400 shadow-2xl backdrop-blur-md">
            <Bell size={20} />
            {notices.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-[#0c0f12] bg-blue-500 px-1 text-[10px] font-black text-white">
                {notices.length}
              </span>
            )}
          </button>
        </div>

        {/* Stacked Toasts (Esquina superior derecha) */}
        <div className="pointer-events-none fixed right-4 top-16 z-[100] flex flex-col items-end gap-2 sm:right-6 sm:top-20">
          {notices.filter(n => n.showToast).slice(0, 4).map(notice => (
            <div key={notice.id}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border px-4 py-3 text-left shadow-2xl backdrop-blur-md transition-all sm:min-w-[280px] sm:max-w-sm ${
                notice.leaving ? "admin-toast-out" : "admin-toast"
              } ${
                notice.type === "success"
                  ? "border-green-500/25 bg-green-500/12 text-green-300"
                  : "border-red-500/25 bg-red-500/12 text-red-300"
              }`}>
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                {notice.type === "success" ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
                <span className="flex-1">{notice.text}</span>
                <button onClick={() => setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, leaving: true, showToast: false } : n))}
                  className="rounded-lg p-1 opacity-50 hover:bg-white/10 hover:opacity-100">
                  <X size={14} />
                </button>
              </div>
              <span style={{ ["--toast-ms" as string]: `${TOAST_MS}ms` }} className={`admin-toast-bar absolute bottom-0 left-0 h-0.5 w-full ${notice.type === "success" ? "bg-green-400/50" : "bg-red-400/50"}`} />
            </div>
          ))}
        </div>

        {/* Panel Lateral Historial de Notificaciones */}
        {(noticesOpen || noticesClosing) && (
          <div className="fixed inset-0 z-[110] flex justify-end">
            <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${noticesClosing ? "opacity-0" : "opacity-100"}`} onClick={closeNoticesPanel} />
            <div className={`relative flex w-full max-w-sm flex-col border-l border-white/10 bg-[#0c0f12] shadow-2xl ${noticesClosing ? "admin-drawer-out" : "admin-drawer-in"}`}>
              <div className="flex items-center justify-between border-b border-white/[0.05] p-5">
                <div className="flex items-center gap-3">
                  <Bell size={18} className="text-white" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">Notificaciones</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setNotices([])} title="Limpiar historial" className="rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-white">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={closeNoticesPanel} className="rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-white">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {notices.length === 0 ? (
                  <p className="mt-10 text-center text-xs font-bold uppercase tracking-widest text-gray-600">No hay notificaciones</p>
                ) : (
                  <div className="space-y-3">
                    {notices.map(notice => (
                      <div key={notice.id} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <div className={`mt-0.5 shrink-0 ${notice.type === "success" ? "text-green-400" : "text-red-400"}`}>
                          {notice.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-medium text-white/90">{notice.text}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                            {new Date(notice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {paletteOpen && (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
      )}

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
