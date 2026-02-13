// app/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { 
  Home, Gamepad2, BookOpen, Search, Instagram, MessageCircle, 
  Loader2, ArrowDownCircle, Zap, Layers, Youtube, FileText, 
  ShieldCheck, AlertTriangle, Facebook, X, Megaphone, Filter, Star, Gift, CheckCircle, ChevronRight
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import Papa from 'papaparse'; 
import { DATA_IMAGENES } from './data/imagenes';
import Fuse from 'fuse.js';

// --- CONFIGURACIÓN ---
const CONFIG = {
  whatsappNumber: "56926411278",
  emailSoporte: "alfeicon.games@gmail.com",
  canalWhatsapp: "https://whatsapp.com/channel/0029VafHhlx0G0XpvqQKyG2D", 
  sheetGames: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQsDYcvcNTrISbWFc5O2Cyvtsn7Aaz_nEV32yWDLh_dIR_4t1Kz-cep6oaXnQQrCxfhRy1K-H6JTk4/pub?gid=1961555999&single=true&output=csv",
  sheetPacks: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQsDYcvcNTrISbWFc5O2Cyvtsn7Aaz_nEV32yWDLh_dIR_4t1Kz-cep6oaXnQQrCxfhRy1K-H6JTk4/pub?gid=858783180&single=true&output=csv",
  
  // Días para que un pack se considere NUEVO (y aparezca el aviso)
  diasParaSerNuevo: 5 
};

// --- HELPERS ---
const limpiarTexto = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9]/g, '');

const buscarImagenLocal = (nombreJuego: string) => {
  if (!nombreJuego || !DATA_IMAGENES) return null;
  const inputLimpio = limpiarTexto(nombreJuego);
  // @ts-ignore
  const encontrado = DATA_IMAGENES.find((item: any) => 
      limpiarTexto(item.name) === inputLimpio
  );
  return encontrado ? encontrado.url : null;
};

