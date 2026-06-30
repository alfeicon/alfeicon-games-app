"use client";

import { memo, useEffect, useState, type MouseEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ArrowDownCircle, ArrowUpRight, Filter, Gamepad2, Gift, HardDrive, Heart, Loader2, Package2, Search, Tag, X } from 'lucide-react';
import type { CatalogItem, CatalogPack } from '@/lib/catalog';
import { getImageForGame, getNintendoThumb } from '@/lib/catalog';
import './CatalogSection.css';

type CatalogSectionProps = {
  sectionMotion: string;
  cargando: boolean;
  shouldDeferCatalogItems: boolean;
  storeTab: 'individual' | 'packs';
  setStoreTab: (tab: 'individual' | 'packs') => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
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

type CatalogPosterProps = {
  item: CatalogItem;
  saved: boolean;
  onOpen: (item: CatalogItem) => void;
  priority?: boolean;
};

const BLUR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23181a1e' width='1' height='1'/%3E%3C/svg%3E";

const formatPrice = (value: number) => value.toLocaleString('es-CL');

/**
 * Nintendo assets use Cloudinary. Extracts the raw content path
 * (ncom/... or store/...) and rebuilds the URL preserving the native
 * 16:9 aspect ratio so nothing gets cropped out.
 */
const getConsoleLabel = (consoleName?: string | null) => {
  if (!consoleName) return null;
  const isSwitch2Only = consoleName.toLowerCase().replace(/\s+/g, '').includes('switch2');
  return isSwitch2Only ? 'Solo Switch 2' : 'Switch 1 y 2';
};

const CatalogPoster = memo(function CatalogPoster({
  item,
  saved,
  onOpen,
  priority = false,
}: CatalogPosterProps) {
  const consoleLabel = getConsoleLabel(item.consoleName) || 'Juego digital';
  const hasDiscount = !item.esPack && Boolean(item.precioOriginal && item.precioOriginal > item.precio);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="cat2-card w-full"
      aria-label={`Ver detalles de ${item.titulo}`}
    >
      {/* Thumbnail — native 16:9 crop via Cloudinary */}
      <span className="cat2-img">
        {item.img ? (
          <Image
            src={getNintendoThumb(item.img) ?? item.img}
            alt={item.titulo}
            fill
            className="object-cover"
            sizes="136px"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            priority={priority}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Gamepad2 size={26} strokeWidth={1.4} className="text-gray-600" />
          </span>
        )}
        {item.ahorro && (
          <span className="cat2-badge">{item.ahorro.replace(/[¡!]/g, '')}</span>
        )}
      </span>

      {/* Content */}
      <span className="cat2-body">
        <span className="cat2-title">{item.titulo}</span>
        <span className="cat2-platform">{consoleLabel}</span>

        <span className="cat2-bottom">
          <span className="cat2-price-wrap">
            {hasDiscount && !item.esPack && (
              <span className="cat2-old-price">${formatPrice(item.precioOriginal ?? 0)}</span>
            )}
            <span className={`cat2-price${hasDiscount ? ' cat2-price-sale' : ''}`}>
              ${formatPrice(item.precio)}
              <sup className="cat2-clp">CLP</sup>
            </span>
          </span>
          <span className={`cat2-heart${saved ? ' cat2-heart-saved' : ''}`}>
            <Heart size={15} strokeWidth={2.5} fill={saved ? 'currentColor' : 'none'} />
          </span>
        </span>
      </span>
    </button>
  );
});

