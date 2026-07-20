// app/StoreApp.tsx
"use client";

import { startTransition, useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Heart, ArrowRight, ShoppingCart, Plus, Landmark } from 'lucide-react';
import AppDock, { type SectionId } from '@/components/app-store/AppDock';
import Fuse from 'fuse.js';
import { fetchCatalogFromSupabase, findCatalogItemBySlug, type CatalogGame, type CatalogPack, type CatalogItem } from '@/lib/catalog';
import { fetchNewsFromSupabase, type NewsItem } from '@/lib/news';
import { fetchAppSettings, type AppSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase/client';
import { trackView } from '@/lib/track';

import HomeSectionV2 from '@/components/app-store/HomeSectionV2';
import GuideSection, { type GuideConsole } from '@/components/app-store/GuideSection';
import SupportSection from '@/components/app-store/SupportSection';
import TermsModal from '@/components/app-store/TermsModal';
import TransferDetailsPanel from '@/components/app-store/TransferDetailsPanel';
import { CurrencyProvider, useCurrency } from '@/components/currency/CurrencyProvider';
import CurrencyWelcome from '@/components/currency/CurrencyWelcome';

const CatalogSection = dynamic(() => import('@/components/app-store/CatalogSection'), {
  ssr: false,
  loading: () => <div className="min-h-[52vh]" aria-hidden="true" />,
});

// --- CONFIGURACION ---
const CONFIG = {
  whatsappNumber: "56926411278",
  emailSoporte: "alfeicon.games@gmail.com",
  canalWhatsapp: "https://whatsapp.com/channel/0029VafHhlx0G0XpvqQKyG2D",
};

const FUSE_OPTIONS = {
  keys: ['titulo', 'juegosIncluidos'],
  threshold: 0.35,
  ignoreLocation: true,
};

type SectionMotionClass =
  | 'section-idle'
  | 'section-enter-from-left'
  | 'section-enter-from-right'
  | 'section-exit-to-left'
  | 'section-exit-to-right';

const SECTION_ORDER: Record<SectionId, number> = {
  inicio: 0,
  catalogo: 1,
  instrucciones: 2,
  perfil: 3,
};
const SECTION_EXIT_MS = 140;
const SECTION_ENTER_MS = 320;
const CATALOG_INITIAL_COUNT = 6;
const CATALOG_BATCH_SIZE = 6;

// Datos que el servidor ya trajo (SSR + caché). Se usan como estado inicial para
// que la primera pintura no espere ninguna consulta desde el navegador.
export type StoreInitialData = {
  productos: CatalogGame[];
  packs: CatalogPack[];
  news: NewsItem[];
  settings: AppSettings;
};

// Miniatura que vuela desde el botón "+" presionado hasta el carrito del dock
type FlyToCart = {
  key: number;
  img: string | null;
  from: { x: number; y: number };
  to: { x: number; y: number };
  // Retardo del vuelo: da tiempo a que el carrito se despliegue si el dock
  // estaba contraído (peek)
  delay: number;
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

export default function MobileAppStore({ initial, openSlug }: { initial: StoreInitialData; openSlug?: string }) {
  return (
    <CurrencyProvider>
      <StoreApp initial={initial} openSlug={openSlug} />
    </CurrencyProvider>
  );
}

function StoreApp({ initial, openSlug }: { initial: StoreInitialData; openSlug?: string }) {
  const { format, currency, isBase, convert, code: currencyCode } = useCurrency();

  // Deep-link: si la URL es /juego/<slug>, buscamos el juego/pack para abrir su
  // ficha automáticamente al montar (y arrancar directo en la sección catálogo).
  const deepLinkItem = useMemo<CatalogItem | null>(() => {
    if (!openSlug) return null;
    const all: CatalogItem[] = [...initial.productos, ...initial.packs];
    return findCatalogItemBySlug(all, openSlug);
  }, [openSlug, initial.productos, initial.packs]);
  // --- ESTADOS ---
  const [activeSection, setActiveSection] = useState<SectionId>(deepLinkItem ? 'catalogo' : 'inicio');
  const [visibleSection, setVisibleSection] = useState<SectionId>(deepLinkItem ? 'catalogo' : 'inicio');
  const [sectionMotion, setSectionMotion] = useState<SectionMotionClass>('section-idle');
  const [storeTab, setStoreTab] = useState<'individual' | 'packs'>(deepLinkItem?.esPack ? 'packs' : 'individual');
  // Ficha a abrir automáticamente al montar (deep-link). Se consume una vez.
  const [pendingOpenItem, setPendingOpenItem] = useState<CatalogItem | null>(deepLinkItem);
  const [helpSelected, setHelpSelected] = useState<GuideConsole | null>(null);
  const [pickerExiting, setPickerExiting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Una visita por carga de la tienda (no por cambio de sección: eso es
  // navegación interna, no una visita nueva).
  useEffect(() => {
    trackView(window.location.pathname);
  }, []);

  const [showBottomNav, setShowBottomNav] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Colapsa el dock al hacer scroll hacia abajo, lo expande al subir.
  // Si el scroll se detiene 1 segundo, el dock se reabre solo.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    let idleTimer: number | null = null;
    const onScroll = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        setShowBottomNav(true);
        setDockCollapsed(false);
      }, 1000);
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80) {
          setShowBottomNav(true);
          setDockCollapsed(false);
        } else if (Math.abs(y - lastY) > 8) {
          const goingDown = y > lastY;
          setShowBottomNav(!goingDown);
          setDockCollapsed(goingDown);
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimer) window.clearTimeout(idleTimer);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTerm, setFilterTerm] = useState("");

  const [mostrarSoloOfertas, setMostrarSoloOfertas] = useState(false);
  const [mostrarGuardados, setMostrarGuardados] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'switch' | 'switch2'>('all');
  // Filtro de precio por rango libre (en la moneda mostrada). Cualquiera de los
  // dos puede quedar vacío: solo mínimo, solo máximo, o ambos.
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedToast, setSavedToast] = useState(false);
  const [purchaseTransition, setPurchaseTransition] = useState(false);
  const [purchaseOrigin, setPurchaseOrigin] = useState({ x: 0, y: 0 });
  const [purchaseModalData, setPurchaseModalData] = useState<{items: CatalogItem[], origin: {x:number, y:number}} | null>(null);
  // Vista de datos de transferencia dentro del modal de pago (código + total).
  const [transferOrder, setTransferOrder] = useState<{code: string; total: number} | null>(null);
  const [cartItems, setCartItems] = useState<CatalogItem[]>([]);
  // Logos de tarjetas aceptadas (desde /api/payment-logos, token server-side).
  const [paymentLogos, setPaymentLogos] = useState<{ name: string; logo: string }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [flyingToCart, setFlyingToCart] = useState<FlyToCart[]>([]);
  const flyKeyRef = useRef(0);
  // "Peek" del carrito: con el dock contraído, el botón del carrito se
  // despliega solo para recibir la miniatura y luego se vuelve a esconder
  const [cartPeek, setCartPeek] = useState(false);
  const cartPeekTimerRef = useRef<number | null>(null);
  const purchaseTimerRef = useRef<number | null>(null);
  const purchaseResetTimerRef = useRef<number | null>(null);
  const sectionSwitchTimerRef = useRef<number | null>(null);
  const sectionSettleTimerRef = useRef<number | null>(null);
  const savedToastTimerRef = useRef<number | null>(null);
  const visibleSectionRef = useRef<SectionId>('inicio');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Estado inicial = datos del servidor (SSR + caché). Sin cascada de fetch al montar.
  const [productos, setProductos] = useState<CatalogGame[]>(initial.productos);
  const [packs, setPacks] = useState<CatalogPack[]>(initial.packs);
  const [news, setNews] = useState<NewsItem[]>(initial.news);
  const [appSettings, setAppSettings] = useState<AppSettings>(initial.settings);
  const [cargando, setCargando] = useState(initial.productos.length === 0 && initial.packs.length === 0);

  const [visibleCount, setVisibleCount] = useState(CATALOG_INITIAL_COUNT);
  const isSectionTransitioning = sectionMotion !== 'section-idle';
  const shouldDeferCatalogItems = visibleSection === 'catalogo' && isSectionTransitioning;

  useEffect(() => {
    if (isCartOpen || purchaseModalData !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen, purchaseModalData]);

  // Carga perezosa de los logos de tarjetas la primera vez que se abre el modal
  // de pago (una sola vez; la ruta ya viene cacheada del servidor).
  useEffect(() => {
    if (purchaseModalData === null || paymentLogos.length > 0) return;
    let cancelled = false;
    fetch('/api/payment-logos')
      .then((r) => (r.ok ? r.json() : []))
      .then((logos) => { if (!cancelled && Array.isArray(logos)) setPaymentLogos(logos); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [purchaseModalData, paymentLogos.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const syncTheme = () => setTheme(mediaQuery.matches ? 'light' : 'dark');

    syncTheme();
    mediaQuery.addEventListener('change', syncTheme);

    return () => mediaQuery.removeEventListener('change', syncTheme);
  }, []);

  // Hidrata los favoritos desde localStorage al montar. Debe ir en un efecto
  // (no en un inicializador lazy de useState) porque el render del servidor no
  // tiene localStorage y produce []; leerlo en el primer render del cliente
  // causaría un mismatch de hidratación. El setState al montar es intencional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('alfeicon_saved_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        const originalLength = Array.isArray(parsed) ? parsed.length : 0;
        const normalized = Array.isArray(parsed)
          ? parsed.filter((id) => typeof id === 'string' && (id.startsWith('game:') || id.startsWith('pack:')))
          : [];

        setSavedIds(normalized);
        if (normalized.length !== originalLength) {
          window.localStorage.setItem('alfeicon_saved_items', JSON.stringify(normalized));
        }
      }
    } catch {
      setSavedIds([]);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (purchaseTimerRef.current) window.clearTimeout(purchaseTimerRef.current);
      if (purchaseResetTimerRef.current) window.clearTimeout(purchaseResetTimerRef.current);
      if (sectionSwitchTimerRef.current) window.clearTimeout(sectionSwitchTimerRef.current);
      if (sectionSettleTimerRef.current) window.clearTimeout(sectionSettleTimerRef.current);
      if (savedToastTimerRef.current) window.clearTimeout(savedToastTimerRef.current);
      if (cartPeekTimerRef.current) window.clearTimeout(cartPeekTimerRef.current);
    };
  }, []);

  // --- FUNCIONES (HANDLERS) ---
  const ejecutarBusqueda = useCallback(() => {
    setFilterTerm(searchTerm);
    setVisibleCount(CATALOG_INITIAL_COUNT);
  }, [searchTerm]);

  const navigateToSection = useCallback((nextSection: SectionId) => {
    setDockCollapsed(false);
    setShowBottomNav(true);
    if (nextSection === activeSection) return;

    const currentVisibleSection = visibleSectionRef.current;
    const movingForward = SECTION_ORDER[nextSection] > SECTION_ORDER[currentVisibleSection];

    if (sectionSwitchTimerRef.current) window.clearTimeout(sectionSwitchTimerRef.current);
    if (sectionSettleTimerRef.current) window.clearTimeout(sectionSettleTimerRef.current);

    setActiveSection(nextSection);
    setSectionMotion(movingForward ? 'section-exit-to-left' : 'section-exit-to-right');

    sectionSwitchTimerRef.current = window.setTimeout(() => {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      root.style.scrollBehavior = previousScrollBehavior;
      visibleSectionRef.current = nextSection;
      startTransition(() => {
        setVisibleSection(nextSection);
        setSectionMotion(movingForward ? 'section-enter-from-right' : 'section-enter-from-left');

        // Resets antes manejados por un efecto sobre [visibleSection].
        if (nextSection !== 'catalogo') {
          setSearchTerm('');
          setFilterTerm('');
          setMostrarSoloOfertas(false);
          setMostrarGuardados(false);
          setConsoleFilter('all');
        }
        if (nextSection === 'instrucciones') {
          setHelpSelected(null);
          setPickerExiting(false);
        }
        setVisibleCount(CATALOG_INITIAL_COUNT);
      });

      sectionSettleTimerRef.current = window.setTimeout(() => {
        setSectionMotion('section-idle');
      }, SECTION_ENTER_MS);
    }, SECTION_EXIT_MS);
  }, [activeSection]);

  const goToWhatsApp = useCallback((url: string, event?: MouseEvent<HTMLElement>) => {
    if (purchaseTimerRef.current) window.clearTimeout(purchaseTimerRef.current);
    if (purchaseResetTimerRef.current) window.clearTimeout(purchaseResetTimerRef.current);

    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPurchaseOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    } else {
      setPurchaseOrigin({
        x: window.innerWidth / 2,
        y: window.innerHeight - 128,
      });
    }

    setPurchaseTransition(true);
    purchaseTimerRef.current = window.setTimeout(() => {
      window.location.href = url;
    }, 620);
    purchaseResetTimerRef.current = window.setTimeout(() => {
      setPurchaseTransition(false);
    }, 1800);
  }, []);

  const notaInternacional = isBase
    ? ''
    : `\n(Precio internacional en ${currency.label}, incluye +US$7 por costos de cambio y transferencia. Pago por transferencia internacional o tarjeta de crédito.)`;

  const procesarMercadoPago = useCallback(async (data: {items: CatalogItem[], origin: {x:number, y:number}}) => {
    const { items, origin } = data;
    setPurchaseModalData(null);
    setIsCartOpen(false);
    setPurchaseOrigin(origin);
    setPurchaseTransition(true);

    const code = generateShortCode();
    
    // Calcular totales para Mercado Pago
    const total_precio = items.reduce((acc, item) => acc + item.precio, 0);
    const titulos = items.map(item => item.titulo).join(' + ');
    const pack_ids = items.filter(item => item.esPack).map(item => item.id);

    // Orden pendiente de pago. Queda bloqueada hasta que el webhook de Mercado
    // Pago confirme (/api/mp-webhook): volver de la pasarela no es prueba de
    // pago, esa URL la puede abrir cualquiera.
    supabase?.from('orders').insert({
      short_code: code,
      game_name: titulos,
      pack_ids: pack_ids.length > 0 ? pack_ids : null,
      status: 'draft',
      source: 'web',
      sale_price: total_precio,
      payment_method: 'mercadopago',
      payment_status: 'pending',
    }).then(({ error }) => {
      if (error) console.error("Error creating draft order", error);
    });

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: code,
          title: titulos,
          unit_price: total_precio,
          quantity: 1,
          code: code
        })
      });

      const resData = await res.json();
      if (resData.init_point) {
        window.location.href = resData.init_point;
      } else {
        alert('Error al generar el pago: ' + (resData.details || resData.error || 'Desconocido'));
        setPurchaseTransition(false);
      }
    } catch (error: any) {
      console.error(error);
      alert('Error de conexión: ' + error.message);
      setPurchaseTransition(false);
    }
  }, []);

  // Transferencia: crea la orden (transferencia pendiente, con el monto en
  // sale_price) y lleva al cliente a su portal /entrega/[code], donde ve los
  // datos, sube el comprobante y espera la aprobación. Si el insert falla
  // (p. ej. falta correr order-receipts.sql), cae al panel de datos en el modal.
  const iniciarTransferencia = useCallback(async (data: {items: CatalogItem[], origin: {x:number, y:number}}) => {
    const { items } = data;
    const code = generateShortCode();
    const total = items.reduce((acc, item) => acc + item.precio, 0);
    const titulos = items.map(item => item.titulo).join(' + ');
    const pack_ids = items.filter(item => item.esPack).map(item => item.id);

    const { error } = await (supabase?.from('orders').insert({
      short_code: code,
      game_name: titulos,
      pack_ids: pack_ids.length > 0 ? pack_ids : null,
      status: 'draft',
      sale_price: total,
      payment_method: 'transferencia',
      payment_status: 'pending',
    }) ?? Promise.resolve({ error: null }));

    if (error) {
      console.error("Error creating transfer order:", JSON.stringify(error));
      setTransferOrder({ code, total }); // fallback: datos en el modal
      return;
    }

    // El proceso vive en /entrega/[code]: datos + comprobante → validación →
    // tutorial de instalación. El modal solo elige el método de pago.
    window.location.href = `/entrega/${code}`;
  }, []);

  const addToCart = useCallback((item: CatalogItem, event?: MouseEvent<HTMLElement>) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    // Lanza la miniatura que vuela desde el botón presionado hasta el carrito
    const originEl = event?.currentTarget;
    const cartEl = document.querySelector('[data-dock-cart]');
    const wrapperEl = document.querySelector('.app-dock-wrapper');
    if (originEl && cartEl && wrapperEl) {
      const from = originEl.getBoundingClientRect();
      const cartRect = cartEl.getBoundingClientRect();
      // Botón plegado (dock contraído): se despliega solo para recibir la
      // miniatura (peek) y el destino se calcula desde el wrapper, porque el
      // botón aún mide 0. Se expandirá a 66px pegado al borde derecho.
      const folded = cartRect.width < 8;
      let to: { x: number; y: number };
      if (folded) {
        const wrapperRect = wrapperEl.getBoundingClientRect();
        to = { x: wrapperRect.right - 33, y: wrapperRect.top + 33 };
        setCartPeek(true);
        if (cartPeekTimerRef.current) window.clearTimeout(cartPeekTimerRef.current);
        cartPeekTimerRef.current = window.setTimeout(() => setCartPeek(false), 1500);
      } else {
        to = { x: cartRect.left + cartRect.width / 2, y: cartRect.top + cartRect.height / 2 };
      }
      setFlyingToCart(prev => [...prev, {
        key: ++flyKeyRef.current,
        img: item.img ?? null,
        from: { x: from.left + from.width / 2, y: from.top + from.height / 2 },
        to,
        delay: folded ? 0.3 : 0,
      }]);
    }
    setCartItems(prev => {
      if (prev.some(cartItem => cartItem.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const comprarTodo = useCallback((event?: MouseEvent<HTMLElement>) => {
    if (cartItems.length === 0) return;
    
    let origin = { x: window.innerWidth / 2, y: window.innerHeight - 128 };
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      origin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    setPurchaseModalData({ items: cartItems, origin });
  }, [cartItems]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const removeCartItem = useCallback((id: string) => {
    setCartItems(prev => prev.filter(c => c.id !== id));
  }, []);

  const checkoutCart = useCallback((event: MouseEvent<HTMLElement>) => {
    setIsCartOpen(false);
    comprarTodo(event);
  }, [comprarTodo]);

  const comprarDirecto = useCallback((item: CatalogItem, event?: MouseEvent<HTMLElement>) => {
    let origin = { x: window.innerWidth / 2, y: window.innerHeight - 128 };
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      origin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    setCartItems(prev => prev.some(c => c.id === item.id) ? prev : [...prev, item]);
    setPurchaseModalData({ items: [item], origin });
  }, []);

  const comprarNintendoOnline = useCallback((event?: MouseEvent<HTMLElement>) => {
    const precioFmt = `${format(appSettings.nintendoOnlinePrice)} ${currency.code}`;
    const code = generateShortCode();
    const mensaje = `Hola Alfeicon Games!\n\nMe interesa Nintendo Switch Online + Paquete de expansión por 12 meses.\n\nPrecio: ${precioFmt}${notaInternacional}\n\nMi orden generada es: *${code}*\n\n¿Lo tienes disponible?`;
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
    // Tampoco se registra borrador: es solo una consulta.
  }, [appSettings.nintendoOnlinePrice, goToWhatsApp, format, currency.code, notaInternacional]);

  const getSavedKey = useCallback((item: CatalogItem) => {
    return `${item.esPack ? 'pack' : 'game'}:${String(item.id)}`;
  }, []);

  const toggleSaved = useCallback((item: CatalogItem) => {
    const itemId = getSavedKey(item);

    setSavedIds((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];

      window.localStorage.setItem('alfeicon_saved_items', JSON.stringify(next));
      return next;
    });

    if (savedToastTimerRef.current) window.clearTimeout(savedToastTimerRef.current);
    setSavedToast(true);
    savedToastTimerRef.current = window.setTimeout(() => setSavedToast(false), 1200);
  }, [getSavedKey]);

  // Cambia de pestaña del catálogo y reinicia la paginación (antes lo hacía
  // el efecto sobre [storeTab]).
  const changeStoreTab = useCallback((tab: 'individual' | 'packs') => {
    setStoreTab(tab);
    setPriceMin(''); // los precios difieren entre pestañas; limpiamos para no ocultar todo
    setPriceMax('');
    setVisibleCount(CATALOG_INITIAL_COUNT);
  }, []);

  const filtrosActivos =
    searchTerm !== '' ||
    filterTerm !== '' ||
    consoleFilter !== 'all' ||
    mostrarSoloOfertas ||
    mostrarGuardados ||
    priceMin !== '' ||
    priceMax !== '';

  const limpiarFiltros = useCallback(() => {
    setSearchTerm('');
    setFilterTerm('');
    setConsoleFilter('all');
    setMostrarSoloOfertas(false);
    setMostrarGuardados(false);
    setPriceMin('');
    setPriceMax('');
    setVisibleCount(CATALOG_INITIAL_COUNT);
  }, []);

  // --- EFECTOS ---
  // Fallback: si el servidor no logró traer el catálogo (p. ej. Supabase sin
  // configurar en build), lo pedimos desde el cliente. Con SSR normal esto no
  // corre, así que no hay cascada de fetch en la carga habitual.
  useEffect(() => {
    if (initial.productos.length > 0 || initial.packs.length > 0) return;

    const cargarDatos = async () => {
      const [supabaseCatalog, settings, newsItems] = await Promise.all([
        fetchCatalogFromSupabase(),
        fetchAppSettings(),
        fetchNewsFromSupabase(),
      ]);

      setProductos(supabaseCatalog?.productos || []);
      setPacks(supabaseCatalog?.packs || []);
      setAppSettings(settings);
      setNews(newsItems);
      setCargando(false);
    };
    cargarDatos();
  }, [initial.productos.length, initial.packs.length]);

  // --- MEMOS ---
  const ofertasFlash = useMemo(() => productos.filter(p => p.ahorro).slice(0, 8), [productos]);

  const fuseInstance = useMemo(() => {
    const items: CatalogItem[] = storeTab === 'individual' ? productos : packs;
    return new Fuse(items, FUSE_OPTIONS);
  }, [storeTab, productos, packs]);

  const listaFiltrada = useMemo(() => {
    let items: CatalogItem[] = storeTab === 'individual' ? productos : packs;
    if (filterTerm !== "") {
        items = fuseInstance.search(filterTerm).map(result => result.item);
    }
    if (mostrarSoloOfertas && storeTab === 'individual') {
        items = items.filter(item => item.ahorro);
    }
    if (mostrarGuardados) {
        items = items.filter(item => savedIds.includes(getSavedKey(item)));
    }
    if (consoleFilter !== 'all') {
        items = items.filter(item => {
          const consoleName = String(item.consoleName || '').toLowerCase().replace(/\s+/g, '');
          const isSwitch2Only = consoleName.includes('switch2');
          return consoleFilter === 'switch2' ? isSwitch2Only : !isSwitch2Only;
        });
    }
    // Precio en la moneda mostrada (convert = base CLP -> moneda activa).
    const minValue = priceMin.trim() !== '' ? Number(priceMin) : null;
    const maxValue = priceMax.trim() !== '' ? Number(priceMax) : null;
    if (minValue !== null && !Number.isNaN(minValue)) {
        items = items.filter(item => convert(item.precio) >= minValue);
    }
    if (maxValue !== null && !Number.isNaN(maxValue)) {
        items = items.filter(item => convert(item.precio) <= maxValue);
    }
    return items;
  }, [storeTab, productos, packs, filterTerm, fuseInstance, mostrarSoloOfertas, mostrarGuardados, savedIds, consoleFilter, priceMin, priceMax, convert, getSavedKey]);

  const listaVisual = useMemo(() => listaFiltrada.slice(0, visibleCount), [listaFiltrada, visibleCount]);
  useEffect(() => {
    if (visibleSection !== 'catalogo' || cargando || shouldDeferCatalogItems) return;

    const loadMoreTarget = loadMoreRef.current;
    if (!loadMoreTarget || visibleCount >= listaFiltrada.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + CATALOG_BATCH_SIZE, listaFiltrada.length));
      },
      { root: null, rootMargin: '900px 0px', threshold: 0.01 },
    );

    observer.observe(loadMoreTarget);
    return () => observer.disconnect();
  }, [visibleSection, cargando, shouldDeferCatalogItems, visibleCount, listaFiltrada.length]);

  const savedCountActual = useMemo(() => {
    const items: CatalogItem[] = storeTab === 'individual' ? productos : packs;
    return items.filter((item) => savedIds.includes(getSavedKey(item))).length;
  }, [storeTab, productos, packs, savedIds, getSavedKey]);
  const purchaseInkStyle = useMemo(() => ({
    '--purchase-x': `${purchaseOrigin.x}px`,
    '--purchase-y': `${purchaseOrigin.y}px`,
  }) as CSSProperties, [purchaseOrigin]);
  const navIndex = {
    inicio: 0,
    catalogo: 1,
    instrucciones: 2,
    perfil: 3,
  }[activeSection] ?? 0;

  // --- RENDER ---
  return (
    <div data-theme={theme} className={`alfeicon-theme ${theme === 'light' ? 'theme-light' : 'theme-dark'} flex min-h-[100dvh] justify-center bg-black selection:bg-white selection:text-black`}>
      <div className="noise-overlay" />
      <div id="store-content" className="relative z-10 min-h-[100dvh] w-full max-w-md overflow-hidden border-x border-gray-900 bg-black font-sans text-white shadow-2xl">
        {/* MAIN */}
        <main className="min-h-[100dvh] overflow-x-hidden px-4 pb-32 pt-[calc(env(safe-area-inset-top)+16px)]">

{/* SECCIÓN 1: INICIO */}
          {visibleSection === 'inicio' && (
            <HomeSectionV2
              sectionMotion={sectionMotion}
              productos={productos}
              packs={packs}
              news={news}
              ofertasFlash={ofertasFlash}
              cargando={cargando}
              nintendoOnlinePrice={appSettings.nintendoOnlinePrice}
              navigateToSection={navigateToSection}
              setStoreTab={changeStoreTab}
              comprarDirecto={comprarDirecto}
              addToCart={addToCart}
              comprarNintendoOnline={comprarNintendoOnline}
              onOpenTerms={() => setShowTerms(true)}
              whatsappNumber={CONFIG.whatsappNumber}
            />
          )}

          {/* SECCIÓN 2: CATÁLOGO */}
          {visibleSection === 'catalogo' && (
            <CatalogSection
              sectionMotion={sectionMotion}
              cargando={cargando}
              shouldDeferCatalogItems={shouldDeferCatalogItems}
              storeTab={storeTab}
              setStoreTab={changeStoreTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              setFilterTerm={setFilterTerm}
              ejecutarBusqueda={ejecutarBusqueda}
              consoleFilter={consoleFilter}
              setConsoleFilter={setConsoleFilter}
              mostrarSoloOfertas={mostrarSoloOfertas}
              setMostrarSoloOfertas={setMostrarSoloOfertas}
              mostrarGuardados={mostrarGuardados}
              setMostrarGuardados={setMostrarGuardados}
              savedCountActual={savedCountActual}
              listaFiltrada={listaFiltrada}
              listaVisual={listaVisual}
              visibleCount={visibleCount}
              setVisibleCount={setVisibleCount}
              catalogInitialCount={CATALOG_INITIAL_COUNT}
              catalogBatchSize={CATALOG_BATCH_SIZE}
              loadMoreRef={loadMoreRef}
              whatsappNumber={CONFIG.whatsappNumber}
              comprarDirecto={comprarDirecto}
              addToCart={addToCart}
              toggleSaved={toggleSaved}
              getSavedKey={getSavedKey}
              savedIds={savedIds}
              priceMin={priceMin}
              priceMax={priceMax}
              setPriceMin={setPriceMin}
              setPriceMax={setPriceMax}
              currencyCode={currencyCode}
              filtrosActivos={filtrosActivos}
              limpiarFiltros={limpiarFiltros}
              initialOpenItem={pendingOpenItem}
              onOpenConsumed={() => setPendingOpenItem(null)}
            />
          )}
          {/* SECCIÓN 3: INSTRUCCIONES */}
          {visibleSection === 'instrucciones' && (
            <GuideSection
              sectionMotion={sectionMotion}
              helpSelected={helpSelected}
              setHelpSelected={setHelpSelected}
              pickerExiting={pickerExiting}
              setPickerExiting={setPickerExiting}
              whatsappNumber={CONFIG.whatsappNumber}
            />
          )}

          {/* SECCIÓN 4: AYUDA Y CONFIANZA */}
          {visibleSection === 'perfil' && (
            <SupportSection
              sectionMotion={sectionMotion}
              whatsappNumber={CONFIG.whatsappNumber}
              onOpenTerms={() => setShowTerms(true)}
            />
          )}
        </main>

{/* MODAL TÉRMINOS Y CONDICIONES */}
{showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

{/* PROMPT DE MONEDA (primera visita) */}
<CurrencyWelcome />

        {purchaseTransition && (
          <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" style={purchaseInkStyle}>
            <div className="purchase-ink-blob" />
            <div className="purchase-ink-blob" />
            <div className="purchase-ink-blob" />

            <div className="absolute bottom-24 left-1/2 w-[min(330px,calc(100%-2rem))] -translate-x-1/2">
              <div className="purchase-splash flex items-center gap-3 rounded-full border border-white/20 bg-[#101417]/95 px-4 py-3 text-white shadow-2xl shadow-black/40 backdrop-blur-2xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg">
                  <ShoppingCart size={19} strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Alfeicon Games</p>
                  <p className="truncate text-sm font-black">Abriendo tu compra</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {savedToast && (
            <motion.div
              initial={{ opacity: 0, y: 15, x: '-50%', scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
              exit={{ opacity: 0, y: 10, x: '-50%', scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed bottom-24 left-1/2 z-[55] w-[min(360px,calc(100%-2rem))]"
              role="status"
              aria-live="polite"
            >
              <div className="brand-shell flex items-center justify-between rounded-[1.7rem] px-5 py-4 text-white backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0a0a0a]">
                    <Heart size={18} fill="currentColor" />
                  </span>
                  <span className="text-sm font-black">Guardado</span>
                </div>
                <button
                  onClick={() => {
                    navigateToSection('catalogo');
                    setMostrarGuardados(true);
                    setSavedToast(false);
                  }}
                  className="rounded-full px-3 py-2 text-sm font-black text-white transition active:bg-white/10 active:scale-95"
                >
                  Ver todo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PAYMENT METHOD MODAL — estilo liquid glass, consistente con la ficha */}
        <AnimatePresence>
          {purchaseModalData && (
            <motion.div
              className="catalog-detail-backdrop"
              style={{ zIndex: 100 }}
              role="dialog"
              aria-modal="true"
              aria-label="Método de pago"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
              onClick={() => { setPurchaseModalData(null); setTransferOrder(null); }}
            >
              <motion.div
                className="catalog-detail-panel catalog-detail-panel--scroll"
                initial={{ y: 90, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 340 } }}
                exit={{ y: 90, opacity: 0, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
                onClick={e => e.stopPropagation()}
              >
                {transferOrder ? (
                  <TransferDetailsPanel
                    code={transferOrder.code}
                    totalLabel={`${format(transferOrder.total)} ${currency.code}`}
                    whatsappNumber={CONFIG.whatsappNumber}
                    onBack={() => setTransferOrder(null)}
                  />
                ) : (
                <>
                <div className="mb-5 flex items-center gap-4">
                  <div className="liquid-glass relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                    {purchaseModalData.items.length === 1 && purchaseModalData.items[0].img ? (
                      <img src={purchaseModalData.items[0].img} alt={purchaseModalData.items[0].titulo} className="relative z-[1] h-full w-full object-cover" />
                    ) : (
                      <ShoppingCart size={24} className="relative z-[1] text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#e5e4e2]/70">Método de pago</p>
                    <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
                      {purchaseModalData.items.length === 1 ? purchaseModalData.items[0].titulo : `${purchaseModalData.items.length} Juegos en Carrito`}
                    </h3>
                    <p className="mt-1 text-lg font-black text-white">
                      {format(purchaseModalData.items.reduce((acc, item) => acc + item.precio, 0))} <span className="text-[10px] text-gray-400">{currency.code}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => procesarMercadoPago(purchaseModalData)}
                    className="motion-press group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-[#38bdf8]/35 bg-[#009EE3]/18 p-4 text-white shadow-lg shadow-[#009EE3]/15 backdrop-blur-xl"
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent" />
                    <div className="relative z-10 flex items-center gap-3">
                      {/* Logo oficial de Mercado Pago desde /public/mercadopago.svg.
                          Si el archivo no existe, cae al ícono de respaldo (fondo blanco). */}
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
                        <img
                          src="/mercadopago.svg"
                          alt="Mercado Pago"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black tracking-wide">Mercado Pago</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/80">Tarjetas o Dinero en cuenta</p>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">
                      <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Rápido
                    </div>
                  </button>

                  <button
                    onClick={() => iniciarTransferencia(purchaseModalData)}
                    className="motion-press premium-control flex w-full items-center justify-between rounded-2xl p-4 text-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-white/10 p-2 text-[#e5e4e2]">
                        <Landmark size={18} strokeWidth={2} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">Transferencia</p>
                        <p className="mt-0.5 text-[10px] text-gray-400">Datos y comprobante en la página</p>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-gray-500" />
                  </button>
                </div>

                {paymentLogos.length > 0 && (
                  <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/10 pt-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pagas seguro con</p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {paymentLogos.map((l) => (
                        <img
                          key={l.name}
                          src={l.logo}
                          alt={l.name}
                          title={l.name}
                          loading="lazy"
                          className="h-6 rounded bg-white px-1 py-0.5 object-contain"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setPurchaseModalData(null)}
                  className="mt-5 w-full py-2 text-center text-xs font-black uppercase tracking-widest text-gray-500 transition-colors active:text-white"
                >
                  Cancelar
                </button>
                </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Miniaturas que vuelan al carrito: arco hacia arriba y caída al dock */}
        {flyingToCart.map(fly => (
          <motion.div
            key={fly.key}
            className="fly-to-cart"
            style={{ left: fly.from.x - 20, top: fly.from.y - 20 }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
            animate={{
              x: [0, fly.to.x - fly.from.x],
              y: [0, -46, fly.to.y - fly.from.y],
              scale: [0.4, 1, 0.35],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 0.7,
              x: { duration: 0.7, delay: fly.delay, ease: 'easeInOut' },
              y: { duration: 0.7, delay: fly.delay, times: [0, 0.32, 1], ease: ['easeOut', 'easeIn'] },
              scale: { duration: 0.7, delay: fly.delay, times: [0, 0.32, 1], ease: 'easeInOut' },
              opacity: { duration: 0.7, delay: fly.delay, times: [0, 0.1, 0.85, 1] },
            }}
            onAnimationComplete={() => setFlyingToCart(prev => prev.filter(f => f.key !== fly.key))}
          >
            {fly.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fly.img} alt="" />
            ) : (
              <Plus size={18} strokeWidth={3} />
            )}
          </motion.div>
        ))}

        <AppDock
          activeSection={activeSection}
          showBottomNav={showBottomNav}
          dockCollapsed={dockCollapsed}
          navIndex={navIndex}
          onNavigate={navigateToSection}
          cartItems={cartItems}
          cartPeek={cartPeek}
          isCartOpen={isCartOpen}
          onOpenCart={openCart}
          onCloseCart={closeCart}
          onRemoveCartItem={removeCartItem}
          onCheckout={checkoutCart}
          formatPrice={format}
          currencyCode={currency.code}
        />
      </div>
    </div>
  );
}
