"use client";

import { cloneElement, isValidElement, memo, useEffect, type MouseEvent, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Gamepad2, Home, MessageCircle, ShoppingCart, Trash2, X } from 'lucide-react';
import type { CatalogItem } from '@/lib/catalog';
import './AppDock.css';

export type SectionId = 'inicio' | 'catalogo' | 'instrucciones' | 'perfil';

const SECTION_ICONS: Record<SectionId, ReactElement> = {
  inicio:        <Home size={22} />,
  catalogo:      <Gamepad2 size={22} />,
  instrucciones: <BookOpen size={22} />,
  perfil:        <MessageCircle size={22} />,
};

const DOCK_EASE = [0.22, 1, 0.36, 1] as const;
/* Curva y duración compartidas por el morph del dock y el pliegue del botón
   del carrito: al usar la misma línea de tiempo se mueven como una sola pieza. */
const EASE_MORPH = [0.32, 0.72, 0, 1] as const;
const MORPH_DURATION = 0.32;
const SPRING_PANEL     = { type: 'spring', stiffness: 360, damping: 30, mass: 0.9 } as const;
const SPRING_ITEM      = { type: 'spring', stiffness: 440, damping: 32 } as const;
const SPRING_INDICATOR = { type: 'spring', stiffness: 430, damping: 34 } as const;
const SPRING_BADGE     = { type: 'spring', stiffness: 560, damping: 20 } as const;

type AppDockProps = {
  activeSection: SectionId;
  showBottomNav: boolean;
  dockCollapsed: boolean;
  navIndex: number;
  onNavigate: (section: SectionId) => void;
  cartItems: CatalogItem[];
  /* Con el dock contraído, despliega solo el botón del carrito para recibir
     la miniatura que vuela al añadir un item */
  cartPeek: boolean;
  isCartOpen: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onRemoveCartItem: (id: string) => void;
  onCheckout: (event: MouseEvent<HTMLElement>) => void;
  formatPrice: (value: number) => string;
  currencyCode: string;
};

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactElement;
  label: string;
};

type DockIconProps = {
  fill?: string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
};

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  const renderedIcon = isValidElement(icon)
    ? cloneElement(icon as ReactElement<DockIconProps>, {
        fill: active ? 'currentColor' : 'none',
        strokeWidth: active ? 2.85 : 2.15,
        absoluteStrokeWidth: true,
      })
    : icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      className="motion-press group relative flex h-full flex-1 items-center justify-center"
    >
      <span className={`motion-dock-content relative z-10 flex h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.65rem] ${
        active
          ? 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
          : 'text-white/76 active:text-white'
      }`}>
        <motion.span
          className={`relative ${active ? 'dock-icon-active' : 'dock-icon-outline'}`}
          animate={{ scale: active ? 1.08 : 0.94, y: active ? -1 : 0 }}
          transition={SPRING_ITEM}
        >
          {renderedIcon}
        </motion.span>
        <span className="dock-label max-w-full truncate font-black tracking-[0.01em]">
          {label}
        </span>
      </span>
    </button>
  );
}

