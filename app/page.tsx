// app/page.tsx
"use client";

import { startTransition, useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle, Heart } from 'lucide-react';
import AppDock, { type SectionId } from '@/components/app-store/AppDock';
import Fuse from 'fuse.js';
import { fetchCatalogFromSupabase, type CatalogGame, type CatalogPack, type CatalogItem } from '@/lib/catalog';
import { fetchNewsFromSupabase, type NewsItem } from '@/lib/news';
import { DEFAULT_APP_SETTINGS, fetchAppSettings } from '@/lib/settings';

import HomeSectionV2 from '@/components/app-store/HomeSectionV2';
import GuideSection, { type GuideConsole } from '@/components/app-store/GuideSection';
import SupportSection from '@/components/app-store/SupportSection';
import TermsModal from '@/components/app-store/TermsModal';
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

export default function MobileAppStore() {
  return (
    <CurrencyProvider>
      <StoreApp />
    </CurrencyProvider>
  );
}

function StoreApp() {
  const { format, currency, isBase } = useCurrency();
  // --- ESTADOS ---
  const [activeSection, setActiveSection] = useState<SectionId>('inicio');
  const [visibleSection, setVisibleSection] = useState<SectionId>('inicio');
  const [sectionMotion, setSectionMotion] = useState<SectionMotionClass>('section-idle');
  const [storeTab, setStoreTab] = useState<'individual' | 'packs'>('individual');
  const [helpSelected, setHelpSelected] = useState<GuideConsole | null>(null);
  const [pickerExiting, setPickerExiting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Colapsa el dock al hacer scroll hacia abajo, lo expande al subir
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
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
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  
  const [searchTerm, setSearchTerm] = useState(""); 
  const [filterTerm, setFilterTerm] = useState(""); 
  
  const [mostrarSoloOfertas, setMostrarSoloOfertas] = useState(false);
  const [mostrarGuardados, setMostrarGuardados] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'switch' | 'switch2'>('all');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedToast, setSavedToast] = useState(false);
  const [purchaseTransition, setPurchaseTransition] = useState(false);
  const [purchaseOrigin, setPurchaseOrigin] = useState({ x: 0, y: 0 });
  const purchaseTimerRef = useRef<number | null>(null);
  const purchaseResetTimerRef = useRef<number | null>(null);
  const sectionSwitchTimerRef = useRef<number | null>(null);
  const sectionSettleTimerRef = useRef<number | null>(null);
  const savedToastTimerRef = useRef<number | null>(null);
  const visibleSectionRef = useRef<SectionId>('inicio');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [productos, setProductos] = useState<CatalogGame[]>([]);
  const [packs, setPacks] = useState<CatalogPack[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [cargando, setCargando] = useState(true);
  
  const [visibleCount, setVisibleCount] = useState(CATALOG_INITIAL_COUNT); 
  const isSectionTransitioning = sectionMotion !== 'section-idle';
  const shouldDeferCatalogItems = visibleSection === 'catalogo' && isSectionTransitioning;

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

  const comprarDirecto = useCallback((item: CatalogItem, event?: MouseEvent<HTMLElement>) => {
    let mensaje = "";
    const precioFmt = `${format(item.precio)} ${currency.code}`;

    if (item.esPack) {
      const listaJuegosTexto = item.juegosIncluidos.length > 0
          ? item.juegosIncluidos.map((juego) => `- ${juego}`).join('\n')
          : "Consultar juegos";

      mensaje = `Hola Alfeicon Games!\n\nMe interesa este pack que vi en la web:\n\n*${item.titulo}*\n\nIncluye:\n${listaJuegosTexto}\n\nPrecio: ${precioFmt}${notaInternacional}\n\n¿Lo tienes disponible?`;
    } else {
      mensaje = `Hola Alfeicon Games!\n\nVengo de la web y quiero llevarme este juego:\n\n*${item.titulo}*\nPrecio: ${precioFmt}${notaInternacional}\n\n¿Qué métodos de pago tienes disponible?`;
    }

    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
  }, [goToWhatsApp, format, currency.code, notaInternacional]);

  const comprarNintendoOnline = useCallback((event?: MouseEvent<HTMLElement>) => {
    const precioFmt = `${format(appSettings.nintendoOnlinePrice)} ${currency.code}`;
    const mensaje = `Hola Alfeicon Games!\n\nMe interesa Nintendo Switch Online + Paquete de expansión por 12 meses.\n\nPrecio: ${precioFmt}${notaInternacional}\n\n¿Lo tienes disponible?`;
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
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
    savedToastTimerRef.current = window.setTimeout(() => setSavedToast(false), 2400);
  }, [getSavedKey]);

  // Cambia de pestaña del catálogo y reinicia la paginación (antes lo hacía
  // el efecto sobre [storeTab]).
  const changeStoreTab = useCallback((tab: 'individual' | 'packs') => {
    setStoreTab(tab);
    setVisibleCount(CATALOG_INITIAL_COUNT);
  }, []);

  // --- EFECTOS ---
  useEffect(() => {
    // CARGA DE DATOS
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
  }, []);

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
    return items;
  }, [storeTab, productos, packs, filterTerm, fuseInstance, mostrarSoloOfertas, mostrarGuardados, savedIds, consoleFilter, getSavedKey]);

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
  }[activeSection];

  // --- RENDER ---
  return (
    <div data-theme={theme} className={`alfeicon-theme ${theme === 'light' ? 'theme-light' : 'theme-dark'} flex min-h-[100dvh] justify-center bg-black selection:bg-white selection:text-black`}>
      <div className="noise-overlay" />
      <div className="relative z-10 min-h-[100dvh] w-full max-w-md overflow-hidden border-x border-gray-900 bg-black font-sans text-white shadow-2xl">
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
              toggleSaved={toggleSaved}
              getSavedKey={getSavedKey}
              savedIds={savedIds}
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
              <div className="purchase-splash flex items-center gap-3 rounded-full border border-[#25d366]/35 bg-[#101417]/95 px-4 py-3 text-white shadow-2xl shadow-[#25d366]/20 backdrop-blur-2xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg shadow-[#25d366]/35">
                  <MessageCircle size={20} fill="currentColor" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ff0ad]">WhatsApp</p>
                  <p className="truncate text-sm font-black">Abriendo compra</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {savedToast && (
          <div className="fixed bottom-24 left-1/2 z-[55] w-[min(360px,calc(100%-2rem))] -translate-x-1/2 animate-soft-in" role="status" aria-live="polite">
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
                className="rounded-full px-3 py-2 text-sm font-black text-white transition hover:bg-white/10 active:scale-95"
              >
                Ver todo
              </button>
            </div>
          </div>
        )}

        <AppDock
          activeSection={activeSection}
          showBottomNav={showBottomNav}
          dockCollapsed={dockCollapsed}
          navIndex={navIndex}
          onNavigate={navigateToSection}
        />
      </div>
    </div>
  );
}
