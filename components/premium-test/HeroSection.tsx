"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FloatingCards } from "./FloatingCards";

export function HeroSection() {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current.children,
      { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.62, ease: "power3.out", stagger: 0.1, delay: 0.34 },
    );
  }, []);

  return (
    <main className="relative z-10 min-h-dvh overflow-hidden px-5 pt-[13rem] text-white sm:pt-[19rem]">
      <FloatingCards />

      <section className="mx-auto flex min-h-[calc(100dvh-15rem)] max-w-6xl items-center justify-center py-14 sm:min-h-[calc(100dvh-19rem)]">
        <div ref={contentRef} className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-cyan-50/82 shadow-lg shadow-black/10 backdrop-blur-xl">
            <ShieldCheck size={16} aria-hidden="true" />
            Glass UI con GSAP, fondo visible y profundidad real
          </div>

          <h1 className="text-balance text-5xl font-black tracking-[-0.055em] text-white drop-shadow-[0_8px_34px_rgba(0,0,0,0.28)] sm:text-7xl lg:text-8xl">
            Un panel transparente con sensación de vidrio real.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base font-medium leading-8 text-white/70 sm:text-lg">
            Esta variante usa GSAP y CSS glassmorphism: más transparente, más grande y con el fondo pasando por debajo,
            similar al efecto de la referencia.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#"
              className="group flex h-14 items-center gap-3 rounded-full bg-white px-6 text-sm font-black text-slate-950 shadow-2xl shadow-cyan-950/20 transition duration-200 hover:scale-[1.035]"
            >
              Probar variante
              <span className="grid size-8 place-items-center rounded-full bg-slate-950 text-white transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </a>
            <Link
              href="/"
              className="flex h-14 items-center rounded-full border border-white/16 bg-white/[0.055] px-6 text-sm font-bold text-white/76 backdrop-blur-xl transition hover:text-white"
            >
              Volver a la app
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