// --- FUNCIÓN DE FECHA BLINDADA ---
const parseFechaSegura = (fechaStr: string) => {
    if (!fechaStr) return null;
    const fechaLimpia = fechaStr.split(' ')[0].trim();
    const partes = fechaLimpia.split(/[-/]/); 
    if (partes.length === 3) {
        const dia = Number(partes[0]);
        const mes = Number(partes[1]) - 1; 
        const anio = Number(partes[2]);
        return new Date(anio, mes, dia);
    }
    return null;
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
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState(""); 
  const [filterTerm, setFilterTerm] = useState(""); 
  
  const [mostrarSoloOfertas, setMostrarSoloOfertas] = useState(false);

  const [productos, setProductos] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [visibleCount, setVisibleCount] = useState(20); 

  // --- FUNCIONES (HANDLERS) ---
  const ejecutarBusqueda = useCallback(() => {
    setFilterTerm(searchTerm);
    setVisibleCount(20); 
  }, [searchTerm]);

  const comprarDirecto = useCallback((item: any) => {
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
    window.open(url, '_blank');
  }, []);

  // --- EFECTOS ---
  useEffect(() => {
    window.scrollTo(0, 0);
    if (activeSection !== 'catalogo') {
        setSearchTerm("");
        setFilterTerm("");
        setMostrarSoloOfertas(false);
    }
    setVisibleCount(20);
  }, [activeSection, storeTab]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsHeaderVisible(false);
      }
      lastScrollY = currentScrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    // CARGA DE DATOS
    const cargarDatos = async () => {
        const timeStamp = new Date().getTime(); // Anti-caché

        Papa.parse(CONFIG.sheetGames + "&t=" + timeStamp, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results: any) => {
            const datosLimpios = results.data.map((item: any, index: number) => {
              const limpiarPrecio = (valor: string) => {
                if (!valor) return 0;
                return Number(valor.toString().replace(/[^0-9]/g, '')); 
              };
              const getCol = (key: string) => {
                 const realKey = Object.keys(item).find(k => k.trim().toLowerCase() === key.toLowerCase());
                 return realKey ? item[realKey] : undefined;
              };
              const titulo = getCol("NOMBRE DE JUEGOS");
              const imagenFinal = getCol("imagen") || buscarImagenLocal(titulo);
              const enOferta = getCol("En Oferta") === "SI";
              const precioNormal = limpiarPrecio(getCol("Precio"));
              const precioOferta = limpiarPrecio(getCol("Precio Oferta"));

              return {
                id: `game-${index}`,
                titulo: titulo, 
                img: imagenFinal,
                precio: enOferta ? precioOferta : precioNormal,
                precioOriginal: enOferta ? precioNormal : null, 
                esPack: false,
                ahorro: enOferta ? "OFERTA 🔥" : null
              };
            }).filter((item: any) => item.titulo);
            setProductos(datosLimpios);
            if(packs.length > 0) setCargando(false); 
          },
          error: (error: any) => { console.error("Error Juegos:", error); }
        });

        Papa.parse(CONFIG.sheetPacks + "&t=" + timeStamp, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
              const packsLimpios = results.data.map((item: any, index: number) => {
                const limpiarPrecio = (valor: string) => {
                    if (!valor) return 0;
                    return Number(valor.toString().replace(/[^0-9]/g, '')); 
                };
                const getCol = (key: string) => {
                     const realKey = Object.keys(item).find(k => k.trim().toLowerCase() === key.toLowerCase());
                     return realKey ? item[realKey] : undefined;
                };
                const rawJuegos = getCol("Juegos Incluidos") || "";
                const listaJuegos = rawJuegos.split(/\r?\n/).filter((line: string) => line.trim() !== "");
                const nombrePack = `Pack ${getCol("Pack ID") || index + 1}`;
                
                let imagenPack = getCol("imagen") || getCol("img");
                if (!imagenPack && listaJuegos.length > 0) {
                    for (const juegoRaw of listaJuegos) {
                        const juegoLimpio = juegoRaw.replace(/^\d+\.?\s*/, '').trim();
                        const posibleImagen = buscarImagenLocal(juegoLimpio);
                        if (posibleImagen) { imagenPack = posibleImagen; break; }
                    }
                }

                let esNuevo = false;
                const fechaStr = getCol("fecha");
                const fechaPack = parseFechaSegura(fechaStr);
                
                if (fechaPack) {
                    const hoy = new Date();
                    const fechaPackSinHora = new Date(fechaPack.getFullYear(), fechaPack.getMonth(), fechaPack.getDate());
                    const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
                    const diffTime = Math.abs(hoySinHora.getTime() - fechaPackSinHora.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays <= CONFIG.diasParaSerNuevo) {
                        esNuevo = true;
                    }
                }

                return {
                  id: `pack-${index}`,
                  titulo: nombrePack,
                  img: imagenPack, 
                  precio: limpiarPrecio(getCol("Precio CLP")),
                  esPack: true,
                  ahorro: esNuevo ? "¡NUEVO! 🚀" : null,
                  juegosIncluidos: listaJuegos,
                  esNuevo: esNuevo
                };
              }).filter((item: any) => item.precio > 0);
              
              packsLimpios.sort((a: any, b: any) => (b.esNuevo === true ? 1 : 0) - (a.esNuevo === true ? 1 : 0));
              setPacks(packsLimpios);
              setCargando(false);
            },
            error: (error: any) => console.error("Error Packs:", error)
        });
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
    return items;
  }, [storeTab, productos, packs, filterTerm, fuseInstance, mostrarSoloOfertas]);

  const listaVisual = listaFiltrada.slice(0, visibleCount);

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-black flex justify-center selection:bg-white selection:text-black">
      <div className="w-full max-w-md bg-black min-h-screen relative shadow-2xl border-x border-gray-900 font-sans text-white overflow-hidden">
        
        {/* HEADER */}
        <header className={`absolute top-0 w-full z-40 bg-black/90 backdrop-blur-xl p-5 pb-3 border-b border-white/5 transition-transform duration-300 ease-in-out ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex flex-col items-center justify-center mb-4">
               <div className="relative w-14 h-14 mb-2">
                 <Image src="/logo.png" alt="Alfeicon Logo" fill className="object-contain" priority />
               </div>
               <h1 className="text-xl font-black tracking-[0.2em] text-white uppercase leading-none">ALFEICON <span className="font-light">GAMES</span></h1>
            </div>
            {activeSection === 'catalogo' && (
              <div className="relative group animate-fade-in flex items-center">
                <input type="text" placeholder={storeTab === 'individual' ? "Busca tu juego..." : "Busca en packs..."} value={searchTerm} onChange={(e) => { const texto = e.target.value; setSearchTerm(texto); if (texto === "") { setFilterTerm(""); setVisibleCount(20); } }} onKeyDown={(e) => { if (e.key === 'Enter') ejecutarBusqueda(); }} className="w-full bg-[#111] text-white rounded-full py-3 pl-5 pr-14 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base placeholder-gray-500 border border-white/10 transition-all shadow-inner"/>
                <button onClick={ejecutarBusqueda} className="absolute right-2 bg-blue-600 hover:bg-blue-500 p-2.5 rounded-full text-white shadow-lg shadow-blue-900/50 transition-transform active:scale-90 flex items-center justify-center"><Search size={18} strokeWidth={3} /></button>
              </div>
            )}
        </header>

        {/* MAIN */}
        <main className="pb-32 pt-52 px-4 min-h-screen">
          
{/* SECCIÓN 1: INICIO */}
          {activeSection === 'inicio' && (
            <div className="animate-fade-in space-y-8">
              
              {/* DASHBOARD ESTADO */}
              <div className="relative w-full bg-[#111] rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600/10 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>
                  <div className="absolute inset-0 bg-[url('/logo.png')] opacity-5 bg-center bg-no-repeat bg-contain pointer-events-none mix-blend-overlay"></div>

                  <div className="relative z-10 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
                        <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                        Estado de la Tienda
                      </h2>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-start relative overflow-hidden group/card">
                          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-40 transition-opacity"><Layers size={40} /></div>
                          <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1 z-10">Packs Totales</div>
                          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-600 z-10">
                             {packs.length > 0 ? packs.length : '-'}
                          </div>
                       </div>
                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-start relative overflow-hidden group/card">
                          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-40 transition-opacity"><Gamepad2 size={40} /></div>
                          <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1 z-10">Juegos Unitarios</div>
                          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-400 z-10">
                             {productos.length > 0 ? productos.length : '-'}
                          </div>
                       </div>
                    </div>

                    <a href={CONFIG.canalWhatsapp} target="_blank" className="block w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 border border-white/10 p-4 rounded-xl text-center shadow-lg transition-all active:scale-95 group/btn relative overflow-hidden">
                       <div className="flex items-center justify-center gap-3 relative z-10">
                          <div className="bg-white p-2 rounded-full text-green-700 shadow-sm animate-bounce-slow"><Megaphone size={18} fill="currentColor" /></div>
                          <div className="flex flex-col items-start">
                              <span className="text-white font-black uppercase tracking-wide text-xs text-shadow">CANAL DE WHATSAPP</span>
                              <span className="text-[10px] text-green-100 font-medium">Únete <strong className="text-white underline decoration-white/50">GRATIS</strong> para ofertas</span>
                          </div>
                       </div>
                    </a>
                  </div>
              </div>

              {/* AVISO DE NOVEDADES (BANNER ELEGANTE) */}
              {nuevosLanzamientos.length > 0 && (
                <div className="animate-fade-in mx-1">
                   <div className="relative w-full bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-blue-500/30 rounded-2xl p-4 shadow-xl overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] translate-x-10 -translate-y-10"></div>
                       
                       <div className="flex items-center justify-between relative z-10">
                           <div className="flex items-center gap-3">
                               <div className="bg-blue-600/20 p-2.5 rounded-full border border-blue-500/30 animate-pulse">
                                   <Megaphone size={18} className="text-blue-400" />
                               </div>
                               <div className="flex flex-col">
                                   <h3 className="text-sm font-black text-white uppercase italic tracking-wider">
                                       ¡Nuevos Packs Disponibles!
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
                               className="bg-white text-blue-900 hover:bg-gray-200 text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-full shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-1"
                           >
                               Ver Ahora <ChevronRight size={12} />
                           </button>
                       </div>
                   </div>
                </div>
              )}

              {/* RECUADRO CÓMO COMPRAR */}
              <div className="mx-1 p-5 bg-[#0a0a0a] border border-white/5 rounded-3xl shadow-xl">
                  <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                      <CheckCircle size={14} /> ¿Cómo comprar en Alfeicon?
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                      {/* Paso 1 */}
                      <div className="flex items-center gap-4 group">
                          <div className="w-10 h-10 shrink-0 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 font-black group-hover:scale-110 transition-transform">1</div>
                          <div>
                              <p className="text-xs font-bold text-white uppercase tracking-wide">Elige tu juego</p>
                              <p className="text-[10px] text-gray-500">Explora el catálogo y selecciona tus favoritos.</p>
                          </div>
                      </div>

                      {/* Paso 2 */}
                      <div className="flex items-center gap-4 group">
                          <div className="w-10 h-10 shrink-0 bg-pink-600/10 border border-pink-500/20 rounded-2xl flex items-center justify-center text-pink-400 font-black group-hover:scale-110 transition-transform">2</div>
                          <div>
                              <p className="text-xs font-bold text-white uppercase tracking-wide">Pide por WhatsApp</p>
                              <p className="text-[10px] text-gray-500">Haz clic en comprar para coordinar el pago por chat.</p>
                          </div>
                      </div>

                      {/* Paso 3 */}
                      <div className="flex items-center gap-4 group">
                          <div className="w-10 h-10 shrink-0 bg-green-600/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-green-400 font-black group-hover:scale-110 transition-transform">3</div>
                          <div>
                              <p className="text-xs font-bold text-white uppercase tracking-wide">¡Recibe y Juega!</p>
                              <p className="text-[10px] text-gray-500">Paga con transferencia y recibe las instrucciones al instante.</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* CLIENTES FELICES */}
              <div className="mb-4 mt-6">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={16} className="text-green-400" /> Clientes Felices</h3>
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="text-[10px] text-blue-400 font-bold hover:text-white transition flex items-center gap-1">Ver Historias <Instagram size={10} /></a>
                  </div>
                  <div className="flex overflow-x-auto gap-3 px-2 pb-4 snap-x snap-mandatory scrollbar-hide">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="min-w-[140px] w-[140px] aspect-[9/16] relative rounded-xl overflow-hidden border border-white/10 shrink-0 snap-center bg-[#151515] group">
                        <Image src={`/clientes/${num}.jpg`} alt={`Cliente ${num}`} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                           <div className="flex gap-0.5 mb-1">
                              {[1,2,3,4,5].map(star => <Star key={star} size={8} className="text-yellow-400 fill-yellow-400" />)}
                           </div>
                           <p className="text-[9px] text-gray-300 font-medium">Compra Verificada</p>
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
                   <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">🔥 Ofertas Flash</h3>
                   <span className="text-[10px] text-gray-500 font-bold bg-white/10 px-2 py-1 rounded-full animate-pulse">Desliza →</span>
                </div>
                <div className="flex overflow-x-auto gap-4 px-2 pb-6 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                   {cargando ? ([1,2,3].map(i => <div key={i} className="min-w-[280px] h-[350px] bg-[#111] rounded-xl animate-pulse border border-white/5 shrink-0" />)) : (
                      ofertasFlash.map((item) => (
                        <div key={item.id} className="min-w-[280px] snap-center shrink-0">
                             <GameCard titulo={item.titulo} precio={item.precio} precioOriginal={item.precioOriginal} img={item.img} ahorro={item.ahorro} esPack={item.esPack} 
                                onAdd={() => comprarDirecto(item)} 
                             />
                        </div>
                      ))
                   )}
                </div>
              </div>

              {/* PACKS DESTACADOS */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Gift size={16} className="text-blue-400" /> Packs Imperdibles</h3>
                   <button onClick={() => {setStoreTab('packs'); setActiveSection('catalogo');}} className="text-[10px] text-blue-400 font-bold bg-blue-900/20 px-3 py-1.5 rounded-full hover:bg-blue-900/40 transition border border-blue-500/30">Ver todos →</button>
                </div>
                <div className="flex overflow-x-auto gap-4 px-2 pb-6 snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                   {cargando ? ([1,2,3].map(i => <div key={i} className="min-w-[280px] h-[350px] bg-[#111] rounded-xl animate-pulse border border-white/5 shrink-0" />)) : (
                      packsDestacados.map((item) => (
                        <div key={item.id} className="min-w-[280px] snap-center shrink-0">
                             <GameCard titulo={item.titulo} precio={item.precio} img={item.img} ahorro={item.ahorro} esPack={item.esPack} juegosIncluidos={item.juegosIncluidos}
                                onAdd={() => comprarDirecto(item)} 
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
              <div className="flex bg-[#111] p-1 rounded-full mb-8 border border-white/10 sticky top-4 z-30 shadow-2xl">
                <button onClick={() => {setStoreTab('individual'); setSearchTerm(""); setFilterTerm("");}} className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${storeTab === 'individual' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Juegos Unitarios</button>
                <button onClick={() => {setStoreTab('packs'); setSearchTerm(""); setFilterTerm("");}} className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${storeTab === 'packs' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>Pack de Juegos</button>
              </div>
              
              {cargando ? (
                 <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-pulse">
                    <div className="relative w-20 h-20 opacity-50"><Image src="/logo.png" alt="Loading" fill className="object-contain" /></div>
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-[0.2em]"><Loader2 className="animate-spin" size={14} />Cargando...</div>
                 </div>
              ) : (
                <>
                  <div className="flex justify-between items-center px-2 mb-4 animate-fade-in">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                      {mostrarSoloOfertas ? "🔥 Solo Ofertas" : "Todos los Juegos"}
                      <span className="text-white ml-2 text-sm">({listaFiltrada.length})</span>
                    </p>
                    {storeTab === 'individual' && (
                        <button onClick={() => setMostrarSoloOfertas(!mostrarSoloOfertas)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${mostrarSoloOfertas ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40" : "bg-[#111] border-white/20 text-gray-400 hover:text-white"}`}>
                            <Filter size={12} />{mostrarSoloOfertas ? "Ver Todo" : "Ver Ofertas"}
                        </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8 animate-fade-in pb-8 px-2">
                      {listaVisual.length > 0 ? (
                        listaVisual.map((item) => (
                          <div key={item.id} className="w-full max-w-[350px] mx-auto">
                             <GameCard titulo={item.titulo} precio={item.precio} precioOriginal={item.precioOriginal} img={item.img} ahorro={item.ahorro} esPack={item.esPack} juegosIncluidos={item.juegosIncluidos}
                                onAdd={() => comprarDirecto(item)}
                             />
                          </div>
                        ))
                      ) : (
                          <div className="flex flex-col items-center py-20 text-gray-500">
                              <Search size={40} className="mb-4 opacity-20" />
                              <p className="text-sm">No encontramos juegos...</p>
                              <button onClick={() => {setFilterTerm(""); setSearchTerm(""); setVisibleCount(20); setMostrarSoloOfertas(false);}} className="mt-4 text-blue-400 text-xs underline">Ver todo el catálogo</button>
                          </div>
                      )}
                  </div>
                  {visibleCount < listaFiltrada.length && (
                    <div className="flex justify-center mt-8 pb-4">
                      <button onClick={() => setVisibleCount(prev => prev + 20)} className="flex items-center gap-2 bg-[#111] border border-white/20 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all">
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
            <div className="animate-fade-in pb-20">
                <div className="text-center mb-6 pt-4">
                    <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-2">Centro de Ayuda</h2>
                    <p className="text-gray-500 text-xs font-medium max-w-[250px] mx-auto">Selecciona tu modelo de consola:</p>
                </div>

                {/* CAJA DE ADVERTENCIA */}
                <div className="mx-2 mb-8 bg-[#151515] border border-yellow-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500/50"></div>
                    <h3 className="text-yellow-500 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><AlertTriangle size={16} /> Antes de Comprar</h3>
                    <ul className="space-y-3 text-[11px] text-gray-300 leading-relaxed font-medium">
                        <li className="flex items-start gap-2"><span className="text-yellow-500">•</span><span>Verifica el <strong className="text-white">espacio disponible</strong> en tu consola/SD.</span></li>
                        <li className="flex items-start gap-2"><span className="text-yellow-500">•</span><span>Las instrucciones son para <strong className="text-white">cuenta principal</strong>.</span></li>
                        <li className="flex items-start gap-2"><span className="text-yellow-500">•</span><span>Si compras más de un juego, <strong className="text-white">descárgalos todos</strong> de inmediato.</span></li>
                        <li className="flex items-start gap-2"><span className="text-red-500 font-bold">!</span><span className="text-red-200">Recuerda: <strong>Archivar = Eliminar</strong>. Esto anula la garantía.</span></li>
                        <li className="flex items-start gap-2 pt-2 border-t border-white/5"><Zap size={12} className="text-blue-400 shrink-0 mt-0.5" /><span className="text-blue-200">Recomendación Pro: Jugar <strong>sin conexión</strong> disminuye riesgo de caídas.</span></li>
                    </ul>
                </div>

                {/* TABS AYUDA */}
                <div className="flex p-1 bg-[#1a1a1a] rounded-xl border border-white/10 mb-8 mx-2 relative">
                    <button onClick={() => setHelpTab('switch2')} className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 ${helpTab === 'switch2' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-gray-500 hover:text-white'}`}><Zap size={14} className={helpTab === 'switch2' ? 'fill-white' : ''} /> Switch 2</button>
                    <button onClick={() => setHelpTab('switch1')} className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 ${helpTab === 'switch1' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}><Gamepad2 size={14} className={helpTab === 'switch1' ? 'fill-white' : ''} /> Switch 1 / Lite</button>
                </div>

                <div className="px-2">
                    {helpTab === 'switch2' && (
                        <div className="animate-fade-in bg-[#111] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                            <div className="relative w-full aspect-video bg-black group"><iframe src="https://www.youtube.com/embed/Tl5A7OeRbh0" title="Tutorial Switch 2" className="absolute top-0 left-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
                            <div className="p-5"><div className="flex items-start gap-3 mb-4"><div className="bg-red-500/10 p-2 rounded-full min-w-[35px] text-center font-black text-red-500 text-xs">01</div><p className="text-gray-300 text-xs leading-relaxed">Mira el video completo antes de empezar. El proceso en <span className="text-white font-bold">Switch 2</span> requiere pasos específicos.</p></div><div className="flex items-center gap-2 p-3 bg-red-900/10 border border-red-500/10 rounded-xl"><Youtube size={16} className="text-red-500 shrink-0" /><span className="text-[10px] text-red-200 font-medium">Video Oficial Alfeicon Games</span></div></div>
                        </div>
                    )}
                    {helpTab === 'switch1' && (
                        <div className="animate-fade-in bg-gradient-to-b from-[#1a1a1a] to-black rounded-3xl p-6 border border-white/10 text-center relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
                            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/30"><FileText size={32} className="text-blue-400" /></div>
                            <h3 className="text-lg font-bold text-white mb-2">Manual PDF</h3>
                            <p className="text-gray-400 text-xs mb-8 leading-relaxed px-4">Guía ilustrada paso a paso para modelos <br/><span className="text-blue-400 font-bold">Estándar, OLED y Lite</span>.</p>
                            <a href="/guia.pdf" target="_blank" className="block w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-4">Descargar Guía</a>
                            <p className="text-[9px] text-gray-600">Formato PDF • 2.5 MB</p>
                        </div>
                    )}
                </div>

                <div className="mt-12 border-t border-white/5 pt-6 px-4 text-center">
                    <p className="text-gray-500 text-[10px] mb-3">¿Aún tienes dudas con la instalación?</p>
                    <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="inline-flex items-center gap-2 text-green-400 text-xs font-bold bg-green-900/10 px-4 py-2 rounded-full hover:bg-green-900/20 transition"><MessageCircle size={14} /> Soporte WhatsApp</a>
                </div>
            </div>
          )}

{/* SECCIÓN 4: AYUDA Y CONFIANZA */}
          {activeSection === 'perfil' && (
            <div className="flex flex-col items-center py-10 animate-fade-in px-6 pb-24 text-center">
                <div className="relative w-28 h-28 bg-black border border-white/20 rounded-full mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden">
                    <Image src="/logo.png" alt="Alfeicon Logo Grande" fill className="object-cover p-2"/>
                </div>
                
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-4">ALFEICON</h2>
                
                {/* MENSAJE PERSONAL BASTIAN - TEXTO MÁS GRANDE */}
                <div className="bg-[#111] border border-white/5 p-6 rounded-3xl mb-10 shadow-inner">
                    <p className="text-gray-200 text-sm leading-relaxed font-medium">
                        "¡Hola! Gracias por visitar mi página. Sé que puedes tener dudas antes de comprar; escríbenos sin miedo por WhatsApp o Instagram, estamos aquí para ayudarte en todo el proceso. 🎮"
                    </p>
                    <p className="text-blue-400 text-xs font-black uppercase tracking-widest mt-4">— Bastian, Alfeicon Games</p>
                </div>

                <div className="w-full space-y-3 mb-10">
                    {/* WHATSAPP */}
                    <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="flex items-center justify-between w-full bg-[#25D366] hover:bg-[#20bd5a] text-black p-4 rounded-2xl transition-transform hover:scale-[1.02] shadow-lg group">
                        <div className="flex items-center gap-4"><MessageCircle size={22} className="text-black" /><span className="font-bold uppercase tracking-wide text-xs">WhatsApp Oficial</span></div>
                        <span className="text-black/50 font-bold group-hover:translate-x-1 transition-transform">→</span>
                    </a>
                    
                    {/* INSTAGRAM */}
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="flex items-center justify-between w-full bg-[#111] border border-white/10 p-4 rounded-2xl group transition-colors hover:bg-white/5">
                        <div className="flex items-center gap-4"><Instagram size={22} className="text-pink-500" /><span className="text-white font-bold uppercase tracking-wide text-xs">Instagram (+2.800 Seguidores)</span></div>
                        <span className="text-gray-600 group-hover:text-white transition-colors">↗</span>
                    </a>

                    {/* FACEBOOK */}
                    <a href="https://web.facebook.com/alfeicon.games" target="_blank" className="flex items-center justify-between w-full bg-[#111] border border-white/10 p-4 rounded-2xl group transition-colors hover:bg-white/5">
                        <div className="flex items-center gap-4"><Facebook size={22} className="text-blue-600" /><span className="text-white font-bold uppercase tracking-wide text-xs">Facebook Oficial</span></div>
                        <span className="text-gray-600 group-hover:text-white transition-colors">↗</span>
                    </a>

                    {/* YOUTUBE */}
                    <a href="https://www.youtube.com/@alfeicon_games" target="_blank" className="flex items-center justify-between w-full bg-[#111] border border-white/10 p-4 rounded-2xl group transition-colors hover:bg-white/5">
                        <div className="flex items-center gap-4"><Youtube size={22} className="text-red-600" /><span className="text-white font-bold uppercase tracking-wide text-xs">YouTube (Tutoriales)</span></div>
                        <span className="text-gray-600 group-hover:text-white transition-colors">↗</span>
                    </a>
                </div>

{/* DUDAS FRECUENTES (FAQS) - TEXTO MÁS GRANDE Y ACTUALIZADO */}
                <div className="w-full space-y-4 mb-10">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] text-center mb-4">Dudas Frecuentes</h3>
                    
                    {/* Pregunta 1: Desbloqueo */}
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-left">
                        <p className="text-white font-bold text-xs mb-2 uppercase tracking-wide">¿Necesito mi consola desbloqueada?</p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            <span className="text-blue-400 font-bold">No.</span> Nuestros juegos son 100% originales y digitales. Se descargan directamente desde la <span className="text-white font-bold">eShop oficial</span> de Nintendo.
                            <br/><br/>
                            En teoría, apenas sacas tu consola de la caja, ya puedes instalar nuestros juegos sin modificar nada.
                        </p>
                    </div>

                    {/* Pregunta 2: Baneo y Riesgos */}
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-left">
                        <p className="text-white font-bold text-xs mb-2 uppercase tracking-wide">¿Existe riesgo de baneo?</p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            Nuestro método tiene un 99.9% de efectividad y no infringe normas de seguridad. Sin embargo, como en todo método alternativo, existe un riesgo mínimo. 
                            <br/><br/>
                            <span className="text-red-400 font-bold uppercase text-[10px]">Alfeicon Games no se hace responsable por baneos</span> o restricciones aplicadas por Nintendo. El cliente acepta este riesgo al comprar.
                        </p>
                    </div>

                    {/* Pregunta 3: Garantía y Soporte */}
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-left">
                        <p className="text-white font-bold text-xs mb-2 uppercase tracking-wide">¿Tienen garantía y soporte?</p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            Ofrecemos <span className="text-white font-bold">3 meses de garantía técnica</span>. Durante este periodo, te ayudamos con cualquier duda en la instalación por WhatsApp.
                            <br/><br/>
                            Pasado este tiempo, el soporte técnico caduca y no nos hacemos responsables por fallas posteriores o actualizaciones de sistema.
                        </p>
                    </div>

                    {/* Pregunta 4: Duración */}
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-left">
                        <p className="text-white font-bold text-xs mb-2 uppercase tracking-wide">¿Cuánto tiempo durará el juego?</p>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            La duración es indefinida siempre que sigas las <span className="text-white font-bold">instrucciones de uso</span> (no borrar el juego ni la cuenta, ni cambiar claves). Si cumples las reglas, el juego debería funcionar por años.
                        </p>
                    </div>
                </div>

                <button onClick={() => setShowTerms(true)} className="flex items-center gap-2 text-[10px] text-gray-600 hover:text-white transition uppercase tracking-widest border-b border-transparent hover:border-white pb-0.5">
                    <ShieldCheck size={12} /> Ver Términos y Condiciones
                </button>
            </div>
          )}
        </main>