const PackCard = memo(function PackCard({
  item,
  saved,
  onOpen,
}: {
  item: CatalogPack;
  saved: boolean;
  onOpen: (item: CatalogItem) => void;
}) {
  const perGame = item.juegosIncluidos.length > 0
    ? Math.round(item.precio / item.juegosIncluidos.length)
    : null;
  const shown = item.juegosIncluidos.slice(0, 4);
  const extra = item.juegosIncluidos.length - shown.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="pack3-card w-full"
      aria-label={`Ver detalles de ${item.titulo}`}
    >
      {/* Top: full-width 16:9 image */}
      <span className="pack3-visual">
        {item.img ? (
          <Image
            src={getNintendoThumb(item.img, 400, 225) ?? item.img}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 480px) 100vw, 400px"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
          />
        ) : (
          <Package2 size={32} strokeWidth={1.2} className="pack3-placeholder-ico" />
        )}
        <span className="pack3-count-badge">{item.juegosIncluidos.length} juegos</span>
      </span>

      {/* Right: content */}
      <span className="pack3-body">
        <span className="pack3-header-row">
          <span className="pack3-label">Pack de juegos</span>
          {item.esNuevo && <span className="pack3-new">NUEVO</span>}
        </span>
        <span className="pack3-title">{item.titulo}</span>
        <span className="pack3-games-list">
          {shown.join(' · ')}{extra > 0 ? ` +${extra} más` : ''}
        </span>
        <span className="pack3-footer">
          <span className="pack3-price">
            ${formatPrice(item.precio)}<sup className="pack3-clp">CLP</sup>
          </span>
          {perGame && (
            <span className="pack3-per">~${formatPrice(perGame)} c/u</span>
          )}
          <span className={`pack3-heart${saved ? ' pack3-heart-saved' : ''}`}>
            <Heart size={14} strokeWidth={2.5} fill={saved ? 'currentColor' : 'none'} />
          </span>
        </span>
      </span>
    </button>
  );
});

