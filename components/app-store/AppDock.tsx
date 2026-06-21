"use client";

import { cloneElement, isValidElement, memo, type ReactElement } from 'react';
import { BookOpen, Gamepad2, Home, MessageCircle } from 'lucide-react';

export type SectionId = 'inicio' | 'catalogo' | 'instrucciones' | 'perfil';

type AppDockProps = {
  activeSection: SectionId;
  showBottomNav: boolean;
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

function AppDock({ activeSection, showBottomNav, navIndex, onNavigate }: AppDockProps) {
  return (
    <div className={`app-dock-wrapper ${showBottomNav ? 'app-dock-wrapper-visible' : 'app-dock-wrapper-hidden'}`}>
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
    </div>
  );
}

export default memo(AppDock);
