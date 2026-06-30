// app/page.tsx
"use client";
/* eslint-disable react/no-unescaped-entities */

import { startTransition, useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type MouseEvent } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  Instagram, MessageCircle,
  Youtube,
  ShieldCheck, Facebook, X, ChevronRight, Heart,
} from 'lucide-react';
import AppDock, { type SectionId } from '@/components/app-store/AppDock';
import Fuse from 'fuse.js';
import { fetchCatalogFromSupabase, type CatalogGame, type CatalogPack, type CatalogItem } from '@/lib/catalog';
import { DEFAULT_APP_SETTINGS, fetchAppSettings } from '@/lib/settings';

import HomeSectionV2 from '@/components/app-store/HomeSectionV2';
import GuideSection, { type GuideConsole } from '@/components/app-store/GuideSection';

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

  const comprarDirecto = useCallback((item: CatalogItem, event?: MouseEvent<HTMLElement>) => {
    let mensaje = "";
    const precioFmt = item.precio.toLocaleString('es-CL');

    if (item.esPack) {
      const listaJuegosTexto = item.juegosIncluidos.length > 0
          ? item.juegosIncluidos.map((juego) => `- ${juego}`).join('\n')
          : "Consultar juegos";

      mensaje = `Hola Alfeicon Games!\n\nMe interesa este pack que vi en la web:\n\n*${item.titulo}*\n\nIncluye:\n${listaJuegosTexto}\n\nPrecio: $${precioFmt}\n\n¿Lo tienes disponible?`;
    } else {
      mensaje = `Hola Alfeicon Games!\n\nVengo de la web y quiero llevarme este juego:\n\n*${item.titulo}*\nPrecio: $${precioFmt}\n\n¿Qué métodos de pago tienes disponible?`;
    }
    
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
  }, [goToWhatsApp]);

  const comprarNintendoOnline = useCallback((event?: MouseEvent<HTMLElement>) => {
    const precioFmt = appSettings.nintendoOnlinePrice.toLocaleString('es-CL');
    const mensaje = `Hola Alfeicon Games!\n\nMe interesa Nintendo Switch Online + Paquete de expansión por 12 meses.\n\nPrecio: $${precioFmt}\n\n¿Lo tienes disponible?`;
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
  }, [appSettings.nintendoOnlinePrice, goToWhatsApp]);

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
      const [supabaseCatalog, settings] = await Promise.all([
        fetchCatalogFromSupabase(),
        fetchAppSettings(),
      ]);

      setProductos(supabaseCatalog?.productos || []);
      setPacks(supabaseCatalog?.packs || []);
      setAppSettings(settings);
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
        <main className="min-h-[100dvh] overflow-x-hidden px-4 pb-32">
          
