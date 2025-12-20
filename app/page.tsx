// app/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { 
  Home, Gamepad2, BookOpen, ShoppingCart, Search, Instagram, MessageCircle, 
  Mail, Loader2, ArrowDownCircle, Trash2, Zap, Layers, Youtube, FileText, 
  ShieldCheck, AlertTriangle, Facebook, Star, X, Check 
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import Papa from 'papaparse'; 
import { DATA_IMAGENES } from './data/imagenes';
import Fuse from 'fuse.js';

// --- 1. OPTIMIZACIÓN: CONFIGURACIÓN Y HELPERS FUERA DEL COMPONENTE ---
// Al sacarlos de la función principal, no se recrean en cada render.

const CONFIG = {
  whatsappNumber: "56926411278",
  emailSoporte: "alfeicon.games@gmail.com",
  sheetGames: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQsDYcvcNTrISbWFc5O2Cyvtsn7Aaz_nEV32yWDLh_dIR_4t1Kz-cep6oaXnQQrCxfhRy1K-H6JTk4/pub?gid=1961555999&single=true&output=csv",
  sheetPacks: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQsDYcvcNTrISbWFc5O2Cyvtsn7Aaz_nEV32yWDLh_dIR_4t1Kz-cep6oaXnQQrCxfhRy1K-H6JTk4/pub?gid=858783180&single=true&output=csv"
};

// Función auxiliar optimizada para limpiar texto
const limpiarTexto = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9]/g, '');

const buscarImagenLocal = (nombreJuego: string) => {
  if (!nombreJuego || !DATA_IMAGENES) return null;
  const inputLimpio = limpiarTexto(nombreJuego);
  const encontrado = DATA_IMAGENES.find((item: any) => 
      limpiarTexto(item.name) === inputLimpio
  );
  return encontrado ? encontrado.url : null;
};

// Configuración de Fuse estática
const FUSE_OPTIONS = {
  keys: ['titulo', 'juegosIncluidos'],
  threshold: 0.35,
  ignoreLocation: true,
};

