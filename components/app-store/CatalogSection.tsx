"use client";

import { memo, useEffect, useState, type MouseEvent, type RefObject } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ArrowDownCircle, ArrowUpRight, Filter, Gamepad2, Gift, HardDrive, Heart, Loader2, Package2, Search, Tag, X, Plus, ShoppingCart, Check, Share2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { CatalogItem, CatalogPack } from '@/lib/catalog';
import { getImageForGame, getNintendoThumb, slugifyTitulo } from '@/lib/catalog';
import { trackView } from '@/lib/track';
import { useCurrency } from '@/components/currency/CurrencyProvider';
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
  addToCart: (item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) => void;
  toggleSaved: (item: CatalogItem) => void;
  getSavedKey: (item: CatalogItem) => string;
  savedIds: string[];
  // Filtro por precio: rango libre min/max (en la moneda mostrada). Cualquiera
  // de los dos puede ir vacío.
  priceMin: string;
  priceMax: string;
  setPriceMin: (value: string) => void;
  setPriceMax: (value: string) => void;
  currencyCode: string;
  // Limpiar filtros: solo se muestra el botón cuando hay algún filtro activo.
  filtrosActivos: boolean;
  limpiarFiltros: () => void;
  // Deep-link: ficha a abrir automáticamente al montar (o null). Se consume una vez.
  initialOpenItem?: CatalogItem | null;
  onOpenConsumed?: () => void;
};

type CatalogPosterProps = {
  item: CatalogItem;
  saved: boolean;
  onOpen: (item: CatalogItem) => void;
  onAddToCart: (item: CatalogItem, event: MouseEvent<HTMLButtonElement>) => void;
  onToggleSaved: (item: CatalogItem) => void;
  priority?: boolean;
};

const BLUR_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23181a1e' width='1' height='1'/%3E%3C/svg%3E";

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
  onAddToCart,
  onToggleSaved,
  priority = false,
}: CatalogPosterProps) {
  const { format, code } = useCurrency();
  const consoleLabel = getConsoleLabel(item.consoleName) || 'Juego digital';
  const hasDiscount = !item.esPack && Boolean(item.precioOriginal && item.precioOriginal > item.precio);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="game3-card w-full"
      aria-label={`Ver detalles de ${item.titulo}`}
    >
      {/* Carátula a lo ancho, 16:9 nativo (mismo layout que los packs) */}
      <span className="game3-visual">
        {item.img ? (
          <Image
            src={getNintendoThumb(item.img, 600, 338) ?? item.img}
            alt={item.titulo}
            fill
            className="object-cover"
            sizes="(max-width: 480px) 100vw, 400px"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            priority={priority}
          />
        ) : (
          <Gamepad2 size={32} strokeWidth={1.2} className="game3-placeholder-ico" />
        )}
        {item.ahorro && (
          <span className="cat2-badge">{item.ahorro.replace(/[¡!]/g, '')}</span>
        )}
        <span className="game3-console-badge">{consoleLabel}</span>
      </span>

      {/* Contenido */}
      <span className="game3-body">
        <span className="game3-label">Juego digital</span>
        <span className="game3-title">{item.titulo}</span>

        <span className="game3-footer">
          <span className="game3-price-wrap">
            {hasDiscount && (
              <span className="game3-old-price">{format(item.precioOriginal ?? 0)}</span>
            )}
            <span className={`game3-price${hasDiscount ? ' game3-price-sale' : ''}`}>
              {format(item.precio)}
              <sup className="game3-clp">{code}</sup>
            </span>
          </span>
          <span className="ml-auto flex items-center relative z-10">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(item, e as any);
              }}
              className="cat2-add-btn"
              aria-label="Añadir al carrito"
            >
              <Plus size={15} strokeWidth={2.5} />
            </div>
          </span>
        </span>
      </span>

      {/* Corazón presionable sobre la imagen */}
      <span
        role="button"
        tabIndex={0}
        aria-label={saved ? `Quitar ${item.titulo} de guardados` : `Guardar ${item.titulo}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSaved(item);
        }}
        className={`game3-heart-btn ${saved ? 'game3-heart-saved' : ''}`}
      >
        <Heart size={16} strokeWidth={2.5} fill={saved ? 'currentColor' : 'none'} />
      </span>
    </button>
  );
});

const PackCard = memo(function PackCard({
  item,
  saved,
  onOpen,
  onAddToCart,
  onToggleSaved,
}: {
  item: CatalogPack;
  saved: boolean;
  onOpen: (item: CatalogItem) => void;
  onAddToCart: (item: CatalogItem, event: MouseEvent<HTMLButtonElement>) => void;
  onToggleSaved: (item: CatalogItem) => void;
}) {
  const { format, code } = useCurrency();
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
            src={getNintendoThumb(item.img, 600, 338) ?? item.img}
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
        <span className="pack3-header-row pr-8">
          <span className="pack3-label">Pack de juegos</span>
          {item.esNuevo && <span className="pack3-new">NUEVO</span>}
        </span>
        <span className="pack3-title pr-8">{item.titulo}</span>
        <span className="pack3-games-list">
          {shown.join(' · ')}{extra > 0 ? ` +${extra} más` : ''}
        </span>
        <span className="pack3-footer">
          <span className="pack3-price">
            {format(item.precio)}<sup className="pack3-clp">{code}</sup>
          </span>
          <span className="flex items-center gap-2 relative z-10">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(item, e as any);
              }}
              className="cat2-add-btn"
              aria-label="Añadir al carrito"
            >
              <Plus size={15} strokeWidth={2.5} />
            </div>
          </span>
        </span>
      </span>
      
      {/* Corazón presionable sobre la imagen */}
      <span
        role="button"
        tabIndex={0}
        aria-label={saved ? `Quitar ${item.titulo} de guardados` : `Guardar ${item.titulo}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSaved(item);
        }}
        className={`game3-heart-btn ${saved ? 'game3-heart-saved' : ''}`}
      >
        <Heart size={16} strokeWidth={2.5} fill={saved ? 'currentColor' : 'none'} />
      </span>
    </button>
  );
});

