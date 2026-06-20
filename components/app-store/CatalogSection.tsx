"use client";

import type { MouseEvent, RefObject } from 'react';
import Image from 'next/image';
import { ArrowDownCircle, Filter, Heart, Loader2, Search } from 'lucide-react';
import GameCard from '@/components/GameCard';

type CatalogSectionProps = {
  sectionMotion: string;
  cargando: boolean;
  shouldDeferCatalogItems: boolean;
  storeTab: 'individual' | 'packs';
  setStoreTab: (tab: 'individual' | 'packs') => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterTerm: string;
  setFilterTerm: (value: string) => void;
  ejecutarBusqueda: () => void;
  consoleFilter: 'all' | 'switch' | 'switch2';
  setConsoleFilter: (value: 'all' | 'switch' | 'switch2') => void;
  mostrarSoloOfertas: boolean;
  setMostrarSoloOfertas: (value: boolean) => void;
  mostrarGuardados: boolean;
  setMostrarGuardados: (value: boolean) => void;
  savedCountActual: number;
  listaFiltrada: CatalogItem[];
  listaVisual: CatalogItem[];
  visibleCount: number;
  setVisibleCount: (updater: number | ((current: number) => number)) => void;
  catalogInitialCount: number;
  catalogBatchSize: number;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  whatsappNumber: string;
  comprarDirecto: (item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) => void;
  toggleSaved: (item: CatalogItem) => void;
  getSavedKey: (item: CatalogItem) => string;
  savedIds: string[];
};

type CatalogItem = {
  id: string | number;
  titulo: string;
  precio: number;
  precioOriginal?: number | null;
  img: string | null;
  ahorro?: string | null;
  esPack?: boolean;
  juegosIncluidos?: string[];
  storageRequired?: string | null;
  consoleName?: string | null;
};

