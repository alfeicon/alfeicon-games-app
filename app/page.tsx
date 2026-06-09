// app/page.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties, type MouseEvent } from 'react';
import Image from 'next/image';
import { 
  Home, Gamepad2, BookOpen, Search, Instagram, MessageCircle, 
  Loader2, ArrowDownCircle, Zap, Youtube, FileText, 
  ShieldCheck, AlertTriangle, Facebook, X, Megaphone, Filter, Star, Gift, CheckCircle, ChevronRight, Heart
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import Fuse from 'fuse.js';
import { fetchCatalogFromSupabase } from '@/lib/catalog';
import { DEFAULT_APP_SETTINGS, fetchAppSettings } from '@/lib/settings';
import { ShaderAnimation } from '@/components/ui/shader-animation';

// --- CONFIGURACIÓN ---
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

export default function MobileAppStore() {
  // --- ESTADOS ---
  const [activeSection, setActiveSection] = useState<'inicio' | 'catalogo' | 'instrucciones' | 'perfil'>('inicio');
  const [storeTab, setStoreTab] = useState<'individual' | 'packs'>('individual');
  const [helpTab, setHelpTab] = useState<'switch2' | 'switch1'>('switch2');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  
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

  const [productos, setProductos] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [cargando, setCargando] = useState(true);
  
  const [visibleCount, setVisibleCount] = useState(20); 

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const syncTheme = () => setTheme(mediaQuery.matches ? 'light' : 'dark');

    syncTheme();
    mediaQuery.addEventListener('change', syncTheme);

    return () => mediaQuery.removeEventListener('change', syncTheme);
  }, []);

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

  useEffect(() => {
    return () => {
      if (purchaseTimerRef.current) window.clearTimeout(purchaseTimerRef.current);
      if (purchaseResetTimerRef.current) window.clearTimeout(purchaseResetTimerRef.current);
    };
  }, []);

  // --- FUNCIONES (HANDLERS) ---
  const ejecutarBusqueda = useCallback(() => {
    setFilterTerm(searchTerm);
    setVisibleCount(20); 
  }, [searchTerm]);

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

  const comprarDirecto = useCallback((item: any, event?: MouseEvent<HTMLElement>) => {
    let mensaje = "";
    const precioFmt = item.precio.toLocaleString('es-CL');

    if (item.esPack) {
      const listaJuegosTexto = item.juegosIncluidos 
          ? item.juegosIncluidos.map((juego: string) => `🔹 ${juego}`).join('\n')
          : "Consultar juegos";

      mensaje = `Hola Alfeicon Games! 👋\n\nMe interesa este Pack que vi en la web:\n\n🎁 *${item.titulo}*\n\n📋 *Incluye:*\n${listaJuegosTexto}\n\n💰 Precio: $${precioFmt}\n\n¿Lo tienes disponible ?`;
    } else {
      mensaje = `Hola Alfeicon Games! 🎮\n\nVengo de la web y quiero llevarme este juego:\n\n🔹 *${item.titulo}*\n💰 Precio: $${precioFmt}\n\n¿Que métodos de pago tienes disponible?`;
    }
    
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
  }, [goToWhatsApp]);

  const comprarNintendoOnline = useCallback((event?: MouseEvent<HTMLElement>) => {
    const precioFmt = appSettings.nintendoOnlinePrice.toLocaleString('es-CL');
    const mensaje = `Hola Alfeicon Games! 👋\n\nMe interesa Nintendo Switch Online + Paquete de expansión por 12 meses.\n\n💰 Precio: $${precioFmt}\n\n¿Lo tienes disponible?`;
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    goToWhatsApp(url, event);
  }, [appSettings.nintendoOnlinePrice, goToWhatsApp]);

  const getSavedKey = useCallback((item: any) => {
    return `${item.esPack ? 'pack' : 'game'}:${String(item.id)}`;
  }, []);

  const toggleSaved = useCallback((item: any) => {
    const itemId = getSavedKey(item);

    setSavedIds((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];

      window.localStorage.setItem('alfeicon_saved_items', JSON.stringify(next));
      return next;
    });

    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2400);
  }, [getSavedKey]);

  // --- EFECTOS ---
  useEffect(() => {
    window.scrollTo(0, 0);
    if (activeSection !== 'catalogo') {
        setSearchTerm("");
        setFilterTerm("");
        setMostrarSoloOfertas(false);
        setMostrarGuardados(false);
        setConsoleFilter('all');
    }
    setVisibleCount(20);
  }, [activeSection, storeTab]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateNavigation = () => {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollY;
      const isNearTop = currentScrollY < 80;

      setShowBottomNav(isScrollingUp || isNearTop);
      lastScrollY = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateNavigation);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    
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
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- MEMOS ---
  const ofertasFlash = useMemo(() => productos.filter(p => p.ahorro).slice(0, 8), [productos]);
  
  // Filtramos solo los que son nuevos para contar cuántos hay
  const nuevosLanzamientos = useMemo(() => packs.filter(p => p.esNuevo), [packs]);
  
  const packsDestacados = useMemo(() => packs.slice(0, 6), [packs]);

  const fuseInstance = useMemo(() => {
    const items = storeTab === 'individual' ? productos : packs;
    return new Fuse(items, FUSE_OPTIONS);
  }, [storeTab, productos, packs]);

  const listaFiltrada = useMemo(() => {
    let items = storeTab === 'individual' ? productos : packs;
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

  const listaVisual = listaFiltrada.slice(0, visibleCount);
  const savedCountActual = useMemo(() => {
    const items = storeTab === 'individual' ? productos : packs;
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
    <div data-theme={theme} className={`alfeicon-theme ${theme === 'light' ? 'theme-light' : 'theme-dark'} min-h-screen bg-black flex justify-center selection:bg-white selection:text-black`}>
      <div className="noise-overlay" />
      <div className="relative z-10 w-full max-w-md bg-black min-h-screen shadow-2xl border-x border-gray-900 font-sans text-white overflow-hidden">
        
        {/* MAIN */}
        <main className="pb-32 px-4 min-h-screen">
          
{/* SECCIÓN 1: INICIO */}
          {activeSection === 'inicio' && (
            <div className="animate-fade-in space-y-7">
              {/* PORTADA DE MARCA */}
              <section className="animate-soft-in -mx-4 overflow-hidden border-b border-white/10 bg-black px-5 pb-7 pt-6">
                <div className="brand-shell relative mx-auto max-w-[360px] rounded-[2.15rem] p-5">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem] opacity-25">
                    <ShaderAnimation />
                  </div>
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-36 rounded-full bg-[#536878]/35 blur-[72px]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[#e5e4e2]/5 blur-2xl" />
                  <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-[#536878]/12 via-[#0a0a0a]/40 to-[#0a0a0a]/85" />
                  <div className="relative z-10">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="relative h-14 w-14 rounded-2xl border border-[#536878]/35 bg-[#536878]/15 shadow-xl">
                        <Image src="/logo.png" alt="Alfeicon Logo" fill className="object-contain p-2" priority />
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-[#536878]/45 bg-[#536878]/18 px-3 py-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3de26f] opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3de26f] shadow-[0_0_12px_rgba(61,226,111,0.85)]" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#d5dde1]">Online</span>
                      </div>
                    </div>

                    <p className="brand-kicker mb-3">Nintendo Switch</p>
                    <h1 className="brand-title text-[38px] font-black uppercase text-white">
                      Alfeicon<br />
                      <span className="font-light tracking-[0.18em]">Games</span>
                    </h1>
                    <p className="mt-4 max-w-[270px] text-sm font-semibold leading-relaxed text-gray-400">
                      Juegos digitales, packs y ofertas con compra directa por WhatsApp.
                    </p>

                    <div className="mt-6 grid grid-cols-[1fr_auto] gap-3">
                      <button
                        onClick={() => setActiveSection('catalogo')}
                        className="magnetic group flex h-12 items-center justify-center gap-2 rounded-full bg-[#536878] px-5 text-xs font-black uppercase tracking-widest text-[#e5e4e2] shadow-lg shadow-[#536878]/30 hover:bg-[#627988]"
                      >
                        Ver catalogo <ChevronRight size={15} className="transition-transform duration-500 group-hover:translate-x-0.5" />
                      </button>
                      <a
                        href={CONFIG.canalWhatsapp}
                        target="_blank"
                        className="magnetic flex h-12 w-12 items-center justify-center rounded-full bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-[#e5e4e2]/10"
                        aria-label="Canal de WhatsApp"
                      >
                        <Megaphone size={19} fill="currentColor" />
                      </a>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2.5">
                      <div className="liquid-glass group min-h-[78px] rounded-[1.1rem] px-3 py-3 transition duration-500">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-[#e5e4e2]/10 to-transparent" />
                        <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-[#9fb3c0]/12 blur-2xl" />
                        <p className="relative text-2xl font-black leading-none text-white">{productos.length || '-'}</p>
                        <p className="relative mt-2.5 text-[9px] font-black uppercase tracking-widest text-gray-500">Juegos</p>
                      </div>
                      <div className="liquid-glass group min-h-[78px] rounded-[1.1rem] px-3 py-3 transition duration-500">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-[#e5e4e2]/10 to-transparent" />
                        <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-[#b8c3ca]/12 blur-2xl" />
                        <p className="relative text-2xl font-black leading-none text-white">{packs.length || '-'}</p>
                        <p className="relative mt-2.5 text-[9px] font-black uppercase tracking-widest text-gray-500">Packs</p>
                      </div>
                      <div className="liquid-glass group min-h-[78px] rounded-[1.1rem] px-3 py-3 transition duration-500">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-[#e5e4e2]/12 to-transparent" />
                        <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-[#e5e4e2]/10 blur-2xl" />
                        <p className="relative text-2xl font-black leading-none text-white">{ofertasFlash.length || '-'}</p>
                        <p className="relative mt-2.5 text-[9px] font-black uppercase tracking-widest text-gray-500">Ofertas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="animate-soft-in mx-1 overflow-hidden rounded-[1.7rem] border border-red-300/20 bg-[#e60012] shadow-2xl shadow-red-950/25">
                <div className="relative min-h-[188px] p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,#ef0014_0%,#e60012_49%,#b90010_50%,#cb0012_100%)]" />
                  <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/12 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-14 left-0 h-40 w-40 rounded-full bg-black/16 blur-2xl" />

                  <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/78">12 meses</p>
                        <h2 className="mt-2 text-[28px] font-black uppercase leading-[0.95] tracking-[-0.04em] text-white">
                          Online +<br />
                          <span className="text-[22px] tracking-[-0.03em]">Paquete expansión</span>
                        </h2>
                      </div>
                      <div className="rounded-full border border-white/30 bg-white/18 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-xl">
                        Disponible
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/68">Precio</p>
                        <p className="text-[30px] font-black leading-none tracking-[-0.05em] text-white">
                          ${appSettings.nintendoOnlinePrice.toLocaleString('es-CL')}
                          <span className="ml-1 text-[11px] font-bold tracking-normal text-white/72">CLP</span>
                        </p>
                      </div>
                      <button
                        onClick={comprarNintendoOnline}
                        className="magnetic rounded-full bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#e60012] shadow-lg shadow-black/20"
                      >
                        Comprar
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* AVISO DE NOVEDADES (BANNER ELEGANTE) */}
              {nuevosLanzamientos.length > 0 && (
                <div className="animate-fade-in mx-1">
                   <div className="liquid-glass group rounded-[1.45rem] p-4">
                       <div className="absolute right-0 top-0 h-28 w-28 translate-x-10 -translate-y-10 rounded-full bg-[#536878]/20 blur-[40px]"></div>
                       
                       <div className="flex items-center justify-between relative z-10">
                           <div className="flex items-center gap-3">
                               <div className="rounded-full border border-[#536878]/30 bg-[#536878]/20 p-2.5">
                                   <Megaphone size={18} className="text-blue-400" />
                               </div>
                               <div className="flex flex-col">
                                   <h3 className="text-sm font-black uppercase tracking-wide text-white">
                                       Packs recientes
                                   </h3>
                                   <p className="text-[10px] text-gray-400 font-medium">
                                       Hemos agregado <span className="text-blue-400 font-bold">{nuevosLanzamientos.length} packs</span> al catálogo.
                                   </p>
                               </div>
                           </div>
                           
                           <button 
                               onClick={() => {
                                   setStoreTab('packs'); 
                                   setActiveSection('catalogo');
                               }}
                               className="magnetic flex items-center gap-1 rounded-full bg-white px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-black shadow-lg shadow-white/10 hover:bg-gray-200"
                           >
                               Ver ahora <ChevronRight size={12} />
                           </button>
                       </div>
                   </div>
                </div>
              )}

              {/* RECUADRO CÓMO COMPRAR */}
              <div className="brand-shell mx-1 rounded-[2rem] p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 className="brand-kicker flex items-center gap-2">
                        <CheckCircle size={14} /> Compra en 4 pasos
                    </h3>
                    <span className="brand-chip px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">Desliza</span>
                  </div>

                  <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3 scrollbar-hide">
                      {[
                        {
                          step: '1',
                          title: 'Elige',
                          copy: 'Busca tu juego favorito en el catálogo.',
                          image: '/steps/step-choose.png',
                        },
                        {
                          step: '2',
                          title: 'Chatea',
                          copy: 'Escríbenos para confirmar disponibilidad.',
                          image: '/steps/step-chat.png',
                        },
                        {
                          step: '3',
                          title: 'Paga',
                          copy: 'Realiza el pago del juego.',
                          image: '/steps/step-pay.png',
                        },
                        {
                          step: '4',
                          title: 'Juega',
                          copy: 'Recibe los datos y comienza a jugar.',
                          image: '/steps/step-play.png',
                        },
                      ].map((item, index) => (
                        <article
                          key={item.step}
                          className="liquid-glass animate-soft-in min-w-[82%] snap-center rounded-[1.35rem]"
                          style={{ animationDelay: `${index * 90}ms` }}
                        >
                          <div className="relative aspect-[16/9] overflow-hidden bg-[#0a0a0a]">
                            <Image src={item.image} alt={`${item.title}: ${item.copy}`} fill className="object-cover transition duration-700 hover:scale-[1.03]" sizes="(max-width: 768px) 82vw, 320px" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                            <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#e5e4e2] text-sm font-black text-[#0a0a0a] shadow-lg shadow-black/30">
                              {item.step}
                            </div>
                          </div>
                          <div className="p-4">
                            <p className="text-sm font-black uppercase tracking-widest text-white">{item.title}</p>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{item.copy}</p>
                          </div>
                        </article>
                      ))}
                  </div>
              </div>

              {/* CLIENTES FELICES */}
              <div className="mb-4 mt-6">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><ShieldCheck size={16} className="text-blue-400" /> Clientes felices</h3>
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="magnetic flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-blue-400 hover:bg-white/5 hover:text-white">Ver historias <Instagram size={10} /></a>
                  </div>
                  <div className="flex overflow-x-auto gap-3 px-2 pb-4 snap-x snap-mandatory scrollbar-hide">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="liquid-glass min-w-[140px] w-[140px] aspect-[9/16] relative rounded-[1.15rem] shrink-0 snap-center group">
                        <Image src={`/clientes/${num}.jpg`} alt={`Cliente ${num}`} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                           <div className="flex gap-0.5 mb-1">
                              {[1,2,3,4,5].map(star => <Star key={star} size={8} className="text-yellow-400 fill-yellow-400" />)}
                           </div>
                           <p className="text-[9px] text-gray-300 font-medium">Compra verificada</p>
                        </div>
                      </div>
                    ))}
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="min-w-[140px] w-[140px] aspect-[9/16] relative rounded-xl overflow-hidden border border-white/10 shrink-0 snap-center bg-[#111] flex flex-col items-center justify-center gap-3 group hover:bg-[#1a1a1a] transition-colors">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Instagram size={24} className="text-white" /></div>
                        <div className="text-center px-2"><p className="text-white text-xs font-bold mb-1">Ver Más</p><p className="text-[9px] text-gray-500 leading-tight">Revisa nuestras Historias Destacadas</p></div>
                    </a>
                  </div>
              </div>

              {/* OFERTAS FLASH */}
              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><Zap size={15} className="text-blue-400" /> Ofertas destacadas</h3>
                   <span className="brand-chip px-2 py-1 text-[10px] font-bold">Desliza</span>
                </div>
                <div className="flex overflow-x-auto gap-4 px-2 pb-6 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                   {cargando ? ([1,2,3].map(i => <div key={i} className="brand-shell min-w-[280px] h-[410px] rounded-[1.55rem] shrink-0 animate-pulse" />)) : (
                      ofertasFlash.map((item) => (
                        <div key={item.id} className="min-w-[280px] snap-center shrink-0">
                             <GameCard titulo={item.titulo} precio={item.precio} precioOriginal={item.precioOriginal} img={item.img} ahorro={item.ahorro} esPack={item.esPack} storageRequired={item.storageRequired} consoleName={item.consoleName}
                                onAdd={(event) => comprarDirecto(item, event)} 
                                onSave={() => toggleSaved(item)}
                                saved={savedIds.includes(getSavedKey(item))}
                             />
                        </div>
                      ))
                   )}
                </div>
              </div>

              {/* PACKS DESTACADOS */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><Gift size={16} className="text-blue-400" /> Packs imperdibles</h3>
                   <button onClick={() => {setStoreTab('packs'); setActiveSection('catalogo');}} className="magnetic rounded-full border border-blue-500/30 bg-blue-900/20 px-3 py-1.5 text-[10px] font-bold text-blue-400 hover:bg-blue-900/40">Ver todos</button>
                </div>
                <div className="flex overflow-x-auto gap-4 px-2 pb-6 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                   {cargando ? ([1,2,3].map(i => <div key={i} className="brand-shell min-w-[280px] h-[410px] rounded-[1.55rem] shrink-0 animate-pulse" />)) : (
                      packsDestacados.map((item) => (
                        <div key={item.id} className="min-w-[280px] snap-center shrink-0">
                             <GameCard titulo={item.titulo} precio={item.precio} img={item.img} ahorro={item.ahorro} esPack={item.esPack} juegosIncluidos={item.juegosIncluidos} consoleName={item.consoleName}
                                onAdd={(event) => comprarDirecto(item, event)} 
                                onSave={() => toggleSaved(item)}
                                saved={savedIds.includes(getSavedKey(item))}
                             />
                        </div>
                      ))
                   )}
                </div>
              </div>

            </div>
          )}

          {/* SECCIÓN 2: CATÁLOGO */}
          {activeSection === 'catalogo' && (
            <div className="animate-fade-in">
              <div className="premium-surface sticky top-3 z-30 -mx-1 mb-4 space-y-3 rounded-[1.8rem] p-3 backdrop-blur-2xl">
                <div className={`relative flex items-center transition-transform duration-300 ${searchTerm || filterTerm ? 'scale-[1.01]' : 'scale-100'}`}>
                  <input type="text" placeholder={storeTab === 'individual' ? "Busca tu juego..." : "Busca en packs..."} value={searchTerm} onChange={(e) => { const texto = e.target.value; setSearchTerm(texto); if (texto === "") { setFilterTerm(""); setVisibleCount(20); } }} onKeyDown={(e) => { if (e.key === 'Enter') ejecutarBusqueda(); }} className="premium-control w-full rounded-full py-3 pl-5 pr-14 text-base text-white shadow-inner transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/15"/>
                  <button onClick={ejecutarBusqueda} className="magnetic absolute right-2 flex items-center justify-center rounded-full bg-white p-2.5 text-black shadow-lg shadow-white/10 hover:bg-gray-100"><Search size={18} strokeWidth={3} /></button>
                </div>

                <div className="premium-surface relative flex overflow-hidden rounded-full p-1">
                  <span
                    className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-lg shadow-white/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      storeTab === 'packs' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'
                    }`}
                  />
                  <button onClick={() => {setStoreTab('individual'); setSearchTerm(""); setFilterTerm("");}} className={`relative z-10 flex-1 rounded-full py-2.5 text-xs font-black uppercase transition-colors duration-300 ${storeTab === 'individual' ? 'text-black' : 'text-gray-500 hover:text-white'}`}>Juegos Unitarios</button>
                  <button onClick={() => {setStoreTab('packs'); setSearchTerm(""); setFilterTerm(""); setMostrarSoloOfertas(false);}} className={`relative z-10 flex-1 rounded-full py-2.5 text-xs font-black uppercase transition-colors duration-300 ${storeTab === 'packs' ? 'text-black' : 'text-gray-500 hover:text-white'}`}>Pack de Juegos</button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {[
                    { id: 'all', label: 'Todo' },
                    { id: 'switch', label: 'Switch 1 y 2' },
                    { id: 'switch2', label: 'Solo Switch 2' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setConsoleFilter(item.id as 'all' | 'switch' | 'switch2')}
                      className={`magnetic shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
                        consoleFilter === item.id
                          ? 'border-[#e5e4e2]/70 bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-white/10'
                          : 'premium-control text-gray-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {cargando ? (
                 <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-pulse">
                    <div className="relative w-20 h-20 opacity-50"><Image src="/logo.png" alt="Loading" fill className="object-contain" /></div>
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-[0.2em]"><Loader2 className="animate-spin" size={14} />Cargando catálogo</div>
                 </div>
              ) : (
                <>
                  <div className="flex justify-between items-center px-2 mb-4 animate-fade-in">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                      {mostrarSoloOfertas ? "Ofertas" : mostrarGuardados ? "Favoritos" : storeTab === 'packs' ? "Packs" : "Juegos"}
                      <span className="ml-2 text-xs text-white">({listaFiltrada.length})</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setMostrarGuardados(!mostrarGuardados)} className={`magnetic flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase ${mostrarGuardados ? "border-[#e5e4e2]/70 bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-white/10" : "premium-control text-gray-400 hover:text-white"}`}>
                          <Heart size={12} fill={mostrarGuardados ? "currentColor" : "none"} />{mostrarGuardados ? "Favoritos" : savedCountActual}
                      </button>
                      {storeTab === 'individual' && (
                        <button onClick={() => setMostrarSoloOfertas(!mostrarSoloOfertas)} className={`magnetic flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase ${mostrarSoloOfertas ? "border-red-400/60 bg-red-500 text-white shadow-lg shadow-red-900/30" : "premium-control text-gray-400 hover:text-white"}`}>
                            <Filter size={12} />{mostrarSoloOfertas ? "Todo" : "Ofertas"}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div key={`${storeTab}-${filterTerm}-${mostrarSoloOfertas ? 'ofertas' : 'todos'}`} className="grid grid-cols-1 gap-8 animate-fade-in pb-8 px-2">
                      {listaVisual.length > 0 ? (
                        listaVisual.map((item, index) => (
                          <div key={item.id} className="animate-soft-in w-full max-w-[350px] mx-auto" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
                             <GameCard titulo={item.titulo} precio={item.precio} precioOriginal={item.precioOriginal} img={item.img} ahorro={item.ahorro} esPack={item.esPack} juegosIncluidos={item.juegosIncluidos} storageRequired={item.storageRequired} consoleName={item.consoleName}
                                onAdd={(event) => comprarDirecto(item, event)}
                                onSave={() => toggleSaved(item)}
                                saved={savedIds.includes(getSavedKey(item))}
                             />
                          </div>
                        ))
                      ) : (
                          <div className="flex flex-col items-center py-20 text-gray-500">
                              <Search size={40} className="mb-4 opacity-20" />
                              <p className="text-sm font-bold">No encontramos resultados</p>
                              <p className="mt-1 max-w-[230px] text-center text-xs font-semibold leading-relaxed">Puedes limpiar filtros o preguntarnos por WhatsApp si buscas un juego específico.</p>
                              <div className="mt-4 flex gap-2">
                                <button onClick={() => {setFilterTerm(""); setSearchTerm(""); setVisibleCount(20); setMostrarSoloOfertas(false); setMostrarGuardados(false); setConsoleFilter('all');}} className="magnetic rounded-full bg-white px-4 py-2 text-xs font-black uppercase text-black">Ver todo</button>
                                <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="magnetic rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase text-white">Consultar</a>
                              </div>
                          </div>
                      )}
                  </div>
                  {visibleCount < listaFiltrada.length && (
                    <div className="flex justify-center mt-8 pb-4">
                      <button onClick={() => setVisibleCount(prev => prev + 20)} className="premium-surface flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase text-white transition-all duration-300 hover:bg-white hover:text-black">
                        <ArrowDownCircle size={16} /> Ver más
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SECCIÓN 3: INSTRUCCIONES */}
          {activeSection === 'instrucciones' && (
            <div className="animate-fade-in pb-24 pt-5">
                <section className="premium-surface animate-soft-in relative mx-1 mb-5 overflow-hidden rounded-[2rem] p-5">
                    <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-yellow-500/10 blur-3xl" />
                    <div className="relative">
                        <div className="mb-5 flex items-center justify-between">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                                <BookOpen size={22} className="text-blue-400" />
                            </div>
                            <span className="rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-green-400">Soporte activo</span>
                        </div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-blue-400">Centro de ayuda</p>
                        <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-white">Instala sin dudas</h2>
                        <p className="mt-3 max-w-[290px] text-xs font-semibold leading-relaxed text-gray-500">
                            Elige tu consola y revisa las instrucciones antes de descargar. Todo está pensado para que no pierdas garantía por errores simples.
                        </p>
                    </div>
                </section>

                {/* CAJA DE ADVERTENCIA */}
                <div className="premium-surface animate-soft-in mx-1 mb-5 overflow-hidden rounded-[1.75rem] p-4" style={{ animationDelay: '80ms' }}>
                    <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">
                        <AlertTriangle size={16} /> Antes de comprar
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            ['Espacio', 'Revisa memoria/SD disponible.'],
                            ['Cuenta principal', 'Instala siguiendo el método indicado.'],
                            ['Descarga inmediata', 'Si son varios, baja todos al recibirlos.'],
                            ['No archivar', 'Archivar cuenta como eliminar y anula garantía.'],
                        ].map(([title, copy], index) => (
                            <div key={title} className="animate-soft-in rounded-2xl border border-white/10 bg-white/5 p-3 text-left" style={{ animationDelay: `${120 + index * 45}ms` }}>
                                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10 text-[10px] font-black text-yellow-500">{index + 1}</div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-white">{title}</p>
                                <p className="mt-1 text-[10px] font-semibold leading-snug text-gray-500">{copy}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-blue-400/10 bg-blue-500/10 p-3">
                        <Zap size={14} className="mt-0.5 shrink-0 text-blue-400" />
                        <p className="text-[10px] font-semibold leading-relaxed text-blue-200">Tip: jugar sin conexión disminuye el riesgo de caídas y evita errores durante el uso.</p>
                    </div>
                </div>

                {/* TABS AYUDA */}
                <div className="premium-surface relative mx-1 mb-5 flex overflow-hidden rounded-full p-1">
                    <span className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-lg shadow-white/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${helpTab === 'switch1' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'}`} />
                    <button onClick={() => setHelpTab('switch2')} className={`relative z-10 flex-1 rounded-full py-3 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${helpTab === 'switch2' ? 'text-black' : 'text-gray-500 hover:text-white'}`}><span className="flex items-center justify-center gap-2"><Zap size={14} /> Switch 2</span></button>
                    <button onClick={() => setHelpTab('switch1')} className={`relative z-10 flex-1 rounded-full py-3 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${helpTab === 'switch1' ? 'text-black' : 'text-gray-500 hover:text-white'}`}><span className="flex items-center justify-center gap-2"><Gamepad2 size={14} /> Switch 1 / Lite</span></button>
                </div>

                <div className="px-1">
                    {helpTab === 'switch2' && (
                        <div key="switch2-help" className="premium-surface animate-soft-in overflow-hidden rounded-[1.75rem]">
                            <div className="relative aspect-video w-full overflow-hidden rounded-t-[1.75rem] bg-black group">
                                <iframe src="https://www.youtube.com/embed/Tl5A7OeRbh0" title="Tutorial Switch 2" className="absolute left-0 top-0 h-full w-full opacity-90 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                            <div className="space-y-3 p-5">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xs font-black text-red-500">01</div>
                                    <div className="text-left">
                                        <p className="text-xs font-black uppercase tracking-wider text-white">Video obligatorio</p>
                                        <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">Mira el tutorial completo antes de empezar. Switch 2 requiere pasos específicos y conviene seguirlos en orden.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-2xl border border-red-500/10 bg-red-900/10 p-3">
                                    <Youtube size={16} className="shrink-0 text-red-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-200">Tutorial oficial Alfeicon Games</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {helpTab === 'switch1' && (
                        <div key="switch1-help" className="premium-surface animate-soft-in relative overflow-hidden rounded-[1.75rem] p-6 text-center">
                            <div className="pointer-events-none absolute inset-x-8 top-0 h-28 rounded-full bg-blue-500/10 blur-3xl" />
                            <div className="relative">
                                <div className="animate-gentle-float mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-blue-400/20 bg-blue-500/10">
                                    <FileText size={32} className="text-blue-400" />
                                </div>
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-blue-400">Guía ilustrada</p>
                                <h3 className="text-xl font-black text-white">Manual PDF</h3>
                                <p className="mx-auto mt-3 max-w-[260px] text-xs font-semibold leading-relaxed text-gray-500">
                                    Paso a paso para modelos estándar, OLED y Lite. Ideal para tenerlo abierto mientras instalas.
                                </p>
                                <a href="/guia.pdf" target="_blank" className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-white/10 transition active:scale-95">
                                    <FileText size={15} /> Descargar guía
                                </a>
                                <p className="mt-4 text-[9px] font-bold uppercase tracking-widest text-gray-600">Formato PDF • 2.5 MB</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="premium-surface mx-1 mt-5 rounded-[1.75rem] p-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">¿Aún tienes dudas?</p>
                            <p className="mt-1 text-sm font-black text-white">Te ayudamos por WhatsApp</p>
                        </div>
                        <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-900/30 transition active:scale-95" aria-label="Soporte WhatsApp">
                            <MessageCircle size={20} />
                        </a>
                    </div>
                </div>
            </div>
          )}

{/* SECCIÓN 4: AYUDA Y CONFIANZA */}
          {activeSection === 'perfil' && (
            <div className="animate-fade-in space-y-5 px-1 pb-24 pt-5">
                <section className="premium-surface animate-soft-in relative overflow-hidden rounded-[2rem] p-5 text-left">
                    <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-green-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="relative">
                        <div className="mb-5 flex items-center justify-between">
                            <div className="relative h-14 w-14 rounded-2xl border border-white/10 bg-white/10 shadow-xl">
                                <Image src="/logo.png" alt="Alfeicon Games" fill className="object-contain p-2" />
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-green-400/20 bg-green-500/10 px-3 py-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-green-400">Online</span>
                            </div>
                        </div>
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-blue-400">Alfeicon Games</p>
                        <h2 className="text-3xl font-black uppercase leading-none tracking-tight text-white">Soporte y confianza</h2>
                        <p className="mt-3 max-w-[300px] text-xs font-semibold leading-relaxed text-gray-500">
                            Canales oficiales, dudas frecuentes y condiciones importantes antes de comprar.
                        </p>
                    </div>
                </section>

                <section className="premium-surface animate-soft-in rounded-[1.75rem] p-5 text-left" style={{ animationDelay: '70ms' }}>
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Mensaje oficial</p>
                            <p className="text-sm font-black text-white">Estamos para ayudarte</p>
                        </div>
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-gray-300">
                        Gracias por visitar Alfeicon Games. Si tienes dudas antes de comprar, escríbenos por nuestros canales oficiales y te guiamos durante el proceso.
                    </p>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-blue-400">Alfeicon Games</p>
                </section>

                <section className="grid grid-cols-2 gap-3">
                    {[
                        { href: `https://wa.me/${CONFIG.whatsappNumber}`, label: 'WhatsApp', meta: 'Compra y soporte', icon: <MessageCircle size={20} />, color: 'text-green-400', delay: 110 },
                        { href: 'https://instagram.com/alfeicon_games', label: 'Instagram', meta: '+2.800 seguidores', icon: <Instagram size={20} />, color: 'text-pink-500', delay: 155 },
                        { href: 'https://web.facebook.com/alfeicon.games', label: 'Facebook', meta: 'Página oficial', icon: <Facebook size={20} />, color: 'text-blue-500', delay: 200 },
                        { href: 'https://www.youtube.com/@alfeicon_games', label: 'YouTube', meta: 'Tutoriales', icon: <Youtube size={20} />, color: 'text-red-500', delay: 245 },
                    ].map((channel) => (
                        <a
                            key={channel.label}
                            href={channel.href}
                            target="_blank"
                            className="premium-surface animate-soft-in group rounded-[1.5rem] p-4 text-left transition duration-300 hover:-translate-y-1 active:scale-[0.98]"
                            style={{ animationDelay: `${channel.delay}ms` }}
                        >
                            <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 ${channel.color}`}>
                                {channel.icon}
                            </div>
                            <p className="text-sm font-black uppercase tracking-wide text-white">{channel.label}</p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <p className="text-[10px] font-semibold text-gray-500">{channel.meta}</p>
                                <span className="text-gray-600 transition-transform group-hover:translate-x-1">↗</span>
                            </div>
                        </a>
                    ))}
                </section>

                <section className="premium-surface rounded-[1.75rem] p-5 text-left">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-400">FAQ</p>
                            <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-white">Dudas frecuentes</h3>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-blue-400">
                            <BookOpen size={20} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {[
                            ['¿Necesito mi consola desbloqueada?', 'No. Los juegos son digitales y se descargan desde la eShop oficial de Nintendo.'],
                            ['¿Existe riesgo de baneo?', 'Existe un riesgo mínimo asociado a normas externas de Nintendo. El cliente acepta este punto al comprar.'],
                            ['¿Tienen garantía y soporte?', 'Ofrecemos 3 meses de garantía técnica y ayuda por WhatsApp durante la instalación.'],
                            ['¿Cuánto tiempo durará el juego?', 'La duración es indefinida si sigues las instrucciones: no borrar juego/cuenta ni modificar datos.'],
                        ].map(([question, answer], index) => (
                            <div key={question} className="animate-soft-in rounded-2xl border border-white/10 bg-white/5 p-4" style={{ animationDelay: `${280 + index * 45}ms` }}>
                                <div className="mb-2 flex items-center gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-black">{index + 1}</span>
                                    <p className="text-xs font-black uppercase tracking-wide text-white">{question}</p>
                                </div>
                                <p className="pl-10 text-xs font-semibold leading-relaxed text-gray-500">{answer}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <button onClick={() => setShowTerms(true)} className="premium-surface flex w-full items-center justify-between rounded-full px-5 py-4 text-left transition active:scale-[0.98]">
                    <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <ShieldCheck size={15} className="text-blue-400" /> Términos y condiciones
                    </span>
                    <ChevronRight size={16} className="text-gray-500" />
                </button>
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
                            <p className="text-gray-400 text-[10px] uppercase font-bold">Clientes Nuevos</p>
                            <p className="text-lg text-blue-400 font-black">2 Meses</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-xl border border-blue-500/30">
                            <p className="text-gray-400 text-[10px] uppercase font-bold">Frecuentes (5+)</p>
                            <p className="text-lg text-green-400 font-black">4 Meses</p>
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
          <div className="fixed bottom-24 left-1/2 z-[55] w-[min(360px,calc(100%-2rem))] -translate-x-1/2 animate-soft-in">
            <div className="brand-shell flex items-center justify-between rounded-[1.7rem] px-5 py-4 text-white backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0a0a0a]">
                  <Heart size={18} fill="currentColor" />
                </span>
                <span className="text-sm font-black">Guardado</span>
              </div>
              <button
                onClick={() => {
                  setActiveSection('catalogo');
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

        {/* NAVEGACIÓN INFERIOR */}
        <nav className={`premium-surface fixed bottom-5 left-1/2 z-50 flex h-16 w-[min(360px,calc(100%-2rem))] -translate-x-1/2 items-center justify-around overflow-hidden rounded-full px-2 backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${showBottomNav ? 'translate-y-0' : 'translate-y-28'}`}>
          <span
            className="pointer-events-none absolute left-2 top-2 h-12 rounded-full bg-[#e5e4e2] shadow-lg shadow-[#e5e4e2]/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: 'calc((100% - 1rem) / 4)',
              transform: `translateX(${navIndex * 100}%)`,
            }}
          />
          <NavButton active={activeSection === 'inicio'} onClick={() => setActiveSection('inicio')} icon={<Home size={22} />} label="Inicio" />
          <NavButton active={activeSection === 'catalogo'} onClick={() => setActiveSection('catalogo')} icon={<Gamepad2 size={22} />} label="Tienda" />
          <NavButton active={activeSection === 'instrucciones'} onClick={() => setActiveSection('instrucciones')} icon={<BookOpen size={22} />} label="Guía" />
          <NavButton active={activeSection === 'perfil'} onClick={() => setActiveSection('perfil')} icon={<MessageCircle size={22} />} label="Ayuda" />
        </nav>
      </div>
    </div>
  );
}

// COMPONENTE AUXILIAR BOTÓN
function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group relative flex h-full flex-1 items-center justify-center"
    >
      <span className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 ${
        active
          ? 'text-black scale-105'
          : 'text-gray-600 hover:text-white'
      }`}>
        <span className={`transition-transform duration-300 ${active ? 'scale-105' : 'scale-95 group-hover:scale-100'}`}>
          {icon}
        </span>
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