const PackImageMosaic = memo(function PackImageMosaic({
  games,
  totalCount,
}: {
  games: string[];
  totalCount: number;
}) {
  const withImages = games
    .map(name => ({ name, url: getImageForGame(name) }))
    .filter((g): g is { name: string; url: string } => g.url !== null)
    .slice(0, 4);

  const shown = withImages.length > 0 ? withImages : null;
  const extraCount = totalCount - (shown?.length ?? 0);

  return (
    <div className="relative aspect-[0.58] overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {shown ? (
        <div className={`grid h-full gap-0.5 ${shown.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {shown.map((g, i) => {
            const isLast = i === shown.length - 1;
            return (
              <div key={g.name} className="relative overflow-hidden bg-black/20">
                <Image
                  src={getNintendoThumb(g.url, 120, 90) ?? g.url}
                  alt={g.name}
                  fill
                  className="object-cover"
                  sizes="56px"
                  placeholder="blur"
                  blurDataURL={BLUR_PLACEHOLDER}
                />
                {isLast && extraCount > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <span className="text-lg font-black text-white">+{extraCount}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <Package2 size={36} strokeWidth={1.2} className="text-gray-600" />
        </div>
      )}
    </div>
  );
});

type CatalogDetailModalProps = {
  item: CatalogItem;
  saved: boolean;
  onClose: () => void;
  onBuy: (item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) => void;
  onToggleSaved: (item: CatalogItem) => void;
};

const CatalogDetailModal = memo(function CatalogDetailModal({
  item,
  saved,
  onClose,
  onBuy,
  onToggleSaved,
}: CatalogDetailModalProps) {
  const consoleLabel = getConsoleLabel(item.consoleName);
  const hasOldPrice = !item.esPack && Boolean(item.precioOriginal && item.precioOriginal > item.precio);
  const includedGames = item.esPack ? item.juegosIncluidos : [];

  return (
    <div className="catalog-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Detalles de ${item.titulo}`} onClick={onClose}>
      <div className="catalog-detail-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
              {item.esPack ? <Gift size={15} /> : <Tag size={15} />}
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
              {item.esPack ? 'Pack de juegos' : 'Juego digital'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar detalles" className="motion-press flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-[112px_1fr] gap-4">
          {/* Pack: mosaic of game covers; Game: Nintendo Switch case */}
          {item.esPack ? (
            <PackImageMosaic games={item.juegosIncluidos} totalCount={item.juegosIncluidos.length} />
          ) : (
          <div className="game-case game-case-detail relative aspect-[0.58]">
            <span className="game-card-label" aria-hidden="true">
              <Image
                src="/nintendo-switch-logo-white.png"
                alt=""
                width={34}
                height={22}
                className="h-full w-full object-contain"
              />
            </span>
            {item.img ? (
              <span className="game-case-window">
                <Image src={item.img} alt="" aria-hidden="true" fill className="game-case-image-bg object-cover" sizes="112px" priority />
                <Image src={item.img} alt={item.titulo} fill className="game-case-image game-case-image-main object-contain" sizes="112px" priority />
              </span>
            ) : (
              <div className="game-case-window flex items-center justify-center px-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-700">Sin imagen</div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          )}

          <div className="min-w-0">
            <h3 className="line-clamp-4 text-[19px] font-black leading-[1.05] tracking-[-0.02em] text-white">
              {item.titulo}
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {consoleLabel && (
                <span className="brand-chip px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-[#a9bac5]">
                  <Gamepad2 size={11} /> {consoleLabel}
                </span>
              )}
              {!item.esPack && item.storageRequired && (
                <span className="brand-chip px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-gray-400">
                  <HardDrive size={11} /> {item.storageRequired}
                </span>
              )}
              {item.ahorro && (
                <span className="rounded-full bg-red-500 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wide text-white">
                  {item.ahorro.replace(/[¡!]/g, '')}
                </span>
              )}
            </div>

            <div className="mt-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Precio</p>
              {hasOldPrice && !item.esPack && (
                <p className="text-[11px] font-semibold text-gray-500 line-through decoration-red-500 decoration-2">
                  ${formatPrice(item.precioOriginal ?? 0)}
                </p>
              )}
              <p className="text-[26px] font-black leading-none tracking-[-0.04em] text-white">
                ${formatPrice(item.precio)}
                <span className="ml-1 text-[10px] font-bold tracking-normal text-gray-400">CLP</span>
              </p>
            </div>
          </div>
        </div>

        {item.esPack && includedGames.length > 0 && (
          <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.045] p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Incluye {includedGames.length} juegos</p>
            <div className="max-h-28 space-y-1 overflow-y-auto pr-1 text-[11px] font-semibold leading-relaxed text-[#d5dde1] scrollbar-hide">
              {includedGames.map((game) => (
                <p key={game} className="line-clamp-1">- {game}</p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
          <button
            type="button"
            onClick={() => onToggleSaved(item)}
            aria-label={saved ? 'Quitar de favoritos' : 'Guardar favorito'}
            className={`motion-press flex h-12 w-12 items-center justify-center rounded-full border ${
              saved ? 'border-[#e5e4e2]/70 bg-[#e5e4e2] text-black' : 'border-white/10 bg-white/[0.08] text-white'
            }`}
          >
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={(event) => onBuy(item, event)}
            className="motion-press flex h-12 items-center justify-center gap-2 rounded-full bg-[#25d366] px-5 text-xs font-black uppercase tracking-wide text-[#06130a] shadow-lg shadow-[#25d366]/20"
          >
            Comprar por WhatsApp <ArrowUpRight size={15} strokeWidth={2.8} />
          </button>
        </div>
      </div>
    </div>
  );
});

function CatalogSection({
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
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  useEffect(() => {
    if (!selectedItem) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

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

          <div key={`${storeTab}-${mostrarSoloOfertas ? 'ofertas' : 'todos'}`} className="flex flex-col gap-3 animate-fade-in pb-8">
            {listaVisual.length > 0 ? (
              listaVisual.map((item, idx) =>
                item.esPack ? (
                  <PackCard
                    key={item.id}
                    item={item}
                    saved={savedIds.includes(getSavedKey(item))}
                    onOpen={setSelectedItem}
                  />
                ) : (
                  <CatalogPoster
                    key={item.id}
                    item={item}
                    saved={savedIds.includes(getSavedKey(item))}
                    onOpen={setSelectedItem}
                    priority={idx < 3}
                  />
                )
              )
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

          {selectedItem && createPortal(
            <CatalogDetailModal
              item={selectedItem}
              saved={savedIds.includes(getSavedKey(selectedItem))}
              onClose={() => setSelectedItem(null)}
              onBuy={comprarDirecto}
              onToggleSaved={toggleSaved}
            />,
            document.querySelector('.alfeicon-theme') ?? document.body
          )}
        </>
      )}
    </div>
  );
}

export default memo(CatalogSection);