export default function CatalogSection({
  sectionMotion,
  cargando,
  shouldDeferCatalogItems,
  storeTab,
  setStoreTab,
  searchTerm,
  setSearchTerm,
  setFilterTerm,
  ejecutarBusqueda,
  consoleFilter,
  setConsoleFilter,
  mostrarSoloOfertas,
  setMostrarSoloOfertas,
  mostrarGuardados,
  setMostrarGuardados,
  savedCountActual,
  listaFiltrada,
  listaVisual,
  visibleCount,
  setVisibleCount,
  catalogInitialCount,
  catalogBatchSize,
  loadMoreRef,
  whatsappNumber,
  comprarDirecto,
  toggleSaved,
  getSavedKey,
  savedIds,
}: CatalogSectionProps) {
  return (
    <div className={`section-motion ${sectionMotion}`}>
      <div className="premium-surface sticky top-3 z-30 -mx-1 mb-4 space-y-3 rounded-[1.8rem] p-3 backdrop-blur-2xl">
        <div className={`relative flex items-center transition-transform duration-300 ${searchTerm ? 'scale-[1.01]' : 'scale-100'}`}>
          <input
            type="text"
            aria-label={storeTab === 'individual' ? 'Buscar juego' : 'Buscar pack'}
            placeholder={storeTab === 'individual' ? 'Busca tu juego...' : 'Busca en packs...'}
            value={searchTerm}
            onChange={(e) => {
              const texto = e.target.value;
              setSearchTerm(texto);
              if (texto === '') {
                setFilterTerm('');
                setVisibleCount(catalogInitialCount);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ejecutarBusqueda();
            }}
            className="premium-control w-full rounded-full py-3 pl-5 pr-14 text-base text-white shadow-inner transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/15"
          />
          <button type="button" aria-label="Buscar en catálogo" onClick={ejecutarBusqueda} className="magnetic absolute right-2 flex items-center justify-center rounded-full bg-white p-2.5 text-black shadow-lg shadow-white/10 hover:bg-gray-100">
            <Search size={18} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        <div className="premium-surface relative flex overflow-hidden rounded-full p-1" role="group" aria-label="Tipo de catálogo">
          <span
            className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-lg shadow-white/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              storeTab === 'packs' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'
            }`}
          />
          <button type="button" aria-pressed={storeTab === 'individual'} onClick={() => { setStoreTab('individual'); setSearchTerm(''); setFilterTerm(''); }} className={`relative z-10 flex-1 rounded-full py-2.5 text-xs font-black uppercase transition-colors duration-300 ${storeTab === 'individual' ? 'text-black' : 'text-gray-500 hover:text-white'}`}>Juegos Unitarios</button>
          <button type="button" aria-pressed={storeTab === 'packs'} onClick={() => { setStoreTab('packs'); setSearchTerm(''); setFilterTerm(''); setMostrarSoloOfertas(false); }} className={`relative z-10 flex-1 rounded-full py-2.5 text-xs font-black uppercase transition-colors duration-300 ${storeTab === 'packs' ? 'text-black' : 'text-gray-500 hover:text-white'}`}>Pack de Juegos</button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Filtro por consola">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'switch', label: 'Switch 1 y 2' },
            { id: 'switch2', label: 'Solo Switch 2' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={consoleFilter === item.id}
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
        <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-pulse" role="status" aria-live="polite" aria-label="Cargando catálogo">
          <div className="relative w-20 h-20 opacity-50"><Image src="/logo.png" alt="" fill className="object-contain" sizes="80px" /></div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-[0.2em]"><Loader2 className="animate-spin" size={14} aria-hidden="true" />Cargando catálogo</div>
        </div>
      ) : shouldDeferCatalogItems ? (
        <div className="min-h-[52vh]" aria-hidden="true" />
      ) : (
        <>
          <div className="flex justify-between items-center px-2 mb-4 animate-fade-in">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              {mostrarSoloOfertas ? 'Ofertas' : mostrarGuardados ? 'Favoritos' : storeTab === 'packs' ? 'Packs' : 'Juegos'}
              <span className="ml-2 text-xs text-white">({listaFiltrada.length})</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" aria-pressed={mostrarGuardados} aria-label={mostrarGuardados ? 'Ocultar favoritos' : 'Mostrar favoritos'} onClick={() => setMostrarGuardados(!mostrarGuardados)} className={`magnetic flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase ${mostrarGuardados ? 'border-[#e5e4e2]/70 bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-white/10' : 'premium-control text-gray-400 hover:text-white'}`}>
                <Heart size={12} fill={mostrarGuardados ? 'currentColor' : 'none'} />{mostrarGuardados ? 'Favoritos' : savedCountActual}
              </button>
              {storeTab === 'individual' && (
                <button type="button" aria-pressed={mostrarSoloOfertas} onClick={() => setMostrarSoloOfertas(!mostrarSoloOfertas)} className={`magnetic flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase ${mostrarSoloOfertas ? 'border-red-400/60 bg-red-500 text-white shadow-lg shadow-red-900/30' : 'premium-control text-gray-400 hover:text-white'}`}>
                  <Filter size={12} />{mostrarSoloOfertas ? 'Todo' : 'Ofertas'}
                </button>
              )}
            </div>
          </div>

          <div key={`${storeTab}-${mostrarSoloOfertas ? 'ofertas' : 'todos'}`} className="grid grid-cols-1 gap-8 animate-fade-in pb-8 px-2">
            {listaVisual.length > 0 ? (
              listaVisual.map((item, index) => (
                <div key={item.id} className="animate-soft-in w-full max-w-[350px] mx-auto" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
                  <GameCard
                    titulo={item.titulo}
                    precio={item.precio}
                    precioOriginal={item.precioOriginal}
                    img={item.img}
                    ahorro={item.ahorro}
                    esPack={item.esPack}
                    juegosIncluidos={item.juegosIncluidos}
                    storageRequired={item.storageRequired}
                    consoleName={item.consoleName}
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
                  <button onClick={() => { setFilterTerm(''); setSearchTerm(''); setVisibleCount(catalogInitialCount); setMostrarSoloOfertas(false); setMostrarGuardados(false); setConsoleFilter('all'); }} className="magnetic rounded-full bg-white px-4 py-2 text-xs font-black uppercase text-black">Ver todo</button>
                  <a href={`https://wa.me/${whatsappNumber}`} target="_blank" className="magnetic rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase text-white">Consultar</a>
                </div>
              </div>
            )}
          </div>
          {visibleCount < listaFiltrada.length && (
            <div className="mt-8 flex flex-col items-center gap-4 pb-4">
              <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
              <button onClick={() => setVisibleCount((prev) => Math.min(prev + catalogBatchSize, listaFiltrada.length))} className="premium-surface flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase text-white transition-all duration-300 hover:bg-white hover:text-black">
                <ArrowDownCircle size={16} /> Ver más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