{/* SECCIÓN 1: INICIO */}
          {visibleSection === 'inicio' && (
            <HomeSectionV2
              sectionMotion={sectionMotion}
              productos={productos}
              packs={packs}
              ofertasFlash={ofertasFlash}
              cargando={cargando}
              nintendoOnlinePrice={appSettings.nintendoOnlinePrice}
              canalWhatsapp={CONFIG.canalWhatsapp}
              navigateToSection={navigateToSection}
              setStoreTab={changeStoreTab}
              comprarDirecto={comprarDirecto}
              comprarNintendoOnline={comprarNintendoOnline}
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
  <div className={`section-motion ${sectionMotion} pb-28 pt-0`}>

    {/* ── HERO ── */}
    <div className="support-hero">
      <div className="support-hero__bg" />
      <div className="support-hero__content">
        <div className="support-hero__logo-wrap">
          <Image src="/logo.png" alt="Alfeicon Games" width={52} height={52} className="support-hero__logo" />
        </div>
        <div className="support-hero__badge">
          <span className="support-hero__dot" />
          <span>Respondemos en minutos</span>
        </div>
        <h1 className="support-hero__title">¿En qué te<br/>ayudamos?</h1>
        <p className="support-hero__sub">Escríbenos por WhatsApp o revisa las dudas frecuentes abajo.</p>
        <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="support-wa-btn" aria-label="Abrir WhatsApp">
          <MessageCircle size={20} />
          <span>Chatear por WhatsApp</span>
        </a>
      </div>
    </div>

    <div className="support-body">

      {/* ── TRUST STATS ── */}
      <div className="support-stats">
        {[
          { value: '+500', label: 'Clientes' },
          { value: '99.3%', label: 'Sin problemas' },
          { value: '1-3 meses', label: 'Garantía' },
        ].map(s => (
          <div key={s.label} className="support-stat">
            <span className="support-stat__value">{s.value}</span>
            <span className="support-stat__label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── REDES SOCIALES ── */}
      <div className="support-section-label">Síguenos</div>
      <div className="support-channels">
        {[
          { href: 'https://instagram.com/alfeicon_games', label: 'Instagram', meta: '+2.800 seguidores', icon: <Instagram size={18} />, cls: 'support-channel--ig' },
          { href: 'https://web.facebook.com/alfeicon.games', label: 'Facebook', meta: 'Página oficial', icon: <Facebook size={18} />, cls: 'support-channel--fb' },
          { href: 'https://www.youtube.com/@alfeicon_games', label: 'YouTube', meta: 'Tutoriales en video', icon: <Youtube size={18} />, cls: 'support-channel--yt' },
        ].map(ch => (
          <a key={ch.label} href={ch.href} target="_blank" className={`support-channel ${ch.cls}`}>
            <span className="support-channel__icon">{ch.icon}</span>
            <span className="support-channel__label">{ch.label}</span>
            <span className="support-channel__meta">{ch.meta}</span>
            <ChevronRight size={14} className="support-channel__arrow" />
          </a>
        ))}
      </div>

      {/* ── FAQ ── */}
      <div className="support-section-label">Preguntas frecuentes</div>
      <div className="support-faq">
        {[
          { q: '¿Necesito mi consola desbloqueada?', a: 'No. Los juegos son digitales y se descargan desde la eShop oficial de Nintendo.' },
          { q: '¿Existe riesgo de baneo?', a: 'Existe un riesgo mínimo del 0.7%. El cliente acepta este punto al comprar.' },
          { q: '¿Cuánto dura la garantía?', a: 'Compradores nuevos: 1 mes. Compradores antiguos: 3 meses.' },
          { q: '¿Cuánto tiempo durará el juego?', a: 'Indefinido si sigues las instrucciones: no borres el juego ni la cuenta, ni modifiques datos.' },
        ].map(({ q, a }, i) => (
          <div key={i} className="support-faq__item">
            <p className="support-faq__q">{q}</p>
            <p className="support-faq__a">{a}</p>
          </div>
        ))}
      </div>

      {/* ── TÉRMINOS ── */}
      <button onClick={() => setShowTerms(true)} className="support-terms-btn">
        <ShieldCheck size={16} />
        <span>Términos y condiciones</span>
        <ChevronRight size={15} className="ml-auto" />
      </button>

    </div>
  </div>
          )}
        </main>

{/* MODAL TÉRMINOS Y CONDICIONES */}
{showTerms && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/88 p-4 backdrop-blur-2xl animate-fade-in">
        <div className="brand-shell flex max-h-[90vh] w-full max-w-md flex-col rounded-[2rem]">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-white/5 p-5">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-500" /> Términos y Condiciones
                </h3>
                <button onClick={() => setShowTerms(false)} className="magnetic rounded-full bg-white/5 p-2 text-white hover:bg-white/20">
                    <X size={20} />
                </button>
            </div>
            
            {/* Contenido con Scroll - Texto más grande */}
            <div className="space-y-8 overflow-y-auto p-6 text-left text-[13px] leading-relaxed text-gray-300 scrollbar-hide">
                
                {/* 1. Instalación */}
                <section className="space-y-3">
                    <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">1. Proceso de Instalación</h4>
                    <p>• Entrega estimada: <span className="text-white font-bold">10 a 120 min</span> (según distribuidor).</p>
                    <p>• <span className="text-blue-400 font-bold">Descarga inmediata:</span> Es obligatorio iniciar las descargas apenas recibas los datos. Si compras varios juegos, aplica la misma regla.</p>
                    <p className="bg-white/5 p-4 rounded-xl border-l-4 border-yellow-500 italic text-gray-200">
                        "Recuerda contar con tiempo para la instalación. Si no estás seguro, es mejor esperar. Evitemos errores por apuro."
                    </p>
                </section>

                {/* 2. Cuentas y Juegos */}
                <section className="space-y-3">
                    <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">2. Cuentas y Juegos</h4>
                    <p>• Cuentas tipo <span className="text-white font-bold">PRINCIPAL</span>: Juegas con tu usuario personal.</p>
                    <p>• <span className="text-red-400 font-bold uppercase">Prohibido:</span> No juegues con la cuenta entregada ni modifiques su información. Es solo para descargar. Mantén la cuenta en la consola sin tocarla.</p>
                    <p>• Cambiar datos de la cuenta <span className="text-white font-bold text-red-500">anula la garantía</span> de inmediato.</p>
                </section>

                {/* 3. Riesgo de Baneo */}
                <section className="space-y-3 bg-red-900/10 p-5 rounded-2xl border border-red-500/20">
                    <h4 className="text-red-400 text-sm font-black uppercase tracking-wide">3. Riesgo de Baneo</h4>
                    <p>Existe una posibilidad de restricciones online del <span className="text-white font-bold">0,6%</span> (99,3% de éxito). De ocurrir un baneo, <span className="text-white font-bold underline">Alfeicon Games no asume responsabilidad</span>, ya que depende de normas externas de Nintendo.</p>
                </section>

                {/* 4. Sospechas y Pruebas */}
                <section className="space-y-3">
                    <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">4. Sospechas y Pruebas</h4>
                    <p>Tenemos registro de acciones en la cuenta. Para evaluar reposición o garantía, se requieren pruebas claras de que el fallo no fue causado por el usuario.</p>
                    <p>Si las evidencias son insuficientes, se podrá negar la reposición o devolución.</p>
                </section>

                {/* 5. Garantía Técnica */}
                <section className="space-y-4">
                    <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">5. Garantía Técnica</h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-white/5 p-3 rounded-xl">
                            <p className="text-gray-400 text-[10px] uppercase font-bold">Compradores Nuevos</p>
                            <p className="text-lg text-blue-400 font-black">1 Mes</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-blue-500/30">
                            <p className="text-gray-400 text-[10px] uppercase font-bold">Compradores Antiguos</p>
                            <p className="text-lg text-green-400 font-black">3 Meses</p>
                        </div>
                    </div>
                    <p>• Cubre fallos del juego no causados por el usuario. Incluye reposición (1 vez) o devolución del 50%.</p>
                    <p className="text-xs text-red-500 font-bold bg-red-500/5 p-3 rounded-lg border border-red-500/20">
                        No aplica si eliminas el juego/cuenta, juegas con el perfil entregado, se trata de un pack o hay interrupciones por corte de luz/apagado.
                    </p>
                </section>

                {/* 6. Devoluciones y Pagos */}
                <section className="space-y-3">
                    <h4 className="text-white text-sm font-black uppercase tracking-wide border-b border-white/5 pb-1">6. Devoluciones y Pagos</h4>
                    <p>• Si no hay stock tras tu pago o la entrega supera el tiempo razonable, puedes pedir reembolso total.</p>
                    <p>• El pago debe ir a la cuenta oficial proporcionada; de lo contrario, no asumimos responsabilidad.</p>
                </section>

                {/* Cierre */}
                <p className="text-center font-bold text-white text-[10px] uppercase pt-6 border-t border-white/5 tracking-widest">
                    Al comprar aceptas estos términos y las instrucciones del vendedor.
                </p>
            </div>

            {/* Botón de Cierre */}
            <div className="border-t border-white/5 p-4">
                <button onClick={() => setShowTerms(false)} className="magnetic w-full rounded-full bg-[#e5e4e2] py-4 text-xs font-black uppercase tracking-[0.2em] text-[#0a0a0a] shadow-lg shadow-white/10 hover:bg-white">
                    Entendido y Acepto
                </button>
            </div>
        </div>
    </div>
)}

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
