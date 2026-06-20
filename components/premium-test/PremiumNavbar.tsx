"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { useGlassProximityAnimation } from "./useGlassProximityAnimation";

const navItems = ["About", "Service", "Pricing", "Career"];

export function PremiumNavbar() {
  const panelRef = useRef<HTMLElement | null>(null);
  const lowerContentRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const linksRef = useRef<HTMLAnchorElement[]>([]);
  useGlassProximityAnimation({ panelRef, lowerContentRef, dividerRef, linksRef });

  return (
    <header className="fixed left-1/2 top-5 z-50 w-[min(88vw,840px)] -translate-x-1/2 sm:top-7 lg:left-[52%] lg:w-[min(76vw,900px)]">
      <nav
        ref={panelRef}
        aria-label="Navegación premium de prueba"
        className="premium-liquid-panel relative overflow-hidden rounded-[2.4rem] border border-white/28 bg-transparent px-5 py-4 text-white shadow-[0_28px_76px_rgba(0,0,0,0.1)] backdrop-blur-[1px] sm:rounded-[3rem] sm:px-9 sm:py-5"
      >
        <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/12" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-white/48" />
        <div className="pointer-events-none absolute -left-12 bottom-[-35%] h-56 w-56 rounded-full bg-white/[0.002] blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-10 hidden h-40 w-40 rounded-full bg-white/[0.003] blur-3xl sm:block" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <a href="#" className="text-2xl font-black tracking-[-0.06em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-4xl" aria-label="KEDA inicio">
            KEDA
          </a>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold text-white/86 drop-shadow-[0_2px_10px_rgba(0,0,0,0.38)] sm:inline">Hi, David Teru</span>
            <span className="grid size-10 place-items-center rounded-full border border-white/28 bg-white/12 text-white shadow-[0_0_28px_rgba(255,255,255,0.16)] backdrop-blur-sm">
              <Sparkles size={18} aria-hidden="true" />
            </span>
          </div>
        </div>

        <div ref={dividerRef} className="relative z-10 mt-4 h-px w-full bg-white/12 sm:mt-5" />

        <div ref={lowerContentRef} className="relative z-10 mt-4 grid items-start gap-5 sm:mt-5 sm:grid-cols-[1fr_240px]">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-col sm:items-start sm:gap-2">
            {navItems.map((item, index) => (
              <a
                key={item}
                ref={(node) => {
                  if (node) linksRef.current[index] = node;
                }}
                href="#"
                className="group relative block w-fit rounded-2xl px-1 text-xl font-black leading-[1.04] tracking-[-0.045em] text-white/92 drop-shadow-[0_2px_14px_rgba(0,0,0,0.48)] transition duration-200 hover:scale-[1.035] hover:text-white sm:text-[34px]"
              >
                {item}
                <span className="absolute -bottom-1 left-0 h-1 w-full origin-left scale-x-0 rounded-full bg-white/70 transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </div>

          <div className="hidden justify-self-end sm:block">
            <div className="relative h-36 w-56 rounded-[2rem] border border-white/16 bg-transparent p-4 shadow-inner shadow-white/[0.03]">
              <div className="absolute bottom-7 left-8 h-16 w-20 rounded-2xl border border-white/28" />
              <div className="absolute bottom-10 left-12 size-9 rounded-full border border-white/35" />
              <div className="absolute bottom-6 right-11 h-24 w-10 rounded-full border border-white/22" />
              <div className="absolute right-8 top-7 h-12 w-16 rounded-xl border border-white/18" />
              <div className="absolute bottom-8 right-20 h-16 w-px rotate-12 bg-white/22" />
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
