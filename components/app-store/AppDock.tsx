"use client";

import { cloneElement, isValidElement, memo, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Gamepad2, Home, MessageCircle } from 'lucide-react';
import './AppDock.css';

export type SectionId = 'inicio' | 'catalogo' | 'instrucciones' | 'perfil';

const SECTION_ICONS: Record<SectionId, ReactElement> = {
  inicio:        <Home size={22} />,
  catalogo:      <Gamepad2 size={22} />,
  instrucciones: <BookOpen size={22} />,
  perfil:        <MessageCircle size={22} />,
};

type AppDockProps = {
  activeSection: SectionId;
  showBottomNav: boolean;
  dockCollapsed: boolean;
  navIndex: number;
  onNavigate: (section: SectionId) => void;
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
          ? 'text-white scale-[1.02] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
          : 'text-white/76 hover:text-white'
      }`}>
        <span className={`motion-dock-icon ${active ? 'dock-icon-active scale-100' : 'dock-icon-outline scale-95 group-hover:scale-100'}`}>
          {renderedIcon}
        </span>
        <span className="dock-label max-w-full truncate font-black tracking-[0.01em]">
          {label}
        </span>
      </span>
    </button>
  );
}

function AppDock({ activeSection, showBottomNav, dockCollapsed, navIndex, onNavigate }: AppDockProps) {
  const activeIcon = cloneElement(SECTION_ICONS[activeSection] as ReactElement<DockIconProps>, {
    fill: 'currentColor',
    strokeWidth: 2.5,
    absoluteStrokeWidth: true,
  });

  return (
    <motion.div
      className="app-dock-wrapper"
      initial={false}
      animate={{
        y: showBottomNav || dockCollapsed ? 0 : 22,
        opacity: showBottomNav || dockCollapsed ? 1 : 0,
      }}
      transition={{
        y: { duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: showBottomNav ? 0.06 : 0.22 },
        opacity: { duration: 0.18, delay: showBottomNav ? 0 : 0.28 },
      }}
      style={{ pointerEvents: showBottomNav || dockCollapsed ? 'auto' : 'none' }}
    >
      {/* ── Wrapper que morfea entre pill y dock completo ── */}
      <motion.div
        className="dock-morph-wrap"
        animate={dockCollapsed ? 'collapsed' : 'expanded'}
        variants={{
          expanded:  { width: '100%', height: 66, borderRadius: '2rem' },
          collapsed: { width: 54,     height: 54, borderRadius: '50%'  },
        }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        onClick={dockCollapsed ? () => onNavigate(activeSection) : undefined}
        style={{ cursor: dockCollapsed ? 'pointer' : 'default' }}
      >
        {/* Icono activo — visible solo cuando está colapsado */}
        <motion.span
          className="dock-pill-icon"
          animate={{ opacity: dockCollapsed ? 1 : 0, scale: dockCollapsed ? 1 : 0.5 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ pointerEvents: 'none' }}
        >
          {activeIcon}
        </motion.span>

        {/* Contenido completo del dock — visible cuando está expandido */}
        <motion.div
          className="dock-full-content"
          animate={{ opacity: dockCollapsed ? 0 : 1 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          style={{ pointerEvents: dockCollapsed ? 'none' : 'auto' }}
        >
          <nav aria-label="Navegación principal" className="app-glass-dock motion-dock relative flex h-[66px] w-full items-center justify-around overflow-hidden rounded-[2rem] px-1.5">
            <span
              className="app-glass-dock-indicator motion-dock-indicator pointer-events-none absolute left-1.5 top-1.5 h-[54px] rounded-[1.8rem]"
              style={{
                width: 'calc((100% - 0.75rem) / 4)',
                transform: `translateX(${navIndex * 100}%)`,
              }}
            />
            <NavButton active={activeSection === 'inicio'} onClick={() => onNavigate('inicio')} icon={<Home size={20} />} label="Inicio" />
            <NavButton active={activeSection === 'catalogo'} onClick={() => onNavigate('catalogo')} icon={<Gamepad2 size={20} />} label="Juegos" />
            <NavButton active={activeSection === 'instrucciones'} onClick={() => onNavigate('instrucciones')} icon={<BookOpen size={20} />} label="Guía" />
            <NavButton active={activeSection === 'perfil'} onClick={() => onNavigate('perfil')} icon={<MessageCircle size={20} />} label="Soporte" />

          </nav>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default memo(AppDock);