{/* MODAL TÉRMINOS Y CONDICIONES - TEXTO GRANDE Y NUMERACIÓN SIMPLE */}
{showTerms && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
        <div className="bg-[#111] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#151515] rounded-t-3xl">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-500" /> Términos y Condiciones
                </h3>
                <button onClick={() => setShowTerms(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/20 transition text-white">
                    <X size={20} />
                </button>
            </div>
            
            {/* Contenido con Scroll - Texto más grande */}
            <div className="p-6 overflow-y-auto text-left space-y-8 text-[13px] text-gray-300 leading-relaxed scrollbar-hide">
                
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
                        ❌ NO APLICA SI: Eliminas el juego/cuenta, juegas con el perfil entregado, se trata de un PACK o interrupciones por corte de luz/apagado.
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
            <div className="p-4 border-t border-white/5 bg-[#111] rounded-b-3xl">
                <button onClick={() => setShowTerms(false)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.2em] hover:bg-blue-500 transition shadow-lg shadow-blue-900/40 active:scale-95">
                    Entendido y Acepto
                </button>
            </div>
        </div>
    </div>
)}

        {/* NAVEGACIÓN INFERIOR */}
        <nav className="fixed bottom-0 w-full max-w-md bg-black border-t border-white/10 flex justify-around items-center z-50 h-20 pb-2 px-2">
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
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-300 group ${active ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>
      <div className={`relative transition-all duration-300 ${active ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'scale-100'}`}>{icon}</div>
      <span className={`text-[9px] font-bold mt-1.5 uppercase tracking-wider transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
    </button>
  );
}