function AppDock({
  activeSection,
  showBottomNav,
  dockCollapsed,
  navIndex,
  onNavigate,
  cartItems,
  cartPeek,
  isCartOpen,
  onOpenCart,
  onCloseCart,
  onRemoveCartItem,
  onCheckout,
  formatPrice,
  currencyCode,
}: AppDockProps) {
  const cartItemCount = cartItems.length;
  const cartTotal = cartItems.reduce((acc, item) => acc + item.precio, 0);
  // El botón del carrito se ve con el dock expandido o durante el peek
  // (dock contraído + item recién añadido volando hacia él)
  const cartVisible = !dockCollapsed || cartPeek;

  const activeIcon = cloneElement(SECTION_ICONS[activeSection] as ReactElement<DockIconProps>, {
    fill: 'currentColor',
    strokeWidth: 2.5,
    absoluteStrokeWidth: true,
  });

  useEffect(() => {
    if (!isCartOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseCart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCartOpen, onCloseCart]);

  const handleNavigate = (section: SectionId) => {
    if (isCartOpen) onCloseCart();
    onNavigate(section);
  };

  return (
    <>
      {/* Backdrop del carrito: cubre el contenido, deja el dock visible encima */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            key="cart-backdrop"
            className="dock-cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeOut', delay: 0.04 } }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={onCloseCart}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Lista emergente del carrito */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div
            key="cart-panel"
            className="dock-cart-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito de compras"
            initial={{ opacity: 0, y: 30, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING_PANEL }}
            exit={{ opacity: 0, y: 24, scale: 0.92, transition: { duration: 0.2, ease: 'easeIn' } }}
          >
            <motion.div
              className="dock-cart-header"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { ...SPRING_ITEM, delay: 0.05 } }}
            >
              <span className="dock-cart-header-icon">
                <ShoppingCart size={17} />
              </span>
              <h2 className="dock-cart-title">Tu Carrito</h2>
              {cartItemCount > 0 && (
                <motion.span
                  key={cartItemCount}
                  className="dock-cart-count"
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={SPRING_BADGE}
                >
                  {cartItemCount}
                </motion.span>
              )}
            </motion.div>

            {cartItemCount === 0 ? (
              <motion.div
                className="dock-cart-empty"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1, transition: { ...SPRING_ITEM, delay: 0.08 } }}
              >
                <ShoppingCart size={36} strokeWidth={1.4} />
                <p>Tu carrito está vacío</p>
                <button
                  type="button"
                  className="dock-cart-explore motion-press"
                  onClick={() => { onCloseCart(); onNavigate('catalogo'); }}
                >
                  Explorar juegos
                </button>
              </motion.div>
            ) : (
              <div className="dock-cart-list">
                <AnimatePresence mode="popLayout">
                  {cartItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout
                      className="dock-cart-item"
                      initial={{ opacity: 0, y: 18, scale: 0.95 }}
                      animate={{
                        opacity: 1, y: 0, scale: 1,
                        transition: { ...SPRING_ITEM, delay: Math.min(0.07 + index * 0.05, 0.32) },
                      }}
                      exit={{ opacity: 0, x: -44, scale: 0.9, transition: { duration: 0.18, ease: 'easeIn' } }}
                    >
                      <div className="dock-cart-item-img">
                        {item.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.img} alt={item.titulo} loading="lazy" />
                        ) : (
                          <Gamepad2 size={18} />
                        )}
                      </div>
                      <div className="dock-cart-item-info">
                        <h4>{item.titulo}</h4>
                        <p>{item.esPack ? 'Pack' : 'Juego'}</p>
                        <strong>{formatPrice(item.precio)} <span>{currencyCode}</span></strong>
                      </div>
                      <button
                        type="button"
                        aria-label={`Quitar ${item.titulo} del carrito`}
                        className="dock-cart-item-remove motion-press"
                        onClick={() => onRemoveCartItem(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence initial={false}>
              {cartItemCount > 0 && (
                <motion.div
                  key="cart-footer"
                  className="dock-cart-footer"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { ...SPRING_ITEM, delay: 0.16 } }}
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.16, ease: 'easeIn' } }}
                >
                  <div className="dock-cart-total">
                    <span>Total a pagar</span>
                    <motion.strong
                      key={cartTotal}
                      initial={{ scale: 1.12 }}
                      animate={{ scale: 1 }}
                      transition={SPRING_BADGE}
                    >
                      {formatPrice(cartTotal)} <span>{currencyCode}</span>
                    </motion.strong>
                  </div>
                  <button
                    type="button"
                    className="dock-cart-checkout motion-press"
                    onClick={onCheckout}
                  >
                    Proceder al pago
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="app-dock-wrapper"
        initial={false}
        animate={{
          y: showBottomNav || dockCollapsed ? 0 : 22,
          opacity: showBottomNav || dockCollapsed ? 1 : 0,
        }}
        transition={{
          y: { duration: 0.34, ease: DOCK_EASE, delay: showBottomNav ? 0.06 : 0.22 },
          opacity: { duration: 0.18, delay: showBottomNav ? 0 : 0.28 },
        }}
      >
        {/* El dock se contrae hacia la izquierda al bajar (el wrap es el primer
            hijo del flex, así que al reducir su ancho queda anclado a la izquierda).
            Dock y botón del carrito comparten la MISMA curva y duración (EASE_MORPH /
            MORPH_DURATION): el borde derecho de ambos se mueve como una sola pieza. */}
        <div className={`flex w-full items-center justify-start ${dockCollapsed ? 'gap-0' : 'gap-3'}`} style={{ pointerEvents: showBottomNav || dockCollapsed ? 'auto' : 'none' }}>
          <motion.div
            className="dock-morph-wrap"
            initial={false}
            animate={dockCollapsed ? 'collapsed' : isCartOpen ? ['expanded', 'cartOpen'] : 'expanded'}
            variants={{
              expanded:  { width: 'calc(100% - 78px)', height: 66, borderRadius: '2rem', scale: 1 },
              collapsed: { width: 54,                  height: 54, borderRadius: '50%',  scale: 1 },
              cartOpen:  { scale: 0.965 },
            }}
            transition={{ duration: MORPH_DURATION, ease: EASE_MORPH, scale: SPRING_PANEL }}
            onClick={dockCollapsed ? () => onNavigate(activeSection) : undefined}
            style={{ cursor: dockCollapsed ? 'pointer' : 'default' }}
            role={dockCollapsed ? 'button' : undefined}
            aria-label={dockCollapsed ? 'Mostrar navegación' : undefined}
          >
            {/* Icono de la sección activa: aparece cuando el dock ya se contrajo */}
            <motion.span
              className="dock-pill-icon"
              initial={false}
              animate={{ opacity: dockCollapsed ? 1 : 0, scale: dockCollapsed ? 1 : 0.5 }}
              transition={dockCollapsed
                ? { duration: 0.3, ease: DOCK_EASE, delay: MORPH_DURATION * 0.45 }
                : { duration: 0.14, ease: 'easeIn' }}
              style={{ pointerEvents: 'none' }}
            >
              {activeIcon}
            </motion.span>

            <motion.div
              className="dock-full-content"
              animate={{ opacity: dockCollapsed ? 0 : isCartOpen ? 0.55 : 1 }}
              transition={dockCollapsed
                ? { duration: 0.18, ease: 'easeOut' }
                : { duration: 0.3, ease: 'easeOut', delay: MORPH_DURATION * 0.3 }}
              style={{ pointerEvents: dockCollapsed ? 'none' : 'auto' }}
            >
              <nav aria-label="Navegación principal" className="app-glass-dock motion-dock relative flex h-[66px] w-full items-center justify-around overflow-hidden rounded-[2rem] px-1.5">
                <motion.span
                  className="app-glass-dock-indicator pointer-events-none absolute left-1.5 top-1.5 h-[54px] rounded-[1.8rem]"
                  style={{ width: 'calc((100% - 0.75rem) / 4)' }}
                  animate={{ x: `${navIndex * 100}%` }}
                  transition={SPRING_INDICATOR}
                />
                <NavButton active={activeSection === 'inicio'} onClick={() => handleNavigate('inicio')} icon={<Home size={20} />} label="Inicio" />
                <NavButton active={activeSection === 'catalogo'} onClick={() => handleNavigate('catalogo')} icon={<Gamepad2 size={20} />} label="Juegos" />
                <NavButton active={activeSection === 'instrucciones'} onClick={() => handleNavigate('instrucciones')} icon={<BookOpen size={20} />} label="Guía" />
                <NavButton active={activeSection === 'perfil'} onClick={() => handleNavigate('perfil')} icon={<MessageCircle size={20} />} label="Soporte" />
              </nav>
            </motion.div>
          </motion.div>

          {/* Botón del carrito: siempre montado, pliega su ancho y margen con la
              misma curva que el morph del dock (evita el salto del gap al
              desmontarse). Se transforma en "X" mientras el panel está abierto. */}
          <motion.button
            type="button"
            data-dock-cart
            onClick={isCartOpen ? onCloseCart : onOpenCart}
            aria-label={isCartOpen ? 'Cerrar Carrito' : 'Abrir Carrito'}
            aria-expanded={isCartOpen}
            aria-hidden={!cartVisible}
            tabIndex={cartVisible ? 0 : -1}
            initial={false}
            animate={cartVisible
              ? { width: 66, marginLeft: 12, opacity: 1, scale: 1 }
              : { width: 0, marginLeft: 0, opacity: 0, scale: 0.6 }}
            transition={{
              width:      { duration: MORPH_DURATION, ease: EASE_MORPH },
              marginLeft: { duration: MORPH_DURATION, ease: EASE_MORPH },
              scale:      { duration: MORPH_DURATION, ease: EASE_MORPH },
              opacity: cartVisible
                ? { duration: MORPH_DURATION * 0.6, ease: 'easeOut', delay: MORPH_DURATION * 0.25 }
                : { duration: MORPH_DURATION * 0.55, ease: 'easeOut' },
            }}
            className={`dock-cart-btn relative flex shrink-0 items-center justify-center motion-press group active:text-white ${isCartOpen ? 'dock-cart-btn-open' : ''}`}
            style={{ height: 66, borderRadius: '2rem', cursor: 'pointer', pointerEvents: cartVisible ? 'auto' : 'none' }}
          >
                <span className="relative flex h-full w-full items-center justify-center">
                  <AnimatePresence initial={false}>
                    {isCartOpen ? (
                      <motion.span
                        key="icon-close"
                        className="absolute"
                        initial={{ rotate: -70, scale: 0.4, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: 70, scale: 0.4, opacity: 0 }}
                        transition={{ duration: 0.22, ease: DOCK_EASE }}
                      >
                        <X size={22} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="icon-cart"
                        className="absolute text-white/76 group-active:text-white transition-colors"
                        initial={{ rotate: 70, scale: 0.4, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: -70, scale: 0.4, opacity: 0 }}
                        transition={{ duration: 0.22, ease: DOCK_EASE }}
                      >
                        <ShoppingCart size={22} />
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {cartItemCount > 0 && !isCartOpen && (
                      <motion.span
                        key="cart-badge"
                        className="dock-cart-badge"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
                        transition={SPRING_BADGE}
                      >
                        <motion.span
                          key={cartItemCount}
                          className="flex"
                          initial={{ scale: 1.6 }}
                          animate={{ scale: 1 }}
                          transition={SPRING_BADGE}
                        >
                          {cartItemCount}
                        </motion.span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

export default memo(AppDock);