export default function MobileAppStore() {
  // --- ESTADOS ---
  const [activeSection, setActiveSection] = useState<'inicio' | 'catalogo' | 'instrucciones' | 'carrito' | 'perfil'>('inicio');
  const [storeTab, setStoreTab] = useState<'individual' | 'packs'>('individual');
  const [helpTab, setHelpTab] = useState<'switch2' | 'switch1'>('switch2');
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState(""); 
  const [filterTerm, setFilterTerm] = useState(""); 

  const [productos, setProductos] = useState<any[]>([]);
  const [packs, setPacks] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [carrito, setCarrito] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(20); 

  // --- 2. OPTIMIZACIÓN: FUNCIONES MEMOIZADAS (useCallback) ---
  
  const ejecutarBusqueda = useCallback(() => {
    setFilterTerm(searchTerm);
    setVisibleCount(20); 
  }, [searchTerm]);

  const agregarAlCarrito = useCallback((item: any) => {
    setCarrito(prev => [...prev, item]);
  }, []);

  const eliminarDelCarrito = useCallback((indexEliminar: number) => {
    setCarrito(prev => prev.filter((_, index) => index !== indexEliminar));
  }, []);

  const enviarPedidoWhatsApp = () => {
    if (carrito.length === 0 || !termsAccepted) return;

    let mensaje = "Hola, vengo desde la página web y quiero llevar:\n\n";
    carrito.forEach((item) => {
      mensaje += `🔹 ${item.titulo} ($${item.precio.toLocaleString()})\n`;
    });

    const total = carrito.reduce((acc, item) => acc + item.precio, 0).toLocaleString();
    mensaje += `\n💰 *Total: $${total}*\n\n`;
    mensaje += "✅ He leído y acepto los términos y condiciones.\n¿Están disponibles los artículos?";

    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // --- EFECTOS ---

  // Efecto de Reset al cambiar sección
  useEffect(() => {
    window.scrollTo(0, 0);
    if (activeSection !== 'catalogo') {
        setSearchTerm("");
        setFilterTerm("");
    }
    setVisibleCount(20);
  }, [activeSection, storeTab]);

  // 3. OPTIMIZACIÓN: SCROLL HANDLER MÁS LIGERO
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false; // Flag para no saturar el navegador

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
    
    // CARGA DE DATOS (Se mantiene igual, la lógica es sólida)
    const cargarDatos = async () => {
        // Cargar Juegos
        Papa.parse(CONFIG.sheetGames, {
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
              return {
                id: `game-${index}`,
                titulo: titulo, 
                img: imagenFinal,
                precio: getCol("En Oferta") === "SI" ? limpiarPrecio(getCol("Precio Oferta")) : limpiarPrecio(getCol("Precio")),
                esPack: false,
                ahorro: getCol("En Oferta") === "SI" ? "OFERTA 🔥" : null
              };
            }).filter((item: any) => item.titulo);
            setProductos(datosLimpios);
            // Solo quitamos cargando si ya terminaron los packs también (opcional, o dejarlo separado)
            if(packs.length > 0) setCargando(false); 
          },
          error: (error: any) => { console.error("Error Juegos:", error); }
        });

        // Cargar Packs
        Papa.parse(CONFIG.sheetPacks, {
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
                return {
                  id: `pack-${index}`,
                  titulo: nombrePack,
                  img: imagenPack, 
                  precio: limpiarPrecio(getCol("Precio CLP")),
                  esPack: true,
                  ahorro: "PACK 🎁",
                  juegosIncluidos: listaJuegos 
                };
              }).filter((item: any) => item.precio > 0);
              setPacks(packsLimpios);
              setCargando(false); // Asumimos que esto termina último o cerca
            },
            error: (error: any) => console.error("Error Packs:", error)
        });
    };
    cargarDatos();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- CÁLCULOS (Memos) ---
  const ofertasFlash = useMemo(() => {
    return productos.filter(p => p.ahorro).slice(0, 8); 
  }, [productos]);

  const packsDestacados = useMemo(() => {
    return packs.slice(0, 6); 
  }, [packs]);

  // 4. OPTIMIZACIÓN: FUSE.JS INSTANCIA ÚNICA
  // Creamos el índice solo cuando cambian los productos/packs, no al escribir.
  const fuseInstance = useMemo(() => {
    const items = storeTab === 'individual' ? productos : packs;
    return new Fuse(items, FUSE_OPTIONS);
  }, [storeTab, productos, packs]);

  const listaFiltrada = useMemo(() => {
    const itemsAMostrar = storeTab === 'individual' ? productos : packs;
    
    if (filterTerm === "") return itemsAMostrar;

    // Usamos la instancia ya creada (mucho más rápido)
    return fuseInstance.search(filterTerm).map(result => result.item);
  }, [storeTab, productos, packs, filterTerm, fuseInstance]);

  const listaVisual = listaFiltrada.slice(0, visibleCount);

  // --- RENDERIZADO (IGUAL QUE ANTES) ---
  return (
    // ... aquí sigue tu código del return tal cual estaba ...
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
              
              {/* DASHBOARD */}
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
                          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-40 transition-opacity">
                              <Layers size={40} />
                          </div>
                          <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1 z-10">Packs Totales</div>
                          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-600 z-10">
                             {packs.length > 0 ? packs.length : '-'}
                          </div>
                          <div className="text-[10px] text-purple-300/60 font-medium mt-1 z-10">Colecciones listas</div>
                       </div>

                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-start relative overflow-hidden group/card">
                          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-40 transition-opacity">
                              <Gamepad2 size={40} />
                          </div>
                          <div className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1 z-10">Juegos Unitarios</div>
                          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-400 z-10">
                             {productos.length > 0 ? productos.length : '-'}
                          </div>
                           <div className="text-[10px] text-blue-300/60 font-medium mt-1 z-10">Catálogo completo</div>
                       </div>
                    </div>

                    <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="block w-full bg-[#1F2937] hover:bg-[#374151] border border-white/10 p-4 rounded-xl text-center shadow-lg transition-all active:scale-95 group/btn">
                       <div className="flex items-center justify-center gap-3">
                          <div className="bg-[#25D366] p-1.5 rounded-full text-black">
                             <MessageCircle size={16} fill="currentColor" />
                          </div>
                          <div className="flex flex-col items-start">
                              <span className="text-white font-bold uppercase tracking-wide text-xs group-hover/btn:text-green-400 transition-colors">¿Necesitas Ayuda?</span>
                              <span className="text-[10px] text-gray-500">Habla con un experto por WhatsApp</span>
                          </div>
                       </div>
                    </a>
                  </div>
              </div>

              {/* --- CLIENTES FELICES --- */}
              <div className="mb-4">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={16} className="text-green-400" /> Clientes Felices
                    </h3>
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="text-[10px] text-blue-400 font-bold hover:text-white transition flex items-center gap-1">
                      Ver Historias Destacadas <Instagram size={10} />
                    </a>
                  </div>
                  
                  {/* Carrusel de testimonios */}
                  <div className="flex overflow-x-auto gap-3 px-2 pb-4 snap-x snap-mandatory scrollbar-hide">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="min-w-[140px] w-[140px] aspect-[9/16] relative rounded-xl overflow-hidden border border-white/10 shrink-0 snap-center bg-[#151515] group">
                        <Image 
                          src={`/clientes/${num}.jpg`} 
                          alt={`Cliente Feliz ${num}`} 
                          fill 
                          className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" 
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-10">
                           <div className="flex gap-0.5 mb-1">
                              {[1,2,3,4,5].map(star => <Star key={star} size={8} className="text-yellow-400 fill-yellow-400" />)}
                           </div>
                           <p className="text-[9px] text-gray-300 font-medium">Compra Verificada</p>
                        </div>
                      </div>
                    ))}
                    
                    {/* TARJETA FINAL: VER MÁS EN IG */}
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="min-w-[140px] w-[140px] aspect-[9/16] relative rounded-xl overflow-hidden border border-white/10 shrink-0 snap-center bg-[#111] flex flex-col items-center justify-center gap-3 group hover:bg-[#1a1a1a] transition-colors">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Instagram size={24} className="text-white" />
                        </div>
                        <div className="text-center px-2">
                            <p className="text-white text-xs font-bold mb-1">Ver Más</p>
                            <p className="text-[9px] text-gray-500 leading-tight">Revisa nuestras Historias Destacadas</p>
                        </div>
                    </a>
                  </div>
              </div>

              {/* CARRUSEL DE OFERTAS FLASH */}
              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      🔥 Ofertas Flash
                   </h3>
                   <span className="text-[10px] text-gray-500 font-bold bg-white/10 px-2 py-1 rounded-full animate-pulse">
                      Desliza →
                   </span>
                </div>

                <div 
                    className="flex overflow-x-auto gap-4 px-2 pb-6 snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                   {cargando ? (
                      [1,2,3].map(i => (
                        <div key={i} className="min-w-[280px] h-[350px] bg-[#111] rounded-xl animate-pulse border border-white/5 shrink-0" />
                      ))
                   ) : (
                      ofertasFlash.length > 0 ? (
                        ofertasFlash.map((item) => (
                          <div key={item.id} className="min-w-[280px] snap-center shrink-0">
                             <GameCard 
                                titulo={item.titulo} 
                                precio={item.precio} 
                                img={item.img} 
                                ahorro={item.ahorro} 
                                esPack={item.esPack}
                                onAdd={() => agregarAlCarrito(item)}
                             />
                          </div>
                        ))
                      ) : (
                         <p className="text-gray-500 text-xs w-full text-center py-10 border border-dashed border-white/10 rounded-xl">
                            Cargando ofertas...
                         </p>
                      )
                   )}
                </div>
              </div>

              {/* CARRUSEL DE PACKS DESTACADOS */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-4 px-1">
                   <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      🎁 Packs Imperdibles
                   </h3>
                   <button 
                      onClick={() => {setStoreTab('packs'); setActiveSection('catalogo');}}
                      className="text-[10px] text-blue-400 font-bold bg-blue-900/20 px-3 py-1.5 rounded-full hover:bg-blue-900/40 transition border border-blue-500/30"
                   >
                      Ver todos →
                   </button>
                </div>

                <div 
                    className="flex overflow-x-auto gap-4 px-2 pb-6 snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                   {cargando ? (
                      [1,2,3].map(i => (
                        <div key={i} className="min-w-[280px] h-[350px] bg-[#111] rounded-xl animate-pulse border border-white/5 shrink-0" />
                      ))
                   ) : (
                      packsDestacados.length > 0 ? (
                        packsDestacados.map((item) => (
                          <div key={item.id} className="min-w-[280px] snap-center shrink-0">
                             <GameCard 
                                titulo={item.titulo} 
                                precio={item.precio} 
                                img={item.img} 
                                ahorro={item.ahorro} 
                                esPack={item.esPack}
                                juegosIncluidos={item.juegosIncluidos}
                                onAdd={() => agregarAlCarrito(item)}
                             />
                          </div>
                        ))
                      ) : (
                         <p className="text-gray-500 text-xs w-full text-center py-10 border border-dashed border-white/10 rounded-xl">
                            Cargando packs...
                         </p>
                      )
                   )}
                </div>
              </div>

            </div>
          )}

          {/* SECCIÓN 2: CATÁLOGO */}
          {activeSection === 'catalogo' && (
            <div className="animate-fade-in">
              <div className="flex bg-[#111] p-1 rounded-full mb-8 border border-white/10 sticky top-4 z-30 shadow-2xl">
                <button 
                  onClick={() => {setStoreTab('individual'); setSearchTerm(""); setFilterTerm("");}} 
                  className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${storeTab === 'individual' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  Juegos Unitarios
                </button>
                <button 
                  onClick={() => {setStoreTab('packs'); setSearchTerm(""); setFilterTerm("");}} 
                  className={`flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${storeTab === 'packs' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  Pack de Juegos
                </button>
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
                      {storeTab === 'individual' ? 'Total Juegos: ' : 'Total Packs: '}
                      <span className="text-white ml-2 text-sm">{listaFiltrada.length}</span>
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8 animate-fade-in pb-8 px-2">
                      {listaVisual.length > 0 ? (
                        listaVisual.map((item) => (
                          <div 
                            key={item.id} 
                            className="w-full max-w-[350px] mx-auto"
                          >
                             <GameCard 
                                titulo={item.titulo} 
                                precio={item.precio} 
                                img={item.img} 
                                ahorro={item.ahorro} 
                                esPack={item.esPack} 
                                juegosIncluidos={item.juegosIncluidos}
                                onAdd={() => agregarAlCarrito(item)}
                             />
                          </div>
                        ))
                      ) : (
                          <div className="flex flex-col items-center py-20 text-gray-500">
                              <Search size={40} className="mb-4 opacity-20" />
                              <p className="text-sm">No encontramos "{filterTerm}"</p>
                              <button onClick={() => {setFilterTerm(""); setSearchTerm(""); setVisibleCount(20);}} className="mt-4 text-blue-400 text-xs underline">Ver todo</button>
                          </div>
                      )}
                  </div>
                  
                  {visibleCount < listaFiltrada.length && (
                    <div className="flex justify-center mt-8 pb-4">
                      <button 
                        onClick={() => setVisibleCount(prev => prev + 20)}
                        className="flex items-center gap-2 bg-[#111] border border-white/20 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all"
                      >
                        <ArrowDownCircle size={16} />
                        Ver más ({listaFiltrada.length - visibleCount})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SECCIÓN 3: INSTRUCCIONES / GUÍA */}
          {activeSection === 'instrucciones' && (
            <div className="animate-fade-in pb-20">
                
                {/* CABECERA */}
                <div className="text-center mb-6 pt-4">
                    <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-2">Centro de Ayuda</h2>
                    <p className="text-gray-500 text-xs font-medium max-w-[250px] mx-auto">
                        Selecciona tu modelo de consola para ver la guía correcta:
                    </p>
                </div>

                {/* --- NUEVA SECCIÓN: ANTES DE COMPRAR --- */}
                <div className="mx-2 mb-8 bg-[#151515] border border-yellow-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500/50"></div>
                    <h3 className="text-yellow-500 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                        <AlertTriangle size={16} /> Antes de Comprar
                    </h3>
                    <ul className="space-y-3 text-[11px] text-gray-300 leading-relaxed font-medium">
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-500">•</span>
                            <span>Verifica el <strong className="text-white">espacio disponible</strong> en tu consola/SD y la calidad de internet.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-500">•</span>
                            <span>Las instrucciones son para <strong className="text-white">cuenta principal</strong> (juegas con tu usuario personal).</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-500">•</span>
                            <span>Si compras más de un juego, <strong className="text-white">descárgalos todos</strong> en el momento de la entrega.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-500">•</span>
                            <span>No somos tienda oficial. Solo entregamos cuentas, no administramos credenciales.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">!</span>
                            <span className="text-red-200">Recuerda: <strong>Archivar = Eliminar</strong>. Esto anula la garantía.</span>
                        </li>
                        <li className="flex items-start gap-2 pt-2 border-t border-white/5">
                            <Zap size={12} className="text-blue-400 shrink-0 mt-0.5" />
                            <span className="text-blue-200">Recomendación Pro: Jugar <strong>sin conexión</strong> disminuye la probabilidad de caídas (1% vs 5% online).</span>
                        </li>
                    </ul>
                </div>

                {/* SELECTOR DE PESTAÑAS (SWITCHER) */}
                <div className="flex p-1 bg-[#1a1a1a] rounded-xl border border-white/10 mb-8 mx-2 relative">
                    <button 
                        onClick={() => setHelpTab('switch2')}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 ${helpTab === 'switch2' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Zap size={14} className={helpTab === 'switch2' ? 'fill-white' : ''} />
                        Switch 2
                    </button>

                    <button 
                        onClick={() => setHelpTab('switch1')}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-300 ${helpTab === 'switch1' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:text-white'}`}
                    >
                        <Gamepad2 size={14} className={helpTab === 'switch1' ? 'fill-white' : ''} />
                        Switch 1 / Lite
                    </button>
                </div>

                {/* CONTENIDO DINÁMICO */}
                <div className="px-2">
                    
                    {/* CONTENIDO SWITCH 2 */}
                    {helpTab === 'switch2' && (
                        <div className="animate-fade-in">
                            <div className="bg-[#111] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                                <div className="relative w-full aspect-video bg-black group">
                                    <iframe 
                                        src="https://www.youtube.com/embed/Tl5A7OeRbh0" 
                                        title="Tutorial Switch 2"
                                        className="absolute top-0 left-0 w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                                <div className="p-5">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="bg-red-500/10 p-2 rounded-full min-w-[35px] text-center font-black text-red-500 text-xs">01</div>
                                        <p className="text-gray-300 text-xs leading-relaxed">
                                            Mira el video completo antes de empezar. El proceso en <span className="text-white font-bold">Switch 2</span> requiere pasos específicos.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-red-900/10 border border-red-500/10 rounded-xl">
                                        <Youtube size={16} className="text-red-500 shrink-0" />
                                        <span className="text-[10px] text-red-200 font-medium">Video Oficial Alfeicon Games</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTENIDO SWITCH 1 */}
                    {helpTab === 'switch1' && (
                        <div className="animate-fade-in">
                            <div className="bg-gradient-to-b from-[#1a1a1a] to-black rounded-3xl p-6 border border-white/10 text-center relative overflow-hidden">
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
                                
                                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/30">
                                    <FileText size={32} className="text-blue-400" />
                                </div>

                                <h3 className="text-lg font-bold text-white mb-2">Manual PDF</h3>
                                <p className="text-gray-400 text-xs mb-8 leading-relaxed px-4">
                                    Guía ilustrada paso a paso para modelos <br/>
                                    <span className="text-blue-400 font-bold">Estándar, OLED y Lite</span>.
                                </p>

                                <a 
                                    href="/guia.pdf" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-4"
                                >
                                    Descargar Guía
                                </a>
                                <p className="text-[9px] text-gray-600">Formato PDF • 2.5 MB</p>
                            </div>
                        </div>
                    )}

                </div>

                {/* FOOTER AYUDA */}
                <div className="mt-12 border-t border-white/5 pt-6 px-4 text-center">
                    <p className="text-gray-500 text-[10px] mb-3">¿Aún tienes dudas con la instalación?</p>
                    <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" className="inline-flex items-center gap-2 text-green-400 text-xs font-bold bg-green-900/10 px-4 py-2 rounded-full hover:bg-green-900/20 transition">
                        <MessageCircle size={14} />
                        Soporte WhatsApp
                    </a>
                </div>

            </div>
          )}

          {/* SECCIÓN 4: CARRITO (AHORA CON CHECK DE TÉRMINOS) */}
          {activeSection === 'carrito' && (
            <div className="flex flex-col items-center min-h-[50vh] w-full animate-fade-in pb-24">
              {carrito.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50">
                  <ShoppingCart size={60} className="text-gray-600 mb-6" />
                  <h3 className="text-xl font-bold text-white mb-2">Tu carro está vacío</h3>
                  <p className="text-gray-500 text-sm mb-8">¡Agrega algunos juegos para empezar!</p>
                  <button onClick={() => setActiveSection('catalogo')} className="border border-white/20 text-white px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest mt-4">
                    Ir a la Tienda
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-sm mx-auto space-y-6 pt-4">
                  <div className="flex justify-between items-end px-2">
                     <h2 className="text-xl font-black uppercase tracking-widest text-white">Tu Pedido</h2>
                     <span className="text-xs font-bold text-gray-500 bg-white/10 px-2 py-1 rounded">{carrito.length} ítems</span>
                  </div>

                  {/* LISTA DE PRODUCTOS */}
                  <div className="space-y-3">
                    {carrito.map((item, idx) => (
                      <div key={idx} className="bg-[#111] p-3 rounded-2xl flex items-center gap-4 border border-white/10 shadow-lg group">
                         <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-800 border border-white/5">
                            {item.img && <Image src={item.img} alt={item.titulo} fill className="object-cover" />}
                         </div>
                         <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-bold text-white truncate leading-tight">{item.titulo}</span>
                            <span className="text-blue-400 text-xs font-bold mt-1">${item.precio.toLocaleString()}</span>
                         </div>
                         <button onClick={() => eliminarDelCarrito(idx)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all active:scale-90">
                            <Trash2 size={18} />
                         </button>
                      </div>
                    ))}
                  </div>

                  {/* RESUMEN DE PAGO + CHECKBOX NUEVO */}
                  <div className="mt-8 bg-[#111] p-6 rounded-3xl border border-white/10">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Subtotal</span>
                        <span className="text-white font-bold">${carrito.reduce((acc, item) => acc + item.precio, 0).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
                        <span className="text-gray-400 text-xs uppercase tracking-wider">Envío Digital</span>
                        <span className="text-green-400 font-bold text-xs uppercase">Gratis ⚡</span>
                     </div>
                     
                     <div className="flex justify-between items-center mb-6">
                        <span className="text-white font-bold text-lg">Total</span>
                        <div className="text-right">
                            <span className="text-2xl font-black text-white block leading-none">
                                ${carrito.reduce((acc, item) => acc + item.precio, 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Pesos Chilenos</span>
                        </div>
                     </div>

                     {/* CHECKBOX DE TÉRMINOS */}
                     <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div 
                            onClick={() => setTermsAccepted(!termsAccepted)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${termsAccepted ? 'bg-blue-600 border-blue-600' : 'border-white/30 bg-transparent'}`}
                        >
                            {termsAccepted && <Check size={14} className="text-white" strokeWidth={4} />}
                        </div>
                        <label className="text-xs text-gray-400 cursor-pointer select-none flex-1">
                            He leído y acepto los <span onClick={(e) => {e.stopPropagation(); setShowTerms(true);}} className="text-blue-400 font-bold hover:text-white transition underline">términos y condiciones</span>
                        </label>
                     </div>
                     
                     {/* BOTÓN PEDIR AHORA (BLOQUEADO SI NO ACEPTA) */}
                     <button 
                        onClick={enviarPedidoWhatsApp}
                        disabled={!termsAccepted}
                        className={`w-full font-bold py-4 rounded-xl uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 transition-all ${
                            termsAccepted 
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 cursor-pointer" 
                            : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                        }`}
                     >
                        Pedir Ahora <MessageCircle size={18} fill="currentColor" />
                     </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN 5: PERFIL / CONTACTO */}
          {activeSection === 'perfil' && (
            <div className="flex flex-col items-center py-8 animate-fade-in px-6">
                
                {/* Logo e Identidad */}
                <div className="relative w-32 h-32 bg-black border border-white/20 rounded-full mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden">
                    <Image src="/logo.png" alt="Alfeicon Logo Grande" fill className="object-cover p-2"/>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-1">ALFEICON</h2>
                <span className="text-gray-500 text-sm font-medium tracking-widest mb-8">SÍGUENOS EN REDES</span>
                
                {/* Botones de Contacto (REDES AGREGADAS) */}
                <div className="w-full space-y-4 mb-8">
                    {/* WhatsApp */}
                    <a href={`https://wa.me/${CONFIG.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full bg-[#25D366] hover:bg-[#20bd5a] text-black p-4 rounded-2xl transition-transform hover:scale-[1.02] shadow-lg group">
                        <div className="flex items-center gap-4">
                            <MessageCircle size={24} className="text-black" />
                            <span className="font-bold uppercase tracking-wide text-sm">WhatsApp Oficial</span>
                        </div>
                        <span className="text-black/50 font-bold group-hover:translate-x-1 transition-transform">→</span>
                    </a>
                    
                    {/* Instagram */}
                    <a href="https://instagram.com/alfeicon_games" target="_blank" className="flex items-center justify-between w-full bg-[#111] border border-white/10 hover:border-purple-500/50 p-4 rounded-2xl transition-all group">
                        <div className="flex items-center gap-4">
                            <Instagram size={24} className="text-pink-500" />
                            <span className="text-white font-bold uppercase tracking-wide text-sm">Instagram</span>
                        </div>
                        <span className="text-gray-600 group-hover:text-white transition-colors">↗</span>
                    </a>

                    {/* Facebook (NUEVO) */}
                    <a href="https://web.facebook.com/alfeicon.games" target="_blank" className="flex items-center justify-between w-full bg-[#111] border border-white/10 hover:border-blue-600/50 p-4 rounded-2xl transition-all group">
                        <div className="flex items-center gap-4">
                            <Facebook size={24} className="text-blue-600" />
                            <span className="text-white font-bold uppercase tracking-wide text-sm">Facebook</span>
                        </div>
                        <span className="text-gray-600 group-hover:text-white transition-colors">↗</span>
                    </a>

                    {/* YouTube (NUEVO) */}
                    <a href="https://www.youtube.com/@alfeicon_games" target="_blank" className="flex items-center justify-between w-full bg-[#111] border border-white/10 hover:border-red-600/50 p-4 rounded-2xl transition-all group">
                        <div className="flex items-center gap-4">
                            <Youtube size={24} className="text-red-600" />
                            <span className="text-white font-bold uppercase tracking-wide text-sm">YouTube</span>
                        </div>
                        <span className="text-gray-600 group-hover:text-white transition-colors">↗</span>
                    </a>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center w-full">
                        <p className="text-gray-500 text-xs mb-2">¿Tienes dudas con tu pedido?</p>
                        <a href={`mailto:${CONFIG.emailSoporte}`} className="text-white text-sm font-bold flex items-center justify-center gap-2 hover:text-gray-300 transition">
                            <Mail size={16} />
                            {CONFIG.emailSoporte}
                        </a>
                    </div>
                </div>

                {/* BOTÓN TÉRMINOS (PERFIL) */}
                <button 
                    onClick={() => setShowTerms(true)}
                    className="flex items-center gap-2 text-[10px] text-gray-600 hover:text-white transition uppercase tracking-widest border-b border-transparent hover:border-white pb-0.5"
                >
                    <ShieldCheck size={12} />
                    Ver Términos y Condiciones
                </button>
            </div>
          )}
        </main>

        {/* --- MODAL GLOBAL DE TÉRMINOS Y CONDICIONES (FUNCIONA EN TODAS PARTES) --- */}
        {showTerms && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                <div className="bg-[#111] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
                    
                    {/* Cabecera del Modal */}
                    <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#151515] rounded-t-3xl">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={16} className="text-blue-500" />
                            Términos de Uso
                        </h3>
                        <button onClick={() => setShowTerms(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/20 transition text-white">
                            <X size={16} />
                        </button>
                    </div>
                    
                    {/* CONTENIDO DEL MODAL (REGLAS DETALLADAS) */}
                    <div className="p-6 overflow-y-auto text-left space-y-6 text-xs text-gray-400 leading-relaxed scrollbar-hide">
                        
                        <section>
                          <h4 className="text-white font-bold mb-2 uppercase tracking-wide">1. Proceso de Instalación</h4>
                          <p className="mb-2">El vendedor te acompaña en todo el proceso y responderá tus dudas.</p>
                          <p className="mb-2">El tiempo estimado de entrega es entre <strong className="text-white">10 y 120 minutos</strong>, variando según el distribuidor.</p>
                          <div className="p-2 bg-blue-900/20 border-l-2 border-blue-500 text-blue-100 italic mb-2">
                            Es necesario iniciar las descargas en el momento de la entrega. En caso de ser varios juegos aplica lo mismo, se debe descargar de forma inmediata.
                          </div>
                          <p className="text-yellow-500/90 font-bold">IMPORTANTE: Recuerda contar con tiempo para la instalación. Si no estás seguro, es mejor esperar. Evitemos errores haciendo los pasos tranquilos.</p>
                        </section>

                        <section>
                          <h4 className="text-white font-bold mb-2 uppercase tracking-wide">2. Cuentas y Juegos</h4>
                          <p className="mb-2">Todas nuestras cuentas son de tipo <strong className="text-white">PRINCIPAL</strong>; juegas con tu usuario personal.</p>
                          <ul className="list-disc pl-4 space-y-1 mb-2">
                            <li>No utilices la cuenta entregada para jugar.</li>
                            <li>No modifiques su información (es solo para descargar).</li>
                            <li>Una vez descargado, mantén la cuenta en tu consola sin tocarla.</li>
                          </ul>
                          <p className="text-red-400 font-bold">Cambiar datos de la cuenta anula la garantía inmediatamente.</p>
                        </section>

                        <section>
                          <h4 className="text-white font-bold mb-2 uppercase tracking-wide">3. Riesgo de Baneo</h4>
                          <p className="mb-2">Existe una posibilidad extremadamente baja (0.6%) de restricciones online por políticas de Nintendo. Tienes un <strong className="text-green-400">99.375% de seguridad</strong>.</p>
                          <p className="text-[10px] text-gray-500">De ocurrir un baneo, Alfeicon Games no asume responsabilidad ya que depende de normas externas del fabricante.</p>
                        </section>

                        <section>
                          <h4 className="text-white font-bold mb-2 uppercase tracking-wide">4. Sospechas y Pruebas</h4>
                          <p className="mb-2">Tenemos registro de las acciones hechas en la cuenta. Para evaluar reposición o garantía, se requieren pruebas claras de que el fallo no fue por acciones del usuario.</p>
                          <p className="text-gray-500 italic">Si las evidencias son insuficientes, podremos negar la reposición/devolución o intentar otra solución.</p>
                        </section>

                        <section>
                          <h4 className="text-white font-bold mb-2 uppercase tracking-wide">5. Garantía</h4>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-white/5 p-2 rounded text-center"><span className="block text-[10px] text-gray-500 uppercase">Clientes Nuevos</span><span className="text-white font-bold">2 Meses</span></div>
                            <div className="bg-white/5 p-2 rounded text-center"><span className="block text-[10px] text-gray-500 uppercase">Clientes Frecuentes</span><span className="text-white font-bold">4 Meses</span></div>
                          </div>
                          <p className="mb-2">Cubre fallos del juego no causados por el usuario. Incluye reposición (1 vez) o devolución del 50% si no es posible reponer.</p>
                          
                          <p className="font-bold text-white mt-3 mb-1">NO aplica garantía si:</p>
                          <ul className="list-disc pl-4 space-y-1 marker:text-red-500">
                            <li>Se elimina el juego o la cuenta de la consola.</li>
                            <li>Hubo corte de luz/interrupción durante la descarga.</li>
                            <li>Está fuera del plazo de garantía.</li>
                            <li>No se vinculó dentro del tiempo operativo indicado.</li>
                            <li>Se modificó la información de la cuenta.</li>
                            <li>Se jugó con el usuario entregado (no el personal).</li>
                            <li>Se trata de un Pack (salvo tarifa acordada).</li>
                          </ul>
                          <p className="mt-2 text-[10px]">Si un juego repuesto vuelve a fallar por lo mismo, ya no queda cubierto.</p>
                        </section>
                        
                        <section>
                          <h4 className="text-white font-bold mb-2 uppercase tracking-wide">6. Devoluciones y Pagos</h4>
                          <p className="mb-2">Si no hay stock tras tu pago, puedes pedir reembolso o cambiar de juego. Si la entrega supera el tiempo máximo razonable, puedes solicitar devolución.</p>
                          <p className="mb-2">Es necesario completar el pago total antes de la instalación a la cuenta proporcionada.</p>
                          <p className="text-[10px] text-gray-500 mt-4 border-t border-white/10 pt-2">Al comprar aceptas estos términos y condiciones generales.</p>
                        </section>
                    </div>

                    {/* Botón Cerrar */}
                    <div className="p-4 border-t border-white/5 bg-[#111] rounded-b-3xl">
                        <button onClick={() => setShowTerms(false)} className="w-full bg-white text-black font-bold py-3 rounded-xl uppercase text-xs tracking-widest hover:bg-gray-200 transition">Entendido</button>
                    </div>
                </div>
            </div>
        )}

        {/* NAVEGACIÓN INFERIOR */}
        <nav className="fixed bottom-0 w-full max-w-md bg-black border-t border-white/10 flex justify-around items-center z-50 h-20 pb-2 px-2">
          <NavButton active={activeSection === 'inicio'} onClick={() => setActiveSection('inicio')} icon={<Home size={22} />} label="Inicio" />
          <NavButton active={activeSection === 'catalogo'} onClick={() => setActiveSection('catalogo')} icon={<Gamepad2 size={22} />} label="Tienda" />
          <NavButton active={activeSection === 'instrucciones'} onClick={() => setActiveSection('instrucciones')} icon={<BookOpen size={22} />} label="Guía" />
          <NavButton 
            active={activeSection === 'carrito'} 
            onClick={() => setActiveSection('carrito')} 
            icon={<ShoppingCart size={22} />} 
            label="Carro" 
            count={carrito.length}
          />
          <NavButton active={activeSection === 'perfil'} onClick={() => setActiveSection('perfil')} icon={<MessageCircle size={22} />} label="Contacto" />
        </nav>
      </div>
    </div>
  );
}

// COMPONENTE AUXILIAR: BOTÓN DE NAVEGACIÓN
function NavButton({ active, onClick, icon, label, count }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-300 group ${active ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}
    >
      <div className={`relative transition-all duration-300 ${active ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'scale-100'}`}>
        {icon}
        {count > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full animate-bounce">
            {count}
          </span>
        )}
      </div>
      <span className={`text-[9px] font-bold mt-1.5 uppercase tracking-wider transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
        {label}
      </span>
    </button>
  );
}