type CatalogDetailModalProps = {
  item: CatalogItem;
  saved: boolean;
  onClose: () => void;
  onBuy: (item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) => void;
  onAddToCart: (item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) => void;
  onToggleSaved: (item: CatalogItem) => void;
};

const CatalogDetailModal = memo(function CatalogDetailModal({
  item,
  saved,
  onClose,
  onBuy,
  onAddToCart,
  onToggleSaved,
}: CatalogDetailModalProps) {
  const { format, code, isBase, feeUsd } = useCurrency();
  const [added, setAdded] = useState(false);
  const [shared, setShared] = useState(false);
  const consoleLabel = getConsoleLabel(item.consoleName);
  const hasOldPrice = !item.esPack && Boolean(item.precioOriginal && item.precioOriginal > item.precio);

  // Reinicia el estado si se abre otro juego en el mismo modal.
  useEffect(() => { setAdded(false); setShared(false); }, [item.id]);

  const handleShare = async () => {
    const url = `${window.location.origin}/juego/${slugifyTitulo(item.titulo)}`;
    const shareData = {
      title: item.titulo,
      text: `Mira "${item.titulo}" en Alfeicon Games`,
      url,
    };
    try {
      // Menú nativo de compartir en móvil; en desktop cae a copiar al portapapeles.
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
      }
    } catch {
      // El usuario canceló el diálogo de compartir: no hacemos nada.
    }
  };

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    if (added) return;
    // Lanza la miniatura voladora desde el botón (el modal sigue abierto un
    // instante para que la animación se vea) y confirma en el propio botón.
    onAddToCart(item, event);
    setAdded(true);
    window.setTimeout(() => onClose(), 950);
  };
  const includedGames = item.esPack ? item.juegosIncluidos : [];
  const packCovers = item.esPack
    ? includedGames
        .map((name) => ({ name, url: getImageForGame(name) }))
        .filter((g): g is { name: string; url: string } => Boolean(g.url))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }}
      className="catalog-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${item.titulo}`}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', damping: 26, stiffness: 340 } }}
        exit={{ y: 90, scale: 0.9, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
        className={`catalog-detail-panel${item.esPack ? ' catalog-detail-panel--pack' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="cdm-header flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black">
              {item.esPack ? <Gift size={15} /> : <Tag size={15} />}
            </span>
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
              {item.esPack ? 'Pack de juegos' : 'Juego digital'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartir"
              className={`motion-press flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 ${
                shared ? 'border-[#22c55e]/50 bg-[#22c55e]/15 text-[#22c55e]' : 'border-white/10 bg-white/10 text-white'
              }`}
            >
              {shared ? <Check size={16} strokeWidth={3} /> : <Share2 size={16} />}
              {shared && <span className="text-[10px] font-black uppercase tracking-wide">Copiado</span>}
            </button>
            <button
              type="button"
              onClick={() => onToggleSaved(item)}
              aria-label={saved ? 'Quitar de favoritos' : 'Guardar favorito'}
              className={`motion-press flex h-9 w-9 items-center justify-center rounded-full border ${
                saved ? 'border-[#e5e4e2]/70 bg-[#e5e4e2] text-black' : 'border-white/10 bg-white/10 text-white'
              }`}
            >
              <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
            </button>
            <button type="button" onClick={onClose} aria-label="Cerrar detalles" className="motion-press flex h-9 w-9 items-center justify-center rounded-full bg-[#ff4d4f]/18 text-[#ff5a5c]">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenido con scroll */}
        <div className="cdm-scroll scrollbar-hide">
          {/* Pack: carrusel de portadas; Game: carátula 16:9 */}
          {item.esPack ? (
            packCovers.length > 0 ? (
              <div className="cdm-carousel scrollbar-hide">
                {packCovers.map((g) => (
                  <div key={g.name} className="cdm-carousel-card">
                    <Image
                      src={getNintendoThumb(g.url, 360, 360) ?? g.url}
                      alt={g.name}
                      fill
                      sizes="128px"
                      className="object-cover"
                      placeholder="blur"
                      blurDataURL={BLUR_PLACEHOLDER}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/5">
                <Package2 size={30} strokeWidth={1.2} className="text-gray-600" />
              </div>
            )
          ) : (
            <div className="liquid-glass relative aspect-[16/9] w-full overflow-hidden rounded-[1.2rem]">
              {item.img ? (
                <Image src={item.img} alt={item.titulo} fill className="relative z-[1] object-contain" sizes="360px" priority />
              ) : (
                <div className="relative z-[1] flex h-full items-center justify-center px-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">Sin imagen</div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col items-center text-center">
            <h3 className="line-clamp-4 text-[19px] font-black leading-[1.05] tracking-[-0.02em] text-white">
              {item.titulo}
            </h3>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
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

            {!isBase && (
              <p className="mx-auto mt-3 max-w-[280px] text-[10px] font-semibold leading-relaxed text-gray-400">
                Precio internacional (incluye +US${feeUsd} por cambio y transferencia). Pago por
                transferencia o tarjeta de crédito.
              </p>
            )}
          </div>

          {item.esPack && includedGames.length > 0 && (
            <div className="mt-5">
              <p className="cdm-games-label">Incluye {includedGames.length} juegos</p>
              <div className="cdm-games-list">
                {includedGames.map((game, i) => (
                  <div key={game} className="cdm-game-row">
                    <span className="cdm-game-num">{i + 1}</span>
                    <span className="cdm-game-name">{game}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer fijo: precio arriba, botón comprar abajo */}
        <div className="cdm-footer flex flex-col gap-2.5">
          <div className="cdm-price">
            <span className="cdm-price__label">Precio</span>
            {hasOldPrice && !item.esPack && (
              <span className="cdm-price__old">{format(item.precioOriginal ?? 0)}</span>
            )}
            <span className="cdm-price__value">
              {format(item.precio)}<sup className="cdm-price__code">{code}</sup>
            </span>
          </div>
          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={added}
            animate={{
              backgroundColor: added ? '#22c55e' : '#ffffff',
              color: added ? '#ffffff' : '#000000',
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="motion-press relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full px-4 text-xs font-black uppercase tracking-wide shadow-lg shadow-white/10"
          >
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span
                  key="added"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <motion.span
                    initial={{ scale: 0, rotate: -25 }}
                    animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                    transition={{ duration: 0.4, times: [0, 0.6, 1], ease: 'easeOut' }}
                  >
                    <ShoppingCart size={16} strokeWidth={2.8} />
                  </motion.span>
                  ¡Agregado!
                  <Check size={15} strokeWidth={3.2} />
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  Añadir al carrito <Plus size={15} strokeWidth={2.8} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
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
  addToCart,
  toggleSaved,
  getSavedKey,
  savedIds,
  priceMin,
  priceMax,
  setPriceMin,
  setPriceMax,
  currencyCode,
  filtrosActivos,
  limpiarFiltros,
  initialOpenItem,
  onOpenConsumed,
}: CatalogSectionProps) {
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Cantidad de filtros activos (sin contar la búsqueda, que vive en la barra).
  const activeFilterCount =
    (consoleFilter !== 'all' ? 1 : 0) +
    (mostrarSoloOfertas ? 1 : 0) +
    (mostrarGuardados ? 1 : 0) +
    (priceMin !== '' || priceMax !== '' ? 1 : 0);

  // Clases de un chip de filtro (activo / inactivo).
  const chipClass = (active: boolean) =>
    `magnetic inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
      active
        ? 'border-[#e5e4e2]/70 bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-white/10'
        : 'premium-control text-gray-400 active:text-white'
    }`;

  // Bloquea el scroll del fondo y cierra con Escape mientras el sheet está abierto.
  useEffect(() => {
    if (!showFilters) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFilters(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showFilters]);

  // Deep-link (/juego/<slug>): abre la ficha indicada al montar y la consume,
  // para no reabrirla en renders posteriores.
  useEffect(() => {
    if (initialOpenItem) {
      setSelectedItem(initialOpenItem);
      onOpenConsumed?.();
    }
    // Solo al recibir un item de deep-link; onOpenConsumed lo limpia enseguida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenItem]);

  // Ficha abierta = visita al juego. Permite cruzar "cuánto se mira" con
  // "cuánto se vende" en el admin.
  useEffect(() => {
    if (!selectedItem) return;
    trackView(`/juego/${slugifyTitulo(selectedItem.titulo)}`, selectedItem);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null);
      }
    };

    // El fondo translúcido lo produce el backdrop-filter del propio backdrop
    // (.catalog-detail-backdrop), igual que el modal de pago. No aplicamos ningún
    // filtro directo a #store-content: eso oscurecía el contenido que el backdrop
    // debe dejar ver.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedItem]);

  return (
    <div className={`section-motion ${sectionMotion}`}>
      <div className="premium-surface sticky top-3 z-30 -mx-1 mb-6 space-y-4 rounded-[1.8rem] pt-4 px-4 pb-5 backdrop-blur-2xl">
        <div className={`relative flex items-center transition-transform duration-300 ${searchTerm ? 'scale-[1.01]' : 'scale-100'}`}>
          <input
            type="text"
            aria-label={storeTab === 'individual' ? 'Buscar juego' : 'Buscar pack'}
            placeholder={storeTab === 'individual' ? 'Busca tu juego...' : 'Busca en packs...'}
            value={searchTerm}
            onChange={(e) => {
              const texto = e.target.value;
              setSearchTerm(texto);
              // Búsqueda en vivo: filtra mientras escribes, sin apretar "Buscar".
              setFilterTerm(texto);
              setVisibleCount(catalogInitialCount);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ejecutarBusqueda();
            }}
            className="premium-control w-full rounded-full py-3 pl-5 pr-14 text-base text-white shadow-inner transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/15"
          />
          <button type="button" aria-label="Buscar en catálogo" onClick={ejecutarBusqueda} className="magnetic absolute right-2 flex items-center justify-center rounded-full bg-white p-2.5 text-black shadow-lg shadow-white/10 active:bg-gray-100">
            <Search size={18} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        <div className="premium-surface relative flex overflow-hidden rounded-full p-1" role="group" aria-label="Tipo de catálogo">
          <span
            className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-lg shadow-white/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              storeTab === 'packs' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'
            }`}
          />
          <button type="button" aria-pressed={storeTab === 'individual'} onClick={() => { setStoreTab('individual'); setSearchTerm(''); setFilterTerm(''); }} className={`relative z-10 flex-1 rounded-full py-2.5 text-xs font-black uppercase transition-colors duration-300 ${storeTab === 'individual' ? 'text-black' : 'text-gray-500 active:text-white'}`}>Juegos Unitarios</button>
          <button type="button" aria-pressed={storeTab === 'packs'} onClick={() => { setStoreTab('packs'); setSearchTerm(''); setFilterTerm(''); setMostrarSoloOfertas(false); }} className={`relative z-10 flex-1 rounded-full py-2.5 text-xs font-black uppercase transition-colors duration-300 ${storeTab === 'packs' ? 'text-black' : 'text-gray-500 active:text-white'}`}>Pack de Juegos</button>
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
          <div className="flex justify-between items-center px-2 mt-2 mb-6 animate-fade-in">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
              {mostrarSoloOfertas ? 'Ofertas' : mostrarGuardados ? 'Favoritos' : storeTab === 'packs' ? 'Packs' : 'Juegos'}
              <span className="ml-2 text-xs text-white">({listaFiltrada.length})</span>
            </p>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label="Abrir filtros"
              className={`magnetic flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase ${
                activeFilterCount > 0
                  ? 'border-[#e5e4e2]/70 bg-[#e5e4e2] text-[#0a0a0a] shadow-lg shadow-white/10'
                  : 'premium-control text-gray-300 active:text-white'
              }`}
            >
              <SlidersHorizontal size={13} /> Filtros
              {activeFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0a0a0a] px-1 text-[9px] text-[#e5e4e2]">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div key={`${storeTab}-${mostrarSoloOfertas ? 'ofertas' : 'todos'}`} className="flex flex-col gap-3 animate-fade-in pb-8">
            {listaVisual.length > 0 ? (
              listaVisual.map((item, idx) =>
                item.esPack ? (
                  <PackCard
                    key={item.id}
                    item={item as CatalogPack}
                    saved={savedIds.includes(getSavedKey(item))}
                    onOpen={setSelectedItem}
                    onAddToCart={addToCart}
                    onToggleSaved={toggleSaved}
                  />
                ) : (
                  <CatalogPoster
                    key={item.id}
                    item={item}
                    saved={savedIds.includes(getSavedKey(item))}
                    onOpen={setSelectedItem}
                    onAddToCart={addToCart}
                    onToggleSaved={toggleSaved}
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
                  <button onClick={limpiarFiltros} className="magnetic rounded-full bg-white px-4 py-2 text-xs font-black uppercase text-black">Ver todo</button>
                  <a href={`https://wa.me/${whatsappNumber}`} target="_blank" className="magnetic rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase text-white">Consultar</a>
                </div>
              </div>
            )}
          </div>
          {visibleCount < listaFiltrada.length && (
            <div className="mt-8 flex flex-col items-center gap-4 pb-4">
              <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />
              <button onClick={() => setVisibleCount((prev) => Math.min(prev + catalogBatchSize, listaFiltrada.length))} className="premium-surface flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase text-white transition-all duration-300 active:bg-white active:text-black">
                <ArrowDownCircle size={16} /> Ver más
              </button>
            </div>
          )}

          {/* Sheet de filtros (mismo portal/estilo que la ficha de detalle). */}
          {typeof window !== 'undefined' && createPortal(
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  key="filters-backdrop"
                  className="catalog-detail-backdrop"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Filtros"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
                  exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
                  onClick={() => setShowFilters(false)}
                >
                  <motion.div
                    className="catalog-detail-panel catalog-detail-panel--scroll"
                    initial={{ y: 90, opacity: 0 }}
                    animate={{ y: 0, opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 340 } }}
                    exit={{ y: 90, opacity: 0, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                          <SlidersHorizontal size={15} />
                        </span>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-300">Filtros</p>
                      </div>
                      <button type="button" onClick={() => setShowFilters(false)} aria-label="Cerrar filtros" className="motion-press flex h-9 w-9 items-center justify-center rounded-full bg-[#ff4d4f]/18 text-[#ff5a5c]">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mb-5">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Consola</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { id: 'all', label: 'Todo' },
                          { id: 'switch', label: 'Switch 1 y 2' },
                          { id: 'switch2', label: 'Solo Switch 2' },
                        ] as const).map((o) => (
                          <button key={o.id} type="button" aria-pressed={consoleFilter === o.id} onClick={() => { setConsoleFilter(o.id); setVisibleCount(catalogInitialCount); }} className={chipClass(consoleFilter === o.id)}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Precio <span className="text-gray-600">({currencyCode})</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <label className="flex flex-1 items-center gap-1.5 rounded-full premium-control px-3.5 py-2.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Mín</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="0"
                            value={priceMin}
                            onChange={(e) => { setPriceMin(e.target.value); setVisibleCount(catalogInitialCount); }}
                            aria-label="Precio mínimo"
                            className="w-full min-w-0 bg-transparent text-sm font-bold text-white outline-none placeholder:text-gray-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </label>
                        <span className="text-gray-600" aria-hidden="true">—</span>
                        <label className="flex flex-1 items-center gap-1.5 rounded-full premium-control px-3.5 py-2.5">
                          <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Máx</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="∞"
                            value={priceMax}
                            onChange={(e) => { setPriceMax(e.target.value); setVisibleCount(catalogInitialCount); }}
                            aria-label="Precio máximo"
                            className="w-full min-w-0 bg-transparent text-sm font-bold text-white outline-none placeholder:text-gray-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Otros</p>
                      <div className="flex flex-wrap gap-2">
                        {storeTab === 'individual' && (
                          <button type="button" aria-pressed={mostrarSoloOfertas} onClick={() => { setMostrarSoloOfertas(!mostrarSoloOfertas); setVisibleCount(catalogInitialCount); }} className={chipClass(mostrarSoloOfertas)}>
                            <Filter size={12} /> Ofertas
                          </button>
                        )}
                        <button type="button" aria-pressed={mostrarGuardados} onClick={() => { setMostrarGuardados(!mostrarGuardados); setVisibleCount(catalogInitialCount); }} className={chipClass(mostrarGuardados)}>
                          <Heart size={12} fill={mostrarGuardados ? 'currentColor' : 'none'} /> Favoritos ({savedCountActual})
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
                      <button type="button" onClick={limpiarFiltros} disabled={!filtrosActivos} className="motion-press flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 py-3 text-xs font-black uppercase text-gray-300 disabled:opacity-40">
                        <RotateCcw size={13} /> Limpiar
                      </button>
                      <button type="button" onClick={() => setShowFilters(false)} className="motion-press flex-[1.5] rounded-full bg-white py-3 text-xs font-black uppercase text-black">
                        Ver {listaFiltrada.length} resultados
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.getElementById('store-content') ?? document.body
          )}

          {/* Portal a #store-content (no a .alfeicon-theme ni inline):
              - Inline quedaría dentro de .section-motion, que tiene `transform`
                para su animación → ese transform se vuelve el bloque contenedor del
                backdrop `fixed` y lo dimensiona al alto del contenido (no al
                viewport), empujando el panel fuera de pantalla.
              - .alfeicon-theme rompe el backdrop-filter en Safari (samplea negro a
                través del overflow/stacking de #store-content).
              #store-content no tiene transform (fixed = viewport) y el backdrop-filter
              captura el catálogo detrás, igual que el modal de pago. */}
          {typeof window !== 'undefined' && createPortal(
            <AnimatePresence>
              {selectedItem && (
                <CatalogDetailModal
                  key="detail-modal"
                  item={selectedItem}
                  saved={savedIds.includes(getSavedKey(selectedItem))}
                  onClose={() => setSelectedItem(null)}
                  onBuy={comprarDirecto}
                  onAddToCart={addToCart}
                  onToggleSaved={toggleSaved}
                />
              )}
            </AnimatePresence>,
            document.getElementById('store-content') ?? document.body
          )}
        </>
      )}
    </div>
  );
}

export default memo(CatalogSection);
